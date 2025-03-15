from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from datetime import datetime

class DocumentBase(BaseModel):
    """Base schema for document data."""
    file_name: str = Field(..., description="Name of the document file")
    
class DocumentCreate(DocumentBase):
    """Schema for document creation."""
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Additional metadata for the document")

class DocumentResponse(DocumentBase):
    """Schema for document response."""
    document_id: str = Field(..., description="Unique identifier for the document")
    file_path: str = Field(..., description="Path to the document file")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata for the document")
    created_at: str = Field(..., description="Timestamp when the document was created")
    updated_at: str = Field(..., description="Timestamp when the document was last updated")
    
    class Config:
        from_attributes = True

class DocumentList(BaseModel):
    """Schema for a list of documents."""
    documents: List[DocumentResponse] = Field(..., description="List of documents")
    total: int = Field(..., description="Total number of documents")

class DocumentQuery(BaseModel):
    """Schema for document query."""
    query: str = Field(..., description="Query string for document search")
    k: int = Field(default=5, description="Number of documents to return")

class DocumentQueryResponse(BaseModel):
    """Schema for document query response."""
    query: str = Field(..., description="Original query string")
    results: List[Dict[str, Any]] = Field(..., description="Query results")
    conversational_response: str = Field("", description="Friendly, conversational response to the query")
    followup_questions: List[str] = Field(default_factory=list, description="Suggested follow-up questions")
    
class DocumentChunk(BaseModel):
    """Schema for a document chunk."""
    content: str = Field(..., description="Content of the document chunk")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Metadata for the document chunk")
    score: Optional[float] = Field(default=None, description="Relevance score")
    
class DocumentChunkList(BaseModel):
    """Schema for a list of document chunks."""
    chunks: List[DocumentChunk] = Field(..., description="List of document chunks")
    document_id: str = Field(..., description="ID of the parent document")
    total_chunks: int = Field(..., description="Total number of chunks in the document") 