/**
 * Analysis Results Component
 * ==========================
 * 
 * Main container for displaying all analysis results
 */

import { useState, useEffect } from 'react';
import KPISummary from './KPISummary';
import InsightCards from './InsightCards';
import DataProfile from './DataProfile';
import FactorAnalysis from './FactorAnalysis';
import ExportButtons from './ExportButtons';
import TrainingManager from './TrainingManager';
import { saveTrainingExample, deleteTrainingExamplesForDataset, listTrainingExamples } from '../api';

const tabs = [
  { id: 'overview', label: 'Overview', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id: 'insights', label: 'Insights', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
  { id: 'profile', label: 'Data Profile', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { id: 'factors', label: 'Factor Analysis', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01' },
  { id: 'training', label: 'Training', icon: 'M3 7h18M3 12h18M3 17h18' },
];

function AnalysisResults({ results, onReanalyze }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [savingTraining, setSavingTraining] = useState(false);
  const [trainingStatus, setTrainingStatus] = useState(null);
  const [hasTrainingForDataset, setHasTrainingForDataset] = useState(false);

  // Column override state
  const [measureOverride, setMeasureOverride] = useState('');
  const [timeOverride, setTimeOverride] = useState('');

  if (!results) return null;

  const datasetId = results.dataset_name || '';
  const semantic = results.semantic || {};
  const numericCols = semantic.numeric_cols || [];
  const datetimeCols = semantic.datetime_cols || [];

  // Current selected values from backend
  const selected = results.insights?.selected || {};
  const currentMeasure = selected.measure || '';
  const currentTime = selected.time || '';

  useEffect(() => {
    let mounted = true;
    async function checkTraining() {
      try {
        const data = await listTrainingExamples();
        const items = data?.items || [];
        const exists = items.some((ex) => String(ex.dataset_id) === String(datasetId));
        if (mounted) setHasTrainingForDataset(exists);
      } catch {
        if (mounted) setHasTrainingForDataset(false);
      }
    }

    if (datasetId) {
      checkTraining();
    } else {
      setHasTrainingForDataset(false);
    }

    return () => {
      mounted = false;
    };
  }, [datasetId]);

  async function handleSaveTraining() {
    if (!results) return;
    setSavingTraining(true);
    setTrainingStatus(null);
    try {
      const pack = results.ml_recommendation?.pack || 'POS_RESTAURANT';
      const columns = results.all_columns || [];
      const features = results.ml_features || {};
      const roles = results.role_inference || {};
      const cards = (results.insights?.cards || [])
        .map((c) => c.id)
        .filter(Boolean);

      await saveTrainingExample({
        dataset_id: datasetId,
        pack,
        columns,
        features,
        roles,
        cards,
      });

      setTrainingStatus('saved');
      setHasTrainingForDataset(true);
    } catch (err) {
      setTrainingStatus('error');
      // eslint-disable-next-line no-console
      console.error('Failed to save training example', err);
    } finally {
      setSavingTraining(false);
    }
  }

  async function handleDeleteTraining() {
    if (!datasetId) return;
    setSavingTraining(true);
    setTrainingStatus(null);
    try {
      await deleteTrainingExamplesForDataset(datasetId);
      setHasTrainingForDataset(false);
      setTrainingStatus('deleted');
    } catch (err) {
      setTrainingStatus('error');
      // eslint-disable-next-line no-console
      console.error('Failed to delete training examples', err);
    } finally {
      setSavingTraining(false);
    }
  }

  function handleApplyOverrides() {
    if (onReanalyze) {
      onReanalyze({
        measure_col: measureOverride || undefined,
        time_col: timeOverride || undefined,
      });
    }
  }

  function handleRoleChange(role, newCol) {
    // Map role names to override keys
    const roleToOverride = {
      REVENUE: 'measure_col',
      DATE: 'time_col',
      DATETIME: 'time_col',
    };
    const overrideKey = roleToOverride[role];
    if (overrideKey && onReanalyze) {
      onReanalyze({ [overrideKey]: newCol || undefined });
    }
  }

  return (
    <div className="space-y-6">
      {/* Dataset Info Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{results.dataset_name || 'Dataset'}</h2>
                <p className="text-sm text-gray-500">
                  {results.profile?.rows?.toLocaleString() || 0} rows × {results.profile?.cols || 0} columns
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ExportButtons />
            <div className="border-l border-gray-200 h-8" />
            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                onClick={handleSaveTraining}
                disabled={savingTraining}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg border border-orange-500 text-orange-600 hover:bg-orange-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-500" />
                {savingTraining ? 'Saving training example…' : 'Save as ML training example'}
              </button>
              {hasTrainingForDataset && (
                <button
                  type="button"
                  onClick={handleDeleteTraining}
                  disabled={savingTraining}
                  className="text-[11px] text-gray-500 hover:text-red-500 underline-offset-2 hover:underline"
                >
                  Remove this dataset from training set
                </button>
              )}
              {trainingStatus === 'saved' && (
                <span className="text-[11px] text-emerald-600">Training example saved</span>
              )}
              {trainingStatus === 'deleted' && (
                <span className="text-[11px] text-gray-600">Training examples removed</span>
              )}
              {trainingStatus === 'error' && (
                <span className="text-[11px] text-red-600">Could not update training set</span>
              )}
            </div>
          </div>
        </div>

        {/* Measure / Time Override Selectors */}
        {onReanalyze && (numericCols.length > 0 || datetimeCols.length > 0) && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2">Change the main KPI measure or time column:</p>
            <div className="flex flex-wrap items-end gap-3">
              {numericCols.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Measure</label>
                  <select
                    value={measureOverride}
                    onChange={(e) => setMeasureOverride(e.target.value)}
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 pr-8 bg-white"
                  >
                    <option value="">{currentMeasure ? `${currentMeasure} (auto)` : '— Auto —'}</option>
                    {numericCols.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}
              {datetimeCols.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Time</label>
                  <select
                    value={timeOverride}
                    onChange={(e) => setTimeOverride(e.target.value)}
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 pr-8 bg-white"
                  >
                    <option value="">{currentTime ? `${currentTime} (auto)` : '— Auto —'}</option>
                    {datetimeCols.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}
              <button
                type="button"
                onClick={handleApplyOverrides}
                disabled={!measureOverride && !timeOverride}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Re-analyze
              </button>
            </div>
          </div>
        )}

        {/* Warnings */}
        {results.ui_warnings && results.ui_warnings.length > 0 && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="text-sm text-amber-800">
                {results.ui_warnings.map((warning, i) => (
                  <p key={i}>{warning}</p>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <KPISummary results={results} />
              <InsightCards results={results} limit={4} />
            </div>
          )}

          {activeTab === 'insights' && (
            <InsightCards results={results} />
          )}

          {activeTab === 'profile' && (
            <DataProfile results={results} onRoleChange={handleRoleChange} />
          )}

          {activeTab === 'factors' && (
            <FactorAnalysis results={results} />
          )}

          {activeTab === 'training' && (
            <TrainingManager currentDatasetId={datasetId} />
          )}
        </div>
      </div>
    </div>
  );
}

export default AnalysisResults;
