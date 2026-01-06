/**
 * Anomaly Detection Component
 * ===========================
 * 
 * Displays detected anomalies with severity and details
 */

import { useState, useEffect } from 'react';
import { detectAnomalies } from '../api';

function AnomalyDetection({ datasetName }) {
  const [anomalies, setAnomalies] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchAnomalies() {
      setLoading(true);
      setError(null);
      try {
        const data = await detectAnomalies();
        setAnomalies(data);
      } catch (err) {
        setError(err.message || 'Failed to detect anomalies');
      } finally {
        setLoading(false);
      }
    }
    fetchAnomalies();
  }, [datasetName]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6 animate-spin text-orange-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-gray-600">Detecting anomalies...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 rounded-xl border border-red-200 p-6">
        <div className="flex items-center gap-2 text-red-800">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">{error}</span>
        </div>
      </div>
    );
  }

  if (!anomalies) return null;

  const {
    anomaly_score = 100,
    total_anomalies = 0,
    severity_counts = {},
    type_counts = {},
    anomalies: anomalyList = [],
    has_critical = false,
    has_high = false,
  } = anomalies;

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'outlier':
        return 'M13 10V3L4 14h7v7l9-11h-7z';
      case 'spike':
        return 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6';
      case 'drop':
        return 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6';
      case 'trend_break':
        return 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z';
      case 'pattern':
        return 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z';
      case 'rare':
        return 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
      default:
        return 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z';
    }
  };

  const scoreColor = anomaly_score >= 80 ? 'text-emerald-600' : (anomaly_score >= 50 ? 'text-yellow-600' : 'text-red-600');

  return (
    <div className="space-y-6">
      {/* Score Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-1">Anomaly Detection</h3>
            <p className="text-sm text-gray-500">
              Automated detection of outliers, spikes, and unusual patterns
            </p>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-bold ${scoreColor}`}>{anomaly_score}</div>
            <div className="text-sm text-gray-500">Health Score</div>
            <div className="text-xs text-gray-400">(100 = no anomalies)</div>
          </div>
        </div>

        {/* Alert Banner */}
        {(has_critical || has_high) && (
          <div className={`mt-4 p-3 rounded-lg ${has_critical ? 'bg-red-50 border border-red-200' : 'bg-orange-50 border border-orange-200'}`}>
            <div className="flex items-center gap-2">
              <svg className={`w-5 h-5 ${has_critical ? 'text-red-600' : 'text-orange-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className={`font-medium ${has_critical ? 'text-red-800' : 'text-orange-800'}`}>
                {has_critical ? 'Critical anomalies detected!' : 'High-severity anomalies found'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-gray-800">{total_anomalies}</div>
          <div className="text-xs text-gray-500">Total Anomalies</div>
        </div>
        <div className="bg-red-50 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-red-600">
            {(severity_counts.critical || 0) + (severity_counts.high || 0)}
          </div>
          <div className="text-xs text-gray-500">Critical/High</div>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-yellow-600">{severity_counts.medium || 0}</div>
          <div className="text-xs text-gray-500">Medium</div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-blue-600">{severity_counts.low || 0}</div>
          <div className="text-xs text-gray-500">Low</div>
        </div>
      </div>

      {/* Anomaly Type Breakdown */}
      {Object.keys(type_counts).some(k => type_counts[k] > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-800 mb-4">Anomaly Types</h4>
          <div className="flex flex-wrap gap-3">
            {Object.entries(type_counts).map(([type, count]) => count > 0 && (
              <div key={type} className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getTypeIcon(type)} />
                </svg>
                <span className="text-sm font-medium text-gray-700 capitalize">{type.replace('_', ' ')}</span>
                <span className="text-sm bg-gray-200 rounded-full px-2 py-0.5">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Anomaly List */}
      {anomalyList.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-800 mb-4">Detected Anomalies</h4>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {anomalyList.map((anomaly, i) => (
              <div 
                key={i} 
                className={`border rounded-lg p-4 ${getSeverityColor(anomaly.severity)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getTypeIcon(anomaly.anomaly_type)} />
                    </svg>
                    <div>
                      <div className="font-medium">{anomaly.description}</div>
                      <div className="text-sm opacity-75 mt-1">
                        Column: <span className="font-mono">{anomaly.column}</span>
                        {anomaly.affected_rows > 0 && (
                          <span className="ml-3">
                            Affected: {anomaly.affected_rows.toLocaleString()} rows ({anomaly.affected_pct}%)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full uppercase ${
                    anomaly.severity === 'critical' || anomaly.severity === 'high' 
                      ? 'bg-red-200 text-red-800' 
                      : anomaly.severity === 'medium'
                      ? 'bg-yellow-200 text-yellow-800'
                      : 'bg-blue-200 text-blue-800'
                  }`}>
                    {anomaly.severity}
                  </span>
                </div>

                {/* Details */}
                {anomaly.details && Object.keys(anomaly.details).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-current opacity-30">
                    <div className="text-xs opacity-75 space-x-4">
                      {anomaly.details.z_score && (
                        <span>Z-score: {anomaly.details.z_score}</span>
                      )}
                      {anomaly.details.expected_value && (
                        <span>Expected: {anomaly.details.expected_value.toLocaleString()}</span>
                      )}
                      {anomaly.details.actual_value && (
                        <span>Actual: {anomaly.details.actual_value.toLocaleString()}</span>
                      )}
                      {anomaly.details.change_pct && (
                        <span>Change: {anomaly.details.change_pct > 0 ? '+' : ''}{anomaly.details.change_pct}%</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Anomalies Message */}
      {total_anomalies === 0 && (
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-8 text-center">
          <svg className="w-12 h-12 text-emerald-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h4 className="text-lg font-semibold text-emerald-800">No Anomalies Detected</h4>
          <p className="text-sm text-emerald-600 mt-1">Your data looks clean and consistent!</p>
        </div>
      )}
    </div>
  );
}

export default AnomalyDetection;
