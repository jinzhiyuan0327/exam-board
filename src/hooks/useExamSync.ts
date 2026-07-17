import { useEffect, useRef } from 'react';
import type { ExamItem, AlertsSettings } from '../types';
import { getAppSettings, updateExamSettings, updateAlertsSettings } from '../utils/appSettings';
import { fetchExamsFromServer } from '../services/examService';

interface Options {
  onUpdate?: (data: { items: ExamItem[]; title: string; alerts: AlertsSettings }) => void;
  intervalMs?: number;
}

export function useExamSync({ onUpdate, intervalMs = 30000 }: Options = {}) {
  const lastApplied = useRef(0);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      const remote = await fetchExamsFromServer();
      if (cancelled || !remote) return;
      const localAt = getAppSettings().exam?.updatedAt ?? 0;
      const baseline = Math.max(lastApplied.current, localAt);
      if (remote.updatedAt <= baseline) return;
      lastApplied.current = remote.updatedAt;
      // 优先使用服务器的 majors/activeMajorId；normalizeExam 会自动将 items/title 镜像为激活大型考试。
      updateExamSettings({
        items: remote.items,
        title: remote.title,
        majors: remote.majors && remote.majors.length ? remote.majors : undefined as any,
        activeMajorId: remote.activeMajorId || undefined as any,
        updatedAt: remote.updatedAt,
      });
      // 同步提醒管理配置（若服务器尚未自定义则保持本地）。
      if (remote.alerts) updateAlertsSettings(remote.alerts);
      const s = getAppSettings();
      onUpdateRef.current?.({ items: s.exam.items, title: s.exam.title, alerts: s.alerts });
    };
    pull();
    const id = setInterval(pull, intervalMs);
    // PWA/离线设备恢复网络、回到前台时立即补拉云端，API 始终网络优先。
    const onOnline = () => { void pull(); };
    const onVisible = () => { if (document.visibilityState === 'visible') void pull(); };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => { cancelled = true; clearInterval(id); window.removeEventListener('online', onOnline); document.removeEventListener('visibilitychange', onVisible); };
  }, [intervalMs]);
}
