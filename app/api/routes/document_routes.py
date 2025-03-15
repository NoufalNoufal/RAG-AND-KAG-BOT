from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Query
from typing import List, Optional
from pydantic import BaseModel

from app.schemas.document import (
    DocumentResponse, 
    DocumentList, 
    DocumentQuery, 
    DocumentQueryResponse
)
from app.services.document_service import document_service
from app.db.vector_store import vector_db

# Define a concise response schema
class ConciseDocumentQueryResponse(BaseModel):
    query: str
    concise_answer: str
    followup_questions: List[str]

router = APIRouter()

@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
):
    """
    Upload and process a document file (PDF, CSV, etc.).
    """
    # Check file extension
    if file.filename.lower().endswith('.pdf'):
        # Process PDF
        file_content = await file.read()
        success, message, document = await document_service.process_pdf(file_content, file.filename)
        
        if not success or not document:
            raise HTTPException(status_code=400, detail=message)
        
        return document.to_dict()
    
    elif file.filename.lower().endswith(('.csv', '.xlsx', '.xls')):
        # Process CSV/Excel
        file_content = await file.read()
        success, message, data = await document_service.process_csv(file_content, file.filename)
        
        if not success or not data:
            raise HTTPException(status_code=400, detail=message)
        
        # Return a simplified response for CSV/Excel files
        return {
            "document_id": "csv_data",
            "file_name": file.filename,
            "file_path": f"uploads/{file.filename}",
            "metadata": {
                "file_type": file.filename.split('.')[-1].lower(),
                "row_count": len(data),
                "column_count": len(data[0]) if data else 0
            },
            "created_at": "",
            "updated_at": ""
        }
    
    else:
        # Unsupported file type
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type: {file.filename.split('.')[-1]}"
        )

@router.get("/", response_model=DocumentList)
async def get_all_documents():
    """
    Get all documents.
    """
    documents = await document_service.get_all_documents()
    return {
        "documents": documents,
        "total": len(documents)
    }

@router.post("/query", response_model=DocumentQueryResponse)
async def query_documents(query: DocumentQuery):
    """
    Query documents using the vector store.
    
    Returns full document chunks along with a concise answer.
    """
    response = await document_service.query_documents(query.query, query.k)
    
    # Check if there was an error
    if "error" in response:
        raise HTTPException(status_code=400, detail=response["error"])
    
    return response

@router.post("/concise-query", response_model=ConciseDocumentQueryResponse)
async def concise_query_documents(query: DocumentQuery):
    """
    Query documents and return only a concise 1-2 sentence answer.
    
    This endpoint is optimized for quick, direct answers without returning the full document content.
    """
    response = await document_service.query_documents(query.query, query.k)
    
    # Check if there was an error
    if "error" in response:
        raise HTTPException(status_code=400, detail=response["error"])
    
    # Return only the concise answer and follow-up questions
    return {
        "query": response["query"],
        "concise_answer": response["concise_answer"],
        "followup_questions": response["followup_questions"]
    }

@router.post("/clear-vector-db")
async def clear_vector_database():
    """
    Clear all documents from the vector database.
    
    This endpoint removes all embeddings and documents from the vector store.
    Use with caution as this operation cannot be undone.
    """
    success, message = vector_db.clear()
    
    if not success:
        raise HTTPException(status_code=500, detail=message)
    
    return {"status": "success", "message": message}

@router.get("/list-pdfs")
async def list_pdf_documents():
    """
    List all available PDF documents in the system.
    
    Returns a list of all PDF documents that have been uploaded and processed.
    """
    try:
        documents = await document_service.get_all_documents()
        
        # Filter to only include PDFs
        pdf_documents = [doc for doc in documents if doc.get("metadata", {}).get("file_type") == "pdf"]
        
        # Format the response
        formatted_docs = []
        for doc in pdf_documents:
            formatted_docs.append({
                "document_id": doc.get("document_id", ""),
                "file_name": doc.get("metadata", {}).get("filename", ""),
                "page_count": doc.get("metadata", {}).get("page_count", 0),
                "processed_at": doc.get("metadata", {}).get("processed_at", ""),
            })
        
        return {
            "status": "success",
            "count": len(formatted_docs),
            "documents": formatted_docs
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing PDF documents: {str(e)}")

@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(document_id: str):
    """
    Get a document by ID.
    """
    document = await document_service.get_document_by_id(document_id)
    
    if not document:
        raise HTTPException(
            status_code=404,
            detail=f"Document with ID {document_id} not found"
        )
    
    return document 