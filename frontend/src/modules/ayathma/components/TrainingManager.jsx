import { useEffect, useState } from 'react';
import { listTrainingExamples, deleteTrainingExamplesForDataset, retrainKpiRecommender } from '../api';

function TrainingManager({ currentDatasetId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [trainingStatus, setTrainingStatus] = useState(null);
  const [trainingSummary, setTrainingSummary] = useState(null);

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
    return () => {
      mounted = false;
    };
  }, []);

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
