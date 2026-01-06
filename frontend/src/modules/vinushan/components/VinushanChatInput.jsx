import { useState } from 'react';
import '../styles/ChatInput.css';

function VinushanChatInput({ onSend, disabled = false, placeholder = "Ask anything about your coffee shop..." }) {
  const [input, setInput] = useState('');

  const handleSend = () => {
    const trimmed = input.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setInput('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-input-container">
      <textarea
        className="chat-input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
      />
      <button 
        className="send-button" 
        onClick={handleSend}
        disabled={disabled || !input.trim()}
      >
        {disabled ? (
          <span className="loading-spinner">⏳</span>
        ) : (
          <span>Send ➤</span>
        )}
      </button>
    </div>
  );
}

export default VinushanChatInput;
