import axios from 'axios';
import { 
  KnowledgeGraphResponse, 
  PDFDocument, 
  KAGDocument, 
  KAGQueryParams, 
  KAGStandardResponse, 
  KAGSimplifiedResponse, 
  KAGTextResponse,
  ChatResponse
} from './types';

// Base URL from environment variable or default
export const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// KAG Configuration Interface
export interface KAGConfig {
  base_url?: string;
  api_key?: string;
  username?: string;
  password?: string;
  neo4j_uri?: string;
  neo4j_user?: string;
  neo4j_password?: string;
  openai_api_key?: string;
  document_id?: string;
}

// Chat Response Interface
export interface KAGChatResponse {
  response: string;
  session_id?: string;
}

// KAG Query Response Interface
export interface KAGQueryResponse {
  results?: any;
  conversational_response?: string;
  session_id?: string;
  error?: string;
  query?: string;
  query_type?: string;
}

// Default KAG configuration
export const defaultKAGConfig: KAGConfig = {
  base_url: BASE_URL,
};

// API Service
const api = {
  // Health Check
  healthCheck: async (): Promise<boolean> => {
    try {
      const response = await axios.get(`${BASE_URL}/`);
      return response.status === 200;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  },

  // Check if a service is available
  checkServiceAvailability: async (serviceType: 'kag' | 'rag', config?: KAGConfig): Promise<boolean> => {
    try {
      const baseUrl = config?.base_url || BASE_URL;
      const endpoint = '/health/';
      
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      return response.ok;
    } catch (error) {
      console.error(`Error checking ${serviceType.toUpperCase()} service availability:`, error);
      return false;
    }
  },

  // Document Operations
  uploadRAGDocument: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await axios.post(`${BASE_URL}/api/documents/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  },

  queryDocuments: async (query: string, k: number = 5): Promise<ChatResponse> => {
    try {
      const response = await axios.post(`${BASE_URL}/api/documents/query`, {
        query,
        k
      });
      
      // Ensure we're properly handling the response format
      const data = response.data;
      
      // If the response doesn't have a conversational_response but has results,
      // we might want to generate a summary for display
      if (!data.conversational_response && data.results && Array.isArray(data.results) && data.results.length > 0) {
        console.log('Response has results but no conversational_response, consider adding a summary generation step');
      }
      
      return data;
    } catch (error) {
      console.error('Error querying documents:', error);
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(`Query failed: ${error.response.status} - ${error.response.data?.detail || error.message}`);
      }
      throw new Error('Failed to query documents. Please check your network connection.');
    }
  },

  conciseQuery: async (query: string, k: number = 5): Promise<ChatResponse> => {
    try {
      const response = await axios.post(`${BASE_URL}/api/documents/concise-query`, {
        query,
        k
      });
      
      return response.data;
    } catch (error) {
      console.error('Error with concise query:', error);
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(`Concise query failed: ${error.response.status} - ${error.response.data?.detail || error.message}`);
      }
      throw new Error('Failed to perform concise query. Please check your network connection.');
    }
  },

  getAllDocuments: async () => {
    const response = await axios.get(`${BASE_URL}/api/documents/`);
    return response.data;
  },

  listPDFs: async (): Promise<PDFDocument[]> => {
    const response = await axios.get(`${BASE_URL}/api/documents/list-pdfs`);
    return response.data;
  },

  getDocumentById: async (documentId: string) => {
    const response = await axios.get(`${BASE_URL}/api/documents/${documentId}`);
    return response.data;
  },

  clearVectorDB: async () => {
    const response = await axios.post(`${BASE_URL}/api/documents/clear-vector-db`);
    return response.data;
  },

  // KAG Operations
  uploadKAGPDF: async (file: File, config?: KAGConfig): Promise<{ document_id: string }> => {
    try {
      const baseUrl = config?.base_url || BASE_URL;
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post(`${baseUrl}/api/kag/upload-pdf`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(config?.api_key && { 'X-API-Key': config.api_key }),
        },
        auth: config?.username && config?.password
          ? { username: config.username, password: config.password }
          : undefined,
      });
      
      return response.data;
    } catch (error) {
      console.error('Error uploading PDF to KAG:', error);
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(`Upload failed: ${error.response.status} - ${error.response.data?.detail || error.message}`);
      }
      throw new Error('Failed to upload PDF. Please check your network connection and KAG configuration.');
    }
  },

  getKAGDocumentById: async (documentId: string, config?: KAGConfig): Promise<KAGDocument> => {
    try {
      const baseUrl = config?.base_url || BASE_URL;
      
      const response = await axios.get<KAGDocument>(`${baseUrl}/api/kag/document/${documentId}`, {
        headers: {
          ...(config?.api_key && { 'X-API-Key': config.api_key }),
        },
        auth: config?.username && config?.password
          ? { username: config.username, password: config.password }
          : undefined,
      });
      
      return response.data;
    } catch (error) {
      console.error('Error getting KAG document:', error);
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(`Get document failed: ${error.response.status} - ${error.response.data?.detail || error.message}`);
      }
      throw new Error('Failed to get document. Please check your network connection and KAG configuration.');
    }
  },

  // Standard Query
  queryKAG: async (params: KAGQueryParams, config?: KAGConfig): Promise<KAGStandardResponse> => {
    try {
      const baseUrl = config?.base_url || BASE_URL;
      
      const response = await axios.post<KAGStandardResponse>(`${baseUrl}/api/kag/query`, {
        query: params.query,
        document_type: params.document_type || null,
        limit: params.limit || 10,
      }, {
        headers: {
          'Content-Type': 'application/json',
          ...(config?.api_key && { 'X-API-Key': config.api_key }),
        },
        auth: config?.username && config?.password
          ? { username: config.username, password: config.password }
          : undefined,
      });
      
      return response.data;
    } catch (error) {
      console.error('Error querying KAG:', error);
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(`Query failed: ${error.response.status} - ${error.response.data?.detail || error.message}`);
      }
      throw new Error('Failed to query KAG. Please check your network connection and KAG configuration.');
    }
  },

  // Simplified Query
  simplifiedQueryKAG: async (params: KAGQueryParams, config?: KAGConfig): Promise<KAGSimplifiedResponse> => {
    try {
      const baseUrl = config?.base_url || BASE_URL;
      
      const response = await axios.post<KAGSimplifiedResponse>(`${baseUrl}/api/kag/simplified-query`, {
        query: params.query,
        document_type: params.document_type || null,
        limit: params.limit || 10,
        format_as_text: params.format_as_text || false,
      }, {
        headers: {
          'Content-Type': 'application/json',
          ...(config?.api_key && { 'X-API-Key': config.api_key }),
          ...(params.format_as_text && { 'Accept': 'text/plain' }),
        },
        auth: config?.username && config?.password
          ? { username: config.username, password: config.password }
          : undefined,
      });
      
      return response.data;
    } catch (error) {
      console.error('Error using simplified query for KAG:', error);
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(`Simplified query failed: ${error.response.status} - ${error.response.data?.detail || error.message}`);
      }
      throw new Error('Failed to query KAG with simplified endpoint. Please check your network connection and KAG configuration.');
    }
  },

  // Text Query
  textQueryKAG: async (params: KAGQueryParams, config?: KAGConfig): Promise<string> => {
    try {
      const baseUrl = config?.base_url || BASE_URL;
      
      const response = await axios.post(`${baseUrl}/api/kag/text-query`, {
        query: params.query,
        document_type: params.document_type || null,
        limit: params.limit || 10,
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/plain',
          ...(config?.api_key && { 'X-API-Key': config.api_key }),
        },
        auth: config?.username && config?.password
          ? { username: config.username, password: config.password }
          : undefined,
        responseType: 'text',
      });
      
      return response.data;
    } catch (error) {
      console.error('Error using text query for KAG:', error);
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(`Text query failed: ${error.response.status} - ${error.response.data?.detail || error.message}`);
      }
      throw new Error('Failed to query KAG with text endpoint. Please check your network connection and KAG configuration.');
    }
  },

  // Chat with the assistant (supports both RAG and KAG)
  chat: async (params: {
    query: string;
    chat_history?: Array<{ role: string; content: string }>;
    session_id?: string;
    assistant_type?: 'rag' | 'kag';
    k?: number;
    kagConfig?: KAGConfig;
  }): Promise<KAGChatResponse> => {
    try {
      const baseUrl = params.kagConfig?.base_url || BASE_URL;
      let endpoint = '';
      let requestBody: any = {};
      
      // Determine which endpoint to use based on assistant_type
      if (params.assistant_type === 'rag') {
        endpoint = '/api/documents/query';
        requestBody = {
          query: params.query,
          chat_history: params.chat_history || [],
          session_id: params.session_id,
          k: params.k || 3,
        };
      } else if (params.assistant_type === 'kag') {
        // Try KAG endpoint first
        try {
          // Check if KAG is available
          const isKagAvailable = await api.checkServiceAvailability('kag', params.kagConfig);
          
          if (isKagAvailable) {
            // Use the simplified KAG query endpoint
            const kagResponse = await api.simplifiedQueryKAG({
              query: params.query,
              document_type: null,
              limit: 10,
            }, params.kagConfig);
            
            // Format the response
            let responseText = '';
            
            if (kagResponse.conversational_response) {
              responseText = kagResponse.conversational_response;
            } else if (kagResponse.results) {
              if (Array.isArray(kagResponse.results) && kagResponse.results.length > 0) {
                responseText = JSON.stringify(kagResponse.results, null, 2);
              } else if (typeof kagResponse.results === 'string') {
                responseText = kagResponse.results;
              } else {
                responseText = JSON.stringify(kagResponse.results, null, 2);
              }
            } else {
              responseText = 'No results found for your query.';
            }
            
            return {
              response: responseText,
              session_id: kagResponse.session_id,
            };
          } else {
            // KAG is not available, fall back to RAG
            console.log('KAG service is not available, falling back to RAG');
            endpoint = '/api/documents/query';
            requestBody = {
              query: params.query,
              chat_history: params.chat_history || [],
              session_id: params.session_id,
              k: params.k || 3,
            };
          }
        } catch (error) {
          // Error with KAG, fall back to RAG
          console.error('Error with KAG service, falling back to RAG:', error);
          endpoint = '/api/documents/query';
          requestBody = {
            query: params.query,
            chat_history: params.chat_history || [],
            session_id: params.session_id,
            k: params.k || 3,
          };
        }
      } else {
        // Default to simplified knowledge graph query if assistant_type is not specified
        endpoint = '/api/kag/simplified-query';
        requestBody = {
          query: params.query,
          document_type: null,
          limit: 10,
        };
      }
      
      // Make the request
      const response = await axios.post(`${baseUrl}${endpoint}`, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          ...(params.kagConfig?.api_key && { 'X-API-Key': params.kagConfig.api_key }),
        },
        auth: params.kagConfig?.username && params.kagConfig?.password
          ? { username: params.kagConfig.username, password: params.kagConfig.password }
          : undefined,
      });
      
      // Handle different response formats
      if (endpoint === '/api/kag/simplified-query' || endpoint === '/api/kag/query') {
        // KAG response format
        let responseText = '';
        
        if (response.data.conversational_response) {
          responseText = response.data.conversational_response;
        } else if (response.data.results) {
          if (Array.isArray(response.data.results) && response.data.results.length > 0) {
            responseText = JSON.stringify(response.data.results, null, 2);
          } else if (typeof response.data.results === 'string') {
            responseText = response.data.results;
          } else {
            responseText = JSON.stringify(response.data.results, null, 2);
          }
        } else {
          responseText = 'No results found for your query.';
        }
        
        return {
          response: responseText,
          session_id: response.data.session_id,
        };
      } else {
        // RAG response format
        return {
          response: response.data.response || 'No response from the assistant.',
          session_id: response.data.session_id,
        };
      }
    } catch (error) {
      console.error('Error in chat function:', error);
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(`Chat failed: ${error.response.status} - ${error.response.data?.detail || error.message}`);
      }
      throw new Error('Failed to chat with the assistant. Please check your network connection and configuration.');
    }
  },

  getKnowledgeGraphSchema: async () => {
    return (await axios.get<KnowledgeGraphResponse>(`${BASE_URL}/api/knowledge-graph/schema`)).data;
  },

  getKnowledgeGraphData: async () => {
    return (await axios.get<KnowledgeGraphResponse>(`${BASE_URL}/api/knowledge-graph/all`)).data;
  },
};

export { api };