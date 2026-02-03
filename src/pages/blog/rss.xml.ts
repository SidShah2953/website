import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';

export async function GET() {
  const site = `https://${import.meta.env.PUBLIC_BLOG_HOST || 'blog.example.com'}`;
  const posts = (await getCollection('blog')).filter(p => !p.data.isDraft).sort((a,b)=> b.data.publishedAt.getTime()-a.data.publishedAt.getTime());
  return rss({
    title: 'Blog RSS',
    description: 'Latest blog posts',
    site,
    items: posts.map(p => ({
      title: p.data.title,
      description: p.data.description,
      link: `${site}/blog/${p.slug}/`,
      pubDate: p.data.publishedAt,
    }))
  });
}
