# Multi-Modal Knowledge System API

## Overview
The Multi-Modal Knowledge System API is an advanced information processing and retrieval system that integrates document processing with a Knowledge Acquisition Graph (KAG). It enables intelligent document analysis, knowledge extraction, and semantic search operations.

##code 
Ai backend python code : branch RAG_KAG_BE
Frontend code : branch RAG_FE

## Technical Stack
- **FastAPI**: High-performance web framework for API development
- **CORS Middleware**: Ensures secure cross-origin resource sharing
- **Uvicorn**: ASGI server for running the application
- **LangGraph**: Multi-agent framework for orchestrating workflows
- **Retrieval-Augmented Generation (RAG)**: Enhances response accuracy with retrieved context
- **OpenAI GPT-4**: Leverages advanced language models for response generation and contextual analysis

## Core Components

### 1. Document Processing System (`/api/documents`)
Handles:
- Document intake and parsing
- Information extraction
- Analysis and processing
- Storage and retrieval of document data

### 2. Knowledge Acquisition Graph (`/api/kag`)
Manages:
- Knowledge graph construction and maintenance
- Relationship mapping between data entities
- Simplified query interface (`/api/kag/simplified-query`)

## API Endpoints

### General Endpoints:
- **Health Check**: `GET /` – Monitors API operational status
- **Document Operations**: `POST /api/documents` – Upload and process documents
- **Knowledge Graph Queries**: `GET /api/kag/query` – Query the knowledge graph

## Configuration
- Configured via `app.core.config`
- Uses `app.core.init` for initialization
- CORS allows all origins, methods, and headers

## System Architecture

### Retrieval-Augmented Generation (RAG)
- Combines knowledge graph data with document content
- Provides contextualized responses
- Supports intelligent query processing

### Knowledge Graph Integration
- Maintains entity relationships
- Enables complex queries
- Supports semantic search

## Security & Performance
- FastAPI ensures high-performance async operations
- Modular architecture for scalability
- Type-safe API endpoints

## Use Cases
- Document management and analysis
- Knowledge extraction and organization
- Intelligent information retrieval
- Semantic search and data relationship mapping

## Multi-Agent Framework

### LangGraph Integration
- Orchestrates multi-agent workflows
- Supports dynamic response generation and decision-making

### Agent Components
#### 1. **Conversation Manager Agent**
- Maintains context and conversation flow
- Determines when to engage specialized agents

#### 2. **Document Analysis Agent**
- Processes and extracts key document information
- Integrates with the RAG system for enhanced responses

#### 3. **Query Specialist Agent**
- Constructs and refines knowledge graph queries
- Generates follow-up questions for comprehensive information retrieval

#### 4. **Response Generation Agent**
- Synthesizes information from multiple sources
- Maintains conversation continuity

### Agent Workflow
1. **Initial Processing**
   - Input analysis and agent selection
2. **Information Gathering**
   - Document retrieval and knowledge graph querying
3. **Response Synthesis**
   - Multi-source information integration and response generation
4. **Quality Assurance**
   - Validation, consistency checking, and context verification

## Advanced Features
### Follow-up Question Generation
- Identifies information gaps
- Formulates context-aware questions
- Enhances progressive information gathering

### Response Enhancement
- Uses RAG for enriched responses
- Supports multi-turn conversation management

## Getting Started
Run the API locally at `http://localhost:8000`

### API Documentation
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

This API provides a powerful and flexible platform for intelligent document processing and knowledge retrieval.

