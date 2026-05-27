
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Silence benign sandbox WebSocket environment disconnect errors
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  if (reason) {
    const msg = typeof reason === 'string' ? reason : (reason.message || '');
    if (msg.includes('WebSocket') || msg.includes('websocket')) {
      event.preventDefault();
      console.debug("Muted sandbox environment WebSocket disconnect rejection");
    }
  }
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
