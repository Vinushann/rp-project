/**
 * Insight Cards Component
 * =======================
 * 
 * Displays insight cards with appropriate charts based on data type:
 * - Line charts for time-series/trend data
 * - Bar charts for categorical comparisons
 */

function InsightCards({ results, limit }) {
  const insights = results?.insights || {};
  const cards = insights.cards || [];
  const selected = insights.selected || {};

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {displayCards.map((card, i) => (
          <InsightCard key={i} card={card} index={i} />
        ))}
      </div>
    </div>
  );
}

function InsightCard({ card, index }) {
  const { title, why, table, chart, chart_data } = card;
  
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
            {chartType === 'line' ? (
              <SimpleLineChart 
                labels={chart_data.labels} 
                values={chart_data.values} 
                lineColor={lineColors[colorIndex]}
              />
            ) : (
              <SimpleBarChart 
                labels={chart_data.labels} 
                values={chart_data.values} 
                barColor={barColors[colorIndex]}
              />
            )}
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

        {/* Chart metadata */}
        {chart && !chart_data && (
          <div className="text-sm text-gray-500">
            <span className="font-medium">Chart:</span> {chart.type || 'bar'} ({chart.x} vs {chart.y})
          </div>
        )}
      </div>
    </div>
  );
}

function SimpleBarChart({ labels, values, barColor }) {
  const maxValue = Math.max(...values, 1);

  return (
    <div className="space-y-2">
      {labels.slice(0, 8).map((label, i) => {
        const value = values[i] || 0;
        const percentage = (value / maxValue) * 100;

        return (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xs text-gray-600 w-24 truncate" title={label}>
              {label}
            </span>
            <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${barColor} rounded-full transition-all duration-500`}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span className="text-xs text-gray-700 font-medium w-16 text-right">
              {formatValue(value)}
            </span>
          </div>
        );
      })}
      {labels.length > 8 && (
        <p className="text-xs text-gray-400 text-center">+{labels.length - 8} more</p>
      )}
    </div>
  );
}

function SimpleLineChart({ labels, values, lineColor }) {
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const range = maxValue - minValue || 1;
  
  // Chart dimensions
  const width = 100; // viewBox width units
  const height = 120; // viewBox height units
  const padding = { top: 10, right: 10, bottom: 30, left: 10 };
  const chartHeight = height - padding.top - padding.bottom;
  
  // Generate SVG path for the line
  const points = values.map((value, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * width;
    const y = padding.top + chartHeight - ((value - minValue) / range) * chartHeight;
    return { x, y, value };
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
    <div className="w-full">
      <svg 
        viewBox={`0 0 ${width} ${height}`} 
        preserveAspectRatio="none"
        className="w-full"
        style={{ height: `${height}px` }}
      >
        {/* Gradient definition */}
        <defs>
          <linearGradient id={`gradient-${lineColor.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.05" />
          </linearGradient>
        </defs>
        
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((pct) => (
          <line
            key={pct}
            x1="0%"
            y1={padding.top + (chartHeight * (100 - pct) / 100)}
            x2="100%"
            y2={padding.top + (chartHeight * (100 - pct) / 100)}
            stroke="#E5E7EB"
            strokeWidth="0.5"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        
        {/* Area fill */}
        <path
          d={areaD}
          fill={`url(#gradient-${lineColor.replace('#', '')})`}
        />
        
        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke={lineColor}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Data points (show fewer for cleaner look) */}
        {points.filter((_, i) => i % Math.ceil(points.length / 12) === 0 || i === points.length - 1).map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3"
            fill="white"
            stroke={lineColor}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      
      {/* X-axis labels */}
      <div className="flex justify-between mt-1 px-1">
        {visibleLabels.map((label, i) => (
          <span key={i} className="text-xs text-gray-500 truncate" style={{ maxWidth: '60px' }}>
            {formatDateLabel(label)}
          </span>
        ))}
      </div>
      
      {/* Y-axis summary */}
      <div className="flex justify-between mt-2 text-xs text-gray-500">
        <span>Min: {formatValue(minValue)}</span>
        <span>Max: {formatValue(maxValue)}</span>
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
