/**
 * Ayathma Module - KPI Analysis Dashboard
 * ========================================
 * 
 * OWNER: Ayathma
 * 
 * A comprehensive KPI extraction and analysis tool that:
 * - Uploads CSV/Excel datasets
 * - Automatically extracts smart KPIs
 * - Provides insights with visualizations
 * - Allows data export
 */

import { useState, useRef } from 'react';
import FileUpload from './components/FileUpload';
import AnalysisResults from './components/AnalysisResults';
import LoadingSpinner from './components/LoadingSpinner';
import { analyzeDataset } from './api';

function AyathmaPage() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Keep a reference to the uploaded file so we can re-analyze with different overrides
  const uploadedFileRef = useRef(null);

  // Minimum loading time (ms) to make analysis feel more substantial
  const MIN_LOADING_TIME = 10000;

  const handleFileUpload = async (file, overrides) => {
    setLoading(true);
    setError(null);
    setResults(null);
    uploadedFileRef.current = file;

    const startTime = Date.now();

    try {
      const data = await analyzeDataset(file, overrides);
      
      // Ensure minimum loading time for better UX
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_LOADING_TIME) {
        await new Promise((resolve) => setTimeout(resolve, MIN_LOADING_TIME - elapsed));
      }
      
      setResults(data.results);
    } catch (err) {
      setError(err.message || 'Failed to analyze dataset');
    } finally {
      setLoading(false);
    }
  };

  // Re-analyze the same file with new column overrides
  const handleReanalyze = async (overrides) => {
    if (!uploadedFileRef.current) return;
    setLoading(true);
    setError(null);

    const startTime = Date.now();

    try {
      const data = await analyzeDataset(uploadedFileRef.current, overrides);
      
      // Ensure minimum loading time for better UX
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_LOADING_TIME) {
        await new Promise((resolve) => setTimeout(resolve, MIN_LOADING_TIME - elapsed));
      }
      
      setResults(data.results);
    } catch (err) {
      setError(err.message || 'Failed to re-analyze dataset');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResults(null);
    setError(null);
    uploadedFileRef.current = null;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center text-white shadow-lg">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Smart KPI Analyzer</h1>
                <p className="text-sm text-gray-500">AI-powered KPI extraction from your datasets</p>
              </div>
            </div>
            {results && (
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                New Analysis
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="font-medium text-red-800">Analysis Failed</h3>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && <LoadingSpinner />}

        {/* Upload Section (shown when no results) */}
        {!loading && !results && (
          <FileUpload onUpload={handleFileUpload} />
        )}

        {/* Results Section */}
        {!loading && results && (
          <AnalysisResults results={results} onReanalyze={handleReanalyze} />
        )}
      </main>
    </div>
  );
}

export default AyathmaPage;
