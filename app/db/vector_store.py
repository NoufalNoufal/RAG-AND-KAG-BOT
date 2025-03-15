from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma
from app.core.config import settings
import logging
import shutil
import os
import time
import subprocess

logger = logging.getLogger(__name__)

class VectorDatabase:
    def __init__(self):
        self.persist_directory = settings.CHROMA_PERSIST_DIRECTORY
        self.collection_name = settings.COLLECTION_NAME
        self._vector_store = None
        self._embeddings = None
        
        # Ensure the directory exists with proper permissions on initialization
        self._ensure_directory_exists()

    def _ensure_directory_exists(self):
        """Ensure the persist directory exists with proper permissions."""
        try:
            if not os.path.exists(self.persist_directory):
                os.makedirs(self.persist_directory, exist_ok=True)
            
            # Set proper permissions - make it writable by everyone to avoid permission issues
            os.chmod(self.persist_directory, 0o777)
            
            # If on macOS, try to remove any extended attributes that might cause issues
            if os.uname().sysname == 'Darwin':
                try:
                    subprocess.run(['xattr', '-c', self.persist_directory], check=False)
                except Exception as e:
                    logger.warning(f"Could not remove extended attributes: {str(e)}")
            
            logger.info(f"Ensured vector store directory exists with proper permissions: {self.persist_directory}")
        except Exception as e:
            logger.error(f"Error ensuring directory exists: {str(e)}")

    def connect(self):
        """Initialize the vector store connection."""
        try:
            # Ensure directory exists with proper permissions before connecting
            self._ensure_directory_exists()
            
            logger.info(f"Initializing vector store at: {self.persist_directory}")
            self._embeddings = OpenAIEmbeddings()
            
            # Create the Chroma instance directly with persist_directory
            self._vector_store = Chroma(
                persist_directory=self.persist_directory,
                embedding_function=self._embeddings,
                collection_name=self.collection_name,
                client_settings={"anonymized_telemetry": False}  # Disable telemetry which might cause issues
            )
            
            logger.info("Vector store initialized successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize vector store: {str(e)}")
            # If there's a permission error or database corruption, try to recreate the directory
            if "readonly database" in str(e).lower() or "permission" in str(e).lower():
                logger.warning("Detected possible permission issue, attempting to recreate the vector store directory")
                return self._recreate_vector_store()
            return False

    def _recreate_vector_store(self):
        """Recreate the vector store directory and reinitialize."""
        try:
            # Close any existing connection
            self._vector_store = None
            
            # Remove and recreate the directory
            if os.path.exists(self.persist_directory):
                shutil.rmtree(self.persist_directory)
                logger.info(f"Removed vector store directory: {self.persist_directory}")
            
            # Wait a moment to ensure file system operations complete
            time.sleep(0.5)
            
            # Recreate the directory with proper permissions
            os.makedirs(self.persist_directory, exist_ok=True)
            os.chmod(self.persist_directory, 0o777)  # Make it writable by everyone
            
            # If on macOS, try to remove any extended attributes that might cause issues
            if os.uname().sysname == 'Darwin':
                try:
                    subprocess.run(['xattr', '-c', self.persist_directory], check=False)
                except Exception as e:
                    logger.warning(f"Could not remove extended attributes: {str(e)}")
            
            # Reinitialize the vector store
            self._embeddings = OpenAIEmbeddings()
            
            # Create the Chroma instance directly with persist_directory
            self._vector_store = Chroma(
                persist_directory=self.persist_directory,
                embedding_function=self._embeddings,
                collection_name=self.collection_name,
                client_settings={"anonymized_telemetry": False}  # Disable telemetry which might cause issues
            )
            
            logger.info("Vector store recreated successfully")
            return True
        except Exception as e:
            logger.error(f"Error recreating vector store: {str(e)}")
            return False

    def get_vector_store(self):
        """Get the vector store instance."""
        if not self._vector_store:
            self.connect()
        return self._vector_store

    def add_documents(self, documents):
        """Add documents to the vector store."""
        try:
            vector_store = self.get_vector_store()
            
            # Try to add documents
            vector_store.add_documents(documents)
            
            # No need to explicitly persist - Chroma handles this automatically
            logger.info(f"Added {len(documents)} documents to vector store")
            return True
        except Exception as e:
            logger.error(f"Error adding documents to vector store: {str(e)}")
            # If there's a permission error, try to recreate the vector store
            if "readonly database" in str(e).lower() or "permission" in str(e).lower():
                logger.warning("Detected permission issue while adding documents, attempting to recreate the vector store")
                success = self._recreate_vector_store()
                if success and self._vector_store:
                    # Try adding documents again
                    try:
                        self._vector_store.add_documents(documents)
                        logger.info(f"Successfully added {len(documents)} documents after recreating vector store")
                        return True
                    except Exception as inner_e:
                        logger.error(f"Error adding documents after recreating vector store: {str(inner_e)}")
            
            # As a last resort, try using an in-memory store
            try:
                logger.warning("Attempting to use in-memory vector store as fallback")
                self._embeddings = OpenAIEmbeddings()
                in_memory_store = Chroma(
                    collection_name=self.collection_name,
                    embedding_function=self._embeddings,
                    persist_directory=None  # In-memory only
                )
                in_memory_store.add_documents(documents)
                self._vector_store = in_memory_store
                logger.info(f"Successfully added {len(documents)} documents to in-memory vector store")
                return True
            except Exception as mem_e:
                logger.error(f"Error using in-memory vector store: {str(mem_e)}")
                
            return False

    def similarity_search(self, query, k=5):
        """Perform similarity search on the vector store."""
        try:
            vector_store = self.get_vector_store()
            docs = vector_store.similarity_search(query, k=k)
            logger.info(f"Performed similarity search for query: {query}")
            return docs
        except Exception as e:
            logger.error(f"Error performing similarity search: {str(e)}")
            return []

    def clear(self):
        """Clear all documents from the vector store."""
        try:
            # Close the current connection
            self._vector_store = None
            
            # Remove the persist directory
            if os.path.exists(self.persist_directory):
                shutil.rmtree(self.persist_directory)
                logger.info(f"Removed vector store directory: {self.persist_directory}")
            
            # Wait a moment to ensure file system operations complete
            time.sleep(0.5)
            
            # Recreate the directory with proper permissions
            os.makedirs(self.persist_directory, exist_ok=True)
            os.chmod(self.persist_directory, 0o777)  # Make it writable by everyone
            
            # If on macOS, try to remove any extended attributes that might cause issues
            if os.uname().sysname == 'Darwin':
                try:
                    subprocess.run(['xattr', '-c', self.persist_directory], check=False)
                except Exception as e:
                    logger.warning(f"Could not remove extended attributes: {str(e)}")
            
            # Completely reinitialize the embeddings and vector store
            self._embeddings = OpenAIEmbeddings()
            
            # Create the Chroma instance directly with persist_directory
            self._vector_store = Chroma(
                persist_directory=self.persist_directory,
                embedding_function=self._embeddings,
                collection_name=self.collection_name,
                client_settings={"anonymized_telemetry": False}  # Disable telemetry which might cause issues
            )
            
            logger.info("Vector store cleared successfully")
            return True, "Vector store cleared successfully"
        except Exception as e:
            error_message = f"Error clearing vector store: {str(e)}"
            logger.error(error_message)
            return False, error_message

# Create a singleton instance
vector_db = VectorDatabase()