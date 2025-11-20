export interface BlogEventPayload {
  type: 'view' | 'unload';
  slug: string;
  t: number; // ms on page
  scrollPct: number; // 0-1
}

// Cloudflare Pages Function (D1/KV binding via env.BLOG_METRICS)
export async function onRequestPost(context: any) {
  const { request, env } = context;
  const data = await request.json().catch(()=>null) as BlogEventPayload | null;
  if(!data || !data.slug) {
    return new Response('bad request', { status: 400 });
  }
  const key = `stats:${data.slug}`;
  const existingRaw = await env.BLOG_METRICS.get(key);
  const existing = existingRaw ? JSON.parse(existingRaw) : { views:0, totalTime:0, totalScroll:0 };
  existing.views += data.type === 'view' ? 1 : 0;
  existing.totalTime += data.t;
  existing.totalScroll = Math.max(existing.totalScroll, data.scrollPct);
  await env.BLOG_METRICS.put(key, JSON.stringify(existing));
  return new Response('ok',{ status:200 });
}
