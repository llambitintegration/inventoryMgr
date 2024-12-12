import os
import logging
from flask import Flask
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.exc import SQLAlchemyError

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
# Enable debug logging for SQLAlchemy
logging.getLogger('sqlalchemy.engine').setLevel(logging.DEBUG)

class Base(DeclarativeBase):
    pass

def create_app():
    # Create the Flask application
    app = Flask(__name__)
    
    # Configure the database
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL")
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_recycle": 300,
        "pool_pre_ping": True,
        "pool_timeout": 30,
        "max_overflow": 15
    }
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.secret_key = os.environ.get("FLASK_SECRET_KEY", "dev_key_only")
    app.debug = True  # Enable debug mode
    
    # Initialize the database
    from extensions import db
    db.init_app(app)
    
    with app.app_context():
        import models
        import routes
        
        try:
            db.create_all()
            logger.info("Database tables created successfully")
        except SQLAlchemyError as e:
            logger.error(f"Database initialization error: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Application initialization error: {str(e)}")
            raise
        
        # Register blueprints
        from routes import inventory_bp
        app.register_blueprint(inventory_bp)
    
    return app

# Create and run the application
if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)