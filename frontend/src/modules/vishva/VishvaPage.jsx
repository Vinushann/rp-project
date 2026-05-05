/**
 * Vishva Module Page
 * ==================
 * 
 * OWNER: Vishva
 * 
 * Web Data Extraction & Classification Workspace
 * - Extract structured entries from source websites
 * - Train an ML model for label classification
 * - Predict labels for new records
 */

import { useState, useEffect, useRef } from 'react';
import { 
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, 
  Tooltip as ReChartsTooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, BarChart, Bar, LabelList, ReferenceLine
} from 'recharts';
import PingButton from '../../components/PingButton';
import { 
  trainModel, 
  predictCategories,
  predictFromFile,
  analyzeClassification,
  preAnalyzeClassification,
  exportPredictions,
  getMenuData, 
  getModelStatus,
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
  // Agent
  streamAgentChat,
  getLogs,
  getLatestRawFile,
} from '../../lib/api';

const MODULE_NAME = 'vishva';

function VishvaPage() {
  // State for extraction
  const [extractUrl, setExtractUrl] = useState('');
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
  const [rawFilePath, setRawFilePath] = useState('');
  const [cleaning, setCleaning] = useState(false);
  
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
  
  // State for system logs
  const [systemLogs, setSystemLogs] = useState([]);
  const [logType, setLogType] = useState('agent'); // 'agent' or 'system'
  const [pollingLogs, setPollingLogs] = useState(false);

  // State for Menu Engineering (Classification)
  const [classificationFile, setClassificationFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [classificationData, setClassificationData] = useState(null);
  const [classificationParams, setClassificationParams] = useState({
    mode: 'static',
    qty_threshold: 3000,
    profit_threshold: 60
  });
  const [selectedQuadrant, setSelectedQuadrant] = useState(null);
  const [selectedAnalysisCategory, setSelectedAnalysisCategory] = useState('All');

  // State for Column Mapping
  const [fileColumns, setFileColumns] = useState([]);
  const [showMapping, setShowMapping] = useState(false);
  const [columnMapping, setColumnMapping] = useState({
    item_name: '',
    qty: '',
    margin: '',
    price: '',
    profit: '',
    category: ''
  });

  // State for errors
  const [error, setError] = useState(null);

  // State for UI mode
  const [isSimpleMode, setIsSimpleMode] = useState(() => {
    const saved = localStorage.getItem('vishva_simple_mode');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Persist mode preference
  useEffect(() => {
    localStorage.setItem('vishva_simple_mode', JSON.stringify(isSimpleMode));
    
    // If we're in simple mode and on a technical tab, switch to extract
    if (isSimpleMode && (activeTab === 'training-data' || activeTab === 'performance')) {
      setActiveTab('extract');
    }
  }, [isSimpleMode]);

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
    // Try to restore latest raw file path for cleaning
    getLatestRawFile()
      .then(res => {
        if (res.success) setRawFilePath(res.file_path);
      })
      .catch(() => {});
    loadSystemLogs();
    
    // Poll for system logs every 5 seconds
    const interval = setInterval(loadSystemLogs, 5000);
    return () => clearInterval(interval);
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

  const loadSystemLogs = async () => {
    try {
      const result = await getLogs(50);
      if (result.logs) {
        setSystemLogs(result.logs);
      }
    } catch (err) {
      console.error('Failed to load system logs:', err);
    }
  };

  // Training Data Handlers
  const handleAddTrainingItem = async () => {
    if (!newItem.name.trim() || !newItem.category.trim()) {
      setError('Record name and label are required');
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
      setError('Select labels to merge and enter a target label');
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

  // Local agent-based extraction using the visible browser session
  const handleExtract = async () => {
    if (!extractUrl.trim()) {
      setError('Please enter a URL');
      return;
    }

    setExtracting(true);
    setError(null);
    setExtractResult(null);
    setAgentThoughts([{
      type: 'status',
      message: '🚀 Initializing agent and browser session...',
      timestamp: new Date().toLocaleTimeString()
    }]);

    const message = `Extract menu from ${extractUrl}. Do NOT clean the data yet.`;

    const es = streamAgentChat(message, {
      onThought: (text) => {
        setAgentThoughts(prev => {
          // Accumulate consecutive thought tokens into one entry
          if (prev.length > 0 && prev[prev.length - 1].type === 'thought') {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              message: updated[updated.length - 1].message + text,
            };
            return updated;
          }
          return [...prev, {
            type: 'thought',
            message: text,
            timestamp: new Date().toLocaleTimeString()
          }];
        });
      },
      onToolStart: (tool, input) => {
        setAgentThoughts(prev => [...prev, {
          type: 'tool',
          message: `🔧 Calling: ${tool}`,
          detail: input,
          timestamp: new Date().toLocaleTimeString()
        }]);
      },
      onToolResult: (tool, result) => {
        // Try to parse and summarize the result
        let summary = `✅ ${tool} completed`;
        try {
          const parsed = JSON.parse(result);
          if (parsed.item_count) summary = `✅ ${tool}: ${parsed.item_count} items`;
          else if (parsed.success === false) summary = `❌ ${tool}: ${parsed.message}`;
          else if (parsed.accuracy) summary = `✅ ${tool}: accuracy ${(parsed.accuracy * 100).toFixed(1)}%`;
          else if (parsed.model_exists === false) summary = `⚠️ ${tool}: No model found`;
          else if (parsed.total_items) summary = `✅ ${tool}: ${parsed.total_items} items in data`;
          
          if (tool === 'extract_menu' && parsed.file_path) {
            setRawFilePath(parsed.file_path);
          }
        } catch {
          // If JSON parse fails, try to extract file_path using regex as fallback
          if (tool === 'extract_menu') {
            const match = result.match(/"file_path":\s*"([^"]+)"/);
            if (match && match[1]) {
              setRawFilePath(match[1]);
            }
          }
        }
        setAgentThoughts(prev => [...prev, {
          type: 'status',
          message: summary,
          timestamp: new Date().toLocaleTimeString()
        }]);
      },
      onDone: () => {
        setExtracting(false);
        eventSourceRef.current = null;
        setExtractResult({ success: true, message: 'Agent finished processing' });
        loadMenuData();
        loadModelStatus();
      },
      onError: (err) => {
        setError(err);
        setExtracting(false);
        eventSourceRef.current = null;
      },
    }, 'default', null, { llm: 'ollama' });

    eventSourceRef.current = es;
  };
  
  const handleClean = async () => {
    if (!rawFilePath) {
      setError('No raw data to clean. Run extraction first.');
      return;
    }

    setCleaning(true);
    setError(null);
    setAgentThoughts(prev => [...prev, {
      type: 'status',
      message: '🧹 Starting data cleaning and normalization...',
      timestamp: new Date().toLocaleTimeString()
    }]);

    const message = `Clean the extracted data at ${rawFilePath}. If cleaning fails, show me the raw content and solve the issue dynamically.`;

    const es = streamAgentChat(message, {
      onThought: (text) => {
        setAgentThoughts(prev => {
          if (prev.length > 0 && prev[prev.length - 1].type === 'thought') {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              message: updated[updated.length - 1].message + text,
            };
            return updated;
          }
          return [...prev, {
            type: 'thought',
            message: text,
            timestamp: new Date().toLocaleTimeString()
          }];
        });
      },
      onToolStart: (tool, input) => {
        setAgentThoughts(prev => [...prev, {
          type: 'tool',
          message: `🔧 Calling: ${tool}`,
          detail: input,
          timestamp: new Date().toLocaleTimeString()
        }]);
      },
      onToolResult: (tool, result) => {
        let summary = `✅ ${tool} completed`;
        try {
          const parsed = JSON.parse(result);
          if (parsed.item_count) summary = `✅ ${tool}: ${parsed.item_count} items`;
          else if (parsed.success === false) summary = `❌ ${tool}: ${parsed.message}`;
        } catch { /* keep default */ }
        
        setAgentThoughts(prev => [...prev, {
          type: 'status',
          message: summary,
          timestamp: new Date().toLocaleTimeString()
        }]);
      },
      onDone: () => {
        setCleaning(false);
        eventSourceRef.current = null;
        loadMenuData();
      },
      onError: (err) => {
        setError(err);
        setCleaning(false);
        eventSourceRef.current = null;
      },
    }, 'default', null, { llm: 'ollama' });

    eventSourceRef.current = es;
  };

  // Stop the extraction agent
  const handleStopExtract = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setAgentThoughts(prev => [...prev, {
      type: 'status',
      message: 'Extraction canceled by user',
      timestamp: new Date().toLocaleTimeString()
    }]);

    setExtractResult({ success: false, message: 'Extraction canceled by user' });
    setExtracting(false);
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
      setError('Please enter records to classify');
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

  const handlePreAnalyze = async (file) => {
    setAnalyzing(true);
    setError(null);
    try {
      const result = await preAnalyzeClassification(file);
      if (result.success) {
        setFileColumns(result.columns);
        setShowMapping(true);
        // Reset mapping
        setColumnMapping({
          item_name: '',
          qty: '',
          margin: '',
          price: '',
          profit: '',
          category: ''
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAnalyze = async (params = classificationParams, mapping = columnMapping) => {
    if (!classificationFile && !classificationData) {
      setError('Please upload a sales CSV/Excel file first.');
      return;
    }
    
    setAnalyzing(true);
    setError(null);
    try {
      const result = await analyzeClassification(
        classificationFile || classificationData.file_blob, // Fallback if re-analyzing
        params.mode,
        params.qty_threshold,
        params.profit_threshold,
        mapping
      );
      if (result.success) {
        // Store the file blob if we just uploaded it, so we can re-analyze without re-uploading
        const dataWithBlob = { ...result.data, file_blob: classificationFile || classificationData.file_blob };
        setClassificationData(dataWithBlob);
        setSelectedQuadrant(null); // Reset filter
        setShowMapping(false); // Hide mapping UI after success
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const totalLabels = trainingData.category_list?.length || modelStatus?.categories?.length || 0;
  const reviewQueueCount = predictions.filter(
    (prediction) => !prediction.corrected && prediction.confidence < confidenceSettings.flag_for_review_below
  ).length;
  const overviewCards = [
    {
      label: 'Captured Records',
      value: menuData.length,
      detail: 'Structured items ready for curation',
      panelClass: 'bg-white/10 border-white/15',
    },
    {
      label: 'Known Labels',
      value: totalLabels,
      detail: 'Classification targets available',
      panelClass: 'bg-emerald-400/15 border-emerald-300/30',
    },
    {
      label: 'Model Status',
      value: modelStatus?.model_exists ? 'Ready' : 'Draft',
      detail: modelStatus?.model_exists ? modelStatus.model_name : 'Train a classifier to start predictions',
      panelClass: 'bg-sky-400/15 border-sky-300/30',
    },
    {
      label: 'Review Queue',
      value: reviewQueueCount,
      detail: 'Low-confidence results awaiting review',
      panelClass: 'bg-amber-400/15 border-amber-300/30',
    },
  ];

  return (
    <div className="space-y-8 p-6 lg:p-8">
      {/* Page Header */}
      <div className={`overflow-hidden rounded-3xl border transition-all duration-500 ${
        isSimpleMode 
          ? 'border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-sky-50 shadow-lg shadow-emerald-100/50' 
          : 'border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-900 shadow-xl shadow-slate-200/60'
      } px-6 py-8 lg:px-8`}>
        <div className="flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-6">
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={isSimpleMode}
                  onChange={() => setIsSimpleMode(!isSimpleMode)}
                />
                <div className={`w-11 h-6 rounded-full peer transition-all duration-300
                  ${isSimpleMode ? 'bg-emerald-500' : 'bg-slate-700'}
                  after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all
                  peer-checked:after:translate-x-full peer-checked:after:border-white
                `}></div>
                <span className={`ml-3 text-sm font-bold uppercase tracking-wider ${isSimpleMode ? 'text-emerald-700' : 'text-slate-400'}`}>
                  {isSimpleMode ? '✨ Simple Mode' : '🛠️ Advanced Mode'}
                </span>
              </label>
            </div>

            {isSimpleMode ? (
              <div className="animate-in fade-in slide-in-from-top-4 duration-700">
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-emerald-700">
                  Vishva Assistant
                </span>
                <div className="mt-4 flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-sky-400 text-3xl font-bold text-white shadow-lg shadow-emerald-200">
                    V
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-800 sm:text-4xl">Welcome to Vishva</h1>
                    <p className="mt-2 max-w-2xl text-lg text-slate-600">
                      Your intelligent assistant for organizing web data. I'll help you collect items from websites and teach the system how to recognize them.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="animate-in fade-in duration-700">
                <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200">
                  Vishva workspace
                </span>
                <div className="mt-4 flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/12 text-2xl font-bold text-white ring-1 ring-white/20 backdrop-blur">
                    V
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Web Extraction & Classification Studio</h1>
                    <p className="mt-2 max-w-2xl text-sm text-slate-200 sm:text-base">
                      Capture structured records from live pages or uploaded files, curate labels, train a classifier, and feed review corrections back into the pipeline.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {!isSimpleMode && (
            <div className="grid grid-cols-2 gap-3 xl:w-[520px] animate-in fade-in slide-in-from-right-4 duration-700">
              {overviewCards.map((card) => (
                <div
                  key={card.label}
                  className={`rounded-2xl border p-4 backdrop-blur ${card.panelClass}`}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">{card.label}</p>
                  <p className="mt-3 text-2xl font-semibold text-white">{card.value}</p>
                  <p className="mt-2 text-sm text-slate-300">{card.detail}</p>
                </div>
              ))}
            </div>
          )}
        </div>
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
      <div className="rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
        <nav className="flex flex-wrap gap-2">
          {[
            { id: 'extract', label: isSimpleMode ? 'Workspace' : 'Pipeline Workspace' },
            { id: 'classification', label: 'Menu Engineering' },
            ...(!isSimpleMode ? [
              { id: 'training-data', label: 'Dataset Curation' },
              { id: 'performance', label: 'Quality Metrics' },
            ] : []),
            { id: 'settings', label: isSimpleMode ? 'Assistant Rules' : 'Rules & Feedback' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-4 py-3 font-medium text-sm transition-all ${
                activeTab === tab.id
                  ? 'bg-green-500 text-white shadow-sm'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
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
            {!isSimpleMode && <PingButton moduleName={MODULE_NAME} />}
            
            {/* Model Status Card */}
            {!isSimpleMode && (
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Model Status</h3>
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
                            <span className="text-gray-500 text-sm">Labels:</span>
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
            )}

          {/* Extract Menu Card */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Extract Source Records</h3>
            <p className="mb-4 text-sm text-gray-600">
              Use the local agent to open the page in a visible browser, verify items against the page text, and add them to the dataset.
            </p>
            <div className="space-y-4">
              {/* Extraction Mode */}
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600 font-medium">Mode:</span>
                <span className="text-xs text-gray-600">Local agent with visible browser</span>
              </div>

              <input
                type="url"
                value={extractUrl}
                onChange={(e) => setExtractUrl(e.target.value)}
                placeholder="https://example.com/catalog"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                disabled={extracting}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleExtract}
                  disabled={extracting}
                  className="flex-1 btn-primary disabled:opacity-50"
                >
                  {extracting ? 'Extracting...' : 'Run Local Agent Extraction'}
                </button>
                {extracting && (
                  <button
                    onClick={handleStopExtract}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
                  >
                    Stop
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
                      Added {extractResult.item_count} records to the dataset
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Clean Data Card */}
          <div className={`card transition-all duration-500 ${rawFilePath ? 'border-amber-200 bg-amber-50/30' : 'opacity-50'}`}>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Clean & Structure Data</h3>
            <p className="mb-4 text-sm text-gray-600">
              Process raw extracted data into structured JSON. If the standard cleaner fails, the agent will analyze the content and fix it dynamically.
            </p>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex-1 p-3 bg-white/50 rounded-lg border border-gray-200 text-xs font-mono truncate">
                  {rawFilePath ? `Raw Source: ${rawFilePath.split(/[\\/]/).pop()}` : 'No raw data available'}
                </div>
                <button
                  onClick={() => {
                    getLatestRawFile().then(res => {
                      if (res.success) setRawFilePath(res.file_path);
                    });
                  }}
                  title="Scan for latest raw data"
                  className="p-3 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors text-gray-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
              <button
                onClick={handleClean}
                disabled={!rawFilePath || cleaning}
                className={`w-full py-2 px-4 rounded-lg font-medium transition-all ${
                  rawFilePath && !cleaning 
                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-md' 
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                {cleaning ? 'Cleaning...' : 'Run Agent Cleaning'}
              </button>
            </div>
          </div>
        </div>

          {/* Execution & System Monitor */}
          {isSimpleMode ? (
            <div className="card lg:col-span-2 overflow-hidden border-emerald-100 bg-white/50 backdrop-blur shadow-xl shadow-emerald-50/50">
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-6">
                {(extracting || training) ? (
                  <>
                    <div className="relative">
                      <div className="h-24 w-24 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-500 shadow-inner">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <div className="absolute inset-0 h-24 w-24 rounded-full border-4 border-emerald-400 border-t-transparent animate-spin"></div>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-800">
                        {extracting ? 'Collecting Data...' : 'Learning from your data...'}
                      </h3>
                      <p className="mt-2 text-slate-500 max-w-md mx-auto">
                        {extracting 
                          ? "I'm visiting the website to find all the items you need. This will take just a moment."
                          : "I'm studying the examples you provided to become better at recognizing them."}
                      </p>
                    </div>
                    
                    {/* Plain Language Status Display */}
                    <div className="w-full max-w-md bg-emerald-50 rounded-2xl p-6 border border-emerald-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-emerald-700 uppercase tracking-widest">Assistant Status</span>
                        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      </div>
                      <p className="text-lg font-medium text-emerald-800">
                        {agentThoughts.length > 0 
                          ? agentThoughts[agentThoughts.length - 1].message.length > 60
                            ? agentThoughts[agentThoughts.length - 1].message.substring(0, 60) + "..."
                            : agentThoughts[agentThoughts.length - 1].message
                          : "Initializing..."}
                      </p>
                      <p className="mt-4 text-xs text-emerald-600 font-medium italic">
                        {trainingProgress ? `Progress: ${trainingProgress.progress}% - ${trainingProgress.message}` : "Working on it..."}
                      </p>
                    </div>

                    <button
                      onClick={handleStopExtract}
                      className="px-8 py-3 bg-white border-2 border-red-100 text-red-500 hover:bg-red-50 font-bold rounded-full transition-all flex items-center gap-2"
                    >
                      Cancel Process
                    </button>
                  </>
                ) : (
                  <>
                    <div className="h-20 w-20 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-700">All set and ready</h3>
                      <p className="mt-2 text-slate-500">Enter a website address or upload a file to get started.</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="card lg:col-span-2 overflow-hidden border-slate-200 shadow-lg">
              <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">Execution Monitor</h3>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setLogType('agent')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      logType === 'agent' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Agent Thoughts
                  </button>
                  <button
                    onClick={() => setLogType('system')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      logType === 'system' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    System Logs
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Left Side: Summary & Stats */}
                <div className="md:col-span-1 space-y-4">
                  <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">Status</p>
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${extracting || training ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
                      <p className="font-semibold text-slate-800">{extracting ? 'Extracting...' : training ? 'Training...' : 'Standby'}</p>
                    </div>
                  </div>
                  
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Log Entries</p>
                    <p className="text-2xl font-bold text-slate-800">{logType === 'agent' ? agentThoughts.length : systemLogs.length}</p>
                    <p className="text-xs text-slate-500 mt-1">Updated just now</p>
                  </div>

                  {extracting && (
                    <button
                      onClick={handleStopExtract}
                      className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-2xl border border-red-200 transition-all flex items-center justify-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                      </svg>
                      Stop Agent
                    </button>
                  )}
                  
                  {!extracting && agentThoughts.length > 0 && logType === 'agent' && (
                    <button 
                      onClick={() => setAgentThoughts([])}
                      className="w-full py-2 text-slate-400 hover:text-slate-600 text-sm font-medium transition-all"
                    >
                      Clear History
                    </button>
                  )}
                </div>

                {/* Right Side: Log Feed */}
                <div className="md:col-span-3">
                  <div className="bg-slate-950 rounded-2xl p-6 h-[450px] overflow-y-auto font-mono text-sm relative group shadow-inner border border-slate-800">
                    {/* Decorative Elements */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 opacity-50"></div>
                    
                    {logType === 'agent' ? (
                      agentThoughts.length === 0 && !extracting ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 italic space-y-4">
                          <div className="h-16 w-16 rounded-full bg-slate-900 flex items-center justify-center text-slate-700">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                          </div>
                          <p>No agent activity yet. Start an extraction to see thoughts.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {agentThoughts.map((thought, i) => (
                            <div key={i} className="flex gap-3 group animate-in fade-in slide-in-from-left-2 duration-300">
                              <span className="text-slate-600 text-[10px] whitespace-nowrap pt-1">[{thought.timestamp}]</span>
                              <div className="flex-1">
                                <span className={`
                                  inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase mb-1 mr-2
                                  ${thought.type === 'thought' ? 'bg-emerald-500/10 text-emerald-400' : ''}
                                  ${thought.type === 'tool' ? 'bg-amber-500/10 text-amber-400' : ''}
                                  ${thought.type === 'status' ? 'bg-indigo-500/10 text-indigo-400' : ''}
                                `}>
                                  {thought.type}
                                </span>
                                <div className={`
                                  ${thought.type === 'thought' ? 'text-emerald-50/90' : ''}
                                  ${thought.type === 'tool' ? 'text-amber-50/90 font-semibold' : ''}
                                  ${thought.type === 'status' ? 'text-indigo-100 font-bold' : ''}
                                  whitespace-pre-wrap leading-relaxed
                                `}>
                                  {thought.message}
                                </div>
                                {thought.detail && (
                                  <div className="mt-1 p-2 bg-slate-900 rounded border border-slate-800 text-slate-400 text-xs overflow-x-auto">
                                    {typeof thought.detail === 'string' ? thought.detail : JSON.stringify(thought.detail, null, 2)}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                          <div ref={thoughtsEndRef} />
                          {extracting && (
                            <div className="flex items-center text-emerald-400 mt-6 pt-4 border-t border-slate-900">
                              <span className="relative flex h-2 w-2 mr-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </span>
                              <span className="text-xs font-bold uppercase tracking-widest">Agent is processing request...</span>
                            </div>
                          )}
                        </div>
                      )
                    ) : (
                      <div className="space-y-1.5">
                        {systemLogs.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-slate-500 italic space-y-4">
                            <p>Connecting to system log stream...</p>
                          </div>
                        ) : (
                          systemLogs.map((log, i) => {
                            const isError = log.includes('Status: 4') || log.includes('Status: 5') || log.includes('ERROR') || log.includes('Exception');
                            return (
                              <div key={i} className={`flex gap-3 py-0.5 border-l-2 pl-3 transition-colors ${isError ? 'border-red-500 bg-red-500/5' : 'border-slate-800 hover:bg-slate-900'}`}>
                                <span className={`text-[11px] leading-relaxed ${isError ? 'text-red-400' : 'text-slate-400'}`}>
                                  {log}
                                </span>
                              </div>
                            );
                          })
                        )}
                        <div ref={thoughtsEndRef} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Train Model Card */}
          <div className={`card transition-all duration-500 ${isSimpleMode ? 'border-sky-100 shadow-xl shadow-sky-50/50' : ''}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${isSimpleMode ? 'bg-sky-100 text-sky-600' : 'bg-gray-100 text-gray-600'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800">Train Label Classifier</h3>
            </div>
            
            <p className="text-gray-600 text-sm mb-6">
              {isSimpleMode 
                ? "Click here to teach the system how to recognize your labels. I'll analyze the data you've collected and build a smart model for you." 
                : "Train the classifier on the current dataset. The pipeline benchmarks multiple model combinations and keeps the best performer."}
            </p>

            {isSimpleMode && (
              <div className="mb-6 space-y-4">
                <div className="flex items-start gap-4 p-4 bg-sky-50 rounded-2xl border border-sky-100">
                  <div className="h-8 w-8 rounded-full bg-sky-200 flex-shrink-0 flex items-center justify-center text-sky-700 font-bold">1</div>
                  <div>
                    <p className="font-bold text-sky-900 text-sm">Review Examples</p>
                    <p className="text-xs text-sky-700 mt-1">Make sure you have collected some items first using the "Extract" button.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 bg-sky-50 rounded-2xl border border-sky-100 opacity-60">
                  <div className="h-8 w-8 rounded-full bg-sky-200 flex-shrink-0 flex items-center justify-center text-sky-700 font-bold">2</div>
                  <div>
                    <p className="font-bold text-sky-900 text-sm">Start Learning</p>
                    <p className="text-xs text-sky-700 mt-1">Click the button below to start the training process.</p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleTrain}
              disabled={training || menuData.length === 0}
              className={`w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-lg active:scale-[0.98] disabled:opacity-50
                ${isSimpleMode 
                  ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-sky-200' 
                  : 'bg-slate-800 text-white'}`}
            >
              {training ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {isSimpleMode ? 'Learning...' : 'Training in progress...'}
                </span>
              ) : (
                isSimpleMode ? '🚀 Teach Assistant Now' : 'Train Model'
              )}
            </button>
            {menuData.length === 0 && (
              <p className="text-amber-600 text-xs mt-3 flex items-center gap-2 bg-amber-50 p-2 rounded-lg border border-amber-100">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Extract source records first before training
              </p>
            )}
            
            {/* Training Progress UI */}
            {training && trainingProgress && (
              <div className="mt-6 space-y-4 animate-in fade-in zoom-in duration-300">
                {/* Progress Bar */}
                <div className="relative">
                  <div className="h-4 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                    <div 
                      className={`h-full transition-all duration-500 ease-out ${isSimpleMode ? 'bg-gradient-to-r from-sky-400 to-indigo-500' : 'bg-green-500'}`}
                      style={{ width: `${trainingProgress.progress}%` }}
                    />
                  </div>
                  <span className="absolute right-0 -top-6 text-sm font-bold text-slate-600">
                    {trainingProgress.progress}%
                  </span>
                </div>
                
                {/* Current Step */}
                <div className={`rounded-2xl p-5 border transition-all ${isSimpleMode ? 'bg-white border-sky-100 shadow-sm' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg ${isSimpleMode ? 'bg-sky-500' : 'bg-green-500'}`}>
                        {trainingProgress.step}
                      </div>
                      <div className={`absolute inset-0 rounded-2xl animate-ping opacity-25 ${isSimpleMode ? 'bg-sky-400' : 'bg-green-400'}`} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-800 text-lg">{trainingProgress.title}</h4>
                      <p className="text-sm text-gray-500 font-medium">{trainingProgress.message}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {trainResult && !training && (
              <div className={`mt-6 p-5 rounded-2xl border animate-in slide-in-from-bottom-4 duration-500 ${trainResult.success ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white ${trainResult.success ? 'bg-emerald-500' : 'bg-red-500'}`}>
                    {trainResult.success ? '✓' : '✗'}
                  </div>
                  <p className={`font-bold text-lg ${trainResult.success ? 'text-emerald-800' : 'text-red-800'}`}>
                    {trainResult.success ? (isSimpleMode ? 'Success! Model Ready' : 'Training Complete') : 'Error during training'}
                  </p>
                </div>
                <p className={`text-sm mb-4 ${trainResult.success ? 'text-emerald-700' : 'text-red-700'}`}>{trainResult.message}</p>
                
                {trainResult.success && (
                  <div className="text-emerald-700 text-sm space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/80 backdrop-blur rounded-xl p-3 border border-emerald-100 shadow-sm">
                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Model Name</p>
                        <p className="font-bold text-slate-800 truncate">{trainResult.best_model}</p>
                      </div>
                      <div className="bg-white/80 backdrop-blur rounded-xl p-3 border border-emerald-100 shadow-sm group relative" title="How often the system is correct">
                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Accuracy ✨</p>
                        <p className="font-bold text-slate-800">{(trainResult.accuracy * 100).toFixed(1)}%</p>
                      </div>
                      <div className="bg-white/80 backdrop-blur rounded-xl p-3 border border-emerald-100 shadow-sm group relative" title="A balance between finding all items and being correct">
                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Smart Score 🧪</p>
                        <p className="font-bold text-slate-800">{(trainResult.f1_score * 100).toFixed(1)}%</p>
                      </div>
                      <div className="bg-white/80 backdrop-blur rounded-xl p-3 border border-emerald-100 shadow-sm">
                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total Labels</p>
                        <p className="font-bold text-slate-800">{trainResult.categories?.length || 0}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        {/* Right Column */}
        <div className="space-y-6">
          
          {/* Predict Categories Card */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Classify New Records</h3>
            
            {/* File Upload Section - Primary */}
            <div className="mb-6 p-4 bg-green-50 border-2 border-dashed border-green-300 rounded-lg">
              <p className="text-green-800 font-medium mb-2">Upload Batch File</p>
              <p className="text-green-700 text-sm mb-3">
                Upload a CSV or PDF file containing entry names or line items to classify them in bulk.
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
                  Choose File
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
                  {uploading ? 'Processing file...' : 'Classify Records from File'}
                </button>
              )}
            </div>
            
            {/* Manual Input Section - Secondary */}
            <div className="border-t pt-4">
              <p className="text-gray-600 text-sm mb-2">
                Or enter records manually, one per line. Format: <code className="bg-gray-100 px-1 rounded">Name - Price/Value</code>
              </p>
              <textarea
                value={predictionInput}
                onChange={(e) => setPredictionInput(e.target.value)}
                placeholder="Premium Support Plan - USD 499&#10;Annual Maintenance Renewal - USD 1200&#10;Starter Toolkit - USD 89"
                className="w-full h-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none text-sm"
              />
              <button
                onClick={handlePredict}
                disabled={predicting || !modelStatus?.model_exists}
                className="w-full mt-2 btn-secondary disabled:opacity-50"
              >
                {predicting ? 'Classifying...' : 'Classify from Text'}
              </button>
            </div>
            
            {!modelStatus?.model_exists && (
              <p className="text-yellow-600 text-sm mt-2">Train the model first before running classifications</p>
            )}
            
            {/* Prediction Results */}
            {predictions.length > 0 && (
              <div className="mt-6 border-t pt-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-medium text-gray-700">Classification Results ({predictions.length})</h4>
                  
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
                      title={isSimpleMode ? `Confidence: ${(pred.confidence * 100).toFixed(1)}% - Click to correct if wrong` : ''}
                    >
                      <div>
                        <p className="font-medium text-gray-800">{pred.name}</p>
                        {pred.price && <p className="text-gray-500 text-sm">{pred.price}</p>}
                        {pred.confidence < confidenceSettings.flag_for_review_below && !pred.corrected && (
                          <span className="text-xs text-yellow-600">Needs review - click to correct</span>
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
                        {!isSimpleMode && (
                          <p className="text-gray-500 text-xs mt-1">
                            {(pred.confidence * 100).toFixed(1)}% confidence
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Correction Modal */}
                {editingPrediction && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                      <h3 className="text-lg font-semibold mb-4">Review Classification</h3>
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm text-gray-600">Record:</p>
                          <p className="font-medium">{editingPrediction.name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Predicted Label:</p>
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded">
                            {editingPrediction.predicted_category}
                          </span>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Correct Label:
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
                          Save Correction
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
                  Clear Results
                </button>
              </div>
            )}

            {/* Feedback Section for Predictions */}
            {predictions.length > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 text-sm">
                  <strong>Tip:</strong> Click any result to correct its label and feed higher-quality examples back into training.
                </p>
              </div>
            )}
          </div>

          {/* Menu Data Card */}
          {!isSimpleMode && (
            <div className="card">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Current Dataset</h3>
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
                  No records captured yet. Start with a source URL or batch file.
                </p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  <p className="text-gray-600 text-sm mb-2">{menuData.length} records</p>
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
                      ... and {menuData.length - 20} more records
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Training Data Management Tab */}
      {activeTab === 'training-data' && (
        <div className="space-y-6">
          {/* Header with actions */}
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Dataset Curation</h2>
              <p className="text-gray-500 text-sm">
                {trainingData.total_items || 0} records across {trainingData.category_list?.length || 0} labels
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddItem(true)}
                className="btn-primary"
              >
                Add Record
              </button>
              <button
                onClick={() => setShowMergeModal(true)}
                className="btn-secondary"
              >
                Merge Labels
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

          {/* Label Filter */}
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
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Record Name</th>
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Value / Price</th>
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Label</th>
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
                <h3 className="text-lg font-semibold mb-4">Add Record</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Record Name *</label>
                    <input
                      type="text"
                      value={newItem.name}
                      onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="e.g., Premium Support Plan"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Value / Price</label>
                    <input
                      type="text"
                      value={newItem.price}
                      onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="e.g., USD 499"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Label *</label>
                    <input
                      type="text"
                      value={newItem.category}
                      onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="e.g., Subscription"
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
                    Add Record
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
                <h3 className="text-lg font-semibold mb-4">Merge Labels</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select labels to merge:</label>
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
                          <span>{cat} ({trainingData.categories?.[cat] || 0} records)</span>
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
                      placeholder="Enter target label name"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-6">
                  <button onClick={handleMergeCategories} className="flex-1 btn-primary">
                    Merge {mergeSource.length} Labels
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
            <h2 className="text-xl font-semibold text-gray-800">Model Quality Dashboard</h2>
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
              <p className="text-gray-500">No trained model yet. Train a model first to inspect quality metrics.</p>
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
                  <p className="text-orange-600 text-sm font-medium">Labels</p>
                  <p className="text-2xl font-bold text-orange-800">{modelPerformance.categories?.length || 0}</p>
                </div>
              </div>

              {/* Category Distribution */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Label Distribution</h3>
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
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Per-Label Metrics</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3">Label</th>
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

      {/* Menu Engineering Tab */}
      {activeTab === 'classification' && (
        <div className="space-y-6">
          {!classificationData && !analyzing ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200">
              <div className="h-20 w-20 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Menu Engineering Analysis</h2>
              <p className="text-gray-500 max-w-md text-center mb-8">
                Upload your sales data (CSV or Excel) to perform a professional quadrant analysis and identify your high-performers and margin-risks.
              </p>
              <div className="flex flex-col items-center gap-4">
                <input
                  type="file"
                  id="classification-file-input"
                  className="hidden"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      setClassificationFile(file);
                      handlePreAnalyze(file);
                    }
                  }}
                />
                {!showMapping && (
                  <>
                    <button
                      onClick={() => document.getElementById('classification-file-input').click()}
                      className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg transition-all"
                    >
                      📁 Upload Sales Data
                    </button>
                    <p className="text-xs text-gray-400">Supported formats: CSV, XLSX, XLS</p>
                  </>
                )}
              </div>

              {/* Mapping UI */}
              {showMapping && (
                <div className="w-full max-w-2xl bg-gray-50 p-8 rounded-3xl border border-gray-200 animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-800">Match Fields</h3>
                    <button 
                      onClick={() => setShowMapping(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mb-6">
                    Select the columns from your file that correspond to the required analysis fields.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                      { key: 'item_name', label: 'Item Name *', description: 'Product or dish name' },
                      { key: 'qty', label: 'Quantity Sold *', description: 'Total units sold' },
                      { key: 'margin', label: 'Profit Margin *', description: 'Percentage (%)' },
                      { key: 'price', label: 'Selling Price', description: 'Unit price' },
                      { key: 'category', label: 'Category', description: 'Menu section' },
                    ].map(field => (
                      <div key={field.key} className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">
                          {field.label}
                        </label>
                        <select
                          value={columnMapping[field.key]}
                          onChange={(e) => setColumnMapping({ ...columnMapping, [field.key]: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        >
                          <option value="">-- Select Column --</option>
                          {fileColumns.map(col => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>
                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{field.description}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-10 flex gap-4">
                    <button
                      onClick={() => handleAnalyze()}
                      disabled={!columnMapping.item_name || !columnMapping.qty || !columnMapping.margin}
                      className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-bold rounded-2xl shadow-lg transition-all"
                    >
                      🚀 Start Analysis
                    </button>
                    <button
                      onClick={() => setShowMapping(false)}
                      className="px-6 py-3 bg-white border border-gray-200 text-gray-600 font-bold rounded-2xl hover:bg-gray-50 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : analyzing ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
              <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-emerald-500 mb-6"></div>
              <h2 className="text-xl font-bold text-gray-800">Analyzing Your Menu...</h2>
              <p className="text-gray-500 mt-2">Calculating popularity indexes and profit margins...</p>
            </div>
          ) : (
            (() => {
              const filteredItems = classificationData.items.filter(i => {
                const matchQuad = selectedQuadrant ? i.quadrant === selectedQuadrant : true;
                const matchCat = selectedAnalysisCategory === 'All' ? true : i.category === selectedAnalysisCategory;
                return matchQuad && matchCat;
              });

              const filteredKPIs = {
                total: filteredItems.length,
                cashCows: filteredItems.filter(i => i.quadrant === 'Cash Cow').length,
                marginRisk: filteredItems.filter(i => i.quadrant === 'Margin Risk').length,
                avgMargin: filteredItems.length > 0 
                  ? (filteredItems.reduce((acc, i) => acc + i.margin, 0) / filteredItems.length).toFixed(1) + '%' 
                  : '0%'
              };

              return (
                <div className="space-y-6">
              {/* Header & Controls */}
              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Menu Classification Matrix</h2>
                  <p className="text-sm text-gray-500">Analysis for {classificationFile?.name || 'Uploaded Data'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setClassificationData(null);
                      setClassificationFile(null);
                      setShowMapping(false);
                      setFileColumns([]);
                      setSelectedAnalysisCategory('All');
                      setSelectedQuadrant(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-red-600 transition-colors"
                  >
                    🗑️ Clear & Upload New
                  </button>
                  <button
                    onClick={() => handleAnalyze()}
                    className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-xl shadow-md hover:bg-emerald-700 transition-all"
                  >
                    ↻ Refresh Analysis
                  </button>
                </div>
              </div>

              {/* Configuration Panel */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-sm md:col-span-1">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="text-emerald-500">⚙️</span> Analysis Mode
                  </h3>
                  
                  <div className="flex p-1 bg-gray-100 rounded-2xl mb-6">
                    <button
                      onClick={() => {
                        const newParams = { ...classificationParams, mode: 'static' };
                        setClassificationParams(newParams);
                        handleAnalyze(newParams);
                      }}
                      className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${
                        classificationParams.mode === 'static' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'
                      }`}
                    >
                      Static
                    </button>
                    <button
                      onClick={() => {
                        const newParams = { ...classificationParams, mode: 'index' };
                        setClassificationParams(newParams);
                        handleAnalyze(newParams);
                      }}
                      className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${
                        classificationParams.mode === 'index' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'
                      }`}
                    >
                      Index-Based
                    </button>
                  </div>

                  {classificationParams.mode === 'static' ? (
                    <div className="space-y-6">
                      <div>
                        <div className="flex justify-between mb-2">
                          <label className="text-sm font-bold text-gray-700">Quantity Threshold</label>
                          <span className="text-sm font-bold text-emerald-600">{classificationParams.qty_threshold.toLocaleString()}</span>
                        </div>
                        <input
                          type="range"
                          min="100"
                          max="10000"
                          step="100"
                          value={classificationParams.qty_threshold}
                          onChange={(e) => setClassificationParams({ ...classificationParams, qty_threshold: parseInt(e.target.value) })}
                          onMouseUp={() => handleAnalyze()}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between mb-2">
                          <label className="text-sm font-bold text-gray-700">Margin Threshold (%)</label>
                          <span className="text-sm font-bold text-emerald-600">{classificationParams.profit_threshold}%</span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="90"
                          step="5"
                          value={classificationParams.profit_threshold}
                          onChange={(e) => setClassificationParams({ ...classificationParams, profit_threshold: parseInt(e.target.value) })}
                          onMouseUp={() => handleAnalyze()}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                      <p className="text-xs text-emerald-700 leading-relaxed">
                        <strong>Z-Score Indexing:</strong> Items are compared against the average. Scores <strong>{">"} 0</strong> indicate above-average performance in popularity and profitability.
                      </p>
                    </div>
                  )}
                </div>

                {/* KPI Cards */}
                <div className="md:col-span-2 grid grid-cols-2 gap-4">
                  <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
                    {selectedAnalysisCategory !== 'All' && <div className="absolute top-0 right-0 w-1 h-full bg-emerald-500"></div>}
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Items</p>
                    <p className="text-3xl font-black text-gray-800">{filteredKPIs.total}</p>
                    <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-400"></span> {selectedAnalysisCategory === 'All' ? 'Active menu records' : `Items in ${selectedAnalysisCategory}`}
                    </div>
                  </div>
                  <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Cash Cows</p>
                    <p className="text-3xl font-black text-emerald-700">{filteredKPIs.cashCows}</p>
                    <div className="mt-2 text-xs text-gray-500">High profit & popularity</div>
                  </div>
                  <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                    <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-1">Margin Risks</p>
                    <p className="text-3xl font-black text-red-700">{filteredKPIs.marginRisk}</p>
                    <div className="mt-2 text-xs text-gray-500">High popularity, low profit</div>
                  </div>
                  <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                    <p className="text-xs font-bold text-sky-600 uppercase tracking-wider mb-1">Avg Margin</p>
                    <p className="text-3xl font-black text-sky-700">{filteredKPIs.avgMargin}</p>
                    <div className="mt-2 text-xs text-gray-500">{selectedAnalysisCategory === 'All' ? 'Across all items' : `Avg for ${selectedAnalysisCategory}`}</div>
                  </div>
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Scatter Plot - The Matrix */}
                <div className="xl:col-span-2 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm min-h-[500px]">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-bold text-gray-800">Classification Matrix</h3>
                    <div className="flex items-center gap-4 text-xs font-bold">
                      <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#38a169]"></span> Cow</div>
                      <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#e53e3e]"></span> Risk</div>
                      <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#4299e1]"></span> Low</div>
                      <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#718096]"></span> Unprod</div>
                    </div>
                  </div>
                  
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis 
                          type="number" 
                          dataKey={classificationParams.mode === 'static' ? 'qty' : 'pop_index'} 
                          name="Popularity" 
                          domain={classificationParams.mode === 'static' ? [0, 'auto'] : ['auto', 'auto']}
                          label={{ value: classificationParams.mode === 'static' ? 'Sold Quantity' : 'Popularity Index', position: 'bottom', offset: 0, fontSize: 12, fontWeight: 'bold' }}
                        />
                        <YAxis 
                          type="number" 
                          dataKey={classificationParams.mode === 'static' ? 'margin' : 'margin_index'} 
                          name="Profitability" 
                          domain={classificationParams.mode === 'static' ? [0, 'auto'] : ['auto', 'auto']}
                          label={{ value: classificationParams.mode === 'static' ? 'Profit Margin (%)' : 'Profitability Index', angle: -90, position: 'left', fontSize: 12, fontWeight: 'bold' }}
                        />
                        
                        {/* Threshold Crosshair */}
                        {classificationParams.mode === 'static' ? (
                          <>
                            <ReferenceLine x={classificationParams.qty_threshold} stroke="#cbd5e1" strokeDasharray="5 5" label={{ position: 'top', value: 'Qty Threshold', fontSize: 10, fill: '#64748b' }} />
                            <ReferenceLine y={classificationParams.profit_threshold} stroke="#cbd5e1" strokeDasharray="5 5" label={{ position: 'right', value: 'Margin Threshold', fontSize: 10, fill: '#64748b' }} />
                          </>
                        ) : (
                          <>
                            <ReferenceLine x={0} stroke="#cbd5e1" strokeDasharray="5 5" label={{ position: 'top', value: 'Avg Pop', fontSize: 10, fill: '#64748b' }} />
                            <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="5 5" label={{ position: 'right', value: 'Avg Margin', fontSize: 10, fill: '#64748b' }} />
                          </>
                        )}
                        <ReChartsTooltip 
                          cursor={{ strokeDasharray: '3 3' }} 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-white p-3 border border-gray-200 rounded-xl shadow-xl">
                                  <p className="font-bold text-gray-800 mb-1">{data.item_name}</p>
                                  <div className="space-y-1 text-xs">
                                    <p className="text-gray-500">Qty: <span className="font-bold text-gray-800">{data.qty.toLocaleString()}</span></p>
                                    <p className="text-gray-500">Margin: <span className="font-bold text-gray-800">{data.margin.toFixed(1)}%</span></p>
                                    <p className="text-gray-500">Revenue: <span className="font-bold text-gray-800">LKR {data.revenue.toLocaleString()}</span></p>
                                    <div className={`mt-2 inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider
                                      ${data.quadrant === 'Cash Cow' ? 'bg-emerald-100 text-emerald-700' : ''}
                                      ${data.quadrant === 'Margin Risk' ? 'bg-red-100 text-red-700' : ''}
                                      ${data.quadrant === 'Low Impact' ? 'bg-blue-100 text-blue-700' : ''}
                                      ${data.quadrant === 'Unproductive' ? 'bg-gray-100 text-gray-700' : ''}
                                    `}>
                                      {data.quadrant}
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Scatter 
                          data={
                            classificationData.items.filter(i => {
                              const matchQuad = selectedQuadrant ? i.quadrant === selectedQuadrant : true;
                              const matchCat = selectedAnalysisCategory === 'All' ? true : i.category === selectedAnalysisCategory;
                              return matchQuad && matchCat;
                            })
                          } 
                          fill="#8884d8"
                        >
                          {classificationData.items.map((entry, index) => {
                            let color = '#718096';
                            if (entry.quadrant === 'Cash Cow') color = '#38a169';
                            else if (entry.quadrant === 'Margin Risk') color = '#e53e3e';
                            else if (entry.quadrant === 'Low Impact') color = '#4299e1';
                            
                            return <Cell key={`cell-${index}`} fill={color} fillOpacity={0.7} strokeWidth={1} stroke="#fff" />;
                          })}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Pie Chart - Distribution */}
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col">
                  <h3 className="text-xl font-bold text-gray-800 mb-8">Quadrant Distribution</h3>
                  <div className="flex-1 min-h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={classificationData.charts.pie}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                          onClick={(data) => setSelectedQuadrant(selectedQuadrant === data.name ? null : data.name)}
                          className="cursor-pointer outline-none"
                        >
                          {classificationData.charts.pie.map((entry, index) => {
                            let color = '#718096';
                            if (entry.name === 'Cash Cow') color = '#38a169';
                            else if (entry.name === 'Margin Risk') color = '#e53e3e';
                            else if (entry.name === 'Low Impact') color = '#4299e1';
                            
                            return <Cell 
                              key={`cell-${index}`} 
                              fill={color} 
                              opacity={selectedQuadrant && selectedQuadrant !== entry.name ? 0.3 : 1}
                              stroke="none"
                            />;
                          })}
                        </Pie>
                        <ReChartsTooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-white p-2 border border-gray-100 rounded-lg shadow-lg text-xs font-bold">
                                  {payload[0].name}: {payload[0].value} items
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Legend / Filter Chips */}
                  <div className="flex flex-wrap gap-2 mt-4">
                    {classificationData.charts.pie.map((entry) => {
                       let colorClass = 'bg-gray-100 text-gray-700';
                       if (entry.name === 'Cash Cow') colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                       else if (entry.name === 'Margin Risk') colorClass = 'bg-red-50 text-red-700 border-red-100';
                       else if (entry.name === 'Low Impact') colorClass = 'bg-blue-50 text-blue-700 border-blue-100';
                       
                       const isActive = selectedQuadrant === entry.name;
                       
                       return (
                         <button
                           key={entry.name}
                           onClick={() => setSelectedQuadrant(isActive ? null : entry.name)}
                           className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all
                             ${colorClass} ${isActive ? 'ring-2 ring-offset-1 ring-gray-400' : 'opacity-70 hover:opacity-100'}
                           `}
                         >
                           {entry.name}
                         </button>
                       );
                    })}
                  </div>
                  {selectedQuadrant && (
                    <button 
                      onClick={() => setSelectedQuadrant(null)}
                      className="mt-4 text-xs text-gray-400 hover:text-gray-600 font-bold"
                    >
                      ✕ Clear Filter
                    </button>
                  )}
                </div>
              </div>

              {/* Category Impact Analysis Section */}
              <div className="mt-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-black text-gray-800 flex items-center gap-3">
                    <span className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">📊</span>
                    Category Strategic Impact
                  </h2>
                  <div className="flex bg-white p-1.5 rounded-2xl border border-gray-200 shadow-sm overflow-x-auto max-w-full no-scrollbar">
                    <button 
                      onClick={() => setSelectedAnalysisCategory('All')}
                      className={`px-4 py-1.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${selectedAnalysisCategory === 'All' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                      All Categories
                    </button>
                    {classificationData.charts.category_analysis?.map(cat => (
                      <button 
                        key={cat.category}
                        onClick={() => setSelectedAnalysisCategory(cat.category)}
                        className={`px-4 py-1.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${selectedAnalysisCategory === cat.category ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                      >
                        {cat.category}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  {/* Category Contribution Card */}
                  <div className="lg:col-span-3 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex justify-between items-start mb-10">
                      <div>
                        <h3 className="text-xl font-bold text-gray-800">Revenue Contribution vs. Item Performance</h3>
                        <p className="text-sm text-gray-500 mt-1">Strategic performance distribution across each menu category.</p>
                      </div>
                    </div>
                    
                    <div className="space-y-8">
                      {classificationData.charts.category_analysis?.map((cat, idx) => (
                        <div key={cat.category} className="group relative">
                          <div className="flex justify-between items-end mb-2">
                            <div className="flex items-center gap-3">
                              <span className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg text-xs font-black text-gray-400 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-all">
                                0{idx + 1}
                              </span>
                              <div>
                                <h4 className="font-bold text-gray-800">{cat.category}</h4>
                                <p className="text-[10px] text-gray-400 font-bold uppercase">{cat.item_count} Items • {cat.avg_margin.toFixed(1)}% Avg Margin</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black text-gray-800">{cat.rev_contribution.toFixed(1)}%</p>
                              <p className="text-[10px] text-gray-500 font-medium">Revenue Contribution</p>
                            </div>
                          </div>
                          <div className="h-3 w-full bg-gray-50 rounded-full overflow-hidden flex">
                            <div 
                              className="h-full bg-emerald-500 transition-all duration-1000 ease-out" 
                              style={{ width: `${cat.rev_contribution}%` }}
                            />
                          </div>
                          
                          {/* Mini distribution bar */}
                          <div className="mt-3 flex gap-1 h-1.5 opacity-60 group-hover:opacity-100 transition-all">
                            {['Cash Cow', 'Margin Risk', 'Low Impact', 'Unproductive'].map((q, i) => {
                              const count = cat.quadrants[q] || 0;
                              const pct = (count / cat.item_count) * 100;
                              if (pct === 0) return null;
                              
                              const colors = {
                                'Cash Cow': 'bg-emerald-400',
                                'Margin Risk': 'bg-red-400',
                                'Low Impact': 'bg-blue-400',
                                'Unproductive': 'bg-gray-400'
                              };
                              
                              return (
                                <div 
                                  key={q} 
                                  className={`h-full ${colors[q]} rounded-full`} 
                                  style={{ width: `${pct}%` }}
                                  title={`${q}: ${count} items`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Strategic Insight Card */}
                  <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-8 rounded-3xl shadow-xl text-white relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                    <div>
                      <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-[10px] font-black uppercase tracking-widest mb-6 inline-block">
                        Product Importance
                      </span>
                      <h3 className="text-2xl font-black leading-tight mb-4">
                        Strategic Focus
                      </h3>
                      <p className="text-emerald-100 text-sm leading-relaxed mb-8">
                        The <strong>{classificationData.charts.category_analysis?.[0]?.category}</strong> category is your primary revenue driver.
                        Maintain its quality while optimizing lower-performing sections.
                      </p>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
                        <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider mb-1">Top Revenue Source</p>
                        <p className="text-lg font-bold truncate">{classificationData.charts.category_analysis?.[0]?.category || 'N/A'}</p>
                      </div>
                      <button 
                        onClick={() => setSelectedAnalysisCategory(classificationData.charts.category_analysis?.[0]?.category)}
                        className="w-full py-3 bg-white text-emerald-800 font-black rounded-xl shadow-lg hover:bg-emerald-50 transition-all"
                      >
                        Drill Down Matrix
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Row - Top Items & Table */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Top Items Bar Chart */}
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                  <h3 className="text-xl font-bold text-gray-800 mb-8">Top 10 Performers by Revenue</h3>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={classificationData.charts.top_items.slice(0, 10)}
                        layout="vertical"
                        margin={{ left: 50, right: 30 }}
                      >
                        <XAxis type="number" hide />
                        <YAxis 
                          type="category" 
                          dataKey="item_name" 
                          width={150} 
                          tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }}
                        />
                        <ReChartsTooltip 
                           content={({ active, payload }) => {
                             if (active && payload && payload.length) {
                               const data = payload[0].payload;
                               return (
                                 <div className="bg-white p-3 border border-gray-200 rounded-xl shadow-xl">
                                   <p className="font-bold text-gray-800">{data.item_name}</p>
                                   <p className="text-xs text-emerald-600 font-black">LKR {data.revenue.toLocaleString()}</p>
                                 </div>
                               );
                             }
                             return null;
                           }}
                        />
                        <Bar 
                          dataKey="revenue" 
                          radius={[0, 10, 10, 0]}
                        >
                          {classificationData.charts.top_items.slice(0, 10).map((entry, index) => {
                            let color = '#718096';
                            if (entry.quadrant === 'Cash Cow') color = '#38a169';
                            else if (entry.quadrant === 'Margin Risk') color = '#e53e3e';
                            else if (entry.quadrant === 'Low Impact') color = '#4299e1';
                            return <Cell key={`bar-${index}`} fill={color} fillOpacity={0.8} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Items Table */}
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-bold text-gray-800">Item Details</h3>
                    {selectedQuadrant && (
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider
                        ${selectedQuadrant === 'Cash Cow' ? 'bg-emerald-100 text-emerald-700' : ''}
                        ${selectedQuadrant === 'Margin Risk' ? 'bg-red-100 text-red-700' : ''}
                        ${selectedQuadrant === 'Low Impact' ? 'bg-blue-100 text-blue-700' : ''}
                        ${selectedQuadrant === 'Unproductive' ? 'bg-gray-100 text-gray-700' : ''}
                      `}>
                        Filtering: {selectedQuadrant}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex-1 overflow-y-auto max-h-[400px] scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white border-b border-gray-100">
                        <tr>
                          <th className="text-left py-3 px-2 text-gray-400 font-bold uppercase text-[10px]">Item</th>
                          <th className="text-right py-3 px-2 text-gray-400 font-bold uppercase text-[10px]">Qty</th>
                          <th className="text-right py-3 px-2 text-gray-400 font-bold uppercase text-[10px]">Margin</th>
                          <th className="text-right py-3 px-2 text-gray-400 font-bold uppercase text-[10px]">Quadrant</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {classificationData.items.filter(i => {
                          const matchQuad = selectedQuadrant ? i.quadrant === selectedQuadrant : true;
                          const matchCat = selectedAnalysisCategory === 'All' ? true : i.category === selectedAnalysisCategory;
                          return matchQuad && matchCat;
                        }).map((item, i) => (
                          <tr key={i} className="hover:bg-gray-50 transition-colors">
                            <td className="py-3 px-2 font-bold text-gray-700">{item.item_name}</td>
                            <td className="py-3 px-2 text-right text-gray-500">{item.qty.toLocaleString()}</td>
                            <td className="py-3 px-2 text-right font-bold text-emerald-600">{item.margin.toFixed(1)}%</td>
                            <td className="py-3 px-2 text-right">
                              <span className={`inline-block w-2 h-2 rounded-full
                                ${item.quadrant === 'Cash Cow' ? 'bg-emerald-500' : ''}
                                ${item.quadrant === 'Margin Risk' ? 'bg-red-500' : ''}
                                ${item.quadrant === 'Low Impact' ? 'bg-blue-500' : ''}
                                ${item.quadrant === 'Unproductive' ? 'bg-gray-400' : ''}
                              `}></span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )
        })()
      )}
    </div>
  )}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Abbreviation Mapper */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Text Normalization Rules</h3>
            <p className="text-gray-600 text-sm mb-4">
              Normalize shorthand terms into full text before training and prediction.
            </p>
            
            {/* Add new abbreviation */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newAbbrev.abbreviation}
                onChange={(e) => setNewAbbrev({ ...newAbbrev, abbreviation: e.target.value })}
                placeholder="Short form (e.g., svc)"
                className="flex-1 px-3 py-2 border rounded-lg text-sm"
              />
              <input
                type="text"
                value={newAbbrev.full_text}
                onChange={(e) => setNewAbbrev({ ...newAbbrev, full_text: e.target.value })}
                placeholder="Expanded text (e.g., service)"
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
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Confidence Thresholds</h3>
            <p className="text-gray-600 text-sm mb-4">
              Set score thresholds for automatic acceptance and manual review.
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
                Save Settings
              </button>
            </div>
          </div>

          {/* Feedback / Corrections */}
          <div className="card lg:col-span-2">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Feedback & Corrections</h3>
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
                  Apply All & Retrain
                </button>
              )}
            </div>
            
            {feedbackData.corrections?.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No corrections yet. Review classifications in the pipeline tab to improve the model.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3">Record Name</th>
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
