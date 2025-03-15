import React, { useState, useEffect } from 'react';
import { api, KAGConfig } from '../api';
import { loadKAGConfig } from '../utils/kagConfig';
import KAGConfigImporter from './KAGConfigImporter';

interface LineItem {
  total: string;
  description: string;
  quantity: string;
  unit_price: string;
  node_id: string;
}

interface InvoiceResult {
  invoice_number: string;
  date: string | null;
  total_amount: string | null;
  line_items: LineItem[];
}

interface QueryResponse {
  query: string;
  query_type: string;
  results: InvoiceResult[];
  conversational_response?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  structuredData?: QueryResponse | null;
}

interface KAGChatExampleProps {
  assistanceMode?: 'rag' | 'kag';
  onSwitchMode?: () => void;
}

const KAGChatExample: React.FC<KAGChatExampleProps> = ({ 
  assistanceMode = 'kag',
  onSwitchMode
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [kagConfig, setKagConfig] = useState<KAGConfig>(loadKAGConfig());
  const [showConfig, setShowConfig] = useState(false);
  const [endpointInfo, setEndpointInfo] = useState<boolean>(false);
  const [serviceStatus, setServiceStatus] = useState<{kag: boolean, rag: boolean}>({kag: true, rag: true});
  const [checkingStatus, setCheckingStatus] = useState<boolean>(false);

  // Check service availability
  useEffect(() => {
    const checkServices = async () => {
      setCheckingStatus(true);
      
      try {
        // Check KAG availability
        try {
          const kagResponse = await fetch(`${kagConfig.base_url || 'http://localhost:8000'}/health/`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });
          
          setServiceStatus(prev => ({ ...prev, kag: kagResponse.ok }));
        } catch (err) {
          console.error('Error checking KAG service:', err);
          setServiceStatus(prev => ({ ...prev, kag: false }));
        }
        
        // Check RAG availability
        try {
          const ragResponse = await fetch(`${kagConfig.base_url || 'http://localhost:8000'}/health/`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });
          
          setServiceStatus(prev => ({ ...prev, rag: ragResponse.ok }));
        } catch (err) {
          console.error('Error checking RAG service:', err);
          setServiceStatus(prev => ({ ...prev, rag: false }));
        }
      } finally {
        setCheckingStatus(false);
      }
    };
    
    checkServices();
  }, [kagConfig]);

  // Clear messages when assistance mode changes
  useEffect(() => {
    setMessages([]);
    setSessionId(undefined);
  }, [assistanceMode]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    // Add user message to chat
    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Convert messages to the format expected by the API
      const chatHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      if (assistanceMode === 'kag' && serviceStatus.kag) {
        // Use the simplified KAG query endpoint
        const response = await api.simplifiedQueryKAG({
          query: input,
          context: sessionId || ''
        }, kagConfig);

        // Check for structured data
        let structuredData: QueryResponse | null = null;
        
        // Try to parse structured data from the response
        if (response.results) {
          try {
            // If results is already an object with query and results properties
            if (typeof response.results === 'object' && response.results.query && response.results.results) {
              structuredData = response.results as QueryResponse;
            } 
            // If results is a string that might be JSON
            else if (typeof response.results === 'string') {
              const parsedResults = JSON.parse(response.results);
              if (parsedResults.query && parsedResults.results) {
                structuredData = parsedResults as QueryResponse;
              }
            }
          } catch (e) {
            console.log('Response is not in the expected structured format');
          }
        }
        
        // Format the response
        let responseText = '';
        
        if (response.conversational_response) {
          responseText = response.conversational_response;
        } else if (structuredData) {
          responseText = `Found ${structuredData.results.length} results for your query about ${structuredData.query_type}.`;
        } else if (response.results) {
          if (Array.isArray(response.results) && response.results.length > 0) {
            responseText = JSON.stringify(response.results, null, 2);
          } else if (typeof response.results === 'string') {
            responseText = response.results;
          } else {
            responseText = JSON.stringify(response.results, null, 2);
          }
        } else {
          responseText = 'No results found for your query.';
        }
        
        // Add assistant response to chat
        const assistantMessage: Message = {
          role: 'assistant',
          content: responseText,
          structuredData: structuredData
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        
        // Save session ID for continuity
        if (response.session_id) {
          setSessionId(response.session_id);
        }
      } else if (assistanceMode === 'rag' || !serviceStatus.kag) {
        // If KAG is not available or RAG mode is selected, use RAG
        // Use the chat function with RAG mode
        const response = await api.chat({
          query: input,
          chat_history: chatHistory,
          session_id: sessionId,
          assistant_type: 'rag',
          kagConfig
        });

        // Add assistant response to chat
        const assistantMessage: Message = {
          role: 'assistant',
          content: response.response
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        
        // Save session ID for continuity
        if (response.session_id) {
          setSessionId(response.session_id);
        }
      }
    } catch (error) {
      console.error(`Error querying ${assistanceMode.toUpperCase()}:`, error);
      
      // Add error message to chat
      const errorMessage: Message = {
        role: 'assistant',
        content: `Sorry, I encountered an error while processing your request. Please check your ${assistanceMode.toUpperCase()} configuration and try again.`
      };
      
      setMessages(prev => [...prev, errorMessage]);
      
      // If KAG fails, try to switch to RAG automatically
      if (assistanceMode === 'kag' && serviceStatus.rag && onSwitchMode) {
        const fallbackMessage: Message = {
          role: 'assistant',
          content: 'Attempting to switch to RAG mode as KAG appears to be unavailable...'
        };
        setMessages(prev => [...prev, fallbackMessage]);
        
        // Update service status
        setServiceStatus(prev => ({ ...prev, kag: false }));
        
        // Call the switch mode function
        onSwitchMode();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigChange = (newConfig: KAGConfig) => {
    setKagConfig(newConfig);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setSessionId(undefined);
  };

  const toggleEndpointInfo = () => {
    setEndpointInfo(!endpointInfo);
  };

  // Render structured results for product details
  const renderProductDetails = (data: QueryResponse) => {
    if (!data.results || data.results.length === 0) {
      return <p className="text-gray-500">No results found</p>;
    }

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-md font-semibold">
            {data.query_type === 'product_details' ? 'Product Details' : 'Query Results'}
          </h3>
          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs">
            {data.results.length} results found
          </span>
        </div>

        <div className="grid gap-3">
          {data.results.map((invoice, index) => (
            <div key={index} className="border rounded-lg overflow-hidden bg-white shadow-sm">
              <div className="bg-gray-50 px-3 py-1.5 border-b">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-sm">Invoice #{invoice.invoice_number}</h4>
                  {invoice.total_amount && (
                    <span className="font-medium text-sm text-green-700">{invoice.total_amount}</span>
                  )}
                </div>
                {invoice.date && (
                  <p className="text-xs text-gray-500">Date: {invoice.date}</p>
                )}
              </div>
              
              <div className="p-3">
                <h5 className="font-medium mb-1.5 text-xs text-gray-700">Line Items</h5>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                        <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                        <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                        <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {invoice.line_items.map((item, itemIndex) => (
                        <tr key={itemIndex}>
                          <td className="px-2 py-1.5 whitespace-nowrap">{item.description}</td>
                          <td className="px-2 py-1.5 whitespace-nowrap">{item.quantity}</td>
                          <td className="px-2 py-1.5 whitespace-nowrap">{item.unit_price}</td>
                          <td className="px-2 py-1.5 whitespace-nowrap font-medium">{item.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Handle service availability changes
  useEffect(() => {
    // If current mode is not available but the other is, suggest switching
    if (assistanceMode === 'kag' && !serviceStatus.kag && serviceStatus.rag && messages.length > 0) {
      const serviceMessage: Message = {
        role: 'assistant',
        content: 'KAG service appears to be unavailable. Would you like to switch to RAG mode?'
      };
      setMessages(prev => [...prev, serviceMessage]);
    } else if (assistanceMode === 'rag' && !serviceStatus.rag && serviceStatus.kag && messages.length > 0) {
      const serviceMessage: Message = {
        role: 'assistant',
        content: 'RAG service appears to be unavailable. Would you like to switch to KAG mode?'
      };
      setMessages(prev => [...prev, serviceMessage]);
    }
  }, [serviceStatus, assistanceMode]);

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">{assistanceMode === 'kag' ? 'KAG' : 'RAG'} Assistant</h1>
        <div className="flex space-x-2">
          {checkingStatus ? (
            <div className="px-3 py-1 bg-gray-200 text-gray-700 rounded-md text-sm">
              Checking services...
            </div>
          ) : (
            <>
              <div className={`px-3 py-1 rounded-md text-sm ${
                assistanceMode === 'kag' 
                  ? serviceStatus.kag ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  : serviceStatus.rag ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
              }`}>
                {assistanceMode.toUpperCase()} {
                  (assistanceMode === 'kag' && serviceStatus.kag) || (assistanceMode === 'rag' && serviceStatus.rag)
                    ? 'Available' : 'Unavailable'
                }
              </div>
              
              {onSwitchMode && serviceStatus.kag && serviceStatus.rag && (
                <button
                  onClick={onSwitchMode}
                  className={`px-3 py-1 ${
                    assistanceMode === 'kag' 
                      ? 'bg-blue-100 hover:bg-blue-200 text-blue-700' 
                      : 'bg-green-100 hover:bg-green-200 text-green-700'
                  } rounded-md text-sm font-medium`}
                >
                  Switch to {assistanceMode === 'kag' ? 'RAG' : 'KAG'} Mode
                </button>
              )}
            </>
          )}
          <button
            onClick={toggleEndpointInfo}
            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-md text-sm"
          >
            {endpointInfo ? 'Hide Endpoint Info' : 'Show Endpoint Info'}
          </button>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-md text-sm"
          >
            {showConfig ? 'Hide Config' : 'Show Config'}
          </button>
          <button
            onClick={clearChat}
            className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-md text-sm"
          >
            Clear Chat
          </button>
        </div>
      </div>

      {endpointInfo && (
        <div className="mb-4 p-4 bg-blue-50 rounded-md">
          <h3 className="font-medium text-blue-800 mb-2">Endpoint Information</h3>
          {assistanceMode === 'kag' ? (
            <>
              <p className="text-sm text-blue-700 mb-1">
                <strong>KAG Query Endpoint:</strong> {kagConfig.base_url || 'http://localhost:8000'}/api/kag/simplified-query
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${serviceStatus.kag ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {serviceStatus.kag ? 'Available' : 'Unavailable'}
                </span>
              </p>
              <p className="text-sm text-blue-700">
                <strong>Example Query:</strong> "Find all invoices with total amount greater than 1000"
              </p>
              <p className="text-sm text-blue-700">
                <strong>Example Query:</strong> "product name" (to get product details)
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-blue-700 mb-1">
                <strong>RAG Query Endpoint:</strong> {kagConfig.base_url || 'http://localhost:8000'}/api/documents/query
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${serviceStatus.rag ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {serviceStatus.rag ? 'Available' : 'Unavailable'}
                </span>
              </p>
              <p className="text-sm text-blue-700">
                <strong>Example Query:</strong> "What information can you find about invoices?"
              </p>
            </>
          )}
        </div>
      )}

      {showConfig && (
        <div className="mb-4">
          <KAGConfigImporter onConfigChange={handleConfigChange} />
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto bg-white rounded-lg shadow p-4 mb-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>Start a conversation with the {assistanceMode === 'kag' ? 'KAG' : 'RAG'} Assistant</p>
            <p className="text-sm mt-2">
              Make sure you've configured your settings first!
            </p>
            <p className="text-sm mt-4">
              {assistanceMode === 'kag' 
                ? "Try asking: \"Find all invoices with total amount greater than 1000\" or \"product name\"" 
                : "Try asking: \"What information can you find about invoices?\""}
            </p>
            {!serviceStatus[assistanceMode] && (
              <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md">
                <p className="font-medium">Warning: {assistanceMode.toUpperCase()} service appears to be unavailable</p>
                {(assistanceMode === 'kag' && serviceStatus.rag) || (assistanceMode === 'rag' && serviceStatus.kag) ? (
                  <p className="mt-1">
                    Consider switching to {assistanceMode === 'kag' ? 'RAG' : 'KAG'} mode using the button above.
                  </p>
                ) : (
                  <p className="mt-1">
                    Please check your configuration and network connection.
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-100 ml-12'
                  : 'bg-gray-100 mr-12'
              }`}
            >
              <div className="font-semibold mb-1">
                {message.role === 'user' ? 'You' : `${assistanceMode.toUpperCase()} Assistant`}
              </div>
              <div className="whitespace-pre-wrap">{message.content}</div>
              
              {/* Render structured data if available */}
              {message.role === 'assistant' && message.structuredData && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  {renderProductDetails(message.structuredData)}
                </div>
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="p-3 rounded-lg bg-gray-100 mr-12">
            <div className="font-semibold mb-1">{assistanceMode.toUpperCase()} Assistant</div>
            <div className="animate-pulse">Thinking...</div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-white rounded-lg shadow p-3 flex items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Ask something about your ${assistanceMode === 'kag' ? 'knowledge graph' : 'documents'}...`}
          className="flex-1 border rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          rows={3}
          disabled={!serviceStatus[assistanceMode] && !serviceStatus[assistanceMode === 'kag' ? 'rag' : 'kag']}
        />
        <button
          onClick={handleSendMessage}
          disabled={isLoading || !input.trim() || (!serviceStatus[assistanceMode] && !serviceStatus[assistanceMode === 'kag' ? 'rag' : 'kag'])}
          className={`ml-2 px-4 py-2 rounded-md ${
            isLoading || !input.trim() || (!serviceStatus[assistanceMode] && !serviceStatus[assistanceMode === 'kag' ? 'rag' : 'kag'])
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default KAGChatExample; 