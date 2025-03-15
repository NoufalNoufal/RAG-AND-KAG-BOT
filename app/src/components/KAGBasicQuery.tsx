import React, { useState } from 'react';
import { api, KAGConfig } from '../api';
import { loadKAGConfig } from '../utils/kagConfig';

interface KAGBasicQueryProps {
  kagConfig?: KAGConfig;
  assistanceMode?: 'rag' | 'kag';
}

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

const KAGBasicQuery: React.FC<KAGBasicQueryProps> = ({ 
  kagConfig = loadKAGConfig(),
  assistanceMode = 'kag'
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [structuredResult, setStructuredResult] = useState<QueryResponse | null>(null);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(null);
      setSuccess(null);
    }
  };

  // Handle file upload
  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccess(null);
    setUploadProgress(0);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const newProgress = prev + Math.random() * 10;
          return newProgress > 90 ? 90 : newProgress;
        });
      }, 500);

      // Use the appropriate upload function based on assistance mode
      let response;
      if (assistanceMode === 'kag') {
        response = await api.uploadKAGPDF(file, kagConfig);
      } else {
        response = await api.uploadRAGDocument(file);
      }

      clearInterval(progressInterval);
      setUploadProgress(100);
      
      setSuccess(`File uploaded successfully! ${response.document_id ? `Document ID: ${response.document_id}` : ''}`);
      setResult(response);
    } catch (err) {
      console.error('Error uploading file:', err);
      setError(`Failed to upload file. Please check your ${assistanceMode.toUpperCase()} configuration and try again.`);
    } finally {
      setIsUploading(false);
    }
  };

  // Handle basic query
  const handleQuery = async () => {
    if (!query.trim()) {
      setError('Please enter a query');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setResult(null);
    setStructuredResult(null);

    try {
      let response;
      if (assistanceMode === 'kag') {
        // Use the KAG simplified query endpoint
        response = await api.simplifiedQueryKAG({
          query: query,
          context: ''
        }, kagConfig);
        
        // Check if the response has a structured format
        if (response.results && 
            (typeof response.results === 'object' || Array.isArray(response.results))) {
          try {
            // If it's a string, try to parse it
            const parsedResults = typeof response.results === 'string' 
              ? JSON.parse(response.results) 
              : response.results;
            
            // Check if it matches our expected structure
            if (parsedResults.query && parsedResults.results) {
              setStructuredResult(parsedResults as QueryResponse);
            }
          } catch (e) {
            console.log('Response is not in the expected structured format');
          }
        }
      } else {
        // Use the RAG query endpoint
        response = await api.chat({
          query,
          chat_history: [],
          assistant_type: 'rag',
          kagConfig
        });
      }
      
      setSuccess('Query executed successfully!');
      setResult(response);
    } catch (err) {
      console.error(`Error querying ${assistanceMode.toUpperCase()}:`, err);
      setError(`Failed to query ${assistanceMode.toUpperCase()}. Please check your configuration and try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  // Format JSON for display
  const formatJSON = (json: any) => {
    return JSON.stringify(json, null, 2);
  };

  // Get sample query based on assistance mode
  const getSampleQuery = () => {
    if (assistanceMode === 'kag') {
      return "Find all invoices with total amount greater than 1000";
    } else {
      return "What information can you find about invoices?";
    }
  };

  // Render structured results for product details
  const renderProductDetails = (data: QueryResponse) => {
    if (!data.results || data.results.length === 0) {
      return <p className="text-gray-500">No results found</p>;
    }

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">
            {data.query_type === 'product_details' ? 'Product Details' : 'Query Results'}
          </h3>
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
            {data.results.length} results found
          </span>
        </div>

        <div className="grid gap-4">
          {data.results.map((invoice, index) => (
            <div key={index} className="border rounded-lg overflow-hidden bg-white shadow-sm">
              <div className="bg-gray-50 px-4 py-2 border-b">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">Invoice #{invoice.invoice_number}</h4>
                  {invoice.total_amount && (
                    <span className="font-medium text-green-700">{invoice.total_amount}</span>
                  )}
                </div>
                {invoice.date && (
                  <p className="text-sm text-gray-500">Date: {invoice.date}</p>
                )}
              </div>
              
              <div className="p-4">
                <h5 className="font-medium mb-2 text-sm text-gray-700">Line Items</h5>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {invoice.line_items.map((item, itemIndex) => (
                        <tr key={itemIndex}>
                          <td className="px-3 py-2 whitespace-nowrap text-sm">{item.description}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm">{item.quantity}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm">{item.unit_price}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm font-medium">{item.total}</td>
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

  return (
    <div className="space-y-8">
      {/* File Upload Section */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">
          Upload {assistanceMode === 'kag' ? 'PDF to Knowledge Graph' : 'Document for RAG'}
        </h2>
        <p className="text-gray-600 mb-4">
          {assistanceMode === 'kag' ? (
            <>Upload a PDF document to create a knowledge graph using the <code>{kagConfig.base_url || 'http://localhost:8000'}/api/kag/upload-pdf</code> endpoint.</>
          ) : (
            <>Upload a document for retrieval-augmented generation using the <code>{kagConfig.base_url || 'http://localhost:8000'}/api/documents/upload</code> endpoint.</>
          )}
        </p>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select {assistanceMode === 'kag' ? 'PDF Document' : 'Document'}
          </label>
          <input
            type="file"
            accept={assistanceMode === 'kag' ? ".pdf" : "*"}
            onChange={handleFileChange}
            disabled={isUploading}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100
              disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {file && (
            <p className="mt-1 text-sm text-gray-500">
              Selected file: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>
        
        <button
          onClick={handleUpload}
          disabled={!file || isUploading}
          className={`w-full py-2 px-4 rounded-md ${
            !file || isUploading
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isUploading ? 'Uploading...' : `Upload to ${assistanceMode.toUpperCase()}`}
        </button>
        
        {isUploading && (
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Uploading and processing... This may take a while for large documents.
            </p>
          </div>
        )}
      </div>

      {/* Basic Query Section */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">
          Query {assistanceMode === 'kag' ? 'Knowledge Graph' : 'Documents'}
        </h2>
        <p className="text-gray-600 mb-4">
          {assistanceMode === 'kag' ? (
            <>Query your knowledge graph using the <code>{kagConfig.base_url || 'http://localhost:8000'}/api/kag/simplified-query</code> endpoint.</>
          ) : (
            <>Query your documents using the <code>{kagConfig.base_url || 'http://localhost:8000'}/api/documents/query</code> endpoint.</>
          )}
        </p>
        
        <div className="mb-4">
          <label htmlFor="query" className="block text-sm font-medium text-gray-700 mb-2">
            Enter Query
          </label>
          <textarea
            id="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={getSampleQuery()}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-3">
          <button
            onClick={handleQuery}
            disabled={!query.trim() || isLoading}
            className={`py-2 px-4 rounded-md ${
              !query.trim() || isLoading
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isLoading ? 'Querying...' : 'Execute Query'}
          </button>
          
          <button
            onClick={() => setQuery(getSampleQuery())}
            className="py-2 px-4 rounded-md bg-blue-100 hover:bg-blue-200 text-blue-700"
          >
            {assistanceMode === 'kag' ? 'Sample: Invoices > $1000' : 'Sample: Invoice Info'}
          </button>
          
          <button
            onClick={() => setQuery("product name")}
            className="py-2 px-4 rounded-md bg-purple-100 hover:bg-purple-200 text-purple-700"
          >
            Sample: Product Details
          </button>
        </div>
        
        <div className="mt-4 text-sm text-gray-500">
          <p className="font-medium">Example queries:</p>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            {assistanceMode === 'kag' ? (
              <>
                <li>Find all invoices with total amount greater than 1000</li>
                <li>Show me all customers who have unpaid invoices</li>
                <li>What products were purchased by Company ABC?</li>
                <li>List all invoices from the last quarter</li>
                <li>Find contracts that expire within 30 days</li>
                <li>product name (to get product details)</li>
              </>
            ) : (
              <>
                <li>What information can you find about invoices?</li>
                <li>Summarize the key points about customer payments</li>
                <li>What are the payment terms mentioned in the documents?</li>
                <li>Find information about late payments</li>
                <li>What's the process for handling invoice disputes?</li>
              </>
            )}
          </ul>
        </div>
      </div>

      {/* Status and Results */}
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-md">
          <h3 className="font-medium">Error</h3>
          <p>{error}</p>
        </div>
      )}
      
      {success && (
        <div className="p-4 bg-green-50 text-green-700 rounded-md">
          <h3 className="font-medium">Success</h3>
          <p>{success}</p>
        </div>
      )}
      
      {/* Structured Results Display */}
      {structuredResult && (
        <div className="bg-white shadow-md rounded-lg p-6">
          {renderProductDetails(structuredResult)}
        </div>
      )}
      
      {/* Raw Results Display (only show if no structured display) */}
      {result && !structuredResult && (
        <div className="bg-white shadow-md rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-3">Result</h3>
          <pre className="bg-gray-50 p-4 rounded-md overflow-x-auto text-sm">
            {formatJSON(result)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default KAGBasicQuery; 