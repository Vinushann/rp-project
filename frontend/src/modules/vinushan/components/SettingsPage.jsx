import { useState, useEffect, useMemo } from 'react';
import './SettingsPage.css';

const SETTINGS_STORAGE_KEY = 'athena-settings';
const FOLLOWUP_STORAGE_KEY = 'athena-followup-enabled';
const XAI_STORAGE_KEY = 'athena-xai-enabled';

/* ── SVG Icon Components ─────────────────────────────── */
const IconUser = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconChat = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);
const IconBrain = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/>
    <path d="M10 21h4"/><path d="M12 17v4"/>
  </svg>
);
const IconShield = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const IconPalette = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/>
    <circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12" r="1.5"/>
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-1 0-.83.67-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-5.5-4.5-9.95-10-10z"/>
  </svg>
);
const IconKeyboard = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01"/>
    <path d="M6 12h.01M10 12h.01M14 12h.01M18 12h.01"/><path d="M8 16h8"/>
  </svg>
);
const IconInfo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
  </svg>
);
const IconReset = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
  </svg>
);
const IconExport = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

// Default settings
const defaultSettings = {
  managerEmail: '',
  managerName: '',
  showAgentThoughts: true,
  sendOnEnter: true,
  autoOpenReasoning: true,
  defaultFollowUpMode: false,
  defaultExplainability: true,
  streamResponses: true,
  theme: 'dark',
};

const loadSettings = () => {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (stored) return { ...defaultSettings, ...JSON.parse(stored) };
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return defaultSettings;
};

const saveSettings = (settings) => {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('athena-settings-changed', { detail: settings }));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
};

const loadInitialBoolean = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch { return fallback; }
};

/* ── Reusable sub-components ────────────────────────── */
function Toggle({ label, desc, checked, onChange }) {
  return (
    <div className="sp-toggle-row">
      <div className="sp-toggle-text">
        <span className="sp-toggle-label">{label}</span>
        {desc && <span className="sp-toggle-desc">{desc}</span>}
      </div>
      <label className="sp-switch">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="sp-slider" />
      </label>
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div className="sp-select-field">
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function InputField({ label, type = 'text', value, onChange, placeholder, error }) {
  return (
    <div className="sp-input-field">
      <label>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={error ? 'sp-invalid' : ''}
      />
    </div>
  );
}

function SectionCard({ icon, title, desc, children, className = '' }) {
  return (
    <section className={`sp-card ${className}`}>
      <div className="sp-card-header">
        <div className="sp-card-icon">{icon}</div>
        <div>
          <h3 className="sp-card-title">{title}</h3>
          {desc && <p className="sp-card-desc">{desc}</p>}
        </div>
      </div>
      <div className="sp-card-body">{children}</div>
    </section>
  );
}

const SHORTCUT_GROUPS = [
  {
    title: 'Navigation',
    items: [
      { keys: ['⌘', '1'], action: 'Overview' },
      { keys: ['⌘', '2'], action: 'Athena' },
      { keys: ['⌘', '3'], action: 'Decision Flow' },
      { keys: ['⌘', '4'], action: 'Guide' },
      { keys: ['⌘', '5'], action: 'Settings' },
    ],
  },
  {
    title: 'Chat',
    items: [
      { keys: ['/'], action: 'Focus input' },
      { keys: ['Enter'], action: 'Send message' },
      { keys: ['⌘', 'S'], action: 'Stop query' },
      { keys: ['⌘', 'R'], action: 'Toggle agents' },
    ],
  },
  {
    title: 'Message Actions',
    items: [
      { keys: ['S'], action: 'Speak response' },
      { keys: ['E'], action: 'Export options' },
      { keys: ['Esc'], action: 'Close panels' },
    ],
  },
];

/* ── Main Component ─────────────────────────────────── */
function SettingsPage({
  showAgentThoughts,
  onToggleAgentThoughts,
  onClearChatHistory,
  chatHistoryCount = 0,
}) {
  const [settings, setSettings] = useState(() => loadSettings());
  const [saveStatus, setSaveStatus] = useState(null);
  const [clearConfirm, setClearConfirm] = useState(false);

  const storageUsed = useMemo(() => {
    try {
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('athena')) {
          total += (localStorage.getItem(key) || '').length * 2;
        }
      }
      return (total / 1024).toFixed(1);
    } catch { return '0'; }
  }, [saveStatus]);

  useEffect(() => { applyTheme(settings.theme); }, [settings.theme]);

  useEffect(() => {
    setSettings((prev) => ({
      ...prev,
      defaultFollowUpMode: loadInitialBoolean(FOLLOWUP_STORAGE_KEY, prev.defaultFollowUpMode),
      defaultExplainability: loadInitialBoolean(XAI_STORAGE_KEY, prev.defaultExplainability),
    }));
  }, []);

  useEffect(() => {
    if (showAgentThoughts !== undefined && settings.showAgentThoughts !== showAgentThoughts) {
      setSettings(prev => ({ ...prev, showAgentThoughts }));
    }
  }, [showAgentThoughts]);

  const applyTheme = (theme) => {
    const root = document.documentElement;
    if (theme === 'system') {
      root.setAttribute('data-theme', window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', theme);
    }
  };

  const handleChange = (key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveSettings(next);
    if (key === 'showAgentThoughts' && onToggleAgentThoughts) onToggleAgentThoughts(value);
    if (key === 'defaultFollowUpMode') localStorage.setItem(FOLLOWUP_STORAGE_KEY, JSON.stringify(value));
    if (key === 'defaultExplainability') localStorage.setItem(XAI_STORAGE_KEY, JSON.stringify(value));
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus(null), 2000);
  };

  const handleClearHistory = () => {
    if (clearConfirm) {
      onClearChatHistory?.();
      setClearConfirm(false);
      setSaveStatus('cleared');
      setTimeout(() => setSaveStatus(null), 2000);
    } else {
      setClearConfirm(true);
      setTimeout(() => setClearConfirm(false), 3000);
    }
  };

  const handleResetSettings = () => {
    if (window.confirm('Reset all settings to defaults? This cannot be undone.')) {
      setSettings(defaultSettings);
      saveSettings(defaultSettings);
      applyTheme(defaultSettings.theme);
      setSaveStatus('reset');
      setTimeout(() => setSaveStatus(null), 2000);
    }
  };

  const handleExportSettings = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'athena-settings.json';
    a.click();
    URL.revokeObjectURL(url);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus(null), 2000);
  };

  const validateEmail = (email) => !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  return (
    <div className="sp-page">
      {/* ── Page Header ── */}
      <header className="sp-header">
        <div>
          <h1 className="sp-title">Settings</h1>
          <p className="sp-subtitle">Manage your ATHENA preferences and configuration</p>
        </div>
        {saveStatus && (
          <div className={`sp-toast ${saveStatus}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            {saveStatus === 'saved' && 'Saved'}
            {saveStatus === 'cleared' && 'Cleared'}
            {saveStatus === 'reset' && 'Reset'}
          </div>
        )}
      </header>

      {/* ── Grid ── */}
      <div className="sp-grid">

        {/* ─ User Profile ─ */}
        <SectionCard icon={<IconUser />} title="User Profile" desc="Your account information">
          <InputField label="Email" type="email" value={settings.managerEmail} onChange={(v) => handleChange('managerEmail', v)} placeholder="manager@coffeeshop.com" error={settings.managerEmail && !validateEmail(settings.managerEmail)} />
          <InputField label="Full Name" value={settings.managerName} onChange={(v) => handleChange('managerName', v)} placeholder="John Doe" />
        </SectionCard>

        {/* ─ Chat Preferences ─ */}
        <SectionCard icon={<IconChat />} title="Chat Preferences" desc="Control chat behavior and input">
          <Toggle label="Show Agent Thoughts" desc="Display AI reasoning panel" checked={settings.showAgentThoughts} onChange={(v) => handleChange('showAgentThoughts', v)} />
          <Toggle label="Send on Enter" desc="Shift+Enter for new line" checked={settings.sendOnEnter} onChange={(v) => handleChange('sendOnEnter', v)} />
          <Toggle label="Auto Open Reasoning" desc="Expand reasoning after sending" checked={settings.autoOpenReasoning} onChange={(v) => handleChange('autoOpenReasoning', v)} />
          <Toggle label="Follow-up Mode" desc="Keep conversation context active" checked={settings.defaultFollowUpMode} onChange={(v) => handleChange('defaultFollowUpMode', v)} />
          <Toggle label="Explainability (XAI)" desc="Show explanations by default" checked={settings.defaultExplainability} onChange={(v) => handleChange('defaultExplainability', v)} />
          <Toggle label="Stream Responses" desc="Show responses as they generate" checked={settings.streamResponses} onChange={(v) => handleChange('streamResponses', v)} />
          <div className="sp-action-row">
            <div className="sp-toggle-text">
              <span className="sp-toggle-label">Chat History</span>
              <span className="sp-toggle-desc">{chatHistoryCount} messages stored</span>
            </div>
            <button className={`sp-btn-danger ${clearConfirm ? 'confirm' : ''}`} onClick={handleClearHistory} disabled={chatHistoryCount === 0}>
              {clearConfirm ? 'Confirm Clear' : 'Clear All'}
            </button>
          </div>
        </SectionCard>


        {/* ─ Appearance ─ */}
        <SectionCard icon={<IconPalette />} title="Appearance" desc="Theme and visual preferences" className="sp-card-wide">
          <div className="sp-theme-row">
            {[
              { id: 'light', label: 'Light' },
              { id: 'dark', label: 'Dark' },
              { id: 'system', label: 'System' },
            ].map((t) => (
              <button key={t.id} className={`sp-theme-btn ${settings.theme === t.id ? 'active' : ''}`} onClick={() => handleChange('theme', t.id)}>
                <div className={`sp-theme-swatch ${t.id}`}>
                  {t.id === 'system' ? (
                    <><div className="swatch-half light" /><div className="swatch-half dark" /></>
                  ) : (
                    <><div className="swatch-bar" /><div className="swatch-lines"><div /><div className="short" /></div></>
                  )}
                </div>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </SectionCard>

        {/* ─ Keyboard Shortcuts ─ */}
        <SectionCard icon={<IconKeyboard />} title="Keyboard Shortcuts" desc="Quick reference for power users" className="sp-card-wide sp-shortcuts-card">
          <div className="sp-shortcuts-grid">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.title} className="sp-shortcut-group">
                <h4 className="sp-shortcut-group-title">{group.title}</h4>
                <div className="sp-shortcuts">
                  {group.items.map((item, i) => (
                    <div key={`${group.title}-${i}`} className="sp-shortcut-row">
                      <span className="sp-shortcut-keys">
                        {item.keys.map((key, kIdx) => (
                          <kbd key={`${group.title}-${i}-${kIdx}`}>{key}</kbd>
                        ))}
                      </span>
                      <span className="sp-shortcut-action">{item.action}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="sp-shortcut-note">
            On Windows/Linux, use <kbd>Ctrl</kbd> instead of <kbd>⌘</kbd>.
          </div>
        </SectionCard>

      </div>

      {/* ── Footer ── */}
      <footer className="sp-footer">
        <div className="sp-footer-actions">
          <button className="sp-btn-secondary" onClick={handleExportSettings}>
            <IconExport /> Export Settings
          </button>
          <button className="sp-btn-secondary sp-btn-reset" onClick={handleResetSettings}>
            <IconReset /> Reset to Defaults
          </button>
        </div>
        <div className="sp-footer-meta">
          <SectionCard icon={<IconInfo />} title="About ATHENA" desc="Context-Aware Forecasting and Decision Support System" className="sp-about-card">
            <div className="sp-about-grid">
              <div><span className="sp-about-label">Version</span><span className="sp-about-value">1.0.0</span></div>
              <div><span className="sp-about-label">Project</span><span className="sp-about-value">SLIIT Research</span></div>
              <div><span className="sp-about-label">Year</span><span className="sp-about-value">2025 — 2026</span></div>
              <div><span className="sp-about-label">License</span><span className="sp-about-value">Academic</span></div>
            </div>
          </SectionCard>
        </div>
      </footer>
    </div>
  );
}

export const getAthenaSettings = () => loadSettings();
export default SettingsPage;
