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
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const [currentReasoning, setCurrentReasoning] = useState({
    routingReasoning: null,
    agentsUsed: [],
    agentSteps: [],
    statusMessage: null,
    activeAgents: [],
    completedAgents: [],
  });
  const [inputValue, setInputValue] = useState('');
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
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
    setCurrentReasoning({
      routingReasoning: null,
      agentsUsed: [],
      agentSteps: [],
      statusMessage: 'Starting analysis...',
      activeAgents: [],
      completedAgents: [],
    });

    try {
      const history = [...messages, userMessage].map(({ role, content: text, timestamp }) => ({
        role,
        content: text,
        timestamp,
      }));

      // Use streaming API with real-time callbacks
      await streamVinushanChat(content, history, {
        onStatus: (data) => {
          setCurrentReasoning(prev => ({
            ...prev,
            statusMessage: data.message,
          }));
        },
        
        onRouting: (data) => {
          setCurrentReasoning(prev => ({
            ...prev,
            routingReasoning: data.reasoning,
            agentsUsed: data.agents_needed || [],
            statusMessage: `Routing to ${data.agents_needed?.length || 0} specialized agents...`,
          }));
        },
        
        onAgentStart: (data) => {
          setCurrentReasoning(prev => ({
            ...prev,
            activeAgents: [...prev.activeAgents, {
              name: data.agent_name,
              task: data.task_name,
              description: data.description,
              startTime: Date.now(),
            }],
            statusMessage: `${data.agent_name} is analyzing...`,
          }));
        },
        
        onAgentComplete: (data) => {
          setCurrentReasoning(prev => {
            // Move from active to completed
            const activeAgents = prev.activeAgents.filter(
              a => a.name !== data.agent_name
            );
            
            const completedAgent = {
              name: data.agent_name,
              task: data.task_name,
              summary: data.summary,
              output_preview: data.output_preview,
              step_number: data.step_number,
              total_steps: data.total_steps,
            };
            
            return {
              ...prev,
              activeAgents,
              completedAgents: [...prev.completedAgents, completedAgent],
              agentSteps: [...prev.agentSteps, {
                agent_name: data.agent_name,
                task_name: data.task_name,
                summary: data.summary,
                output_preview: data.output_preview,
              }],
              statusMessage: data.total_steps 
                ? `Completed step ${data.step_number} of ${data.total_steps}`
                : `${data.agent_name} completed`,
            };
          });
        },
        
        onFinalResponse: (data) => {
          setCurrentReasoning(prev => ({
            ...prev,
            statusMessage: null,
            activeAgents: [],
            routingReasoning: data.routing_reasoning || prev.routingReasoning,
            agentsUsed: data.agents_used || prev.agentsUsed,
            agentSteps: data.reasoning_steps?.length > 0 ? data.reasoning_steps : prev.agentSteps,
          }));

          const assistantMessage = {
            role: 'assistant',
            content: data.response,
            timestamp: new Date().toISOString(),
            charts: data.charts,
          };

          setMessages(prev => [...prev, assistantMessage]);
          setIsLoading(false);
        },
        
        onError: (data) => {
          setError(data.message || 'An error occurred');
          setCurrentReasoning(prev => ({
            ...prev,
            statusMessage: `Error: ${data.message}`,
          }));
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
    <div className={`athena-container ${isDarkMode ? 'athena-dark' : ''}`}>
      {/* Header */}
      <header className="athena-header">
        <div className="athena-logo">
          <h1 className="athena-title">ATHENA</h1>
          <p className="athena-subtitle">A Context-Aware Forecasting and Decision Support System</p>
        </div>
        <div className="athena-controls">
          <button 
            className="theme-toggle" 
            onClick={toggleDarkMode}
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
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
                <div className="athena-welcome-icon">🤖</div>
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
              <div className="athena-loading">
                <div className="loading-avatar">🤖</div>
                <div className="loading-content">
                  <div className="loading-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <p className="loading-text">{currentReasoning.statusMessage || 'Analyzing your question...'}</p>
                </div>
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
          routingReasoning={currentReasoning.routingReasoning}
          agentsUsed={currentReasoning.agentsUsed}
          agentSteps={currentReasoning.agentSteps}
          activeAgents={currentReasoning.activeAgents}
          statusMessage={currentReasoning.statusMessage}
          isLoading={isLoading}
        />
      </main>
    </div>
  );
}

export default VinushanPage;
