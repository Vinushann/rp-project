/**
 * Chart Components
 * Using Recharts for data visualization
 */
import { 
  PieChart as RechartsPie, 
  Pie, 
  Cell, 
  ResponsiveContainer,
  BarChart as RechartsBar,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';

const COLORS = [
  '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
];

export function PieChart({ data, dataKey = 'value', nameKey = 'name', height = 300 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsPie>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey={dataKey}
          nameKey={nameKey}
          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
          labelLine={false}
        >
          {data.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={COLORS[index % COLORS.length]}
              className="hover:opacity-80 transition-opacity cursor-pointer"
            />
          ))}
        </Pie>
        <Tooltip 
          contentStyle={{ 
            backgroundColor: '#1F2937', 
            border: 'none', 
            borderRadius: '8px',
            color: '#fff'
          }}
        />
      </RechartsPie>
    </ResponsiveContainer>
  );
}

export function BarChart({ 
  data, 
  dataKey = 'value', 
  nameKey = 'name', 
  height = 300,
  horizontal = false 
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBar 
        data={data} 
        layout={horizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        {horizontal ? (
          <>
            <XAxis type="number" tick={{ fill: '#6B7280' }} />
            <YAxis dataKey={nameKey} type="category" tick={{ fill: '#6B7280' }} width={100} />
          </>
        ) : (
          <>
            <XAxis dataKey={nameKey} tick={{ fill: '#6B7280' }} />
            <YAxis tick={{ fill: '#6B7280' }} />
          </>
        )}
        <Tooltip 
          contentStyle={{ 
            backgroundColor: '#1F2937', 
            border: 'none', 
            borderRadius: '8px',
            color: '#fff'
          }}
        />
        <Bar 
          dataKey={dataKey} 
          fill="#10B981"
          radius={[4, 4, 0, 0]}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </RechartsBar>
    </ResponsiveContainer>
  );
}

export function ModelComparisonChart({ data, height = 400 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBar
        data={data}
        layout="vertical"
        margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis type="number" domain={[0, 100]} tick={{ fill: '#6B7280' }} />
        <YAxis dataKey="name" type="category" tick={{ fill: '#6B7280' }} width={90} />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: '#1F2937', 
            border: 'none', 
            borderRadius: '8px',
            color: '#fff'
          }}
          formatter={(value) => `${value.toFixed(1)}%`}
        />
        <Legend />
        <Bar dataKey="accuracy" fill="#10B981" name="Accuracy" radius={[0, 4, 4, 0]} />
        <Bar dataKey="f1" fill="#3B82F6" name="F1 Score" radius={[0, 4, 4, 0]} />
      </RechartsBar>
    </ResponsiveContainer>
  );
}

export default { PieChart, BarChart, ModelComparisonChart };
