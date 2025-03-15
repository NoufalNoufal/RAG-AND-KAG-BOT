#!/usr/bin/env python
import os
import sys
import logging
import uvicorn
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Add the project root to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Create required directories
def setup_directories():
    """Create required directories for the application."""
    dirs = [
        "uploads",
        "data",
        "data/chroma_db",
        "static"  # Add this to fix the static directory error
    ]
    
    for dir_path in dirs:
        full_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), dir_path)
        if not os.path.exists(full_path):
            os.makedirs(full_path)
            logger.info(f"Created directory: {full_path}")

if __name__ == "__main__":
    # Setup directories
    setup_directories()
    
    # Run the application
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True) 