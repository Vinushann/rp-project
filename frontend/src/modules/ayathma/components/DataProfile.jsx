/**
 * Data Profile Component
 * ======================
 * 
 * Displays dataset profile information including
 * column types, semantic analysis, role inference,
 * and numeric column statistics
 */

import { useState } from 'react';

function DataProfile({ results, onRoleChange }) {
  const profile = results?.profile || {};
  const semantic = results?.semantic || {};
  const roles = results?.role_inference || {};
  const businessNames = results?.business_names || {};
  const allColumns = results?.all_columns || [];
  const traditional = results?.traditional_kpis || {};
  const numericSummary = traditional.numeric_summary || {};

  return (
    <div className="space-y-6">
      {/* Dataset Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Rows" value={profile.rows?.toLocaleString() || 0} icon="M4 6h16M4 10h16M4 14h16M4 18h16" />
        <StatCard label="Total Columns" value={profile.cols || 0} icon="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        <StatCard label="Numeric Columns" value={semantic.numeric_cols?.length || 0} color="blue" icon="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
        <StatCard label="Datetime Columns" value={semantic.datetime_cols?.length || 0} color="purple" icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </div>

      {/* Numeric Column Statistics */}
      {Object.keys(numericSummary).length > 0 && (
        <div className="bg-gray-50 rounded-xl p-6">
          <h4 className="font-semibold text-gray-800 mb-2">Numeric Column Statistics</h4>
          <p className="text-sm text-gray-500 mb-4">
            Distribution and summary statistics for each numeric column.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-100">
                  <th className="text-left py-2 px-3 font-medium text-gray-600">Column</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">Sum</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">Mean</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">Median</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">Std</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">Min</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">Max</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">Missing</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(numericSummary).map(([col, stats], i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-white">
                    <td className="py-2 px-3 font-mono text-gray-800">{col}</td>
                    <td className="py-2 px-3 text-right text-gray-700">{formatNum(stats.sum)}</td>
                    <td className="py-2 px-3 text-right text-gray-700">{formatNum(stats.mean)}</td>
                    <td className="py-2 px-3 text-right text-gray-700">{formatNum(stats.median)}</td>
                    <td className="py-2 px-3 text-right text-gray-700">{formatNum(stats.std)}</td>
                    <td className="py-2 px-3 text-right text-gray-700">{formatNum(stats.min)}</td>
                    <td className="py-2 px-3 text-right text-gray-700">{formatNum(stats.max)}</td>
                    <td className="py-2 px-3 text-right text-gray-500">{stats.missing ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Column Types */}
      <div className="bg-gray-50 rounded-xl p-6">
        <h4 className="font-semibold text-gray-800 mb-4">Column Classification</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Numeric Columns */}
          <ColumnList 
            title="Numeric" 
            columns={semantic.numeric_cols || []} 
            color="blue"
            icon="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
          />
          
          {/* Categorical Columns */}
          <ColumnList 
            title="Categorical" 
            columns={semantic.categorical_cols || []} 
            color="green"
            icon="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
          />
          
          {/* Datetime Columns */}
          <ColumnList 
            title="Datetime" 
            columns={semantic.datetime_cols || []} 
            color="purple"
            icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </div>
      </div>

      {/* Role Inference with Adjust option */}
      {Object.keys(roles).length > 0 && (
        <div className="bg-gray-50 rounded-xl p-6">
          <h4 className="font-semibold text-gray-800 mb-2">Detected Roles</h4>
          <p className="text-sm text-gray-500 mb-4">
            The system automatically identified these column roles based on semantic analysis. You can adjust them and re-run the analysis.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(roles).map(([role, info]) => (
              info && info.col && (
                <RoleCard
                  key={role}
                  role={role}
                  info={info}
                  allColumns={allColumns}
                  onRoleChange={onRoleChange}
                />
              )
            ))}
          </div>
        </div>
      )}

      {/* All Columns Table */}
      <div className="bg-gray-50 rounded-xl p-6">
        <h4 className="font-semibold text-gray-800 mb-4">All Columns ({allColumns.length})</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 font-medium text-gray-600">#</th>
                <th className="text-left py-2 px-3 font-medium text-gray-600">Column Name</th>
                <th className="text-left py-2 px-3 font-medium text-gray-600">Type</th>
                <th className="text-left py-2 px-3 font-medium text-gray-600">Role</th>
              </tr>
            </thead>
            <tbody>
              {allColumns.map((col, i) => {
                const type = getColumnType(col, semantic);
                const role = getColumnRole(col, roles);
                return (
                  <tr key={i} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 px-3 text-gray-400">{i + 1}</td>
                    <td className="py-2 px-3 font-mono text-gray-800">{col}</td>
                    <td className="py-2 px-3">
                      <TypeBadge type={type} />
                    </td>
                    <td className="py-2 px-3 text-gray-600">{role || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color = 'gray', icon }) {
  const colors = {
    gray: 'bg-gray-100 text-gray-600',
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
          </svg>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function ColumnList({ title, columns, color, icon }) {
  const colors = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-6 h-6 rounded flex items-center justify-center ${colors[color]}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
          </svg>
        </div>
        <span className="font-medium text-gray-700">{title}</span>
        <span className="text-sm text-gray-400">({columns.length})</span>
      </div>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {columns.length > 0 ? (
          columns.map((col, i) => (
            <div key={i} className="text-sm font-mono text-gray-600 bg-white rounded px-2 py-1">
              {col}
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-400 italic">None detected</p>
        )}
      </div>
    </div>
  );
}

function RoleCard({ role, info, allColumns, onRoleChange }) {
  const [editing, setEditing] = useState(false);

  const formatRole = (role) => {
    return role
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between mb-2">
        <span className="text-sm font-medium text-gray-500">{formatRole(role)}</span>
        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
          {Math.round((info.score || 0) * 100)}% conf
        </span>
      </div>
      {editing ? (
        <select
          className="w-full text-sm border border-gray-300 rounded px-2 py-1 mb-1"
          defaultValue={info.col}
          onChange={(e) => {
            if (onRoleChange) onRoleChange(role, e.target.value);
            setEditing(false);
          }}
          onBlur={() => setEditing(false)}
          autoFocus
        >
          <option value="">— None —</option>
          {(allColumns || []).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      ) : (
        <p className="font-mono text-gray-800 truncate" title={info.col}>
          {info.col}
        </p>
      )}
      {info.reason && (
        <p className="text-xs text-gray-400 mt-1 truncate" title={info.reason}>
          {info.reason}
        </p>
      )}
      {!editing && onRoleChange && (
        <button
          onClick={() => setEditing(true)}
          className="mt-2 text-xs text-orange-600 hover:underline"
        >
          Adjust
        </button>
      )}
    </div>
  );
}

function formatNum(x) {
  if (x == null || typeof x !== 'number') return '-';
  if (Math.abs(x) >= 1e6) return x.toExponential(2);
  if (Number.isInteger(x)) return x.toLocaleString();
  return x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function TypeBadge({ type }) {
  const styles = {
    numeric: 'bg-blue-100 text-blue-700',
    categorical: 'bg-green-100 text-green-700',
    datetime: 'bg-purple-100 text-purple-700',
    unknown: 'bg-gray-100 text-gray-700',
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${styles[type] || styles.unknown}`}>
      {type}
    </span>
  );
}

function getColumnType(col, semantic) {
  if (semantic.numeric_cols?.includes(col)) return 'numeric';
  if (semantic.categorical_cols?.includes(col)) return 'categorical';
  if (semantic.datetime_cols?.includes(col)) return 'datetime';
  return 'unknown';
}

function getColumnRole(col, roles) {
  for (const [role, info] of Object.entries(roles)) {
    if (info && info.col === col) {
      return role.replace(/_/g, ' ').toLowerCase();
    }
  }
  return null;
}

export default DataProfile;
