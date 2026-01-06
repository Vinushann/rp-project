/**
 * Ayathma Module API Functions
 * ============================
 * 
 * API integration for the KPI Analysis module
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Analyze a dataset file
 * @param {File} file - CSV or Excel file to analyze
 * @param {Object} overrides - Optional column overrides
 * @returns {Promise<{ok: boolean, results: Object}>}
 */
export async function analyzeDataset(file, overrides = {}) {
  const formData = new FormData();
  formData.append('file', file);

  // Add overrides if provided
  if (overrides.measure_col) {
    formData.append('measure_col', overrides.measure_col);
  }
  if (overrides.dimension_col) {
    formData.append('dimension_col', overrides.dimension_col);
  }
  if (overrides.time_col) {
    formData.append('time_col', overrides.time_col);
  }

  const response = await fetch(`${API_BASE_URL}/api/v1/ayathma/analyze`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `Analysis failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Download analysis results in specified format
 * @param {string} format - 'json', 'csv', or 'report'
 * @returns {Promise<Blob>}
 */
export async function downloadResults(format) {
  const response = await fetch(`${API_BASE_URL}/api/v1/ayathma/download/${format}`);

  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`);
  }

  return response.blob();
}

// --- ML training endpoints ---

export async function saveTrainingExample(payload) {
  const res = await fetch(`${API_BASE_URL}/api/v1/ayathma/training/examples`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to save training example');
  }
  return res.json();
}

export async function listTrainingExamples() {
  const res = await fetch(`${API_BASE_URL}/api/v1/ayathma/training/examples`);
  if (!res.ok) throw new Error('Failed to load training examples');
  return res.json();
}

export async function deleteTrainingExamplesForDataset(datasetId) {
  const res = await fetch(`${API_BASE_URL}/api/v1/ayathma/training/examples/${encodeURIComponent(datasetId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete training examples');
  return res.json();
}

export async function retrainKpiRecommender() {
  const res = await fetch(`${API_BASE_URL}/api/v1/ayathma/training/retrain`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Model training failed');
  }
  return res.json();
}

/**
 * Ping the Ayathma module to check if it's running
 * @returns {Promise<{module: string, status: string}>}
 */
export async function pingModule() {
  const response = await fetch(`${API_BASE_URL}/api/v1/ayathma/ping`);

  if (!response.ok) {
    throw new Error(`Ping failed: ${response.status}`);
  }

  return response.json();
}

// --- Data Quality endpoint ---

/**
 * Analyze data quality of the currently loaded dataset
 * @returns {Promise<Object>}
 */
export async function analyzeDataQuality() {
  const response = await fetch(`${API_BASE_URL}/api/v1/ayathma/quality`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || error.error || `Quality analysis failed: ${response.status}`);
  }

  return response.json();
}

// --- Anomaly Detection endpoint ---

/**
 * Detect anomalies in the currently loaded dataset
 * @returns {Promise<Object>}
 */
export async function detectAnomalies() {
  const response = await fetch(`${API_BASE_URL}/api/v1/ayathma/anomalies`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || error.error || `Anomaly detection failed: ${response.status}`);
  }

  return response.json();
}

// --- Comparative Analysis endpoints ---

/**
 * Automatically compare recent period to previous period
 * @returns {Promise<Object>}
 */
export async function autoCompare() {
  const response = await fetch(`${API_BASE_URL}/api/v1/ayathma/compare/auto`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || error.error || `Comparison failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Compare two specific time periods
 * @param {File} file - CSV or Excel file
 * @param {Object} params - Period parameters
 * @returns {Promise<{ok: boolean, comparison: Object}>}
 */
export async function comparePeriods(file, params) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('time_col', params.time_col);
  formData.append('period_a_start', params.period_a_start);
  formData.append('period_a_end', params.period_a_end);
  formData.append('period_b_start', params.period_b_start);
  formData.append('period_b_end', params.period_b_end);

  const response = await fetch(`${API_BASE_URL}/api/v1/ayathma/compare/periods`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `Period comparison failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Compare two segments
 * @param {File} file - CSV or Excel file
 * @param {Object} params - Segment parameters
 * @returns {Promise<{ok: boolean, comparison: Object}>}
 */
export async function compareSegments(file, params) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('segment_col', params.segment_col);
  formData.append('segment_a', params.segment_a);
  formData.append('segment_b', params.segment_b);

  const response = await fetch(`${API_BASE_URL}/api/v1/ayathma/compare/segments`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `Segment comparison failed: ${response.status}`);
  }

  return response.json();
}

// --- Chart Data endpoints ---

/**
 * Get heatmap data for day/hour analysis
 * @param {File} file - CSV or Excel file
 * @param {Object} options - time_col and value_col
 * @returns {Promise<{ok: boolean, heatmap: Object}>}
 */
export async function getHeatmapData(file, options = {}) {
  const formData = new FormData();
  formData.append('file', file);
  if (options.time_col) formData.append('time_col', options.time_col);
  if (options.value_col) formData.append('value_col', options.value_col);

  const response = await fetch(`${API_BASE_URL}/api/v1/ayathma/charts/heatmap`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `Heatmap generation failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Get scatter plot data
 * @param {File} file - CSV or Excel file
 * @param {Object} params - x_col, y_col, color_col
 * @returns {Promise<{ok: boolean, scatter: Object}>}
 */
export async function getScatterData(file, params) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('x_col', params.x_col);
  formData.append('y_col', params.y_col);
  if (params.color_col) formData.append('color_col', params.color_col);

  const response = await fetch(`${API_BASE_URL}/api/v1/ayathma/charts/scatter`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `Scatter plot generation failed: ${response.status}`);
  }

  return response.json();
}

// --- PDF Export ---

/**
 * Download PDF report
 * @returns {Promise<Blob>}
 */
export async function downloadPdfReport() {
  const response = await fetch(`${API_BASE_URL}/api/v1/ayathma/export/pdf`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'PDF export failed' }));
    throw new Error(error.error || error.detail || `PDF export failed: ${response.status}`);
  }

  return response.blob();
}

export default {
  analyzeDataset,
  downloadResults,
  pingModule,
  analyzeDataQuality,
  detectAnomalies,
  autoCompare,
  comparePeriods,
  compareSegments,
  getHeatmapData,
  getScatterData,
  downloadPdfReport,
};
