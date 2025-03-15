from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.api.routes import document_routes
from app.api.routes import kag_routes

from app.core.config import settings
from app.core.init import initialize_app

# Initialize the application
initialize_app()

app = FastAPI(
    title="Multi-Modal Knowledge System API",
    description="API for document processing and knowledge graph querying",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Include routers
app.include_router(document_routes.router, prefix="/api/documents", tags=["Documents"])
app.include_router(kag_routes.router, prefix="/api/kag", tags=["Knowledge Acquisition Graph"])
# Note: The KAG router includes a simplified query endpoint at /api/kag/simplified-query
# that returns only the relevant information based on the query type (e.g., price, invoice number, etc.)

@app.get("/", tags=["Health Check"])
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "message": "Multi-Modal Knowledge System API is running"}

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)