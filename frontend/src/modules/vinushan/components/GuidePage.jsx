import { useState } from 'react';
import './GuidePage.css';

/**
 * GuidePage - User guide and keyboard shortcuts reference
 */
function GuidePage() {
  const [activeSection, setActiveSection] = useState('shortcuts');

  const keyboardShortcuts = [
    {
      category: 'Navigation',
      shortcuts: [
        { keys: ['⌘', '1'], description: 'Go to Overview' },
        { keys: ['⌘', '2'], description: 'Go to Athena Chat' },
        { keys: ['⌘', '3'], description: 'Go to Guide' },
        { keys: ['⌘', '4'], description: 'Go to Settings' },
      ]
    },
    {
      category: 'Athena Chat',
      shortcuts: [
        { keys: ['/'], description: 'Focus on input field' },
        { keys: ['s'], description: 'Toggle speaker (text-to-speech)' },
        { keys: ['e'], description: 'Open export options' },
        { keys: ['⌘', 's'], description: 'Stop agent execution' },
        { keys: ['Enter'], description: 'Send message' },
        { keys: ['Shift', 'Enter'], description: 'New line in message' },
      ]
    },
    {
      category: 'Agent Thoughts Panel',
      shortcuts: [
        { keys: ['⌘', 'r'], description: 'Toggle reasoning panel' },
        { keys: ['Esc'], description: 'Close reasoning panel' },
      ]
    }
  ];

  const features = [
    {
      title: '📊 Overview Dashboard',
      description: 'View real-time sales metrics, weather conditions, upcoming holidays, and interactive charts showing trends and patterns.',
      tips: [
        'Charts update based on the latest data',
        'Click on chart sections for detailed views',
        'Use the date range picker to filter data'
      ]
    },
    {
      title: '🤖 Athena Chat',
      description: 'Ask natural language questions about your business. Athena uses multiple AI agents to analyze data and provide actionable insights.',
      tips: [
        'Ask about specific months: "What should I do for February 2026?"',
        'Request visualizations: "Show me sales trends"',
        'Get recommendations: "What items should I promote?"'
      ]
    },
    {
      title: '⚙️ Settings',
      description: 'Configure email notifications, report schedules, and system preferences.',
      tips: [
        'Set up weekly email reports',
        'Configure notification preferences',
        'Manage API connections'
      ]
    }
  ];

  return (
    <div className="guide-container">
      <div className="guide-header">
        <h1>📖 User Guide</h1>
        <p>Learn how to use ATHENA effectively</p>
      </div>

      <div className="guide-tabs">
        <button 
          className={`guide-tab ${activeSection === 'shortcuts' ? 'active' : ''}`}
          onClick={() => setActiveSection('shortcuts')}
        >
          ⌨️ Keyboard Shortcuts
        </button>
        <button 
          className={`guide-tab ${activeSection === 'features' ? 'active' : ''}`}
          onClick={() => setActiveSection('features')}
        >
          ✨ Features
        </button>
        <button 
          className={`guide-tab ${activeSection === 'tips' ? 'active' : ''}`}
          onClick={() => setActiveSection('tips')}
        >
          💡 Tips & Tricks
        </button>
      </div>

      <div className="guide-content">
        {/* Keyboard Shortcuts Section */}
        {activeSection === 'shortcuts' && (
          <div className="shortcuts-section">
            <div className="shortcuts-intro">
              <h2>Keyboard Shortcuts</h2>
              <p>Use these shortcuts to navigate and control ATHENA more efficiently.</p>
            </div>

            {keyboardShortcuts.map((category, idx) => (
              <div key={idx} className="shortcut-category">
                <h3>{category.category}</h3>
                <div className="shortcuts-grid">
                  {category.shortcuts.map((shortcut, sIdx) => (
                    <div key={sIdx} className="shortcut-item">
                      <div className="shortcut-keys">
                        {shortcut.keys.map((key, kIdx) => (
                          <span key={kIdx}>
                            <kbd>{key}</kbd>
                            {kIdx < shortcut.keys.length - 1 && <span className="key-plus">+</span>}
                          </span>
                        ))}
                      </div>
                      <span className="shortcut-description">{shortcut.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="shortcut-note">
              <p>💡 <strong>Tip:</strong> On Windows/Linux, use <kbd>Ctrl</kbd> instead of <kbd>⌘</kbd></p>
            </div>
          </div>
        )}

        {/* Features Section */}
        {activeSection === 'features' && (
          <div className="features-section">
            <h2>ATHENA Features</h2>
            
            {features.map((feature, idx) => (
              <div key={idx} className="feature-card">
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
                <ul>
                  {feature.tips.map((tip, tIdx) => (
                    <li key={tIdx}>{tip}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* Tips & Tricks Section */}
        {activeSection === 'tips' && (
          <div className="tips-section">
            <h2>Tips & Tricks</h2>
            
            <div className="tip-card">
              <h3>🎯 Ask Specific Questions</h3>
              <p>Instead of "What should I do?", try "What are the actions for February 2026?" for more targeted insights.</p>
            </div>

            <div className="tip-card">
              <h3>📅 Use Date Context</h3>
              <p>Mention specific months or dates in your questions. ATHENA understands "next month", "February", or "Q1 2026".</p>
            </div>

            <div className="tip-card">
              <h3>📊 Request Visualizations</h3>
              <p>Ask for charts: "Show me a sales trend chart" or "Visualize top selling items".</p>
            </div>

            <div className="tip-card">
              <h3>🔄 Watch Agent Thoughts</h3>
              <p>The Agent Thoughts panel shows you exactly how ATHENA reasons through your question.</p>
            </div>

            <div className="tip-card">
              <h3>⏹️ Stop Long Queries</h3>
              <p>Use the Stop button or press <kbd>⌘</kbd>+<kbd>s</kbd> to cancel a long-running query.</p>
            </div>

            <div className="tip-card">
              <h3>🔊 Listen to Responses</h3>
              <p>Press <kbd>s</kbd> on any response to have ATHENA read it aloud.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default GuidePage;
