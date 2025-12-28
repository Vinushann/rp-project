import { useState } from 'react';

/**
 * Reasoning Panel Component
 * Shows detailed agent reasoning steps, routing decisions, and outputs
 */

const agentIcons = {
  historical: '📜',
  forecasting: '📈',
  forecast: '📈',
  holiday: '🎉',
  weather: '🌦️',
  strategy: '🧠',
  visualization: '📊',
  direct: '💬',
  answering: '💡',
};

const agentColors = {
  historical: { bg: '#fef3c7', border: '#f59e0b' },
  forecasting: { bg: '#dbeafe', border: '#3b82f6' },
  forecast: { bg: '#dbeafe', border: '#3b82f6' },
  holiday: { bg: '#fce7f3', border: '#ec4899' },
  weather: { bg: '#d1fae5', border: '#10b981' },
  strategy: { bg: '#ede9fe', border: '#8b5cf6' },
  visualization: { bg: '#e0e7ff', border: '#6366f1' },
  direct: { bg: '#f3f4f6', border: '#6b7280' },
  answering: { bg: '#fef9c3', border: '#eab308' },
};

function getAgentIcon(agentName = '') {
  const lower = agentName.toLowerCase();
  for (const [key, icon] of Object.entries(agentIcons)) {
    if (lower.includes(key)) return icon;
  }
  return '🤖';
}

function getAgentColor(agentName = '') {
  const lower = agentName.toLowerCase();
  for (const [key, colors] of Object.entries(agentColors)) {
    if (lower.includes(key)) return colors;
  }
  return { bg: '#f3f4f6', border: '#9ca3af' };
}

function ReasoningPanel({ 
  isOpen, 
  onClose, 
  routingReasoning, 
  agentsUsed = [], 
  agentSteps = [],
  activeAgents = [],
  statusMessage,
  isLoading 
}) {
  const [expandedSteps, setExpandedSteps] = useState({});

  const toggleStep = (idx) => {
    setExpandedSteps(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const hasContent = routingReasoning || agentsUsed.length > 0 || agentSteps.length > 0 || activeAgents.length > 0;

  return (
    <div className={`athena-reasoning-panel ${isOpen ? 'open' : ''}`}>
      {isOpen && (
        <>
          <div className="reasoning-header">
            <h3>
              <span>🧠</span>
              Reasoning
            </h3>
            <button className="reasoning-close" onClick={onClose} title="Close panel">
              ✕
            </button>
          </div>

          <div className="reasoning-content">
            {!hasContent && !isLoading ? (
              <div className="reasoning-empty">
                <div className="reasoning-empty-icon">🔍</div>
                <h4>No reasoning yet</h4>
                <p>Ask a question to see how the AI agents process your request</p>
              </div>
            ) : (
              <>
                {/* Routing Decision */}
                {routingReasoning && (
                  <div className="reasoning-section">
                    <div className="reasoning-section-title">
                      <span>🎯</span>
                      Routing Decision
                    </div>
                    <div className="routing-card">
                      <p>{routingReasoning}</p>
                    </div>
                  </div>
                )}

                {/* Agents Used */}
                {agentsUsed.length > 0 && (
                  <div className="reasoning-section">
                    <div className="reasoning-section-title">
                      <span>🤖</span>
                      Agents Activated ({agentsUsed.length})
                    </div>
                    <div className="agents-badges">
                      {agentsUsed.map((agent, idx) => (
                        <div 
                          key={idx} 
                          className="agent-badge-item"
                          style={{ animationDelay: `${idx * 0.1}s` }}
                        >
                          <span>{getAgentIcon(agent)}</span>
                          <span>{agent}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Agent Steps */}
                {agentSteps.length > 0 && (
                  <div className="reasoning-section">
                    <div className="reasoning-section-title">
                      <span>📋</span>
                      Processing Steps ({agentSteps.length})
                    </div>
                    
                    {agentSteps.map((step, idx) => {
                      const colors = getAgentColor(step.agent_name);
                      const isExpanded = expandedSteps[idx];
                      
                      return (
                        <div 
                          key={idx} 
                          className="agent-step-card"
                          style={{ 
                            animationDelay: `${idx * 0.15}s`,
                            borderLeftColor: colors.border,
                            borderLeftWidth: '4px'
                          }}
                        >
                          <div 
                            className="step-header"
                            onClick={() => toggleStep(idx)}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className="step-icon">
                              {getAgentIcon(step.agent_name)}
                            </div>
                            <div className="step-info">
                              <p className="step-agent-name">
                                {step.agent_name || 'Unknown Agent'}
                              </p>
                              <p className="step-task-name">
                                {step.task_name || 'Processing...'}
                              </p>
                            </div>
                            <div className="step-number">
                              {idx + 1}
                            </div>
                          </div>
                          
                          <div className="step-body">
                            {step.summary && (
                              <p className="step-summary">
                                {step.summary}
                              </p>
                            )}
                            
                            {step.output_preview && (
                              <>
                                <button
                                  onClick={() => toggleStep(idx)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--athena-primary)',
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    padding: '4px 0',
                                    fontWeight: 500,
                                  }}
                                >
                                  {isExpanded ? '▼ Hide output' : '▶ Show output'}
                                </button>
                                {isExpanded && (
                                  <div className="step-output">
                                    {step.output_preview}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Loading state for reasoning */}
                {isLoading && (
                  <div className="reasoning-section">
                    <div className="reasoning-section-title">
                      <span>⚡</span>
                      {statusMessage || 'Processing...'}
                    </div>
                    
                    {/* Show active agents being processed */}
                    {activeAgents.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        {activeAgents.map((agent, idx) => (
                          <div 
                            key={idx}
                            className="agent-step-card active-agent"
                            style={{ 
                              borderLeftColor: getAgentColor(agent.name).border,
                              borderLeftWidth: '4px',
                              animation: 'pulse 2s infinite'
                            }}
                          >
                            <div className="step-header">
                              <div className="step-icon pulse-icon">
                                {getAgentIcon(agent.name)}
                              </div>
                              <div className="step-info">
                                <p className="step-agent-name">
                                  {agent.name}
                                </p>
                                <p className="step-task-name">
                                  {agent.description || agent.task || 'Processing...'}
                                </p>
                              </div>
                              <div className="loading-dots small-dots">
                                <span></span>
                                <span></span>
                                <span></span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {activeAgents.length === 0 && (
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '12px',
                        padding: '16px',
                        background: 'var(--athena-bg)',
                        borderRadius: '12px',
                        border: '1px solid var(--athena-border)'
                      }}>
                        <div className="loading-dots">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                        <span style={{ fontSize: '0.875rem', color: 'var(--athena-text-secondary)' }}>
                          {statusMessage || 'Agents are analyzing your question...'}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default ReasoningPanel;
