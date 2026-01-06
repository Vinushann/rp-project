import { useState, useEffect } from 'react';
import { getEmailSettings, updateEmailSettings } from '../../../lib/api';
import './SettingsPage.css';

/**
 * Settings Page Component
 * Allows users to configure email recipients for reports
 */
function SettingsPage() {
  const [settings, setSettings] = useState({
    manager_email: '',
    owner_email: '',
    finance_email: '',
    slack_webhook_url: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await getEmailSettings();
      setSettings({
        manager_email: data.manager_email || '',
        owner_email: data.owner_email || '',
        finance_email: data.finance_email || '',
        slack_webhook_url: data.slack_webhook_url || '',
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field) => (e) => {
    setSettings(prev => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    
    try {
      await updateEmailSettings(settings);
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (error) {
      console.error('Failed to save settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const validateEmail = (email) => {
    if (!email) return true; // Empty is valid
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const isValid = () => {
    return (
      validateEmail(settings.manager_email) &&
      validateEmail(settings.owner_email) &&
      validateEmail(settings.finance_email)
    );
  };

  if (loading) {
    return (
      <div className="settings-page">
        <div className="settings-loading">
          <div className="loading-spinner"></div>
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h2>📧 Email Settings</h2>
        <p>Configure email addresses for automated report delivery</p>
      </div>

      {message && (
        <div className={`settings-message ${message.type}`}>
          {message.type === 'success' ? '✓' : '⚠'} {message.text}
        </div>
      )}

      <div className="settings-form">
        <div className="settings-section">
          <h3>Report Recipients</h3>
          <p className="section-description">
            Set the email addresses for each role. Reports will be sent to these addresses when triggered.
          </p>

          <div className="form-group">
            <label htmlFor="manager-email">
              <span className="label-icon">👤</span>
              Manager Email
            </label>
            <input
              id="manager-email"
              type="email"
              value={settings.manager_email}
              onChange={handleChange('manager_email')}
              placeholder="manager@example.com"
              className={!validateEmail(settings.manager_email) ? 'invalid' : ''}
            />
            <span className="help-text">
              Receives daily snapshots with forecast vs actual comparison
            </span>
          </div>

          <div className="form-group">
            <label htmlFor="owner-email">
              <span className="label-icon">👔</span>
              Owner Email
            </label>
            <input
              id="owner-email"
              type="email"
              value={settings.owner_email}
              onChange={handleChange('owner_email')}
              placeholder="owner@example.com"
              className={!validateEmail(settings.owner_email) ? 'invalid' : ''}
            />
            <span className="help-text">
              Receives monthly trend summaries and model accuracy reports
            </span>
          </div>

          <div className="form-group">
            <label htmlFor="finance-email">
              <span className="label-icon">💰</span>
              Finance Email
            </label>
            <input
              id="finance-email"
              type="email"
              value={settings.finance_email}
              onChange={handleChange('finance_email')}
              placeholder="finance@example.com"
              className={!validateEmail(settings.finance_email) ? 'invalid' : ''}
            />
            <span className="help-text">
              Receives revenue-only reports (gross, discount, net)
            </span>
          </div>
        </div>

        <div className="settings-section">
          <h3>Slack Integration</h3>
          <p className="section-description">
            Optional: Configure a Slack webhook URL to post daily digests to a channel.
          </p>

          <div className="form-group">
            <label htmlFor="slack-webhook">
              <span className="label-icon">💬</span>
              Slack Webhook URL
            </label>
            <input
              id="slack-webhook"
              type="url"
              value={settings.slack_webhook_url}
              onChange={handleChange('slack_webhook_url')}
              placeholder="https://hooks.slack.com/services/..."
            />
            <span className="help-text">
              Get this from your Slack workspace's Incoming Webhooks app
            </span>
          </div>
        </div>

        <div className="settings-actions">
          <button
            className="save-button"
            onClick={handleSave}
            disabled={saving || !isValid()}
          >
            {saving ? (
              <>
                <span className="button-spinner"></span>
                Saving...
              </>
            ) : (
              <>💾 Save Settings</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
