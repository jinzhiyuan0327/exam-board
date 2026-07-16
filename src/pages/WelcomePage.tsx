import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAppSettings } from '../utils/appSettings';
import { nowMs, parseZonedTime, formatDateTimeInZone } from '../utils/timeSource';
import Watermark from '../components/Watermark';
import type { ExamItem } from '../types';
import '../styles/welcome.css';

// 无操作自动进入考试大屏的空闲阈值
const IDLE_MS = 20000;

function getNextExam(items: ExamItem[], now: number): { exam: ExamItem; phase: 'waiting' | 'ongoing' } | null {
  const active = items.filter(x => x.enabled).sort((a, b) => a.order - b.order || a.startTime.localeCompare(b.startTime));
  for (const exam of active) {
    const start = parseZonedTime(exam.startTime);
    const end = parseZonedTime(exam.endTime);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (now < start) return { exam, phase: 'waiting' };
    if (now <= end) return { exam, phase: 'ongoing' };
  }
  return null;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

// 将剩余毫秒格式化为倒计时文本（超过一天时显示天数）
function fmtRemain(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d} 天 ${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

export default function WelcomePage() {
  const navigate = useNavigate();
  const [now, setNow] = useState<number>(() => nowMs());
  const [nextExam, setNextExam] = useState<ReturnType<typeof getNextExam>>(() => {
    const { exam } = getAppSettings();
    const items: ExamItem[] = Array.isArray(exam?.items) ? exam.items : [];
    return getNextExam(items, nowMs());
  });

  // 每秒刷新：驱动倒计时显示与阶段判定
  useEffect(() => {
    const update = () => {
      const t = nowMs();
      setNow(t);
      const { exam } = getAppSettings();
      const items: ExamItem[] = Array.isArray(exam?.items) ? exam.items : [];
      setNextExam(getNextExam(items, t));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  // 无操作 20 秒自动进入考试大屏；任何交互重置计时
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const reset = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => navigate('/exam'), IDLE_MS);
    };
    const events: Array<keyof WindowEventMap> = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel', 'click'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      if (timer) clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [navigate]);

  const ongoing = nextExam?.phase === 'ongoing';
  const startMs = nextExam ? parseZonedTime(nextExam.exam.startTime) : NaN;
  const endMs = nextExam ? parseZonedTime(nextExam.exam.endTime) : NaN;
  const countdownMs = nextExam ? (ongoing ? endMs - now : startMs - now) : 0;

  return (
    <div className="welcome-page">
      <div className="welcome-header">
        <h1 className="welcome-title">沉浸式时钟</h1>
        <p className="welcome-subtitle">Immersive Clock &amp; Exam Board</p>
      </div>

      {nextExam && (
        <div className="welcome-exam-banner" style={{
          borderColor: ongoing ? 'rgba(46,204,113,0.5)' : 'rgba(52,152,219,0.4)',
          background: ongoing ? 'rgba(46,204,113,0.08)' : 'rgba(52,152,219,0.08)',
        }}>
          <span className="welcome-exam-banner__icon">{ongoing ? '🟢' : '📌'}</span>
          <div className="welcome-exam-banner__info">
            <strong>{nextExam.exam.name}</strong>
            <span className="welcome-exam-banner__count" style={{ color: ongoing ? '#5df2a0' : '#7ec8ff' }}>
              {ongoing ? '考试进行中 · 距结束还有 ' : '距考试开始还有 '}{fmtRemain(countdownMs)}
            </span>
          </div>
          <div className="welcome-exam-banner__time">
            <span>{formatDateTimeInZone(startMs)}</span>
            <span>{formatDateTimeInZone(endMs)}</span>
          </div>
        </div>
      )}

      <div className={`welcome-grid${nextExam ? ' welcome-grid--has-exam' : ''}`}>
        {nextExam ? (
          <button className="welcome-card welcome-card--featured" onClick={() => navigate('/exam')}>
            <span className="welcome-card__icon">📊</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
              <span className="welcome-card__label">考试大屏</span>
              <span className="welcome-card__desc">全屏倒计时显示</span>
              <span className="welcome-card__badge" style={{ background: ongoing ? '#27ae60' : '#3498db' }}>
                {ongoing ? '进行中' : '即将开考'}
              </span>
            </div>
          </button>
        ) : (
          <button className="welcome-card" onClick={() => navigate('/exam')}>
            <span className="welcome-card__icon">📊</span>
            <span className="welcome-card__label">考试大屏</span>
            <span className="welcome-card__desc">全屏倒计时</span>
          </button>
        )}
        <button className="welcome-card" onClick={() => navigate('/admin')}>
          <span className="welcome-card__icon">⚙️</span>
          <span className="welcome-card__label">管理后台</span>
          <span className="welcome-card__desc">配置考试安排</span>
        </button>
      </div>

      <p className="welcome-idle-hint">20 秒无操作将自动进入考试大屏</p>
      <Watermark />
    </div>
  );
}
