import { useEffect, useState } from 'react';
import { listTrainingExamples, deleteTrainingExamplesForDataset, retrainKpiRecommender, getModelMetrics } from '../api';

function TrainingManager({ currentDatasetId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [trainingStatus, setTrainingStatus] = useState(null);
  const [trainingSummary, setTrainingSummary] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [showDetailedMetrics, setShowDetailedMetrics] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await listTrainingExamples();
        if (!mounted) return;
        setItems(data?.items || []);
      } catch (err) {
        if (!mounted) return;
        setError('Could not load training datasets');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    loadMetrics();
    
    return () => {
      mounted = false;
    };
  }, []);

  async function loadMetrics() {
    setLoadingMetrics(true);
    try {
      const res = await getModelMetrics();
      if (res?.ok) {
        setMetrics(res.metrics);
      }
    } catch (err) {
      // Metrics may not exist yet, that's ok
    } finally {
      setLoadingMetrics(false);
    }
  }

  async function handleDelete(datasetId) {
    setBusyId(datasetId);
    setError(null);
    setTrainingStatus(null);
    setTrainingSummary(null);
    try {
      await deleteTrainingExamplesForDataset(datasetId);
      setItems((prev) => prev.filter((ex) => String(ex.dataset_id) !== String(datasetId)));
    } catch (err) {
      setError('Failed to remove training dataset');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRetrain() {
    setError(null);
    setTrainingStatus('running');
    setTrainingSummary(null);
    try {
      const res = await retrainKpiRecommender();
      if (!res?.ok) {
        throw new Error(res?.error || 'Training failed');
      }
      setTrainingStatus('ok');
      setTrainingSummary(res.summary || null);
      // Reload metrics after successful training
      if (res.summary?.metrics) {
        setMetrics(res.summary.metrics);
      } else {
        await loadMetrics();
      }
    } catch (err) {
      setTrainingStatus('error');
      setError(err.message || 'Model training failed');
    }
  }

  // Compute pack distribution
  const packCounts = {};
  items.forEach((ex) => {
    const p = ex.pack || 'Unknown';
    packCounts[p] = (packCounts[p] || 0) + 1;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Training datasets</h3>
          <p className="text-sm text-gray-500">
            These datasets are used to train the KPI recommender. You can remove any that are no longer relevant.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRetrain}
            disabled={items.length === 0 || trainingStatus === 'running'}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {trainingStatus === 'running' ? 'Training model…' : 'Retrain KPI model'}
          </button>
        </div>
      </div>

      {/* Training stats summary */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
            <span className="text-indigo-700 font-medium">{items.length}</span>
            <span className="text-indigo-600 ml-1">training examples</span>
          </div>
          {Object.entries(packCounts).map(([pack, count]) => (
            <div key={pack} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <span className="text-gray-700 font-medium">{count}</span>
              <span className="text-gray-500 ml-1">{pack}</span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      {trainingStatus === 'ok' && !error && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-3 py-2">
          <p className="font-medium">KPI recommender model retrained successfully.</p>
          {trainingSummary && (
            <p className="text-xs mt-1 text-emerald-600">
              Trained on {trainingSummary.n_examples} examples with {trainingSummary.n_cards} card labels.
            </p>
          )}
        </div>
      )}

      {/* Model Metrics Section */}
      {metrics && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Model Performance Metrics
            </h4>
            <span className="text-xs text-gray-500">
              Last trained: {metrics.trained_at ? new Date(metrics.trained_at).toLocaleString() : 'Unknown'}
            </span>
          </div>

          {/* Overview Cards */}
          <div className="grid grid-cols-2 gap-4">
            {/* Pack Classifier Metrics */}
            {metrics.pack_classifier && !metrics.pack_classifier.note && (
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
                <h5 className="text-xs font-medium text-blue-800 mb-2">📦 Pack Classifier</h5>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-blue-600">Accuracy:</span>
                    <span className="ml-1 font-semibold text-blue-900">{(metrics.pack_classifier.accuracy * 100).toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-blue-600">Precision:</span>
                    <span className="ml-1 font-semibold text-blue-900">{(metrics.pack_classifier.precision * 100).toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-blue-600">Recall:</span>
                    <span className="ml-1 font-semibold text-blue-900">{(metrics.pack_classifier.recall * 100).toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-blue-600">F1 Score:</span>
                    <span className="ml-1 font-semibold text-blue-900">{(metrics.pack_classifier.f1 * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Cards Classifier Metrics */}
            {metrics.cards_classifier && !metrics.cards_classifier.note && (
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200">
                <h5 className="text-xs font-medium text-purple-800 mb-2">🎴 Card Recommender</h5>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-purple-600">Accuracy:</span>
                    <span className="ml-1 font-semibold text-purple-900">{(metrics.cards_classifier.accuracy * 100).toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-purple-600">Precision:</span>
                    <span className="ml-1 font-semibold text-purple-900">{(metrics.cards_classifier.precision * 100).toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-purple-600">Recall:</span>
                    <span className="ml-1 font-semibold text-purple-900">{(metrics.cards_classifier.recall * 100).toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-purple-600">F1 Score:</span>
                    <span className="ml-1 font-semibold text-purple-900">{(metrics.cards_classifier.f1 * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Detailed Per-Class Metrics */}
          {metrics.per_class_metrics && metrics.per_class_metrics.length > 0 && (
            <div>
              <button
                onClick={() => setShowDetailedMetrics(!showDetailedMetrics)}
                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <svg 
                  className={`w-3 h-3 transition-transform ${showDetailedMetrics ? 'rotate-90' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                {showDetailedMetrics ? 'Hide' : 'Show'} per-class breakdown ({metrics.per_class_metrics.length} labels)
              </button>
              
              {showDetailedMetrics && (
                <div className="mt-2 overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left py-1 px-2 font-medium text-gray-600">Card Label</th>
                        <th className="text-right py-1 px-2 font-medium text-gray-600">Precision</th>
                        <th className="text-right py-1 px-2 font-medium text-gray-600">Recall</th>
                        <th className="text-right py-1 px-2 font-medium text-gray-600">F1</th>
                        <th className="text-right py-1 px-2 font-medium text-gray-600">Support</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.per_class_metrics.map((cls, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="py-1 px-2 text-gray-900 font-mono">{cls.label}</td>
                          <td className="py-1 px-2 text-right text-gray-700">{(cls.precision * 100).toFixed(1)}%</td>
                          <td className="py-1 px-2 text-right text-gray-700">{(cls.recall * 100).toFixed(1)}%</td>
                          <td className="py-1 px-2 text-right text-gray-700">{(cls.f1 * 100).toFixed(1)}%</td>
                          <td className="py-1 px-2 text-right text-gray-500">{cls.support}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Not enough data notice */}
          {(metrics.pack_classifier?.note || metrics.cards_classifier?.note) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs text-yellow-700">
              ⚠️ {metrics.pack_classifier?.note || metrics.cards_classifier?.note}
            </div>
          )}

          <p className="text-xs text-gray-500 italic">
            💡 Metrics are calculated on a 20% held-out test set. Add more training data to improve accuracy.
          </p>
        </div>
      )}

      {loadingMetrics && !metrics && (
        <div className="text-xs text-gray-500">Loading model metrics...</div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500">Loading training datasets…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-gray-500">No training datasets saved yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-2 px-3 font-medium text-gray-600">Dataset ID</th>
                <th className="text-left py-2 px-3 font-medium text-gray-600">Pack</th>
                <th className="text-left py-2 px-3 font-medium text-gray-600">Cards</th>
                <th className="text-left py-2 px-3 font-medium text-gray-600">Saved At</th>
                <th className="py-2 px-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((ex, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 px-3 text-gray-900">
                    <span className={String(ex.dataset_id) === String(currentDatasetId) ? 'font-semibold' : ''}>
                      {ex.dataset_id}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-gray-700">{ex.pack || '—'}</td>
                  <td className="py-2 px-3 text-gray-700">{Array.isArray(ex.cards) ? ex.cards.length : 0}</td>
                  <td className="py-2 px-3 text-gray-500 text-xs">{ex.saved_at || '—'}</td>
                  <td className="py-2 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(ex.dataset_id)}
                      disabled={busyId === ex.dataset_id}
                      className="text-xs text-red-600 hover:text-red-700 disabled:opacity-60 disabled:cursor-not-allowed underline-offset-2 hover:underline"
                    >
                      {busyId === ex.dataset_id ? 'Removing…' : 'Remove'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default TrainingManager;
