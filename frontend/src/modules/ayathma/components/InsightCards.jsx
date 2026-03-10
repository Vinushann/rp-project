/**
 * Insight Cards Component
 * =======================
 * 
 * Displays insight cards with appropriate charts based on data type:
 * - Line charts for time-series/trend data
 * - Bar charts for categorical comparisons
 * - SQL Query display with correction/training capability
 * - Vector-based similar example retrieval for SQL learning
 */

import React from 'react';
import { saveSqlCorrection, searchSimilarSql, sendKpiFeedback, generateCustomKpi } from '../api';

function InsightCards({ results, limit }) {
  const insights = results?.insights || {};
  const cards = insights.cards || [];
  const selected = insights.selected || {};
  const datasetName = results?.dataset_name;
  const allColumns = results?.all_columns || [];

  const displayCards = limit ? cards.slice(0, limit) : cards;

  if (displayCards.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-xl">
        <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <h4 className="text-gray-600 font-medium">No insights generated</h4>
        <p className="text-sm text-gray-400 mt-1">Try uploading a dataset with more data</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">
            Insights {limit && cards.length > limit && `(${limit} of ${cards.length})`}
          </h3>
          {/* Show selected measure/time context */}
          {(selected.measure || selected.time) && (
            <p className="text-xs text-gray-500 mt-1">
              {selected.measure && <span>Measure: <span className="font-medium">{selected.measure}</span></span>}
              {selected.measure && selected.time && <span className="mx-2">·</span>}
              {selected.time && <span>Time: <span className="font-medium">{selected.time}</span></span>}
            </p>
          )}
        </div>
        {limit && cards.length > limit && (
          <span className="text-sm text-orange-600">View all in Insights tab →</span>
        )}
      </div>
      <CustomKpiRequest datasetName={datasetName} allColumns={allColumns} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {displayCards.map((card, i) => (
          <InsightCard 
            key={i} 
            card={card} 
            index={i} 
            datasetName={results?.dataset_name}
            allColumns={results?.all_columns || []}
          />
        ))}
      </div>
    </div>
  );
}

function CustomKpiRequest({ datasetName, allColumns }) {
  const [text, setText] = React.useState('');
  const [status, setStatus] = React.useState(null); // 'saving' | 'saved' | 'error'

  const [generatedCard, setGeneratedCard] = React.useState(null);
  const [error, setError] = React.useState(null);

  if (!datasetName) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setStatus('saving');
    setError(null);
    setGeneratedCard(null);
    try {
      // Log preference for training
      await sendKpiFeedback({
        dataset_id: datasetName,
        kpi_id: null,
        card_id: 'free_text_request',
        prompt_text: value,
        liked: true,
        user_text: value,
      });
      // Ask backend to generate a KPI card for this text
      const resp = await generateCustomKpi({ kpi_text: value });
      console.log('KPI generation response:', resp);
      
      if (resp && resp.ok === false) {
        throw new Error(resp.error || 'Failed to generate KPI');
      }
      
      if (resp && resp.card) {
        setGeneratedCard(resp.card);
        setStatus('saved');
        setText('');
      } else {
        throw new Error('No card returned from API');
      }
      setTimeout(() => setStatus(null), 2500);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to send custom KPI request', err);
      setError(err.message || 'Failed to generate KPI');
      setStatus('error');
      setTimeout(() => {
        setStatus(null);
        setError(null);
      }, 4000);
    }
  };

  return (
    <div className="mb-4 space-y-3">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <div className="flex-1 flex items-center gap-2">
          <span className="text-xs text-gray-500 whitespace-nowrap">Ask for a KPI:</span>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g., Top 5 food items by sales"
            className="flex-1 text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
        <button
          type="submit"
          disabled={!text.trim() || status === 'saving'}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'saving' ? 'Sending…' : 'Generate KPI'}
        </button>
        {status === 'saved' && (
          <span className="text-[11px] text-emerald-600">Custom KPI generated</span>
        )}
        {status === 'error' && (
          <span className="text-[11px] text-red-600">{error || 'Could not generate KPI'}</span>
        )}
      </form>

      {generatedCard && (
        <div className="border border-dashed border-orange-300 rounded-xl p-3 bg-orange-50/40">
          <p className="text-xs font-medium text-orange-700 mb-2">
            Custom KPI result
          </p>
          <InsightCard
            card={generatedCard}
            index={-1}
            datasetName={datasetName}
            allColumns={allColumns || []}
          />
        </div>
      )}
    </div>
  );
}

function InsightCard({ card, index, datasetName, allColumns }) {
  const { title, why, table, chart, chart_data, sql_query, id: cardId } = card;
  const [showSql, setShowSql] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedSql, setEditedSql] = React.useState(sql_query || '');
  const [feedback, setFeedback] = React.useState('');
  const [saveStatus, setSaveStatus] = React.useState(null); // 'saving', 'saved', 'error'
  const [copied, setCopied] = React.useState(false);
  const [liked, setLiked] = React.useState(null); // true, false, or null
  const [sendingFeedback, setSendingFeedback] = React.useState(false);
  
  // Vector store - similar examples
  const [similarExamples, setSimilarExamples] = React.useState([]);
  const [loadingExamples, setLoadingExamples] = React.useState(false);
  const [showExamples, setShowExamples] = React.useState(false);
  
  // Determine chart type from backend (default to 'bar')
  const chartType = chart?.type || 'bar';

  const colors = [
    'border-l-blue-500',
    'border-l-green-500',
    'border-l-purple-500',
    'border-l-orange-500',
    'border-l-pink-500',
    'border-l-cyan-500',
  ];

  const bgColors = [
    'bg-blue-50',
    'bg-green-50',
    'bg-purple-50',
    'bg-orange-50',
    'bg-pink-50',
    'bg-cyan-50',
  ];

  const barColors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-cyan-500',
  ];

  const lineColors = [
    '#3B82F6', // blue
    '#10B981', // green
    '#8B5CF6', // purple
    '#F97316', // orange
    '#EC4899', // pink
    '#06B6D4', // cyan
  ];

  // Fetch similar examples when editing starts
  const fetchSimilarExamples = async () => {
    setLoadingExamples(true);
    try {
      const result = await searchSimilarSql({
        card_type: cardId || `card_${index}`,
        chart_type: chartType,
        intent: `Generate SQL for: ${title}`,
        columns: allColumns || [],
        top_k: 3,
      });
      
      if (result.ok && result.results?.length > 0) {
        setSimilarExamples(result.results);
      }
    } catch (error) {
      console.error('Failed to fetch similar examples:', error);
    } finally {
      setLoadingExamples(false);
    }
  };

  // Handle starting edit mode
  const handleStartEdit = () => {
    setIsEditing(true);
    fetchSimilarExamples();
  };

  // Apply a similar example's SQL
  const applySimilarExample = (sql) => {
    setEditedSql(sql);
  };

  // Handle saving SQL correction
  const handleSaveCorrection = async () => {
    if (!editedSql.trim() || editedSql === sql_query) {
      setIsEditing(false);
      return;
    }

    setSaveStatus('saving');
    try {
      await saveSqlCorrection({
        card_id: cardId || `card_${index}`,
        card_title: title,
        chart_type: chartType,
        x_column: chart?.x,
        y_column: chart?.y,
        original_sql: sql_query,
        corrected_sql: editedSql.trim(),
        dataset_name: datasetName || 'unknown',
        columns: allColumns,
        feedback: feedback.trim() || null,
      });
      setSaveStatus('saved');
      setIsEditing(false);
      setFeedback('');
      setSimilarExamples([]);
      // Reset status after 3 seconds
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      console.error('Failed to save SQL correction:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  // Handle copy to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(isEditing ? editedSql : sql_query);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditedSql(sql_query || '');
    setFeedback('');
    setIsEditing(false);
    setSimilarExamples([]);
    setShowExamples(false);
  };

  // Send simple like/dislike feedback for this KPI card
  const handleKpiFeedback = async (nextLiked) => {
    if (!datasetName) return;
    setSendingFeedback(true);
    try {
      await sendKpiFeedback({
        dataset_id: datasetName,
        kpi_id: cardId || `card_${index}`,
        card_id: cardId || `card_${index}`,
        prompt_text: title,
        liked: nextLiked,
      });
      setLiked(nextLiked);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to send KPI feedback', error);
    } finally {
      setSendingFeedback(false);
    }
  };

  const colorIndex = index % colors.length;

  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4 ${colors[colorIndex]} overflow-hidden`}>
      {/* Header */}
      <div className={`px-5 py-4 ${bgColors[colorIndex]}`}>
        <h4 className="font-semibold text-gray-900">{title}</h4>
        {why && <p className="text-sm text-gray-600 mt-1">{why}</p>}
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Render appropriate chart based on type */}
        {chart_data && chart_data.labels && chart_data.values && (
          <div className="mb-4">
            {(() => {
              try {
                if (chartType === 'line') {
                  return (
                    <SimpleLineChart 
                      labels={chart_data.labels} 
                      values={chart_data.values} 
                      lineColor={lineColors[colorIndex]}
                    />
                  );
                } else {
                  return (
                    <SimpleBarChart 
                      labels={chart_data.labels} 
                      values={chart_data.values} 
                      barColor={barColors[colorIndex]}
                    />
                  );
                }
              } catch (err) {
                console.error('Chart rendering error:', err);
                return <div className="text-xs text-red-500">Error rendering chart: {err.message}</div>;
              }
            })()}
          </div>
        )}

        {/* Data Table */}
        {table && table.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {Object.keys(table[0]).map((key, i) => (
                    <th key={i} className="text-left py-2 px-2 font-medium text-gray-600">
                      {formatColumnName(key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.slice(0, 10).map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0">
                    {Object.values(row).map((value, j) => (
                      <td key={j} className="py-2 px-2 text-gray-800">
                        {formatValue(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {table.length > 10 && (
              <p className="text-xs text-gray-400 mt-2 text-center">
                Showing 10 of {table.length} rows
              </p>
            )}
          </div>
        )}

        {/* KPI feedback controls */}
        <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
          <span>Is this KPI useful?</span>
          <button
            type="button"
            disabled={sendingFeedback}
            onClick={() => handleKpiFeedback(true)}
            className={`px-2 py-1 rounded-lg border flex items-center gap-1 ${
              liked === true
                ? 'border-emerald-500 text-emerald-600 bg-emerald-50'
                : 'border-gray-200 text-gray-600 hover:border-emerald-400 hover:text-emerald-600'
            }`}
          >
            <span>👍</span>
            <span>Yes</span>
          </button>
          <button
            type="button"
            disabled={sendingFeedback}
            onClick={() => handleKpiFeedback(false)}
            className={`px-2 py-1 rounded-lg border flex items-center gap-1 ${
              liked === false
                ? 'border-red-500 text-red-600 bg-red-50'
                : 'border-gray-200 text-gray-600 hover:border-red-400 hover:text-red-600'
            }`}
          >
            <span>👎</span>
            <span>No</span>
          </button>
        </div>

        {/* Chart metadata */}
        {chart && !chart_data && (
          <div className="text-sm text-gray-500">
            <span className="font-medium">Chart:</span> {chart.type || 'bar'} ({chart.x} vs {chart.y})
          </div>
        )}

        {/* SQL Query Section with Training */}
        {sql_query && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            {/* Header */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowSql(!showSql)}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                <svg 
                  className={`w-4 h-4 transition-transform ${showSql ? 'rotate-90' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="font-medium">SQL Query</span>
                <span className="text-xs text-gray-400">(click to {showSql ? 'hide' : 'show'})</span>
              </button>
              
              {/* Status indicator */}
              {saveStatus && (
                <span className={`text-xs px-2 py-1 rounded ${
                  saveStatus === 'saving' ? 'bg-yellow-100 text-yellow-700' :
                  saveStatus === 'saved' ? 'bg-green-100 text-green-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {saveStatus === 'saving' ? '💾 Saving...' :
                   saveStatus === 'saved' ? '✓ Trained!' :
                   '✗ Error saving'}
                </span>
              )}
            </div>
            
            {showSql && (
              <div className="mt-3 space-y-3">
                {/* SQL Display or Editor */}
                {isEditing ? (
                  <div className="space-y-3">
                    <textarea
                      value={editedSql}
                      onChange={(e) => setEditedSql(e.target.value)}
                      className="w-full bg-gray-800 text-green-400 text-xs p-4 rounded-lg font-mono min-h-[120px] border-2 border-blue-500 focus:outline-none focus:border-blue-400"
                      placeholder="Enter the correct SQL query..."
                    />
                    
                    {/* Feedback input */}
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">
                        What was wrong? (optional - helps improve the system)
                      </label>
                      <input
                        type="text"
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder="e.g., Wrong column name, missing WHERE clause..."
                        className="w-full text-xs p-2 border border-gray-200 rounded focus:outline-none focus:border-blue-400"
                      />
                    </div>
                    
                    {/* Similar Examples from Vector Store */}
                    {loadingExamples && (
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        <svg className="animate-spin h-3 w-3 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Finding similar past corrections...
                      </div>
                    )}
                    
                    {similarExamples.length > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          <span className="text-sm font-medium text-blue-800">
                            Similar Past Corrections ({similarExamples.length})
                          </span>
                        </div>
                        <p className="text-xs text-blue-600 mb-3">
                          These are similar SQL queries that were corrected before. Use them as reference!
                        </p>
                        <div className="space-y-3">
                          {similarExamples.map((example, idx) => (
                            <div key={idx} className="bg-white rounded border border-blue-100 p-2">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-gray-700">
                                  Example {idx + 1} - {(example.similarity * 100).toFixed(0)}% similar
                                </span>
                                <button
                                  onClick={() => setEditedSql(example.corrected_sql)}
                                  className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  Use this SQL
                                </button>
                              </div>
                              <div className="text-xs">
                                <div className="mb-1">
                                  <span className="text-gray-500">Original: </span>
                                  <code className="bg-red-50 text-red-700 px-1 rounded text-[10px]">
                                    {example.original_sql.length > 60 
                                      ? example.original_sql.substring(0, 60) + '...' 
                                      : example.original_sql}
                                  </code>
                                </div>
                                <div>
                                  <span className="text-gray-500">Corrected: </span>
                                  <code className="bg-green-50 text-green-700 px-1 rounded text-[10px]">
                                    {example.corrected_sql.length > 60 
                                      ? example.corrected_sql.substring(0, 60) + '...' 
                                      : example.corrected_sql}
                                  </code>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Edit actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSaveCorrection}
                        disabled={saveStatus === 'saving'}
                        className="px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Save & Train
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <pre className="bg-gray-800 text-green-400 text-xs p-4 rounded-lg overflow-x-auto font-mono">
                      {sql_query}
                    </pre>
                    
                    {/* Action buttons */}
                    <div className="mt-2 flex items-center gap-3">
                      <button
                        onClick={handleCopy}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                      
                      <span className="text-gray-300">|</span>
                      
                      <button
                        onClick={() => setIsEditing(true)}
                        className="text-xs text-orange-600 hover:text-orange-800 flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Edit & Train
                      </button>
                    </div>
                    
                    {/* Helpful hint */}
                    <p className="text-xs text-gray-400 mt-2 italic">
                      💡 If this SQL is incorrect, click "Edit & Train" to correct it. The system will learn from your correction.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SimpleBarChart({ labels, values, barColor }) {
  const [hoveredIndex, setHoveredIndex] = React.useState(null);
  
  // Validate inputs
  if (!labels || !values || !Array.isArray(labels) || !Array.isArray(values)) {
    console.error('Invalid chart data:', { labels, values });
    return <div className="text-xs text-red-500">Invalid chart data</div>;
  }
  
  if (labels.length === 0 || values.length === 0) {
    return <div className="text-xs text-gray-400">No data available</div>;
  }
  
  const maxValue = Math.max(...values.filter(v => typeof v === 'number' && !isNaN(v)), 1);

  // Extract color from class name (e.g., 'bg-blue-500' -> 'blue')
  const colorMatch = barColor?.match(/bg-(\w+)-/);
  const colorName = colorMatch ? colorMatch[1] : 'blue';
  
  // Color palette for gradients
  const gradients = {
    blue: 'from-blue-400 to-blue-600',
    green: 'from-emerald-400 to-emerald-600',
    purple: 'from-purple-400 to-purple-600',
    orange: 'from-orange-400 to-orange-600',
    pink: 'from-pink-400 to-pink-600',
    cyan: 'from-cyan-400 to-cyan-600',
  };

  return (
    <div className="space-y-3 py-2">
      {labels.slice(0, 8).map((label, i) => {
        const value = values[i] || 0;
        const numericValue = typeof value === 'number' && !isNaN(value) ? value : 0;
        const percentage = (numericValue / maxValue) * 100;
        const isHovered = hoveredIndex === i;

        return (
          <div 
            key={i} 
            className="flex items-center gap-3 group transition-all duration-200"
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <span className={`text-xs font-medium w-28 truncate transition-colors ${
              isHovered ? 'text-gray-900' : 'text-gray-600'
            }`} title={label}>
              {label}
            </span>
            <div className="flex-1 h-7 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg overflow-hidden shadow-inner">
              <div
                className={`h-full bg-gradient-to-r ${gradients[colorName] || gradients.blue} shadow-sm transition-all duration-700 ease-out relative ${
                  isHovered ? 'opacity-100' : 'opacity-90'
                }`}
                style={{ 
                  width: `${percentage}%`,
                  transform: isHovered ? 'scaleY(1.05)' : 'scaleY(1)',
                }}
              >
                {isHovered && (
                  <div className="absolute inset-0 bg-white opacity-20"></div>
                )}
              </div>
            </div>
            <span className={`text-xs font-semibold w-20 text-right transition-all ${
              isHovered ? 'text-gray-900 scale-105' : 'text-gray-700'
            }`}>
              {formatValue(numericValue)}
            </span>
          </div>
        );
      })}
      {labels.length > 8 && (
        <p className="text-xs text-gray-400 text-center mt-2 pt-2 border-t border-gray-100">
          +{labels.length - 8} more items
        </p>
      )}
    </div>
  );
}

function SimpleLineChart({ labels, values, lineColor }) {
  const [hoveredPoint, setHoveredPoint] = React.useState(null);
  
  // Validate inputs
  if (!labels || !values || !Array.isArray(labels) || !Array.isArray(values)) {
    console.error('Invalid line chart data:', { labels, values });
    return <div className="text-xs text-red-500">Invalid chart data</div>;
  }
  
  if (labels.length === 0 || values.length === 0) {
    return <div className="text-xs text-gray-400">No data available</div>;
  }
  
  // Filter out invalid values
  const validValues = values.filter(v => typeof v === 'number' && !isNaN(v));
  if (validValues.length === 0) {
    return <div className="text-xs text-gray-400">No valid numeric data</div>;
  }
  
  const maxValue = Math.max(...validValues, 1);
  const minValue = Math.min(...validValues, 0);
  const range = maxValue - minValue || 1;
  
  // Chart dimensions
  const width = 100; // viewBox width units
  const height = 140; // viewBox height units (increased for better visuals)
  const padding = { top: 15, right: 10, bottom: 35, left: 10 };
  const chartHeight = height - padding.top - padding.bottom;
  
  // Generate SVG path for the line
  const points = values.map((value, i) => {
    const numericValue = typeof value === 'number' && !isNaN(value) ? value : 0;
    const x = (i / Math.max(values.length - 1, 1)) * width;
    const y = padding.top + chartHeight - ((numericValue - minValue) / range) * chartHeight;
    return { x, y, value: numericValue, label: labels[i] };
  });
  
  // Create path string
  const pathD = points.map((p, i) => 
    `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
  ).join(' ');
  
  // Create area path (for gradient fill)
  const areaD = `${pathD} L ${width} ${height - padding.bottom} L 0 ${height - padding.bottom} Z`;
  
  // Show fewer labels for readability
  const labelStep = Math.ceil(labels.length / 6);
  const visibleLabels = labels.filter((_, i) => i % labelStep === 0 || i === labels.length - 1);
  
  return (
    <div className="w-full bg-gradient-to-br from-gray-50 to-white rounded-lg p-4 shadow-sm">
      <svg 
        viewBox={`0 0 ${width} ${height}`} 
        preserveAspectRatio="none"
        className="w-full drop-shadow-sm"
        style={{ height: `${height * 1.5}px` }}
      >
        {/* Gradient definitions */}
        <defs>
          <linearGradient id={`gradient-${lineColor.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.4" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
          </linearGradient>
          <filter id="shadow">
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.2"/>
          </filter>
        </defs>
        
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((pct) => (
          <line
            key={pct}
            x1="0%"
            y1={padding.top + (chartHeight * (100 - pct) / 100)}
            x2="100%"
            y2={padding.top + (chartHeight * (100 - pct) / 100)}
            stroke={pct === 0 ? "#D1D5DB" : "#F3F4F6"}
            strokeWidth={pct === 0 ? "0.8" : "0.5"}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        
        {/* Area fill */}
        <path
          d={areaD}
          fill={`url(#gradient-${lineColor.replace('#', '')})`}
          className="transition-all duration-500"
        />
        
        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke={lineColor}
          strokeWidth="2.5"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#shadow)"
          className="transition-all duration-500"
        />
        
        {/* Data points */}
        {points.map((p, i) => {
          const shouldShow = i % Math.ceil(points.length / 10) === 0 || i === points.length - 1;
          return shouldShow ? (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r="4"
                fill="white"
                stroke={lineColor}
                strokeWidth="2.5"
                vectorEffect="non-scaling-stroke"
                className="cursor-pointer transition-all duration-200 hover:r-6"
                filter="url(#shadow)"
                onMouseEnter={() => setHoveredPoint(i)}
                onMouseLeave={() => setHoveredPoint(null)}
              />
              {hoveredPoint === i && (
                <g>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="6"
                    fill={lineColor}
                    opacity="0.3"
                    className="animate-ping"
                  />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="5"
                    fill={lineColor}
                  />
                </g>
              )}
            </g>
          ) : null;
        })}
      </svg>
      
      {/* Tooltip for hovered point */}
      {hoveredPoint !== null && (
        <div className="mt-2 text-center">
          <div className="inline-block bg-gray-800 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg">
            <div className="font-semibold">{formatDateLabel(points[hoveredPoint].label)}</div>
            <div className="text-gray-300 mt-0.5">{formatValue(points[hoveredPoint].value)}</div>
          </div>
        </div>
      )}
      
      {/* X-axis labels */}
      <div className="flex justify-between mt-3 px-1">
        {visibleLabels.map((label, i) => (
          <span key={i} className="text-xs font-medium text-gray-500 truncate" style={{ maxWidth: '70px' }}>
            {formatDateLabel(label)}
          </span>
        ))}
      </div>
      
      {/* Y-axis summary with better styling */}
      <div className="flex justify-between mt-3 pt-3 border-t border-gray-200">
        <div className="text-xs">
          <span className="text-gray-400">Min:</span>
          <span className="ml-1 font-semibold text-gray-700">{formatValue(minValue)}</span>
        </div>
        <div className="text-xs">
          <span className="text-gray-400">Avg:</span>
          <span className="ml-1 font-semibold text-gray-700">{formatValue(values.reduce((a,b) => a+b, 0) / values.length)}</span>
        </div>
        <div className="text-xs">
          <span className="text-gray-400">Max:</span>
          <span className="ml-1 font-semibold text-gray-700">{formatValue(maxValue)}</span>
        </div>
      </div>
    </div>
  );
}

function formatDateLabel(label) {
  // Try to format date labels nicely
  if (!label) return '';
  const str = String(label);
  // If it looks like a date (YYYY-MM-DD or YYYY-MM), shorten it
  if (/^\d{4}-\d{2}(-\d{2})?$/.test(str)) {
    const parts = str.split('-');
    if (parts.length === 3) {
      // YYYY-MM-DD -> MM/DD
      return `${parts[1]}/${parts[2]}`;
    } else if (parts.length === 2) {
      // YYYY-MM -> Mon YY
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthIdx = parseInt(parts[1], 10) - 1;
      return `${months[monthIdx] || parts[1]} '${parts[0].slice(2)}`;
    }
  }
  return str.length > 10 ? str.slice(0, 10) + '…' : str;
}

function formatColumnName(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim();
}

function formatValue(value) {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return value.toLocaleString();
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(value);
}

export default InsightCards;
