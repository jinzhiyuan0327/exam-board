import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ExamItem, AlertsSettings } from '../types';
import { getAppSettings } from '../utils/appSettings';
import {
  nowMs, formatClockInZone, getZonedParts, parseZonedTime, DISPLAY_TIME_ZONE, isTimeSyncReady,
} from '../utils/timeSource';
import { useExamNotify } from '../hooks/useExamNotify';
import { useExamSync } from '../hooks/useExamSync';
import { useAlertOverlay } from '../hooks/useAlertOverlay';
import ExamAlertOverlay from '../components/ExamAlertOverlay';
import { getDesign } from '../designs/registry';
import { getDesignId, setDesignId } from '../utils/designPref';
import DesignSwitcher from '../components/DesignSwitcher';
import type { ExamViewModel, ExamPhaseVM, Urgency } from '../designs/types';
import '../styles/exam.css';

interface RawState {
  currentExam: ExamItem | null;
  phase: ExamPhaseVM;
  remainingMs: number;
  elapsedMs: number;
  durationMs: number;
  startToNowMs: number; // 距开考倒计时（before）/ 距下一场（ended）
  nextExam: ExamItem | null;
}

const WEEKDAY_CN = ['日', '一', '二', '三', '四', '五', '六'];
const pad2 = (n: number) => String(n).padStart(2, '0');

function getActiveExams(items: ExamItem[]): ExamItem[] {
  return items
    .filter(x => x.enabled)
    .sort((a, b) => a.order - b.order || a.startTime.localeCompare(b.startTime));
}

function computeRawState(items: ExamItem[], nowTs: number): RawState {
  const active = getActiveExams(items);
  if (active.length === 0) {
    return { currentExam: null, phase: 'empty', remainingMs: 0, elapsedMs: 0, durationMs: 0, startToNowMs: 0, nextExam: null };
  }
  for (let i = 0; i < active.length; i++) {
    const exam = active[i];
    const start = parseZonedTime(exam.startTime);
    const end = parseZonedTime(exam.endTime);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (nowTs < start) {
      return { currentExam: exam, phase: 'before', remainingMs: 0, elapsedMs: 0, durationMs: end - start, startToNowMs: start - nowTs, nextExam: active[i + 1] ?? null };
    }
    if (nowTs >= start && nowTs <= end) {
      return { currentExam: exam, phase: 'live', remainingMs: end - nowTs, elapsedMs: nowTs - start, durationMs: end - start, startToNowMs: 0, nextExam: active[i + 1] ?? null };
    }
  }
  const last = active[active.length - 1];
  return { currentExam: last ?? null, phase: 'ended', remainingMs: 0, elapsedMs: 0, durationMs: 0, startToNowMs: 0, nextExam: null };
}

function fmtHMS(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function fmtHM(ms: number): string {
  if (!Number.isFinite(ms)) return '—';
  const p = getZonedParts(ms, DISPLAY_TIME_ZONE);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

function fmtDateText(ms: number): string {
  const p = getZonedParts(ms, DISPLAY_TIME_ZONE);
  return `北京时间 · 星期${WEEKDAY_CN[p.weekday]} · ${p.year}.${pad2(p.month)}.${pad2(p.day)}`;
}

function computeUrgency(phase: ExamPhaseVM, remainingMs: number): Urgency {
  if (phase !== 'live') return 'normal';
  if (remainingMs <= 5 * 60000) return 'critical';
  if (remainingMs <= 15 * 60000) return 'warn';
  return 'normal';
}

export default function ExamPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ExamItem[]>(() => getAppSettings().exam?.items ?? []);
  const [title, setTitle] = useState<string>(() => getAppSettings().exam?.title ?? '');
  const [now, setNow] = useState<number>(() => nowMs());
  const [designId, setDesign] = useState<string>(() => getDesignId());
  const [alerts, setAlerts] = useState<AlertsSettings>(() => getAppSettings().alerts);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 数据链接：保留 30s Neon 同步，所有设计共用同一份数据（含提醒管理配置）
  useExamSync({
    onUpdate: ({ items: newItems, title: newTitle, alerts: newAlerts }) => {
      setItems(newItems); if (newTitle) setTitle(newTitle);
      if (newAlerts) setAlerts(newAlerts);
    },
  });

  const tick = useCallback(() => setNow(nowMs()), []);
  useEffect(() => {
    tick();
    timerRef.current = setInterval(tick, 500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [tick]);

  // 将时间量化到整秒：大屏时钟与底部倒计时都基于同一 nowTick，
  // 确保两者在同一时刻跳变，消除偶发的 1 秒时差。
  const nowTick = Math.floor(now / 1000) * 1000;
  const raw = useMemo(() => computeRawState(items, nowTick), [items, nowTick]);
  const { notification, dismiss } = useExamNotify(raw.currentExam);

  // 全屏提醒浮层：将通知事件与自定义提醒映射为对应设计风格的浮层
  const overlayItem = useAlertOverlay({
    notification,
    currentExam: raw.currentExam,
    nextExam: raw.nextExam,
    settings: alerts,
    masterTitle: title,
  });
  // 浮层启用时，抑制设计内的轻量通知条，避免重复
  const inDesignNotification = alerts.enabled ? null : notification;

  const progressPct = raw.durationMs > 0
    ? Math.min(100, Math.max(0, (raw.elapsedMs / raw.durationMs) * 100))
    : (raw.phase === 'ended' ? 100 : 0);

  const vm: ExamViewModel = {
    masterTitle: title,
    phase: raw.phase,
    clock: formatClockInZone(nowTick),
    dateText: fmtDateText(nowTick),
    currentName: raw.currentExam?.name ?? null,
    startHM: raw.currentExam ? fmtHM(parseZonedTime(raw.currentExam.startTime)) : null,
    endHM: raw.currentExam ? fmtHM(parseZonedTime(raw.currentExam.endTime)) : null,
    progressPct,
    elapsedText: fmtHMS(raw.elapsedMs),
    remainingText: fmtHMS(raw.remainingMs),
    countdownText: fmtHMS(raw.startToNowMs),
    nextName: raw.nextExam?.name ?? null,
    nextStartHM: raw.nextExam ? fmtHM(parseZonedTime(raw.nextExam.startTime)) : null,
    urgency: computeUrgency(raw.phase, raw.remainingMs),
    timeSynced: isTimeSyncReady(),
    notification: inDesignNotification,
  };

  const Design = getDesign(designId).component;

  const chooseDesign = useCallback((id: string) => {
    setDesign(id); setDesignId(id);
  }, []);

  return (
    <div className="exam-root">
      <Design
        vm={vm}
        onDismissNotification={dismiss}
        onBack={() => navigate('/')}
        onAdmin={() => navigate('/admin')}
        onSwitchDesign={() => setSwitcherOpen(true)}
      />
      {/* 设计切换窗：由各设计顶栏“▣ 切换设计”按钮触发，避免悬浮按钮遮挡大屏元素 */}
      <DesignSwitcher open={switcherOpen} onClose={() => setSwitcherOpen(false)} currentId={designId} onSelect={chooseDesign} />
      {/* 全屏提醒浮层：风格跟随当前展示设计自动切换 */}
      <ExamAlertOverlay
        item={overlayItem}
        now={nowTick}
        designId={designId}
        masterTitle={title}
        timeSynced={isTimeSyncReady()}
      />
    </div>
  );
}
