import logging
from app.utils.logging import setup_logging
from app.db.neo4j import neo4j_db
from app.db.vector_store import vector_db
import os
from app.core.config import settings

logger = logging.getLogger(__name__)

def initialize_app():
    """
    Initialize the application.
    
    This function sets up logging, connects to databases, and performs other initialization tasks.
    """
    # Set up logging
    setup_logging()
    
    logger.info("Initializing application...")
    
    # Log Neo4j connection details from settings (not environment variables)
    logger.info(f"Neo4j URI: {settings.NEO4J_URI}")
    logger.info(f"Neo4j Username: {settings.NEO4J_USER}")
    logger.info(f"Neo4j Password: {'*' * len(settings.NEO4J_PASSWORD) if settings.NEO4J_PASSWORD else 'Not set'}")
    
    # Connect to Neo4j
    neo4j_success, neo4j_message = neo4j_db.verify_connectivity()
    if neo4j_success:
        logger.info(f"Neo4j connection established: {neo4j_message}")
    else:
        logger.warning(f"Failed to connect to Neo4j: {neo4j_message}")
        logger.warning("Knowledge Graph features will not work properly.")
        logger.warning("Please check your Neo4j connection settings and ensure the Neo4j server is running.")
    
    # Initialize vector store
    vector_success = vector_db.connect()
    if vector_success:
        logger.info("Vector store initialized")
    else:
        logger.warning("Failed to initialize vector store. Document search features will not work properly.")
        logger.warning("Please check your OpenAI API key and ensure it is valid.")
    
    logger.info("Application initialization complete")