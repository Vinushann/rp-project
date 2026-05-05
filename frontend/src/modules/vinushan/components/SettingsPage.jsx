import { useState, useEffect } from 'react';
import './SettingsPage.css';

const SETTINGS_STORAGE_KEY = 'athena-settings';

// Default settings
const defaultSettings = {
  // User Profile & Notifications
  managerEmail: '',
  managerName: '',
  notificationPreference: 'none', // 'none', 'daily', 'weekly'
  
  // Chat Preferences
  autoTextToSpeech: false,
  showAgentThoughts: true,
  
  // Appearance
  theme: 'dark', // 'light', 'dark', 'system'
};

// Load settings from localStorage
const loadSettings = () => {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return defaultSettings;
};

// Save settings to localStorage
const saveSettings = (settings) => {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    // Dispatch custom event so other components can react
    window.dispatchEvent(new CustomEvent('athena-settings-changed', { detail: settings }));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
};

/**
 * Settings Page Component
 * Professional settings interface for ATHENA
 */
function SettingsPage({ 
  showAgentThoughts, 
  onToggleAgentThoughts,
  onClearChatHistory,
  chatHistoryCount = 0
}) {
  const [settings, setSettings] = useState(() => loadSettings());
  const [saveStatus, setSaveStatus] = useState(null);
  const [clearConfirm, setClearConfirm] = useState(false);

  // Apply theme on mount and when it changes
  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  // Sync showAgentThoughts from parent if provided
  useEffect(() => {
    if (showAgentThoughts !== undefined && settings.showAgentThoughts !== showAgentThoughts) {
      setSettings(prev => ({ ...prev, showAgentThoughts }));
    }
  }, [showAgentThoughts]);

  const applyTheme = (theme) => {
    const root = document.documentElement;
    
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', theme);
    }
  };

  const handleChange = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveSettings(newSettings);
    
    // Handle special cases
    if (key === 'showAgentThoughts' && onToggleAgentThoughts) {
      onToggleAgentThoughts(value);
    }
    
    // Show save indicator
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus(null), 2000);
  };

  const handleClearHistory = () => {
    if (clearConfirm) {
      if (onClearChatHistory) {
        onClearChatHistory();
      }
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

  const validateEmail = (email) => {
    if (!email) return true;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  return (
    <div className="settings-page">
      {/* Save Indicator */}
      {saveStatus && (
        <div className={`settings-save-indicator ${saveStatus}`}>
          {saveStatus === 'saved' && '✓ Saved'}
          {saveStatus === 'cleared' && '✓ History Cleared'}
          {saveStatus === 'reset' && '✓ Reset Complete'}
        </div>
      )}

      <div className="settings-content">
        {/* Two Column Grid Layout */}
        <div className="settings-grid">
          {/* Left Column - User Profile */}
          <section className="settings-section">
            <div className="section-header">
              <span className="section-icon">👤</span>
              <h2>User Profile</h2>
            </div>
            <div className="settings-group">
              <div className="form-field">
                <label>Manager Email</label>
                <input
                  type="email"
                  value={settings.managerEmail}
                  onChange={(e) => handleChange('managerEmail', e.target.value)}
                  placeholder="manager@coffeeshop.com"
                  className={settings.managerEmail && !validateEmail(settings.managerEmail) ? 'invalid' : ''}
                />
              </div>
              <div className="form-field">
                <label>Manager Name</label>
                <input
                  type="text"
                  value={settings.managerName}
                  onChange={(e) => handleChange('managerName', e.target.value)}
                  placeholder="John Doe"
                />
              </div>
              <div className="form-field">
                <label>Notifications</label>
                <select
                  value={settings.notificationPreference}
                  onChange={(e) => handleChange('notificationPreference', e.target.value)}
                >
                  <option value="none">No notifications</option>
                  <option value="daily">Daily digest</option>
                  <option value="weekly">Weekly summary</option>
                </select>
              </div>
            </div>
          </section>

          {/* Right Column - Chat & Behavior */}
          <section className="settings-section">
            <div className="section-header">
              <span className="section-icon">💬</span>
              <h2>Chat Preferences</h2>
            </div>
            <div className="settings-group">
              <div className="toggle-field">
                <div className="toggle-info">
                  <span className="toggle-name">Auto Text-to-Speech</span>
                  <span className="toggle-desc">Read responses aloud</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.autoTextToSpeech}
                    onChange={(e) => handleChange('autoTextToSpeech', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <div className="toggle-field">
                <div className="toggle-info">
                  <span className="toggle-name">Show Agent Thoughts</span>
                  <span className="toggle-desc">Display AI reasoning panel</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.showAgentThoughts}
                    onChange={(e) => handleChange('showAgentThoughts', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <div className="action-field">
                <div className="toggle-info">
                  <span className="toggle-name">Chat History</span>
                  <span className="toggle-desc">{chatHistoryCount} messages</span>
                </div>
                <button
                  className={`btn-danger ${clearConfirm ? 'confirm' : ''}`}
                  onClick={handleClearHistory}
                  disabled={chatHistoryCount === 0}
                >
                  {clearConfirm ? 'Confirm' : 'Clear'}
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Theme Section - Full Width */}
        <section className="settings-section theme-section">
          <div className="section-header">
            <span className="section-icon">🎨</span>
            <h2>Appearance</h2>
          </div>
          <div className="theme-grid">
            <button
              className={`theme-card ${settings.theme === 'light' ? 'active' : ''}`}
              onClick={() => handleChange('theme', 'light')}
            >
              <div className="theme-preview light">
                <div className="preview-bar"></div>
                <div className="preview-content">
                  <div className="preview-line"></div>
                  <div className="preview-line short"></div>
                </div>
              </div>
              <span>Light</span>
            </button>
            <button
              className={`theme-card ${settings.theme === 'dark' ? 'active' : ''}`}
              onClick={() => handleChange('theme', 'dark')}
            >
              <div className="theme-preview dark">
                <div className="preview-bar"></div>
                <div className="preview-content">
                  <div className="preview-line"></div>
                  <div className="preview-line short"></div>
                </div>
              </div>
              <span>Dark</span>
            </button>
            <button
              className={`theme-card ${settings.theme === 'system' ? 'active' : ''}`}
              onClick={() => handleChange('theme', 'system')}
            >
              <div className="theme-preview system">
                <div className="preview-half light"></div>
                <div className="preview-half dark"></div>
              </div>
              <span>System</span>
            </button>
          </div>
        </section>

        {/* Footer Actions */}
        <div className="settings-actions">
          <button className="btn-secondary" onClick={handleResetSettings}>
            ↺ Reset to Defaults
          </button>
          <span className="settings-version">ATHENA v1.0.0 • SLIIT Research Project © 2026</span>
        </div>
      </div>
    </div>
  );
}

// Export helper function to get settings from anywhere
export const getAthenaSettings = () => loadSettings();

export default SettingsPage;
