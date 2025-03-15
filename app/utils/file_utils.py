import os
import json
import logging
from typing import Dict, Any, Optional, List, Tuple
import uuid

logger = logging.getLogger(__name__)

def save_file(file_content: bytes, filename: str, directory: str) -> Tuple[bool, str, str]:
    """
    Save a file to the specified directory.
    
    Args:
        file_content: The binary content of the file
        filename: The name of the file
        directory: The directory to save the file to
        
    Returns:
        Tuple of (success, message, file_path)
    """
    try:
        # Create a unique filename to avoid collisions
        unique_filename = f"{uuid.uuid4().hex}_{filename}"
        file_path = os.path.join(directory, unique_filename)
        
        # Ensure directory exists
        os.makedirs(directory, exist_ok=True)
        
        # Save the file
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        logger.info(f"Saved file to {file_path}")
        
        return True, f"Successfully saved file: {filename}", file_path
        
    except Exception as e:
        error_message = f"Error saving file: {str(e)}"
        logger.error(error_message)
        return False, error_message, ""

def save_metadata(metadata: Dict[str, Any], filename: str, directory: str) -> Tuple[bool, str, str]:
    """
    Save metadata to a JSON file.
    
    Args:
        metadata: The metadata to save
        filename: The name of the metadata file
        directory: The directory to save the file to
        
    Returns:
        Tuple of (success, message, file_path)
    """
    try:
        # Ensure directory exists
        os.makedirs(directory, exist_ok=True)
        
        # Create file path
        file_path = os.path.join(directory, filename)
        
        # Save the metadata
        with open(file_path, "w") as f:
            json.dump(metadata, f, indent=2)
        
        logger.info(f"Saved metadata to {file_path}")
        
        return True, f"Successfully saved metadata: {filename}", file_path
        
    except Exception as e:
        error_message = f"Error saving metadata: {str(e)}"
        logger.error(error_message)
        return False, error_message, ""

def get_file_extension(filename: str) -> str:
    """
    Get the extension of a file.
    
    Args:
        filename: The name of the file
        
    Returns:
        The file extension (lowercase, without the dot)
    """
    return os.path.splitext(filename)[1].lower().lstrip(".")

def list_files(directory: str, extensions: Optional[List[str]] = None) -> List[str]:
    """
    List files in a directory, optionally filtered by extension.
    
    Args:
        directory: The directory to list files from
        extensions: Optional list of extensions to filter by (without the dot)
        
    Returns:
        List of file paths
    """
    try:
        # Ensure directory exists
        if not os.path.exists(directory):
            return []
        
        # List files
        files = []
        for filename in os.listdir(directory):
            file_path = os.path.join(directory, filename)
            
            # Check if it's a file
            if not os.path.isfile(file_path):
                continue
            
            # Check extension if specified
            if extensions:
                ext = get_file_extension(filename)
                if ext not in extensions:
                    continue
            
            files.append(file_path)
        
        return files
        
    except Exception as e:
        logger.error(f"Error listing files: {str(e)}")
        return []

def delete_file(file_path: str) -> Tuple[bool, str]:
    """
    Delete a file.
    
    Args:
        file_path: The path to the file to delete
        
    Returns:
        Tuple of (success, message)
    """
    try:
        # Check if file exists
        if not os.path.exists(file_path):
            return False, f"File not found: {file_path}"
        
        # Delete the file
        os.remove(file_path)
        
        logger.info(f"Deleted file: {file_path}")
        
        return True, f"Successfully deleted file: {file_path}"
        
    except Exception as e:
        error_message = f"Error deleting file: {str(e)}"
        logger.error(error_message)
        return False, error_message 