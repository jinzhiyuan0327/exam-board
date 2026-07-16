import React, { useEffect, useState } from 'react';
import type { AlertState } from '../types';
import type { AlertOverlayItem } from '../hooks/useAlertOverlay';
import '../styles/exam-alert-overlay.css';

interface Props {
  item: AlertOverlayItem | null;
  now: number;
  designId: string;
  masterTitle: string;
  timeSynced: boolean;
}

type ThemeKey = 'cmd' | 'clean' | 'chalk' | 'emg' | 'edit';
type Variant = 'centered' | 'emergency' | 'editorial';

const DESIGN_TO_THEME: Record<string, { theme: ThemeKey; variant: Variant }> = {
  'command-deck': { theme: 'cmd', variant: 'centered' },
  'clean-focus': { theme: 'clean', variant: 'centered' },
  'blackboard': { theme: 'chalk', variant: 'centered' },
  'emergency': { theme: 'emg', variant: 'emergency' },
  'editorial': { theme: 'edit', variant: 'editorial' },
};

// 各主题下的语义色（accent 主色 / soft 浅底）
const TONES: Record<ThemeKey, Record<AlertState, { accent: string; soft?: string }>> = {
  cmd: {
    '15min': { accent: '#ffca65' }, 'end15': { accent: '#ffca65' },
    '5min': { accent: '#ff7c70' }, 'start': { accent: '#5fe2a6' },
    'ended': { accent: '#8fb0d6' }, 'next': { accent: '#a78bfa' },
  },
  clean: {
    '15min': { accent: '#d38b2f', soft: '#fbf1e2' }, 'end15': { accent: '#d38b2f', soft: '#fbf1e2' },
    '5min': { accent: '#d0483a', soft: '#fbe7e4' }, 'start': { accent: '#146eb4', soft: '#e6f4ff' },
    'ended': { accent: '#2f7d59', soft: '#e5f1ea' }, 'next': { accent: '#6b57b8', soft: '#efe9f8' },
  },
  chalk: {
    '15min': { accent: '#f7e59b' }, 'end15': { accent: '#f7e59b' },
    '5min': { accent: '#f0a763' }, 'start': { accent: '#8fdca9' },
    'ended': { accent: '#b9d3c5' }, 'next': { accent: '#e6c98a' },
  },
  emg: {
    '15min': { accent: '#de9255' }, 'end15': { accent: '#de9255' },
    '5min': { accent: '#e7473d' }, 'start': { accent: '#46a171' },
    'ended': { accent: '#6b7580' }, 'next': { accent: '#4b90c4' },
  },
  edit: {
    '15min': { accent: '#c98a2b' }, 'end15': { accent: '#c98a2b' },
    '5min': { accent: '#d8422b' }, 'start': { accent: '#2f7d59' },
    'ended': { accent: '#565b58' }, 'next': { accent: '#6b57b8' },
  },
};

const EN_LABEL: Record<AlertState, string> = {
  '15min': 'NOTICE', '5min': 'NOTICE', 'start': 'NOW', 'end15': 'NOTICE', 'ended': 'FINISH', 'next': 'NEXT',
};

const pad2 = (n: number) => String(n).padStart(2, '0');
function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}

function heroSizeClass(text: string): string {
  const len = [...text].length;
  if (len <= 5) return 'eao-hero--xl';
  if (len <= 8) return 'eao-hero--lg';
  return 'eao-hero--md';
}

export default function ExamAlertOverlay({ item, now, designId, masterTitle, timeSynced }: Props) {
  const [visible, setVisible] = useState(false);

  // 淡入 / 淡出
  useEffect(() => {
    if (item) { const t = setTimeout(() => setVisible(true), 20); return () => clearTimeout(t); }
    setVisible(false);
  }, [item?.key]);

  if (!item) return null;

  const map = DESIGN_TO_THEME[designId] ?? DESIGN_TO_THEME['command-deck'];
  const tone = TONES[map.theme][item.tone] ?? TONES[map.theme]['15min'];
  const hero = item.countdownTo != null ? fmtCountdown(item.countdownTo - now) : (item.hero ?? '');
  const syncText = timeSynced ? '已校时同步' : '未校时';
  const year = new Date(now).getFullYear();
  const brand = (masterTitle || '').replace(/\s+/g, '').toUpperCase() || 'EXAM';

  const styleVars = {
    ['--accent' as any]: tone.accent,
    ['--soft' as any]: tone.soft ?? 'transparent',
  } as React.CSSProperties;

  const rootCls = `eao eao--${map.theme} eao--${map.variant}${visible ? ' is-visible' : ''}`;

  // ——— 高对比应急（上下色条） ———
  if (map.variant === 'emergency') {
    return (
      <div className={rootCls} style={styleVars} role="alert" aria-live="assertive">
        <div className="eao-emg-bar eao-emg-bar--top">
          <span className="eao-emg-brand">EXAM ALERT · {masterTitle || '考试提醒'}</span>
          <span className="eao-emg-label">{item.label}</span>
        </div>
        <div className="eao-emg-body">
          <p className="eao-title">{item.title}</p>
          <p className={`eao-hero ${heroSizeClass(hero)}`}>{hero}</p>
          {item.examLine && <p className="eao-examline">{item.examLine}</p>}
        </div>
        <div className="eao-emg-bar eao-emg-bar--bottom">
          <span className="eao-emg-sub">{item.subtext}</span>
        </div>
      </div>
    );
  }

  // ——— 编辑排版（左对齐） ———
  if (map.variant === 'editorial') {
    return (
      <div className={rootCls} style={styleVars} role="alert" aria-live="assertive">
        <div className="eao-edit-rail eao-edit-rail--left" aria-hidden="true" />
        <div className="eao-edit-main">
          <p className="eao-edit-kicker">{brand} / {year}</p>
          <p className="eao-edit-en">{EN_LABEL[item.tone]} / {item.label}</p>
          <p className="eao-title">{item.title}</p>
          <p className={`eao-hero ${heroSizeClass(hero)}`}>{hero}</p>
          <div className="eao-edit-line" aria-hidden="true" />
          {item.examLine && <p className="eao-examline">{item.examLine}</p>}
          {item.subtext && <p className="eao-edit-sub">{item.subtext}</p>}
        </div>
        <div className="eao-edit-rail eao-edit-rail--right" aria-hidden="true">
          <span className="eao-edit-vtext">{EN_LABEL[item.tone]}</span>
        </div>
      </div>
    );
  }

  // ——— 居中类（深色指挥舱 / 清爽聚焦 / 校园黑板） ———
  const showBrackets = map.theme === 'chalk';
  return (
    <div className={rootCls} style={styleVars} role="alert" aria-live="assertive">
      {map.theme === 'cmd' && <><span className="eao-side eao-side--l" /><span className="eao-side eao-side--r" /></>}
      <div className="eao-topbar">
        <span className="eao-master">{masterTitle || '考试提醒'}</span>
        <span className={`eao-sync${timeSynced ? ' is-ok' : ''}`}><span className="eao-sync-dot" />{syncText}</span>
      </div>
      <div className="eao-center">
        <span className="eao-capsule">{showBrackets ? `【 ${item.label} 】` : item.label}</span>
        <p className="eao-title">{item.title}</p>
        <p className={`eao-hero ${heroSizeClass(hero)}`}>{hero}</p>
        <div className="eao-divider" aria-hidden="true" />
        {item.examLine && <p className="eao-examline">{item.examLine}</p>}
      </div>
      {item.subtext && <div className="eao-subbar"><span>{item.subtext}</span></div>}
    </div>
  );
}
