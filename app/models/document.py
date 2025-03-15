from langchain.schema import Document
from typing import List, Dict, Any, Optional
import os
import uuid
from datetime import datetime

class DocumentModel:
    """Model for document management."""
    
    def __init__(self, 
                 file_path: str, 
                 content: str = None, 
                 metadata: Dict[str, Any] = None,
                 document_id: str = None):
        self.document_id = document_id or str(uuid.uuid4())
        self.file_path = file_path
        self.file_name = os.path.basename(file_path)
        self.content = content
        self.metadata = metadata or {}
        self.created_at = datetime.now().isoformat()
        self.updated_at = self.created_at
        
        # Add default metadata if not provided
        if 'source' not in self.metadata:
            self.metadata['source'] = self.file_path
        if 'file_type' not in self.metadata:
            self.metadata['file_type'] = os.path.splitext(self.file_name)[1].lower()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert the document model to a dictionary."""
        return {
            "document_id": self.document_id,
            "file_path": self.file_path,
            "file_name": self.file_name,
            "metadata": self.metadata,
            "created_at": self.created_at,
            "updated_at": self.updated_at
        }
    
    def to_langchain_document(self) -> Document:
        """Convert to LangChain Document format."""
        return Document(
            page_content=self.content,
            metadata=self.metadata
        )
    
    @classmethod
    def from_langchain_document(cls, doc: Document, file_path: str) -> 'DocumentModel':
        """Create a DocumentModel from a LangChain Document."""
        return cls(
            file_path=file_path,
            content=doc.page_content,
            metadata=doc.metadata
        )
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'DocumentModel':
        """Create a DocumentModel from a dictionary."""
        return cls(
            document_id=data.get("document_id"),
            file_path=data.get("file_path"),
            content=data.get("content"),
            metadata=data.get("metadata", {})
        ) 