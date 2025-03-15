import React, { useState, useEffect } from 'react';
import { KAGConfig } from '../api';
import { importPostmanEnvironment, loadKAGConfig, saveKAGConfig } from '../utils/kagConfig';

interface KAGConfigImporterProps {
  onConfigChange?: (config: KAGConfig) => void;
}

const KAGConfigImporter: React.FC<KAGConfigImporterProps> = ({ onConfigChange }) => {
  const [config, setConfig] = useState<KAGConfig>(loadKAGConfig());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    // Notify parent component when config changes
    if (onConfigChange) {
      onConfigChange(config);
    }
  }, [config, onConfigChange]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const newConfig = await importPostmanEnvironment(file);
      setConfig(newConfig);
      setSuccess('Postman environment imported successfully!');
      
      if (onConfigChange) {
        onConfigChange(newConfig);
      }
    } catch (err) {
      setError('Failed to import Postman environment. Please check the file format.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const updatedConfig = { ...config, [name]: value };
    setConfig(updatedConfig);
  };

  const saveConfiguration = () => {
    saveKAGConfig(config);
    setSuccess('Configuration saved successfully!');
    
    if (onConfigChange) {
      onConfigChange(config);
    }
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold mb-4">KAG Configuration</h2>
      
      {/* File Upload */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Import Postman Environment
        </label>
        <div className="flex items-center">
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
          {isLoading && <span className="ml-2">Loading...</span>}
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Upload a Postman environment file to configure KAG service.
        </p>
      </div>

      {/* Configuration Form */}
      <div className="space-y-4">
        <div>
          <label htmlFor="base_url" className="block text-sm font-medium text-gray-700">
            Base URL
          </label>
          <input
            type="text"
            id="base_url"
            name="base_url"
            value={config.base_url || ''}
            onChange={handleInputChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="http://localhost:8000"
          />
        </div>
        
        <div>
          <label htmlFor="neo4j_uri" className="block text-sm font-medium text-gray-700">
            Neo4j URI
          </label>
          <input
            type="text"
            id="neo4j_uri"
            name="neo4j_uri"
            value={config.neo4j_uri || ''}
            onChange={handleInputChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="bolt://localhost:7687"
          />
        </div>
        
        <div>
          <label htmlFor="neo4j_user" className="block text-sm font-medium text-gray-700">
            Neo4j User
          </label>
          <input
            type="text"
            id="neo4j_user"
            name="neo4j_user"
            value={config.neo4j_user || ''}
            onChange={handleInputChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="neo4j"
          />
        </div>
        
        <div>
          <label htmlFor="neo4j_password" className="block text-sm font-medium text-gray-700">
            Neo4j Password
          </label>
          <input
            type="password"
            id="neo4j_password"
            name="neo4j_password"
            value={config.neo4j_password || ''}
            onChange={handleInputChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="••••••••"
          />
        </div>
        
        <div>
          <label htmlFor="openai_api_key" className="block text-sm font-medium text-gray-700">
            OpenAI API Key
          </label>
          <input
            type="password"
            id="openai_api_key"
            name="openai_api_key"
            value={config.openai_api_key || ''}
            onChange={handleInputChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="sk-••••••••"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex space-x-3">
        <button
          type="button"
          onClick={saveConfiguration}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Save Configuration
        </button>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-md">
          {success}
        </div>
      )}
    </div>
  );
};

export default KAGConfigImporter; 