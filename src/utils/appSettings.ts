import type { ExamItem, MajorExam, AlertState, AlertStateConfig, CustomReminder, AlertsSettings } from '../types';
import { logger } from './logger';
import { sortExamItemsByTime } from './examSchedule';

export type { AlertState, AlertStateConfig, CustomReminder, AlertsSettings } from '../types';

export interface TimeSyncSettings {
  enabled: boolean;
  provider: 'httpDate' | 'timeApi' | 'ntp';
  httpDateUrl: string;
  timeApiUrl: string;
  ntpHost: string;
  ntpPort: number;
  manualOffsetMs: number;
  offsetMs: number;
  autoSyncEnabled: boolean;
  autoSyncIntervalSec: number;
  lastSyncAt: number;
  lastRttMs?: number;
  lastError?: string;
}

export interface ExamSettings {
  /** 当前激活的大型考试名称（= 大屏标题，为兼容旧版保留）。 */
  title: string;
  /** 当前激活大型考试的分考试列表（= majors 中激活项的镜像，供展示端直接消费）。 */
  items: ExamItem[];
  /** 全部大型考试。 */
  majors: MajorExam[];
  /** 当前激活的大型考试 id。 */
  activeMajorId: string;
  alertEnabled: boolean;
  announcementPermanentlyHidden: boolean;
  updatedAt?: number;
}

export interface AppSettings {
  version: number;
  hasVisited: boolean;
  general: {
    timeSync: TimeSyncSettings;
  };
  exam: ExamSettings;
  /** 全屏提醒浮层的统一管理设置。 */
  alerts: AlertsSettings;
  study: {
    alerts: { errorCenterMode: 'off' | 'memory' | 'persist' };
  };
}

/** 六种内置提醒的默认文案（与效果图一致）。 */
export const DEFAULT_ALERT_STATES: Record<AlertState, AlertStateConfig> = {
  '15min': { enabled: true, label: '准备', title: '距开考 15 分钟', subtext: '请尽快进入考场并对号入座' },
  '5min':  { enabled: true, label: '即将开考', title: '距开考 5 分钟', subtext: '请停止交谈，检查证件与文具' },
  'start': { enabled: true, label: '进行中', title: '开始考试', subtext: '请听从监考安排，开始作答', hero: '现在开始' },
  'end15': { enabled: true, label: '注意', title: '本场剩余 15 分钟', subtext: '请抓紧作答，注意填涂答题卡' },
  'ended': { enabled: true, label: '已结束', title: '本场考试结束', subtext: '请立即停笔，原地等待收卷', hero: '考试结束' },
  'next':  { enabled: true, label: '下一科', title: '下一科目：{subject}', subtext: '{subject} {start} 开考 · 请提前到场候考' },
};

export const DEFAULT_ALERTS: AlertsSettings = {
  enabled: true,
  durationSec: 8,
  states: DEFAULT_ALERT_STATES,
  custom: [],
  updatedAt: 0,
};

export function genReminderId(): string {
  return `rmd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/** 规范化任意新旧版提醒设置，补齐缺失字段。 */
export function normalizeAlerts(raw: unknown): AlertsSettings {
  const src = (raw ?? {}) as Partial<AlertsSettings>;
  const states = {} as Record<AlertState, AlertStateConfig>;
  (Object.keys(DEFAULT_ALERT_STATES) as AlertState[]).forEach(k => {
    states[k] = { ...DEFAULT_ALERT_STATES[k], ...((src.states?.[k]) ?? {}) };
  });
  const custom: CustomReminder[] = Array.isArray(src.custom)
    ? src.custom.filter(Boolean).map((c, i) => ({
        id: c.id || `rmd_${i}`,
        name: c.name || `自定义提醒${i + 1}`,
        enabled: c.enabled !== false,
        anchor: c.anchor === 'afterStart' || c.anchor === 'beforeEnd' ? c.anchor : 'beforeStart',
        offsetMin: Number.isFinite(c.offsetMin) ? Math.max(0, Math.round(c.offsetMin)) : 10,
        tone: (['15min','5min','start','end15','ended','next'] as AlertState[]).includes(c.tone) ? c.tone : '15min',
        label: c.label || '提醒',
        title: c.title || '',
        subtext: c.subtext || '',
      }))
    : [];
  return {
    enabled: src.enabled !== false,
    durationSec: Number.isFinite(src.durationSec) ? Math.min(20, Math.max(3, src.durationSec as number)) : 8,
    states,
    custom,
    updatedAt: Number(src.updatedAt ?? 0),
  };
}

export const APP_SETTINGS_KEY = 'AppSettings';
/** 同一页面内 localStorage 写入不会触发 storage 事件，使用此事件通知正在运行的页面。 */
export const APP_SETTINGS_CHANGED_EVENT = 'exam-board:settings-changed';

export function genMajorId(): string {
  return `major_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

const DEFAULT_SETTINGS: AppSettings = {
  version: 2,
  hasVisited: false,
  general: {
    timeSync: {
      enabled: true,
      provider: 'timeApi',
      httpDateUrl: '/',
      timeApiUrl: '/api/time',
      ntpHost: 'ntp.aliyun.com',
      ntpPort: 123,
      manualOffsetMs: 0,
      offsetMs: 0,
      autoSyncEnabled: true,
      autoSyncIntervalSec: 900,
      lastSyncAt: 0,
    },
  },
  exam: {
    title: '2026年高考',
    items: [],
    majors: [],
    activeMajorId: '',
    alertEnabled: true,
    announcementPermanentlyHidden: false,
    updatedAt: 0,
  },
  alerts: DEFAULT_ALERTS,
  study: {
    alerts: { errorCenterMode: 'off' },
  },
};

/**
 * 将任意新旧版 exam 数据规范化为含 majors/activeMajorId 的新结构，
 * 并保证 items/title 与激活大型考试保持一致（镜像）。
 */
export function normalizeExam(raw: unknown): ExamSettings {
  const src = (raw ?? {}) as Partial<ExamSettings> & { items?: ExamItem[]; title?: string };
  const base: ExamSettings = {
    ...DEFAULT_SETTINGS.exam,
    ...(src as object),
  };

  let majors: MajorExam[] = Array.isArray(src.majors) ? src.majors.filter(Boolean) : [];

  // 旧版迁移：仅有 items/title 时，包装为单个大型考试。
  if (majors.length === 0) {
    const legacyItems = Array.isArray(src.items) ? src.items : [];
    majors = [{
      id: genMajorId(),
      name: (src.title && src.title.trim()) || '2026年高考',
      items: legacyItems,
      order: 0,
    }];
  }

  majors = majors
    .map((m, i) => ({
      id: m.id || genMajorId(),
      name: m.name || `考试${i + 1}`,
      items: sortExamItemsByTime(Array.isArray(m.items) ? m.items : []),
      order: typeof m.order === 'number' ? m.order : i,
    }))
    .sort((a, b) => a.order - b.order)
    .map((m, i) => ({ ...m, order: i }));

  let activeMajorId = src.activeMajorId || '';
  if (!majors.some(m => m.id === activeMajorId)) activeMajorId = majors[0].id;
  const active = majors.find(m => m.id === activeMajorId) ?? majors[0];

  return {
    ...base,
    majors,
    activeMajorId,
    // items/title 始终镜像激活大型考试，保证展示端无需改动。
    title: active.name,
    items: active.items,
  };
}

export function getAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(APP_SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      general: {
        ...DEFAULT_SETTINGS.general,
        ...parsed.general,
        timeSync: { ...DEFAULT_SETTINGS.general.timeSync, ...(parsed.general?.timeSync ?? {}) },
      },
      exam: normalizeExam(parsed.exam),
      alerts: normalizeAlerts(parsed.alerts),
      study: {
        ...DEFAULT_SETTINGS.study,
        ...parsed.study,
        alerts: { ...DEFAULT_SETTINGS.study.alerts, ...(parsed.study?.alerts ?? {}) },
      },
    };
  } catch (e) {
    logger.error('Failed to load AppSettings', e);
    return DEFAULT_SETTINGS;
  }
}

export function updateAppSettings(partial: Partial<AppSettings> | ((c: AppSettings) => Partial<AppSettings>)): void {
  try {
    const current = getAppSettings();
    const updates = typeof partial === 'function' ? partial(current) : partial;
    const next: AppSettings = {
      ...current,
      ...updates,
      general: updates.general
        ? { ...current.general, ...updates.general,
            timeSync: { ...current.general.timeSync, ...(updates.general.timeSync ?? {}) } }
        : current.general,
      exam: updates.exam ? normalizeExam({ ...current.exam, ...updates.exam }) : current.exam,
      alerts: updates.alerts ? normalizeAlerts({ ...current.alerts, ...updates.alerts }) : current.alerts,
    };
    localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(next));
    // storage 事件只会通知其他同源窗口；当前窗口也必须立即收到本地数据变更。
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(APP_SETTINGS_CHANGED_EVENT));
  } catch (e) {
    logger.error('Failed to save AppSettings', e);
  }
}

export function updateExamSettings(updates: Partial<ExamSettings>): void {
  updateAppSettings(c => ({ exam: normalizeExam({ ...c.exam, ...updates }) }));
}

export function updateAlertsSettings(updates: Partial<AlertsSettings>): void {
  updateAppSettings(c => ({ alerts: normalizeAlerts({ ...c.alerts, ...updates }) }));
}

export function updateTimeSyncSettings(
  updates: Partial<TimeSyncSettings> | ((c: TimeSyncSettings) => Partial<TimeSyncSettings>)
): void {
  updateAppSettings(c => {
    const base = c.general.timeSync;
    const patch = typeof updates === 'function' ? updates(base) : updates;
    return { general: { ...c.general, timeSync: { ...base, ...patch } } };
  });
}
