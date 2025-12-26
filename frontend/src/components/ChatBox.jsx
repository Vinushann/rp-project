import { useState } from 'react';
import { sendChatMessage } from '../lib/api';

/**
 * ChatBox Component
 * =================
 * A reusable chat interface component.
 * Each module can customize the styling through props.
 * 
 * @param {string} moduleName - The module to send messages to
 * @param {string} accentColor - Tailwind color class for accent (e.g., "blue", "green")
 */
function ChatBox({ moduleName, accentColor = "primary" }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    
    // Add user message to chat
    setMessages(prev => [...prev, { type: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const response = await sendChatMessage(moduleName, sessionId, userMessage);
      // Add bot response to chat
      setMessages(prev => [...prev, { type: 'bot', text: response.reply }]);
    } catch (error) {
      setMessages(prev => [...prev, { type: 'error', text: `Error: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="card flex flex-col h-[500px]">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">Chat</h3>
      
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 p-3 bg-gray-50 rounded-lg">
        {messages.length === 0 && (
          <p className="text-gray-400 text-center py-8">
            Send a message to start chatting with the {moduleName} module
          </p>
        )}
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                msg.type === 'user'
                  ? 'bg-primary-600 text-white rounded-br-md'
                  : msg.type === 'error'
                  ? 'bg-red-100 text-red-700 rounded-bl-md'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 px-4 py-2 rounded-2xl rounded-bl-md">
              <span className="flex items-center gap-1">
                <span className="animate-bounce">●</span>
                <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>●</span>
                <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>●</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          className="input-field flex-1"
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default ChatBox;
