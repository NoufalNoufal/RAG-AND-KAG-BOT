import os
import json
import tempfile
import logging
from typing import List, Dict, Any, Optional, Tuple, TypedDict, Annotated
from datetime import datetime
import uuid

from langchain_community.document_loaders import PyPDFLoader, CSVLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain.chains import ConversationalRetrievalChain, LLMChain
from langchain.memory import ConversationBufferMemory
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain.schema import Document

# Import LangGraph components
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from typing import TypedDict, Annotated, Literal

from app.core.config import settings
from app.db.vector_store import vector_db
from app.models.document import DocumentModel

logger = logging.getLogger(__name__)

# Define state types for LangGraph
class AgentState(TypedDict):
    query: str
    content: str
    conversational_response: str
    followup_questions: List[str]
    results: List[Dict[str, Any]]

class DocumentService:
    """Service for document processing and querying."""
    
    def __init__(self):
        self.upload_dir = settings.UPLOAD_DIR
        self.text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        self.llm = ChatOpenAI(model="gpt-4", temperature=0)
        
        # In-memory document storage as fallback
        self.fallback_documents = []
        
        # Set up LangGraph agent
        self._setup_langgraph_agent()
        
        # Ensure upload directory exists
        os.makedirs(self.upload_dir, exist_ok=True)
        
        # Initialize vector store connection
        self._initialize_vector_store()
    
    def _initialize_vector_store(self):
        """Initialize the vector store connection."""
        try:
            # Attempt to connect to the vector store
            success = vector_db.connect()
            if not success:
                logger.warning("Failed to initialize vector store on startup, will retry on first use")
        except Exception as e:
            logger.error(f"Error initializing vector store: {str(e)}")
    
    def _setup_langgraph_agent(self):
        """Set up the LangGraph agent for document query processing with just two agents."""
        # Define the agent nodes
        
        # 1. Query Analysis and Response Generation Agent (Combined)
        response_prompt = ChatPromptTemplate.from_template("""
        You are a friendly, helpful assistant that analyzes queries and provides conversational responses to questions about documents.
        
        Document content: {content}
        User query: {query}
        
        First, analyze what specific information the user is looking for in the document.
        Then, provide a conversational response based on the document content.
        
        Instructions:
        1. Respond in a friendly, conversational tone like a helpful assistant would.
        2. Keep your response concise (1-3 sentences) but make it sound natural and helpful.
        3. If the document contains structured data like an invoice, extract the relevant information but present it conversationally.
        4. Use a warm, helpful tone - imagine you're having a friendly chat with the user.
        5. Don't just list facts - integrate them into a natural-sounding response.
        6. NEVER respond with "No relevant information found" - instead, describe what you can see in the document.
        7. If asked about "the document" or "this doc" in general, summarize what type of document it is and key details what are available details in that document.
        8. For invoices, always mention the invoice number, amount, due date, and parties involved.
        9. If the information requested is truly not in the document, say something like "I can see this document doesn't mention [requested info]. Would you like to know about [alternative info that is present]?"
        10. Provide a comprehensive summary of the document content related to the query, not just sample sentences.
        
        Conversational response:
        """)
        
        def generate_response(state: AgentState) -> AgentState:
            response_chain = response_prompt | self.llm | StrOutputParser()
            conversational_response = response_chain.invoke({
                "query": state["query"],
                "content": state["content"]
            })
            state["conversational_response"] = conversational_response
            return state
        
        # 2. Follow-up Questions Generation Agent
        followup_prompt = ChatPromptTemplate.from_template("""
        You are an expert at generating relevant follow-up questions based on document content.
        
        Document content: {content}
        Original query: {query}
        Your response: {conversational_response}
        
        Generate 3 follow-up questions that would be logical next questions for the user to ask.
        These questions should be directly related to the document content and your response.
        Make the questions specific and insightful, focusing on important details in the document.
        
        Return your answer as a JSON array of strings. Example:
        ["What is the payment method for this invoice?", "When was this invoice issued?", "Is there a discount available?"]
        """)
        
        def generate_followups(state: AgentState) -> AgentState:
            followup_chain = followup_prompt | self.llm | StrOutputParser()
            followup_result = followup_chain.invoke({
                "query": state["query"],
                "content": state["content"],
                "conversational_response": state["conversational_response"]
            })
            
            # Parse follow-up questions
            try:
                import json
                followup_questions = json.loads(followup_result)
            except:
                # Fallback if parsing fails
                followup_questions = [
                    "Can you tell me more about this document?",
                    "What are the key details I should know about this document?",
                    "Is there any other important information in this document?"
                ]
            
            state["followup_questions"] = followup_questions
            return state
        
        # Create the workflow
        workflow = StateGraph(AgentState)
        
        # Add nodes
        workflow.add_node("generate_response", generate_response)
        workflow.add_node("generate_followups", generate_followups)
        
        # Add edges
        workflow.add_edge("generate_response", "generate_followups")
        workflow.add_edge("generate_followups", END)
        
        # Set the entry point
        workflow.set_entry_point("generate_response")
        
        # Compile the workflow
        self.agent = workflow.compile()
    
    async def process_pdf(self, file_content: bytes, filename: str) -> Tuple[bool, str, Optional[DocumentModel]]:
        """
        Process a PDF file and add it to the vector store.
        
        Args:
            file_content: The binary content of the PDF file
            filename: The name of the PDF file
            
        Returns:
            Tuple of (success, message, document_model)
        """
        try:
            # Create a unique filename to avoid collisions
            unique_filename = f"{uuid.uuid4().hex}_{filename}"
            file_path = os.path.join(self.upload_dir, unique_filename)
            
            # Save the file
            with open(file_path, "wb") as f:
                f.write(file_content)
            
            logger.info(f"Saved PDF to {file_path}")
            
            # Process the PDF
            loader = PyPDFLoader(file_path)
            documents = loader.load()
            
            # Create metadata
            metadata = {
                "source": file_path,
                "filename": filename,
                "file_type": "pdf",
                "page_count": len(documents),
                "processed_at": datetime.now().isoformat()
            }
            
            # Create document model
            document_model = DocumentModel(
                file_path=file_path,
                content="\n\n".join([doc.page_content for doc in documents]),
                metadata=metadata
            )
            
            # Split documents for vector store
            split_docs = self.text_splitter.split_documents(documents)
            
            # Store in fallback in-memory storage
            self.fallback_documents.extend(split_docs)
            
            # Add to vector store with retry logic
            max_retries = 3
            success = False
            
            for attempt in range(max_retries):
                # Try to add documents to vector store
                success = vector_db.add_documents(split_docs)
                if success:
                    break
                
                if attempt < max_retries - 1:
                    logger.warning(f"Retrying vector store operation (attempt {attempt + 1}/{max_retries})")
                    # Wait a moment before retrying
                    import time
                    time.sleep(1)
            
            # Save document metadata to a JSON file
            metadata_path = os.path.join(
                self.upload_dir, 
                f"{os.path.splitext(unique_filename)[0]}_metadata.json"
            )
            with open(metadata_path, "w") as f:
                json.dump(document_model.to_dict(), f, indent=2)
            
            if not success:
                logger.warning("Failed to add documents to vector store after retries, but saved document metadata and in-memory fallback")
                return True, f"Successfully processed PDF: {filename} (using fallback storage)", document_model
            
            return True, f"Successfully processed PDF: {filename}", document_model
            
        except Exception as e:
            error_message = f"Error processing PDF: {str(e)}"
            logger.error(error_message)
            return False, error_message, None
    
    async def process_csv(self, file_content: bytes, filename: str) -> Tuple[bool, str, Optional[List[Dict[str, Any]]]]:
        """
        Process a CSV file and extract data.
        
        Args:
            file_content: The binary content of the CSV file
            filename: The name of the CSV file
            
        Returns:
            Tuple of (success, message, data)
        """
        try:
            # Create a unique filename to avoid collisions
            unique_filename = f"{uuid.uuid4().hex}_{filename}"
            file_path = os.path.join(self.upload_dir, unique_filename)
            
            # Save the file
            with open(file_path, "wb") as f:
                f.write(file_content)
            
            logger.info(f"Saved CSV to {file_path}")
            
            # Process the CSV
            import pandas as pd
            df = pd.read_csv(file_path)
            
            # Convert to list of dictionaries
            data = df.to_dict("records")
            
            return True, f"Successfully processed CSV: {filename}", data
            
        except Exception as e:
            error_message = f"Error processing CSV: {str(e)}"
            logger.error(error_message)
            return False, error_message, None
    
    async def query_documents(self, query: str, k: int = 5) -> Dict[str, Any]:
        """
        Query documents using the vector store and LangGraph agent system.
        
        Args:
            query: The query string
            k: Number of documents to return
            
        Returns:
            Dictionary with query results, conversational response, and follow-up suggestions
        """
        try:
            # Try to perform similarity search using vector store
            docs = []
            try:
                docs = vector_db.similarity_search(query, k=k)
            except Exception as e:
                logger.warning(f"Vector store search failed, using fallback: {str(e)}")
                
                # If vector store fails, use fallback in-memory documents
                if self.fallback_documents:
                    # Simple keyword matching as fallback
                    query_terms = query.lower().split()
                    scored_docs = []
                    
                    for doc in self.fallback_documents:
                        score = 0
                        content = doc.page_content.lower()
                        for term in query_terms:
                            if term in content:
                                score += 1
                        scored_docs.append((doc, score))
                    
                    # Sort by score and take top k
                    scored_docs.sort(key=lambda x: x[1], reverse=True)
                    docs = [doc for doc, _ in scored_docs[:k]]
                    
                    logger.info(f"Used fallback search with {len(docs)} results")
            
            # Format results
            results = []
            combined_content = ""
            
            for i, doc in enumerate(docs):
                # Extract source document info if available
                source = doc.metadata.get('source', 'Unknown source')
                page = doc.metadata.get('page', 'Unknown page')
                
                # Add to combined content for answer generation
                combined_content += doc.page_content + "\n\n"
                
                # Format the result
                result = {
                    "content": doc.page_content,
                    "metadata": {
                        "source": source,
                        "page": page,
                        "file_name": os.path.basename(source),
                        **{k: v for k, v in doc.metadata.items() if k not in ['source', 'page']}
                    },
                    "score": i  # We don't have actual scores, so use index as proxy
                }
                results.append(result)
            
            # If no results found, check if we have any documents at all
            if not results:
                # Get all documents from metadata files
                all_docs = await self.get_all_documents()
                if all_docs:
                    # Just return the first document as a fallback
                    first_doc = all_docs[0]
                    combined_content = first_doc.get("content", "No content available")
                    
                    results = [{
                        "content": combined_content,
                        "metadata": {
                            "source": first_doc.get("file_path", "Unknown"),
                            "file_name": os.path.basename(first_doc.get("file_path", "Unknown")),
                            **first_doc.get("metadata", {})
                        },
                        "score": 0
                    }]
            
            # Use LangGraph agent to process the query
            initial_state = {
                "query": query,
                "content": combined_content[:4000],  # Limit content length
                "conversational_response": "",
                "followup_questions": [],
                "results": results
            }
            
            # Run the agent
            final_state = self.agent.invoke(initial_state)
            
            # Return formatted response
            return {
                "query": query,
                "results": results,
                "conversational_response": final_state["conversational_response"],
                "followup_questions": final_state["followup_questions"]
            }
            
        except Exception as e:
            error_message = f"Error querying documents: {str(e)}"
            logger.error(error_message)
            return {
                "query": query,
                "error": error_message,
                "results": [],
                "conversational_response": "Sorry, I couldn't find the information you're looking for. Is there something else I can help with?",
                "followup_questions": [
                    "Can you try a different query?",
                    "Would you like to search for a more specific term?",
                    "Would you like to see a list of available documents instead?"
                ]
            }
    
    async def get_all_documents(self) -> List[Dict[str, Any]]:
        """
        Get all documents in the upload directory.
        
        Returns:
            List of document metadata
        """
        try:
            documents = []
            
            # Get all files in the upload directory
            for filename in os.listdir(self.upload_dir):
                if filename.endswith("_metadata.json"):
                    # Load document metadata
                    metadata_path = os.path.join(self.upload_dir, filename)
                    with open(metadata_path, "r") as f:
                        document_data = json.load(f)
                        documents.append(document_data)
            
            return documents
            
        except Exception as e:
            error_message = f"Error getting documents: {str(e)}"
            logger.error(error_message)
            return []
    
    async def get_document_by_id(self, document_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a document by its ID.
        
        Args:
            document_id: The document ID
            
        Returns:
            Document metadata or None if not found
        """
        try:
            # Get all documents
            documents = await self.get_all_documents()
            
            # Find the document with the matching ID
            for document in documents:
                if document.get("document_id") == document_id:
                    return document
            
            return None
            
        except Exception as e:
            error_message = f"Error getting document: {str(e)}"
            logger.error(error_message)
            return None

# Create a singleton instance
document_service = DocumentService() 