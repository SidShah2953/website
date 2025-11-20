// GET /api/blog-admin-stats?token=... returns aggregated stats for all slugs
// Requires KV binding: BLOG_METRICS and env BLOG_ADMIN_TOKEN
export async function onRequestGet(context: any) {
  const { env, request } = context;
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if(!env.BLOG_ADMIN_TOKEN || token !== env.BLOG_ADMIN_TOKEN) {
    return new Response('unauthorized', { status: 401 });
  }
  const list = await env.BLOG_METRICS.list();
  const results: Record<string, any> = {};
  for(const key of list.keys) {
    if(key.name.startsWith('stats:')) {
      const slug = key.name.replace('stats:','');
      const raw = await env.BLOG_METRICS.get(key.name);
      if(raw) {
        const data = JSON.parse(raw);
        results[slug] = {
          views: data.views,
          avgTimeSeconds: data.views ? +(data.totalTime / data.views / 1000).toFixed(1) : 0,
          maxScrollPct: +(data.totalScroll).toFixed(2)
        };
      }
    }
  }
  return new Response(JSON.stringify({ updated: new Date().toISOString(), stats: results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
