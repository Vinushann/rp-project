/**
 * Comparative Analysis Component
 * ==============================
 * 
 * Displays period-over-period comparisons within the same dataset
 * (e.g., this month vs last month, this week vs last week)
 */

import { useState, useEffect } from 'react';
import { autoCompare } from '../api';

function ComparativeAnalysis({ datasetName }) {
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchComparison() {
      setLoading(true);
      setError(null);
      try {
        const data = await autoCompare();
        setComparison(data);
      } catch (err) {
        setError(err.message || 'Failed to run comparison analysis');
      } finally {
        setLoading(false);
      }
    }
    fetchComparison();
  }, [datasetName]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6 animate-spin text-orange-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-gray-600">Running comparison analysis...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Period-over-Period Comparison</h3>
          <p className="text-sm text-gray-500 mb-4">
            This feature compares different time periods <strong>within your dataset</strong> (e.g., this month vs last month).
          </p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-6">
          <div className="flex items-center gap-2 text-red-800">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">{error}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!comparison) return null;

  const {
    comparison_type = 'period',
    period_a_label = 'Period A',
    period_b_label = 'Period B',
    period_a_rows = 0,
    period_b_rows = 0,
    metrics = [],
    summary = {},
    insights = [],
    error: comparisonError,
  } = comparison;

  // Show helpful message when no comparison could be made
  if (comparisonError || (metrics.length === 0 && insights.length === 0)) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Period-over-Period Comparison</h3>
          <p className="text-sm text-gray-500 mb-4">
            This feature automatically compares different time periods <strong>within your dataset</strong>.
          </p>
          
          <div className="bg-blue-50 rounded-lg p-4 mb-4">
            <h4 className="font-medium text-blue-800 mb-2">How it works:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Compares recent period vs previous period (e.g., this month vs last month)</li>
              <li>• Analyzes changes in key metrics over time</li>
              <li>• Identifies significant increases or decreases</li>
            </ul>
          </div>

          <div className="bg-amber-50 rounded-lg p-4">
            <h4 className="font-medium text-amber-800 mb-2">Requirements:</h4>
            <ul className="text-sm text-amber-700 space-y-1">
              <li>• Your dataset needs a <strong>date/time column</strong></li>
              <li>• Data should span at least <strong>two time periods</strong> (e.g., 2+ months)</li>
              <li>• Numeric columns are needed for metric comparison</li>
            </ul>
          </div>
        </div>
        
        {comparisonError && (
          <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-6">
            <div className="flex items-center gap-2 text-yellow-800">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-medium">{comparisonError}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  const getDirectionIcon = (direction) => {
    if (direction === 'up') {
      return (
        <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      );
    } else if (direction === 'down') {
      return (
        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
      </svg>
    );
  };

  const getChangeColor = (pct) => {
    if (Math.abs(pct) < 1) return 'text-gray-500';
    return pct > 0 ? 'text-emerald-600' : 'text-red-600';
  };

  const getSignificanceBadge = (sig) => {
    if (sig === 'significant') {
      return <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Significant</span>;
    } else if (sig === 'marginal') {
      return <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Marginal</span>;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          {comparison_type === 'period' ? 'Period Comparison' : 'Segment Comparison'}
        </h3>
        
        <div className="flex items-center justify-between mt-4">
          <div className="flex-1 text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-500 mb-1">{comparison_type === 'segment' ? 'Segment A' : 'Period A'}</div>
            <div className="font-semibold text-gray-800">{period_a_label}</div>
            <div className="text-xs text-gray-400 mt-1">{period_a_rows.toLocaleString()} rows</div>
          </div>
          
          <div className="px-4">
            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          
          <div className="flex-1 text-center p-4 bg-orange-50 rounded-lg">
            <div className="text-sm text-orange-600 mb-1">{comparison_type === 'segment' ? 'Segment B' : 'Period B'}</div>
            <div className="font-semibold text-gray-800">{period_b_label}</div>
            <div className="text-xs text-gray-400 mt-1">{period_b_rows.toLocaleString()} rows</div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-gray-800">{summary.total_metrics || 0}</div>
          <div className="text-xs text-gray-500">Metrics Compared</div>
        </div>
        <div className="bg-emerald-50 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-emerald-600">{summary.improved || summary.segment_b_higher || 0}</div>
          <div className="text-xs text-gray-500">Improved ↑</div>
        </div>
        <div className="bg-red-50 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-red-600">{summary.declined || summary.segment_a_higher || 0}</div>
          <div className="text-xs text-gray-500">Declined ↓</div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-blue-600">{summary.significant_changes || summary.significant_differences || 0}</div>
          <div className="text-xs text-gray-500">Statistically Significant</div>
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
          <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Key Insights
          </h4>
          <ul className="space-y-2">
            {insights.map((insight, i) => (
              <li key={i} className="text-sm text-blue-700">{insight}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Metrics Table */}
      {metrics.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Metric</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">{period_a_label}</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">{period_b_label}</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Change</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((metric, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <span className="font-medium text-gray-800">{metric.metric}</span>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-600 font-mono">
                      {formatValue(metric.period_a_value)}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-600 font-mono">
                      {formatValue(metric.period_b_value)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {getDirectionIcon(metric.direction)}
                        <span className={`font-medium ${getChangeColor(metric.pct_change)}`}>
                          {metric.pct_change > 0 ? '+' : ''}{metric.pct_change}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {getSignificanceBadge(metric.significance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No Data Message */}
      {metrics.length === 0 && !error && (
        <div className="bg-gray-50 rounded-xl p-8 text-center">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h4 className="text-lg font-semibold text-gray-600">No Comparison Data</h4>
          <p className="text-sm text-gray-500 mt-1">Run a comparison to see results</p>
        </div>
      )}
    </div>
  );
}

function formatValue(value) {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'number') {
    if (Math.abs(value) >= 1000000) {
      return (value / 1000000).toFixed(2) + 'M';
    } else if (Math.abs(value) >= 1000) {
      return (value / 1000).toFixed(2) + 'K';
    }
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(value);
}

export default ComparativeAnalysis;
