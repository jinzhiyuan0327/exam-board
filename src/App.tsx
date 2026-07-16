import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import WelcomePage from './pages/WelcomePage';
import ExamPage from './pages/ExamPage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import SettingsPage from './pages/SettingsPage';
import ConsentGate from './components/ConsentGate';

export default function App() {
  return (
    <BrowserRouter>
      <ConsentGate>
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/exam" element={<ExamPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </ConsentGate>
      <Analytics />
      <SpeedInsights />
    </BrowserRouter>
  );
}
