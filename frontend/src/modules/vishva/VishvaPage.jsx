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
  stopExtraction,
  // Training Data Management
  getTrainingData,
  addTrainingItem,
  updateTrainingItem,
  deleteTrainingItem,
  mergeCategories,
  // Model Performance
  getModelPerformance,
  getConfusionMatrix,
  // Feedback
  submitFeedback,
  getFeedback,
  applyAllFeedback,
  // Abbreviations
  getAbbreviations,
  addAbbreviation,
  deleteAbbreviation,
  // Confidence Settings
  getConfidenceSettings,
  updateConfidenceSettings,
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
  const [trainingProgress, setTrainingProgress] = useState(null);
  const [trainingSteps, setTrainingSteps] = useState([]);
  
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
  
  // State for active tab
  const [activeTab, setActiveTab] = useState('extract'); // 'extract', 'training-data', 'performance', 'settings'
  
  // State for Training Data Management
  const [trainingData, setTrainingData] = useState({ items: [], categories: {}, category_list: [] });
  const [loadingTrainingData, setLoadingTrainingData] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [newItem, setNewItem] = useState({ name: '', price: '', category: '' });
  const [showAddItem, setShowAddItem] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [mergeSource, setMergeSource] = useState([]);
  const [mergeTarget, setMergeTarget] = useState('');
  const [showMergeModal, setShowMergeModal] = useState(false);
  
  // State for Model Performance
  const [modelPerformance, setModelPerformance] = useState(null);
  const [confusionMatrix, setConfusionMatrix] = useState(null);
  const [loadingPerformance, setLoadingPerformance] = useState(false);
  
  // State for Feedback
  const [feedbackData, setFeedbackData] = useState({ corrections: [] });
  const [editingPrediction, setEditingPrediction] = useState(null);
  
  // State for Abbreviations
  const [abbreviations, setAbbreviations] = useState({ rules: [] });
  const [newAbbrev, setNewAbbrev] = useState({ abbreviation: '', full_text: '' });
  
  // State for Confidence Settings
  const [confidenceSettings, setConfidenceSettings] = useState({
    global_threshold: 0.7,
    flag_for_review_below: 0.5,
    category_thresholds: {}
  });
  
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

  // Load tab-specific data when tab changes
  useEffect(() => {
    if (activeTab === 'training-data') {
      loadTrainingData();
    } else if (activeTab === 'performance') {
      loadPerformanceData();
    } else if (activeTab === 'settings') {
      loadSettingsData();
    }
  }, [activeTab]);

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

  // Load Training Data
  const loadTrainingData = async () => {
    setLoadingTrainingData(true);
    try {
      const result = await getTrainingData();
      if (result.success) {
        setTrainingData(result);
      }
    } catch (err) {
      console.error('Failed to load training data:', err);
    } finally {
      setLoadingTrainingData(false);
    }
  };

  // Load Performance Data
  const loadPerformanceData = async () => {
    setLoadingPerformance(true);
    try {
      const [perfResult, matrixResult] = await Promise.all([
        getModelPerformance(),
        getConfusionMatrix()
      ]);
      if (perfResult.success) setModelPerformance(perfResult);
      if (matrixResult.success) setConfusionMatrix(matrixResult);
    } catch (err) {
      console.error('Failed to load performance data:', err);
    } finally {
      setLoadingPerformance(false);
    }
  };

  // Load Settings Data
  const loadSettingsData = async () => {
    try {
      const [abbrevResult, confResult, feedbackResult] = await Promise.all([
        getAbbreviations(),
        getConfidenceSettings(),
        getFeedback()
      ]);
      if (abbrevResult.success) setAbbreviations(abbrevResult);
      if (confResult.success) setConfidenceSettings(confResult);
      if (feedbackResult.success) setFeedbackData(feedbackResult);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  // Training Data Handlers
  const handleAddTrainingItem = async () => {
    if (!newItem.name.trim() || !newItem.category.trim()) {
      setError('Name and category are required');
      return;
    }
    try {
      await addTrainingItem(newItem);
      setNewItem({ name: '', price: '', category: '' });
      setShowAddItem(false);
      loadTrainingData();
      loadMenuData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateTrainingItem = async (itemId, updates) => {
    try {
      await updateTrainingItem(itemId, updates);
      setEditingItem(null);
      loadTrainingData();
      loadMenuData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteTrainingItem = async (itemId) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      await deleteTrainingItem(itemId);
      loadTrainingData();
      loadMenuData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleMergeCategories = async () => {
    if (mergeSource.length === 0 || !mergeTarget.trim()) {
      setError('Select categories to merge and enter target name');
      return;
    }
    try {
      await mergeCategories(mergeSource, mergeTarget);
      setShowMergeModal(false);
      setMergeSource([]);
      setMergeTarget('');
      loadTrainingData();
      loadMenuData();
    } catch (err) {
      setError(err.message);
    }
  };

  // Feedback Handlers
  const handleSubmitFeedback = async (prediction, correctCategory) => {
    try {
      await submitFeedback(
        prediction.name,
        prediction.predicted_category,
        correctCategory,
        prediction.price || ''
      );
      setEditingPrediction(null);
      // Update local prediction
      setPredictions(prev => prev.map(p => 
        p.name === prediction.name 
          ? { ...p, predicted_category: correctCategory, corrected: true }
          : p
      ));
    } catch (err) {
      setError(err.message);
    }
  };

  // Abbreviation Handlers
  const handleAddAbbreviation = async () => {
    if (!newAbbrev.abbreviation.trim() || !newAbbrev.full_text.trim()) {
      setError('Both abbreviation and full text are required');
      return;
    }
    try {
      await addAbbreviation(newAbbrev.abbreviation, newAbbrev.full_text);
      setNewAbbrev({ abbreviation: '', full_text: '' });
      loadSettingsData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteAbbreviation = async (abbrev) => {
    try {
      await deleteAbbreviation(abbrev);
      loadSettingsData();
    } catch (err) {
      setError(err.message);
    }
  };

  // Confidence Settings Handlers
  const handleUpdateConfidenceSettings = async () => {
    try {
      await updateConfidenceSettings(confidenceSettings);
      setError(null);
    } catch (err) {
      setError(err.message);
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
    setTrainingProgress(null);
    setTrainingSteps([]);
    
    try {
      const eventSource = new EventSource('/api/v1/vishva/train-stream');
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'step') {
            setTrainingProgress({
              step: data.step,
              totalSteps: data.total_steps,
              title: data.title,
              message: data.message,
              progress: data.progress
            });
            setTrainingSteps(prev => {
              // Add new step if not already present
              const exists = prev.some(s => s.step === data.step);
              if (!exists) {
                return [...prev, { step: data.step, title: data.title, status: 'active' }];
              }
              return prev;
            });
          } else if (data.type === 'substep') {
            setTrainingProgress(prev => ({
              ...prev,
              message: data.message,
              progress: data.progress
            }));
          } else if (data.type === 'complete') {
            setTrainResult({
              success: data.success,
              message: data.message,
              best_model: data.best_model,
              accuracy: data.accuracy,
              f1_score: data.f1_score,
              categories: data.categories,
              total_models_tested: data.total_models_tested
            });
            setTrainingProgress(prev => ({
              ...prev,
              progress: 100
            }));
            setTrainingSteps(prev => prev.map(s => ({ ...s, status: 'complete' })));
            setTraining(false);
            eventSource.close();
            loadModelStatus();
          } else if (data.type === 'error') {
            setError(data.message);
            setTraining(false);
            eventSource.close();
          }
        } catch (e) {
          console.error('Failed to parse SSE data:', e);
        }
      };
      
      eventSource.onerror = (err) => {
        console.error('SSE Error:', err);
        setError('Connection to server lost');
        setTraining(false);
        eventSource.close();
      };
      
    } catch (err) {
      setError(err.message);
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

      {/* Tab Navigation */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-4">
          {[
            { id: 'extract', label: '🔍 Extract & Train', icon: '🔍' },
            { id: 'training-data', label: '📊 Training Data', icon: '📊' },
            { id: 'performance', label: '📈 Model Performance', icon: '📈' },
            { id: 'settings', label: '⚙️ Settings', icon: '⚙️' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'extract' && (
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
              {training ? '⏳ Training in progress...' : '🚀 Train Model'}
            </button>
            {menuData.length === 0 && (
              <p className="text-yellow-600 text-sm mt-2">Extract menu data first before training</p>
            )}
            
            {/* Training Progress UI */}
            {training && trainingProgress && (
              <div className="mt-4 space-y-4">
                {/* Progress Bar */}
                <div className="relative">
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-500 ease-out"
                      style={{ width: `${trainingProgress.progress}%` }}
                    />
                  </div>
                  <span className="absolute right-0 -top-6 text-sm font-medium text-gray-600">
                    {trainingProgress.progress}%
                  </span>
                </div>
                
                {/* Current Step */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold">{trainingProgress.step}</span>
                      </div>
                      <div className="absolute inset-0 w-10 h-10 bg-green-400 rounded-full animate-ping opacity-25" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800">{trainingProgress.title}</h4>
                      <p className="text-sm text-gray-600">{trainingProgress.message}</p>
                    </div>
                  </div>
                </div>
                
                {/* Step Timeline */}
                <div className="flex items-center justify-between px-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((stepNum) => {
                    const isActive = trainingProgress.step === stepNum;
                    const isComplete = trainingProgress.step > stepNum;
                    return (
                      <div key={stepNum} className="flex flex-col items-center">
                        <div className={`
                          w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300
                          ${isComplete ? 'bg-green-500 text-white' : 
                            isActive ? 'bg-green-500 text-white ring-4 ring-green-200' : 
                            'bg-gray-200 text-gray-500'}
                        `}>
                          {isComplete ? '✓' : stepNum}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {trainResult && !training && (
              <div className={`mt-4 p-4 rounded-lg ${trainResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <p className={trainResult.success ? 'text-green-800 font-medium' : 'text-red-800'}>
                  {trainResult.success ? '✓' : '✗'} {trainResult.message}
                </p>
                {trainResult.success && (
                  <div className="text-green-700 text-sm mt-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white rounded-lg p-2 border border-green-200">
                        <p className="text-xs text-gray-500">Best Model</p>
                        <p className="font-semibold">{trainResult.best_model}</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 border border-green-200">
                        <p className="text-xs text-gray-500">Accuracy</p>
                        <p className="font-semibold">{(trainResult.accuracy * 100).toFixed(1)}%</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 border border-green-200">
                        <p className="text-xs text-gray-500">F1-Score</p>
                        <p className="font-semibold">{(trainResult.f1_score * 100).toFixed(1)}%</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 border border-green-200">
                        <p className="text-xs text-gray-500">Categories</p>
                        <p className="font-semibold">{trainResult.categories?.length || 0}</p>
                      </div>
                    </div>
                    {trainResult.total_models_tested && (
                      <p className="text-xs text-gray-500 text-center mt-2">
                        Tested {trainResult.total_models_tested} model configurations
                      </p>
                    )}
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
                    <div 
                      key={i} 
                      className={`p-3 rounded-lg border flex justify-between items-center cursor-pointer transition-all ${
                        pred.corrected ? 'bg-green-50 border-green-200' :
                        pred.confidence < confidenceSettings.flag_for_review_below ? 'bg-yellow-50 border-yellow-200' :
                        'bg-gray-50 hover:bg-gray-100'
                      }`}
                      onClick={() => setEditingPrediction(pred)}
                    >
                      <div>
                        <p className="font-medium text-gray-800">{pred.name}</p>
                        {pred.price && <p className="text-gray-500 text-sm">{pred.price}</p>}
                        {pred.confidence < confidenceSettings.flag_for_review_below && !pred.corrected && (
                          <span className="text-xs text-yellow-600">⚠️ Low confidence - click to correct</span>
                        )}
                        {pred.corrected && (
                          <span className="text-xs text-green-600">✓ Corrected</span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          pred.corrected ? 'bg-green-100 text-green-800' :
                          pred.confidence < confidenceSettings.flag_for_review_below ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {pred.predicted_category}
                        </span>
                        <p className="text-gray-500 text-xs mt-1">
                          {(pred.confidence * 100).toFixed(1)}% confidence
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Correction Modal */}
                {editingPrediction && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                      <h3 className="text-lg font-semibold mb-4">Correct Prediction</h3>
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm text-gray-600">Item:</p>
                          <p className="font-medium">{editingPrediction.name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Predicted Category:</p>
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded">
                            {editingPrediction.predicted_category}
                          </span>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Correct Category:
                          </label>
                          <input
                            type="text"
                            id="correct-category-input"
                            defaultValue={editingPrediction.predicted_category}
                            className="w-full px-3 py-2 border rounded-lg"
                            list="model-categories"
                          />
                          <datalist id="model-categories">
                            {modelStatus?.categories?.map(cat => (
                              <option key={cat} value={cat} />
                            ))}
                          </datalist>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-6">
                        <button
                          onClick={() => {
                            const input = document.getElementById('correct-category-input');
                            if (input.value) {
                              handleSubmitFeedback(editingPrediction, input.value);
                            }
                          }}
                          className="flex-1 btn-primary"
                        >
                          ✓ Submit Correction
                        </button>
                        <button
                          onClick={() => setEditingPrediction(null)}
                          className="flex-1 btn-secondary"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
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

            {/* Feedback Section for Predictions */}
            {predictions.length > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 text-sm">
                  💡 <strong>Tip:</strong> Click on any prediction to correct it and improve the model!
                </p>
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
      )}

      {/* Training Data Management Tab */}
      {activeTab === 'training-data' && (
        <div className="space-y-6">
          {/* Header with actions */}
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Training Data Management</h2>
              <p className="text-gray-500 text-sm">
                {trainingData.total_items || 0} items across {trainingData.category_list?.length || 0} categories
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddItem(true)}
                className="btn-primary"
              >
                ➕ Add Item
              </button>
              <button
                onClick={() => setShowMergeModal(true)}
                className="btn-secondary"
              >
                🔀 Merge Categories
              </button>
              <button
                onClick={loadTrainingData}
                disabled={loadingTrainingData}
                className="btn-secondary"
              >
                {loadingTrainingData ? '⏳' : '↻'} Refresh
              </button>
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded-full text-sm ${
                selectedCategory === 'all'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({trainingData.total_items || 0})
            </button>
            {trainingData.category_list?.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedCategory === cat
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat} ({trainingData.categories?.[cat] || 0})
              </button>
            ))}
          </div>

          {/* Training Data Table */}
          <div className="card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">ID</th>
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Name</th>
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Price</th>
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Category</th>
                    <th className="text-right py-2 px-3 text-gray-600 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {trainingData.items
                    ?.filter(item => selectedCategory === 'all' || item.category === selectedCategory)
                    .map(item => (
                      <tr key={item.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 text-gray-500 text-sm">{item.id}</td>
                        <td className="py-2 px-3">
                          {editingItem?.id === item.id ? (
                            <input
                              type="text"
                              value={editingItem.name}
                              onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                              className="w-full px-2 py-1 border rounded"
                            />
                          ) : (
                            <span className="font-medium text-gray-800">{item.name}</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-gray-600">
                          {editingItem?.id === item.id ? (
                            <input
                              type="text"
                              value={editingItem.price}
                              onChange={(e) => setEditingItem({ ...editingItem, price: e.target.value })}
                              className="w-24 px-2 py-1 border rounded"
                            />
                          ) : (
                            item.price
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {editingItem?.id === item.id ? (
                            <select
                              value={editingItem.category}
                              onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                              className="px-2 py-1 border rounded"
                            >
                              {trainingData.category_list?.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
                              {item.category}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {editingItem?.id === item.id ? (
                            <div className="flex gap-1 justify-end">
                              <button
                                onClick={() => handleUpdateTrainingItem(item.id, editingItem)}
                                className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200"
                              >
                                ✓ Save
                              </button>
                              <button
                                onClick={() => setEditingItem(null)}
                                className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
                              >
                                ✗ Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-1 justify-end">
                              <button
                                onClick={() => setEditingItem({ ...item })}
                                className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
                              >
                                ✎ Edit
                              </button>
                              <button
                                onClick={() => handleDeleteTrainingItem(item.id)}
                                className="px-2 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
                              >
                                🗑️
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add Item Modal */}
          {showAddItem && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold mb-4">Add Training Item</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input
                      type="text"
                      value={newItem.name}
                      onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="e.g., Grilled Chicken"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                    <input
                      type="text"
                      value={newItem.price}
                      onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="e.g., Rs. 1500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                    <input
                      type="text"
                      value={newItem.category}
                      onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="e.g., Main Course"
                      list="categories-list"
                    />
                    <datalist id="categories-list">
                      {trainingData.category_list?.map(cat => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                  </div>
                </div>
                <div className="flex gap-2 mt-6">
                  <button onClick={handleAddTrainingItem} className="flex-1 btn-primary">
                    Add Item
                  </button>
                  <button onClick={() => setShowAddItem(false)} className="flex-1 btn-secondary">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Merge Categories Modal */}
          {showMergeModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold mb-4">Merge Categories</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select categories to merge:</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {trainingData.category_list?.map(cat => (
                        <label key={cat} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={mergeSource.includes(cat)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setMergeSource([...mergeSource, cat]);
                              } else {
                                setMergeSource(mergeSource.filter(c => c !== cat));
                              }
                            }}
                            className="rounded"
                          />
                          <span>{cat} ({trainingData.categories?.[cat] || 0} items)</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Merge into:</label>
                    <input
                      type="text"
                      value={mergeTarget}
                      onChange={(e) => setMergeTarget(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="Enter target category name"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-6">
                  <button onClick={handleMergeCategories} className="flex-1 btn-primary">
                    Merge {mergeSource.length} Categories
                  </button>
                  <button onClick={() => { setShowMergeModal(false); setMergeSource([]); setMergeTarget(''); }} className="flex-1 btn-secondary">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Model Performance Tab */}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-800">Model Performance Dashboard</h2>
            <button
              onClick={loadPerformanceData}
              disabled={loadingPerformance}
              className="btn-secondary"
            >
              {loadingPerformance ? '⏳ Loading...' : '↻ Refresh'}
            </button>
          </div>

          {!modelPerformance ? (
            <div className="card text-center py-12">
              <p className="text-gray-500">No model trained yet. Train a model first to see performance metrics.</p>
            </div>
          ) : (
            <>
              {/* Best Model Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="card bg-gradient-to-br from-green-50 to-green-100">
                  <p className="text-green-600 text-sm font-medium">Best Model</p>
                  <p className="text-2xl font-bold text-green-800">{modelPerformance.best_model?.model}</p>
                </div>
                <div className="card bg-gradient-to-br from-blue-50 to-blue-100">
                  <p className="text-blue-600 text-sm font-medium">Accuracy</p>
                  <p className="text-2xl font-bold text-blue-800">
                    {((modelPerformance.best_model?.accuracy || 0) * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="card bg-gradient-to-br from-purple-50 to-purple-100">
                  <p className="text-purple-600 text-sm font-medium">F1 Score</p>
                  <p className="text-2xl font-bold text-purple-800">
                    {((modelPerformance.best_model?.f1_score || 0) * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="card bg-gradient-to-br from-orange-50 to-orange-100">
                  <p className="text-orange-600 text-sm font-medium">Categories</p>
                  <p className="text-2xl font-bold text-orange-800">{modelPerformance.categories?.length || 0}</p>
                </div>
              </div>

              {/* Category Distribution */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Category Distribution</h3>
                <div className="space-y-2">
                  {Object.entries(modelPerformance.category_distribution || {}).sort((a, b) => b[1] - a[1]).map(([cat, count]) => {
                    const maxCount = Math.max(...Object.values(modelPerformance.category_distribution || {}));
                    const percentage = (count / maxCount) * 100;
                    return (
                      <div key={cat} className="flex items-center gap-3">
                        <span className="w-32 text-sm text-gray-600 truncate">{cat}</span>
                        <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="w-12 text-right text-sm font-medium">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Confusion Matrix */}
              {confusionMatrix && (
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">🔢 Confusion Matrix</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className="p-2 border bg-gray-50"></th>
                          {confusionMatrix.categories?.map(cat => (
                            <th key={cat} className="p-2 border bg-gray-50 text-xs font-medium" title={cat}>
                              {cat.substring(0, 8)}...
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {confusionMatrix.categories?.map((cat, i) => (
                          <tr key={cat}>
                            <td className="p-2 border bg-gray-50 font-medium text-xs" title={cat}>
                              {cat.substring(0, 8)}...
                            </td>
                            {confusionMatrix.matrix?.[i]?.map((val, j) => (
                              <td 
                                key={j} 
                                className={`p-2 border text-center ${
                                  i === j ? 'bg-green-100 font-bold' : val > 0 ? 'bg-red-50' : ''
                                }`}
                              >
                                {val}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Per-Category Metrics */}
              {confusionMatrix?.per_category_metrics && (
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">📈 Per-Category Metrics</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3">Category</th>
                          <th className="text-right py-2 px-3">Precision</th>
                          <th className="text-right py-2 px-3">Recall</th>
                          <th className="text-right py-2 px-3">F1 Score</th>
                          <th className="text-right py-2 px-3">Support</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(confusionMatrix.per_category_metrics).map(([cat, metrics]) => (
                          <tr key={cat} className="border-b hover:bg-gray-50">
                            <td className="py-2 px-3 font-medium">{cat}</td>
                            <td className="py-2 px-3 text-right">{(metrics.precision * 100).toFixed(1)}%</td>
                            <td className="py-2 px-3 text-right">{(metrics.recall * 100).toFixed(1)}%</td>
                            <td className="py-2 px-3 text-right">{(metrics.f1_score * 100).toFixed(1)}%</td>
                            <td className="py-2 px-3 text-right">{metrics.support}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Model Comparison Leaderboard */}
              {modelPerformance.all_results && (
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">🏆 Model Comparison Leaderboard</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3">#</th>
                          <th className="text-left py-2 px-3">Model</th>
                          <th className="text-left py-2 px-3">Vectorizer</th>
                          <th className="text-left py-2 px-3">Feature Selector</th>
                          <th className="text-right py-2 px-3">Accuracy</th>
                          <th className="text-right py-2 px-3">F1 Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modelPerformance.all_results.slice(0, 10).map((result, i) => (
                          <tr key={i} className={`border-b ${i === 0 ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                            <td className="py-2 px-3">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>
                            <td className="py-2 px-3 font-medium">{result.model}</td>
                            <td className="py-2 px-3">{result.vectorizer}</td>
                            <td className="py-2 px-3">{result.feature_selector}</td>
                            <td className="py-2 px-3 text-right">{(result.accuracy * 100).toFixed(1)}%</td>
                            <td className="py-2 px-3 text-right">{(result.f1_score * 100).toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Abbreviation Mapper */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">📝 Abbreviation Mapper</h3>
            <p className="text-gray-600 text-sm mb-4">
              Map POS abbreviations to full text for better prediction accuracy.
            </p>
            
            {/* Add new abbreviation */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newAbbrev.abbreviation}
                onChange={(e) => setNewAbbrev({ ...newAbbrev, abbreviation: e.target.value })}
                placeholder="Abbrev (e.g., chkn)"
                className="flex-1 px-3 py-2 border rounded-lg text-sm"
              />
              <input
                type="text"
                value={newAbbrev.full_text}
                onChange={(e) => setNewAbbrev({ ...newAbbrev, full_text: e.target.value })}
                placeholder="Full text (e.g., chicken)"
                className="flex-1 px-3 py-2 border rounded-lg text-sm"
              />
              <button
                onClick={handleAddAbbreviation}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                ➕
              </button>
            </div>
            
            {/* Abbreviation list */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {abbreviations.rules?.map((rule, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div>
                    <span className="font-mono text-sm bg-gray-200 px-2 py-1 rounded">{rule.abbreviation}</span>
                    <span className="mx-2 text-gray-400">→</span>
                    <span className="text-gray-700">{rule.full_text}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteAbbreviation(rule.abbreviation)}
                    className="text-red-500 hover:text-red-700"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Confidence Settings */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">🎯 Confidence Thresholds</h3>
            <p className="text-gray-600 text-sm mb-4">
              Set confidence thresholds for automatic categorization and review flags.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Global Threshold ({(confidenceSettings.global_threshold * 100).toFixed(0)}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={confidenceSettings.global_threshold * 100}
                  onChange={(e) => setConfidenceSettings({
                    ...confidenceSettings,
                    global_threshold: e.target.value / 100
                  })}
                  className="w-full"
                />
                <p className="text-xs text-gray-500">Predictions below this won't be auto-accepted</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Flag for Review Below ({(confidenceSettings.flag_for_review_below * 100).toFixed(0)}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={confidenceSettings.flag_for_review_below * 100}
                  onChange={(e) => setConfidenceSettings({
                    ...confidenceSettings,
                    flag_for_review_below: e.target.value / 100
                  })}
                  className="w-full"
                />
                <p className="text-xs text-gray-500">Predictions below this will be flagged for manual review</p>
              </div>
              
              <button
                onClick={handleUpdateConfidenceSettings}
                className="w-full btn-primary"
              >
                💾 Save Settings
              </button>
            </div>
          </div>

          {/* Feedback / Corrections */}
          <div className="card lg:col-span-2">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">💬 Feedback & Corrections</h3>
                <p className="text-gray-500 text-sm">{feedbackData.total || 0} corrections recorded</p>
              </div>
              {feedbackData.corrections?.length > 0 && (
                <button
                  onClick={async () => {
                    try {
                      const result = await applyAllFeedback();
                      if (result.success) {
                        loadSettingsData();
                        loadTrainingData();
                      }
                    } catch (err) {
                      setError(err.message);
                    }
                  }}
                  className="btn-primary"
                >
                  ✅ Apply All & Retrain
                </button>
              )}
            </div>
            
            {feedbackData.corrections?.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No corrections yet. Correct predictions in the Extract & Train tab to improve the model.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3">Item Name</th>
                      <th className="text-left py-2 px-3">Predicted</th>
                      <th className="text-left py-2 px-3">Corrected To</th>
                      <th className="text-left py-2 px-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feedbackData.corrections?.map((correction, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium">{correction.item_name}</td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                            {correction.predicted_category}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                            {correction.correct_category}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-gray-500">{correction.timestamp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default VishvaPage;
