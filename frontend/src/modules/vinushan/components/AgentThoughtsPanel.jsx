import { useState, useEffect, useRef } from 'react';

/**
 * AI Reasoning Timeline — Premium visual pipeline
 * Presents agent thinking as a step-by-step story:
 *   Query Analysis → Knowledge Retrieval → Agent Execution → Complete
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

/* ─── Sub-step metadata ─── */
const SUBSTEP_META = {
  plan:       { icon: '📋', label: 'Planning' },
  data_query: { icon: '🗄️', label: 'Data Access' },
  self_check: { icon: '🔍', label: 'Verification' },
  result:     { icon: '💡', label: 'Findings' },
  thought:    { icon: '💭', label: 'Reasoning' },
  query:      { icon: '🔎', label: 'Query' },
  result_snapshot: { icon: '💡', label: 'Findings' },
  reflection: { icon: '🪞', label: 'Self-Reflection' },
  xai:        { icon: '🔬', label: 'Explainability' },
};

/* ─── Content Formatter (replaces raw <pre> dumps) ─── */
function FormatContent({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let listBuf = [];

  const flush = (key) => {
    if (listBuf.length > 0) {
      elements.push(
        <ul key={key} className="tl-list">
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

    // Section headers (short lines ending with colon)
    if (t.endsWith(':') && t.length < 60) {
      elements.push(<p key={i} className="tl-label">{t}</p>);
      return;
    }

    // Dataset / file references
    if (/^(DATASET|FILE|SQL|QUERY):/i.test(t)) {
      const [label, ...rest] = t.split(':');
      elements.push(
        <div key={i} className="tl-code-ref">
          <span className="tl-code-tag">{label}</span>
          <code>{rest.join(':').trim()}</code>
        </div>
      );
      return;
    }

    // File paths
    if (/\.(csv|json|py|sql|txt|md)\b/.test(t) && t.length < 120) {
      elements.push(<code key={i} className="tl-filepath">{t}</code>);
      return;
    }

    elements.push(<p key={i} className="tl-text">{t}</p>);
  });

  flush('l-end');
  return <>{elements}</>;
}

/* ─── Sub-step (within agent card) ─── */
function SubStep({ phase, text, timestamp, isLast }) {
  const meta = SUBSTEP_META[phase] || { icon: '▸', label: phase || 'Step' };
  return (
    <div className={`tl-substep ${isLast ? 'last' : ''}`}>
      <div className="tl-substep-dot" />
      <div className="tl-substep-card">
        <div className="tl-substep-header">
          <span className="tl-substep-icon">{meta.icon}</span>
          <span className="tl-substep-label">{meta.label}</span>
          {timestamp && <span className="tl-substep-time">{fmtTime(timestamp)}</span>}
        </div>
        <div className="tl-substep-body">
          <FormatContent text={text} />
        </div>
      </div>
    </div>
  );
}

/* ─── Timeline Step (main phase node) ─── */
function TimelineStep({ icon, label, timestamp, duration, isActive, isCompleted, summary, accentColor, isLast, children }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className={`tl-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isLast ? 'last' : ''}`}>
      {/* Timeline track */}
      <div className="tl-track">
        <div
          className="tl-dot"
          style={{
            borderColor: accentColor,
            background: (isActive || isCompleted) ? accentColor : 'transparent',
          }}
        >
          {isCompleted && <span className="tl-check">✓</span>}
          {isActive && <span className="tl-pulse" style={{ background: accentColor }} />}
        </div>
        {!isLast && <div className="tl-line" />}
      </div>

      {/* Step content */}
      <div className="tl-step-content">
        <div className="tl-step-header" onClick={() => setExpanded(!expanded)}>
          <div className="tl-step-title">
            <span className="tl-step-icon">{icon}</span>
            <span className="tl-step-label">{label}</span>
          </div>
          <div className="tl-step-meta">
            {duration && <span className="tl-badge duration">{duration}</span>}
            {timestamp && <span className="tl-badge time">{fmtTime(timestamp)}</span>}
            <span className={`tl-chevron ${expanded ? 'open' : ''}`}>‹</span>
          </div>
        </div>

        {!expanded && summary && (
          <p className="tl-summary">{summary}</p>
        )}

        {expanded && (
          <div className="tl-step-body">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Adaptive RAG Strategy Display ─── */
const QUERY_TYPE_STYLES = {
  factual:    { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', icon: '🎯', label: 'Factual Lookup',     desc: 'Direct answer from domain facts' },
  analytical: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', icon: '🔬', label: 'Analytical',         desc: 'Needs data analysis + domain knowledge' },
  strategic:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: '🧩', label: 'Strategic Planning', desc: 'Complex planning, broad knowledge needed' },
  system:     { color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: '⚙️', label: 'System Knowledge',   desc: 'About how ATHENA works internally' },
};

const ALL_PROFILES = {
  factual:    { top_k: 3, min_relevance: 0.35, expand: false },
  analytical: { top_k: 5, min_relevance: 0.25, expand: false },
  strategic:  { top_k: 7, min_relevance: 0.20, expand: true  },
  system:     { top_k: 5, min_relevance: 0.25, expand: false },
};

function AdaptiveRAGDisplay({ ragData }) {
  if (!ragData) return null;

  const queryType = ragData.query_type || 'analytical';
  const topics = ragData.topics || [];
  const reasoning = ragData.classification_reasoning || '';
  const chunksRetrieved = ragData.chunks_retrieved ?? 0;
  const chunksAfterFilter = ragData.chunks_after_filter ?? chunksRetrieved;
  const citations = ragData.citations || [];
  const profile = ragData.profile || ALL_PROFILES[queryType] || ALL_PROFILES.analytical;
  const style = QUERY_TYPE_STYLES[queryType] || QUERY_TYPE_STYLES.analytical;
  const filterPct = chunksRetrieved > 0 ? Math.round((chunksAfterFilter / chunksRetrieved) * 100) : 0;
  const droppedChunks = chunksRetrieved - chunksAfterFilter;

  return (
    <div className="arag">
      {/* ── Step 1: Classification Decision ── */}
      <div className="arag-step">
        <div className="arag-step-header">
          <span className="arag-step-num" style={{ background: style.bg, color: style.color }}>1</span>
          <span className="arag-step-title">Query Classification</span>
        </div>
        <div className="arag-step-body">
          <div className="arag-classify-row">
            <div className="arag-type-badge" style={{ background: style.bg, borderColor: style.color }}>
              <span className="arag-type-icon">{style.icon}</span>
              <span className="arag-type-label" style={{ color: style.color }}>{style.label}</span>
            </div>
            {reasoning && <p className="arag-reasoning">"{reasoning}"</p>}
          </div>
          {topics.length > 0 && (
            <div className="arag-topics-row">
              <span className="arag-micro-label">Extracted topics</span>
              <div className="arag-topics">
                {topics.map((t, i) => (
                  <span key={i} className="arag-topic" style={{ borderColor: `${style.color}40` }}>{t}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="arag-step-connector" />
      </div>

      {/* ── Step 2: Strategy Selection ── */}
      <div className="arag-step">
        <div className="arag-step-header">
          <span className="arag-step-num" style={{ background: style.bg, color: style.color }}>2</span>
          <span className="arag-step-title">Strategy Selection</span>
        </div>
        <div className="arag-step-body">
          <div className="arag-profiles">
            {Object.entries(ALL_PROFILES).map(([type, prof]) => {
              const isActive = type === queryType;
              const s = QUERY_TYPE_STYLES[type];
              return (
                <div
                  key={type}
                  className={`arag-profile-card ${isActive ? 'active' : ''}`}
                  style={isActive ? { borderColor: s.color, background: s.bg } : {}}
                >
                  {isActive && <span className="arag-profile-selected">SELECTED</span>}
                  <span className="arag-profile-icon">{s.icon}</span>
                  <span className="arag-profile-name">{type}</span>
                  <div className="arag-profile-stats">
                    <span>top_k: {prof.top_k}</span>
                    <span>threshold: {prof.min_relevance}</span>
                    <span>expand: {prof.expand ? '✓' : '✗'}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="arag-strategy-summary">
            <div className="arag-strat-item">
              <span className="arag-strat-key">Chunks to retrieve</span>
              <span className="arag-strat-val" style={{ color: style.color }}>{profile.top_k}</span>
            </div>
            <div className="arag-strat-item">
              <span className="arag-strat-key">Min relevance</span>
              <span className="arag-strat-val" style={{ color: style.color }}>{(profile.min_relevance * 100).toFixed(0)}%</span>
            </div>
            <div className="arag-strat-item">
              <span className="arag-strat-key">Query expansion</span>
              <span className="arag-strat-val" style={{ color: profile.expand ? '#10b981' : 'var(--athena-text-muted)' }}>
                {profile.expand ? '✅ Enabled' : '— Disabled'}
              </span>
            </div>
          </div>
        </div>
        <div className="arag-step-connector" />
      </div>

      {/* ── Step 3: Retrieval & Filtering ── */}
      <div className="arag-step">
        <div className="arag-step-header">
          <span className="arag-step-num" style={{ background: style.bg, color: style.color }}>3</span>
          <span className="arag-step-title">Retrieval & Filtering</span>
        </div>
        <div className="arag-step-body">
          <div className="arag-pipeline-flow">
            <div className="arag-pipe-node">
              <div className="arag-pipe-value">{chunksRetrieved}</div>
              <div className="arag-pipe-label">
                {profile.expand ? 'expanded search' : 'retrieved'}
              </div>
            </div>
            <div className="arag-pipe-arrow">
              <span className="arag-pipe-arrow-line" />
              <span className="arag-pipe-arrow-text">
                ≥{(profile.min_relevance * 100).toFixed(0)}% filter
              </span>
              <span className="arag-pipe-arrow-line" />
            </div>
            <div className="arag-pipe-node result" style={{ borderColor: style.color }}>
              <div className="arag-pipe-value" style={{ color: style.color }}>{chunksAfterFilter}</div>
              <div className="arag-pipe-label">used by agents</div>
            </div>
          </div>
          {droppedChunks > 0 && (
            <p className="arag-filter-note">
              🗑️ {droppedChunks} chunk{droppedChunks > 1 ? 's' : ''} dropped (below {(profile.min_relevance * 100).toFixed(0)}% relevance) — {filterPct}% pass rate
            </p>
          )}
          {droppedChunks === 0 && chunksRetrieved > 0 && (
            <p className="arag-filter-note arag-filter-pass">
              ✅ All {chunksRetrieved} chunks passed relevance filter — 100% pass rate
            </p>
          )}
        </div>
        <div className="arag-step-connector" />
      </div>

      {/* ── Step 4: Source Relevance ── */}
      {citations.length > 0 && (
        <div className="arag-step last">
          <div className="arag-step-header">
            <span className="arag-step-num" style={{ background: style.bg, color: style.color }}>4</span>
            <span className="arag-step-title">Source Relevance Scores</span>
          </div>
          <div className="arag-step-body">
            <div className="arag-citations">
              {citations.map((cite, i) => {
                const score = cite.score ?? cite.relevance_score ?? 0;
                const pct = Math.round(Math.max(0, Math.min(1, score)) * 100);
                const barColor = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
                return (
                  <div key={i} className="arag-cite-row">
                    <span className="arag-cite-rank" style={{ color: style.color }}>#{i + 1}</span>
                    <span className="arag-cite-name" title={cite.heading ? `${cite.source} > ${cite.heading}` : cite.source}>
                      {cite.heading || cite.source}
                    </span>
                    <div className="arag-cite-bar-bg">
                      <div className="arag-cite-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
                    </div>
                    <span className="arag-cite-score" style={{ color: barColor }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── RAG Sources (expandable) ─── */
function RAGSources({ sources, chunks }) {
  const [expandedSrc, setExpandedSrc] = useState({});
  if (!sources?.length) return null;

  return (
    <div className="tl-rag-sources">
      {sources.map((source, idx) => {
        const isOpen = expandedSrc[idx];
        const relevant = chunks?.filter(c => c.source === source) || [];
        return (
          <div key={idx} className={`tl-source ${isOpen ? 'open' : ''}`}>
            <div className="tl-source-row" onClick={() => setExpandedSrc(p => ({ ...p, [idx]: !p[idx] }))}>
              <span className="tl-source-icon">📄</span>
              <span className="tl-source-name">{source}</span>
              <span className={`tl-source-arrow ${isOpen ? 'open' : ''}`}>▾</span>
            </div>
            {isOpen && relevant.length > 0 && (
              <div className="tl-source-preview">
                {relevant.map((chunk, ci) => (
                  <p key={ci}>{chunk.text || chunk.content || ''}</p>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Self-Reflection Quality Review ─── */
const CRITERIA_ICONS = {
  Accuracy: '🎯',
  Completeness: '📋',
  Hallucination: '🔮',
  Actionability: '⚡',
  Clarity: '📝',
};

function SelfReflectionDisplay({ reflectionData }) {
  if (!reflectionData || reflectionData.status !== 'complete') return null;

  const { verdict, criteria = [], improvements_made, pass_count, total_criteria } = reflectionData;
  const isImproved = verdict === 'improved';

  return (
    <div className="sreflect">
      {/* Verdict banner */}
      <div className={`sreflect-verdict ${isImproved ? 'improved' : 'pass'}`}>
        <span className="sreflect-verdict-icon">{isImproved ? '🔧' : '✅'}</span>
        <div className="sreflect-verdict-text">
          <span className="sreflect-verdict-title">
            {isImproved ? 'Response Improved' : 'Quality Verified'}
          </span>
          <span className="sreflect-verdict-detail">
            {pass_count}/{total_criteria} checks passed
            {isImproved && ' — issues were auto-corrected'}
          </span>
        </div>
      </div>

      {/* Criteria checklist */}
      <div className="sreflect-criteria">
        {criteria.map((c, i) => {
          const passed = c.status === 'pass';
          return (
            <div key={i} className={`sreflect-criterion ${passed ? 'pass' : 'fail'}`}>
              <span className="sreflect-criterion-icon">
                {CRITERIA_ICONS[c.name] || '📌'}
              </span>
              <span className="sreflect-criterion-name">{c.name}</span>
              <span className={`sreflect-criterion-badge ${passed ? 'pass' : 'fail'}`}>
                {passed ? 'PASS' : 'FAIL'}
              </span>
              <span className="sreflect-criterion-note">{c.note}</span>
            </div>
          );
        })}
      </div>

      {/* Improvements note */}
      {isImproved && improvements_made && improvements_made !== 'none' && (
        <div className="sreflect-improvements">
          <span className="sreflect-improvements-label">Improvements made</span>
          <p className="sreflect-improvements-text">{improvements_made}</p>
        </div>
      )}
    </div>
  );
}

/* ─── XAI / Explainability Display ─── */
function XAIExplanationDisplay({ xaiData }) {
  if (!xaiData || xaiData.status !== 'complete') return null;

  const {
    decision_factors = [],
    agent_contributions = [],
    confidence_scores = [],
    overall_confidence = 75,
    assumptions = [],
    limitations = [],
    counterfactuals = [],
  } = xaiData;

  const confColor = (c) => c >= 80 ? '#10b981' : c >= 60 ? '#f59e0b' : '#ef4444';
  const factorIcon = (name) => {
    const n = name.toLowerCase();
    if (n.includes('historical') || n.includes('sales'))  return '📊';
    if (n.includes('weather') || n.includes('climate'))   return '🌦️';
    if (n.includes('holiday') || n.includes('festival'))  return '🎉';
    if (n.includes('season'))                             return '🍂';
    if (n.includes('forecast') || n.includes('predict'))  return '🔮';
    if (n.includes('context') || n.includes('business'))  return '🏪';
    if (n.includes('customer') || n.includes('behavior')) return '👥';
    if (n.includes('domain') || n.includes('knowledge'))  return '📚';
    return '📌';
  };

  return (
    <div className="xai">
      {/* ── Section 1: Decision Factors ── */}
      {decision_factors.length > 0 && (
        <div className="xai-section">
          <div className="xai-section-header">
            <span className="xai-section-icon">⚖️</span>
            <span className="xai-section-title">Decision Factors</span>
            <span className="xai-section-hint">What influenced this response</span>
          </div>
          <div className="xai-factors">
            {decision_factors.sort((a, b) => (b.influence || 0) - (a.influence || 0)).map((f, i) => (
              <div key={i} className="xai-factor">
                <div className="xai-factor-top">
                  <span className="xai-factor-icon">{factorIcon(f.factor)}</span>
                  <span className="xai-factor-name">{f.factor}</span>
                  <span className="xai-factor-pct" style={{ color: confColor(f.influence) }}>{f.influence}%</span>
                </div>
                <div className="xai-factor-bar-bg">
                  <div
                    className="xai-factor-bar"
                    style={{ width: `${f.influence}%`, background: confColor(f.influence) }}
                  />
                </div>
                {f.reasoning && <p className="xai-factor-reason">{f.reasoning}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Section 2: Agent Contributions ── */}
      {agent_contributions.length > 0 && (
        <div className="xai-section">
          <div className="xai-section-header">
            <span className="xai-section-icon">🤖</span>
            <span className="xai-section-title">Agent Contributions</span>
          </div>
          <div className="xai-contributions">
            {agent_contributions.map((ac, i) => (
              <div key={i} className="xai-contrib">
                <div className="xai-contrib-header">
                  <span className="xai-contrib-name">{ac.agent}</span>
                  <span className="xai-contrib-pct">{ac.influence_pct}%</span>
                </div>
                <div className="xai-contrib-bar-bg">
                  <div
                    className="xai-contrib-bar"
                    style={{ width: `${ac.influence_pct}%` }}
                  />
                </div>
                <p className="xai-contrib-desc">{ac.contribution}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Section 3: Confidence Scores ── */}
      {confidence_scores.length > 0 && (
        <div className="xai-section">
          <div className="xai-section-header">
            <span className="xai-section-icon">📈</span>
            <span className="xai-section-title">Confidence Breakdown</span>
            <span className="xai-overall-badge" style={{ background: `${confColor(overall_confidence)}20`, color: confColor(overall_confidence) }}>
              {overall_confidence}% overall
            </span>
          </div>
          <div className="xai-confidences">
            {confidence_scores.map((cs, i) => (
              <div key={i} className="xai-confidence">
                <div className="xai-conf-top">
                  <span className="xai-conf-topic">{cs.topic}</span>
                  <span className="xai-conf-score" style={{ color: confColor(cs.confidence) }}>
                    {cs.confidence}%
                  </span>
                </div>
                <div className="xai-conf-bar-bg">
                  <div
                    className="xai-conf-bar"
                    style={{ width: `${cs.confidence}%`, background: confColor(cs.confidence) }}
                  />
                </div>
                {cs.reasoning && <p className="xai-conf-reason">{cs.reasoning}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Section 4: Assumptions & Limitations ── */}
      {(assumptions.length > 0 || limitations.length > 0) && (
        <div className="xai-section">
          <div className="xai-two-col">
            {assumptions.length > 0 && (
              <div className="xai-col">
                <div className="xai-col-header">
                  <span className="xai-col-icon">💡</span>
                  <span className="xai-col-title">Assumptions</span>
                </div>
                <ul className="xai-list">
                  {assumptions.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            )}
            {limitations.length > 0 && (
              <div className="xai-col warn">
                <div className="xai-col-header">
                  <span className="xai-col-icon">⚠️</span>
                  <span className="xai-col-title">Limitations</span>
                </div>
                <ul className="xai-list">
                  {limitations.map((l, i) => <li key={i}>{l}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Section 5: Counterfactual Scenarios ── */}
      {counterfactuals.length > 0 && (
        <div className="xai-section">
          <div className="xai-section-header">
            <span className="xai-section-icon">🔀</span>
            <span className="xai-section-title">What-If Scenarios</span>
          </div>
          <div className="xai-counterfactuals">
            {counterfactuals.map((cf, i) => (
              <div key={i} className="xai-cf">
                <div className="xai-cf-scenario">
                  <span className="xai-cf-label">If</span>
                  <span className="xai-cf-text">{cf.scenario}</span>
                </div>
                <div className="xai-cf-impact">
                  <span className="xai-cf-label">Then</span>
                  <span className="xai-cf-text">{cf.impact}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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
  const panelRef = useRef(null);

  const runStart = events.find(e => e.type === 'run_start')?.timestamp;
  const runEnd = events.find(e => e.type === 'run_end')?.timestamp;
  const isComplete = !!runEnd;

  // Auto-scroll to latest event
  useEffect(() => {
    if (isLoading && endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [events, isLoading]);

  // Live elapsed timer
  useEffect(() => {
    let iv;
    if (isLoading && runStart) {
      iv = setInterval(() => setElapsed(fmtElapsed(runStart)), 100);
    }
    return () => clearInterval(iv);
  }, [isLoading, runStart]);

  // ── Build timeline from events ──
  const buildTimeline = () => {
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
          const toolName = event.data?.tool_name || 'tool';
          agents[a].thoughts.push({
            phase: 'data_query',
            text: `Invoking ${toolName}\n${event.content || ''}`,
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

    const reflectionEvents = events.filter(e => e.type === 'self_reflection');
    const reflectionComplete = reflectionEvents.find(e => e.data?.status === 'complete');

    const xaiEvents = events.filter(e => e.type === 'xai_explanation');
    const xaiComplete = xaiEvents.find(e => e.data?.status === 'complete');

    // Step counter
    let stepCount = 0;
    if (routingReasoning) stepCount++;
    if (ragEvents.length > 0) stepCount++;
    stepCount += Object.keys(agents).length;
    if (reflectionEvents.length > 0) stepCount++;
    if (xaiEvents.length > 0) stepCount++;
    if (isComplete) stepCount++;

    let currentStep = 0;
    if (routingReasoning) currentStep++;
    if (ragComplete) currentStep++;
    currentStep += completedSet.size;
    if (reflectionComplete) currentStep++;
    if (xaiComplete) currentStep++;
    if (isComplete) currentStep++;

    return { agents, completedSet, activeAgent, ragEvents, ragComplete, reflectionEvents, reflectionComplete, xaiEvents, xaiComplete, stepCount, currentStep };
  };

  const { agents, completedSet, activeAgent, ragEvents, ragComplete, reflectionEvents, reflectionComplete, xaiEvents, xaiComplete, stepCount, currentStep } = buildTimeline();
  const hasContent = events.length > 0 || routingReasoning || agentsNeeded.length > 0;

  const routerSummary = agentsNeeded.length > 0
    ? `Analyzed query → ${agentsNeeded.length} specialist${agentsNeeded.length > 1 ? 's' : ''} assigned`
    : '';

  const ragQueryType = ragComplete?.data?.query_type;
  const ragTopics = ragComplete?.data?.topics || [];
  const ragChunksAfterFilter = ragComplete?.data?.chunks_after_filter ?? ragComplete?.data?.chunks_retrieved;
  const ragSummary = ragComplete
    ? `${ragQueryType ? `[${ragQueryType}] ` : ''}Retrieved ${ragChunksAfterFilter} chunks from ${ragComplete.data.source_documents?.length || 0} sources`
    : ragEvents.length > 0 ? 'Classifying query & searching…' : '';

  return (
    <div className={`tl-panel ${isOpen ? 'open' : ''}`} ref={panelRef}>
      {isOpen && (
        <>
          {/* ── Header ── */}
          <div className="tl-header">
            <div className="tl-header-left">
              <h3 className="tl-title">AI Reasoning</h3>
              {stepCount > 0 && (
                <span className="tl-step-counter">
                  Step {Math.min(currentStep + (isLoading && !isComplete ? 1 : 0), stepCount)} of {stepCount}
                </span>
              )}
            </div>
            <div className="tl-header-actions">
              {hasContent && <button className="tl-btn" onClick={onClear}>Clear</button>}
              <button className="tl-btn close" onClick={onClose}>✕</button>
            </div>
          </div>

          {/* ── Content ── */}
          <div className="tl-content">
            {!hasContent && !isLoading ? (
              <div className="tl-empty">
                <div className="tl-empty-icon">🔮</div>
                <p className="tl-empty-title">No active reasoning</p>
                <p className="tl-empty-hint">Ask ATHENA a question to see how it thinks</p>
              </div>
            ) : (
              <div className="tl-timeline">
                {/* Progress banner */}
                {isLoading && (
                  <div className="tl-progress">
                    <div className="tl-progress-info">
                      <span className="tl-progress-label">Processing</span>
                      {elapsed && <span className="tl-progress-time">{elapsed}</span>}
                    </div>
                    <div className="tl-progress-bar">
                      <div className="tl-progress-fill" />
                    </div>
                  </div>
                )}

                {/* Phase 1: Query Analysis */}
                {routingReasoning && (
                  <TimelineStep
                    icon="🧠"
                    label="Query Analysis"
                    timestamp={events.find(e => e.type === 'query_analysis')?.timestamp}
                    isCompleted={true}
                    accentColor="#818cf8"
                    summary={routerSummary}
                    isLast={!ragEvents.length && Object.keys(agents).length === 0 && !isComplete}
                  >
                    <FormatContent text={routingReasoning} />
                    {agentsNeeded.length > 0 && (
                      <div className="tl-agent-pills">
                        <span className="tl-pills-label">Specialists assigned</span>
                        <div className="tl-pills">
                          {agentsNeeded.map((agent, i) => (
                            <span key={i} className="tl-pill">{agent}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </TimelineStep>
                )}

                {/* Phase 2: Knowledge Retrieval */}
                {ragEvents.length > 0 && (
                  <TimelineStep
                    icon="📚"
                    label="Adaptive Knowledge Retrieval"
                    timestamp={ragEvents[0]?.timestamp}
                    duration={ragComplete ? `${ragChunksAfterFilter} chunks` : null}
                    isActive={!ragComplete && isLoading}
                    isCompleted={!!ragComplete}
                    accentColor="#f59e0b"
                    summary={ragSummary}
                    isLast={Object.keys(agents).length === 0 && !isComplete}
                  >
                    {ragComplete ? (
                      <>
                        <AdaptiveRAGDisplay ragData={ragComplete.data} />
                        <RAGSources
                          sources={ragComplete.data.source_documents || []}
                          chunks={ragComplete.data.chunks || []}
                        />
                      </>
                    ) : (
                      <p className="tl-text">Classifying query and searching domain knowledge base…</p>
                    )}
                  </TimelineStep>
                )}

                {/* Phase 3+: Agent execution */}
                {Object.entries(agents).map(([name, data], idx, arr) => {
                  const isLast = idx === arr.length - 1 && !isComplete;
                  const isAgentActive = activeAgent === name;
                  const isAgentDone = completedSet.has(name);

                  return (
                    <TimelineStep
                      key={name}
                      icon="🤖"
                      label={cleanAgentName(name)}
                      timestamp={data.startTime || data.thoughts[0]?.timestamp}
                      duration={isAgentDone && data.duration ? fmtDuration(data.duration) : null}
                      isActive={isAgentActive}
                      isCompleted={isAgentDone}
                      accentColor="#10b981"
                      summary={isAgentDone ? `Completed in ${fmtDuration(data.duration)}` : 'Processing…'}
                      isLast={isLast}
                    >
                      {data.thoughts.map((thought, ti) => (
                        <SubStep
                          key={ti}
                          phase={thought.phase}
                          text={thought.text}
                          timestamp={thought.timestamp}
                          isLast={ti === data.thoughts.length - 1}
                        />
                      ))}
                    </TimelineStep>
                  );
                })}

                {/* Phase 4: Self-Reflection Quality Review */}
                {reflectionEvents.length > 0 && (
                  <TimelineStep
                    icon="🪞"
                    label="Self-Reflection"
                    timestamp={reflectionEvents[0]?.timestamp}
                    isActive={!reflectionComplete && isLoading}
                    isCompleted={!!reflectionComplete}
                    accentColor="#f472b6"
                    summary={
                      reflectionComplete
                        ? `${reflectionComplete.data.pass_count}/${reflectionComplete.data.total_criteria} quality checks passed`
                        : 'Reviewing response quality…'
                    }
                    isLast={!isComplete}
                  >
                    {reflectionComplete ? (
                      <SelfReflectionDisplay reflectionData={reflectionComplete.data} />
                    ) : (
                      <p className="tl-text">Verifying accuracy, completeness, and quality…</p>
                    )}
                  </TimelineStep>
                )}

                {/* Phase 5: XAI / Explainability */}
                {xaiEvents.length > 0 && (
                  <TimelineStep
                    icon="🔬"
                    label="Explainability Analysis"
                    timestamp={xaiEvents[0]?.timestamp}
                    isActive={!xaiComplete && isLoading}
                    isCompleted={!!xaiComplete}
                    accentColor="#06b6d4"
                    summary={
                      xaiComplete
                        ? `${xaiComplete.data.overall_confidence}% overall confidence · ${xaiComplete.data.decision_factors?.length || 0} factors analyzed`
                        : 'Decomposing decision-making process…'
                    }
                    isLast={!isComplete}
                  >
                    {xaiComplete ? (
                      <XAIExplanationDisplay xaiData={xaiComplete.data} />
                    ) : (
                      <p className="tl-text">Analyzing decision factors, confidence levels, and assumptions…</p>
                    )}
                  </TimelineStep>
                )}

                {/* Final: Completion step */}
                {isComplete && (
                  <TimelineStep
                    icon="✅"
                    label="Analysis Complete"
                    isCompleted={true}
                    accentColor="#22c55e"
                    isLast={true}
                  >
                    <div className="tl-complete-info">
                      <span className="tl-complete-label">Total processing time</span>
                      <span className="tl-complete-time">{fmtElapsed(runStart, runEnd)}</span>
                    </div>
                  </TimelineStep>
                )}

                {/* Thinking dots */}
                {isLoading && !isComplete && (
                  <div className="tl-thinking">
                    <span className="tl-thinking-dot" />
                    <span className="tl-thinking-dot" />
                    <span className="tl-thinking-dot" />
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
