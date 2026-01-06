/**
 * Factor Analysis Component
 * =========================
 * 
 * Displays factor analysis results including loadings and smart KPIs
 */

function FactorAnalysis({ results }) {
  const fa = results?.factor_analysis || {};
  const smartKPIs = results?.smart_kpis || [];

  if (!fa.ok) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-xl">
        <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h4 className="text-gray-600 font-medium">Factor Analysis Unavailable</h4>
        <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">{fa.reason || 'Unknown reason'}</p>
        {fa.numeric_used && fa.numeric_used.length > 0 && (
          <p className="text-xs text-gray-400 mt-2">Columns considered: {fa.numeric_used.join(', ')}</p>
        )}
      </div>
    );
  }

  const loadings = fa.loadings || {};
  const factors = fa.factors || [];
  const numericUsed = fa.numeric_used || [];
  const explainedVariance = fa.explained_variance || {};

  // Build a description of what each factor represents
  const factorDescriptions = buildFactorDescriptions(loadings, factors);

  return (
    <div className="space-y-6">
      {/* Factor Summary */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-200">
        <h4 className="font-semibold text-gray-800 mb-2">Factor Analysis Summary</h4>
        <p className="text-sm text-gray-600 mb-3">
          Factor analysis identified <strong>{factors.length} latent factors</strong> from{' '}
          <strong>{numericUsed.length} numeric columns</strong>.
        </p>
        <div className="text-xs text-gray-500">
          <span className="font-medium">Columns used:</span> {numericUsed.join(', ')}
        </div>
      </div>

      {/* Factor Descriptions */}
      {factorDescriptions.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-6">
          <h4 className="font-semibold text-gray-800 mb-4">What Each Factor Represents</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {factorDescriptions.map((desc, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold">
                    {i + 1}
                  </span>
                  <span className="font-medium text-gray-800">{desc.name}</span>
                </div>
                <p className="text-sm text-gray-600 mb-2">{desc.description}</p>
                <div className="flex flex-wrap gap-1">
                  {desc.topVars.map((v, j) => (
                    <span key={j} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      {v.name} ({v.loading > 0 ? '+' : ''}{v.loading.toFixed(2)})
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Variance Explained */}
      {explainedVariance.proportion && explainedVariance.proportion.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-6">
          <h4 className="font-semibold text-gray-800 mb-4">Variance Explained</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {explainedVariance.proportion.map((prop, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-700">Factor {i + 1}</span>
                  <span className="text-sm text-gray-500">
                    {(prop * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                    style={{ width: `${prop * 100}%` }}
                  />
                </div>
                {explainedVariance.cumulative && (
                  <p className="text-xs text-gray-400 mt-1">
                    Cumulative: {(explainedVariance.cumulative[i] * 100).toFixed(1)}%
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Factor Loadings */}
      {Object.keys(loadings).length > 0 && (
        <div className="bg-gray-50 rounded-xl p-6">
          <h4 className="font-semibold text-gray-800 mb-4">Factor Loadings</h4>
          <p className="text-sm text-gray-500 mb-4">
            How strongly each variable contributes to each factor. Values closer to 1 or -1 indicate stronger relationships.
          </p>
          <div className="overflow-x-auto">
            <LoadingsTable loadings={loadings} />
          </div>
        </div>
      )}

      {/* Smart KPIs */}
      {smartKPIs.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-6">
          <h4 className="font-semibold text-gray-800 mb-4">Smart KPIs</h4>
          <p className="text-sm text-gray-500 mb-4">
            AI-generated KPIs based on factor analysis and data patterns.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {smartKPIs.map((kpi, i) => (
              <SmartKPICard key={i} kpi={kpi} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* ML Recommendation */}
      {results?.ml_recommendation && (
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-6 border border-purple-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-gray-800">ML Recommendations</h4>
              <p className="text-sm text-purple-600">Powered by machine learning</p>
            </div>
          </div>
          <MLRecommendation recommendation={results.ml_recommendation} />
        </div>
      )}
    </div>
  );
}

// Build human-readable descriptions of factors based on top loadings
function buildFactorDescriptions(loadings, factors) {
  if (!loadings || !factors || factors.length === 0) return [];

  // loadings is dict-of-dicts: { col: { Factor1: x, ... }, ... }
  const cols = Object.keys(loadings);
  if (cols.length === 0) return [];

  return factors.map((factorName) => {
    // Get loadings for this factor sorted by absolute value
    const loadingPairs = cols.map((col) => ({
      name: col,
      loading: loadings[col]?.[factorName] || 0,
    }));
    loadingPairs.sort((a, b) => Math.abs(b.loading) - Math.abs(a.loading));

    const topVars = loadingPairs.slice(0, 3);
    const topNames = topVars.map((v) => v.name);

    // Generate a simple description
    let description = 'Mainly driven by ';
    if (topVars.length === 1) {
      description += topNames[0];
    } else if (topVars.length === 2) {
      description += `${topNames[0]} and ${topNames[1]}`;
    } else {
      description += `${topNames[0]}, ${topNames[1]}, and ${topNames[2]}`;
    }

    return {
      name: factorName,
      description,
      topVars,
    };
  });
}

function LoadingsTable({ loadings }) {
  // Handle different loading formats
  let columns = [];
  let factors = [];
  let values = [];

  if (loadings.columns && loadings.values) {
    // Format A: { columns: [...], values: [[...], ...], factors: [...] }
    columns = loadings.columns;
    factors = loadings.factors || columns.map((_, i) => `Factor ${i + 1}`);
    values = loadings.values;
  } else if (Array.isArray(loadings)) {
    // Format B: [{ variable: col, Factor1: x, ... }, ...]
    if (loadings.length > 0) {
      const firstRow = loadings[0];
      columns = loadings.map(r => r.variable || r.col || r.column);
      factors = Object.keys(firstRow).filter(k => k !== 'variable' && k !== 'col' && k !== 'column');
      values = loadings.map(r => factors.map(f => r[f]));
    }
  } else if (typeof loadings === 'object') {
    // Format C: { col: { Factor1: x, ... }, ... }
    columns = Object.keys(loadings);
    if (columns.length > 0) {
      factors = Object.keys(loadings[columns[0]]);
      values = columns.map(col => factors.map(f => loadings[col][f]));
    }
  }

  if (columns.length === 0) {
    return <p className="text-sm text-gray-400">No loadings data available</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-200">
          <th className="text-left py-2 px-3 font-medium text-gray-600">Variable</th>
          {factors.map((f, i) => (
            <th key={i} className="text-center py-2 px-3 font-medium text-gray-600">{f}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {columns.slice(0, 20).map((col, i) => (
          <tr key={i} className="border-b border-gray-100 last:border-0">
            <td className="py-2 px-3 font-mono text-gray-800">{col}</td>
            {(values[i] || []).map((val, j) => (
              <td key={j} className="text-center py-2 px-3">
                <LoadingCell value={val} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LoadingCell({ value }) {
  const numValue = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(numValue)) return <span className="text-gray-400">-</span>;

  const absValue = Math.abs(numValue);
  const intensity = Math.min(absValue * 100, 100);

  let bgClass = 'bg-gray-100';
  if (absValue > 0.7) {
    bgClass = numValue > 0 ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800';
  } else if (absValue > 0.4) {
    bgClass = numValue > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
  }

  return (
    <span className={`inline-block px-2 py-0.5 rounded ${bgClass} font-mono text-xs`}>
      {numValue.toFixed(3)}
    </span>
  );
}

function SmartKPICard({ kpi, index }) {
  const colors = [
    'border-l-blue-500 bg-blue-50',
    'border-l-green-500 bg-green-50',
    'border-l-purple-500 bg-purple-50',
    'border-l-orange-500 bg-orange-50',
  ];

  const colorClass = colors[index % colors.length];

  // Handle different KPI formats
  const name = kpi.name || kpi.title || `KPI ${index + 1}`;
  const formula = kpi.formula || kpi.expression || kpi.description;
  const value = kpi.value || kpi.result;
  const variables = kpi.variables || kpi.columns || [];

  return (
    <div className={`bg-white rounded-lg border border-gray-200 border-l-4 ${colorClass.split(' ')[0]} p-4`}>
      <h5 className="font-semibold text-gray-800 mb-2">{name}</h5>
      {formula && (
        <p className="text-sm font-mono text-gray-600 bg-gray-100 rounded px-2 py-1 mb-2">
          {formula}
        </p>
      )}
      {value !== undefined && (
        <p className="text-lg font-bold text-gray-900">
          {typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : value}
        </p>
      )}
      {variables.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {variables.map((v, i) => (
            <span key={i} className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
              {v}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function MLRecommendation({ recommendation }) {
  const pack = recommendation.pack_selected || recommendation.pack;
  const cards = recommendation.cards_selected || recommendation.cards || [];
  const confidence = recommendation.confidence || recommendation.probability;

  return (
    <div className="space-y-4">
      {pack && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Recommended Pack:</span>
          <span className="font-semibold text-purple-700">{pack}</span>
          {confidence && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
              {Math.round(confidence * 100)}% confidence
            </span>
          )}
        </div>
      )}
      {cards.length > 0 && (
        <div>
          <span className="text-sm text-gray-600 block mb-2">Recommended Cards:</span>
          <div className="flex flex-wrap gap-2">
            {cards.map((card, i) => (
              <span key={i} className="bg-white border border-purple-200 text-purple-700 px-3 py-1 rounded-lg text-sm">
                {card}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default FactorAnalysis;
