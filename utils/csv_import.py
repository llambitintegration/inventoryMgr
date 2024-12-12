import pandas as pd
from models import db, Component, Supplier, Location
import logging

logger = logging.getLogger(__name__)

def process_csv_file(file):
    """Process and validate CSV file for import"""
    try:
        df = pd.read_csv(file)
        success_count = 0
        error_count = 0
        
        # Clean and validate data
        df = clean_data(df)
        
        # Process suppliers
        suppliers = process_suppliers(df)
        
        # Process locations
        locations = process_locations(df)
        
        # Process components
        for _, row in df.iterrows():
            try:
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
                
        db.session.commit()
        return {"success": success_count, "errors": error_count}
        
    except Exception as e:
        logger.error(f"Error processing CSV file: {str(e)}")
        raise

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
