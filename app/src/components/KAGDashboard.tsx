import React, { useState, useEffect } from 'react';
import KAGConfigImporter from './KAGConfigImporter';
import KAGDocumentUploader from './KAGDocumentUploader';
import KAGChatExample from './KAGChatExample';
import KAGBasicQuery from './KAGBasicQuery';
import { loadKAGConfig } from '../utils/kagConfig';

const KAGDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'config' | 'upload' | 'chat' | 'basic-query'>('basic-query');
  const [assistanceMode, setAssistanceMode] = useState<'rag' | 'kag'>('kag');
  const [kagConfig, setKagConfig] = useState(loadKAGConfig());
  const [isKagAvailable, setIsKagAvailable] = useState<boolean>(true);
  const [isRagAvailable, setIsRagAvailable] = useState<boolean>(true);
  const [checkingConnectivity, setCheckingConnectivity] = useState<boolean>(false);

  // Check connectivity to KAG and RAG services
  useEffect(() => {
    const checkConnectivity = async () => {
      setCheckingConnectivity(true);
      
      try {
        // Check KAG availability
        try {
          const kagResponse = await fetch(`${kagConfig.base_url || 'http://localhost:8000'}/health/`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });
          
          setIsKagAvailable(kagResponse.ok);
          
          // If KAG is available and we're not in KAG mode, switch to it
          if (kagResponse.ok && assistanceMode !== 'kag') {
            setAssistanceMode('kag');
            console.log('Automatically switched to KAG mode as service is available');
          }
        } catch (err) {
          console.error('Error checking KAG service:', err);
          setIsKagAvailable(false);
          
          // If KAG is not available and we're in KAG mode, check if RAG is available
          if (assistanceMode === 'kag') {
            // We'll check RAG availability below and switch if needed
          }
        }
        
        // Check RAG availability
        try {
          const ragResponse = await fetch(`${kagConfig.base_url || 'http://localhost:8000'}/health/`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });
          
          setIsRagAvailable(ragResponse.ok);
          
          // If RAG is available and KAG is not available and we're in KAG mode, switch to RAG
          if (ragResponse.ok && !isKagAvailable && assistanceMode === 'kag') {
            setAssistanceMode('rag');
            console.log('Automatically switched to RAG mode as KAG service is unavailable');
          }
        } catch (err) {
          console.error('Error checking RAG service:', err);
          setIsRagAvailable(false);
        }
      } finally {
        setCheckingConnectivity(false);
      }
    };
    
    // Check connectivity when component mounts and when kagConfig changes
    checkConnectivity();
    
    // Set up interval to check connectivity periodically (every 30 seconds)
    const intervalId = setInterval(checkConnectivity, 30000);
    
    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, [kagConfig]);

  const handleConfigChange = (newConfig: any) => {
    setKagConfig(newConfig);
  };

  const toggleAssistanceMode = () => {
    setAssistanceMode(prev => prev === 'kag' ? 'rag' : 'kag');
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col space-y-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-2xl font-bold">Knowledge Acquisition Graph (KAG) Dashboard</h1>
            <div className="flex items-center space-x-3">
              {checkingConnectivity ? (
                <div className="px-3 py-1 bg-gray-200 text-gray-700 rounded-md text-sm">
                  Checking services...
                </div>
              ) : (
                <>
                  <div className={`px-3 py-1 rounded-md text-sm ${isKagAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    KAG: {isKagAvailable ? 'Available' : 'Unavailable'}
                  </div>
                  <div className={`px-3 py-1 rounded-md text-sm ${isRagAvailable ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                    RAG: {isRagAvailable ? 'Available' : 'Unavailable'}
                  </div>
                  {isKagAvailable && isRagAvailable && (
                    <button
                      onClick={toggleAssistanceMode}
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
            </div>
          </div>
          
          <div className="p-3 bg-blue-50 rounded-md mb-4">
            <h2 className="text-lg font-medium text-blue-800 mb-2">KAG Assistance Endpoints</h2>
            <p className="text-sm text-blue-700 mb-1">
              <strong>Upload PDF Endpoint:</strong> {kagConfig.base_url || 'http://localhost:8000'}/api/kag/upload-pdf
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${isKagAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {isKagAvailable ? 'Available' : 'Unavailable'}
              </span>
            </p>
            <p className="text-sm text-blue-700">
              <strong>Query Knowledge Graph Endpoint:</strong> {kagConfig.base_url || 'http://localhost:8000'}/api/kag/simplified-query
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${isKagAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {isKagAvailable ? 'Available' : 'Unavailable'}
              </span>
            </p>
          </div>
          
          {!isKagAvailable && !isRagAvailable && (
            <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded-md">
              <h3 className="text-lg font-medium text-red-800 mb-2">Service Unavailable</h3>
              <p className="text-red-700">
                Both KAG and RAG services appear to be unavailable. Please check your configuration and network connection.
              </p>
            </div>
          )}
          
          {!isKagAvailable && assistanceMode === 'kag' && (
            <div className="p-4 mb-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <h3 className="text-lg font-medium text-yellow-800 mb-2">KAG Service Unavailable</h3>
              <p className="text-yellow-700">
                The KAG service appears to be unavailable, but you're currently in KAG mode.
                {isRagAvailable ? ' Consider switching to RAG mode using the button above.' : ' Both services appear to be unavailable.'}
              </p>
            </div>
          )}
          
          {!isRagAvailable && assistanceMode === 'rag' && (
            <div className="p-4 mb-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <h3 className="text-lg font-medium text-yellow-800 mb-2">RAG Service Unavailable</h3>
              <p className="text-yellow-700">
                The RAG service appears to be unavailable, but you're currently in RAG mode.
                {isKagAvailable ? ' Consider switching to KAG mode using the button above.' : ' Both services appear to be unavailable.'}
              </p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="border-b">
            <nav className="flex">
              <button
                className={`px-4 py-2 text-sm font-medium ${
                  activeTab === 'config'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('config')}
              >
                Configuration
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium ${
                  activeTab === 'upload'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('upload')}
                disabled={!isKagAvailable && assistanceMode === 'kag'}
              >
                Upload Document
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium ${
                  activeTab === 'basic-query'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('basic-query')}
                disabled={!isKagAvailable && assistanceMode === 'kag'}
              >
                Basic Query
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium ${
                  activeTab === 'chat'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('chat')}
              >
                Chat
              </button>
            </nav>
          </div>

          <div className="p-4">
            {activeTab === 'config' && (
              <KAGConfigImporter onConfigChange={handleConfigChange} />
            )}
            {activeTab === 'upload' && (
              <KAGDocumentUploader kagConfig={kagConfig} />
            )}
            {activeTab === 'basic-query' && (
              <KAGBasicQuery kagConfig={kagConfig} />
            )}
            {activeTab === 'chat' && (
              <KAGChatExample 
                assistanceMode={assistanceMode} 
                onSwitchMode={toggleAssistanceMode} 
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KAGDashboard; 