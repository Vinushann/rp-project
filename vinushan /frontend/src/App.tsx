/**
 * Main App component - Chat interface.
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

function App() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    // Clear any previous error
    setError(null);

    // Add user message to chat
    const userMessage: DisplayMessage = {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Prepare conversation history (without metadata)
      const history: Message[] = messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      }));

      // Send to backend
      const response = await sendChatMessage(content, history);

      // Add assistant message to chat
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
      
      // Add error message
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

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <h1>☕ Coffee Shop AI Assistant</h1>
          <p>Ask me anything about your business</p>
        </div>
      </header>

      {/* Chat container */}
      <main className="chat-container">
        {/* Welcome message when empty */}
        {messages.length === 0 && (
          <div className="welcome-section">
            <div className="welcome-icon">🤖</div>
            <h2>Welcome, Manager!</h2>
            <p>I'm your AI assistant for Rossmann Coffee Shop. I can help you with:</p>
            <ul className="capabilities-list">
              <li>📜 Historical sales analysis</li>
              <li>📈 Demand forecasting</li>
              <li>🎉 Holiday impact analysis</li>
              <li>🌦️ Weather effects on sales</li>
              <li>📊 Charts & visualizations</li>
              <li>🧠 Strategic recommendations</li>
            </ul>
            
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

        {/* Messages */}
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
          
          {/* Loading indicator */}
          {isLoading && (
            <div className="loading-message">
              <div className="loading-avatar">🤖</div>
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
      </main>

      {/* Error banner */}
      {error && (
        <div className="error-banner">
          ⚠️ {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Input section */}
      <footer className="input-section">
        <ChatInput
          onSend={handleSendMessage}
          disabled={isLoading}
          placeholder={isLoading ? "Thinking..." : "Ask anything about your coffee shop..."}
        />
      </footer>
    </div>
  );
}

export default App;
