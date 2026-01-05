import { useState, useEffect, useRef } from 'react';

/**
 * Agent Thoughts Panel - Clean, professional display of agent reasoning
 * Shows structured thinking phases: PLAN → DATA QUERY → SELF-CHECK → RESULT
 */

// Phase labels for structured thoughts
const PHASE_LABELS = {
  router_thought: 'router',
  plan: 'plan',
  data_query: 'data_query',
  self_check: 'self_check',
  result_snapshot: 'result',
};

const PHASE_DISPLAY = {
  router: 'ROUTING',
  plan: 'PLAN',
  data_query: 'DATA QUERY',
  self_check: 'SELF-CHECK',
  result: 'RESULT', 
};

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

// Thought Block Component - renders a single thought phase
function ThoughtBlock({ phase, text, timestamp, isActive }) {
  const phaseLabel = PHASE_DISPLAY[phase] || phase?.toUpperCase();
  
  return (
    <div className={`thought-block ${isActive ? 'active' : ''}`}>
      <div className="thought-header">
        <span className="thought-phase">[{phaseLabel}]</span>
        {timestamp && <span className="thought-time">{formatTimestamp(timestamp)}</span>}
      </div>
      <div className="thought-content">
        <pre>{text}</pre>
      </div>
    </div>
  );
}

// Agent Section - groups thoughts by agent
function AgentSection({ agentName, thoughts, isActive, isCompleted }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const displayName = agentName?.replace(/_/g, ' ') || 'unknown';
  
  return (
    <div className={`agent-section ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
      <div 
        className="agent-header"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="agent-status">
          {isActive && <span className="status-indicator active" />}
          {isCompleted && <span className="status-indicator completed" />}
          {!isActive && !isCompleted && <span className="status-indicator pending" />}
        </div>
        <span className="agent-name">{displayName}</span>
        <span className="collapse-icon">{isCollapsed ? '+' : '-'}</span>
      </div>
      
      {!isCollapsed && (
        <div className="agent-thoughts">
          {thoughts.map((thought, idx) => (
            <ThoughtBlock 
              key={idx}
              phase={thought.phase}
              text={thought.text}
              timestamp={thought.timestamp}
              isActive={isActive && idx === thoughts.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Router Thought Component
function RouterThought({ text, timestamp, agentsNeeded }) {
  return (
    <div className="router-section">
      <div className="router-header">
        <span className="router-label">[router_thought]</span>
        {timestamp && <span className="router-time">{formatTimestamp(timestamp)}</span>}
      </div>
      <div className="router-content">
        <pre>{text}</pre>
      </div>
      {agentsNeeded && agentsNeeded.length > 0 && (
        <div className="router-agents">
          <span className="agents-label">agents to run:</span>
          <div className="agents-list">
            {agentsNeeded.map((agent, idx) => (
              <span key={idx} className="agent-tag">- {agent}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Main Panel Component
function AgentThoughtsPanel({ 
  isOpen, 
  onClose, 
  onClear,
  events = [],
  currentRunId,
  isLoading,
  routingReasoning,
  agentsNeeded = [],
}) {
  const [elapsedTime, setElapsedTime] = useState('');
  const eventsEndRef = useRef(null);
  const panelRef = useRef(null);
  
  // Auto-scroll to latest
  useEffect(() => {
    if (isLoading && eventsEndRef.current) {
      eventsEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [events, isLoading]);

  // Track elapsed time
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

  // Process events into structured thoughts
  const processEvents = () => {
    const agentThoughts = {};
    const completedAgents = new Set();
    const activeAgent = { name: null };
    
    events.forEach(event => {
      if (event.type === 'agent_thought' || event.type === 'agent_query' || 
          event.type === 'agent_self_check' || event.type === 'agent_result_snapshot') {
        const agentName = event.agent || 'unknown';
        if (!agentThoughts[agentName]) {
          agentThoughts[agentName] = [];
        }
        agentThoughts[agentName].push({
          phase: event.phase || event.type.replace('agent_', ''),
          text: event.content || event.text || '',
          timestamp: event.timestamp
        });
        activeAgent.name = agentName;
      } else if (event.type === 'agent_start') {
        const agentName = event.agent || 'unknown';
        if (!agentThoughts[agentName]) {
          agentThoughts[agentName] = [];
        }
        activeAgent.name = agentName;
      } else if (event.type === 'agent_end') {
        completedAgents.add(event.agent);
        if (activeAgent.name === event.agent) {
          activeAgent.name = null;
        }
      } else if (event.type === 'tool_start') {
        // Convert tool events to data_query thoughts
        const agentName = event.agent || 'unknown';
        if (!agentThoughts[agentName]) {
          agentThoughts[agentName] = [];
        }
        const toolName = event.data?.tool_name || 'tool';
        agentThoughts[agentName].push({
          phase: 'data_query',
          text: `invoking ${toolName}\n${event.content || ''}`,
          timestamp: event.timestamp
        });
      } else if (event.type === 'tool_result') {
        const agentName = event.agent || 'unknown';
        if (!agentThoughts[agentName]) {
          agentThoughts[agentName] = [];
        }
        const preview = event.data?.result_preview || event.content || '';
        agentThoughts[agentName].push({
          phase: 'result',
          text: preview.substring(0, 300) + (preview.length > 300 ? '...' : ''),
          timestamp: event.timestamp
        });
      }
    });
    
    return { agentThoughts, completedAgents, activeAgent: activeAgent.name };
  };

  const { agentThoughts, completedAgents, activeAgent } = processEvents();
  const hasContent = events.length > 0 || routingReasoning || agentsNeeded.length > 0;
  const isRunComplete = events.some(e => e.type === 'run_end');

  return (
    <div className={`agent-thoughts-panel ${isOpen ? 'open' : ''}`} ref={panelRef}>
      {isOpen && (
        <>
          <div className="thoughts-header">
            <h3>Agent Thoughts</h3>
            <div className="header-controls">
              {hasContent && (
                <button className="clear-btn" onClick={onClear}>
                  clear
                </button>
              )}
              <button className="close-btn" onClick={onClose}>
                x
              </button>
            </div>
          </div>

          <div className="thoughts-content">
            {!hasContent && !isLoading ? (
              <div className="thoughts-empty">
                <p>no active reasoning</p>
                <p className="hint">ask a question to see agent thoughts</p>
              </div>
            ) : (
              <>
                {/* Progress indicator */}
                {isLoading && (
                  <div className="progress-bar">
                    <div className="progress-text">
                      <span>processing</span>
                      {elapsedTime && <span className="elapsed">{elapsedTime}</span>}
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" />
                    </div>
                  </div>
                )}

                {/* Router thought */}
                {routingReasoning && (
                  <RouterThought 
                    text={routingReasoning}
                    timestamp={events.find(e => e.type === 'query_analysis')?.timestamp}
                    agentsNeeded={agentsNeeded}
                  />
                )}

                {/* Agent sections */}
                <div className="agents-container">
                  {Object.entries(agentThoughts).map(([agentName, thoughts]) => (
                    <AgentSection
                      key={agentName}
                      agentName={agentName}
                      thoughts={thoughts}
                      isActive={activeAgent === agentName}
                      isCompleted={completedAgents.has(agentName)}
                    />
                  ))}
                </div>

                {/* Loading indicator */}
                {isLoading && (
                  <div className="thinking-indicator">
                    <span className="dot" />
                    <span className="dot" />
                    <span className="dot" />
                  </div>
                )}

                {/* Completion status */}
                {isRunComplete && (
                  <div className="run-complete">
                    <span className="complete-marker">[complete]</span>
                    {runStartTime && (
                      <span className="complete-time">
                        total: {getElapsedTime(runStartTime, events.find(e => e.type === 'run_end')?.timestamp)}
                      </span>
                    )}
                  </div>
                )}

                <div ref={eventsEndRef} />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default AgentThoughtsPanel;
