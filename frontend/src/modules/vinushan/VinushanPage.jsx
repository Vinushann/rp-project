import { useEffect, useRef, useState } from 'react';
import { streamVinushanChat } from '../../lib/api';
import AthenaChatMessage from './components/AthenaChatMessage';
import ReasoningPanel from './components/ReasoningPanel';
import './styles/Athena.css';

/**
 * ATHENA - Context-Aware Forecasting and Decision Support System
 * Main page component with chat interface and real-time streaming reasoning panel
 */

const exampleQuestions = [
  'What are the top selling items this month?',
  'Show me a chart of sales trends',
  'How does weather affect my sales?',
  'Visualize the daily sales pattern',
  'What holidays are coming up?',
];

function VinushanPage() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showReasoning, setShowReasoning] = useState(false);
  const [inputValue, setInputValue] = useState('');
  
  // Real-time event tracking
  const [currentRunId, setCurrentRunId] = useState(null);
  const [events, setEvents] = useState([]);
  const [routingReasoning, setRoutingReasoning] = useState(null);
  const [agentsNeeded, setAgentsNeeded] = useState([]);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      });

    } catch (err) {
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

  return (
    <div className="athena-container">
      {/* Header */}
      <header className="athena-header">
        <div className="athena-logo">
          <h1 className="athena-title">ATHENA</h1>
          <p className="athena-subtitle">A Context-Aware Forecasting and Decision Support System</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="athena-main">
        {/* Chat Section */}
        <section className={`athena-chat-section ${showReasoning ? 'with-reasoning' : ''}`}>
          {/* Messages Area */}
          <div className="athena-messages">
            {messages.length === 0 ? (
              <div className="athena-welcome">
                <h3>Welcome, Manager!</h3>
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
                {messages.map((msg, idx) => (
                  <AthenaChatMessage
                    key={`${msg.timestamp}-${idx}`}
                    message={msg}
                    charts={msg.charts}
                  />
                ))}
              </>
            )}

            {/* Loading indicator */}
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
                <p className="loading-text" style={{ margin: 0, color: 'var(--athena-text-secondary)', fontSize: '0.9rem' }}>
                  {events.length > 0 
                    ? events[events.length - 1]?.content || 'Analyzing your question...'
                    : 'Analyzing your question...'}
                </p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Error Banner */}
          {error && (
            <div className="athena-error">
              <span>⚠️ {error}</span>
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
                placeholder={isLoading ? 'Thinking...' : 'Ask anything about your coffee shop...'}
                disabled={isLoading}
                rows={1}
              />
              <button
                className="athena-send-btn"
                onClick={() => handleSendMessage(inputValue)}
                disabled={isLoading || !inputValue.trim()}
              >
                {isLoading ? '⏳' : 'Send ➤'}
              </button>
            </div>
          </div>
        </section>

        {/* Reasoning Panel */}
        <ReasoningPanel
          isOpen={showReasoning}
          onClose={() => setShowReasoning(false)}
          onClear={clearReasoning}
          events={events}
          currentRunId={currentRunId}
          isLoading={isLoading}
          routingReasoning={routingReasoning}
          agentsNeeded={agentsNeeded}
        />
      </main>
    </div>
  );
}

export default VinushanPage;
