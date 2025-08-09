import React from 'react';

function WelcomeScreen() {
  return (
    <div className="welcome-screen-chatgpt">
      {/* <div className="welcome-icon-chatgpt" role="img" aria-label="Robot">🤖</div> */}
      <h1 className="welcome-title-chatgpt">Welcome to FocusBot!</h1>
      <p className="welcome-subtext-chatgpt">Select a subject and ask me anything.<br/>I’m here to help you focus and learn.</p>
    </div>
  );
}

export default WelcomeScreen;
