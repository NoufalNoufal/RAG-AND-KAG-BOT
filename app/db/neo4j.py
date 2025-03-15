import logging
from typing import Dict, Any, List, Tuple, Optional
import time

from neo4j import GraphDatabase, Driver, Session, Result
from neo4j.exceptions import ServiceUnavailable, AuthError

from app.core.config import settings

# Configure logging
logger = logging.getLogger(__name__)

class Neo4jDatabase:
    """
    Neo4j database connection and query execution.
    """
    
    def __init__(self):
        """Initialize the Neo4j database connection."""
        self.uri = settings.NEO4J_URI
        self.user = settings.NEO4J_USER
        self.password = settings.NEO4J_PASSWORD
        self.driver: Optional[Driver] = None
        self.connected = False
        
        # Try to connect to Neo4j
        self._connect()
    
    def _connect(self) -> None:
        """
        Connect to the Neo4j database.
        """
        try:
            self.driver = GraphDatabase.driver(
                self.uri, 
                auth=(self.user, self.password)
            )
            # Verify connection
            self.driver.verify_connectivity()
            self.connected = True
            logger.info(f"Connected to Neo4j database at {self.uri}")
        except (ServiceUnavailable, AuthError) as e:
            self.connected = False
            logger.error(f"Failed to connect to Neo4j: {str(e)}")
    
    def verify_connectivity(self) -> Tuple[bool, str]:
        """
        Verify connectivity to the Neo4j database.
        
        Returns:
            Tuple of (connected, message)
        """
        if not self.driver:
            self._connect()
            
        if not self.driver:
            return False, "Neo4j driver not initialized"
        
        try:
            self.driver.verify_connectivity()
            return True, "Connected to Neo4j"
        except Exception as e:
            logger.error(f"Neo4j connectivity check failed: {str(e)}")
            return False, f"Failed to connect to Neo4j: {str(e)}"
    
    def execute_query(self, query: str, params: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """
        Execute a Cypher query and return the results.
        
        Args:
            query: Cypher query string
            params: Query parameters
            
        Returns:
            List of query results as dictionaries
        """
        if not self.driver:
            self._connect()
            
        if not self.driver:
            logger.error("Cannot execute query: Neo4j driver not initialized")
            return []
        
        start_time = time.time()
        
        try:
            with self.driver.session() as session:
                result = session.run(query, params or {})
                records = [record.data() for record in result]
                
                execution_time = time.time() - start_time
                logger.info(f"Query executed in {execution_time:.2f}s: {query[:100]}...")
                
                return records
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(f"Query failed after {execution_time:.2f}s: {str(e)}")
            logger.error(f"Failed query: {query}")
            raise
    
    def close(self) -> None:
        """
        Close the Neo4j database connection.
        """
        if self.driver:
            self.driver.close()
            self.driver = None
            self.connected = False
            logger.info("Neo4j connection closed")

# Create a singleton instance
neo4j_db = Neo4jDatabase()