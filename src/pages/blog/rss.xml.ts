import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { SITE_URL } from '@/data/config';

export async function GET() {
  const posts = (await getCollection('blog'))
    .filter(p => !p.data.isDraft)
    .sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime());

  return rss({
    title: 'Siddhant Shah - Blog',
    description: 'Latest blog posts on quantitative finance, machine learning, and data analytics by Siddhant Shah',
    site: SITE_URL,
    items: posts.map(p => ({
      title: p.data.title,
      description: p.data.description,
      link: `/blog/${p.slug}/`,
      pubDate: p.data.publishedAt,
      categories: p.data.tags,
    })),
    customData: `<language>en-us</language>`,
  });
}
