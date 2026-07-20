import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/fonts.css';
import './styles/design-fonts.css';
import { startTimeSyncManager } from './utils/timeSync';
import { registerPwa } from './services/pwa';
import { bindTypographySettings } from './utils/typographySettings';
import { reportPerformance } from './services/telemetry';
import { SpeedInsights } from '@vercel/speed-insights/react';

// Global styles
const style = document.createElement('style');
style.textContent = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body, #root { margin: 0; padding: 0; width: 100%; height: 100%; }
  body { background: #0d0d0d; color: #f0f0f0; font-family: var(--font-region-content); }
  body.lock-scroll { overflow: hidden; }
  button { font-family: inherit; }
  input, textarea, select { font-family: inherit; }
`;
document.head.appendChild(style);

startTimeSyncManager();
bindTypographySettings();
registerPwa();
window.addEventListener('load', () => window.setTimeout(() => { void reportPerformance(); }, 0), { once: true });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <SpeedInsights />
  </React.StrictMode>
);
