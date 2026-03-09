import { useState, useEffect, useRef, useMemo } from 'react';

/**
 * AI Reasoning Panel — Clean professional step-by-step process view
 * Shows: Query Analysis → Knowledge Retrieval → Agent Execution → XAI → Complete
 */

/* ─── Utilities ─── */
function fmtTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

function fmtDuration(s) {
  if (!s && s !== 0) return '';
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`;
}

function fmtElapsed(start, end) {
  if (!start) return '';
  const s = ((end ? new Date(end) : new Date()) - new Date(start)) / 1000;
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`;
}

function cleanAgentName(name) {
  if (!name) return 'Agent';
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/* ─── SVG Icons ─── */
function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M3 6l2 2.5L9 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="ar-spinner" width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="12 22" strokeLinecap="round"/>
    </svg>
  );
}

/* ─── Content Formatter ─── */
function Content({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let listBuf = [];

  const flush = (key) => {
    if (listBuf.length > 0) {
      elements.push(
        <ul key={key} className="ar-list">
          {listBuf.map((item, j) => <li key={j}>{item}</li>)}
        </ul>
      );
      listBuf = [];
    }
  };

  lines.forEach((line, i) => {
    const t = line.trim();
    if (!t) { flush(`l-${i}`); return; }

    if (/^[-•*]\s/.test(t)) {
      listBuf.push(t.replace(/^[-•*]\s*/, ''));
      return;
    }

    flush(`l-${i}`);

    if (t.endsWith(':') && t.length < 60) {
      elements.push(<p key={i} className="ar-heading">{t}</p>);
      return;
    }

    if (/^(DATASET|FILE|SQL|QUERY):/i.test(t)) {
      const [label, ...rest] = t.split(':');
      elements.push(
        <div key={i} className="ar-code-block">
          <span className="ar-code-label">{label}</span>
          <code>{rest.join(':').trim()}</code>
        </div>
      );
      return;
    }

    if (/\.(csv|json|py|sql|txt|md)\b/.test(t) && t.length < 120) {
      elements.push(<code key={i} className="ar-filepath">{t}</code>);
      return;
    }

    elements.push(<p key={i} className="ar-text">{t}</p>);
  });

  flush('l-end');
  return <>{elements}</>;
}

/* ─── Thought Labels ─── */
const THOUGHT_LABELS = {
  plan: 'Planning',
  data_query: 'Data Access',
  self_check: 'Verification',
  result: 'Result',
  thought: 'Reasoning',
  query: 'Query',
  result_snapshot: 'Result',
  xai: 'Explainability',
};

/* ─── Step Component ─── */
function Step({ number, title, status, time, duration, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`ar-step ar-step--${status}`}>
      <div className="ar-step-rail">
        <div className={`ar-step-indicator ar-step-indicator--${status}`}>
          {status === 'done' && <CheckIcon />}
          {status === 'active' && <SpinnerIcon />}
          {status === 'pending' && <span className="ar-step-num">{String(number).padStart(2, '0')}</span>}
        </div>
        <div className="ar-step-line" />
      </div>

      <div className="ar-step-content">
        <button className="ar-step-header" onClick={() => setOpen(!open)}>
          <div className="ar-step-title-row">
            <span className="ar-step-title">{title}</span>
          </div>
          <div className="ar-step-meta">
            {duration && <span className="ar-duration">{duration}</span>}
            {time && <span className="ar-time">{time}</span>}
            <span className={`ar-chevron ${open ? 'open' : ''}`}>
              <svg width="12" height="12" viewBox="0 0 12 12"><path d="M4 5l2 2 2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>
            </span>
          </div>
        </button>

        {open && children && (
          <div className="ar-step-body">{children}</div>
        )}
      </div>
    </div>
  );
}

/* ─── Thought Entry (agent sub-step) ─── */
function ThoughtEntry({ label, text, time }) {
  return (
    <div className="ar-thought">
      <div className="ar-thought-header">
        <span className="ar-thought-dot" />
        <span className="ar-thought-label">{label}</span>
        {time && <span className="ar-thought-time">{time}</span>}
      </div>
      <div className="ar-thought-body">
        <Content text={text} />
      </div>
    </div>
  );
}

/* ─── Main Panel ─── */
function AgentThoughtsPanel({
  isOpen, onClose, onClear,
  events = [], currentRunId, isLoading,
  routingReasoning, agentsNeeded = [],
}) {
  const [elapsed, setElapsed] = useState('');
  const endRef = useRef(null);

  const runStart = events.find(e => e.type === 'run_start')?.timestamp;
  const runEnd = events.find(e => e.type === 'run_end')?.timestamp;
  const isComplete = !!runEnd;

  useEffect(() => {
    if (isLoading && endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [events, isLoading]);

  useEffect(() => {
    let iv;
    if (isLoading && runStart) {
      iv = setInterval(() => setElapsed(fmtElapsed(runStart)), 100);
    }
    return () => clearInterval(iv);
  }, [isLoading, runStart]);

  const timeline = useMemo(() => {
    const agents = {};
    const completedSet = new Set();
    let activeAgent = null;

    events.forEach(event => {
      const a = event.agent || 'unknown';
      switch (event.type) {
        case 'agent_start':
          if (!agents[a]) agents[a] = { thoughts: [], completed: false, duration: null, startTime: event.timestamp };
          activeAgent = a;
          break;
        case 'agent_thought':
        case 'agent_query':
        case 'agent_self_check':
        case 'agent_result_snapshot':
          if (!agents[a]) agents[a] = { thoughts: [], completed: false, duration: null };
          agents[a].thoughts.push({
            phase: event.phase || event.type.replace('agent_', ''),
            text: event.content || event.text || '',
            timestamp: event.timestamp,
          });
          activeAgent = a;
          break;
        case 'tool_start': {
          if (!agents[a]) agents[a] = { thoughts: [], completed: false, duration: null };
          agents[a].thoughts.push({
            phase: 'data_query',
            text: `Invoking ${event.data?.tool_name || 'tool'}\n${event.content || ''}`,
            timestamp: event.timestamp,
          });
          break;
        }
        case 'tool_result': {
          if (!agents[a]) agents[a] = { thoughts: [], completed: false, duration: null };
          const preview = event.data?.result_preview || event.content || '';
          agents[a].thoughts.push({
            phase: 'result',
            text: preview.substring(0, 300) + (preview.length > 300 ? '…' : ''),
            timestamp: event.timestamp,
          });
          break;
        }
        case 'agent_end':
          completedSet.add(a);
          if (agents[a]) {
            agents[a].completed = true;
            agents[a].duration = event.data?.duration_seconds;
          }
          if (activeAgent === a) activeAgent = null;
          break;
      }
    });

    const ragEvents = events.filter(e => e.type === 'rag_retrieval');
    const ragComplete = ragEvents.find(e => e.data?.chunks_retrieved);
    const xaiEvents = events.filter(e => e.type === 'xai_explanation');
    const xaiComplete = xaiEvents.find(e => e.data?.status === 'complete');

    return { agents, completedSet, activeAgent, ragEvents, ragComplete, xaiEvents, xaiComplete };
  }, [events]);

  const { agents, completedSet, activeAgent, ragEvents, ragComplete, xaiEvents, xaiComplete } = timeline;
  const hasContent = events.length > 0 || routingReasoning || agentsNeeded.length > 0;

  let stepNum = 0;

  return (
    <div className={`ar-panel ${isOpen ? 'open' : ''}`}>
      {isOpen && (
        <>
          {/* Header */}
          <div className="ar-header">
            <div className="ar-header-left">
              <h3 className="ar-title">AI Reasoning</h3>
              {isLoading && !isComplete && (
                <div className="ar-status">
                  <span className="ar-status-dot" />
                  <span className="ar-status-text">Processing{elapsed ? ` · ${elapsed}` : ''}</span>
                </div>
              )}
              {isComplete && (
                <div className="ar-status ar-status--done">
                  <span className="ar-status-text">Completed in {fmtElapsed(runStart, runEnd)}</span>
                </div>
              )}
            </div>
            <div className="ar-header-actions">
              {hasContent && <button className="ar-btn" onClick={onClear}>Clear</button>}
              <button className="ar-btn ar-btn--close" onClick={onClose}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
          </div>

          {/* Progress bar */}
          {isLoading && !isComplete && (
            <div className="ar-progress">
              <div className="ar-progress-bar" />
            </div>
          )}

          {/* Content */}
          <div className="ar-content">
            {!hasContent && !isLoading ? (
              <div className="ar-empty">
                <div className="ar-empty-icon">
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <rect x="4" y="8" width="32" height="24" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M12 16h16M12 20h10M12 24h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <p className="ar-empty-title">No active reasoning</p>
                <p className="ar-empty-hint">Ask ATHENA a question to see the step-by-step process</p>
              </div>
            ) : (
              <div className="ar-timeline">

                {/* Step: Query Analysis */}
                {routingReasoning && (() => {
                  stepNum++;
                  return (
                    <Step
                      number={stepNum}
                      title="Query Analysis"
                      status="done"
                      time={fmtTime(events.find(e => e.type === 'query_analysis')?.timestamp)}
                    >
                      <Content text={routingReasoning} />
                      {agentsNeeded.length > 0 && (
                        <div className="ar-agents-assigned">
                          <span className="ar-label">Specialists assigned</span>
                          <div className="ar-tags">
                            {agentsNeeded.map((agent, i) => (
                              <span key={i} className="ar-tag ar-tag--accent">{agent}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </Step>
                  );
                })()}

                {/* Step: Knowledge Retrieval */}
                {ragEvents.length > 0 && (() => {
                  stepNum++;
                  const ragStatus = ragComplete ? 'done' : (isLoading ? 'active' : 'pending');
                  const ragData = ragComplete?.data;

                  return (
                    <Step
                      number={stepNum}
                      title="Knowledge Retrieval"
                      status={ragStatus}
                      time={fmtTime(ragEvents[0]?.timestamp)}
                      duration={ragComplete ? `${ragData?.chunks_after_filter ?? ragData?.chunks_retrieved} chunks` : null}
                    >
                      {ragComplete ? (
                        <div className="ar-rag">
                          {ragData?.query_type && (
                            <div className="ar-rag-row">
                              <span className="ar-label">Query type</span>
                              <span className="ar-tag ar-tag--accent">{ragData.query_type}</span>
                              {ragData.classification_reasoning && (
                                <p className="ar-muted">{ragData.classification_reasoning}</p>
                              )}
                            </div>
                          )}

                          {ragData?.topics?.length > 0 && (
                            <div className="ar-rag-row">
                              <span className="ar-label">Topics</span>
                              <div className="ar-tags">
                                {ragData.topics.map((t, i) => <span key={i} className="ar-tag">{t}</span>)}
                              </div>
                            </div>
                          )}

                          <div className="ar-rag-stats">
                            <div className="ar-stat">
                              <span className="ar-stat-value">{ragData?.chunks_retrieved ?? 0}</span>
                              <span className="ar-stat-label">Retrieved</span>
                            </div>
                            <div className="ar-stat-arrow">→</div>
                            <div className="ar-stat">
                              <span className="ar-stat-value ar-stat-value--accent">{ragData?.chunks_after_filter ?? ragData?.chunks_retrieved ?? 0}</span>
                              <span className="ar-stat-label">After filter</span>
                            </div>
                            <div className="ar-stat">
                              <span className="ar-stat-value">{ragData?.source_documents?.length || 0}</span>
                              <span className="ar-stat-label">Sources</span>
                            </div>
                          </div>

                          {ragData?.citations?.length > 0 && (
                            <div className="ar-citations">
                              <span className="ar-label">Source relevance</span>
                              {ragData.citations.map((cite, i) => {
                                const score = cite.score ?? cite.relevance_score ?? 0;
                                const pct = Math.round(Math.max(0, Math.min(1, score)) * 100);
                                return (
                                  <div key={i} className="ar-cite">
                                    <span className="ar-cite-name">{cite.heading || cite.source}</span>
                                    <div className="ar-cite-bar">
                                      <div className="ar-cite-fill" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="ar-cite-score">{pct}%</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="ar-text">Searching knowledge base…</p>
                      )}
                    </Step>
                  );
                })()}

                {/* Steps: Agent Execution */}
                {Object.entries(agents).map(([name, data]) => {
                  stepNum++;
                  const isAgentActive = activeAgent === name;
                  const isAgentDone = completedSet.has(name);
                  const status = isAgentDone ? 'done' : (isAgentActive ? 'active' : 'pending');

                  return (
                    <Step
                      key={name}
                      number={stepNum}
                      title={cleanAgentName(name)}
                      status={status}
                      time={fmtTime(data.startTime || data.thoughts[0]?.timestamp)}
                      duration={isAgentDone && data.duration ? fmtDuration(data.duration) : null}
                    >
                      {data.thoughts.map((thought, ti) => (
                        <ThoughtEntry
                          key={ti}
                          label={THOUGHT_LABELS[thought.phase] || thought.phase || 'Step'}
                          text={thought.text}
                          time={fmtTime(thought.timestamp)}
                        />
                      ))}
                    </Step>
                  );
                })}

                {/* Step: Explainability */}
                {xaiEvents.length > 0 && (() => {
                  stepNum++;
                  const xaiStatus = xaiComplete ? 'done' : (isLoading ? 'active' : 'pending');
                  const xd = xaiComplete?.data;

                  return (
                    <Step
                      number={stepNum}
                      title="Explainability Analysis"
                      status={xaiStatus}
                      time={fmtTime(xaiEvents[0]?.timestamp)}
                    >
                      {xaiComplete ? (
                        <div className="ar-xai">
                          {xd?.overall_confidence != null && (
                            <div className="ar-xai-confidence">
                              <span className="ar-label">Overall confidence</span>
                              <div className="ar-confidence-meter">
                                <div className="ar-confidence-fill" style={{ width: `${xd.overall_confidence}%` }} />
                                <span className="ar-confidence-value">{xd.overall_confidence}%</span>
                              </div>
                            </div>
                          )}

                          {xd?.decision_factors?.length > 0 && (
                            <div className="ar-xai-section">
                              <span className="ar-label">Decision factors</span>
                              {xd.decision_factors
                                .sort((a, b) => (b.influence || 0) - (a.influence || 0))
                                .map((f, i) => (
                                  <div key={i} className="ar-factor">
                                    <div className="ar-factor-header">
                                      <span className="ar-factor-name">{f.factor}</span>
                                      <span className="ar-factor-pct">{f.influence}%</span>
                                    </div>
                                    <div className="ar-factor-bar">
                                      <div className="ar-factor-fill" style={{ width: `${f.influence}%` }} />
                                    </div>
                                    {f.reasoning && <p className="ar-muted ar-small">{f.reasoning}</p>}
                                  </div>
                                ))}
                            </div>
                          )}

                          {xd?.agent_contributions?.length > 0 && (
                            <div className="ar-xai-section">
                              <span className="ar-label">Agent contributions</span>
                              {xd.agent_contributions.map((ac, i) => (
                                <div key={i} className="ar-factor">
                                  <div className="ar-factor-header">
                                    <span className="ar-factor-name">{ac.agent}</span>
                                    <span className="ar-factor-pct">{ac.influence_pct}%</span>
                                  </div>
                                  <div className="ar-factor-bar ar-factor-bar--cyan">
                                    <div className="ar-factor-fill" style={{ width: `${ac.influence_pct}%` }} />
                                  </div>
                                  {ac.contribution && <p className="ar-muted ar-small">{ac.contribution}</p>}
                                </div>
                              ))}
                            </div>
                          )}

                          {(xd?.assumptions?.length > 0 || xd?.limitations?.length > 0) && (
                            <div className="ar-xai-grid">
                              {xd.assumptions?.length > 0 && (
                                <div className="ar-xai-col">
                                  <span className="ar-label">Assumptions</span>
                                  <ul className="ar-simple-list">
                                    {xd.assumptions.map((a, i) => <li key={i}>{a}</li>)}
                                  </ul>
                                </div>
                              )}
                              {xd.limitations?.length > 0 && (
                                <div className="ar-xai-col ar-xai-col--warn">
                                  <span className="ar-label">Limitations</span>
                                  <ul className="ar-simple-list">
                                    {xd.limitations.map((l, i) => <li key={i}>{l}</li>)}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          {xd?.counterfactuals?.length > 0 && (
                            <div className="ar-xai-section">
                              <span className="ar-label">What-if scenarios</span>
                              {xd.counterfactuals.map((cf, i) => (
                                <div key={i} className="ar-whatif">
                                  <p className="ar-whatif-if"><strong>If</strong> {cf.scenario}</p>
                                  <p className="ar-whatif-then"><strong>Then</strong> {cf.impact}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="ar-text">Analyzing decision factors…</p>
                      )}
                    </Step>
                  );
                })()}

                {/* Final: Complete */}
                {isComplete && (() => {
                  stepNum++;
                  return (
                    <Step
                      number={stepNum}
                      title="Complete"
                      status="done"
                      duration={fmtElapsed(runStart, runEnd)}
                    >
                      <p className="ar-text">All steps completed successfully.</p>
                    </Step>
                  );
                })()}

                {/* Loading indicator */}
                {isLoading && !isComplete && (
                  <div className="ar-loading">
                    <span /><span /><span />
                  </div>
                )}

                <div ref={endRef} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default AgentThoughtsPanel;
