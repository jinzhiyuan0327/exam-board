import type { ExamItem, MajorExam, AlertsSettings } from '../types';

export interface ExamPayload {
  items: ExamItem[];
  title: string;
  majors: MajorExam[];
  activeMajorId: string;
  alerts: AlertsSettings | null;
  updatedAt: number;
}

const API_URL = '/api/exams';
const LOGIN_URL = '/api/login';
const TOKEN_KEY = 'admin_auth_token';
const TOKEN_EXPIRES_KEY = 'admin_auth_token_expires';

export async function fetchExamsFromServer(): Promise<ExamPayload | null> {
  try {
    const res = await fetch(API_URL, { method: 'GET', headers: { 'Cache-Control': 'no-store' } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.ok) return null;
    return {
      items: Array.isArray(data.items) ? data.items : [],
      title: typeof data.title === 'string' ? data.title : '',
      majors: Array.isArray(data.majors) ? data.majors : [],
      activeMajorId: typeof data.activeMajorId === 'string' ? data.activeMajorId : '',
      alerts: data.alerts && typeof data.alerts === 'object' ? data.alerts : null,
      updatedAt: Number(data.updatedAt ?? 0),
    };
  } catch { return null; }
}

export interface SaveExamsInput {
  items: ExamItem[];
  title?: string;
  majors?: MajorExam[];
  activeMajorId?: string;
  alerts?: AlertsSettings | null;
}

/**
 * 将数据推送至服务器。
 * 返回值：成功返回 updatedAt；鉴权失败返回 'unauthorized'；其余错误（含离线）返回 null。
 */
export async function saveExamsToServer(input: SaveExamsInput): Promise<number | 'unauthorized' | null> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(API_URL, {
      method: 'POST', headers,
      body: JSON.stringify({
        items: input.items,
        title: input.title ?? '',
        majors: input.majors ?? [],
        activeMajorId: input.activeMajorId ?? '',
        alerts: input.alerts ?? null,
      }),
    });
    if (res.status === 401) { logoutAdmin(); return 'unauthorized'; }
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.ok) return null;
    return Number(data.updatedAt ?? Date.now());
  } catch { return null; }
}

export async function isLoginRequired(): Promise<boolean> {
  try {
    const res = await fetch(LOGIN_URL, { method: 'GET', headers: { 'Cache-Control': 'no-store' } });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data?.required;
  } catch { return false; }
}

export async function loginAdmin(password: string): Promise<boolean> {
  try {
    const res = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) return false;
    if (data.token) {
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(TOKEN_EXPIRES_KEY, String(data.expiresAt ?? 0));
    }
    return true;
  } catch { return false; }
}

export function hasValidLocalToken(): boolean {
  const token = localStorage.getItem(TOKEN_KEY);
  const expires = Number(localStorage.getItem(TOKEN_EXPIRES_KEY) ?? 0);
  if (!token) return false;
  if (expires && Date.now() > expires) { logoutAdmin(); return false; }
  return true;
}

export function logoutAdmin(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRES_KEY);
}
