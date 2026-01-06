/**
 * KPI Summary Component
 * =====================
 * 
 * Displays key metrics in a tile/card format with tooltips
 */

// Tooltip explanations for common KPIs
const KPI_TOOLTIPS = {
  'Total Revenue': 'Sum of all revenue values in the selected measure column.',
  'Orders': 'Count of unique order/transaction IDs, or total rows if no ID column detected.',
  'Avg Order Value (AOV)': 'Average revenue per order: Total Revenue ÷ Orders.',
  'Items Sold': 'Sum of quantity values from the detected quantity column.',
  'Gross Margin': 'Profitability ratio: (Revenue − Cost) ÷ Revenue.',
  'Discount Rate': 'Proportion of discounts: Total Discounts ÷ Revenue.',
};

function KPISummary({ results }) {
  const insights = results?.insights || {};
  const summary = insights.summary || {};
  const tiles = summary.tiles || [];
  const dateRange = summary.date_range;
  const selected = insights.selected || {};

  if (tiles.length === 0) {
    // Fallback to traditional KPIs if no summary tiles
    const traditional = results?.traditional_kpis || {};
    // Only show simple scalar KPIs; skip nested objects like numeric_summary
    const scalarEntries = Object.entries(traditional).filter(([, value]) => {
      const t = typeof value;
      return value != null && (t === 'number' || t === 'string' || t === 'boolean');
    });

    const fallbackTiles = scalarEntries.slice(0, 6).map(([key, value]) => ({
      label: formatLabel(key),
      value: typeof value === 'number' ? value.toLocaleString() : String(value),
      hint: key,
    }));

    if (fallbackTiles.length === 0) {
      return null;
    }

    return (
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Key Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {fallbackTiles.map((tile, i) => (
            <KPITile key={i} tile={tile} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Key Metrics</h3>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          {selected.measure && (
            <span title="The main numeric column used for calculations">
              <span className="font-medium">Measure:</span> {selected.measure}
            </span>
          )}
          {selected.time && (
            <span title="The datetime column used for time-based analysis">
              <span className="font-medium">Time:</span> {selected.time}
            </span>
          )}
          {dateRange && (
            <span className="text-gray-400">
              {dateRange.start} — {dateRange.end}
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {tiles.map((tile, i) => (
          <KPITile key={i} tile={tile} />
        ))}
      </div>
    </div>
  );
}

function KPITile({ tile }) {
  const { label, value, hint } = tile;
  const tooltip = KPI_TOOLTIPS[label] || hint;

  // Determine color based on label
  const getColor = (label) => {
    const lowerLabel = label.toLowerCase();
    if (lowerLabel.includes('revenue') || lowerLabel.includes('total')) return 'from-green-500 to-emerald-500';
    if (lowerLabel.includes('order') || lowerLabel.includes('count')) return 'from-blue-500 to-cyan-500';
    if (lowerLabel.includes('margin') || lowerLabel.includes('profit')) return 'from-purple-500 to-violet-500';
    if (lowerLabel.includes('discount') || lowerLabel.includes('rate')) return 'from-orange-500 to-amber-500';
    if (lowerLabel.includes('item') || lowerLabel.includes('sold')) return 'from-pink-500 to-rose-500';
    return 'from-gray-500 to-slate-500';
  };

  return (
    <div className="bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition-colors group relative" title={tooltip}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${getColor(label)}`} />
      </div>
      <div className="text-2xl font-bold text-gray-900 mb-1">
        {value || 'N/A'}
      </div>
      {hint && (
        <p className="text-xs text-gray-400 truncate" title={hint}>
          {hint}
        </p>
      )}
      {/* Tooltip icon */}
      {tooltip && (
        <div className="absolute top-2 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      )}
    </div>
  );
}

function formatLabel(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim();
}

export default KPISummary;
