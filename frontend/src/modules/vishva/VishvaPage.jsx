/**
 * Vishva Module Page
 * ==================
 * 
 * OWNER: Vishva
 * 
 * Menu Extraction & Category Classification System
 * - Extract menus from restaurant websites
 * - Train ML model for category classification
 * - Predict categories for new menu items
 */

import { useState, useEffect, useRef } from 'react';
import PingButton from '../../components/PingButton';
import { 
  trainModel, 
  predictCategories,
  predictFromFile,
  exportPredictions,
  getMenuData, 
  getModelStatus,
  stopExtraction 
} from '../../lib/api';

const MODULE_NAME = 'vishva';

function VishvaPage() {
  // State for extraction
  const [extractUrl, setExtractUrl] = useState('https://tilapiyacolombo.lk/menu/');
  const [extracting, setExtracting] = useState(false);
  const [extractResult, setExtractResult] = useState(null);
  const [agentThoughts, setAgentThoughts] = useState([]);
  const thoughtsEndRef = useRef(null);
  const eventSourceRef = useRef(null);  // Reference to EventSource for stopping
  
  // State for menu data
  const [menuData, setMenuData] = useState([]);
  const [loadingMenu, setLoadingMenu] = useState(false);
  
  // State for model
  const [modelStatus, setModelStatus] = useState(null);
  const [training, setTraining] = useState(false);
  const [trainResult, setTrainResult] = useState(null);
  
  // State for prediction
  const [predictionInput, setPredictionInput] = useState('');
  const [predicting, setPredicting] = useState(false);
  const [predictions, setPredictions] = useState([]);
  
  // State for file upload
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  
  // State for export
  const [exporting, setExporting] = useState(false);
  
  // State for errors
  const [error, setError] = useState(null);

  // Auto-scroll to bottom of thoughts
  useEffect(() => {
    if (thoughtsEndRef.current) {
      thoughtsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [agentThoughts]);

  // Load initial data
  useEffect(() => {
    loadMenuData();
    loadModelStatus();
  }, []);

  const loadMenuData = async () => {
    setLoadingMenu(true);
    try {
      const result = await getMenuData();
      if (result.success) {
        setMenuData(result.items || []);
      }
    } catch (err) {
      console.error('Failed to load menu data:', err);
    } finally {
      setLoadingMenu(false);
    }
  };

  const loadModelStatus = async () => {
    try {
      const status = await getModelStatus();
      setModelStatus(status);
    } catch (err) {
      console.error('Failed to load model status:', err);
    }
  };

  // Streaming extraction with agent thoughts
  const handleExtract = async () => {
    if (!extractUrl.trim()) {
      setError('Please enter a URL');
      return;
    }
    
    setExtracting(true);
    setError(null);
    setExtractResult(null);
    setAgentThoughts([]);
    
    try {
      const eventSource = new EventSource(`/api/v1/vishva/extract-stream?url=${encodeURIComponent(extractUrl)}`);
      eventSourceRef.current = eventSource;  // Store reference for stopping
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'thought' || data.type === 'status') {
            setAgentThoughts(prev => [...prev, {
              type: data.type,
              message: data.message,
              timestamp: new Date().toLocaleTimeString()
            }]);
          } else if (data.type === 'complete') {
            setExtractResult({
              success: data.success,
              message: data.message,
              item_count: data.item_count
            });
            setExtracting(false);
            eventSourceRef.current = null;
            eventSource.close();
            if (data.success) {
              loadMenuData();
            }
          } else if (data.type === 'stopped') {
            // Handle stopped by user
            setExtractResult({
              success: false,
              message: data.message || 'Extraction stopped by user'
            });
            setExtracting(false);
            eventSourceRef.current = null;
            eventSource.close();
          } else if (data.type === 'error') {
            setError(data.message);
            setExtracting(false);
            eventSourceRef.current = null;
            eventSource.close();
          }
        } catch (e) {
          console.error('Failed to parse SSE data:', e);
        }
      };
      
      eventSource.onerror = (err) => {
        console.error('SSE Error:', err);
        setError('Connection to server lost');
        setExtracting(false);
        eventSourceRef.current = null;
        eventSource.close();
      };
      
    } catch (err) {
      setError(err.message);
      setExtracting(false);
    }
  };

  // Stop the extraction agent
  const handleStopExtract = async () => {
    try {
      // Close the SSE connection first
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      
      // Call backend to stop the subprocess (kills the browser too)
      const result = await stopExtraction();
      
      setAgentThoughts(prev => [...prev, {
        type: 'status',
        message: 'Extraction stopped by user',
        timestamp: new Date().toLocaleTimeString()
      }]);
      
      // Clear the result and go back to ready state
      setExtractResult(null);
      setExtracting(false);
    } catch (err) {
      console.error('Failed to stop extraction:', err);
      // Still try to clean up client-side
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setExtracting(false);
      setExtractResult(null);
    }
  };

  const handleTrain = async () => {
    setTraining(true);
    setError(null);
    setTrainResult(null);
    
    try {
      const result = await trainModel();
      setTrainResult(result);
      if (result.success) {
        loadModelStatus(); // Reload model status
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setTraining(false);
    }
  };

  const handlePredict = async () => {
    if (!predictionInput.trim()) {
      setError('Please enter menu items to predict');
      return;
    }
    
    setPredicting(true);
    setError(null);
    
    try {
      // Parse input - each line is an item
      const lines = predictionInput.split('\n').filter(line => line.trim());
      const items = lines.map(line => {
        // Try to parse as "name - price" or just "name"
        const parts = line.split(' - ');
        return {
          name: parts[0].trim(),
          price: parts[1]?.trim() || ''
        };
      });
      
      const result = await predictCategories(items);
      if (result.success) {
        setPredictions(result.predictions || []);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setPredicting(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validTypes = ['text/csv', 'application/pdf', 'application/vnd.ms-excel'];
      const validExtensions = ['.csv', '.pdf'];
      const fileExt = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
      
      if (!validExtensions.includes(fileExt)) {
        setError('Please upload a CSV or PDF file');
        return;
      }
      setUploadedFile(file);
      setError(null);
    }
  };

  // Handle file upload and prediction
  const handleFilePredict = async () => {
    if (!uploadedFile) {
      setError('Please select a file first');
      return;
    }
    
    setUploading(true);
    setError(null);
    
    try {
      const result = await predictFromFile(uploadedFile);
      if (result.success) {
        setPredictions(result.predictions || []);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // Handle export
  const handleExport = async (format) => {
    if (predictions.length === 0) {
      setError('No predictions to export');
      return;
    }
    
    setExporting(true);
    setError(null);
    
    try {
      const result = await exportPredictions(predictions, format);
      
      if (format === 'json') {
        // Download JSON
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'predictions.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Download CSV or PDF blob
        const url = URL.createObjectURL(result);
        const a = document.createElement('a');
        a.href = url;
        a.download = `predictions.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-8">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold">
            V
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Menu Extraction & Classification</h1>
        </div>
        <p className="text-gray-600">
          Extract menu data from restaurant websites and classify items using ML
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">⚠️ Error</p>
          <p className="text-red-700 text-sm">{error}</p>
          <button 
            onClick={() => setError(null)} 
            className="text-red-600 text-sm underline mt-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column */}
        <div className="space-y-6">
          
          {/* Connection Status */}
          <PingButton moduleName={MODULE_NAME} />
          
          {/* Model Status Card */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">🤖 Model Status</h3>
            {modelStatus ? (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Status:</span>
                  <span className={modelStatus.model_exists ? 'text-green-600 font-medium' : 'text-yellow-600'}>
                    {modelStatus.model_exists ? '✓ Trained' : '○ Not trained'}
                  </span>
                </div>
                {modelStatus.model_exists && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Model:</span>
                      <span className="font-mono text-sm">{modelStatus.model_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Accuracy:</span>
                      <span className="font-medium">{(modelStatus.accuracy * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">F1 Score:</span>
                      <span className="font-medium">{modelStatus.f1_score?.toFixed(4)}</span>
                    </div>
                    {modelStatus.categories && (
                      <div className="mt-3">
                        <span className="text-gray-500 text-sm">Categories:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {modelStatus.categories.map((cat, i) => (
                            <span key={i} className="px-2 py-1 bg-gray-100 rounded text-xs">
                              {cat}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <p className="text-gray-500">Loading model status...</p>
            )}
          </div>

          {/* Extract Menu Card */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">🌐 Extract Menu from URL</h3>
            <div className="space-y-4">
              <input
                type="url"
                value={extractUrl}
                onChange={(e) => setExtractUrl(e.target.value)}
                placeholder="https://restaurant.com/menu"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                disabled={extracting}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleExtract}
                  disabled={extracting}
                  className="flex-1 btn-primary disabled:opacity-50"
                >
                  {extracting ? '⏳ Extracting...' : '🔍 Extract Menu'}
                </button>
                {extracting && (
                  <button
                    onClick={handleStopExtract}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
                  >
                    🛑 Stop
                  </button>
                )}
              </div>
              
              {extractResult && (
                <div className={`p-4 rounded-lg ${extractResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <p className={extractResult.success ? 'text-green-800' : 'text-red-800'}>
                    {extractResult.success ? '✓' : '✗'} {extractResult.message}
                  </p>
                  {extractResult.success && (
                    <p className="text-green-700 text-sm mt-1">
                      Extracted {extractResult.item_count} items
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Agent Thoughts Panel */}
          {(extracting || agentThoughts.length > 0) && (
            <div className="card">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">🧠 Agent Thoughts</h3>
                {!extracting && agentThoughts.length > 0 && (
                  <button 
                    onClick={() => setAgentThoughts([])}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Clear
                  </button>
                )}
              </div>
              
              <div className="bg-gray-900 rounded-lg p-4 max-h-64 overflow-y-auto font-mono text-sm">
                {agentThoughts.length === 0 ? (
                  <div className="flex items-center text-green-400">
                    <span className="animate-pulse mr-2">●</span>
                    <span>Connecting to agent...</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {agentThoughts.map((thought, i) => (
                      <div key={i} className={`
                        ${thought.type === 'thought' ? 'text-green-400' : 'text-blue-400'}
                      `}>
                        <span className="text-gray-500 text-xs">[{thought.timestamp}]</span>
                        {' '}
                        <span className={thought.type === 'status' ? 'font-semibold' : ''}>
                          {thought.message}
                        </span>
                      </div>
                    ))}
                    <div ref={thoughtsEndRef} />
                    {extracting && (
                      <div className="flex items-center text-yellow-400 mt-2">
                        <span className="animate-pulse mr-2">●</span>
                        <span>Agent is working...</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Train Model Card */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">🎯 Train Category Classifier</h3>
            <p className="text-gray-600 text-sm mb-4">
              Train the ML model using the extracted menu data. The system will test multiple models and select the best one.
            </p>
            <button
              onClick={handleTrain}
              disabled={training || menuData.length === 0}
              className="w-full btn-secondary disabled:opacity-50"
            >
              {training ? '⏳ Training... (please wait)' : '🚀 Train Model'}
            </button>
            {menuData.length === 0 && (
              <p className="text-yellow-600 text-sm mt-2">Extract menu data first before training</p>
            )}
            
            {trainResult && (
              <div className={`mt-4 p-4 rounded-lg ${trainResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <p className={trainResult.success ? 'text-green-800 font-medium' : 'text-red-800'}>
                  {trainResult.success ? '✓' : '✗'} {trainResult.message}
                </p>
                {trainResult.success && (
                  <div className="text-green-700 text-sm mt-2 space-y-1">
                    <p>Best Model: {trainResult.best_model}</p>
                    <p>Accuracy: {(trainResult.accuracy * 100).toFixed(1)}%</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          
          {/* Predict Categories Card */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">🔮 Predict Categories</h3>
            
            {/* File Upload Section - Primary */}
            <div className="mb-6 p-4 bg-green-50 border-2 border-dashed border-green-300 rounded-lg">
              <p className="text-green-800 font-medium mb-2">📁 Upload Product File (Recommended)</p>
              <p className="text-green-700 text-sm mb-3">
                Upload a CSV or PDF file with product names to classify them automatically.
              </p>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".csv,.pdf"
                className="hidden"
              />
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-white border border-green-400 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                >
                  📂 Choose File
                </button>
                {uploadedFile && (
                  <span className="text-green-800 text-sm font-medium">
                    ✓ {uploadedFile.name}
                  </span>
                )}
              </div>
              {uploadedFile && (
                <button
                  onClick={handleFilePredict}
                  disabled={uploading || !modelStatus?.model_exists}
                  className="w-full mt-3 btn-primary disabled:opacity-50"
                >
                  {uploading ? '⏳ Processing File...' : '🚀 Classify Products from File'}
                </button>
              )}
            </div>
            
            {/* Manual Input Section - Secondary */}
            <div className="border-t pt-4">
              <p className="text-gray-600 text-sm mb-2">
                Or enter product names manually (one per line). Format: <code className="bg-gray-100 px-1 rounded">Name - Price</code>
              </p>
              <textarea
                value={predictionInput}
                onChange={(e) => setPredictionInput(e.target.value)}
                placeholder="Cheese Burger - Rs. 1500&#10;Chicken Wings - Rs. 800&#10;Pepperoni Pizza - Rs. 2000"
                className="w-full h-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none text-sm"
              />
              <button
                onClick={handlePredict}
                disabled={predicting || !modelStatus?.model_exists}
                className="w-full mt-2 btn-secondary disabled:opacity-50"
              >
                {predicting ? '⏳ Predicting...' : '🔮 Predict from Text'}
              </button>
            </div>
            
            {!modelStatus?.model_exists && (
              <p className="text-yellow-600 text-sm mt-2">⚠️ Train the model first before predicting</p>
            )}
            
            {/* Prediction Results */}
            {predictions.length > 0 && (
              <div className="mt-6 border-t pt-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-medium text-gray-700">📊 Results ({predictions.length} items)</h4>
                  
                  {/* Export Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleExport('csv')}
                      disabled={exporting}
                      className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors disabled:opacity-50"
                    >
                      📥 CSV
                    </button>
                    <button
                      onClick={() => handleExport('pdf')}
                      disabled={exporting}
                      className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors disabled:opacity-50"
                    >
                      📥 PDF
                    </button>
                    <button
                      onClick={() => handleExport('json')}
                      disabled={exporting}
                      className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors disabled:opacity-50"
                    >
                      📥 JSON
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {predictions.map((pred, i) => (
                    <div key={i} className="p-3 bg-gray-50 rounded-lg border flex justify-between items-center">
                      <div>
                        <p className="font-medium text-gray-800">{pred.name}</p>
                        {pred.price && <p className="text-gray-500 text-sm">{pred.price}</p>}
                      </div>
                      <div className="text-right">
                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                          {pred.predicted_category}
                        </span>
                        <p className="text-gray-500 text-xs mt-1">
                          {(pred.confidence * 100).toFixed(1)}% confidence
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Clear Results */}
                <button
                  onClick={() => {
                    setPredictions([]);
                    setUploadedFile(null);
                    setPredictionInput('');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700"
                >
                  🗑️ Clear Results
                </button>
              </div>
            )}
          </div>

          {/* Menu Data Card */}
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">📋 Menu Data</h3>
              <button 
                onClick={loadMenuData}
                disabled={loadingMenu}
                className="text-sm text-green-600 hover:text-green-800"
              >
                {loadingMenu ? 'Loading...' : '↻ Refresh'}
              </button>
            </div>
            
            {menuData.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No menu data yet. Extract from a URL to get started.
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                <p className="text-gray-600 text-sm mb-2">{menuData.length} items</p>
                {menuData.slice(0, 20).map((item, i) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-800">{item.name}</span>
                      <span className="text-green-600">{item.price}</span>
                    </div>
                    {item.category && (
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded mt-1 inline-block">
                        {item.category}
                      </span>
                    )}
                    {item.description && (
                      <p className="text-gray-500 text-sm mt-1 line-clamp-2">{item.description}</p>
                    )}
                  </div>
                ))}
                {menuData.length > 20 && (
                  <p className="text-gray-500 text-center text-sm py-2">
                    ... and {menuData.length - 20} more items
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default VishvaPage;
