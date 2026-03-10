/**
 * Interactive Dashboard Component - Power BI Style
 * =================================================
 * 
 * A comprehensive dashboard visualization with multiple interactive charts,
 * filters, and drill-down capabilities similar to Power BI.
 */

import React, { useState, useMemo } from 'react';

function Dashboard({ results }) {
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [dateRange, setDateRange] = useState('all');
  const [selectedDimension, setSelectedDimension] = useState(null);
  const [chartType, setChartType] = useState('bar');
  const [showFilters, setShowFilters] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [activeView, setActiveView] = useState('overview'); // 'overview', 'detailed', 'trends'
  const [chartLayout, setChartLayout] = useState('grid'); // 'grid', 'stacked'

  // Extract data from results
  const kpiSummary = results?.insights?.kpi_summary || {};
  const cards = results?.insights?.cards || [];
  const selected = results?.insights?.selected || {};
  const semantic = results?.semantic || {};
  const profile = results?.profile || {};
  const datasetName = results?.dataset_name || 'Dataset';

  // Available metrics and dimensions
  const numericCols = semantic.numeric_cols || [];
  const categoricalCols = semantic.categorical_cols || [];
  const datetimeCols = semantic.datetime_cols || [];

  // Set defaults
  const currentMeasure = selectedMetric || selected.measure || numericCols[0];
  const currentDimension = selectedDimension || selected.dimensions?.[0] || categoricalCols[0];

  // Get card data for the selected metric
  const relevantCards = useMemo(() => {
    return cards.filter(card => {
      const title = (card.title || '').toLowerCase();
      const measure = (currentMeasure || '').toLowerCase();
      return title.includes(measure) || card.chart?.y === currentMeasure;
    });
  }, [cards, currentMeasure]);

  // Format large numbers
  const formatNumber = (num) => {
    if (num === null || num === undefined) return 'N/A';
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  // Get KPI cards data
  const kpiCards = [
    {
      id: 'revenue',
      label: 'Total Revenue',
      value: kpiSummary.revenue_total,
      format: 'money',
      icon: '💰',
      color: 'from-green-500 to-emerald-600',
      bgColor: 'bg-green-50',
      change: '+12.5%',
      changeType: 'positive',
    },
    {
      id: 'orders',
      label: 'Total Orders',
      value: kpiSummary.orders_count,
      format: 'number',
      icon: '📦',
      color: 'from-blue-500 to-indigo-600',
      bgColor: 'bg-blue-50',
      change: '+8.2%',
      changeType: 'positive',
    },
    {
      id: 'aov',
      label: 'Avg Order Value',
      value: kpiSummary.aov,
      format: 'money',
      icon: '🎯',
      color: 'from-purple-500 to-violet-600',
      bgColor: 'bg-purple-50',
      change: '+3.1%',
      changeType: 'positive',
    },
    {
      id: 'items',
      label: 'Items Sold',
      value: kpiSummary.items_sold,
      format: 'number',
      icon: '🛒',
      color: 'from-orange-500 to-amber-600',
      bgColor: 'bg-orange-50',
      change: '-2.3%',
      changeType: 'negative',
    },
  ].filter(kpi => kpi.value !== null && kpi.value !== undefined);

  // Extract more comprehensive metrics
  const allMetrics = useMemo(() => {
    const metrics = [];
    numericCols.forEach(col => {
      const card = cards.find(c => c.chart?.y === col || c.title?.includes(col));
      if (card?.table && card.table.length > 0) {
        const values = card.table.map(row => Object.values(row).find(v => typeof v === 'number')).filter(v => v);
        if (values.length > 0) {
          const sum = values.reduce((a, b) => a + b, 0);
          const avg = sum / values.length;
          const min = Math.min(...values);
          const max = Math.max(...values);
          metrics.push({ col, sum, avg, min, max, count: values.length });
        }
      }
    });
    return metrics;
  }, [numericCols, cards]);

  // Get all available chart data
  const getChartData = (cardId) => {
    const card = cards.find(c => c.id === cardId);
    return card?.chart_data || card?.table || null;
  };

  const trendData = getChartData('measure_over_time_daily') || getChartData('measure_over_time_monthly');
  const topDimensionData = getChartData('top_dimension_by_measure');
  const categoryData = getChartData('measure_by_category');
  const distributionData = getChartData('measure_distribution');

  // Filter cards based on selected category
  const filteredCards = useMemo(() => {
    if (!selectedCategory) return cards;
    return cards.filter(card => {
      const title = (card.title || '').toLowerCase();
      return title.includes(selectedCategory.toLowerCase());
    });
  }, [cards, selectedCategory]);

  return (
    <div className="space-y-6">
      {/* Dashboard Header with View Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">📊 Analytics Dashboard</h2>
          <p className="text-sm text-gray-500 mt-1">
            Interactive Power BI-style dashboard • {datasetName}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* View Mode Selector */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white">
            {['overview', 'detailed', 'trends'].map((view) => (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  activeView === view
                    ? 'bg-orange-500 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {view}
              </button>
            ))}
          </div>
          
          {/* Layout Switcher */}
          <div className="flex gap-1">
            <button
              onClick={() => setChartLayout('grid')}
              className={`p-2 rounded ${chartLayout === 'grid' ? 'bg-orange-100 text-orange-600' : 'text-gray-400 hover:text-gray-600'}`}
              title="Grid Layout"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 4a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 12a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4zM11 4a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V4zM11 12a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"/>
              </svg>
            </button>
            <button
              onClick={() => setChartLayout('stacked')}
              className={`p-2 rounded ${chartLayout === 'stacked' ? 'bg-orange-100 text-orange-600' : 'text-gray-400 hover:text-gray-600'}`}
              title="Stacked Layout"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2zM3 16a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z"/>
              </svg>
            </button>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              showFilters 
                ? 'bg-orange-50 border-orange-200 text-orange-700' 
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
            </span>
          </button>
          <button className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors">
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </span>
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* Metric Selector */}
            {numericCols.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Primary Metric</label>
                <select
                  value={selectedMetric || ''}
                  onChange={(e) => setSelectedMetric(e.target.value || null)}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white min-w-[160px]"
                >
                  <option value="">{selected.measure || 'Auto-detected'}</option>
                  {numericCols.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Dimension Selector */}
            {categoricalCols.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Group By</label>
                <select
                  value={selectedDimension || ''}
                  onChange={(e) => setSelectedDimension(e.target.value || null)}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white min-w-[160px]"
                >
                  <option value="">{selected.dimensions?.[0] || 'Auto-detected'}</option>
                  {categoricalCols.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Date Range */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date Range</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white min-w-[140px]"
              >
                <option value="all">All Time</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="ytd">Year to Date</option>
              </select>
            </div>

            {/* Chart Type */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Chart Style</label>
              <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                {['bar', 'line', 'area'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setChartType(type)}
                    className={`px-3 py-2 text-xs font-medium capitalize ${
                      chartType === type
                        ? 'bg-orange-500 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                setSelectedMetric(null);
                setSelectedDimension(null);
                setDateRange('all');
                setChartType('bar');
              }}
              className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700"
            >
              Reset Filters
            </button>
          </div>
        </div>
      )}

      {/* KPI Summary Cards */}
      {kpiCards.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((kpi) => (
            <div
              key={kpi.id}
              className={`${kpi.bgColor} rounded-xl p-5 border border-gray-100 hover:shadow-md transition-shadow cursor-pointer`}
              onClick={() => setSelectedMetric(kpi.id === 'revenue' ? selected.measure : null)}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">{kpi.icon}</span>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  kpi.changeType === 'positive' 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {kpi.change}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-1">{kpi.label}</p>
              <p className="text-2xl font-bold text-gray-900">
                {kpi.format === 'money' ? '$' : ''}{formatNumber(kpi.value)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">
                {currentMeasure || 'Metric'} Trend
              </h3>
              <p className="text-xs text-gray-500">Performance over time</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500"></span>
              <span className="text-xs text-gray-500">{currentMeasure}</span>
            </div>
          </div>
          
          {trendData ? (
            <InteractiveLineChart 
              data={trendData} 
              chartType={chartType}
              color="blue"
            />
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              <p>No trend data available</p>
            </div>
          )}
        </div>

        {/* Top Categories Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">
                Top {currentDimension || 'Categories'}
              </h3>
              <p className="text-xs text-gray-500">By {currentMeasure || 'value'}</p>
            </div>
          </div>
          
          {topDimensionData || categoryData ? (
            <InteractiveBarChart 
              data={topDimensionData || categoryData}
              dimension={currentDimension}
              measure={currentMeasure}
            />
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              <p>No category data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Secondary Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-2">Distribution</h3>
          <p className="text-xs text-gray-500 mb-4">{currentMeasure} value spread</p>
          
          {distributionData ? (
            <DistributionChart data={distributionData} />
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
              No distribution data
            </div>
          )}
        </div>

        {/* Data Summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-2">Data Summary</h3>
          <p className="text-xs text-gray-500 mb-4">Dataset overview</p>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Total Rows</span>
              <span className="font-semibold text-gray-900">{formatNumber(profile.rows)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Columns</span>
              <span className="font-semibold text-gray-900">{profile.cols}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Numeric Fields</span>
              <span className="font-semibold text-gray-900">{numericCols.length}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-600">Categories</span>
              <span className="font-semibold text-gray-900">{categoricalCols.length}</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-2">Quick Actions</h3>
          <p className="text-xs text-gray-500 mb-4">Common operations</p>
          
          <div className="space-y-2">
            <button className="w-full px-4 py-3 text-left text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-3">
              <span className="text-lg">📊</span>
              <span>Generate Report</span>
            </button>
            <button className="w-full px-4 py-3 text-left text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-3">
              <span className="text-lg">🔔</span>
              <span>Set Alerts</span>
            </button>
            <button className="w-full px-4 py-3 text-left text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-3">
              <span className="text-lg">📤</span>
              <span>Share Dashboard</span>
            </button>
            <button className="w-full px-4 py-3 text-left text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-3">
              <span className="text-lg">⚙️</span>
              <span>Customize Layout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Data Table Preview */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">Data Preview</h3>
            <p className="text-xs text-gray-500">Sample of insight data</p>
          </div>
        </div>
        
        {cards.length > 0 && cards[0].table ? (
          <DataTable data={cards[0].table} />
        ) : (
          <div className="text-center py-8 text-gray-400">
            No data table available
          </div>
        )}
      </div>
    </div>
  );
}

// Interactive Line/Area Chart Component
function InteractiveLineChart({ data, chartType, color }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  
  // Handle both array of objects and chart_data format
  let labels = [];
  let values = [];
  
  if (data.labels && data.values) {
    labels = data.labels;
    values = data.values;
  } else if (Array.isArray(data)) {
    labels = data.map(d => d.time || d.period || Object.values(d)[0]);
    values = data.map(d => {
      const numericKey = Object.keys(d).find(k => typeof d[k] === 'number');
      return numericKey ? d[numericKey] : 0;
    });
  }

  if (labels.length === 0) {
    return <div className="h-64 flex items-center justify-center text-gray-400">No data</div>;
  }

  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const range = maxValue - minValue || 1;

  const width = 100;
  const height = 60;
  const padding = 5;

  // Generate path points
  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1 || 1)) * (width - 2 * padding);
    const y = height - padding - ((v - minValue) / range) * (height - 2 * padding);
    return { x, y, value: v, label: labels[i] };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = linePath + ` L ${points[points.length - 1]?.x || 0} ${height - padding} L ${padding} ${height - padding} Z`;

  const colorClass = color === 'blue' ? '#3B82F6' : '#F97316';

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-64">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
          <line
            key={i}
            x1={padding}
            y1={height - padding - ratio * (height - 2 * padding)}
            x2={width - padding}
            y2={height - padding - ratio * (height - 2 * padding)}
            stroke="#E5E7EB"
            strokeWidth="0.3"
          />
        ))}

        {/* Area fill */}
        {(chartType === 'area' || chartType === 'line') && (
          <path
            d={areaPath}
            fill={colorClass}
            fillOpacity={chartType === 'area' ? 0.2 : 0.1}
          />
        )}

        {/* Line */}
        {(chartType === 'line' || chartType === 'area') && (
          <path
            d={linePath}
            fill="none"
            stroke={colorClass}
            strokeWidth="0.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Bar chart */}
        {chartType === 'bar' && points.map((p, i) => {
          const barWidth = (width - 2 * padding) / values.length * 0.7;
          const barHeight = ((p.value - minValue) / range) * (height - 2 * padding);
          return (
            <rect
              key={i}
              x={p.x - barWidth / 2}
              y={height - padding - barHeight}
              width={barWidth}
              height={barHeight}
              fill={hoveredIndex === i ? '#F97316' : colorClass}
              rx="1"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="cursor-pointer transition-colors"
            />
          );
        })}

        {/* Data points for line/area */}
        {(chartType === 'line' || chartType === 'area') && points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoveredIndex === i ? 2 : 1.2}
            fill={hoveredIndex === i ? '#F97316' : colorClass}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
            className="cursor-pointer transition-all"
          />
        ))}
      </svg>

      {/* Tooltip */}
      {hoveredIndex !== null && points[hoveredIndex] && (
        <div className="absolute top-2 right-2 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg">
          <p className="font-medium">{points[hoveredIndex].label}</p>
          <p className="text-gray-300">{points[hoveredIndex].value.toLocaleString()}</p>
        </div>
      )}

      {/* X-axis labels */}
      <div className="flex justify-between mt-2 px-2">
        {labels.filter((_, i) => i === 0 || i === labels.length - 1 || i === Math.floor(labels.length / 2)).map((label, i) => (
          <span key={i} className="text-xs text-gray-400">{String(label).slice(0, 10)}</span>
        ))}
      </div>
    </div>
  );
}

// Interactive Bar Chart Component
function InteractiveBarChart({ data, dimension, measure }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // Handle both formats
  let items = [];
  if (data.labels && data.values) {
    items = data.labels.map((label, i) => ({
      label,
      value: data.values[i] || 0,
    }));
  } else if (Array.isArray(data)) {
    items = data.slice(0, 8).map(d => {
      const keys = Object.keys(d);
      const labelKey = keys.find(k => typeof d[k] === 'string') || keys[0];
      const valueKey = keys.find(k => typeof d[k] === 'number') || keys[1];
      return {
        label: d[labelKey],
        value: d[valueKey] || 0,
      };
    });
  }

  if (items.length === 0) {
    return <div className="h-64 flex items-center justify-center text-gray-400">No data</div>;
  }

  const maxValue = Math.max(...items.map(i => i.value), 1);

  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-cyan-500',
    'bg-indigo-500',
    'bg-amber-500',
  ];

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const percentage = (item.value / maxValue) * 100;
        return (
          <div
            key={i}
            className="group cursor-pointer"
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`text-sm truncate max-w-[60%] ${hoveredIndex === i ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                {item.label}
              </span>
              <span className={`text-sm font-medium ${hoveredIndex === i ? 'text-orange-600' : 'text-gray-700'}`}>
                {item.value.toLocaleString()}
              </span>
            </div>
            <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${hoveredIndex === i ? 'bg-orange-500' : colors[i % colors.length]} rounded-full transition-all duration-300`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Distribution Chart Component
function DistributionChart({ data }) {
  // Data should be array of {metric, value}
  const items = Array.isArray(data) ? data : [];

  if (items.length === 0) {
    return <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No data</div>;
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center justify-between py-1">
          <span className="text-xs text-gray-500 uppercase">{item.metric}</span>
          <span className="text-sm font-semibold text-gray-900">
            {typeof item.value === 'number' ? item.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// Data Table Component
function DataTable({ data }) {
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  if (!data || data.length === 0) {
    return <div className="text-center py-4 text-gray-400">No data</div>;
  }

  const columns = Object.keys(data[0]);

  const sortedData = [...data].sort((a, b) => {
    if (!sortCol) return 0;
    const aVal = a[sortCol];
    const bVal = b[sortCol];
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    }
    return sortDir === 'asc' 
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            {columns.map((col) => (
              <th
                key={col}
                onClick={() => handleSort(col)}
                className="text-left py-3 px-3 font-medium text-gray-600 cursor-pointer hover:bg-gray-50"
              >
                <div className="flex items-center gap-1">
                  {col}
                  {sortCol === col && (
                    <span className="text-orange-500">{sortDir === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.slice(0, 10).map((row, i) => (
            <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
              {columns.map((col) => (
                <td key={col} className="py-3 px-3 text-gray-800">
                  {typeof row[col] === 'number' 
                    ? row[col].toLocaleString(undefined, { maximumFractionDigits: 2 })
                    : row[col]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 10 && (
        <p className="text-xs text-gray-400 mt-2 text-center">
          Showing 10 of {data.length} rows
        </p>
      )}
    </div>
  );
}

export default Dashboard;
