from flask import Blueprint, render_template, request, jsonify, flash, redirect, url_for
from models import db, Component, Supplier, Location, InventoryTransaction
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

inventory_bp = Blueprint('inventory', __name__)
from flask import Blueprint, render_template, request, jsonify, flash, redirect, url_for
from models import db, Component, Supplier, Location, InventoryTransaction
from utils.csv_import import process_csv_file
import logging

inventory_bp = Blueprint('inventory', __name__)
logger = logging.getLogger(__name__)

@inventory_bp.route('/')
def index():
    return render_template('index.html')

@inventory_bp.route('/inventory')
def inventory():
    components = Component.query.all()
    suppliers = Supplier.query.all()
    locations = Location.query.all()
    return render_template('inventory.html', 
                         components=components,
                         suppliers=suppliers,
                         locations=locations)

@inventory_bp.route('/import', methods=['GET', 'POST'])
def import_csv():
    if request.method == 'POST':
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
            
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
            
        try:
            results = process_csv_file(file)
            return jsonify({
                'success': True,
                'message': f'Successfully imported {results["success"]} records. {results["errors"]} errors.'
            })
        except Exception as e:
            logger.error(f"Error importing CSV: {str(e)}")
            return jsonify({'error': str(e)}), 500
        
    return render_template('import.html')

@inventory_bp.route('/api/import/status')
def import_status():
    """Get the current import status"""
    from utils.csv_import import get_import_status
    return jsonify(get_import_status())

@inventory_bp.route('/transactions')
def transactions():
    transactions = InventoryTransaction.query.order_by(
        InventoryTransaction.transaction_date.desc()
    ).limit(100)
    return render_template('transactions.html', transactions=transactions)

@inventory_bp.route('/api/inventory/update', methods=['POST'])
def update_inventory():
    try:
        data = request.json
        component = Component.query.get(data['component_id'])
        if not component:
            return jsonify({'error': 'Component not found'}), 404
            
        prev_quantity = component.current_quantity
        new_quantity = int(data['quantity'])
        
        # Create transaction record
        transaction = InventoryTransaction(
            component_id=component.component_id,
            transaction_type=data['type'],
            quantity=abs(new_quantity - prev_quantity),
            previous_quantity=prev_quantity,
            new_quantity=new_quantity,
            user_id=data.get('user_id', 'system'),
            notes=data.get('notes')
        )
        
        component.current_quantity = new_quantity
        
        db.session.add(transaction)
        db.session.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Error updating inventory: {str(e)}")
        return jsonify({'error': str(e)}), 500

@inventory_bp.route('/api/inventory/search', methods=['GET'])
def search_inventory():
    """Search inventory components across multiple fields."""
    try:
        # Enhanced debugging
        logger.info("\n=== Search Request Started ===")
        logger.info(f"Request Method: {request.method}")
        logger.info(f"Request URL: {request.url}")
        logger.info(f"Request Args: {request.args}")
        logger.info(f"Request Headers: {dict(request.headers)}")
        logger.info(f"Raw Query Param: {request.args.get('q', '')}")
        
        search_term = request.args.get('q', '').strip()
        logger.info(f"Processed search term: '{search_term}'")
        
        if not search_term:
            logger.info("Empty search term, returning empty results")
            return jsonify([])

        # Database connection check
        try:
            db.session.execute(db.select(db.text('1'))).scalar()
            component_count = Component.query.count()
            supplier_count = Supplier.query.count()
            location_count = Location.query.count()
            logger.info(f"Database status - Components: {component_count}, Suppliers: {supplier_count}, Locations: {location_count}")
        except SQLAlchemyError as db_error:
            logger.error(f"Database connection error: {str(db_error)}")
            return jsonify({'error': 'Database connection error'}), 500
        
        # Build search query
        query = Component.query\
            .join(Supplier)\
            .join(Location)\
            .filter(
                db.or_(
                    Component.supplier_part_number.ilike(f'%{search_term}%'),
                    Component.description.ilike(f'%{search_term}%'),
                    Component.ecolab_part_number.ilike(f'%{search_term}%'),
                    Supplier.supplier_name.ilike(f'%{search_term}%'),
                    Location.location_code.ilike(f'%{search_term}%')
                )
            )
        
        # Log the SQL query
        sql = str(query.statement.compile(compile_kwargs={"literal_binds": True}))
        logger.info(f"Executing SQL query:\n{sql}")
        
        # Execute query with debugging
        try:
            results = query.limit(10).all()
            logger.info(f"Query executed successfully, found {len(results)} results")
        except Exception as query_error:
            logger.error(f"Query execution error: {str(query_error)}")
            return jsonify({'error': 'Error executing search query'}), 500
        
        # Format results with detailed logging
        try:
            formatted_results = []
            for c in results:
                result = {
                    'id': c.component_id,
                    'part_number': c.supplier_part_number,
                    'description': c.description,
                    'supplier': c.supplier.supplier_name,
                    'location': c.location.location_code,
                    'quantity': c.current_quantity,
                    'type': c.owner
                }
                formatted_results.append(result)
                logger.debug(f"Formatted result: {result}")
            
            logger.info(f"Successfully formatted {len(formatted_results)} results")
            logger.info("=== Search Request Completed Successfully ===")
            return jsonify(formatted_results)
            
        except Exception as format_error:
            logger.error(f"Error formatting results: {str(format_error)}")
            return jsonify({'error': 'Error formatting search results'}), 500

    except Exception as e:
        logger.error("=== Search Request Failed ===")
        logger.error(f"Unhandled error in search: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500
@inventory_bp.route('/reports')
def reports():
    # Get low stock items
    low_stock = Component.query.filter(
        Component.current_quantity <= Component.minimum_quantity
    ).all()
    
    # Get transaction summary
    transactions = InventoryTransaction.query.order_by(
        InventoryTransaction.transaction_date.desc()
    ).limit(10).all()
    
    # Calculate summary metrics
    total_items = Component.query.count()
    total_value = db.session.query(
        db.func.sum(Component.current_quantity * Component.unit_price)
    ).scalar() or 0
    supplier_count = Supplier.query.count()
    
    # Get category value data
    category_values = db.session.query(
        Component.owner,
        db.func.sum(Component.current_quantity * Component.unit_price).label('value')
    ).group_by(Component.owner).all()
    
    category_value_data = {
        'labels': [category[0] for category in category_values],
        'datasets': [{
            'data': [float(category[1] or 0) for category in category_values],
            'backgroundColor': ['#198754', '#0d6efd']
        }]
    }
    
    # Get stock movement trend for the last 30 days
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    stock_movement = db.session.query(
        db.func.date_trunc('day', InventoryTransaction.transaction_date).label('date'),
        db.func.sum(db.case(
            (InventoryTransaction.transaction_type == 'IN', InventoryTransaction.quantity),
            (InventoryTransaction.transaction_type == 'OUT', -InventoryTransaction.quantity),
            else_=0
        )).label('net_change')
    ).filter(
        InventoryTransaction.transaction_date >= thirty_days_ago
    ).group_by(
        'date'
    ).order_by('date').all()
    
    stock_movement_data = {
        'labels': [date.strftime('%Y-%m-%d') for date, _ in stock_movement],
        'datasets': [{
            'label': 'Net Stock Change',
            'data': [int(change) for _, change in stock_movement],
            'borderColor': '#0d6efd',
            'tension': 0.1
        }]
    }
    
    # Add debug logging
    logger.debug(f"Category Value Data: {category_value_data}")
    logger.debug(f"Stock Movement Data: {stock_movement_data}")
    
    return render_template('reports.html',
                         low_stock=low_stock,
                         recent_transactions=transactions,
                         total_items=total_items,
                         total_value=total_value,
                         supplier_count=supplier_count,
                         category_value_data=category_value_data,
                         stock_movement_data=stock_movement_data)

@inventory_bp.route('/api/inventory/component/<part_number>')
def get_component_details(part_number):
    try:
        component = Component.query.join(Supplier).join(Location).filter(
            Component.supplier_part_number == part_number
        ).first()
        
        if not component:
            return jsonify({'error': 'Component not found'}), 404
            
        # Get recent transactions
        transactions = InventoryTransaction.query.filter_by(
            component_id=component.component_id
        ).order_by(
            InventoryTransaction.transaction_date.desc()
        ).limit(5).all()
        
        return jsonify({
            'component': {
                'component_id': component.component_id,
                'supplier_part_number': component.supplier_part_number,
                'description': component.description,
                'supplier_name': component.supplier.supplier_name,
                'current_quantity': component.current_quantity,
                'location_code': component.location.location_code,
                'owner': component.owner
            },
            'transactions': [{
                'transaction_date': t.transaction_date.isoformat(),
                'transaction_type': t.transaction_type,
                'quantity': t.quantity,
                'notes': t.notes
            } for t in transactions]
        })
        
    except Exception as e:
        logger.error(f"Error fetching component details: {str(e)}")
        return jsonify({'error': str(e)}), 500
