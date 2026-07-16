import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { startTimeSyncManager } from './utils/timeSync';

// Global styles
const style = document.createElement('style');
style.textContent = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body, #root { margin: 0; padding: 0; width: 100%; height: 100%; }
  body { background: #0d0d0d; color: #f0f0f0; }
  button { font-family: inherit; }
  input, textarea, select { font-family: inherit; }
`;
document.head.appendChild(style);

startTimeSyncManager();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
