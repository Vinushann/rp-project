import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import '../styles/PipelineVisualization.css';

/* ══════════════════════════════════════════════════════════════════
  AI Decision Flow v3 — Cinematic Animated Pipeline
  Uses framer-motion for smooth, presentation-ready animations
  ══════════════════════════════════════════════════════════════════ */

/* ─── Utilities ─── */
const cleanName = n => (n || 'Agent').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const fmtSec = s => (!s && s !== 0) ? '' : s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`;

const RAG_STRATEGIES = {
  factual: { icon: '🎯', label: 'Factual', topK: 3, threshold: 0.35, expand: false },
  analytical: { icon: '🔬', label: 'Analytical', topK: 5, threshold: 0.25, expand: false },
  strategic: { icon: '🧩', label: 'Strategic', topK: 7, threshold: 0.2, expand: true },
  system: { icon: '⚙️', label: 'System', topK: 5, threshold: 0.25, expand: false },
};

function getRagStrategyRows(rag) {
  const selectedKey = (rag.queryType || '').toLowerCase();
  return Object.entries(RAG_STRATEGIES).map(([key, preset]) => {
    const selected = key === selectedKey;
    return {
      key,
      selected,
      icon: preset.icon,
      label: preset.label,
      topK: selected && rag.profile.top_k != null ? rag.profile.top_k : preset.topK,
      threshold: selected && rag.profile.min_relevance != null ? rag.profile.min_relevance : preset.threshold,
      expand: selected && rag.profile.expand != null ? rag.profile.expand : preset.expand,
    };
  });
}

/* ─── Animation Presets ─── */
const stageSpring = { type: 'spring', stiffness: 260, damping: 24 };
const fadeUp = {
  hidden: { opacity: 0, y: 40, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1, transition: stageSpring },
  exit: { opacity: 0, y: -20, transition: { duration: 0.2 } },
};
const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5 } },
};
const stagger = { visible: { transition: { staggerChildren: 0.08 } } };
const pop = {
  hidden: { opacity: 0, scale: 0 },
  visible: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 500, damping: 20 } },
};
const slideRight = {
  hidden: { opacity: 0, x: -30 },
  visible: { opacity: 1, x: 0, transition: stageSpring },
};
const growBar = (pct) => ({
  hidden: { width: 0 },
  visible: { width: `${pct}%`, transition: { duration: 1, ease: [0.33, 1, 0.68, 1] } },
});

/* ─── Animated Counter ─── */
function AnimCount({ value, duration = 1.2, suffix = '', color }) {
  const ref = useRef(null);
  const prevVal = useRef(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const from = prevVal.current;
    const controls = animate(from, value, {
      duration,
      ease: 'easeOut',
      onUpdate: v => { node.textContent = Math.round(v) + suffix; },
    });
    prevVal.current = value;
    return () => controls.stop();
  }, [value, duration, suffix]);
  return <span ref={ref} style={color ? { color } : undefined} className="dt-anim-num">{value}{suffix}</span>;
}

/* ─── Typing Effect ─── */
function TypeWriter({ text, speed = 18 }) {
  const [displayed, setDisplayed] = useState('');
  const idx = useRef(0);
  useEffect(() => {
    setDisplayed('');
    idx.current = 0;
    const iv = setInterval(() => {
      if (idx.current < text.length) {
        setDisplayed(text.slice(0, idx.current + 1));
        idx.current++;
      } else clearInterval(iv);
    }, speed);
    return () => clearInterval(iv);
  }, [text, speed]);
  return <span>{displayed}<span className="dt-cursor">|</span></span>;
}

/* ─── Pulsing Flow Line (connector between stages) ─── */
function FlowLine({ active, done }) {
  return (
    <div className={`dt-flow ${done ? 'done' : ''} ${active ? 'active' : ''}`}>
      <div className="dt-flow-track">
        {active && <motion.div className="dt-flow-pulse" animate={{ y: [0, 48, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }} />}
        {done && <motion.div className="dt-flow-fill" initial={{ height: 0 }} animate={{ height: '100%' }} transition={{ duration: 0.5 }} />}
      </div>
    </div>
  );
}

/* ─── Circular Progress Ring ─── */
function ProgressRing({ progress, size = 52, stroke = 4, color = '#818cf8', children }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div className="dt-ring-wrap" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="dt-ring-svg">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <motion.circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - progress) }}
          transition={{ duration: 1, ease: 'easeOut' }}
          strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
        />
      </svg>
      <div className="dt-ring-inner">{children}</div>
    </div>
  );
}

/* ─── Stage Card Wrapper ─── */
function StageCard({ icon, title, status, color, children }) {
  return (
    <motion.div className={`dt-stage dt-stage--${status}`} style={{ '--stg-c': color }}
      variants={fadeUp} initial="hidden" animate="visible" layout>
      <div className="dt-stage-header">
        <motion.div className="dt-stage-icon" variants={pop} initial="hidden" animate="visible">
          {status === 'complete' ? (
            <motion.svg viewBox="0 0 24 24" className="dt-stage-check" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.2 }}>
              <motion.path d="M5 13l4 4L19 7" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.2 }} />
            </motion.svg>
          ) : status === 'active' ? (
            <motion.div className="dt-stage-pulse" animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }} transition={{ duration: 1.4, repeat: Infinity }} />
          ) : (
            <span>{icon}</span>
          )}
        </motion.div>
        <h3 className="dt-stage-title">{title}</h3>
        {status === 'active' && <motion.span className="dt-stage-live" animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>ACTIVE</motion.span>}
        {status === 'complete' && <span className="dt-stage-done">DONE</span>}
      </div>
      <div className="dt-stage-body">{children}</div>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/* DEMO EVENTS                                                       */
/* ────────────────────────────────────────────────────────────────── */

const DEMO_EVENTS = [
  { delay: 0, event: { type: 'run_start', data: { message: 'What are the top selling items this month and how does weather affect my sales? Show me a chart.' } } },
  { delay: 1400, event: { type: 'query_analysis', content: 'Analytical multi-factor query:\n1. Historical sales analysis\n2. Weather correlation\n3. Data visualization\n\nComplexity: HIGH\nRAG: Required\nVisualization: Requested', data: { agents_needed: ['historical_data_analyst', 'weather_impact_analyst', 'visualization_specialist', 'strategy_advisor'], is_comprehensive: true, needs_visualization: true, needs_rag: true } } },
  { delay: 2600, event: { type: 'rag_retrieval', phase: 'start', data: { query: 'top selling items weather affect sales', status: 'searching' } } },
  { delay: 4200, event: { type: 'rag_retrieval', phase: 'complete', data: { status: 'complete', query: 'april 2026 demand strategy with seasonal context', chunks_retrieved: 12, chunks_after_filter: 2, query_type: 'strategic', classification_reasoning: 'The query requires comprehensive planning across forecasting, seasonal events, and operations.', topics: ['April 2026 sales forecast', 'item demand', 'Sinhala/Tamil New Year impact', 'weather impact', 'inventory actions', 'staffing actions'], profile: { top_k: 7, min_relevance: 0.2, expand: true }, citations: [{ source: 'holiday_impact_guide.md', heading: 'Sinhala and Tamil New Year Campaign Patterns', score: 0.43 }, { source: 'sri_lanka_holiday_calendar.md', heading: 'Major Sri Lankan Holidays and Effects', score: 0.24 }], source_documents: ['holiday_impact_guide.md', 'sri_lanka_holiday_calendar.md'] } } },
  { delay: 5000, event: { type: 'agent_start', agent: 'historical_data_analyst', data: { step_number: 1, total_steps: 4, expected_output: 'Comprehensive analysis of top selling items with quantities, revenue, and trends', start_time: Date.now() / 1000 } } },
  { delay: 5600, event: { type: 'agent_thought', agent: 'historical_data_analyst', phase: 'plan', content: 'Analyzing sales data:\n1. Query item sales history\n2. Rank by quantity and revenue\n3. Identify trends vs previous periods\n4. Cross-reference with domain knowledge' } },
  { delay: 6800, event: { type: 'tool_start', agent: 'historical_data_analyst', data: { tool_name: 'ItemHistoryTool', tool_input: 'top 10 items this month by quantity' } } },
  { delay: 7800, event: { type: 'tool_result', agent: 'historical_data_analyst', data: { tool_name: 'ItemHistoryTool', result_preview: '1. Cappuccino (847 units, $3,388)\n2. Latte (723 units, $3,615)\n3. Americano (612 units, $2,142)\n4. Croissant (534 units, $1,869)\n5. Espresso (489 units, $1,467)', result_length: 1240 } } },
  { delay: 8400, event: { type: 'agent_self_check', agent: 'historical_data_analyst', phase: 'self_check', content: 'Data verified: Full month coverage ✓  Revenue consistent ✓  All items retrieved ✓' } },
  { delay: 9200, event: { type: 'agent_end', agent: 'historical_data_analyst', data: { duration_seconds: 4.2 } } },
  { delay: 9400, event: { type: 'agent_start', agent: 'weather_impact_analyst', data: { step_number: 2, total_steps: 4, expected_output: 'Weather-sales correlation analysis', start_time: Date.now() / 1000 } } },
  { delay: 9900, event: { type: 'agent_thought', agent: 'weather_impact_analyst', phase: 'plan', content: 'Correlating weather with sales:\n1. Get weather context data\n2. Cross-reference daily sales\n3. Identify impact patterns\n4. Quantify percentages' } },
  { delay: 10400, event: { type: 'tool_start', agent: 'weather_impact_analyst', data: { tool_name: 'WeatherContextTool', tool_input: 'weather impact on sales this month' } } },
  { delay: 11400, event: { type: 'tool_result', agent: 'weather_impact_analyst', data: { tool_name: 'WeatherContextTool', result_preview: 'Rainy days: +23% hot beverages\nSunny days: +18% cold drinks & pastries\nBelow 15°C: +31% soup & hot chocolate', result_length: 890 } } },
  { delay: 12200, event: { type: 'agent_end', agent: 'weather_impact_analyst', data: { duration_seconds: 2.8 } } },
  { delay: 12400, event: { type: 'agent_start', agent: 'visualization_specialist', data: { step_number: 3, total_steps: 4, expected_output: 'Charts showing top items and weather impact', start_time: Date.now() / 1000 } } },
  { delay: 12900, event: { type: 'tool_start', agent: 'visualization_specialist', data: { tool_name: 'TopItemsChartTool', tool_input: 'top 10 items by quantity' } } },
  { delay: 13800, event: { type: 'tool_result', agent: 'visualization_specialist', data: { tool_name: 'TopItemsChartTool', result_preview: 'Bar Chart generated (800x500px)', result_length: 45000, charts_count: 1 } } },
  { delay: 14200, event: { type: 'tool_start', agent: 'visualization_specialist', data: { tool_name: 'WeatherImpactChartTool', tool_input: 'weather vs sales correlation' } } },
  { delay: 15000, event: { type: 'tool_result', agent: 'visualization_specialist', data: { tool_name: 'WeatherImpactChartTool', result_preview: 'Scatter Plot generated (800x500px)', result_length: 38000, charts_count: 1 } } },
  { delay: 15200, event: { type: 'agent_end', agent: 'visualization_specialist', data: { duration_seconds: 2.8 } } },
  { delay: 15400, event: { type: 'agent_start', agent: 'strategy_advisor', data: { step_number: 4, total_steps: 4, expected_output: 'Strategic recommendations', start_time: Date.now() / 1000 } } },
  { delay: 16000, event: { type: 'agent_thought', agent: 'strategy_advisor', phase: 'plan', content: 'Synthesizing all agent outputs into actionable business recommendations' } },
  { delay: 17000, event: { type: 'agent_end', agent: 'strategy_advisor', data: { duration_seconds: 1.6 } } },
  { delay: 19600, event: { type: 'xai_explanation', phase: 'start', data: { status: 'analyzing' } } },
  { delay: 21400, event: { type: 'xai_explanation', phase: 'complete', data: { status: 'complete', overall_confidence: 87, decision_factors: [{ factor: 'Historical Sales Data', influence: 35 }, { factor: 'Weather Correlation', influence: 28 }, { factor: 'Domain Knowledge (RAG)', influence: 20 }, { factor: 'Seasonal Patterns', influence: 12 }, { factor: 'Cross-agent Synthesis', influence: 5 }], agent_contributions: [{ agent: 'Historical Data Analyst', contribution: 'Item sales rankings and revenue', influence_pct: 35 }, { agent: 'Weather Impact Analyst', contribution: 'Weather-sales correlations', influence_pct: 30 }, { agent: 'Visualization Specialist', contribution: '2 charts for presentation', influence_pct: 15 }, { agent: 'Strategy Advisor', contribution: 'Business recommendations', influence_pct: 20 }], confidence_scores: [{ topic: 'Top Selling Items', confidence: 95 }, { topic: 'Weather Impact', confidence: 82 }, { topic: 'Strategic Advice', confidence: 78 }], assumptions: ['Menu remained consistent', 'Weather data matches location'], limitations: ['Correlation ≠ causation', 'Single-month snapshot'], counterfactuals: [{ scenario: 'If rain every day', impact: '+35% hot beverages, -20% cold drinks' }, { scenario: 'No weather variation', impact: '~15% more uniform sales' }] } } },
  { delay: 22000, event: { type: 'run_end', data: { response: 'Analysis complete.', agents_used: ['historical_data_analyst', 'weather_impact_analyst', 'visualization_specialist', 'strategy_advisor'], reasoning_steps: [{ agent_name: 'Historical Data Analyst', summary: 'Top 10 items by quantity and revenue', duration_seconds: 4.2 }, { agent_name: 'Weather Impact Analyst', summary: 'Weather-sales correlation quantified', duration_seconds: 2.8 }, { agent_name: 'Visualization Specialist', summary: '2 data charts created', duration_seconds: 2.8 }, { agent_name: 'Strategy Advisor', summary: 'Actionable business recommendations', duration_seconds: 1.6 }] } } },
];

/* ─── Demo Hook ─── */
function useDemo() {
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState([]);
  const timers = useRef([]);

  const buildScriptFromEvents = useCallback((rawEvents = []) => {
    if (!Array.isArray(rawEvents) || rawEvents.length === 0) return DEMO_EVENTS;

    // Convert live events into replay script delays.
    const withTs = rawEvents.every(e => e?.timestamp && !Number.isNaN(new Date(e.timestamp).getTime()));
    if (withTs) {
      const firstTs = new Date(rawEvents[0].timestamp).getTime();
      const lastTs = new Date(rawEvents[rawEvents.length - 1].timestamp).getTime();
      const span = Math.max(1, lastTs - firstTs);
      const targetSpan = 14000; // compress long runs for demo playback
      const scale = Math.min(1, targetSpan / span);
      let prevDelay = -1;

      return rawEvents.map((ev, idx) => {
        const ts = new Date(ev.timestamp).getTime();
        let delay = Math.max(0, Math.round((ts - firstTs) * scale));
        if (delay <= prevDelay) delay = prevDelay + 120;
        prevDelay = delay;

        // Timestamp is regenerated during replay.
        const { timestamp, ...rest } = ev;
        return { delay: idx === 0 ? 0 : delay, event: rest };
      });
    }

    // Fallback timing when timestamps are unavailable.
    return rawEvents.map((ev, idx) => {
      const { timestamp, ...rest } = ev;
      return { delay: idx * 550, event: rest };
    });
  }, []);

  const stop = useCallback(() => { timers.current.forEach(clearTimeout); timers.current = []; setRunning(false); setEvents([]); }, []);
  const start = useCallback((rawEvents = []) => {
    stop(); setRunning(true); setEvents([]);
    const base = Date.now();
    const script = buildScriptFromEvents(rawEvents);
    script.forEach(({ delay, event }) => {
      const t = setTimeout(() => {
        setEvents(prev => [...prev, { ...event, timestamp: new Date(base + delay).toISOString() }]);
      }, delay);
      timers.current.push(t);
    });
    timers.current.push(setTimeout(() => setRunning(false), script[script.length - 1].delay + 2000));
  }, [stop, buildScriptFromEvents]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  return { running, events, start, stop };
}

/* ─── Build tree from events ─── */
function buildTree(events, routingReasoning, agentsNeeded) {
  const tree = { query: null, analysis: null, rag: null, agents: {}, xai: null, completion: null };
  let startTime = null, endTime = null;
  for (const ev of events) {
    const t = ev.type, d = ev.data || {};
    if (t === 'run_start') { startTime = ev.timestamp; tree.query = { text: d.message || ev.content || '', timestamp: ev.timestamp }; }
    else if (t === 'query_analysis') { tree.analysis = { reasoning: ev.content || routingReasoning || '', agents: d.agents_needed || agentsNeeded || [], needsRag: d.needs_rag ?? false, needsViz: d.needs_visualization ?? false, isComprehensive: d.is_comprehensive ?? false, timestamp: ev.timestamp }; }
    else if (t === 'rag_retrieval') {
      if (d.status === 'searching' || ev.phase === 'start') { tree.rag = { status: 'searching', query: d.query, timestamp: ev.timestamp }; }
      else {
        tree.rag = {
          status: 'complete',
          query: d.query || '',
          queryType: d.query_type,
          classificationReasoning: d.classification_reasoning || '',
          topics: d.topics || [],
          chunksRetrieved: d.chunks_retrieved ?? 0,
          chunksAfterFilter: d.chunks_after_filter ?? 0,
          profile: d.profile || {},
          citations: d.citations || [],
          sourceDocuments: d.source_documents || [],
          timestamp: ev.timestamp,
        };
      }
    }
    else if (t === 'agent_start') { const n = ev.agent || 'unknown'; if (!tree.agents[n]) tree.agents[n] = { thoughts: [], tools: [], status: 'active', timestamp: ev.timestamp }; Object.assign(tree.agents[n], { stepNumber: d.step_number, totalSteps: d.total_steps, expectedOutput: d.expected_output, status: 'active', timestamp: ev.timestamp }); }
    else if (['agent_thought', 'agent_query', 'agent_self_check', 'agent_result_snapshot'].includes(t)) { const n = ev.agent || 'unknown'; if (!tree.agents[n]) tree.agents[n] = { thoughts: [], tools: [], status: 'active', timestamp: ev.timestamp }; tree.agents[n].thoughts.push({ phase: ev.phase || t.replace('agent_', ''), content: ev.content || '', toolName: d.tool_name || null }); }
    else if (t === 'tool_start') { const n = ev.agent || 'unknown'; if (!tree.agents[n]) tree.agents[n] = { thoughts: [], tools: [], status: 'active', timestamp: ev.timestamp }; tree.agents[n].tools.push({ phase: 'start', name: d.tool_name || 'Tool', input: d.tool_input || '' }); }
    else if (t === 'tool_result') { const n = ev.agent || 'unknown'; if (!tree.agents[n]) tree.agents[n] = { thoughts: [], tools: [], status: 'active', timestamp: ev.timestamp }; const lt = [...tree.agents[n].tools].reverse().find(x => x.phase === 'start'); if (lt) { lt.phase = 'complete'; lt.resultPreview = d.result_preview || ''; lt.resultLength = d.result_length; lt.chartsCount = d.charts_count; } }
    else if (t === 'agent_end') { const n = ev.agent || 'unknown'; if (!tree.agents[n]) tree.agents[n] = { thoughts: [], tools: [], status: 'complete', timestamp: ev.timestamp }; tree.agents[n].status = 'complete'; tree.agents[n].duration = d.duration_seconds; }
    else if (t === 'xai_explanation') { tree.xai = (d.status === 'complete' || ev.phase === 'complete') ? { status: 'complete', overallConfidence: d.overall_confidence, decisionFactors: d.decision_factors || [], agentContributions: d.agent_contributions || [], confidenceScores: d.confidence_scores || [], assumptions: d.assumptions || [], limitations: d.limitations || [], counterfactuals: d.counterfactuals || [], timestamp: ev.timestamp } : { status: 'active', timestamp: ev.timestamp }; }
    else if (t === 'run_end') { endTime = ev.timestamp; tree.completion = { agentsUsed: d.agents_used || [], reasoningSteps: d.reasoning_steps || [], timestamp: ev.timestamp }; }
  }
  if (!tree.analysis && (routingReasoning || agentsNeeded?.length)) tree.analysis = { reasoning: routingReasoning || '', agents: agentsNeeded || [], timestamp: null };
  return { tree, startTime, endTime };
}

/* ═══════════════════════════════════════════════════════════════
   AGENT COLORS
   ═══════════════════════════════════════════════════════════════ */
const AGENT_COLORS = ['#818cf8', '#f59e0b', '#06b6d4', '#ec4899', '#10b981', '#f97316', '#a78bfa'];

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function PipelineVisualization({ events = [], isLoading = false, routingReasoning = '', agentsNeeded = [], onSendMessage }) {
  const demo = useDemo();
  const [query, setQuery] = useState('');
  const bottomRef = useRef(null);

  const lastRunEvents = useMemo(() => {
    if (!events.length) return [];
    const startIdx = [...events].map(e => e?.type).lastIndexOf('run_start');
    if (startIdx === -1) return [];
    return events.slice(startIdx).filter(e => e && e.type);
  }, [events]);

  const activeEvents = demo.running ? demo.events : events;
  const { tree, startTime, endTime } = useMemo(() => buildTree(activeEvents, demo.running ? '' : routingReasoning, demo.running ? [] : agentsNeeded), [activeEvents, routingReasoning, agentsNeeded, demo.running]);

  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    let iv;
    if (startTime && !endTime) { iv = setInterval(() => setElapsed((Date.now() - new Date(startTime).getTime()) / 1000), 100); }
    else if (startTime && endTime) { setElapsed((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000); }
    else { setElapsed(0); }
    return () => clearInterval(iv);
  }, [startTime, endTime]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [activeEvents.length]);

  const hasData = activeEvents.length > 0;
  const agentEntries = Object.entries(tree.agents);
  const agentCount = agentEntries.length;
  const doneAgents = agentEntries.filter(([, a]) => a.status === 'complete').length;
  const ragChunks = tree.rag?.chunksAfterFilter ?? 0;
  const confidence = tree.xai?.overallConfidence ?? null;

  const handleSubmit = () => {
    const t = query.trim();
    if (t && onSendMessage && !isLoading && !demo.running) { onSendMessage(t); setQuery(''); }
  };

  /* ═══ RENDER ═══ */
  return (
    <div className="dt-theater">
      {/* ── HEADER ── */}
      <header className="dt-header">
        <div className="dt-h-left">
          <h2 className="dt-h-title">AI Decision Flow</h2>
          <p className="dt-h-sub">Real-time Pipeline Visualization</p>
        </div>
        <div className="dt-h-right">
          <AnimatePresence>
            {demo.running && <motion.span className="dt-badge demo" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><span className="dt-badge-dot" /> DEMO</motion.span>}
            {isLoading && !demo.running && <motion.span className="dt-badge live" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><span className="dt-badge-dot" /> LIVE</motion.span>}
          </AnimatePresence>
          <button className={`dt-btn ${demo.running ? 'stop' : ''}`} onClick={demo.running ? demo.stop : () => demo.start(lastRunEvents)} type="button">
            {demo.running ? '■ Stop' : '▶ Watch Demo'}
          </button>
        </div>
      </header>

      {/* ── METRICS ── */}
      <motion.div className="dt-metrics" animate={{ opacity: hasData ? 1 : 0.4 }}>
        <Metric icon="⏱" label="Elapsed" value={hasData ? fmtSec(elapsed) : '—'} />
        <div className="dt-m-sep" />
        <Metric icon="🤖" label="Agents" value={agentCount > 0 ? `${doneAgents}/${agentCount}` : '—'} />
        <div className="dt-m-sep" />
        <Metric icon="📚" label="Knowledge" value={ragChunks > 0 ? `${ragChunks} chunks` : '—'} />
        <div className="dt-m-sep" />
        <Metric icon="🎯" label="Confidence" value={confidence != null ? `${confidence}%` : '—'} color={confidence != null ? (confidence >= 80 ? '#10b981' : '#f59e0b') : undefined} />
        <div className="dt-m-sep" />
        <Metric icon="✓" label="Quality" value={tree.reflection?.status === 'complete' ? `${tree.reflection.passCount}/${tree.reflection.totalCriteria}` : '—'} />
      </motion.div>

      {/* ── CANVAS ── */}
      <div className="dt-canvas">
        {!hasData && (
          <motion.div className="dt-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
            <motion.div className="dt-empty-orb" animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }} transition={{ duration: 3, repeat: Infinity }}>
              <span className="dt-empty-icon">🎭</span>
            </motion.div>
            <h3 className="dt-empty-title">AI Decision Flow</h3>
            <p className="dt-empty-text">Watch every step of ATHENA's multi-agent pipeline unfold in real-time.<br />Ask a question or click <strong>Watch Demo</strong> to begin.</p>
          </motion.div>
        )}

        <AnimatePresence mode="sync">
          {hasData && (
            <motion.div className="dt-pipeline" initial="hidden" animate="visible" variants={stagger}>

              {/* ═══ 1. QUERY ═══ */}
              {tree.query && (
                <>
                  <StageCard icon="💬" title="Query Received" status="complete" color="#818cf8">
                    <div className="dt-query-bubble">
                      <TypeWriter text={tree.query.text} speed={12} />
                    </div>
                  </StageCard>
                  <FlowLine done={!!tree.analysis} active={!tree.analysis} />
                </>
              )}

              {/* ═══ 2. INTENT ANALYSIS ═══ */}
              {tree.analysis && (
                <>
                  <StageCard icon="🧠" title="Intent Analysis & Routing" status={tree.rag || agentCount > 0 ? 'complete' : 'active'} color="#a78bfa">
                    <div className="dt-analysis-grid">
                      <div className="dt-a-reasoning">
                        <pre className="dt-pre-text">{tree.analysis.reasoning}</pre>
                      </div>
                      <motion.div className="dt-a-flags" variants={stagger} initial="hidden" animate="visible">
                        <motion.div variants={pop} className={`dt-flag ${tree.analysis.needsRag ? 'on' : ''}`}>
                          <span className="dt-flag-icon">📚</span><span>RAG {tree.analysis.needsRag ? 'ON' : 'OFF'}</span>
                        </motion.div>
                        <motion.div variants={pop} className={`dt-flag ${tree.analysis.needsViz ? 'on' : ''}`}>
                          <span className="dt-flag-icon">📊</span><span>VIZ {tree.analysis.needsViz ? 'ON' : 'OFF'}</span>
                        </motion.div>
                        <motion.div variants={pop} className={`dt-flag ${tree.analysis.isComprehensive ? 'on' : ''}`}>
                          <span className="dt-flag-icon">🔍</span><span>{tree.analysis.isComprehensive ? 'DEEP' : 'QUICK'}</span>
                        </motion.div>
                      </motion.div>
                    </div>
                    {tree.analysis.agents.length > 0 && (
                      <motion.div className="dt-agent-pills" variants={stagger} initial="hidden" animate="visible">
                        <span className="dt-pills-label">Routed to:</span>
                        {tree.analysis.agents.map((a, i) => (
                          <motion.span key={i} className="dt-pill" variants={pop} style={{ '--pill-c': AGENT_COLORS[i % AGENT_COLORS.length] }}>
                            {cleanName(a)}
                          </motion.span>
                        ))}
                      </motion.div>
                    )}
                  </StageCard>
                  <FlowLine done={!!tree.rag || agentCount > 0} active={!tree.rag && agentCount === 0} />
                </>
              )}

              {/* ═══ 3. RAG RETRIEVAL ═══ */}
              {tree.rag && (
                <>
                  <StageCard icon="📚" title="Knowledge Retrieval (RAG)" status={tree.rag.status === 'complete' ? 'complete' : 'active'} color="#f59e0b">
                    {tree.rag.status !== 'complete' ? (
                      <motion.div className="dt-rag-searching" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}>
                        <motion.div className="dt-search-radar" animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                          <div className="dt-radar-sweep" />
                        </motion.div>
                        <span>Searching knowledge base…</span>
                      </motion.div>
                    ) : (
                      <div className="dt-rag-complete">
                        {/* 1) Query classification */}
                        <motion.div className="dt-rag-block" variants={fadeUp}>
                          <div className="dt-rag-block-head">
                            <span className="dt-rag-step">1</span>
                            <h4>Query Classification</h4>
                          </div>
                          <div className="dt-rag-classification">
                            <span className="dt-rag-class-chip">🧩 {(tree.rag.queryType || 'analytical').toUpperCase()}</span>
                            {tree.rag.classificationReasoning && (
                              <p className="dt-rag-class-reason">"{tree.rag.classificationReasoning}"</p>
                            )}
                            {tree.rag.topics.length > 0 && (
                              <div className="dt-rag-topics">
                                {tree.rag.topics.map((topic, i) => (
                                  <motion.span key={i} className="dt-topic-chip" variants={pop}>{topic}</motion.span>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>

                        {/* 2) Strategy selection */}
                        <motion.div className="dt-rag-block" variants={fadeUp}>
                          <div className="dt-rag-block-head">
                            <span className="dt-rag-step">2</span>
                            <h4>Strategy Selection</h4>
                          </div>
                          <div className="dt-rag-strategies">
                            {getRagStrategyRows(tree.rag).map((s, i) => (
                              <motion.div key={s.key} className={`dt-rag-strategy ${s.selected ? 'selected' : ''}`} variants={slideRight} custom={i}>
                                {s.selected && <span className="dt-rag-selected">SELECTED</span>}
                                <span className="dt-rag-strategy-name">{s.icon} {s.label}</span>
                                <span>top_k: {s.topK}</span>
                                <span>threshold: {Math.round(s.threshold * 100)}%</span>
                                <span>expand: {s.expand ? 'yes' : 'no'}</span>
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>

                        {/* 3) Retrieval & filtering */}
                        <motion.div className="dt-rag-block" variants={fadeUp}>
                          <div className="dt-rag-block-head">
                            <span className="dt-rag-step">3</span>
                            <h4>Retrieval & Filtering</h4>
                          </div>
                        {/* Funnel visualization */}
                        <div className="dt-funnel">
                          <motion.div className="dt-funnel-stage top" variants={fadeUp}>
                            <span className="dt-funnel-num"><AnimCount value={tree.rag.chunksRetrieved} /></span>
                            <span className="dt-funnel-label">Retrieved</span>
                          </motion.div>
                          <div className="dt-funnel-arrow">
                            <motion.div className="dt-funnel-filter-line" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.5 }}>
                              <span className="dt-funnel-filter-text">≥{tree.rag.profile.min_relevance != null ? `${(tree.rag.profile.min_relevance * 100).toFixed(0)}%` : '?'} relevance filter</span>
                            </motion.div>
                          </div>
                          <motion.div className="dt-funnel-stage bottom" variants={fadeUp}>
                            <span className="dt-funnel-num passed"><AnimCount value={tree.rag.chunksAfterFilter} /></span>
                            <span className="dt-funnel-label">Passed</span>
                          </motion.div>
                          {tree.rag.chunksRetrieved > tree.rag.chunksAfterFilter && (
                            <motion.span className="dt-funnel-dropped" variants={fadeIn}>
                              🗑 {tree.rag.chunksRetrieved - tree.rag.chunksAfterFilter} filtered out
                            </motion.span>
                          )}
                        </div>
                        </motion.div>

                        {/* 4) Source relevance */}
                        {tree.rag.citations.length > 0 && (
                          <motion.div className="dt-rag-block" variants={fadeUp}>
                            <div className="dt-rag-block-head">
                              <span className="dt-rag-step">4</span>
                              <h4>Source Relevance Scores</h4>
                            </div>
                            <motion.div className="dt-citations" variants={stagger} initial="hidden" animate="visible">
                            {tree.rag.citations.map((c, i) => {
                              const pct = Math.round(c.score * 100);
                              const barColor = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
                              return (
                                <motion.div key={i} className="dt-cite-row" variants={slideRight}>
                                  <span className="dt-cite-rank">#{i + 1}</span>
                                  <span className="dt-cite-name">{c.heading || c.source}</span>
                                  <div className="dt-cite-track">
                                    <motion.div className="dt-cite-fill" style={{ background: barColor }} variants={growBar(pct)} initial="hidden" animate="visible" />
                                  </div>
                                  <motion.span className="dt-cite-pct" style={{ color: barColor }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 + i * 0.1 }}>
                                    {pct}%
                                  </motion.span>
                                </motion.div>
                              );
                            })}
                            </motion.div>
                            {tree.rag.sourceDocuments.length > 0 && (
                              <div className="dt-rag-sources-list">
                                {tree.rag.sourceDocuments.map((src, i) => (
                                  <span key={i} className="dt-rag-source-pill">📄 {src}</span>
                                ))}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </div>
                    )}
                  </StageCard>
                  <FlowLine done={agentCount > 0} active={agentCount === 0} />
                </>
              )}

              {/* ═══ 4. AGENTS — Parallel Execution ═══ */}
              {agentCount > 0 && (
                <>
                  <StageCard icon="🤖" title={`Expert Analysis — ${doneAgents}/${agentCount} agents`} status={doneAgents === agentCount ? 'complete' : 'active'} color="#10b981">
                    <div className="dt-agents-grid">
                      {agentEntries.map(([name, agent], agIdx) => {
                        const color = AGENT_COLORS[agIdx % AGENT_COLORS.length];
                        const isDone = agent.status === 'complete';
                        const progress = isDone ? 1 : agent.thoughts.length > 0 ? 0.5 : 0.15;
                        const lastThought = agent.thoughts[agent.thoughts.length - 1];
                        const activeTool = agent.tools.find(t => t.phase === 'start');
                        const doneTool = agent.tools.filter(t => t.phase === 'complete');

                        return (
                          <motion.div key={name} className={`dt-agent-card ${isDone ? 'done' : 'working'}`}
                            variants={fadeUp} initial="hidden" animate="visible"
                            transition={{ delay: agIdx * 0.12 }}
                            style={{ '--ag-c': color }}>

                            {/* Agent header with progress ring */}
                            <div className="dt-ag-top">
                              <ProgressRing progress={progress} size={44} stroke={3} color={color}>
                                {isDone ? (
                                  <motion.svg viewBox="0 0 24 24" width="18" height="18" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}>
                                    <motion.path d="M5 13l4 4L19 7" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6 }} />
                                  </motion.svg>
                                ) : (
                                  <motion.span className="dt-ag-step-num" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity }}>
                                    {agent.stepNumber || '?'}
                                  </motion.span>
                                )}
                              </ProgressRing>
                              <div className="dt-ag-info">
                                <span className="dt-ag-name" style={{ color }}>{cleanName(name)}</span>
                                <span className="dt-ag-meta">
                                  {agent.stepNumber && `Step ${agent.stepNumber}/${agent.totalSteps}`}
                                  {isDone && agent.duration != null && ` · ${fmtSec(agent.duration)}`}
                                </span>
                              </div>
                            </div>

                            {/* Expected output */}
                            {agent.expectedOutput && (
                              <motion.div className="dt-ag-goal" variants={fadeIn}>
                                <span className="dt-ag-goal-label">Goal:</span> {agent.expectedOutput}
                              </motion.div>
                            )}

                            {/* Active thought stream */}
                            {lastThought && (
                              <motion.div className="dt-ag-thought" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.3 }}>
                                <span className="dt-ag-phase">
                                  {lastThought.phase === 'plan' && '📋 Planning'}
                                  {lastThought.phase === 'data_query' && '🗄️ Querying'}
                                  {lastThought.phase === 'self_check' && '🔍 Verifying'}
                                  {lastThought.phase === 'result' && '💡 Result'}
                                  {!['plan', 'data_query', 'self_check', 'result'].includes(lastThought.phase) && `💭 ${lastThought.phase}`}
                                </span>
                                <p className="dt-ag-thought-text">{lastThought.content}</p>
                              </motion.div>
                            )}

                            {/* Tool executions */}
                            <AnimatePresence>
                              {activeTool && (
                                <motion.div className="dt-ag-tool running" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                                  <motion.span className="dt-tool-spinner" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}>⚙</motion.span>
                                  <span className="dt-tool-name">{activeTool.name}</span>
                                  <span className="dt-tool-input">{activeTool.input}</span>
                                </motion.div>
                              )}
                            </AnimatePresence>
                            {doneTool.length > 0 && (
                              <motion.div className="dt-ag-tools-done" variants={stagger} initial="hidden" animate="visible">
                                {doneTool.map((tl, ti) => (
                                  <motion.div key={ti} className="dt-ag-tool done" variants={slideRight}>
                                    <span className="dt-tool-check">✓</span>
                                    <span className="dt-tool-name">{tl.name}</span>
                                    {tl.resultPreview && <p className="dt-tool-preview">{tl.resultPreview.substring(0, 120)}{tl.resultPreview.length > 120 ? '…' : ''}</p>}
                                    {tl.chartsCount != null && <span className="dt-tool-tag chart">📊 {tl.chartsCount} chart{tl.chartsCount > 1 ? 's' : ''}</span>}
                                    {tl.resultLength != null && <span className="dt-tool-tag">{tl.resultLength.toLocaleString()} chars</span>}
                                  </motion.div>
                                ))}
                              </motion.div>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  </StageCard>
                  <FlowLine done={!!tree.xai || !!tree.completion} active={!tree.xai && !tree.completion} />
                </>
              )}

              {/* ═══ 5. XAI EXPLAINABILITY ═══ */}
              {tree.xai && (
                <>
                  <StageCard icon="🔬" title="Explainability (XAI)" status={tree.xai.status === 'complete' ? 'complete' : 'active'} color="#06b6d4">
                    {tree.xai.status !== 'complete' ? (
                      <motion.div className="dt-xai-active" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}>
                        Analyzing decision transparency…
                      </motion.div>
                    ) : (
                      <div className="dt-xai-result">
                        {/* Confidence gauge */}
                        <motion.div className="dt-xai-conf" variants={fadeUp}>
                          <ProgressRing progress={tree.xai.overallConfidence / 100} size={90} stroke={6}
                            color={tree.xai.overallConfidence >= 80 ? '#10b981' : tree.xai.overallConfidence >= 60 ? '#f59e0b' : '#ef4444'}>
                            <span className="dt-xai-conf-num"><AnimCount value={tree.xai.overallConfidence} suffix="%" /></span>
                          </ProgressRing>
                          <span className="dt-xai-conf-label">System Confidence</span>
                        </motion.div>

                        {/* Decision factors */}
                        {tree.xai.decisionFactors.length > 0 && (
                          <motion.div className="dt-xai-factors" variants={stagger} initial="hidden" animate="visible">
                            <h4 className="dt-xai-section-title">Decision Factors</h4>
                            {tree.xai.decisionFactors.sort((a, b) => b.influence - a.influence).map((f, i) => {
                              const c = f.influence >= 25 ? '#10b981' : f.influence >= 15 ? '#f59e0b' : '#06b6d4';
                              return (
                                <motion.div key={i} className="dt-xai-bar-row" variants={slideRight}>
                                  <span className="dt-xai-bar-name">{f.factor}</span>
                                  <div className="dt-xai-bar-track">
                                    <motion.div className="dt-xai-bar-fill" style={{ background: c }}
                                      variants={growBar(f.influence)} initial="hidden" animate="visible" />
                                  </div>
                                  <motion.span className="dt-xai-bar-pct" style={{ color: c }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 + i * 0.1 }}>
                                    {f.influence}%
                                  </motion.span>
                                </motion.div>
                              );
                            })}
                          </motion.div>
                        )}

                        {/* Agent contributions */}
                        {tree.xai.agentContributions.length > 0 && (
                          <motion.div className="dt-xai-contribs" variants={stagger} initial="hidden" animate="visible">
                            <h4 className="dt-xai-section-title">Agent Contributions</h4>
                            {tree.xai.agentContributions.map((ac, i) => (
                              <motion.div key={i} className="dt-xai-contrib" variants={slideRight}>
                                <div className="dt-xai-contrib-head">
                                  <span className="dt-xai-contrib-agent" style={{ color: AGENT_COLORS[i % AGENT_COLORS.length] }}>{ac.agent}</span>
                                  <span className="dt-xai-contrib-pct">{ac.influence_pct}%</span>
                                </div>
                                <div className="dt-xai-bar-track">
                                  <motion.div className="dt-xai-bar-fill" style={{ background: AGENT_COLORS[i % AGENT_COLORS.length] }}
                                    variants={growBar(ac.influence_pct)} initial="hidden" animate="visible" />
                                </div>
                                <p className="dt-xai-contrib-desc">{ac.contribution}</p>
                              </motion.div>
                            ))}
                          </motion.div>
                        )}

                        {/* Confidence by topic */}
                        {tree.xai.confidenceScores.length > 0 && (
                          <motion.div className="dt-xai-topics" variants={stagger} initial="hidden" animate="visible">
                            <h4 className="dt-xai-section-title">Confidence by Topic</h4>
                            <div className="dt-xai-topic-chips">
                              {tree.xai.confidenceScores.map((cs, i) => (
                                <motion.div key={i} className="dt-xai-topic-chip" variants={pop}>
                                  <ProgressRing progress={cs.confidence / 100} size={40} stroke={3}
                                    color={cs.confidence >= 80 ? '#10b981' : '#f59e0b'}>
                                    <span className="dt-xai-mini-num">{cs.confidence}</span>
                                  </ProgressRing>
                                  <span className="dt-xai-topic-name">{cs.topic}</span>
                                </motion.div>
                              ))}
                            </div>
                          </motion.div>
                        )}

                        {/* Counterfactuals */}
                        {tree.xai.counterfactuals.length > 0 && (
                          <motion.div className="dt-xai-what-if" variants={stagger} initial="hidden" animate="visible">
                            <h4 className="dt-xai-section-title">What-If Scenarios</h4>
                            {tree.xai.counterfactuals.map((cf, i) => (
                              <motion.div key={i} className="dt-cf-card" variants={fadeUp}>
                                <div className="dt-cf-scenario"><span className="dt-cf-tag">IF</span> {cf.scenario}</div>
                                <div className="dt-cf-impact"><span className="dt-cf-tag then">THEN</span> {cf.impact}</div>
                              </motion.div>
                            ))}
                          </motion.div>
                        )}
                      </div>
                    )}
                  </StageCard>
                  <FlowLine done={!!tree.completion} active={!tree.completion} />
                </>
              )}

              {/* ═══ 7. COMPLETE ═══ */}
              {tree.completion && (
                <motion.div variants={fadeUp} initial="hidden" animate="visible">
                  <StageCard icon="✨" title="Pipeline Complete" status="complete" color="#22c55e">
                    <motion.div className="dt-complete-banner" initial={{ scale: 0.9 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
                      <span className="dt-complete-glyph">🎉</span>
                      <span className="dt-complete-text">
                        {agentCount} agents · {ragChunks} knowledge chunks · {confidence != null ? `${confidence}% confidence` : 'verified'}
                      </span>
                    </motion.div>
                    {tree.completion.reasoningSteps?.length > 0 && (
                      <motion.div className="dt-summary" variants={stagger} initial="hidden" animate="visible">
                        {tree.completion.reasoningSteps.map((step, i) => (
                          <motion.div key={i} className="dt-summary-row" variants={slideRight}>
                            <span className="dt-summary-dot" style={{ background: AGENT_COLORS[i % AGENT_COLORS.length] }} />
                            <span className="dt-summary-agent">{step.agent_name}</span>
                            <span className="dt-summary-task">{step.summary}</span>
                            <span className="dt-summary-dur">{fmtSec(step.duration_seconds)}</span>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </StageCard>
                </motion.div>
              )}

              <div ref={bottomRef} />
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

/* ─── Metric ─── */
function Metric({ icon, label, value, color }) {
  return (
    <div className="dt-m">
      <span className="dt-m-icon">{icon}</span>
      <span className="dt-m-val" style={color ? { color } : undefined}>{value}</span>
      <span className="dt-m-label">{label}</span>
    </div>
  );
}
