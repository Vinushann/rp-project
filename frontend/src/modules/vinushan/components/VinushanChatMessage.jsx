import ReactMarkdown from 'react-markdown';
import { Bar, Line, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import '../styles/ChatMessage.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
);

const agentIcons = {
  historical: '📜',
  forecasting: '📈',
  holiday: '🎉',
  weather: '🌦️',
  strategy: '🧠',
  visualization: '📊',
};

function getAgentIcon(agentName = '') {
  const lower = agentName.toLowerCase();
  for (const [key, icon] of Object.entries(agentIcons)) {
    if (lower.includes(key)) return icon;
  }
  return 'AI';
}

function renderInteractiveChart(chart) {
  if (!chart?.chart_data || !chart.chart_data.labels || !chart.chart_data.datasets?.length) return null;

  const { chart_type, labels, datasets } = chart.chart_data;
  const data = { labels, datasets };
  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      tooltip: { enabled: true },
    },
    scales: {
      x: { ticks: { autoSkip: true, maxTicksLimit: 12 } },
      y: { beginAtZero: true },
    },
  };

  if (chart_type === 'pie') {
    return <Pie data={data} className="chartjs-canvas" />;
  }
  if (chart_type === 'line') {
    return <Line data={data} options={commonOptions} className="chartjs-canvas" />;
  }
  return <Bar data={data} options={commonOptions} className="chartjs-canvas" />;
}

function VinushanChatMessage({ message, agentSteps, routingReasoning, agentsUsed, charts }) {
  const isUser = message.role === 'user';

  return (
    <div className={`chat-message ${isUser ? 'user' : 'assistant'}`}>
      <div className="message-avatar" aria-label={isUser ? 'You' : 'ATHENA assistant'}>
        {isUser ? '👤' : 'ATH'}
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
            <span className="routing-label">🧠 Reasoning:</span>
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
