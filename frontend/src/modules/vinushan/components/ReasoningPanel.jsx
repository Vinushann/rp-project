import { useState, useEffect, useRef } from 'react';

/**
 * Enhanced Reasoning Panel Component
 * Shows real-time event timeline with agent activities, tool usage, and results
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
  conversational: '👋',
  historian: '📜',
  specialist: '📊',
};

const agentColors = {
  historical: { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', text: '#f59e0b' },
  historian: { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', text: '#f59e0b' },
  forecasting: { bg: 'rgba(59, 130, 246, 0.15)', border: '#3b82f6', text: '#3b82f6' },
  forecast: { bg: 'rgba(59, 130, 246, 0.15)', border: '#3b82f6', text: '#3b82f6' },
  holiday: { bg: 'rgba(236, 72, 153, 0.15)', border: '#ec4899', text: '#ec4899' },
  weather: { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', text: '#10b981' },
  strategy: { bg: 'rgba(139, 92, 246, 0.15)', border: '#8b5cf6', text: '#8b5cf6' },
  visualization: { bg: 'rgba(99, 102, 241, 0.15)', border: '#6366f1', text: '#6366f1' },
  specialist: { bg: 'rgba(99, 102, 241, 0.15)', border: '#6366f1', text: '#6366f1' },
  direct: { bg: 'rgba(107, 114, 128, 0.15)', border: '#6b7280', text: '#6b7280' },
  answering: { bg: 'rgba(234, 179, 8, 0.15)', border: '#eab308', text: '#eab308' },
  conversational: { bg: 'rgba(34, 197, 94, 0.15)', border: '#22c55e', text: '#22c55e' },
};

const eventTypeIcons = {
  run_start: '🚀',
  query_analysis: '🎯',
  agent_start: '▶️',
  tool_start: '🔧',
  tool_result: '✅',
  agent_output: '💭',
  agent_end: '✔️',
  run_end: '🏁',
  error: '❌',
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
  return { bg: 'rgba(156, 163, 175, 0.15)', border: '#9ca3af', text: '#9ca3af' };
}

function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    hour12: false 
  });
}

function getElapsedTime(startTime, endTime) {
  if (!startTime) return '';
  const start = new Date(startTime).getTime();
  const end = endTime ? new Date(endTime).getTime() : Date.now();
  const elapsed = (end - start) / 1000;
  if (elapsed < 60) return `${elapsed.toFixed(1)}s`;
  return `${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`;
}

function ReasoningPanel({ 
  isOpen, 
  onClose, 
  onClear,
  events = [],
  currentRunId,
  isLoading,
  routingReasoning,
  agentsNeeded = [],
}) {
  const [expandedEvents, setExpandedEvents] = useState({});
  const [elapsedTime, setElapsedTime] = useState('');
  const eventsEndRef = useRef(null);
  const panelRef = useRef(null);
  
  // Auto-scroll to latest event
  useEffect(() => {
    if (isLoading && eventsEndRef.current) {
      eventsEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [events, isLoading]);

  // Update elapsed time while loading
  const runStartTime = events.find(e => e.type === 'run_start')?.timestamp;
  useEffect(() => {
    let interval;
    if (isLoading && runStartTime) {
      interval = setInterval(() => {
        setElapsedTime(getElapsedTime(runStartTime));
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isLoading, runStartTime]);

  const toggleEvent = (idx) => {
    setExpandedEvents(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const hasContent = events.length > 0 || routingReasoning || agentsNeeded.length > 0;

  // Calculate progress
  const agentStartEvents = events.filter(e => e.type === 'agent_start');
  const agentEndEvents = events.filter(e => e.type === 'agent_end');
  const totalAgents = agentsNeeded.length || agentStartEvents.length;
  const completedAgents = agentEndEvents.length;
  const progress = totalAgents > 0 ? (completedAgents / totalAgents) * 100 : 0;

  return (
    <div className={`athena-reasoning-panel ${isOpen ? 'open' : ''}`} ref={panelRef}>
      {isOpen && (
        <>
          <div className="reasoning-header">
            <h3>
              <span>🧠</span>
              Reasoning Timeline
            </h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {hasContent && (
                <button 
                  className="reasoning-clear-btn" 
                  onClick={onClear}
                  title="Clear reasoning"
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--athena-border)',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    color: 'var(--athena-text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  Clear
                </button>
              )}
              <button className="reasoning-close" onClick={onClose} title="Close panel">
                ✕
              </button>
            </div>
          </div>

          <div className="reasoning-content">
            {!hasContent && !isLoading ? (
              <div className="reasoning-empty">
                <div className="reasoning-empty-icon">🔍</div>
                <h4>No reasoning yet</h4>
                <p>Ask a question to see real-time agent reasoning</p>
              </div>
            ) : (
              <>
                {/* Progress Bar */}
                {isLoading && totalAgents > 0 && (
                  <div className="reasoning-progress" style={{
                    marginBottom: '16px',
                    padding: '12px 16px',
                    background: 'var(--athena-surface)',
                    borderRadius: '12px',
                    border: '1px solid var(--athena-border)',
                  }}>
                    <div className="progress-header" style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '8px',
                      fontSize: '0.8rem',
                      color: 'var(--athena-text-secondary)',
                    }}>
                      <span>Progress</span>
                      <span>{completedAgents}/{totalAgents} agents</span>
                    </div>
                    <div className="progress-bar" style={{
                      height: '6px',
                      background: 'var(--athena-border)',
                      borderRadius: '3px',
                      overflow: 'hidden',
                    }}>
                      <div 
                        className="progress-fill"
                        style={{ 
                          width: `${progress}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, var(--athena-primary), var(--athena-secondary))',
                          borderRadius: '3px',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                    {runStartTime && (
                      <div className="progress-time" style={{
                        marginTop: '8px',
                        fontSize: '0.75rem',
                        color: 'var(--athena-text-muted)',
                        fontFamily: 'monospace',
                      }}>
                        ⏱️ {elapsedTime || getElapsedTime(runStartTime)}
                      </div>
                    )}
                  </div>
                )}

                {/* Routing Decision Card */}
                {routingReasoning && (
                  <div className="reasoning-routing-card" style={{
                    marginBottom: '16px',
                    padding: '16px',
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1))',
                    borderRadius: '12px',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                  }}>
                    <div className="routing-header" style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '12px',
                    }}>
                      <span className="routing-icon" style={{ fontSize: '1.2rem' }}>🎯</span>
                      <span className="routing-title" style={{
                        fontWeight: 600,
                        color: 'var(--athena-text)',
                      }}>Query Analysis</span>
                    </div>
                    <p className="routing-text" style={{
                      fontSize: '0.875rem',
                      color: 'var(--athena-text-secondary)',
                      lineHeight: 1.5,
                      margin: 0,
                    }}>{routingReasoning}</p>
                    {agentsNeeded.length > 0 && (
                      <div className="routing-agents" style={{ marginTop: '12px' }}>
                        <span className="routing-label" style={{
                          fontSize: '0.75rem',
                          color: 'var(--athena-text-muted)',
                          marginRight: '8px',
                        }}>Agents:</span>
                        <div className="agent-chips" style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '6px',
                          marginTop: '8px',
                        }}>
                          {agentsNeeded.map((agent, idx) => {
                            const colors = getAgentColor(agent);
                            return (
                              <span 
                                key={idx} 
                                className="agent-chip"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '4px 10px',
                                  fontSize: '0.75rem',
                                  borderRadius: '12px',
                                  background: colors.bg,
                                  border: `1px solid ${colors.border}`,
                                  color: colors.text,
                                  fontWeight: 500,
                                }}
                              >
                                {getAgentIcon(agent)} {agent}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Event Timeline */}
                {events.length > 0 && (
                  <div className="event-timeline" style={{ position: 'relative' }}>
                    {events.map((event, idx) => {
                      const isExpanded = expandedEvents[idx];
                      const agentColor = getAgentColor(event.agent || '');
                      const isActive = isLoading && 
                        (event.type === 'agent_start' || event.type === 'tool_start') &&
                        !events.slice(idx + 1).some(e => 
                          e.agent === event.agent && 
                          (e.type === 'agent_end' || e.type === 'tool_result')
                        );
                      
                      // Skip run_start from timeline (shown in progress)
                      if (event.type === 'run_start') return null;
                      
                      const isToolEvent = event.type === 'tool_start' || event.type === 'tool_result';
                      
                      return (
                        <div 
                          key={idx}
                          className={`timeline-event ${event.type} ${isActive ? 'active' : ''}`}
                          style={{
                            display: 'flex',
                            gap: '12px',
                            marginBottom: '4px',
                            paddingLeft: isToolEvent ? '24px' : '0',
                            animation: 'slideIn 0.3s ease',
                          }}
                        >
                          <div className="timeline-connector" style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            width: '20px',
                          }}>
                            <div 
                              className={`timeline-dot ${isActive ? 'pulse' : ''}`}
                              style={{
                                width: isToolEvent ? '8px' : '12px',
                                height: isToolEvent ? '8px' : '12px',
                                borderRadius: '50%',
                                background: isActive 
                                  ? 'var(--athena-primary)' 
                                  : event.type === 'agent_end' || event.type === 'tool_result'
                                    ? '#22c55e'
                                    : agentColor.border,
                                boxShadow: isActive ? '0 0 10px var(--athena-primary)' : 'none',
                                flexShrink: 0,
                              }}
                            />
                            {idx < events.length - 1 && (
                              <div className="timeline-line" style={{
                                width: '2px',
                                flex: 1,
                                minHeight: '20px',
                                background: 'var(--athena-border)',
                              }} />
                            )}
                          </div>
                          
                          <div 
                            className="timeline-content"
                            onClick={() => event.data && Object.keys(event.data).length > 0 && toggleEvent(idx)}
                            style={{ 
                              flex: 1,
                              padding: '8px 12px',
                              background: isActive ? 'rgba(99, 102, 241, 0.1)' : 'var(--athena-surface)',
                              borderRadius: '8px',
                              border: isActive ? '1px solid var(--athena-primary)' : '1px solid var(--athena-border)',
                              cursor: event.data && Object.keys(event.data).length > 0 ? 'pointer' : 'default',
                              marginBottom: '8px',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            <div className="timeline-header" style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              marginBottom: '4px',
                            }}>
                              <span className="event-icon" style={{ fontSize: '0.9rem' }}>
                                {eventTypeIcons[event.type] || '📌'}
                              </span>
                              {event.agent && (
                                <span className="event-agent" style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  color: agentColor.text,
                                }}>
                                  <span className="agent-emoji">{getAgentIcon(event.agent)}</span>
                                  {event.agent}
                                </span>
                              )}
                              <span className="event-time" style={{
                                marginLeft: 'auto',
                                fontSize: '0.7rem',
                                color: 'var(--athena-text-muted)',
                                fontFamily: 'monospace',
                              }}>{formatTimestamp(event.timestamp)}</span>
                            </div>
                            
                            <div className="timeline-body">
                              <p className="event-content" style={{
                                fontSize: '0.8rem',
                                color: 'var(--athena-text-secondary)',
                                margin: 0,
                                lineHeight: 1.4,
                              }}>{event.content}</p>
                              
                              {/* Tool info */}
                              {event.data?.tool_name && (
                                <div className="tool-badge" style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  marginTop: '6px',
                                  padding: '2px 8px',
                                  fontSize: '0.7rem',
                                  background: 'rgba(245, 158, 11, 0.15)',
                                  border: '1px solid rgba(245, 158, 11, 0.3)',
                                  borderRadius: '4px',
                                  color: '#f59e0b',
                                }}>
                                  🔧 {event.data.tool_name}
                                </div>
                              )}
                              
                              {/* Expanded details */}
                              {isExpanded && event.data && (
                                <div className="event-details" style={{
                                  marginTop: '8px',
                                  padding: '8px',
                                  background: 'var(--athena-bg)',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                }}>
                                  {event.data.result_preview && (
                                    <div className="detail-item" style={{ marginBottom: '8px' }}>
                                      <span className="detail-label" style={{
                                        display: 'block',
                                        fontWeight: 600,
                                        color: 'var(--athena-text-muted)',
                                        marginBottom: '4px',
                                      }}>Result:</span>
                                      <pre className="detail-value" style={{
                                        margin: 0,
                                        padding: '8px',
                                        background: 'var(--athena-surface)',
                                        borderRadius: '4px',
                                        overflow: 'auto',
                                        maxHeight: '150px',
                                        fontSize: '0.7rem',
                                        color: 'var(--athena-text-secondary)',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                      }}>{event.data.result_preview}</pre>
                                    </div>
                                  )}
                                  {event.data.output_preview && (
                                    <div className="detail-item" style={{ marginBottom: '8px' }}>
                                      <span className="detail-label" style={{
                                        display: 'block',
                                        fontWeight: 600,
                                        color: 'var(--athena-text-muted)',
                                        marginBottom: '4px',
                                      }}>Output:</span>
                                      <pre className="detail-value" style={{
                                        margin: 0,
                                        padding: '8px',
                                        background: 'var(--athena-surface)',
                                        borderRadius: '4px',
                                        overflow: 'auto',
                                        maxHeight: '150px',
                                        fontSize: '0.7rem',
                                        color: 'var(--athena-text-secondary)',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                      }}>{event.data.output_preview}</pre>
                                    </div>
                                  )}
                                  {event.data.step_number && (
                                    <div className="detail-item">
                                      <span className="detail-label" style={{ color: 'var(--athena-text-muted)' }}>Step: </span>
                                      <span className="detail-value" style={{ color: 'var(--athena-text-secondary)' }}>
                                        {event.data.step_number}
                                        {event.data.total_steps && ` of ${event.data.total_steps}`}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {/* Expand hint */}
                              {event.data && Object.keys(event.data).length > 0 && (event.data.result_preview || event.data.output_preview) && (
                                <button className="expand-hint" style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--athena-primary)',
                                  fontSize: '0.7rem',
                                  cursor: 'pointer',
                                  padding: '4px 0',
                                  marginTop: '4px',
                                }}>
                                  {isExpanded ? '▼ Less' : '▶ More details'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Loading indicator at end */}
                    {isLoading && (
                      <div className="timeline-event loading" style={{
                        display: 'flex',
                        gap: '12px',
                        marginBottom: '4px',
                      }}>
                        <div className="timeline-connector" style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          width: '20px',
                        }}>
                          <div 
                            className="timeline-dot pulse"
                            style={{
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              background: 'var(--athena-primary)',
                              boxShadow: '0 0 10px var(--athena-primary)',
                              animation: 'pulse 1.5s infinite',
                            }}
                          />
                        </div>
                        <div className="timeline-content" style={{
                          flex: 1,
                          padding: '8px 12px',
                          background: 'var(--athena-surface)',
                          borderRadius: '8px',
                          border: '1px solid var(--athena-border)',
                        }}>
                          <div className="loading-dots" style={{
                            display: 'flex',
                            gap: '4px',
                          }}>
                            <span style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: 'var(--athena-primary)',
                              animation: 'bounce 1.4s infinite ease-in-out both',
                              animationDelay: '0s',
                            }}></span>
                            <span style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: 'var(--athena-primary)',
                              animation: 'bounce 1.4s infinite ease-in-out both',
                              animationDelay: '0.16s',
                            }}></span>
                            <span style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: 'var(--athena-primary)',
                              animation: 'bounce 1.4s infinite ease-in-out both',
                              animationDelay: '0.32s',
                            }}></span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div ref={eventsEndRef} />
                  </div>
                )}

                {/* Run complete summary */}
                {!isLoading && events.some(e => e.type === 'run_end') && (
                  <div className="run-complete" style={{
                    marginTop: '16px',
                    padding: '16px',
                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.1))',
                    borderRadius: '12px',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    textAlign: 'center',
                  }}>
                    <div className="complete-icon" style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🏁</div>
                    <div className="complete-text" style={{
                      fontWeight: 600,
                      color: '#22c55e',
                      marginBottom: '4px',
                    }}>Analysis Complete</div>
                    {runStartTime && (
                      <div className="complete-time" style={{
                        fontSize: '0.8rem',
                        color: 'var(--athena-text-secondary)',
                      }}>
                        Total time: {getElapsedTime(runStartTime, events.find(e => e.type === 'run_end')?.timestamp)}
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
