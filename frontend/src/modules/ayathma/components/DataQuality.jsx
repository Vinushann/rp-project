/**
 * Data Quality Component
 * ======================
 * 
 * Displays data quality assessment with scores and issues
 */

import { useState, useEffect } from 'react';
import { analyzeDataQuality } from '../api';

function DataQuality({ datasetName }) {
  const [quality, setQuality] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchQuality() {
      setLoading(true);
      setError(null);
      try {
        const data = await analyzeDataQuality();
        setQuality(data);
      } catch (err) {
        setError(err.message || 'Failed to analyze data quality');
      } finally {
        setLoading(false);
      }
    }
    fetchQuality();
  }, [datasetName]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6 animate-spin text-orange-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-gray-600">Analyzing data quality...</span>
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

  if (!quality) return null;

  const {
    overall_score = 0,
    grade = 'N/A',
    grade_label = '',
    completeness_score = 0,
    validity_score = 0,
    uniqueness_score = 0,
    consistency_score = 0,
    total_rows = 0,
    total_columns = 0,
    total_missing = 0,
    missing_pct = 0,
    duplicate_rows = 0,
    duplicate_pct = 0,
    issues = [],
    recommendations = [],
  } = quality;

  const gradeColors = {
    A: 'from-emerald-500 to-green-500',
    B: 'from-lime-500 to-green-400',
    C: 'from-yellow-500 to-amber-400',
    D: 'from-orange-500 to-amber-500',
    F: 'from-red-500 to-rose-500',
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'high':
      case 'critical':
        return '🔴';
      case 'medium':
        return '🟡';
      default:
        return '🟢';
    }
  };

  return (
    <div className="space-y-6">
      {/* Overall Score Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-1">Data Quality Score</h3>
            <p className="text-sm text-gray-500">
              Based on completeness, validity, uniqueness, and consistency
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${gradeColors[grade] || 'from-gray-400 to-gray-500'} flex items-center justify-center text-white`}>
              <div className="text-center">
                <div className="text-3xl font-bold">{grade}</div>
                <div className="text-xs opacity-80">{grade_label}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-gray-800">{overall_score.toFixed(0)}</div>
              <div className="text-sm text-gray-500">out of 100</div>
            </div>
          </div>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ScoreCard 
          label="Completeness" 
          score={completeness_score} 
          description="Missing values"
          icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
        <ScoreCard 
          label="Validity" 
          score={validity_score} 
          description="Data type correctness"
          icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
        <ScoreCard 
          label="Uniqueness" 
          score={uniqueness_score} 
          description="Duplicate detection"
          icon="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
        />
        <ScoreCard 
          label="Consistency" 
          score={consistency_score} 
          description="Value range checks"
          icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </div>

      {/* Quick Stats */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-800">{total_rows.toLocaleString()}</div>
            <div className="text-xs text-gray-500">Total Rows</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-800">{total_columns}</div>
            <div className="text-xs text-gray-500">Total Columns</div>
          </div>
          <div>
            <div className={`text-2xl font-bold ${missing_pct > 10 ? 'text-red-600' : 'text-gray-800'}`}>
              {missing_pct.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500">Missing Values</div>
          </div>
          <div>
            <div className={`text-2xl font-bold ${duplicate_pct > 5 ? 'text-red-600' : 'text-gray-800'}`}>
              {duplicate_rows.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">Duplicate Rows</div>
          </div>
        </div>
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-800 mb-4">Issues Detected ({issues.length})</h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {issues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span>{getSeverityIcon(issue.severity)}</span>
                <div>
                  <span className="text-gray-700">{issue.message}</span>
                  {issue.column && (
                    <span className="ml-2 text-xs text-gray-400 font-mono">({issue.column})</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
          <h4 className="font-semibold text-blue-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Recommendations
          </h4>
          <ul className="space-y-2">
            {recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-blue-700">
                <span className="text-blue-400">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ScoreCard({ label, score, description, icon }) {
  const getColor = (s) => {
    if (s >= 80) return { bg: 'bg-emerald-50', text: 'text-emerald-600', bar: 'bg-emerald-500' };
    if (s >= 60) return { bg: 'bg-yellow-50', text: 'text-yellow-600', bar: 'bg-yellow-500' };
    return { bg: 'bg-red-50', text: 'text-red-600', bar: 'bg-red-500' };
  };

  const colors = getColor(score);

  return (
    <div className={`${colors.bg} rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <svg className={`w-5 h-5 ${colors.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
        </svg>
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${colors.text}`}>{score.toFixed(0)}</div>
      <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${colors.bar} rounded-full`} style={{ width: `${score}%` }} />
      </div>
      <div className="text-xs text-gray-500 mt-1">{description}</div>
    </div>
  );
}

export default DataQuality;
