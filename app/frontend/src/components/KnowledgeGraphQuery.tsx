import React, { useState } from 'react';
import axios from 'axios';

interface FollowupQuestion {
  question: string;
  onClick: () => void;
}

const FollowupQuestionButton: React.FC<FollowupQuestion> = ({ question, onClick }) => (
  <button
    onClick={onClick}
    className="px-4 py-2 mt-2 mr-2 text-sm font-medium text-blue-600 bg-blue-100 rounded-md hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
  >
    {question}
  </button>
);

const KnowledgeGraphQuery: React.FC = () => {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQuerySubmit = async (queryText: string) => {
    setLoading(true);
    setError(null);
    
    try {
      // Use the KAG query endpoint
      const result = await axios.post('/api/knowledge-graph/kag-query', {
        query: queryText,
        context: null
      });
      
      setResponse(result.data);
      setQuery(''); // Clear the input field after submission
    } catch (err: any) {
      console.error('Error querying knowledge graph:', err);
      setError(err.response?.data?.detail || 'An error occurred while querying the knowledge graph');
    } finally {
      setLoading(false);
    }
  };

  const handleFollowupClick = (question: string) => {
    setQuery(question);
    handleQuerySubmit(question);
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="mb-4 text-2xl font-bold text-gray-800">Knowledge Graph Query</h2>
      
      <div className="mb-6">
        <div className="flex">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question about the knowledge graph..."
            className="flex-grow p-3 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => handleQuerySubmit(query)}
            disabled={loading || !query.trim()}
            className="px-4 py-2 font-medium text-white bg-blue-600 rounded-r-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-blue-300"
          >
            {loading ? 'Querying...' : 'Ask'}
          </button>
        </div>
        
        {error && (
          <div className="p-3 mt-3 text-red-700 bg-red-100 rounded-md">
            {error}
          </div>
        )}
      </div>
      
      {response && (
        <div className="p-4 bg-gray-50 rounded-md">
          <h3 className="mb-2 text-lg font-semibold text-gray-800">Response</h3>
          
          {/* Display conversational response or explanation */}
          <p className="mb-4 text-gray-700">
            {response.conversational_response || response.explanation || "No explanation provided"}
          </p>
          
          {/* Display analysis if available */}
          {response.analysis && (
            <div className="mb-4">
              <h4 className="mb-1 text-sm font-medium text-gray-600">Analysis</h4>
              <p className="p-3 text-sm bg-gray-100 rounded-md">
                {response.analysis}
              </p>
            </div>
          )}
          
          {/* Display Cypher query */}
          {response.cypher_query && (
            <div className="mb-4">
              <h4 className="mb-1 text-sm font-medium text-gray-600">Cypher Query</h4>
              <pre className="p-3 overflow-x-auto text-sm bg-gray-100 rounded-md">
                {response.cypher_query}
              </pre>
            </div>
          )}
          
          {/* Display results count */}
          {response.results && (
            <div className="mb-4">
              <h4 className="mb-1 text-sm font-medium text-gray-600">Results ({response.total_results || response.results.length})</h4>
              <div className="max-h-60 overflow-y-auto">
                <pre className="p-3 text-sm bg-gray-100 rounded-md">
                  {JSON.stringify(response.results, null, 2)}
                </pre>
              </div>
            </div>
          )}
          
          {/* Display token usage if available */}
          {response.token_counts && (
            <div className="mb-4">
              <h4 className="mb-1 text-sm font-medium text-gray-600">Token Usage</h4>
              <div className="grid grid-cols-3 gap-2 p-2 text-sm bg-gray-100 rounded-md">
                <div>Prompt: {response.token_counts.prompt_tokens}</div>
                <div>Completion: {response.token_counts.completion_tokens}</div>
                <div>Total: {response.token_counts.total_tokens}</div>
              </div>
            </div>
          )}
          
          {/* Display execution time if available */}
          {response.execution_time !== undefined && (
            <div className="mb-4">
              <h4 className="mb-1 text-sm font-medium text-gray-600">Execution Time</h4>
              <p className="text-sm text-gray-600">{response.execution_time.toFixed(2)} seconds</p>
            </div>
          )}
          
          {/* Display follow-up questions */}
          {response.followup_questions && response.followup_questions.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-gray-600">Follow-up Questions</h4>
              <div className="flex flex-wrap">
                {response.followup_questions.map((question: string, index: number) => (
                  <FollowupQuestionButton
                    key={index}
                    question={question}
                    onClick={() => handleFollowupClick(question)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default KnowledgeGraphQuery; 