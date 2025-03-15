import os
import json
import boto3
import tempfile
import uuid
import re
import warnings
import logging
from typing import Dict, List, Union, Optional, Any
from dotenv import load_dotenv
from neo4j import GraphDatabase
import fitz  # PyMuPDF
from openai import OpenAI
import numpy as np

from app.core.config import settings

# Suppress warnings
warnings.filterwarnings('ignore')
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'  # Suppress TensorFlow logging

# Load environment variables
load_dotenv()

# AWS S3 Configuration
S3_BUCKET_NAME = os.getenv('S3_BUCKET_NAME')
AWS_REGION = os.getenv('AWS_REGION')
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')

# OpenAI Configuration
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', settings.OPENAI_API_KEY)
openai_client = OpenAI(api_key=OPENAI_API_KEY)

# Neo4j Configuration
NEO4J_URI = os.getenv('NEO4J_URI', settings.NEO4J_URI)
NEO4J_USER = os.getenv('NEO4J_USER', settings.NEO4J_USER)
NEO4J_PASSWORD = os.getenv('NEO4J_PASSWORD', settings.NEO4J_PASSWORD)

# Initialize S3 client if credentials are available
s3_client = None
if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY and AWS_REGION:
    s3_client = boto3.client(
        's3',
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        region_name=AWS_REGION
    )

# Initialize Neo4j driver
neo4j_driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

# Configure logging
logger = logging.getLogger(__name__)

class DynamicDocumentExtractor:
    def __init__(self):
        self.openai_client = openai_client
        
    def preprocess_document(self, input_data: Union[str, bytes], input_type: str) -> str:
        """
        Preprocess the document based on input type (text, pdf)
        Returns extracted text
        """
        if input_type == 'text':
            return input_data
        
        elif input_type == 'pdf':
            try:
                # Input data should be the local path to PDF file
                pdf_path = input_data
                text = ""
                with fitz.open(pdf_path) as doc:
                    for page in doc:
                        text += page.get_text()
                return text
            except Exception as e:
                logger.error(f"Error extracting text from PDF: {str(e)}")
                return ""
        else:
            return ""

    def generate_embeddings(self, text: str) -> List[float]:
        """Generate embeddings for text using OpenAI"""
        try:
            response = openai_client.embeddings.create(
                input=text,
                model="text-embedding-3-small"
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"Error generating embeddings: {str(e)}")
            return []

    def identify_document_type(self, text: str) -> Dict:
        """Use OpenAI to identify document type and key structure"""
        prompt = f"""
        Analyze the following document text and determine its type and structure.
        Identify what kind of document this is (e.g., purchase order, sales order, invoice, contract, etc.)
        and what primary entities and data points are contained within it.
        
        For each entity or data point, identify:
        1. The entity/data point name
        2. The type of information it contains
        3. Its relationships to other entities if applicable
        
        Document Text:
        {text[:4000]}  # Limit text length for API
        
        Provide your analysis in this JSON format:
        {{
            "document_type": "identified document type",
            "entities": [
                {{
                    "name": "entity name",
                    "type": "entity type",
                    "attributes": ["attribute1", "attribute2"],
                    "relationships": [
                        {{"related_to": "other entity name", "relationship_type": "type of relationship"}}
                    ]
                }}
            ],
            "primary_identifiers": ["key1", "key2"]
        }}
        """
        
        try:
            response = openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a document analysis assistant that identifies document types and structures. Return only valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"}
            )
            
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            logger.error(f"Error identifying document type: {str(e)}")
            return {"document_type": "unknown", "entities": [], "primary_identifiers": []}

    def extract_structured_information(self, text: str, document_schema: Dict) -> Dict:
        """Extract structured information based on document schema"""
        # Create a detailed prompt based on the document schema
        entities_description = "\n".join([
            f"- {entity['name']}: {entity['type']} with attributes {', '.join(entity['attributes'])}"
            for entity in document_schema.get('entities', [])
        ])
        
        prompt = f"""
        Given the following document text and schema, extract all relevant information according to the schema structure.
        
        Document Type: {document_schema.get('document_type', 'unknown')}
        
        Primary Identifiers: {', '.join(document_schema.get('primary_identifiers', []))}
        
        Entities to Extract:
        {entities_description}
        
        Document Text:
        {text[:6000]}  # Limit text length for API
        
        Extract all information matching the schema above and provide a complete JSON output with all identified entities,
        their attributes, and values. Use null for missing values. Convert all monetary values to numbers, dates to ISO format,
        and ensure consistent formatting. For lists of items, extract all items found in the document.
        """
        
        try:
            response = openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a document extraction assistant that extracts structured information from documents. Return only valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"}
            )
            
            extracted_data = json.loads(response.choices[0].message.content)
            # Add document_type from schema
            extracted_data['document_type'] = document_schema.get('document_type', 'unknown')
            return extracted_data
        except Exception as e:
            logger.error(f"Error extracting structured information: {str(e)}")
            return {"document_type": document_schema.get('document_type', 'unknown'), "error": str(e)}

    def normalize_value(self, value: Any) -> Any:
        """Normalize values for consistent storage in Neo4j"""
        if isinstance(value, str):
            # Try to convert string numbers to float
            if re.match(r'^\$?[\d,]+(\.\d+)?$', value.strip()):
                try:
                    return float(value.strip().replace('$', '').replace(',', ''))
                except:
                    pass
            # Try to normalize dates (basic implementation)
            if re.match(r'^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$', value.strip()):
                return value.strip()
        return value

    def create_dynamic_knowledge_graph(self, document_id: str, extracted_data: Dict, document_schema: Dict) -> None:
        """Create knowledge graph from dynamically extracted data using Neo4j"""
        with neo4j_driver.session() as session:
            # Create Document node
            session.run(
                """
                CREATE (d:Document {id: $document_id, type: $document_type})
                """,
                document_id=document_id,
                document_type=extracted_data.get('document_type', 'unknown')
            )
            
            # Process all entities based on dynamic schema
            for entity_schema in document_schema.get('entities', []):
                entity_name = entity_schema['name']
                entity_type = entity_schema['type']
                
                # Check if entity exists in extracted data
                if entity_name in extracted_data:
                    entity_data = extracted_data[entity_name]
                    
                    # Handle list of entities
                    if isinstance(entity_data, list):
                        for i, item in enumerate(entity_data):
                            self._create_entity_node(session, document_id, entity_type, item, f"{entity_name}_{i}")
                    else:
                        # Handle single entity
                        self._create_entity_node(session, document_id, entity_type, entity_data, entity_name)
            
            # Create relationships based on schema
            for entity_schema in document_schema.get('entities', []):
                for relationship in entity_schema.get('relationships', []):
                    source_entity = entity_schema['name']
                    target_entity = relationship['related_to']
                    relationship_type = relationship['relationship_type'].upper().replace(' ', '_')
                    
                    # Create relationship if both entities exist
                    if source_entity in extracted_data and target_entity in extracted_data:
                        source_data = extracted_data[source_entity]
                        target_data = extracted_data[target_entity]
                        
                        # Handle different combinations of single/list entities
                        if isinstance(source_data, list) and isinstance(target_data, list):
                            # Many-to-many relationship (simplistic approach - link all to all)
                            for i in range(len(source_data)):
                                for j in range(len(target_data)):
                                    self._create_relationship(
                                        session, document_id, f"{source_entity}_{i}", 
                                        f"{target_entity}_{j}", relationship_type
                                    )
                        elif isinstance(source_data, list):
                            # Many-to-one relationship
                            for i in range(len(source_data)):
                                self._create_relationship(
                                    session, document_id, f"{source_entity}_{i}", 
                                    target_entity, relationship_type
                                )
                        elif isinstance(target_data, list):
                            # One-to-many relationship
                            for j in range(len(target_data)):
                                self._create_relationship(
                                    session, document_id, source_entity, 
                                    f"{target_entity}_{j}", relationship_type
                                )
                        else:
                            # One-to-one relationship
                            self._create_relationship(
                                session, document_id, source_entity, 
                                target_entity, relationship_type
                            )

    def _create_entity_node(self, session, document_id: str, entity_type: str, entity_data: Dict, node_id: str) -> None:
        """Create a node for an entity with dynamic properties"""
        # Normalize entity data
        normalized_data = {k: self.normalize_value(v) for k, v in entity_data.items() if v is not None}
        normalized_data['node_id'] = node_id
        
        # Sanitize entity type for Neo4j label (remove special characters and spaces)
        sanitized_type = re.sub(r'[^a-zA-Z0-9_]', '_', entity_type)
        
        # Create node with sanitized label
        cypher = f"""
        MATCH (d:Document {{id: $document_id}})
        CREATE (e:{sanitized_type} $properties)
        CREATE (d)-[:CONTAINS]->(e)
        """
        session.run(cypher, document_id=document_id, properties=normalized_data)

    def _create_relationship(self, session, document_id: str, source_id: str, target_id: str, relationship_type: str) -> None:
        """Create relationship between entities"""
        cypher = f"""
        MATCH (d:Document {{id: $document_id}})
        MATCH (source {{node_id: $source_id}})<-[:CONTAINS]-(d)
        MATCH (target {{node_id: $target_id}})<-[:CONTAINS]-(d)
        CREATE (source)-[:{relationship_type}]->(target)
        """
        session.run(cypher, document_id=document_id, source_id=source_id, target_id=target_id)

    def semantic_search_graph(self, query: str, document_type: Optional[str] = None) -> List[Dict]:
        """Perform semantic search on the knowledge graph"""
        # First, ask OpenAI to interpret what entities and relationships to search for
        search_prompt = f"""
        Given this search query: "{query}"
        
        Identify:
        1. The main entity types being searched for
        2. Any specific attributes or conditions mentioned
        3. Any relationships that should be traversed
        
        Provide a response in JSON format:
        {{
            "entity_types": ["type1", "type2"],
            "attributes": [{{"entity": "entity_name", "attribute": "attribute_name", "condition": "condition", "value": "value"}}],
            "relationships": [{{"from": "entity_type1", "to": "entity_type2", "type": "relationship_type"}}]
        }}
        """
        
        try:
            response = openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a search query analyzer that converts natural language queries into structured search parameters. Return only valid JSON."},
                    {"role": "user", "content": search_prompt}
                ],
                response_format={"type": "json_object"}
            )
            
            search_params = json.loads(response.choices[0].message.content)
        except Exception as e:
            logger.error(f"Error analyzing search query: {str(e)}")
            search_params = {"entity_types": [], "attributes": [], "relationships": []}
        
        # Build Cypher query based on search parameters
        cypher_parts = ["MATCH (d:Document)"]
        
        if document_type:
            cypher_parts.append(f"WHERE d.type = '{document_type}'")
        
        # Add entity type matches
        for i, entity_type in enumerate(search_params.get('entity_types', [])):
            var_name = f"e{i}"
            cypher_parts.append(f"MATCH (d)-[:CONTAINS]->({var_name}:{entity_type})")
        
        # Add attribute conditions
        where_conditions = []
        for attr in search_params.get('attributes', []):
            entity_var = attr['entity']
            attribute_name = attr['attribute']
            condition = attr['condition']
            value = attr['value']
            
            if condition == "equals":
                where_conditions.append(f"{entity_var}.{attribute_name} = '{value}'")
            elif condition == "contains":
                where_conditions.append(f"{entity_var}.{attribute_name} CONTAINS '{value}'")
            elif condition == "greater_than":
                where_conditions.append(f"{entity_var}.{attribute_name} > {value}")
            elif condition == "less_than":
                where_conditions.append(f"{entity_var}.{attribute_name} < {value}")
        
        if where_conditions:
            cypher_parts.append("WHERE " + " AND ".join(where_conditions))
        
        # Add relationship traversals
        for rel in search_params.get('relationships', []):
            from_type = rel['from']
            to_type = rel['to']
            rel_type = rel['type'].upper().replace(' ', '_')
            
            cypher_parts.append(f"MATCH ({from_type})-[:{rel_type}]->({to_type})")
        
        # Return results
        return_vars = ["d.id as document_id", "d.type as document_type"]
        for i, entity_type in enumerate(search_params.get('entity_types', [])):
            var_name = f"e{i}"
            return_vars.append(f"{var_name} as {entity_type}")
        
        cypher_parts.append("RETURN " + ", ".join(return_vars))
        
        # Execute query
        cypher_query = " ".join(cypher_parts)
        
        with neo4j_driver.session() as session:
            result = session.run(cypher_query)
            search_results = [dict(record) for record in result]
            
        return search_results

    def process_document(self, input_data: Union[str, bytes], input_type: str) -> Dict:
        """
        Main function to process a document dynamically
        """
        try:
            # Step 1: Upload PDF to S3 if S3 is configured
            s3_key = None
            if input_type == 'pdf' and s3_client:
                file_name = f"documents/{str(uuid.uuid4())}.pdf"
                with open(input_data, 'rb') as pdf_file:
                    s3_client.upload_fileobj(pdf_file, S3_BUCKET_NAME, file_name)
                s3_key = file_name
            
            # Extract text from PDF
            text = self.preprocess_document(input_data, input_type)
            
            if not text:
                return {"error": "Failed to extract text from PDF"}
            
            # Step 2: Ask OpenAI to analyze document
            analysis_prompt = f"""
            Analyze this document and create a knowledge graph structure.
            
            Document Text: {text[:4000]}
            
            
            Create a knowledge graph structure that captures all important entities and their relationships.
            Focus on extracting invoice-specific information like invoice number, date, items, amounts, etc.
            
            Return ONLY the JSON response in this exact format:
            {{
                "document_node": {{
                    "type": "Invoice",
                    "properties": {{
                        "invoice_number": "extracted invoice number",
                        "date": "extracted date",
                        "total_amount": "extracted total",
                        
                    }}
                }},
                "entities": [
                    {{
                        "label": "LineItem",
                        "properties": {{
                            "description": "item description",
                            "quantity": "item quantity",
                            "unit_price": "price per unit",
                            "total": "line total"
                        }}
                    }}
                ],
                "relationships": [
                    {{
                        "from_node": 0,
                        "to_node": 1,
                        "type": "CONTAINS",
                        "properties": {{}}
                    }}
                ]
            }}
            """
            
            response = openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a document analysis assistant that creates knowledge graph structures from documents. Return only valid JSON."},
                    {"role": "user", "content": analysis_prompt}
                ],
                response_format={"type": "json_object"}
            )
            
            graph_structure = json.loads(response.choices[0].message.content)
            
            # Step 3: Create knowledge graph
            document_id = str(uuid.uuid4())
            with neo4j_driver.session() as session:
                # Create document node
                doc_props = graph_structure["document_node"]["properties"]
                doc_type = graph_structure["document_node"]["type"]
                
                session.run(
                    """
                    CREATE (d:Invoice $properties)
                    SET d.id = $document_id
                    """,
                    properties=doc_props,
                    document_id=document_id
                )
                
                # Create entity nodes
                for idx, entity in enumerate(graph_structure["entities"]):
                    sanitized_label = re.sub(r'[^a-zA-Z0-9_]', '_', entity["label"])
                    session.run(
                        f"""
                        MATCH (d:Invoice {{id: $document_id}})
                        CREATE (e:{sanitized_label} $properties)
                        CREATE (d)-[:CONTAINS]->(e)
                        SET e.node_id = $node_id
                        """,
                        document_id=document_id,
                        properties=entity["properties"],
                        node_id=f"node_{idx}"
                    )
                
                # Create relationships
                for rel in graph_structure.get("relationships", []):
                    from_id = f"node_{rel['from_node']}"
                    to_id = f"node_{rel['to_node']}"
                    rel_type = re.sub(r'[^a-zA-Z0-9_]', '_', rel["type"].upper())
                    
                    session.run(
                        f"""
                        MATCH (d:Invoice {{id: $document_id}})
                        MATCH (source {{node_id: $from_id}})<-[:CONTAINS]-(d)
                        MATCH (target {{node_id: $to_id}})<-[:CONTAINS]-(d)
                        CREATE (source)-[r:{rel_type}]->(target)
                        SET r = $properties
                        """,
                        document_id=document_id,
                        from_id=from_id,
                        to_id=to_id,
                        properties=rel.get("properties", {})
                    )
            
            return {
                "document_id": document_id,
                "s3_key": s3_key,
                "graph_structure": graph_structure
            }
            
        except Exception as e:
            logger.error(f"Error processing document: {str(e)}")
            return {"error": str(e)}

    def get_document(self, document_id: str) -> Dict:
        """Retrieve a specific document with all its entities and relationships"""
        with neo4j_driver.session() as session:
            # Get document with all its properties and related items
            result = session.run(
                """
                MATCH (d:Invoice {id: $document_id})
                OPTIONAL MATCH (d)-[:CONTAINS]->(item)
                RETURN d.id as document_id,
                       d.invoice_number as invoice_number,
                       d.date as date,
                       d.total_amount as total_amount,
                       d.s3_key as s3_key,
                       collect(properties(item)) as line_items
                """,
                document_id=document_id
            )
            
            record = result.single()
            if not record:
                return {"error": f"Document {document_id} not found"}
            
            return dict(record)

class DocumentExtractorAPI:
    def __init__(self):
        self.extractor = DynamicDocumentExtractor()
        
    def process_input(self, input_data: Union[str, bytes], input_type: str) -> Dict:
        """API endpoint to process document input"""
        return self.extractor.process_document(input_data, input_type)
        
    def search(self, query: str, document_type: Optional[str] = None) -> List[Dict]:
        """API endpoint to search for information"""
        cypher_query = """
        MATCH (i:Invoice)-[:CONTAINS]->(item)
        WHERE i.invoice_number IS NOT NULL
        RETURN i.id as document_id, 
               i.invoice_number as invoice_number,
               i.date as date,
               i.total_amount as total_amount,
               collect(properties(item)) as line_items
        """
        
        with neo4j_driver.session() as session:
            result = session.run(cypher_query)
            return [dict(record) for record in result]
        
    def get_document(self, document_id: str) -> Dict:
        """API endpoint to retrieve a specific document"""
        return self.extractor.get_document(document_id)
    
    def analyze_query_intent(self, query: str) -> Dict[str, Any]:
        """
        Use OpenAI to analyze the query intent and determine what information is being requested.
        
        Args:
            query: The natural language query
            
        Returns:
            A dictionary with query type and fields to include in the response
        """
        try:
            # Default intent if OpenAI analysis fails
            default_intent = {
                "type": "general",
                "fields": ["total_amount", "date", "line_items"]
            }
            
            # Simple rule-based fallback
            query_lower = query.lower()
            
            # Try to use OpenAI for more advanced intent analysis
            prompt = f"""
            Analyze the following query about invoice data and determine what information the user is requesting.
            
            Query: "{query}"
            
            Respond with a JSON object containing:
            1. "type": The type of query (price, invoice_number, date, product_details, general)
            2. "fields": An array of fields that should be included in the response
            
            Available fields are:
            - total_amount (for price queries)
            - date (for date queries)
            - line_items (for product details queries)
            
            Note: The invoice_number field is always included by default.
            
            Example response for "What is the total amount?":
            {{"type": "price", "fields": ["total_amount"]}}
            
            Example response for "When was this invoice issued?":
            {{"type": "date", "fields": ["date"]}}
            """
            
            try:
                response = openai_client.chat.completions.create(
                    model="gpt-3.5-turbo",  # Using a smaller model for faster response
                    messages=[
                        {"role": "system", "content": "You are a query intent analyzer that determines what information a user is requesting about invoices."},
                        {"role": "user", "content": prompt}
                    ],
                    response_format={"type": "json_object"},
                    max_tokens=150
                )
                
                intent = json.loads(response.choices[0].message.content)
                return intent
            except Exception as e:
                logger.warning(f"OpenAI query intent analysis failed: {str(e)}. Using rule-based fallback.")
                
                # Rule-based fallback
                if any(term in query_lower for term in ["price", "total", "amount", "cost", "how much"]):
                    return {"type": "price", "fields": ["total_amount"]}
                elif any(term in query_lower for term in ["invoice number", "invoice id", "invoice #"]):
                    return {"type": "invoice_number", "fields": []}
                elif any(term in query_lower for term in ["date", "when", "time", "issued"]):
                    return {"type": "date", "fields": ["date"]}
                elif any(term in query_lower for term in ["product", "item", "line item", "details", "what's included"]):
                    return {"type": "product_details", "fields": ["line_items"]}
                else:
                    return default_intent
                
        except Exception as e:
            logger.error(f"Error analyzing query intent: {str(e)}")
            return {"type": "general", "fields": ["total_amount", "date", "line_items"]}

# Create a singleton instance
kag_service = DocumentExtractorAPI() 