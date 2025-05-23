import pandas as pd
from models import db, Component, Supplier, Location
import logging

logger = logging.getLogger(__name__)

import threading

# Global variable to track import progress
current_import_status = {
    'total_rows': 0,
    'current_row': 0,
    'status': 'idle',
    'message': ''
}

def get_import_status():
    """Get the current import status"""
    return current_import_status

def process_csv_file(file):
    """Process and validate CSV file for import"""
    global current_import_status
    try:
        current_import_status['status'] = 'reading'
        current_import_status['message'] = 'Reading CSV file...'
        
        df = pd.read_csv(file)
        total_rows = len(df)
        current_import_status.update({
            'total_rows': total_rows,
            'current_row': 0,
            'status': 'processing'
        })
        
        success_count = 0
        error_count = 0
        
        # Clean and validate data
        current_import_status['message'] = 'Cleaning and validating data...'
        df = clean_data(df)
        
        # Process suppliers
        current_import_status['message'] = 'Processing suppliers...'
        suppliers = process_suppliers(df)
        
        # Process locations
        current_import_status['message'] = 'Processing locations...'
        locations = process_locations(df)
        
        # Process components
        current_import_status['message'] = 'Processing components...'
        for index, row in df.iterrows():
            try:
                current_import_status.update({
                    'current_row': index + 1,
                    'message': f'Processing row {index + 1} of {total_rows}'
                })
                
                supplier = suppliers.get(row['SUPPLIER'])
                location = locations.get(row['LOCATION'])
                
                if not supplier or not location:
                    error_count += 1
                    continue
                
                component = Component.query.filter_by(
                    supplier_id=supplier.supplier_id,
                    supplier_part_number=str(row['SUPPLIER PART#'])
                ).first()
                
                if component:
                    # Update existing component
                    component.current_quantity = row['QTY']
                    component.unit_price = row[' NET PRICE ']
                else:
                    # Create new component
                    component = Component(
                        supplier_id=supplier.supplier_id,
                        owner=row['Mechanical/Electrical'],
                        supplier_part_number=str(row['SUPPLIER PART#']),
                        ecolab_part_number=str(row['8-DIGIT']),
                        description=row['DESCRIPTION'],
                        current_quantity=row['QTY'],
                        location_id=location.location_id,
                        unit_price=row[' NET PRICE ']
                    )
                    db.session.add(component)
                
                success_count += 1
                
            except Exception as e:
                logger.error(f"Error processing row: {str(e)}")
                error_count += 1
                current_import_status['status'] = 'error'
                current_import_status['message'] = f"Error processing row {index+1}: {str(e)}"
                break

        db.session.commit()
        current_import_status.update({
            'status': 'completed',
            'message': f'Import completed. {success_count} records imported successfully, {error_count} errors.'
        })
        return {"success": success_count, "errors": error_count}
        
    except Exception as e:
        logger.error(f"Error processing CSV file: {str(e)}")
        current_import_status.update({
            'status': 'error',
            'message': f'Error: {str(e)}'
        })
        raise
    finally:
        # Reset status after a delay to handle final status check
        def reset_status():
            global current_import_status
            current_import_status = {
                'total_rows': 0,
                'current_row': 0,
                'status': 'idle',
                'message': ''
            }
        threading.Timer(5.0, reset_status).start()

def clean_data(df):
    """Clean and standardize CSV data"""
    # Fill NA values
    df = df.fillna('')
    
    # Convert quantities to integers
    df['QTY'] = pd.to_numeric(df['QTY'], errors='coerce').fillna(0).astype(int)
    
    # Clean price columns
    df[' NET PRICE '] = df[' NET PRICE '].replace('[\$,]', '', regex=True)
    df[' NET PRICE '] = pd.to_numeric(df[' NET PRICE '], errors='coerce').fillna(0)
    
    # Standardize Mechanical/Electrical field
    df['Mechanical/Electrical'] = df['Mechanical/Electrical'].map({
        'Mechanical': 'Mechanical',
        'M': 'Mechanical',
        'Electrical': 'Electrical',
        'E': 'Electrical'
    }).fillna('Mechanical')
    
    return df

def process_suppliers(df):
    """Process suppliers from CSV data"""
    suppliers = {}
    for supplier_name in df['SUPPLIER'].unique():
        if not supplier_name:
            continue
            
        supplier = Supplier.query.filter_by(supplier_name=supplier_name).first()
        if not supplier:
            supplier = Supplier(supplier_name=supplier_name)
            db.session.add(supplier)
            db.session.flush()
            
        suppliers[supplier_name] = supplier
    
    return suppliers

def process_locations(df):
    """Process locations from CSV data"""
    locations = {}
    for location_code in df['LOCATION'].unique():
        if not location_code:
            continue
            
        location = Location.query.filter_by(location_code=location_code).first()
        if not location:
            location = Location(location_code=location_code)
            db.session.add(location)
            db.session.flush()
            
        locations[location_code] = location
    
    return locations