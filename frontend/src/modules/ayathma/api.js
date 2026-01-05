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

export default {
  analyzeDataset,
  downloadResults,
  pingModule,
};
