import React, { useState, useRef, useEffect } from "react";
import "./Sidebar.css";

const subjectIcons = {
  Math: "🧮",
  History: "📜",
  Science: "🔬",
  Literature: "📚",
};

const defaultSubjects = ["Math", "History", "Science", "Literature"];

const SunIcon = () => (
  <svg width="10" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="10" cy="10" r="4.5" stroke="currentColor" strokeWidth="1.5"/><path d="M10 2v1.5M10 16.5V18M18 10h-1.5M3.5 10H2M15.657 4.343l-1.06 1.06M5.404 14.596l-1.06 1.06M15.657 15.657l-1.06-1.06M5.404 5.404l-1.06-1.06" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
);
const MoonIcon = () => (
  <svg width="10" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M16.5 13.5A7 7 0 016.5 3.5a7 7 0 1010 10z" stroke="currentColor" strokeWidth="1.5"/></svg>
);

export default function Sidebar({
  subjects,
  selectedSubject,
  setSelectedSubject,
  onAddSubject,
  onDeleteSubject,
  chatHistory,
  onSelectHistory,
  onDeleteHistory,
  user,
  theme,
  toggleTheme,
  onLogin,
  onLogout,
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const profileRef = useRef();

  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDropdown]);

  return (
    <nav className={`sidebar-chatgpt sidebar-theme-${theme}`} aria-label="Sidebar">
      <div className="sidebar-header-chatgpt">
        <div className="logo-chatgpt">
           FocusBot</div>
        <div className="sidebar-header-actions">
          <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          {!user ? (
            <button className="login-btn" onClick={onLogin}>Login</button>
          ) : (
            <div className="profile-container" ref={profileRef}>
              <button
                className="profile-circle"
                tabIndex={0}
                aria-label="User menu"
                onClick={() => setShowDropdown((v) => !v)}
                aria-haspopup="true"
                aria-expanded={showDropdown}
              >
                <span className="profile-initial">{user.email.charAt(0).toUpperCase()}</span>
              </button>
              {showDropdown && (
                <div className={`profile-dropdown profile-dropdown-${theme}`} role="menu">
                  <p className="profile-email">{user.email}</p>
                  <button className="logout-btn" onClick={onLogout} role="menuitem">Logout</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="sidebar-scrollable">
        <section className="sidebar-section subjects-section">
          <h3 className={`sidebar-section-title sidebar-section-title-${theme}`}>Subjects</h3>
          <div className="subject-list">
            {subjects.map((subject) => {
              const isDefault = defaultSubjects.includes(subject);
              return (
                <div key={subject} className="subject-pill-container">
              <button
                className={`subject-pill-chatgpt${subject === selectedSubject ? " active" : ""} subject-pill-chatgpt-${theme}`}
                onClick={() => setSelectedSubject(subject)}
                aria-pressed={subject === selectedSubject}
              >
                <span className={`subject-icon-chatgpt subject-icon-chatgpt-${theme}`} aria-hidden="true">
                  {subjectIcons[subject] || "📖"}
                </span>
                <span className={`subject-label-chatgpt subject-label-chatgpt-${theme}`}>{subject}</span>
              </button>
                  {!isDefault && onDeleteSubject && (
                    <button
                      className="subject-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSubject(subject);
                      }}
                      aria-label={`Delete ${subject}`}
                      title={`Delete ${subject}`}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <button className={`add-subject-btn-chatgpt add-subject-btn-chatgpt-${theme}`} onClick={onAddSubject} aria-label="Add Subject">
            <span aria-hidden="true">＋</span> Add Subject
          </button>
        </section>
        <section className="sidebar-section history-section">
          <div className="history-header">
            <h3 className={`sidebar-section-title sidebar-section-title-${theme}`}>Recent History</h3>
          </div>
          <div className="history-list">
            {(() => {
              // Group chat history by subject and get the most recent for each
              const groupedHistory = {};
              chatHistory.forEach(item => {
                if (!groupedHistory[item.subject] || 
                    new Date(item.timestamp) > new Date(groupedHistory[item.subject].timestamp)) {
                  groupedHistory[item.subject] = item;
                }
              });

              // Show history for each subject (default subjects first, then custom)
              const subjectsWithHistory = subjects.filter(subject => groupedHistory[subject]);
              const subjectsWithoutHistory = subjects.filter(subject => !groupedHistory[subject]);

              if (subjectsWithHistory.length === 0) {
                return <p className={`history-empty-chatgpt history-empty-chatgpt-${theme}`}>No chats yet.</p>;
              }

              return [...subjectsWithHistory, ...subjectsWithoutHistory].map((subject) => {
                const item = groupedHistory[subject];
                if (!item) {
                  return (
                    <div key={subject} className="history-item-container">
                      <button
                        className={`history-item-chatgpt history-item-chatgpt-${theme} history-item-empty`}
                        onClick={() => setSelectedSubject(subject)}
                        aria-label={`Start ${subject} chat`}
                      >
                        <span className={`history-icon-chatgpt history-icon-chatgpt-${theme}`} aria-hidden="true">
                          {subjectIcons[subject] || "📖"}
                        </span>
                        <div className="history-content">
                          <div className="history-subject">
                            <strong>{subject}</strong>
                            <span className="history-time">No chats yet</span>
                          </div>
                          <div className="history-message">Click to start chatting</div>
                        </div>
                      </button>
                    </div>
                  );
                }

                return (
                  <div key={subject} className="history-item-container">
              <button
                className={`history-item-chatgpt history-item-chatgpt-${theme}`}
                onClick={() => onSelectHistory(item)}
                aria-label={`History: ${item.subject}`}
              >
                      <span className={`history-icon-chatgpt history-icon-chatgpt-${theme}`} aria-hidden="true">
                        {subjectIcons[subject] || "📖"}
                      </span>
                      <div className="history-content">
                        <div className="history-subject">
                          <strong>{item.subject}</strong>
                          <span className="history-time">{item.formatted_time || new Date(item.timestamp).toLocaleString()}</span>
                        </div>
                        <div className="history-message">{item.message.slice(0, 30)}...</div>
                      </div>
                    </button>
                    {onDeleteHistory && (
                      <button
                        className="history-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteHistory(item.id);
                        }}
                        aria-label={`Delete ${item.subject} chat`}
                        title="Delete this chat"
                      >
                        ×
              </button>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </section>
      </div>
    </nav>
  );
}
