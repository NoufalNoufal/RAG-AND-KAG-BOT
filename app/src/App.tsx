import React, { useState, useRef, useEffect } from 'react';
import { Upload, Send, Bot, User, FileText, Book, Brain, HelpCircle, Database, Trash2, Settings, List, Search } from 'lucide-react';
import { api, BASE_URL } from './api';
import { Message, AssistantType, PDFDocument, Entity, KAGSimplifiedResponse, ChatResponse } from './types';

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [activeAssistant, setActiveAssistant] = useState<AssistantType>('rag');
  const [neo4jStatus, setNeo4jStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [showSettings, setShowSettings] = useState(false);
  const [kValue, setKValue] = useState(5);
  const [pdfs, setPdfs] = useState<PDFDocument[]>([]);
  const [showPdfList, setShowPdfList] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [kagQueryType, setKagQueryType] = useState<'standard' | 'simplified' | 'text'>('simplified');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const kagFileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [quickQueries, setQuickQueries] = useState<string[]>([
    "invoice number",
    "total price",
    "invoice date",
    "product details"
  ]);
  const [complexQueries, setComplexQueries] = useState<string[]>([
    "I need to know the total amount and date for invoice 989B3CF6-0015",
    "Find all invoices with total amount greater than $1000",
    "Show me products from supplier ABC Corp"
  ]);
  const [ragQuickQueries, setRagQuickQueries] = useState<string[]>([
    "What is this document about?",
    "Summarize the main points",
    "What are the key findings?",
    "Extract important dates"
  ]);

  useEffect(() => {
    checkNeo4jConnection();
    if (activeAssistant === 'rag') {
      fetchPDFs();
    }
  }, [activeAssistant]);

  const checkNeo4jConnection = async () => {
    try {
      const isAvailable = await api.checkServiceAvailability('kag');
      setNeo4jStatus(isAvailable ? 'connected' : 'error');
    } catch (error) {
      setNeo4jStatus('error');
    }
  };

  const fetchPDFs = async () => {
    try {
      const pdfList = await api.listPDFs();
      setPdfs(pdfList);
    } catch (error) {
      console.error('Error fetching PDFs:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadStatus('uploading');
    try {
      await api.uploadRAGDocument(file);
      setUploadStatus('success');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `${file.name} uploaded successfully! You can now ask questions about the document.`
      }]);
      fetchPDFs();
    } catch (error) {
      setUploadStatus('error');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Error uploading document. Please try again.'
      }]);
    }
  };

  const handleKagFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadStatus('uploading');
    try {
      const response = await api.uploadKAGPDF(file);
      setUploadStatus('success');
      
      // Store the document ID for future reference
      const documentId = response.document_id;
      
      // Create a more informative success message
      const successMessage = `${file.name} uploaded successfully! The knowledge graph has been updated.
      
Document ID: ${documentId}

You can now query this document using the KAG API. Try one of the quick queries above or ask a question about the document content.`;
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: successMessage
      }]);
      
      // Suggest some follow-up actions
      const followupQuestions = [
        `Tell me about document ${documentId}`,
        "What information is in this document?",
        "Show me the invoice details"
      ];
      
      // Add follow-up suggestions
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage.role === 'assistant') {
          return [
            ...prev.slice(0, -1),
            {
              ...lastMessage,
              followupQuestions
            }
          ];
        }
        return prev;
      });
      
      scrollToBottom();
    } catch (error) {
      setUploadStatus('error');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error uploading file: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`
      }]);
    }
  };

  const clearVectorDB = async () => {
    try {
      await api.clearVectorDB();
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Vector database has been cleared successfully.'
      }]);
      setUploadStatus('idle');
      fetchPDFs();
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Error clearing vector database. Please try again.'
      }]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      let response;
      
      if (activeAssistant === 'rag') {
        // Use the queryDocuments function directly for RAG
        const ragResponse = await api.queryDocuments(input, kValue);
        
        // Handle different response formats
        if (ragResponse && typeof ragResponse === 'object') {
          if (ragResponse.conversational_response) {
            // Prefer the conversational response if available
            response = {
              response: ragResponse.conversational_response,
              session_id: ragResponse.session_id,
              followup_questions: ragResponse.followup_questions
            };
          } else if (ragResponse.response) {
            // Standard response format
            response = {
              response: ragResponse.response,
              session_id: ragResponse.session_id,
              followup_questions: ragResponse.followup_questions
            };
          } else if (ragResponse.results && Array.isArray(ragResponse.results)) {
            // Results array format - only use this if no conversational response is available
            const formattedResults = ragResponse.results.map((result: { 
              content: string; 
              metadata?: { 
                source?: string; 
                page?: number; 
              }; 
              score?: number;
            }) => {
              return `Content: ${result.content}\nSource: ${result.metadata?.source || 'Unknown'}\n${
                result.metadata?.page ? `Page: ${result.metadata.page}\n` : ''
              }${result.score ? `Relevance: ${(result.score * 100).toFixed(1)}%\n` : ''}`;
            }).join('\n\n');
            
            response = {
              response: formattedResults || 'No relevant content found in the documents.',
              session_id: ragResponse.session_id,
              followup_questions: ragResponse.followup_questions
            };
          } else {
            // Unknown format
            response = {
              response: 'Received response from the assistant, but in an unexpected format.',
              session_id: ragResponse.session_id
            };
          }
        } else {
          // Fallback for unexpected response
          response = {
            response: 'No proper response received from the assistant.',
            session_id: undefined
          };
        }
      } else if (activeAssistant === 'kag') {
        if (kagQueryType === 'standard') {
          const kagResponse = await api.queryKAG({
            query: input,
            document_type: null,
            limit: 10
          });
          
          response = {
            response: kagResponse.conversational_response || JSON.stringify(kagResponse.results, null, 2),
            session_id: kagResponse.session_id
          };
        } else if (kagQueryType === 'simplified') {
          const simplifiedResponse = await api.simplifiedQueryKAG({
            query: input,
            document_type: null,
            limit: 10
          });
          
          response = {
            response: simplifiedResponse.conversational_response || JSON.stringify(simplifiedResponse.results, null, 2),
            session_id: simplifiedResponse.session_id
          };
        } else if (kagQueryType === 'text') {
          const textResponse = await api.textQueryKAG({
            query: input,
            document_type: null,
            limit: 10
          });
          
          response = {
            response: textResponse,
            session_id: sessionId
          };
        }
      }

      if (response?.session_id && !sessionId) {
        setSessionId(response.session_id);
      }

      // Create a new message with the response
      const newMessage: Message = {
        role: 'assistant',
        content: response?.response || 'No response received from the assistant.'
      };

      // Add follow-up questions if available in the response
      if (activeAssistant === 'rag' && response && typeof response === 'object' && 'followup_questions' in response) {
        const followupQuestions = response.followup_questions as string[] | undefined;
        if (followupQuestions) {
          newMessage.followupQuestions = followupQuestions;
        }
      }

      setMessages(prev => [...prev, newMessage]);
    } catch (error) {
      console.error('Error processing request:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, there was an error processing your request. ${error instanceof Error ? error.message : 'Unknown error occurred.'}`
      }]);
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

  // Add a specific function for RAG queries
  const handleRagQuery = async (query: string) => {
    try {
      setIsLoading(true);
      
      // Add user message
      const userMessage: Message = { role: 'user', content: query };
      setMessages(prev => [...prev, userMessage]);
      
      // Make the direct query to the documents endpoint
      const response = await api.queryDocuments(query, kValue);
      
      let formattedResponse = '';
      let followupQuestions: string[] = [];
      
      // Prioritize the conversational response if available
      if (response.conversational_response) {
        formattedResponse = response.conversational_response;
      } else if (response.response) {
        formattedResponse = response.response;
      } else if (response.results && Array.isArray(response.results)) {
        // Only use raw results if no conversational response is available
        formattedResponse = response.results.map((result: { 
          content: string; 
          metadata?: { 
            source?: string; 
            page?: number; 
          }; 
          score?: number;
        }) => {
          return `Content: ${result.content}\nSource: ${result.metadata?.source || 'Unknown'}\n${
            result.metadata?.page ? `Page: ${result.metadata.page}\n` : ''
          }${result.score ? `Relevance: ${(result.score * 100).toFixed(1)}%\n` : ''}`;
        }).join('\n\n');
      } else {
        formattedResponse = 'No relevant content found in the documents.';
      }
      
      // Extract follow-up questions if available
      if (response.followup_questions && Array.isArray(response.followup_questions)) {
        followupQuestions = response.followup_questions;
      }
      
      // Add assistant message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: formattedResponse,
        followupQuestions: followupQuestions.length > 0 ? followupQuestions : undefined
      }]);
      
      // Update session ID if needed
      if (response.session_id && !sessionId) {
        setSessionId(response.session_id);
      }
    } catch (error) {
      console.error('Error with RAG query:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, there was an error processing your query. ${error instanceof Error ? error.message : 'Unknown error occurred.'}`
      }]);
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

  // Update the quick query handler to use the specific RAG query function
  const handleQuickQuery = async (query: string) => {
    setInput(query);
    if (activeAssistant === 'kag') {
      try {
        setIsLoading(true);
        
        const userMessage: Message = { role: 'user', content: query };
        setMessages(prev => [...prev, userMessage]);
        
        if (kagQueryType === 'simplified') {
          const response = await api.simplifiedQueryKAG({
            query,
            document_type: null,
            limit: 10
          });
          
          let formattedResponse = '';
          if (response.conversational_response) {
            formattedResponse = response.conversational_response;
          } else if (response.results && Array.isArray(response.results)) {
            formattedResponse = JSON.stringify(response.results, null, 2);
          } else {
            formattedResponse = 'No results found for your query.';
          }
          
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: formattedResponse
          }]);
          
          if (response.session_id && !sessionId) {
            setSessionId(response.session_id);
          }
        } else {
          await handleSubmit(new Event('submit') as unknown as React.FormEvent);
        }
      } catch (error) {
        console.error('Error with quick query:', error);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Sorry, there was an error processing your query. ${error instanceof Error ? error.message : 'Unknown error occurred.'}`
        }]);
      } finally {
        setIsLoading(false);
        scrollToBottom();
      }
    } else if (activeAssistant === 'rag') {
      // For RAG, use the dedicated RAG query function
      await handleRagQuery(query);
    } else {
      // Default fallback
      setInput(query);
    }
  };

  const handleFollowUpClick = (question: string) => {
    setInput(question);
  };

  const switchAssistant = (type: AssistantType) => {
    setActiveAssistant(type);
    setMessages([]);
    setSessionId(undefined);
  };

  const formatEntityInfo = (entity: Entity): string => {
    let info = `${entity.name} (${entity.type})`;
    
    if (entity.properties && Object.keys(entity.properties).length > 0) {
      info += '\nProperties:';
      for (const [key, value] of Object.entries(entity.properties)) {
        if (key !== 'name' && key !== 'type') {
          info += `\n- ${key}: ${value}`;
        }
      }
    }
    
    return info;
  };

  const renderKAGResponse = () => {
    // This function is no longer used as per the new code
    return null;
  };

  // Function to format JSON content for display
  const formatJsonContent = (content: string): React.ReactNode => {
    try {
      // Try to parse the content as JSON
      const jsonData = JSON.parse(content);
      
      // Special handling for RAG responses
      if (jsonData && typeof jsonData === 'object') {
        // If it has a conversational_response, prioritize that
        if (jsonData.conversational_response) {
          return (
            <div className="whitespace-pre-wrap">
              {jsonData.conversational_response}
              
              {/* Display follow-up questions if available */}
              {jsonData.followup_questions && jsonData.followup_questions.length > 0 && (
                <div className="mt-3">
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Suggested Follow-up Questions:</h4>
                  <div className="flex flex-col gap-1">
                    {jsonData.followup_questions.map((question: string, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => handleFollowUpClick(question)}
                        className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs hover:bg-indigo-100 text-left"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        }
      }
      
      // If it's an array of objects, render as a mini-table
      if (Array.isArray(jsonData) && jsonData.length > 0 && typeof jsonData[0] === 'object') {
        return (
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-xs border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  {Object.keys(jsonData[0]).map((key) => (
                    <th key={key} className="px-2 py-1 text-left font-medium text-gray-600 border border-gray-200">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jsonData.map((item, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    {Object.entries(item).map(([key, value]) => (
                      <td key={`${idx}-${key}`} className="px-2 py-1 border border-gray-200">
                        {typeof value === 'object' 
                          ? JSON.stringify(value) 
                          : String(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      
      // For other JSON data, format with syntax highlighting
      return (
        <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
          {JSON.stringify(jsonData, null, 2)}
        </pre>
      );
    } catch (e) {
      // If not valid JSON, return as is
      return <div className="whitespace-pre-wrap">{content}</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-indigo-600 p-4">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-white text-xl font-semibold">Document Assistant</h1>
              <div className="flex space-x-2">
                <button
                  onClick={() => switchAssistant('rag')}
                  className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors ${
                    activeAssistant === 'rag'
                      ? 'bg-white text-indigo-600'
                      : 'bg-indigo-500 text-white hover:bg-indigo-400'
                  }`}
                >
                  <Book className="w-4 h-4" />
                  <span>RAG Assistant</span>
                </button>
                <button
                  onClick={() => switchAssistant('kag')}
                  className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors ${
                    activeAssistant === 'kag'
                      ? 'bg-white text-indigo-600'
                      : 'bg-indigo-500 text-white hover:bg-indigo-400'
                  }`}
                >
                  <Brain className="w-4 h-4" />
                  <span>KAG Assistant</span>
                </button>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="bg-indigo-500 text-white p-2 rounded-lg hover:bg-indigo-400"
                  title="Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-indigo-100 text-sm">
              {activeAssistant === 'rag' 
                ? 'RAG Assistant helps you query and analyze documents using retrieval-augmented generation.'
                : 'KAG Assistant provides knowledge-augmented responses using structured information.'}
            </p>
            
            {showSettings && (
              <div className="mt-4 p-3 bg-indigo-700 rounded-lg">
                <h3 className="text-white text-sm font-medium mb-2">Settings</h3>
                {activeAssistant === 'rag' && (
                  <div className="flex items-center space-x-2">
                    <label htmlFor="k-value" className="text-indigo-100 text-sm">
                      Number of documents to retrieve (k):
                    </label>
                    <input
                      id="k-value"
                      type="number"
                      min="1"
                      max="10"
                      value={kValue}
                      onChange={(e) => setKValue(parseInt(e.target.value) || 5)}
                      className="w-16 p-1 text-sm rounded border-0 focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                )}
                {activeAssistant === 'kag' && (
                  <div className="flex items-center space-x-2">
                    <label htmlFor="kag-query-type" className="text-indigo-100 text-sm">
                      Query type:
                    </label>
                    <select
                      id="kag-query-type"
                      value={kagQueryType}
                      onChange={(e) => setKagQueryType(e.target.value as 'standard' | 'simplified' | 'text')}
                      className="p-1 text-sm rounded border-0 focus:ring-2 focus:ring-indigo-300"
                    >
                      <option value="standard">Standard</option>
                      <option value="simplified">Simplified</option>
                      <option value="text">Text</option>
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="h-[500px] overflow-y-auto p-4 space-y-4">
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === 'assistant' ? 'justify-start' : 'justify-end'} mb-4`}>
                <div className={`max-w-3/4 p-3 rounded-lg ${
                  message.role === 'assistant' ? 'bg-white border border-gray-200' : 'bg-indigo-500 text-white'
                }`}>
                  <div className="flex items-start mb-1">
                    {message.role === 'assistant' ? (
                      <Bot className="w-5 h-5 mr-2 text-indigo-500" />
                    ) : (
                      <User className="w-5 h-5 mr-2 text-white" />
                    )}
                    {message.role === 'assistant' && activeAssistant === 'kag' && kagQueryType !== 'text'
                      ? formatJsonContent(message.content)
                      : <div className="whitespace-pre-wrap">{message.content}</div>
                    }
                  </div>
                  
                  {showSources && message.role === 'assistant' && activeAssistant === 'rag' && (
                    <div className="mt-2 text-xs text-gray-500">
                      <button 
                        onClick={() => setShowSources(!showSources)}
                        className="text-indigo-600 hover:text-indigo-800 underline text-xs"
                      >
                        {showSources ? 'Hide Sources' : 'Show Sources'}
                      </button>
                    </div>
                  )}
                  
                  {message.role === 'assistant' && message.followupQuestions && message.followupQuestions.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-sm font-medium text-gray-700 mb-1">Follow-up Questions:</h4>
                      <div className="flex flex-wrap gap-2">
                        {message.followupQuestions.map((question, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleFollowUpClick(question)}
                            className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs hover:bg-indigo-100"
                          >
                            {question}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {activeAssistant === 'rag' && (
            <div className="p-4 border-t">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-medium text-gray-700">Document Management</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowPdfList(!showPdfList)}
                    className="text-xs flex items-center space-x-1 text-indigo-600 hover:text-indigo-800"
                  >
                    <List className="w-3 h-3" />
                    <span>{showPdfList ? 'Hide Documents' : 'Show Documents'}</span>
                  </button>
                  <button
                    onClick={clearVectorDB}
                    className="text-xs flex items-center space-x-1 text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear Documents</span>
                  </button>
                </div>
              </div>

              {showPdfList && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200 max-h-40 overflow-y-auto">
                  {pdfs.length > 0 ? (
                    <ul className="space-y-1">
                      {pdfs.map((pdf, index) => (
                        <li key={index} className="text-sm flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-indigo-500" />
                          <span className="flex-1 truncate">{pdf.filename}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(pdf.upload_date).toLocaleDateString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500 text-center">No documents uploaded yet</p>
                  )}
                </div>
              )}

              {pdfs.length > 0 && (
                <div className="mb-4">
                  <button
                    onClick={clearVectorDB}
                    className="w-full p-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 flex items-center justify-center space-x-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Clear Vector Database</span>
                  </button>
                  <p className="text-xs text-gray-500 text-center mt-1">
                    This will remove all documents from the vector database
                  </p>
                </div>
              )}

              {pdfs.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Quick Document Queries:</h4>
                  <div className="flex flex-wrap gap-2">
                    {ragQuickQueries.map((query, index) => (
                      <button
                        key={index}
                        onClick={() => handleQuickQuery(query)}
                        disabled={isLoading}
                        className="px-3 py-1.5 bg-white text-indigo-600 rounded-full text-xs border border-indigo-200 hover:bg-indigo-50 flex items-center space-x-1"
                      >
                        <Search className="w-3 h-3" />
                        <span>{query}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".pdf,.csv"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`w-full mb-4 flex items-center justify-center space-x-2 p-3 rounded-lg border-2 border-dashed ${
                  uploadStatus === 'uploading'
                    ? 'bg-gray-100 border-gray-300'
                    : uploadStatus === 'success'
                    ? 'bg-green-50 border-green-500'
                    : uploadStatus === 'error'
                    ? 'bg-red-50 border-red-500'
                    : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
                }`}
                disabled={uploadStatus === 'uploading'}
              >
                {uploadStatus === 'uploading' ? (
                  <>
                    <FileText className="animate-pulse" />
                    <span>Uploading...</span>
                  </>
                ) : uploadStatus === 'success' ? (
                  <>
                    <FileText className="text-green-500" />
                    <span className="text-green-700">Document uploaded successfully</span>
                  </>
                ) : (
                  <>
                    <Upload className="text-gray-600" />
                    <span>Upload PDF </span>
                  </>
                )}
              </button>
              <p className="text-xs text-gray-500 text-center">
                Upload documents to query using retrieval-augmented generation
              </p>
            </div>
          )}

          {activeAssistant === 'kag' && (
            <div className="p-4 border-t">
              
              <input
                type="file"
                ref={kagFileInputRef}
                onChange={handleKagFileUpload}
                accept=".pdf"
                className="hidden"
              />
              <button
                onClick={() => kagFileInputRef.current?.click()}
                className={`w-full mb-4 flex items-center justify-center space-x-2 p-3 rounded-lg border-2 border-dashed ${
                  uploadStatus === 'uploading'
                    ? 'bg-gray-100 border-gray-300'
                    : uploadStatus === 'success'
                    ? 'bg-green-50 border-green-500'
                    : uploadStatus === 'error'
                    ? 'bg-red-50 border-red-500'
                    : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
                }`}
                disabled={uploadStatus === 'uploading'}
              >
                {uploadStatus === 'uploading' ? (
                  <>
                    <FileText className="animate-pulse" />
                    <span>Uploading...</span>
                  </>
                ) : uploadStatus === 'success' ? (
                  <>
                    <FileText className="text-green-500" />
                    <span className="text-green-700">File uploaded successfully</span>
                  </>
                ) : (
                  <>
                    <Upload className="text-gray-600" />
                    <span>Upload PDF File</span>
                  </>
                )}
              </button>
              <p className="text-xs text-gray-500 text-center">
                Upload structured data to enhance the knowledge graph
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-4 border-t">
            <div className="flex space-x-4">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Ask a question ${activeAssistant === 'rag' ? 'about your document' : 'using KAG'}...`}
                className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Send className="w-4 h-4" />
                <span>Send</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;