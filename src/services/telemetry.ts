// 客户端遥测服务
// - 仅在用户「同意」后上报；密钥内嵌于服务端 /api/telemetry，浏览器侧不接触密钥
// - 上报数据：实例ID、事件、版本、主机、时区、语言、UA、客户端时间戳（地区/IP哈希由服务端补全）

const CONSENT_KEY = 'telemetry_consent';
const ENABLED_KEY = 'telemetry_enabled';
const INSTANCE_KEY = 'telemetry_instance_id';
const REPORTED_VER_KEY = 'telemetry_reported_version';

export type ConsentState = 'granted' | 'denied' | 'unset';

function ls(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getConsent(): ConsentState {
  const v = ls()?.getItem(CONSENT_KEY);
  return v === 'granted' || v === 'denied' ? v : 'unset';
}

export function setConsent(v: 'granted' | 'denied'): void {
  try {
    ls()?.setItem(CONSENT_KEY, v);
  } catch {
    /* ignore */
  }
}

export function isEnabled(): boolean {
  if (getConsent() !== 'granted') return false;
  const v = ls()?.getItem(ENABLED_KEY);
  return v == null ? true : v === 'true';
}

export function setEnabled(v: boolean): void {
  try {
    ls()?.setItem(ENABLED_KEY, v ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}

export function getInstanceId(): string {
  const store = ls();
  let id = store?.getItem(INSTANCE_KEY) || '';
  if (!id) {
    const rnd = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    id = rnd;
    try {
      store?.setItem(INSTANCE_KEY, id);
    } catch {
      /* ignore */
    }
  }
  return id;
}

export const APP_VERSION: string = __APP_VERSION__;
export const COMMIT_SHA: string = __COMMIT_SHA__;

async function send(event: string): Promise<boolean> {
  if (!isEnabled()) return false;
  try {
    const body = {
      instanceId: getInstanceId(),
      event,
      appVersion: __APP_VERSION__,
      commitSha: __COMMIT_SHA__,
      host: location.host,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      lang: navigator.language,
      userAgent: navigator.userAgent,
      clientTs: Date.now(),
    };
    const r = await fetch('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** 应用启动时调用：版本首次出现则上报一次 deploy，否则上报 boot。 */
export async function reportOnStart(): Promise<void> {
  if (!isEnabled()) return;
  const store = ls();
  const reported = store?.getItem(REPORTED_VER_KEY) || '';
  if (reported !== __APP_VERSION__) {
    const ok = await send('deploy');
    if (ok) {
      try {
        store?.setItem(REPORTED_VER_KEY, __APP_VERSION__);
      } catch {
        /* ignore */
      }
    }
  } else {
    await send('boot');
  }
}

export async function reportNow(event = 'manual'): Promise<boolean> {
  return send(event);
}
