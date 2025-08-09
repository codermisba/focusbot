import React from "react";
import ReactMarkdown from "react-markdown";

export default function ChatWindow({ messages, isTyping }) {
  return (
    <div className="chat-container">
      {/* <div className="chat-header">📚 FocusBot</div> */}
      <div className="chat-main">
        <div className="chat-window">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.sender}`}>
              <ReactMarkdown>{msg.text}</ReactMarkdown>
            </div>
          ))}
          {isTyping && <div className="message bot typing">Typing…</div>}
        </div>
      </div>
    </div>
  );
}
