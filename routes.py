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

@inventory_bp.route('/reports')
def reports():
    # Get low stock items
    low_stock = Component.query.filter(
        Component.current_quantity <= Component.minimum_quantity
    ).all()
    
    # Get transaction summary
    transactions = InventoryTransaction.query.order_by(
        InventoryTransaction.transaction_date.desc()
    ).limit(10)
    
    return render_template('reports.html',
                         low_stock=low_stock,
                         recent_transactions=transactions)
