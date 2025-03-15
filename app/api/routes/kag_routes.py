from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Body
from typing import Dict, Any, Optional, List
import traceback
import logging
import json
import os
import tempfile
from fastapi.responses import JSONResponse, PlainTextResponse

from app.services.kag_service import kag_service
from app.core.config import settings
from app.schemas.kag import (
    KagQueryRequest,
    KagDocumentResponse,
    KagUploadResponse,
    KagSearchResponse,
    KagSimplifiedQueryResponse
)

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/upload-pdf", response_model=KagUploadResponse)
async def upload_kag_pdf(file: UploadFile = File(...)):
    """
    Upload a PDF document to create a knowledge graph using KAG.
    
    This endpoint:
    1. Accepts a PDF document file
    2. Processes it with the KAG service
    3. Creates a knowledge graph in Neo4j
    4. Returns the document ID and graph structure
    """
    try:
        # Save the uploaded file temporarily
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
        temp_file_path = temp_file.name
        
        try:
            # Write the file content to the temporary file
            content = await file.read()
            with open(temp_file_path, "wb") as f:
                f.write(content)
            
            # Process the document with KAG service
            result = kag_service.process_input(temp_file_path, "pdf")
            
            if "error" in result:
                raise HTTPException(
                    status_code=500,
                    detail=f"Error processing PDF: {result['error']}"
                )
            
            # Transform the response to match KagUploadResponse schema
            graph_structure = result.get("graph_structure", {})
            entities = graph_structure.get("entities", [])
            relationships = graph_structure.get("relationships", [])
            
            response = {
                "document_id": result["document_id"],
                "status": "success",
                "message": "Document processed successfully",
                "entities_count": len(entities),
                "relationships_count": len(relationships),
                "graph_summary": graph_structure
            }
                
            return response
            
        finally:
            # Clean up the temporary file
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
                
    except Exception as e:
        logger.error(f"Error processing KAG PDF: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Error processing PDF: {str(e)}"
        )

@router.post("/upload", response_model=KagUploadResponse)
async def upload_kag_document(file: UploadFile = File(...)):
    """
    Alias for /upload-pdf endpoint.
    
    This endpoint:
    1. Accepts a PDF document file
    2. Redirects to the /upload-pdf endpoint
    """
    return await upload_kag_pdf(file)

@router.post("/query", response_model=KagSearchResponse)
async def query_kag(request: KagQueryRequest):
    """
    Query the knowledge graph using natural language.
    
    This endpoint:
    1. Accepts a natural language query
    2. Searches the knowledge graph using semantic search
    3. Returns the matching documents and entities
    """
    try:
        # Process the query with KAG service
        results = kag_service.search(
            query=request.query,
            document_type=request.document_type
        )
        
        # Transform results to match KagDocumentItem schema
        transformed_results = []
        for result in results:
            # Map document_id to id as required by KagDocumentItem
            transformed_result = {
                "id": result.get("document_id", ""),
                "title": f"Invoice {result.get('invoice_number', '')}",
                "content": f"Date: {result.get('date', '')}, Amount: {result.get('total_amount', '')}",
                "metadata": {
                    "invoice_number": result.get("invoice_number", ""),
                    "date": result.get("date", ""),
                    "total_amount": result.get("total_amount", ""),
                    "line_items": result.get("line_items", [])
                },
                "score": 1.0  # Default score
            }
            transformed_results.append(transformed_result)
        
        return {
            "query": request.query,
            "results": transformed_results,
            "total_results": len(transformed_results),
            "entities": []  # Optional field
        }
        
    except Exception as e:
        logger.error(f"Error querying KAG: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Error querying knowledge graph: {str(e)}"
        )

@router.post("/simplified-query", response_model=None)
async def simplified_query_kag(request: KagQueryRequest):
    """
    Dynamic query endpoint that extracts and returns only the relevant information based on query analysis.
    
    This endpoint:
    1. Accepts a natural language query
    2. Uses AI to analyze the query intent and extract only the relevant information
    3. Returns a simplified response with only the requested information
    4. Can return either JSON or natural language based on the format_as_text parameter
    
    Examples:
    - "What is the invoice number?" → Returns only invoice numbers
    - "How much does it cost?" → Returns invoice numbers and total amounts
    - "When was this invoice issued?" → Returns invoice numbers and dates
    - "What items are in this invoice?" → Returns invoice numbers and line items
    """
    try:
        # Process the query with KAG service
        results = kag_service.search(
            query=request.query,
            document_type=request.document_type
        )
        
        # Use OpenAI to analyze the query intent
        query_intent = kag_service.analyze_query_intent(request.query)
        
        # Initialize response structure
        simplified_response = {
            "query": request.query,
            "query_type": query_intent["type"],
            "results": []
        }
        
        # Extract only the relevant fields based on query intent
        for result in results:
            result_item = {"invoice_number": result.get("invoice_number", "")}
            
            # Add fields based on query intent
            for field in query_intent["fields"]:
                if field == "total_amount" and "total_amount" in result:
                    result_item["total_amount"] = result.get("total_amount", "")
                elif field == "date" and "date" in result:
                    result_item["date"] = result.get("date", "")
                elif field == "line_items" and "line_items" in result:
                    result_item["line_items"] = result.get("line_items", [])
            
            simplified_response["results"].append(result_item)
        
        # Check if format_as_text parameter is present and true
        if hasattr(request, 'format_as_text') and request.format_as_text:
            # Generate a natural language response based on the query type
            text_response = generate_text_response(simplified_response)
            return PlainTextResponse(content=text_response)
        
        return simplified_response
        
    except Exception as e:
        logger.error(f"Error in simplified query: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Error processing simplified query: {str(e)}"
        )

def generate_text_response(response_data: Dict) -> str:
    """
    Generate a natural language response from the structured data.
    
    Args:
        response_data: The structured response data
        
    Returns:
        A natural language response
    """
    query_type = response_data["query_type"]
    results = response_data["results"]
    
    if not results:
        return "I couldn't find any information matching your query."
    
    # Deduplicate results to avoid repetition
    unique_results = []
    seen_invoice_numbers = set()
    
    for result in results:
        invoice_number = result.get("invoice_number", "")
        if invoice_number not in seen_invoice_numbers:
            seen_invoice_numbers.add(invoice_number)
            unique_results.append(result)
    
    # Generate response based on query type
    if query_type == "invoice_number":
        if len(unique_results) == 1:
            return f"The invoice number is {unique_results[0]['invoice_number']}."
        else:
            invoice_numbers = ", ".join([r["invoice_number"] for r in unique_results])
            return f"I found the following invoice numbers: {invoice_numbers}."
    
    elif query_type == "price":
        if len(unique_results) == 1:
            result = unique_results[0]
            return f"Invoice {result['invoice_number']} has a total amount of {result.get('total_amount', 'unknown')}."
        else:
            price_info = []
            for result in unique_results:
                price_info.append(f"Invoice {result['invoice_number']}: {result.get('total_amount', 'unknown')}")
            return "Here are the invoice amounts:\n" + "\n".join(price_info)
    
    elif query_type == "date":
        if len(unique_results) == 1:
            result = unique_results[0]
            return f"Invoice {result['invoice_number']} was issued on {result.get('date', 'unknown date')}."
        else:
            date_info = []
            for result in unique_results:
                date_info.append(f"Invoice {result['invoice_number']}: {result.get('date', 'unknown date')}")
            return "Here are the invoice dates:\n" + "\n".join(date_info)
    
    elif query_type == "product_details":
        if len(unique_results) == 1:
            result = unique_results[0]
            line_items = result.get("line_items", [])
            if not line_items:
                return f"Invoice {result['invoice_number']} doesn't have any line items."
            
            items_text = []
            for item in line_items:
                desc = item.get("description", "Unknown item")
                qty = item.get("quantity", "")
                price = item.get("unit_price", "")
                total = item.get("total", "")
                
                item_text = f"- {desc}"
                if qty and price:
                    item_text += f" ({qty} x {price})"
                if total:
                    item_text += f", Total: {total}"
                
                items_text.append(item_text)
            
            return f"Invoice {result['invoice_number']} contains the following items:\n" + "\n".join(items_text)
        else:
            return f"I found {len(unique_results)} invoices. Please specify which invoice you're interested in."
    
    else:  # general query
        if len(unique_results) == 1:
            result = unique_results[0]
            response = f"Invoice {result['invoice_number']}"
            
            if "date" in result and result["date"]:
                response += f" was issued on {result['date']}"
            
            if "total_amount" in result and result["total_amount"]:
                response += f" with a total amount of {result['total_amount']}"
            
            response += "."
            
            line_items = result.get("line_items", [])
            if line_items:
                response += f" It contains {len(line_items)} item(s)."
            
            return response
        else:
            return f"I found {len(unique_results)} invoices. Please specify which invoice you're interested in or ask for specific information."

@router.get("/document/{document_id}", response_model=KagDocumentResponse)
async def get_kag_document(document_id: str):
    """
    Retrieve a specific document from the knowledge graph.
    
    This endpoint:
    1. Accepts a document ID
    2. Retrieves the document and its related entities
    3. Returns the document details
    """
    try:
        # Get the document from KAG service
        document = kag_service.get_document(document_id)
        
        if "error" in document:
            raise HTTPException(
                status_code=404,
                detail=f"Document not found: {document['error']}"
            )
        
        # Transform the response to match KagDocumentResponse schema
        document_item = {
            "id": document.get("document_id", ""),
            "title": f"Invoice {document.get('invoice_number', '')}",
            "content": f"Date: {document.get('date', '')}, Amount: {document.get('total_amount', '')}",
            "metadata": {
                "invoice_number": document.get("invoice_number", ""),
                "date": document.get("date", ""),
                "total_amount": document.get("total_amount", ""),
                "s3_key": document.get("s3_key", "")
            }
        }
        
        # Transform line items to entities
        entities = []
        for idx, item in enumerate(document.get("line_items", [])):
            if item:  # Skip empty items
                entity = {
                    "id": f"item_{idx}",
                    "type": "LineItem",
                    "name": item.get("description", f"Item {idx}"),
                    "properties": item
                }
                entities.append(entity)
        
        return {
            "document": document_item,
            "entities": entities,
            "relationships": []  # Optional field
        }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving KAG document: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving document: {str(e)}"
        )

@router.post("/text-query", response_class=PlainTextResponse)
async def text_query_kag(request: KagQueryRequest):
    """
    Query the knowledge graph and return a natural language response.
    
    This endpoint:
    1. Accepts a natural language query
    2. Uses AI to analyze the query intent and extract only the relevant information
    3. Returns a natural language response that answers the query
    
    Examples:
    - "What is the invoice number?" → "The invoice number is 989B3CF6-0015."
    - "How much does it cost?" → "Invoice 989B3CF6-0015 has a total amount of $11.80 USD."
    - "When was this invoice issued?" → "Invoice 989B3CF6-0015 was issued on March 10, 2025."
    """
    # Force format_as_text to True
    request.format_as_text = True
    return await simplified_query_kag(request) 