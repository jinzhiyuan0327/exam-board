import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { isPasswordRequired, verifyToken, extractBearer } from './_auth.js';

// 性能：缓存 neon 客户端（同一 warm 实例复用）。
let _sql: ReturnType<typeof neon> | null = null;
function database() {
  if (_sql) return _sql;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  _sql = neon(connectionString);
  return _sql;
}

// 建表/迁移只需执行一次：用模块级 Promise 缓存，避免每个请求都跑 6 条 DDL。
// （数据库在新加坡、Vercel 在美国，每条 SQL 都是一次跨洲 HTTP 往返，
// 以前每次 GET/POST 都做 6 次 DDL 往返→累计 2-3 秒。现改为按需且仅一次。)
let migratePromise: Promise<void> | null = null;
let updatedAtMigrationPromise: Promise<void> | null = null;

// 早期版本曾将 updated_at 建为 INTEGER；毫秒时间戳超过其上限时，将旧列无损扩展为 BIGINT。
// 仅在旧表首次写入溢出、或按需建表迁移时执行，避免每次请求增加 DDL 往返。
function ensureUpdatedAtBigIntOnce(): Promise<void> {
  if (!updatedAtMigrationPromise) {
    updatedAtMigrationPromise = (async () => {
      const sql = database();
      await sql`ALTER TABLE exam_data ALTER COLUMN updated_at TYPE BIGINT USING updated_at::BIGINT`;
    })().catch(err => { updatedAtMigrationPromise = null; throw err; });
  }
  return updatedAtMigrationPromise;
}

function ensureTableOnce(): Promise<void> {
  if (!migratePromise) {
    migratePromise = (async () => {
      const sql = database();
      await sql`
        CREATE TABLE IF NOT EXISTS exam_data (
          id INTEGER PRIMARY KEY DEFAULT 1,
          items JSONB NOT NULL DEFAULT '[]',
          title TEXT NOT NULL DEFAULT '',
          updated_at BIGINT NOT NULL DEFAULT 0,
          CHECK (id = 1)
        )
      `;
      await sql`ALTER TABLE exam_data ADD COLUMN IF NOT EXISTS majors JSONB NOT NULL DEFAULT '[]'`;
      await sql`ALTER TABLE exam_data ADD COLUMN IF NOT EXISTS active_major_id TEXT NOT NULL DEFAULT ''`;
      await sql`ALTER TABLE exam_data ADD COLUMN IF NOT EXISTS alerts JSONB`;
      await ensureUpdatedAtBigIntOnce();
      await sql`
        INSERT INTO exam_data (id, items, title, updated_at)
        VALUES (1, '[]', '', 0)
        ON CONFLICT (id) DO NOTHING
      `;
    })().catch(err => { migratePromise = null; throw err; });
  }
  return migratePromise;
}

type ExamRow = {
  items?: unknown;
  title?: string;
  majors?: unknown;
  active_major_id?: string;
  alerts?: unknown;
  updated_at?: number | string | null;
};
type UpdatedRow = { updated_at: number | string };

// 判断是否因“表/列尚未创建”报错，仅在首次遇到时才跑迁移并重试。
function missingRelation(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /does not exist|undefined_table|undefined_column/i.test(msg);
}

function updatedAtIntegerOverflow(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const code = typeof err === 'object' && err !== null && 'code' in err
    ? String((err as { code?: unknown }).code ?? '')
    : '';
  return code === '22003' && /out of range for type integer/i.test(msg);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  try {
    const sql = database();

    if (req.method === 'GET') {
      // 快路径：直接查询（一次往返）；仅当表/列缺失时才迁移后重试。
      const selectRow = async (): Promise<ExamRow[]> => (
        await sql`SELECT items, title, majors, active_major_id, alerts, updated_at FROM exam_data WHERE id = 1`
      ) as unknown as ExamRow[];
      let rows: ExamRow[];
      try {
        rows = await selectRow();
      } catch (e) {
        if (!missingRelation(e)) throw e;
        await ensureTableOnce();
        rows = await selectRow();
      }
      const row = rows[0] ?? { items: [], title: '', majors: [], active_major_id: '', alerts: null, updated_at: 0 };
      res.status(200).json({
        ok: true,
        items: row.items ?? [],
        title: row.title ?? '',
        majors: row.majors ?? [],
        activeMajorId: row.active_major_id ?? '',
        alerts: row.alerts ?? null,
        updatedAt: Number(row.updated_at ?? 0),
      });
      return;
    }

    if (req.method === 'POST') {
      if (await isPasswordRequired()) {
        const token = extractBearer(req.headers.authorization);
        if (!await verifyToken(token)) { res.status(401).json({ ok: false, error: 'Unauthorized' }); return; }
      }
      const { items, title, majors, activeMajorId, alerts, baseUpdatedAt } = req.body ?? {};
      if (!Array.isArray(items)) { res.status(400).json({ ok: false, error: 'items must be an array' }); return; }
      const expectedVersion = Number(baseUpdatedAt ?? 0);
      const updatedAt = Date.now();
      const runUpdate = async (): Promise<UpdatedRow[]> => (
        await sql`
          UPDATE exam_data
          SET items = ${JSON.stringify(items)}::jsonb,
              title = ${typeof title === 'string' ? title : ''},
              majors = ${JSON.stringify(Array.isArray(majors) ? majors : [])}::jsonb,
              active_major_id = ${typeof activeMajorId === 'string' ? activeMajorId : ''},
              alerts = ${alerts && typeof alerts === 'object' ? JSON.stringify(alerts) : null}::jsonb,
              updated_at = ${updatedAt}
          WHERE id = 1 AND (${expectedVersion} <= 0 OR updated_at = ${expectedVersion})
          RETURNING updated_at
        `
      ) as unknown as UpdatedRow[];
      let updatedRows: UpdatedRow[];
      try {
        updatedRows = await runUpdate();
      } catch (e) {
        if (missingRelation(e)) {
          await ensureTableOnce();
          updatedRows = await runUpdate();
        } else if (updatedAtIntegerOverflow(e)) {
          // 旧实例数据库的 updated_at 仍为 INTEGER：自动升级后重试本次保存。
          await ensureUpdatedAtBigIntOnce();
          updatedRows = await runUpdate();
        } else {
          throw e;
        }
      }
      if (!updatedRows?.length) {
        const rows = (await sql`SELECT items, title, majors, active_major_id, alerts, updated_at FROM exam_data WHERE id = 1`) as unknown as ExamRow[];
        const row = rows[0] ?? {};
        res.status(409).json({ ok: false, error: 'Conflict', remote: { items: row.items ?? [], title: row.title ?? '', majors: row.majors ?? [], activeMajorId: row.active_major_id ?? '', alerts: row.alerts ?? null, updatedAt: Number(row.updated_at ?? 0) } });
        return;
      }
      res.status(200).json({ ok: true, updatedAt });
      return;
    }

    res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (error: unknown) {
    console.error('Exam API error:', error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Database error' });
  }
}
