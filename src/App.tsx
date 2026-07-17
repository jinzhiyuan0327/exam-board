import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import WelcomePage from './pages/WelcomePage';
import ExamPage from './pages/ExamPage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import SettingsPage from './pages/SettingsPage';
import ConsentGate from './components/ConsentGate';

// 仅在考试大屏锁定页面滚动（大屏为 position:fixed 全屏，不应整页滚动）；
// 非大屏页面（欢迎/登录/后台/设置）恢复文档自然滚动，修复移动端设置页无法下滑。
function BodyScrollLock() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.body.classList.toggle('lock-scroll', pathname === '/exam');
    return () => {
      document.body.classList.remove('lock-scroll');
    };
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <BodyScrollLock />
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