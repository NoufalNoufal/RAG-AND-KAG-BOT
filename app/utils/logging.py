import logging
import sys
from typing import Optional

from app.core.config import settings

def setup_logging(log_level: Optional[str] = None):
    """
    Set up logging configuration.
    
    Args:
        log_level: Optional log level to override the one in settings
    """
    # Get log level from settings or parameter
    level = log_level or settings.LOG_LEVEL
    
    # Convert string to logging level
    numeric_level = getattr(logging, level.upper(), None)
    if not isinstance(numeric_level, int):
        numeric_level = logging.INFO
    
    # Configure logging
    logging.basicConfig(
        level=numeric_level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    # Set log levels for specific loggers
    logging.getLogger("uvicorn").setLevel(numeric_level)
    logging.getLogger("fastapi").setLevel(numeric_level)
    
    # Reduce verbosity of some loggers
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    
    # Log configuration
    logging.info(f"Logging configured with level: {level}")

def get_logger(name: str):
    """
    Get a logger with the specified name.
    
    Args:
        name: The name of the logger
        
    Returns:
        A logger instance
    """
    return logging.getLogger(name) 