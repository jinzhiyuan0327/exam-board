// 简单的基于令牌的鉴权工具。
// 客户端部署时“永远只需填” DATABASE_URL 与 ADMIN_PASSWORD 两个变量：
// 令牌密钥 TOKEN_SECRET 无需填写，部署时自动派生（仍允许显式环境变量覆盖）。
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const TOKEN_TTL = 24 * 60 * 60 * 1000; // 24h

/**
 * 自动派生令牌密钥（无需客户端填写 TOKEN_SECRET）：
 * - 若显式设了 TOKEN_SECRET 环境变量，则优先使用（可选覆盖，最高优先级）。
 * - 否则由“后台密码 + 本项目固定标识”确定性派生：
 *   · 同一项目的所有 Serverless 实例 / 多次重新部署都得到一致密钥（令牌可互验，升级后无需重新登录）；
 *   · 不同项目（不同生产域名 / 不同密码）得到不同密钥；
 *   · 伪造令牌需先知晓 ADMIN_PASSWORD，安全性等同于密码本身。
 */
function resolveTokenSecret(): string {
  const explicit = process.env.TOKEN_SECRET;
  if (explicit && explicit.trim()) return explicit.trim();
  const site =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    'local-dev';
  const material = ['exam-board/token-secret/v1', ADMIN_PASSWORD, site].join('|');
  return createHash('sha256').update(material).digest('base64url');
}

const TOKEN_SECRET = resolveTokenSecret();

export function isPasswordRequired(): boolean {
  return !!ADMIN_PASSWORD;
}

export function checkPassword(pwd: string): boolean {
  return !!ADMIN_PASSWORD && pwd === ADMIN_PASSWORD;
}

// 用 HMAC 对过期时间签名；密钥不再以明文形式内嵌到令牌中。
function sign(expiresAt: number): string {
  return createHmac('sha256', TOKEN_SECRET).update(String(expiresAt)).digest('base64url');
}

export function generateToken(): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + TOKEN_TTL;
  const token = Buffer.from(`${expiresAt}.${sign(expiresAt)}`).toString('base64url');
  return { token, expiresAt };
}

export function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, 'base64url').toString();
    const idx = decoded.lastIndexOf('.');
    if (idx <= 0) return false;
    const expiresAt = parseInt(decoded.slice(0, idx), 10);
    const sig = decoded.slice(idx + 1);
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;
    const expected = sign(expiresAt);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function extractBearer(authHeader: string | undefined): string | undefined {
  if (!authHeader?.startsWith('Bearer ')) return undefined;
  return authHeader.slice(7).trim();
}
