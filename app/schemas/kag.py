from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional


class KagQueryRequest(BaseModel):
    """
    Schema for knowledge graph query requests.
    """
    query: str = Field(..., description="The natural language query to search for")
    document_type: Optional[str] = Field(None, description="Optional document type filter")
    limit: Optional[int] = Field(10, description="Maximum number of results to return")
    format_as_text: Optional[bool] = Field(False, description="Whether to return the response as natural language text instead of JSON")


class KagDocumentItem(BaseModel):
    """
    Schema for a document item in search results.
    """
    id: str
    title: Optional[str] = None
    content: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    score: Optional[float] = None


class KagEntityItem(BaseModel):
    """
    Schema for an entity item in search results.
    """
    id: str
    type: str
    name: str
    properties: Optional[Dict[str, Any]] = None
    relationships: Optional[List[Dict[str, Any]]] = None


class KagDocumentResponse(BaseModel):
    """
    Schema for a single document response.
    """
    document: KagDocumentItem
    entities: Optional[List[KagEntityItem]] = None
    relationships: Optional[List[Dict[str, Any]]] = None


class KagUploadResponse(BaseModel):
    """
    Schema for document upload response.
    """
    document_id: str
    status: str
    message: Optional[str] = None
    entities_count: Optional[int] = None
    relationships_count: Optional[int] = None
    graph_summary: Optional[Dict[str, Any]] = None


class KagSearchResponse(BaseModel):
    """
    Schema for search query response.
    """
    query: str
    results: List[KagDocumentItem]
    total_results: int
    entities: Optional[List[KagEntityItem]] = None


class KagSimplifiedResultItem(BaseModel):
    """
    Schema for a simplified result item.
    
    This model is dynamic and will only include fields that are relevant to the query.
    The invoice_number field is always included, while other fields are optional
    and will only be included if they are relevant to the query.
    """
    invoice_number: str
    date: Optional[str] = None
    total_amount: Optional[str] = None
    line_items: Optional[List[Dict[str, Any]]] = None


class KagSimplifiedQueryResponse(BaseModel):
    """
    Schema for simplified query response.
    
    The response includes:
    - The original query
    - The detected query type (price, invoice_number, date, product_details, general)
    - A list of results with only the relevant fields included
    """
    query: str
    query_type: str = Field(..., description="Type of query detected (price, invoice_number, date, product_details, general)")
    results: List[KagSimplifiedResultItem] 