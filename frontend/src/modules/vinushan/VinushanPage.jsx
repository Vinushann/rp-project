import { useEffect, useRef, useState, useCallback } from 'react';
import { streamVinushanChat } from '../../lib/api';
import AthenaChatMessage from './components/AthenaChatMessage';
import AgentThoughtsPanel from './components/AgentThoughtsPanel';
import SettingsPage from './components/SettingsPage';
import StatsPage from './components/StatsPage';
import './styles/Athena.css';
import './styles/AgentThoughts.css';
import './components/SettingsPage.css';
import './components/StatsPage.css';

/**
 * ATHENA - Context-Aware Forecasting and Decision Support System
 * Main page component with chat interface and real-time streaming reasoning panel
 */

const STORAGE_KEY = 'athena-chat-history';

const exampleQuestions = [
  'What are the top selling items this month?',
  'Show me a chart of sales trends',
  'How does weather affect my sales?',
  'Visualize the daily sales pattern',
  'What holidays are coming up?',
];

// Helper to load messages from localStorage
const loadMessagesFromStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate it's an array
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load chat history:', e);
  }
  return [];
};

// Helper to save messages to localStorage
const saveMessagesToStorage = (messages) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch (e) {
    console.error('Failed to save chat history:', e);
  }
};

function VinushanPage() {
  // Initialize messages from localStorage
  const [messages, setMessages] = useState(() => loadMessagesFromStorage());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showReasoning, setShowReasoning] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [activeTab, setActiveTab] = useState('athena');
  
  // Real-time event tracking
  const [currentRunId, setCurrentRunId] = useState(null);
  const [events, setEvents] = useState([]);
  const [routingReasoning, setRoutingReasoning] = useState(null);
  const [agentsNeeded, setAgentsNeeded] = useState([]);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      saveMessagesToStorage(messages);
    }
  }, [messages]);

  // Delete a Q&A pair (user message and its following assistant response)
  const handleDeleteMessage = (messageIndex) => {
    setMessages(prev => {
      const newMessages = [...prev];
      const targetMessage = newMessages[messageIndex];
      
      if (targetMessage.role === 'user') {
        // If it's a user message, also delete the following assistant message
        if (newMessages[messageIndex + 1]?.role === 'assistant') {
          newMessages.splice(messageIndex, 2);
        } else {
          newMessages.splice(messageIndex, 1);
        }
      } else {
        // If it's an assistant message, also delete the preceding user message
        if (newMessages[messageIndex - 1]?.role === 'user') {
          newMessages.splice(messageIndex - 1, 2);
        } else {
          newMessages.splice(messageIndex, 1);
        }
      }
      
      // Update localStorage (handle empty case)
      if (newMessages.length === 0) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        saveMessagesToStorage(newMessages);
      }
      
      return newMessages;
    });
  };

  // Clear all chat history
  const handleClearAllMessages = () => {
    if (window.confirm('Are you sure you want to clear all chat history?')) {
      setMessages([]);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;
      const isInputFocused = document.activeElement?.tagName === 'TEXTAREA' || 
                             document.activeElement?.tagName === 'INPUT';
      
      // Navigation shortcuts (Cmd/Ctrl + 1-4)
      if (cmdKey && !e.shiftKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            setActiveTab('overview');
            return;
          case '2':
            e.preventDefault();
            setActiveTab('athena');
            return;
          case '3':
            e.preventDefault();
            window.open('/docs.html', '_blank');
            return;
          case '4':
            e.preventDefault();
            setActiveTab('settings');
            return;
          case 's':
            // Cmd+S to stop execution (only when loading)
            if (isLoading) {
              e.preventDefault();
              handleStopRequest();
            }
            return;
          case 'r':
            // Cmd+R to toggle reasoning panel (only in Athena tab)
            if (activeTab === 'athena') {
              e.preventDefault();
              setShowReasoning(prev => !prev);
            }
            return;
        }
      }
      
      // Athena-specific shortcuts (only when in Athena tab and not in input)
      if (activeTab === 'athena' && !isInputFocused) {
        switch (e.key) {
          case '/':
            e.preventDefault();
            inputRef.current?.focus();
            return;
          case 's':
            // 's' for speaker - dispatch custom event to last message
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('athena-shortcut-speaker'));
            return;
          case 'e':
            // 'e' for export - dispatch custom event to last message
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('athena-shortcut-export'));
            return;
          case 'Escape':
            // Escape to close reasoning panel
            if (showReasoning) {
              e.preventDefault();
              setShowReasoning(false);
            }
            return;
        }
      }
      
      // '/' to focus input even when in input (standard behavior)
      if (e.key === '/' && !isInputFocused && activeTab === 'athena') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeTab, isLoading, showReasoning]);

  // Clear reasoning state
  const clearReasoning = () => {
    setEvents([]);
    setRoutingReasoning(null);
    setAgentsNeeded([]);
    setCurrentRunId(null);
  };

  const handleSendMessage = async (content) => {
    if (!content.trim() || isLoading) return;
    
    setError(null);
    setInputValue('');

    const userMessage = {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    
    // Open reasoning panel and reset state
    setShowReasoning(true);
    clearReasoning();
    
    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const history = [...messages, userMessage].map(({ role, content: text, timestamp }) => ({
        role,
        content: text,
        timestamp,
      }));

      // Use streaming API with real-time event callbacks
      await streamVinushanChat(content, history, {
        onRunStart: (data) => {
          setCurrentRunId(data.run_id);
          setEvents(prev => [...prev, data]);
        },
        
        onQueryAnalysis: (data) => {
          setRoutingReasoning(data.content || data.data?.reasoning);
          setAgentsNeeded(data.data?.agents_needed || []);
          setEvents(prev => [...prev, data]);
        },
        
        onAgentStart: (data) => {
          setEvents(prev => [...prev, data]);
        },
        
        onToolStart: (data) => {
          setEvents(prev => [...prev, data]);
        },
        
        onToolResult: (data) => {
          setEvents(prev => [...prev, data]);
        },
        
        onAgentOutput: (data) => {
          setEvents(prev => [...prev, data]);
        },
        
        onAgentThought: (data) => {
          setEvents(prev => [...prev, data]);
        },
        
        onAgentQuery: (data) => {
          setEvents(prev => [...prev, data]);
        },
        
        onAgentSelfCheck: (data) => {
          setEvents(prev => [...prev, data]);
        },
        
        onAgentResultSnapshot: (data) => {
          setEvents(prev => [...prev, data]);
        },
        
        onRouterThought: (data) => {
          setEvents(prev => [...prev, data]);
        },
        
        onAgentEnd: (data) => {
          setEvents(prev => [...prev, data]);
        },
        
        onRunEnd: (data) => {
          setEvents(prev => [...prev, data]);
          
          // Extract final response from data
          const responseData = data.data || {};
          
          const assistantMessage = {
            role: 'assistant',
            content: responseData.response || data.content || 'Analysis complete.',
            timestamp: new Date().toISOString(),
            charts: responseData.charts,
          };

          setMessages(prev => [...prev, assistantMessage]);
          setIsLoading(false);
        },
        
        onError: (data) => {
          setError(data.content || data.message || 'An error occurred');
          setEvents(prev => [...prev, data]);
          setIsLoading(false);
        },
      }, abortControllerRef.current?.signal);

    } catch (err) {
      // Check if this was an abort
      if (err.name === 'AbortError') {
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: '⏹️ Request cancelled by user.',
            timestamp: new Date().toISOString(),
          },
        ]);
        setIsLoading(false);
        return;
      }
      const message = err instanceof Error ? err.message : 'Failed to send message';
      setError(message);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${message}. Please try again.`,
          timestamp: new Date().toISOString(),
        },
      ]);
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputValue);
    }
  };

  const handleExampleClick = (question) => {
    if (!isLoading) {
      handleSendMessage(question);
    }
  };

  // Stop/cancel the current request
  const handleStopRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  // Helper to get the user question for an assistant message
  const getUserQuestionForMessage = (messageIndex) => {
    if (messageIndex > 0 && messages[messageIndex - 1]?.role === 'user') {
      return messages[messageIndex - 1].content;
    }
    return '';
  };

  return (
    <div className="athena-container">
      {/* Header with Title and Navigation */}
      <header className="athena-header">
        <div className="athena-logo">
          <h1 className="athena-title">ATHENA</h1>
          <p className="athena-subtitle">A Context-Aware Forecasting and Decision Support System</p>
        </div>
        <nav className="athena-nav">
          <button 
            className={`nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={`nav-tab ${activeTab === 'athena' ? 'active' : ''}`}
            onClick={() => setActiveTab('athena')}
          >
            Athena
          </button>
          <button 
            className="nav-tab"
            onClick={() => window.open('/docs.html', '_blank')}
            title="Opens in new tab"
          >
            Guide ↗
          </button>
          <button 
            className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="athena-main">
        {/* Settings Tab Content */}
        {activeTab === 'settings' && (
          <SettingsPage />
        )}

        {/* Overview Tab Content */}
        {activeTab === 'overview' && (
          <StatsPage />
        )}

        {/* Athena Chat Tab Content */}
        {activeTab === 'athena' && (
          <>
            {/* Chat Section */}
            <section className={`athena-chat-section ${showReasoning ? 'with-reasoning' : ''}`}>
              {/* Messages Area */}
              <div className="athena-messages">
                {messages.length === 0 ? (
                  <div className="athena-welcome">
                    <h3>Welcome, Vinushan!</h3>
                    <p>
                      I can analyze sales, forecast demand, explain holiday and weather impacts, and create charts.
                    </p>
                    <div className="athena-examples">
                      {exampleQuestions.map((q) => (
                        <button
                          key={q}
                          type="button"
                          className="athena-example-btn"
                          onClick={() => handleExampleClick(q)}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Clear All Button */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      marginBottom: '12px',
                      paddingRight: '8px',
                    }}>
                      <button
                        onClick={handleClearAllMessages}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          background: 'transparent',
                          border: '1px solid var(--athena-border)',
                          borderRadius: '6px',
                          color: 'var(--athena-text-secondary)',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.borderColor = '#ef4444';
                          e.currentTarget.style.color = '#ef4444';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.borderColor = 'var(--athena-border)';
                          e.currentTarget.style.color = 'var(--athena-text-secondary)';
                        }}
                        title="Clear all chat history"
                      >
                        🗑️ Clear All
                      </button>
                    </div>
                    {messages.map((msg, idx) => (
                      <AthenaChatMessage
                        key={`${msg.timestamp}-${idx}`}
                        message={msg}
                        charts={msg.charts}
                        isLast={idx === messages.length - 1 && msg.role === 'assistant'}
                        onDelete={() => handleDeleteMessage(idx)}
                        messageIndex={idx}
                        userQuestion={getUserQuestionForMessage(idx)}
                      />
                    ))}
                  </>
                )}

                {/* Loading indicator with Stop button */}
                {isLoading && (
                  <div className="athena-loading" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '16px 20px',
                    marginRight: '80px',
                    borderLeft: '3px solid var(--athena-primary)',
                  }}>
                    <div className="loading-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <p className="loading-text" style={{ margin: 0, color: 'var(--athena-text-secondary)', fontSize: '0.9rem', flex: 1 }}>
                      {events.length > 0 
                        ? events[events.length - 1]?.content || 'Analyzing your question...'
                        : 'Analyzing your question...'}
                    </p>
                    <button
                      onClick={handleStopRequest}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '8px',
                        color: '#ef4444',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
                        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                      }}
                    >
                      ⏹ Stop
                    </button>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Error Banner */}
              {error && (
                <div className="athena-error">
                  <span>{error}</span>
                  <button onClick={() => setError(null)}>Dismiss</button>
                </div>
              )}

              {/* Input Section */}
              <div className="athena-input-section">
                <div className="athena-input-wrapper">
                  <textarea
                    ref={inputRef}
                    className="athena-input"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isLoading ? 'Thinking...' : 'Ask anything about your business...'}
                    disabled={isLoading}
                    rows={1}
                  />
                  <button
                    className="athena-send-btn"
                    onClick={() => handleSendMessage(inputValue)}
                    disabled={isLoading || !inputValue.trim()}
                  >
                    {isLoading ? '...' : 'Send'}
                  </button>
                </div>
              </div>
            </section>

            {/* Agent Thoughts Panel */}
            <AgentThoughtsPanel
              isOpen={showReasoning}
              onClose={() => setShowReasoning(false)}
              onClear={clearReasoning}
              events={events}
              currentRunId={currentRunId}
              isLoading={isLoading}
              routingReasoning={routingReasoning}
              agentsNeeded={agentsNeeded}
            />
          </>
        )}
      </main>
    </div>
  );
}

export default VinushanPage;
