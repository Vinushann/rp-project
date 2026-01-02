/**
 * API Client Helper
 * =================
 * Centralized API calling functions for all modules.
 * Uses VITE_API_BASE_URL from environment or falls back to proxy.
 */

// Get API base URL from environment or use empty string for proxy
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Generic fetch wrapper with error handling
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const response = await fetch(url, { ...defaultOptions, ...options });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP error! status: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Ping a module's backend to check if it's running
 * @param {string} moduleName - Name of the module (vinushan, vishva, nandika, ayathma)
 * @returns {Promise<{module: string, status: string}>}
 */
export async function pingModule(moduleName) {
  return apiRequest(`/api/v1/${moduleName}/ping`);
}

/**
 * Send a chat message to a module
 * @param {string} moduleName - Name of the module
 * @param {string} sessionId - Session identifier
 * @param {string} message - The message to send
 * @returns {Promise<{reply: string, session_id: string, module: string}>}
 */
export async function sendChatMessage(moduleName, sessionId, message) {
  return apiRequest(`/api/v1/${moduleName}/chat`, {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      message: message,
    }),
  });
}

/**
 * Check if the main API is healthy
 * @returns {Promise<{status: string}>}
 */
export async function checkHealth() {
  return apiRequest('/health');
}

/**
 * Get API info
 * @returns {Promise<{message: string, version: string, modules: string[]}>}
 */
export async function getApiInfo() {
  return apiRequest('/');
}

// ============================================
// VISHVA MODULE API FUNCTIONS
// ============================================

/**
 * Extract menu data from a URL
 * @param {string} url - The restaurant menu URL to scrape
 * @returns {Promise<{success: boolean, message: string, item_count: number}>}
 */
export async function extractMenu(url) {
  return apiRequest('/api/v1/vishva/extract', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

/**
 * Train the category classifier model
 * @param {string} trainingFile - Optional path to training file
 * @returns {Promise<{success: boolean, message: string, best_model: string, accuracy: number}>}
 */
export async function trainModel(trainingFile = null) {
  return apiRequest('/api/v1/vishva/train', {
    method: 'POST',
    body: JSON.stringify({ training_file: trainingFile }),
  });
}

/**
 * Predict categories for menu items
 * @param {Array<{name: string, price?: string, description?: string}>} items - Menu items to classify
 * @returns {Promise<{success: boolean, predictions: Array}>}
 */
export async function predictCategories(items) {
  return apiRequest('/api/v1/vishva/predict', {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}

/**
 * Get current menu data
 * @returns {Promise<{success: boolean, items: Array}>}
 */
export async function getMenuData() {
  return apiRequest('/api/v1/vishva/menu-data');
}

/**
 * Get model status
 * @returns {Promise<{model_exists: boolean, model_name: string, accuracy: number}>}
 */
export async function getModelStatus() {
  return apiRequest('/api/v1/vishva/model-status');
}

/**
 * Stop the currently running extraction agent
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function stopExtraction() {
  return apiRequest('/api/v1/vishva/extract-stop', {
    method: 'POST',
  });
}

/**
 * Get extraction status
 * @returns {Promise<{running: boolean, stop_requested: boolean}>}
 */
export async function getExtractionStatus() {
  return apiRequest('/api/v1/vishva/extract-status');
}

/**
 * Predict categories from an uploaded file (CSV or PDF)
 * @param {File} file - The file to upload
 * @returns {Promise<{success: boolean, predictions: Array, statistics: object}>}
 */
export async function predictFromFile(file) {
  const url = `${API_BASE_URL}/api/v1/vishva/predict-file`;
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP error! status: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Export predictions to a specific format
 * @param {Array} predictions - The predictions to export
 * @param {string} format - Export format: 'json', 'csv', or 'pdf'
 * @returns {Promise<Blob|object>}
 */
export async function exportPredictions(predictions, format) {
  const url = `${API_BASE_URL}/api/v1/vishva/export-predictions?format=${format}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(predictions),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP error! status: ${response.status}`);
  }
  
  if (format === 'json') {
    return response.json();
  } else {
    // Return blob for CSV and PDF
    return response.blob();
  }
}

export default {
  pingModule,
  sendChatMessage,
  checkHealth,
  getApiInfo,
  // Vishva module
  extractMenu,
  trainModel,
  predictCategories,
  predictFromFile,
  exportPredictions,
  getMenuData,
  getModelStatus,
  stopExtraction,
  getExtractionStatus,
};


// ============================================
// TRAINING DATA MANAGEMENT API
// ============================================

/**
 * Get all training data items
 */
export async function getTrainingData() {
  return apiRequest('/api/v1/vishva/training-data');
}

/**
 * Add a new training item
 */
export async function addTrainingItem(item) {
  return apiRequest('/api/v1/vishva/training-data', {
    method: 'POST',
    body: JSON.stringify(item),
  });
}

/**
 * Update a training item
 */
export async function updateTrainingItem(itemId, updates) {
  return apiRequest(`/api/v1/vishva/training-data/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify({ id: itemId, ...updates }),
  });
}

/**
 * Delete a training item
 */
export async function deleteTrainingItem(itemId) {
  return apiRequest(`/api/v1/vishva/training-data/${itemId}`, {
    method: 'DELETE',
  });
}

/**
 * Merge categories
 */
export async function mergeCategories(sourceCategories, targetCategory) {
  return apiRequest('/api/v1/vishva/training-data/merge-categories', {
    method: 'POST',
    body: JSON.stringify({ source_categories: sourceCategories, target_category: targetCategory }),
  });
}

/**
 * Split a category
 */
export async function splitCategory(sourceCategory, newCategories) {
  return apiRequest('/api/v1/vishva/training-data/split-category', {
    method: 'POST',
    body: JSON.stringify({ source_category: sourceCategory, new_categories: newCategories }),
  });
}


// ============================================
// MODEL PERFORMANCE API
// ============================================

/**
 * Get model performance metrics
 */
export async function getModelPerformance() {
  return apiRequest('/api/v1/vishva/model-performance');
}

/**
 * Get confusion matrix
 */
export async function getConfusionMatrix() {
  return apiRequest('/api/v1/vishva/model-confusion-matrix');
}


// ============================================
// FEEDBACK / CONTINUOUS LEARNING API
// ============================================

/**
 * Submit feedback for a wrong prediction
 */
export async function submitFeedback(itemName, predictedCategory, correctCategory, price = '') {
  const params = new URLSearchParams({
    item_name: itemName,
    predicted_category: predictedCategory,
    correct_category: correctCategory,
    price: price,
  });
  return apiRequest(`/api/v1/vishva/feedback?${params}`, {
    method: 'POST',
  });
}

/**
 * Get all feedback
 */
export async function getFeedback() {
  return apiRequest('/api/v1/vishva/feedback');
}

/**
 * Apply all feedback to training data
 */
export async function applyAllFeedback() {
  return apiRequest('/api/v1/vishva/feedback/apply-all', {
    method: 'POST',
  });
}


// ============================================
// ABBREVIATION MAPPER API
// ============================================

/**
 * Get abbreviation rules
 */
export async function getAbbreviations() {
  return apiRequest('/api/v1/vishva/abbreviations');
}

/**
 * Update all abbreviation rules
 */
export async function updateAbbreviations(rules, autoLearn = true) {
  return apiRequest('/api/v1/vishva/abbreviations', {
    method: 'POST',
    body: JSON.stringify({ rules, auto_learn: autoLearn }),
  });
}

/**
 * Add a single abbreviation
 */
export async function addAbbreviation(abbreviation, fullText) {
  return apiRequest('/api/v1/vishva/abbreviations/add', {
    method: 'POST',
    body: JSON.stringify({ abbreviation, full_text: fullText }),
  });
}

/**
 * Delete an abbreviation
 */
export async function deleteAbbreviation(abbreviation) {
  return apiRequest(`/api/v1/vishva/abbreviations/${encodeURIComponent(abbreviation)}`, {
    method: 'DELETE',
  });
}


// ============================================
// CONFIDENCE SETTINGS API
// ============================================

/**
 * Get confidence settings
 */
export async function getConfidenceSettings() {
  return apiRequest('/api/v1/vishva/confidence-settings');
}

/**
 * Update confidence settings
 */
export async function updateConfidenceSettings(settings) {
  return apiRequest('/api/v1/vishva/confidence-settings', {
    method: 'POST',
    body: JSON.stringify(settings),
  });
}
