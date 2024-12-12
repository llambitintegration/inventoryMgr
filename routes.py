from datetime import datetime, timedelta
from flask import Blueprint, render_template, request, jsonify, flash, redirect, url_for
from sqlalchemy import func, case, text
from sqlalchemy.exc import SQLAlchemyError
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
    try:
        search_term = request.args.get('q', '').strip()
        if not search_term:
            return jsonify([])

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
        
        results = query.limit(10).all()
        
        formatted_results = [{
            'id': c.component_id,
            'part_number': c.supplier_part_number,
            'description': c.description,
            'supplier': c.supplier.supplier_name,
            'location': c.location.location_code,
            'quantity': c.current_quantity,
            'type': c.owner
        } for c in results]
        
        return jsonify(formatted_results)
            
    except Exception as e:
        logger.error(f"Error in search: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@inventory_bp.route('/reports')
def reports():
    try:
        # Get summary metrics
        total_items = Component.query.count()
        total_value = db.session.query(
            func.sum(Component.current_quantity * Component.unit_price)
        ).scalar() or 0.0
        
        # Get low stock items
        low_stock = Component.query.filter(
            Component.current_quantity <= Component.minimum_quantity
        ).all()
        
        # Get supplier count
        supplier_count = Supplier.query.count()
        
        # Get category value data with proper type conversion and null handling
        try:
            category_values = db.session.query(
                Component.owner.label('category'),
                func.coalesce(func.sum(
                    Component.current_quantity * Component.unit_price
                ), 0.0).label('value')
            ).group_by(Component.owner).all()
            
            # Ensure we have valid category values
            if not category_values:
                category_values = [('Uncategorized', 0.0)]
                
            # Convert Decimal to float for JSON serialization with safe defaults
            labels = []
            values = []
            for row in category_values:
                category = str(row[0] if row[0] is not None else 'Uncategorized')
                value = float(row[1] if row[1] is not None else 0.0)
                labels.append(category)
                values.append(value)
                
            category_value_data = {
                'labels': labels,
                'datasets': [{
                    'data': values,
                    'backgroundColor': ['#198754', '#0d6efd', '#dc3545', '#ffc107'][:len(values)],
                    'borderWidth': 1,
                    'borderColor': '#343a40'
                }]
            }
            
            logger.debug(f"Processed category values: {category_value_data}")
            
        except Exception as e:
            logger.error(f"Error processing category values: {str(e)}")
            category_value_data = {
                'labels': ['No Data'],
                'datasets': [{
                    'data': [0],
                    'backgroundColor': ['#198754'],
                    'borderWidth': 1,
                    'borderColor': '#343a40'
                }]
            }
        
        # Log the data for debugging
        logger.debug(f"Category values query result: {category_values}")
        logger.debug(f"Formatted category value data: {category_value_data}")
        
        # Get recent transactions
        recent_transactions = InventoryTransaction.query\
            .join(Component)\
            .order_by(InventoryTransaction.transaction_date.desc())\
            .limit(10).all()
        
        # Get stock movement data for the last 30 days
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)
        
        stock_movement = db.session.query(
            func.date_trunc('day', InventoryTransaction.transaction_date).label('date'),
            func.sum(case(
                [(InventoryTransaction.transaction_type == 'IN', InventoryTransaction.quantity)],
                [(InventoryTransaction.transaction_type == 'OUT', -InventoryTransaction.quantity)],
                else_=0
            )).label('net_change')
        ).filter(
            InventoryTransaction.transaction_date.between(start_date, end_date)
        ).group_by('date').order_by('date').all()
        
        # Create complete date range
        dates = []
        current = start_date
        while current <= end_date:
            dates.append(current.date())
            current += timedelta(days=1)
        
        # Fill in missing dates with zero
        movement_dict = {movement.date.date(): float(movement.net_change or 0) 
                        for movement in stock_movement}
        complete_movement = [(date, movement_dict.get(date, 0)) for date in dates]
        
        stock_movement_data = {
            'labels': [date.strftime('%Y-%m-%d') for date, _ in complete_movement],
            'datasets': [{
                'label': 'Net Stock Change',
                'data': [float(change) for _, change in complete_movement],
                'borderColor': '#0d6efd',
                'backgroundColor': 'rgba(13, 110, 253, 0.1)',
                'tension': 0.1,
                'fill': True
            }]
        }
        
        logger.debug(f"Category Value Data: {category_value_data}")
        logger.debug(f"Stock Movement Data: {stock_movement_data}")
        
        return render_template('reports.html',
                           total_items=total_items,
                           total_value=total_value,
                           low_stock=low_stock,
                           supplier_count=supplier_count,
                           category_value_data=category_value_data,
                           stock_movement_data=stock_movement_data,
                           recent_transactions=recent_transactions)
                           
    except Exception as e:
        logger.error(f"Error generating reports: {str(e)}", exc_info=True)
        flash(f"Error generating reports: {str(e)}", "error")
        return redirect(url_for('inventory.index'))

@inventory_bp.route('/api/reports/stock-movement')
def get_stock_movement():
    try:
        start_date = request.args.get('start')
        end_date = request.args.get('end')
        
        if not start_date or not end_date:
            return jsonify({'error': 'Start and end dates are required'}), 400
            
        start_date = datetime.strptime(start_date, '%Y-%m-%d')
        end_date = datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)
        
        # Create a series of dates
        dates = []
        current = start_date
        while current <= end_date:
            dates.append(current.date())
            current += timedelta(days=1)
        
        # Query transactions for the date range with proper type handling
        stock_movement = db.session.query(
            func.date_trunc('day', InventoryTransaction.transaction_date).label('date'),
            func.sum(case(
                [(InventoryTransaction.transaction_type == 'IN', InventoryTransaction.quantity)],
                [(InventoryTransaction.transaction_type == 'OUT', -InventoryTransaction.quantity)],
                else_=0
            )).label('net_change')
        ).filter(
            InventoryTransaction.transaction_date.between(start_date, end_date)
        ).group_by('date').order_by('date').all()
        
        # Convert Decimal to float and handle missing dates
        movement_dict = {movement.date.date(): float(movement.net_change or 0) 
                        for movement in stock_movement}
        complete_movement = [(date, movement_dict.get(date, 0)) for date in dates]
        
        return jsonify({
            'labels': [date.strftime('%Y-%m-%d') for date, _ in complete_movement],
            'datasets': [{
                'label': 'Net Stock Change',
                'data': [float(change) for _, change in complete_movement],
                'borderColor': '#0d6efd',
                'backgroundColor': 'rgba(13, 110, 253, 0.1)',
                'tension': 0.1,
                'fill': True
            }]
        })
        
    except Exception as e:
        logger.error(f"Error fetching stock movement data: {str(e)}")
        return jsonify({'error': str(e)}), 500