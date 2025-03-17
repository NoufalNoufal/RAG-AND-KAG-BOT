# RAG-AND-KAG-BOT
RAG and KAG integrated with neo4j implemented chatbot we can upload the data and then we can choose the methid and intractact 

## Installation and Setup Guide

### Prerequisites
- Python 3.12 installed
- Neo4j database (local or cloud instance)
- OpenAI API key (for LLM integration)


### Step 1: Clone the Repository
```bash
git clone https://github.com/yourusername/RAG-AND-KAG-BOT.git
cd RAG-AND-KAG-BOT
```

### Step 2: Set Up a Virtual Environment
```bash
# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On Windows
venv\Scripts\activate
# On macOS/Linux
source venv/bin/activate
```

### Step 3: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 4: Configure Environment Variables
Create a `.env` file in the root directory with the following variables:
```
# API Keys
OPENAI_API_KEY=your_openai_api_key


# Neo4j Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password

# Application Settings
DEBUG=True
```

### Step 5: Set Up Neo4j Database
1. [Download and install Neo4j](https://neo4j.com/download/) or use a cloud instance
2. Create a new database or use an existing one
3. Update the Neo4j connection details in your `.env` file

### Step 6: Run the Application
```bash
python run.py
```
The application will be available at `http://localhost:8000`

## Usage

### Uploading Documents
1. Navigate to the upload page
2. Select the document(s) you want to process
3. Choose the processing method (RAG or KAG)
4. Upload and wait for processing to complete

### Interacting with the Chatbot
1. Navigate to the chat interface
2. Type your query in the input field
3. The system will use either RAG or KAG (based on your selection) to generate a response

## Troubleshooting

### Common Issues
- **Connection Error with Neo4j**: Ensure Neo4j is running and credentials are correct
- **API Key Issues**: Verify your OpenAI keys are valid and have sufficient credits
- **Memory Errors**: For large documents, you may need to increase your system's available memory

### Logs
Check the application logs for detailed error information:
```
logs/app.log
```

## Additional Resources
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [LangChain Documentation](https://python.langchain.com/docs/get_started/introduction)
- [Neo4j Documentation](https://neo4j.com/docs/)
- [OpenAI API Documentation](https://platform.openai.com/docs/introduction)
