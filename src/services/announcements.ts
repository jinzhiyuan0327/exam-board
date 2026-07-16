// 公告客户端服务：从 /api/announcements 拉取作者端统一发布的公告。
// 内容以 Markdown 存储，展示时由 renderMarkdown 渲染。

export type Announcement = {
  id: number;
  title: string;
  content: string;
  pinned: boolean;
  created_at: number;
  updated_at: number;
};

let cache: { at: number; data: Announcement[] } | null = null;
const TTL = 60 * 1000;

export async function fetchAnnouncements(force = false): Promise<Announcement[]> {
  if (!force && cache && Date.now() - cache.at < TTL) return cache.data;
  try {
    const r = await fetch('/api/announcements?limit=30', { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    const list: Announcement[] = Array.isArray(d?.announcements) ? d.announcements : [];
    cache = { at: Date.now(), data: list };
    return list;
  } catch {
    // 拉取失败时返回缓存（若有）或空列表，不阻断页面
    return cache?.data ?? [];
  }
}
