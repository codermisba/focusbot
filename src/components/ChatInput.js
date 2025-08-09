import React from 'react';

export default function ChatInput({ currentMessage, setCurrentMessage, onSendMessage, isTyping }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  return (
    <div className="chat-input">
      <textarea
        rows="1"
        placeholder="Ask a question..."
        value={currentMessage}
        onChange={(e) => setCurrentMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isTyping}
      />
      <button
        onClick={onSendMessage}
        disabled={isTyping || currentMessage.trim() === ''}
      >
        Send
      </button>
    </div>
  );
}