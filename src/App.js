import React, { useState, useEffect, useCallback } from "react";
import "./App.css";
import Sidebar from "./components/Sidebar";
import WelcomeScreen from "./components/WelcomeScreen";
import ChatWindow from "./components/ChatWindow";
import ChatInput from "./components/ChatInput";
import LoginModal from "./components/LoginModal";
import AddSubjectModal from "./components/AddSubjectModal";

function App() {
  const [subjects, setSubjects] = useState([
    "Math", "History", "Science", "Literature",
  ]);
  const [selectedSubject, setSelectedSubject] = useState(subjects[0]);
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [user, setUser] = useState(null);
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [conversationStarted, setConversationStarted] = useState(false);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('focusbot_theme');
    if (saved) return saved;
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  });

  useEffect(() => {
    document.body.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('focusbot_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  useEffect(() => {
    const token = localStorage.getItem("focusbot_token");
    const email = localStorage.getItem("focusbot_email");
    if (token && email) setUser({ email });
  }, []);

  const handleSendMessage = async () => {
    if (currentMessage.trim() === "") return;

    const newUserMessage = { sender: "user", text: currentMessage.trim() };
    setMessages((prev) => [...prev, newUserMessage]);
    setCurrentMessage("");
    setIsTyping(true);

    try {
      const response = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(user?.email && {
            Authorization: `Bearer ${localStorage.getItem("focusbot_token")}`,
          }),
        },
        body: JSON.stringify({
          message: newUserMessage.text,
          subject: selectedSubject,
          user: user?.email || "guest",
          conversation_started: conversationStarted,
        }),
      });

      const data = await response.json();
      const botResponse = { sender: "bot", text: data.reply || data.error };
      setMessages((prev) => [...prev, botResponse]);
      setConversationStarted(true);
    } catch {
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "⚠️ Server error. Try again later." },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("focusbot_token");
    localStorage.removeItem("focusbot_email");
    setUser(null);
    setChatHistory([]);
    setMessages([]);
    setConversationStarted(false);
  };

  // 👇 Fix: wrap fetchHistory in useCallback so its ref stays stable
  const fetchHistory = useCallback(async () => {
    if (!user) return;

    const response = await fetch(
      `http://localhost:8000/api/history?user=${user.email}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("focusbot_token")}`,
        },
      }
    );
    const data = await response.json();

    const sortedHistory = (data.history || []).sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );

    setChatHistory(sortedHistory);
  }, [user]);

  useEffect(() => {
    if (user) fetchHistory();
  }, [user, fetchHistory]);

  const fetchSubjects = useCallback(async () => {
    try {
      const email = user?.email || "guest";
      const token = localStorage.getItem("focusbot_token");
      const response = await fetch(
        `http://localhost:8000/api/subjects?user=${encodeURIComponent(email)}`,
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      const data = await response.json();
      setSubjects(data.subjects || ["Math", "History", "Science", "Literature"]);
    } catch (error) {
      console.error("Failed to fetch subjects:", error);
    }
  }, [user]);

  useEffect(() => {
    fetchSubjects();
  }, [user, fetchSubjects]);

  const handleOpenAddSubject = () => {
    setShowAddSubjectModal(true);
  };

  const addSubject = async (subjectName) => {
    const name = subjectName?.trim();
    if (!name) return { ok: false, error: "Subject name is required" };
    try {
      const token = localStorage.getItem("focusbot_token");
      const response = await fetch("http://localhost:8000/api/subjects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          subject: name,
          user: user?.email || "guest",
        }),
      });
      if (response.ok) {
        await fetchSubjects();
        setSelectedSubject(name);
        setConversationStarted(false); // Reset conversation for new subject
        return { ok: true };
      }
      const err = await response.json().catch(() => ({}));
      return { ok: false, error: err.detail || "Failed to add subject. Please try again." };
    } catch (e) {
      return { ok: false, error: "Failed to add subject. Please try again." };
    }
  };

  const handleDeleteSubject = async (subjectToDelete) => {
    try {
      const response = await fetch(
        `http://localhost:8000/api/subjects/${encodeURIComponent(subjectToDelete)}?user=${user?.email || "guest"}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("focusbot_token")}`,
          },
        }
      );
      
      if (response.ok) {
        await fetchSubjects(); // Refresh subjects list
        if (selectedSubject === subjectToDelete) {
          setSelectedSubject(subjects[0]); // Select first available subject
        }
      } else {
        const error = await response.json().catch(() => ({}));
        console.error(error.detail || "Failed to delete subject");
      }
    } catch (error) {
      console.error("Failed to delete subject. Please try again.");
    }
  };

  const handleSelectHistory = (historyItem) => {
    setMessages(
      historyItem.conversation || [
        { sender: "user", text: historyItem.message },
        { sender: "bot", text: historyItem.reply || "" },
      ]
    );
    setSelectedSubject(historyItem.subject);
    setConversationStarted(true);
  };

  const handleDeleteHistory = async (chatId) => {
    try {
      const token = localStorage.getItem("focusbot_token");
      const response = await fetch(
        `http://localhost:8000/api/history/${chatId}?user=${user?.email || "guest"}`,
        {
          method: "DELETE",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      
      if (response.ok) {
        await fetchHistory(); // Refresh history
      } else {
        console.error("Failed to delete chat");
      }
    } catch (error) {
      console.error("Failed to delete chat. Please try again.");
    }
  };

  return (
    <div className="chat-app">
      <Sidebar
        subjects={subjects}
        selectedSubject={selectedSubject}
        setSelectedSubject={(subject) => {
          setSelectedSubject(subject);
          setConversationStarted(false); // Reset conversation when switching subjects
        }}
        onAddSubject={handleOpenAddSubject}
        onDeleteSubject={handleDeleteSubject}
        chatHistory={chatHistory}
        onSelectHistory={handleSelectHistory}
        onDeleteHistory={handleDeleteHistory}
        user={user}
        theme={theme}
        toggleTheme={toggleTheme}
        onLogin={() => setShowLoginModal(true)}
        onLogout={handleLogout}
      />
      <div className="main-body">
        <div className="chat-container">
          <main className="chat-main">
            {messages.length === 0 ? (
              <WelcomeScreen />
            ) : (
              <ChatWindow messages={messages} isTyping={isTyping} />
            )}
          </main>
          <ChatInput
            currentMessage={currentMessage}
            setCurrentMessage={setCurrentMessage}
            onSendMessage={handleSendMessage}
            isTyping={isTyping}
          />
        </div>
      </div>
      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          setUser={setUser}
        />
      )}
      {showAddSubjectModal && (
        <AddSubjectModal
          onAdd={async (name) => {
            const res = await addSubject(name);
            if (res.ok) {
              setShowAddSubjectModal(false);
            }
            return res;
          }}
          onClose={() => setShowAddSubjectModal(false)}
        />
      )}
    </div>
  );
}

export default App;
