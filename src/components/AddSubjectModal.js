import React, { useState } from "react";
import "./AddSubjectModal.css";

export default function AddSubjectModal({ onAdd, onClose }) {
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleAdd = async () => {
    const name = input.trim();
    if (!name) {
      setError("Subject name is required");
      return;
    }
    setSubmitting(true);
    setError("");
    const res = await onAdd(name);
    if (!res?.ok) {
      setError(res?.error || "Failed to add subject. Please try again.");
    }
    setSubmitting(false);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h2>Add New Subject</h2>
        {error && <div className="modal-error" role="alert">{error}</div>}
        <input
          type="text"
          placeholder="Enter subject name"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <div className="modal-buttons">
          <button className="btn" onClick={handleAdd} disabled={submitting}>{submitting ? "Adding..." : "Add"}</button>
          <button className="btn cancel-btn" onClick={onClose} disabled={submitting}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
