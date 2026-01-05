/**
 * Main App component - Chat interface with navigation.
 */

import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { sendChatMessage } from './services/api';
import { Message, AgentStep, ChartData } from './types';
import './App.css';

// Extended message type with metadata
interface DisplayMessage extends Message {
  agentSteps?: AgentStep[];
  routingReasoning?: string;
  agentsUsed?: string[];
  charts?: ChartData[];
}

// Example questions to show users
const exampleQuestions = [
  "What are the top selling items this month?",
  "Show me a chart of sales trends",
  "How does weather affect my sales?",
  "Visualize the daily sales pattern",
  "What holidays are coming up?",
];

type Page = 'athena' | 'stat' | 'settings';

function App() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>('athena');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    setError(null);

    const userMessage: DisplayMessage = {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const history: Message[] = messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      }));

      const response = await sendChatMessage(content, history);

      const assistantMessage: DisplayMessage = {
        role: 'assistant',
        content: response.response,
        timestamp: new Date().toISOString(),
        agentSteps: response.reasoning_steps,
        routingReasoning: response.routing_reasoning,
        agentsUsed: response.agents_used,
        charts: response.charts,
      };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (err) {
      console.error('Error sending message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
      
      const errorMessage: DisplayMessage = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExampleClick = (question: string) => {
    if (!isLoading) {
      handleSendMessage(question);
    }
  };

  const renderContent = () => {
    switch (currentPage) {
      case 'stat':
        return (
          <div className="page-content">
            <h2>Statistics</h2>
            <p>Statistics and analytics will be displayed here.</p>
          </div>
        );
      case 'settings':
        return (
          <div className="page-content">
            <h2>Settings</h2>
            <p>Settings and preferences will be displayed here.</p>
          </div>
        );
      default:
        return (
          <>
            {messages.length === 0 && (
              <div className="welcome-section">
                <h2>Welcome to Athena</h2>
                <p>Your AI assistant for sales forecasting and business analytics.</p>
                
                <div className="capabilities-list">
                  <div className="capability-item">Historical sales analysis</div>
                  <div className="capability-item">Demand forecasting</div>
                  <div className="capability-item">Holiday impact analysis</div>
                  <div className="capability-item">Weather effects on sales</div>
                  <div className="capability-item">Charts and visualizations</div>
                  <div className="capability-item">Strategic recommendations</div>
                </div>
                
                <div className="example-questions">
                  <p className="examples-label">Try asking:</p>
                  <div className="examples-grid">
                    {exampleQuestions.map((q, idx) => (
                      <button 
                        key={idx}
                        className="example-button"
                        onClick={() => handleExampleClick(q)}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="messages-list">
              {messages.map((msg, idx) => (
                <ChatMessage
                  key={idx}
                  message={msg}
                  agentSteps={msg.agentSteps}
                  routingReasoning={msg.routingReasoning}
                  agentsUsed={msg.agentsUsed}
                  charts={msg.charts}
                />
              ))}
              
              {isLoading && (
                <div className="loading-message">
                  <div className="loading-avatar">A</div>
                  <div className="loading-content">
                    <div className="loading-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <p>Analyzing your question...</p>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </>
        );
    }
  };

  return (
    <div className="app">
      {/* Navigation Bar */}
      <nav className="navbar">
        <div className="nav-brand">Athena</div>
        <div className="nav-links">
          <button 
            className={`nav-link ${currentPage === 'athena' ? 'active' : ''}`}
            onClick={() => setCurrentPage('athena')}
          >
            Athena
          </button>
          <button 
            className={`nav-link ${currentPage === 'stat' ? 'active' : ''}`}
            onClick={() => setCurrentPage('stat')}
          >
            Stat
          </button>
          <button 
            className={`nav-link ${currentPage === 'settings' ? 'active' : ''}`}
            onClick={() => setCurrentPage('settings')}
          >
            Settings
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main className="main-content">
        {renderContent()}
      </main>

      {/* Error banner */}
      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError(null)}>x</button>
        </div>
      )}

      {/* Input section - only show on Athena page */}
      {currentPage === 'athena' && (
        <footer className="input-section">
          <ChatInput
            onSend={handleSendMessage}
            disabled={isLoading}
            placeholder={isLoading ? "Thinking..." : "Ask anything about your business..."}
          />
        </footer>
      )}
    </div>
  );
}

export default App;
