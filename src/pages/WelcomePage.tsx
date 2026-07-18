import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAppSettings } from '../utils/appSettings';
import { nowMs, parseZonedTime, formatDateTimeInZone } from '../utils/timeSource';
import { canInstallPwa, isStandalonePwa, promptInstallPwa } from '../services/pwa';
import Watermark from '../components/Watermark';
import type { ExamItem } from '../types';
import { sortExamItemsByTime } from '../utils/examSchedule';
import { APP_SETTINGS_CHANGED_EVENT, APP_SETTINGS_KEY } from '../utils/appSettings';
import '../styles/welcome.css';

const IDLE_MS = 10000;
const PWA_DISMISS_KEY = 'exam_board_pwa_install_dismissed_at';
function getNextExam(items: ExamItem[], now: number): { exam: ExamItem; phase: 'waiting' | 'ongoing' } | null {
  const active = sortExamItemsByTime(items.filter(x => x.enabled));
  for (const exam of active) { const start = parseZonedTime(exam.startTime); const end = parseZonedTime(exam.endTime); if (now < start) return { exam, phase: 'waiting' }; if (now <= end) return { exam, phase: 'ongoing' }; }
  return null;
}
const pad2 = (n: number) => String(n).padStart(2, '0');
function fmtRemain(ms: number): string { const total = Math.max(0, Math.floor(ms / 1000)); const d = Math.floor(total / 86400); const h = Math.floor((total % 86400) / 3600); const m = Math.floor((total % 3600) / 60); const s = total % 60; return d > 0 ? `${d} 天 ${pad2(h)}:${pad2(m)}:${pad2(s)}` : `${pad2(h)}:${pad2(m)}:${pad2(s)}`; }

export default function WelcomePage() {
  const navigate = useNavigate();
  const [now, setNow] = useState(() => nowMs());
  const [nextExam, setNextExam] = useState<ReturnType<typeof getNextExam>>(() => getNextExam(getAppSettings().exam.items ?? [], nowMs()));
  const [idleLeft, setIdleLeft] = useState(10);
  const [pwaAvailable, setPwaAvailable] = useState(false);
  const deadline = useRef(Date.now() + IDLE_MS);
  const resetIdle = () => { deadline.current = Date.now() + IDLE_MS; setIdleLeft(10); };

  useEffect(() => { const update = () => { const t = nowMs(); setNow(t); setNextExam(getNextExam(getAppSettings().exam.items ?? [], t)); }; const onStorage = (event: StorageEvent) => { if (event.key === APP_SETTINGS_KEY) update(); }; update(); const id = window.setInterval(update, 1000); window.addEventListener(APP_SETTINGS_CHANGED_EVENT, update); window.addEventListener('storage', onStorage); window.addEventListener('focus', update); window.addEventListener('pageshow', update); return () => { clearInterval(id); window.removeEventListener(APP_SETTINGS_CHANGED_EVENT, update); window.removeEventListener('storage', onStorage); window.removeEventListener('focus', update); window.removeEventListener('pageshow', update); }; }, []);
  useEffect(() => { const tick = () => { const left = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)); setIdleLeft(left); if (left <= 0) navigate('/exam'); }; const events: Array<keyof WindowEventMap> = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel', 'click']; events.forEach(e => window.addEventListener(e, resetIdle, { passive: true })); tick(); const id = window.setInterval(tick, 250); return () => { clearInterval(id); events.forEach(e => window.removeEventListener(e, resetIdle)); }; }, [navigate]);
  useEffect(() => { const refresh = () => { const dismissed = Number(localStorage.getItem(PWA_DISMISS_KEY) ?? 0); setPwaAvailable(!nextExam && !isStandalonePwa() && canInstallPwa() && Date.now() - dismissed > 7 * 86400000); }; refresh(); window.addEventListener('pwa:available', refresh); return () => window.removeEventListener('pwa:available', refresh); }, [nextExam]);
  const install = async () => { resetIdle(); const installed = await promptInstallPwa(); if (installed) setPwaAvailable(false); };
  const dismissPwa = () => { localStorage.setItem(PWA_DISMISS_KEY, String(Date.now())); setPwaAvailable(false); resetIdle(); };
  const ongoing = nextExam?.phase === 'ongoing'; const startMs = nextExam ? parseZonedTime(nextExam.exam.startTime) : NaN; const endMs = nextExam ? parseZonedTime(nextExam.exam.endTime) : NaN; const countdownMs = nextExam ? (ongoing ? endMs - now : startMs - now) : 0;
  return <div className="welcome-page"><div className="welcome-header"><h1 className="welcome-title">沉浸式时钟</h1><p className="welcome-subtitle">Immersive Clock &amp; Exam Board</p></div>
    {nextExam && <div className="welcome-exam-banner" style={{ borderColor: ongoing ? 'rgba(46,204,113,0.5)' : 'rgba(52,152,219,0.4)', background: ongoing ? 'rgba(46,204,113,0.08)' : 'rgba(52,152,219,0.08)' }}><span className="welcome-exam-banner__icon">{ongoing ? '🟢' : '📌'}</span><div className="welcome-exam-banner__info"><strong>{nextExam.exam.name}</strong><span className="welcome-exam-banner__count" style={{ color: ongoing ? '#5df2a0' : '#7ec8ff' }}>{ongoing ? '考试进行中 · 距结束还有 ' : '距考试开始还有 '}{fmtRemain(countdownMs)}</span></div><div className="welcome-exam-banner__time"><span>{formatDateTimeInZone(startMs)}</span><span>{formatDateTimeInZone(endMs)}</span></div></div>}
    <div className={`welcome-grid${nextExam ? ' welcome-grid--has-exam' : ''}`}><button className={`welcome-card${nextExam ? ' welcome-card--featured' : ''}`} onClick={() => navigate('/exam')}><span className="welcome-card__icon">📊</span><span className="welcome-card__text"><span className="welcome-card__label">考试大屏</span><span className="welcome-card__desc">全屏倒计时显示</span></span></button><button className="welcome-card" onClick={() => navigate('/admin')}><span className="welcome-card__icon">⚙️</span><span className="welcome-card__text"><span className="welcome-card__label">管理后台</span><span className="welcome-card__desc">配置考试安排</span></span></button></div>
    {pwaAvailable && <div className="welcome-pwa"><span>📲 可添加到设备桌面，便于离线使用</span><button onClick={install}>添加</button><button className="welcome-pwa__dismiss" onClick={dismissPwa}>暂不</button></div>}
    <p className="welcome-idle-hint"><b>{idleLeft}</b> 秒后自动进入考试大屏</p><Watermark /></div>;
}
