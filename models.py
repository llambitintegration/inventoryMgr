from app import db
from datetime import datetime
from sqlalchemy.dialects.postgresql import ENUM, JSONB

component_type = ENUM('Mechanical', 'Electrical', name='component_type')

class Supplier(db.Model):
    __tablename__ = 'suppliers'
    supplier_id = db.Column(db.Integer, primary_key=True)
    supplier_name = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    components = db.relationship('Component', backref='supplier', lazy=True)

class Location(db.Model):
    __tablename__ = 'locations'
    location_id = db.Column(db.Integer, primary_key=True)
    location_code = db.Column(db.String(50), nullable=False, unique=True)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    components = db.relationship('Component', backref='location', lazy=True)

class Component(db.Model):
    __tablename__ = 'components'
    component_id = db.Column(db.Integer, primary_key=True)
    supplier_id = db.Column(db.Integer, db.ForeignKey('suppliers.supplier_id'))
    owner = db.Column(component_type, nullable=False)
    supplier_part_number = db.Column(db.String(100))
    ecolab_part_number = db.Column(db.String(8))
    description = db.Column(db.Text)
    current_quantity = db.Column(db.Integer, nullable=False, default=0)
    minimum_quantity = db.Column(db.Integer, default=0)
    location_id = db.Column(db.Integer, db.ForeignKey('locations.location_id'))
    unit_price = db.Column(db.Numeric(10,2))
    created_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    __table_args__ = (db.UniqueConstraint('supplier_id', 'supplier_part_number'),)

class InventoryTransaction(db.Model):
    __tablename__ = 'inventory_transactions'
    transaction_id = db.Column(db.Integer, primary_key=True)
    component_id = db.Column(db.Integer, db.ForeignKey('components.component_id'))
    transaction_type = db.Column(db.String(20), db.CheckConstraint("transaction_type IN ('IN', 'OUT', 'ADJUST')"))
    quantity = db.Column(db.Integer, nullable=False)
    previous_quantity = db.Column(db.Integer, nullable=False)
    new_quantity = db.Column(db.Integer, nullable=False)
    transaction_date = db.Column(db.DateTime(timezone=True), default=datetime.utcnow)
    user_id = db.Column(db.String(50), nullable=False)
    barcode_scanned = db.Column(db.Boolean, default=False)
    notes = db.Column(db.Text)
    component = db.relationship('Component', backref='transactions')

class BarcodeMapping(db.Model):
    __tablename__ = 'barcode_mappings'
    barcode_id = db.Column(db.String(100), primary_key=True)
    component_id = db.Column(db.Integer, db.ForeignKey('components.component_id'))
    barcode_type = db.Column(db.String(50))
    created_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    component = db.relationship('Component', backref='barcodes')

class PartDetailsCache(db.Model):
    __tablename__ = 'part_details_cache'
    cache_id = db.Column(db.Integer, primary_key=True)
    component_id = db.Column(db.Integer, db.ForeignKey('components.component_id'))
    manufacturer = db.Column(db.String(255))
    manufacturer_part_number = db.Column(db.String(100))
    specifications = db.Column(JSONB)
    datasheet_url = db.Column(db.Text)
    last_updated = db.Column(db.DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    component = db.relationship('Component', backref='details_cache')
