import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isPasswordRequired, checkPassword, generateToken } from './_auth.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  if (req.method === 'GET') {
    res.json({ ok: true, required: isPasswordRequired() });
    return;
  }

  if (req.method === 'POST') {
    const { password } = req.body ?? {};
    if (!isPasswordRequired()) { res.json({ ok: true, token: null }); return; }
    if (!checkPassword(password)) { res.status(401).json({ ok: false, error: 'Invalid password' }); return; }
    const { token, expiresAt } = generateToken();
    res.json({ ok: true, token, expiresAt });
    return;
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' });
}
