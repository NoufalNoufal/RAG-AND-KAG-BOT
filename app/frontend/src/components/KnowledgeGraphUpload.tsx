import React, { useState, useRef } from 'react';
import axios from 'axios';

const KnowledgeGraphUpload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    setError(null);
    setUploadResult(null);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    // Check if file is PDF
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported');
      return;
    }

    setUploading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('/api/knowledge-graph/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setUploadResult(response.data);
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setFile(null);
    } catch (err: any) {
      console.error('Error uploading file:', err);
      setError(err.response?.data?.detail || 'An error occurred while uploading the file');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="mb-4 text-2xl font-bold text-gray-800">Upload PDF to Knowledge Graph</h2>
      
      <div className="mb-6">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf"
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <button
              onClick={handleUpload}
              disabled={uploading || !file}
              className="ml-4 px-4 py-2 font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-blue-300"
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
          
          {file && (
            <div className="p-3 bg-blue-50 rounded-md">
              <p className="text-sm text-blue-700">
                Selected file: <span className="font-medium">{file.name}</span> ({(file.size / 1024).toFixed(2)} KB)
              </p>
            </div>
          )}
          
          {error && (
            <div className="p-3 text-red-700 bg-red-100 rounded-md">
              {error}
            </div>
          )}
        </div>
      </div>
      
      {uploadResult && (
        <div className="p-4 bg-gray-50 rounded-md">
          <h3 className="mb-2 text-lg font-semibold text-gray-800">Upload Result</h3>
          
          {uploadResult.warning && (
            <div className="p-3 mb-4 text-yellow-700 bg-yellow-100 rounded-md">
              <p className="font-medium">Warning:</p>
              <p>{uploadResult.warning}</p>
            </div>
          )}
          
          <div className="mb-4">
            <h4 className="mb-1 text-sm font-medium text-gray-600">Graph ID</h4>
            <p className="text-sm text-gray-600">{uploadResult.graph_id}</p>
          </div>
          
          <div className="mb-4">
            <h4 className="mb-1 text-sm font-medium text-gray-600">Name</h4>
            <p className="text-sm text-gray-600">{uploadResult.name}</p>
          </div>
          
          {uploadResult.description && (
            <div className="mb-4">
              <h4 className="mb-1 text-sm font-medium text-gray-600">Description</h4>
              <p className="text-sm text-gray-600">{uploadResult.description}</p>
            </div>
          )}
          
          <div className="mb-4">
            <h4 className="mb-1 text-sm font-medium text-gray-600">Entities Extracted</h4>
            <p className="text-sm text-gray-600">{uploadResult.nodes.length} entities</p>
          </div>
          
          <div className="mb-4">
            <h4 className="mb-1 text-sm font-medium text-gray-600">Relationships Extracted</h4>
            <p className="text-sm text-gray-600">{uploadResult.edges.length} relationships</p>
          </div>
          
          <div className="mb-4">
            <h4 className="mb-1 text-sm font-medium text-gray-600">Created At</h4>
            <p className="text-sm text-gray-600">{new Date(uploadResult.created_at).toLocaleString()}</p>
          </div>
          
          <div className="mt-4">
            <h4 className="mb-2 text-sm font-medium text-gray-600">Extracted Data</h4>
            <div className="max-h-60 overflow-y-auto">
              <pre className="p-3 text-sm bg-gray-100 rounded-md">
                {JSON.stringify({
                  nodes: uploadResult.nodes,
                  edges: uploadResult.edges
                }, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeGraphUpload; 