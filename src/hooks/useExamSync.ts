import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExamItem, AlertsSettings } from '../types';
import { APP_SETTINGS_CHANGED_EVENT, APP_SETTINGS_KEY, getAppSettings, updateExamSettings, updateAlertsSettings } from '../utils/appSettings';
import { fetchExamsFromServer } from '../services/examService';
import { flushPendingExamSync, getPendingExamSync } from '../services/examOutbox';

interface Options {
  onUpdate?: (data: { items: ExamItem[]; title: string; alerts: AlertsSettings }) => void;
  intervalMs?: number;
}

export type ExamDataSyncState = 'local' | 'syncing' | 'synced' | 'pending' | 'offline' | 'error' | 'auth-required';

export function useExamSync({ onUpdate, intervalMs = 60000 }: Options = {}) {
  const lastApplied = useRef(0);
  const pulling = useRef(false);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const [syncState, setSyncState] = useState<ExamDataSyncState>(() => typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : (getPendingExamSync() ? 'pending' : 'local'));
  const [lastSyncAt, setLastSyncAt] = useState(0);
  const [hasPendingSync, setHasPendingSync] = useState(() => !!getPendingExamSync());

  const applyLocal = useCallback(() => {
    const s = getAppSettings();
    onUpdateRef.current?.({ items: s.exam.items, title: s.exam.title, alerts: s.alerts });
    const pending = !!getPendingExamSync();
    setHasPendingSync(pending);
    setSyncState(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : (pending ? 'pending' : 'local'));
  }, []);

  const applyPayload = useCallback((payload: { items: ExamItem[]; title: string; alerts: AlertsSettings | null; majors: any[]; activeMajorId: string; updatedAt: number }) => {
    updateExamSettings({
      items: payload.items,
      title: payload.title,
      majors: payload.majors && payload.majors.length ? payload.majors as any : undefined as any,
      activeMajorId: payload.activeMajorId || undefined as any,
      updatedAt: payload.updatedAt,
    });
    if (payload.alerts) updateAlertsSettings(payload.alerts);
    const s = getAppSettings();
    onUpdateRef.current?.({ items: s.exam.items, title: s.exam.title, alerts: s.alerts });
  }, []);

  const refresh = useCallback(async (force = false) => {
    // 手动/恢复时先应用本地快照；离线永远可立即显示最新本机编辑。
    applyLocal();
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (pulling.current) return;
    pulling.current = true;
    setSyncState('syncing');
    try {
      const flushed = await flushPendingExamSync(force);
      if (flushed.kind === 'saved') {
        applyPayload({ ...flushed.payload, updatedAt: flushed.updatedAt });
        setHasPendingSync(false);
      } else if (flushed.kind === 'offline') { setSyncState('offline'); return; }
      else if (flushed.kind === 'deferred') { setHasPendingSync(true); setSyncState('pending'); return; }
      else if (flushed.kind === 'unauthorized') { setSyncState('auth-required'); return; }
      else if (flushed.kind === 'error') { setHasPendingSync(true); setSyncState('error'); return; }

      // 本地仍有待办时绝不以云端旧数据覆盖；等待下一次冲刷/三方合并。
      if (getPendingExamSync()) { setHasPendingSync(true); setSyncState('pending'); return; }
      const remote = await fetchExamsFromServer();
      if (!remote) { setSyncState('error'); return; }
      const localAt = getAppSettings().exam?.updatedAt ?? 0;
      const baseline = Math.max(lastApplied.current, localAt);
      if (remote.updatedAt > baseline) {
        lastApplied.current = remote.updatedAt;
        applyPayload(remote);
      }
      setHasPendingSync(false);
      setLastSyncAt(Date.now());
      setSyncState('synced');
    } finally {
      pulling.current = false;
    }
  }, [applyLocal, applyPayload]);

  useEffect(() => {
    let cancelled = false;
    const pull = () => { if (!cancelled) void refresh(); };
    pull();
    const id = setInterval(() => { if (document.visibilityState === 'visible') pull(); }, intervalMs);
    // PWA/离线设备恢复网络、回到前台时立即补拉云端，API 始终网络优先。
    const onOnline = () => { void pull(); };
    const onVisible = () => { if (document.visibilityState === 'visible') void pull(); };
    // 后台标签页的定时器可能被浏览器暂停；恢复焦点或 BFCache 页面时立即补拉最新数据。
    const onFocus = () => { void pull(); };
    const onPageShow = () => { void pull(); };
    const onLocalChanged = () => { applyLocal(); };
    const onStorage = (event: StorageEvent) => { if (event.key === APP_SETTINGS_KEY) applyLocal(); };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener(APP_SETTINGS_CHANGED_EVENT, onLocalChanged);
    window.addEventListener('storage', onStorage);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener(APP_SETTINGS_CHANGED_EVENT, onLocalChanged);
      window.removeEventListener('storage', onStorage);
    };
  }, [intervalMs, refresh, applyLocal]);

  return { refresh, reloadLocal: applyLocal, syncState, lastSyncAt, hasPendingSync };
}
