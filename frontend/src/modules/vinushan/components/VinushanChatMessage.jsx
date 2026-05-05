import ReactMarkdown from 'react-markdown';
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  Area, AreaChart,
} from 'recharts';
import '../styles/ChatMessage.css';

const CHART_COLORS = [
  '#6366f1', '#8b5cf6', '#a78bfa', '#c084fc',
  '#f472b6', '#fb7185', '#f97316', '#facc15',
  '#34d399', '#22d3ee', '#60a5fa', '#818cf8',
];

const GRADIENTS_ID = 'athena-chart-gradients';

function ChartGradients() {
  return (
    <defs>
      {CHART_COLORS.map((color, i) => (
        <linearGradient key={i} id={`gradient-${i}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.8} />
          <stop offset="100%" stopColor={color} stopOpacity={0.15} />
        </linearGradient>
      ))}
    </defs>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="athena-chart-tooltip">
      <p className="athena-chart-tooltip-label">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color || CHART_COLORS[i % CHART_COLORS.length] }}>
          {entry.name}: <strong>{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</strong>
        </p>
      ))}
    </div>
  );
};

function transformChartData(chartData) {
  const { labels, datasets } = chartData;
  return labels.map((label, i) => {
    const point = { name: label };
    datasets.forEach((ds) => {
      point[ds.label] = ds.data[i];
    });
    return point;
  });
}

function renderInteractiveChart(chart) {
  if (!chart?.chart_data || !chart.chart_data.labels || !chart.chart_data.datasets?.length) return null;

  const { chart_type, datasets } = chart.chart_data;
  const data = transformChartData(chart.chart_data);
  const dataKeys = datasets.map((ds) => ds.label);

  if (chart_type === 'pie') {
    const pieData = data.map((d, i) => ({ name: d.name, value: d[dataKeys[0]] || 0 }));
    return (
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={120}
            paddingAngle={3}
            dataKey="value"
            stroke="none"
            animationBegin={0}
            animationDuration={800}
          >
            {pieData.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={10}
            wrapperStyle={{ fontSize: '0.8rem', color: '#94a3b8' }}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (chart_type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <ChartGradients />
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(148,163,184,0.2)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: '0.8rem', color: '#94a3b8' }}
          />
          {dataKeys.map((key, i) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={2.5}
              fill={`url(#gradient-${i})`}
              dot={{ r: 3, fill: CHART_COLORS[i % CHART_COLORS.length], strokeWidth: 0 }}
              activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
              animationDuration={800}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // Default: bar chart
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <ChartGradients />
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
        <XAxis
          dataKey="name"
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          axisLine={{ stroke: 'rgba(148,163,184,0.2)' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: '0.8rem', color: '#94a3b8' }}
        />
        {dataKeys.map((key, i) => (
          <Bar
            key={key}
            dataKey={key}
            fill={CHART_COLORS[i % CHART_COLORS.length]}
            radius={[6, 6, 0, 0]}
            animationDuration={800}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

const agentIcons = {
  historical: 'H',
  forecasting: 'F',
  holiday: 'Ho',
  weather: 'W',
  strategy: 'S',
  visualization: 'V',
};

function getAgentIcon(agentName = '') {
  const lower = agentName.toLowerCase();
  for (const [key, icon] of Object.entries(agentIcons)) {
    if (lower.includes(key)) return icon;
  }
  return '';
}

function VinushanChatMessage({ message, agentSteps, routingReasoning, agentsUsed, charts }) {
  const isUser = message.role === 'user';

  return (
    <div className={`chat-message ${isUser ? 'user' : 'assistant'}`}>
      <div className="message-avatar" aria-label={isUser ? 'You' : 'ATHENA assistant'}>
        {isUser ? 'U' : 'A'}
      </div>
      <div className="message-content">
        <div className="message-header">
          <span className="message-role">{isUser ? 'You' : 'Assistant'}</span>
          <span className="message-time">
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
        </div>
        {!isUser && routingReasoning && (
          <div className="routing-info">
            <span className="routing-label">Reasoning:</span>
            <span className="routing-text">{routingReasoning}</span>
          </div>
        )}
        {!isUser && agentsUsed?.length > 0 && (
          <div className="agents-used">
            <span className="agents-label">Agents used:</span>
            <div className="agents-list">
              {agentsUsed.map((agent, idx) => (
                <span key={idx} className="agent-badge">
                  {getAgentIcon(agent)} {agent}
                </span>
              ))}
            </div>
          </div>
        )}
        {!isUser && agentSteps?.length > 0 && (
          <details className="agent-steps">
            <summary>View reasoning steps ({agentSteps.length} agents)</summary>
            <div className="steps-container">
              {agentSteps.map((step, idx) => (
                <div key={idx} className="step">
                  <div className="step-header">
                    <span className="step-icon">{getAgentIcon(step.agent_name)}</span>
                    <span className="step-agent">{step.agent_name}</span>
                  </div>
                  {step.summary && (
                    <div className="step-summary">{step.summary}</div>
                  )}
                </div>
              ))}
            </div>
          </details>
        )}
        {!isUser && charts?.length > 0 && (
          <div className="charts-container">
            {charts.map((chart, idx) => (
              <div key={idx} className="chart-wrapper">
                {chart.title && <h3 className="chart-title">📊 {chart.title}</h3>}
                {chart.chart_data ? (
                  <div className="chart-image-container interactive">
                    {renderInteractiveChart(chart)}
                  </div>
                ) : chart.image ? (
                  <div className="chart-image-container">
                    <img
                      src={`data:image/png;base64,${chart.image}`}
                      alt={chart.title || 'Sales Chart'}
                      className="chart-image"
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
        <div className="message-text">
          {isUser ? <p>{message.content}</p> : <ReactMarkdown>{message.content}</ReactMarkdown>}
        </div>
      </div>
    </div>
  );
}

export default VinushanChatMessage;
