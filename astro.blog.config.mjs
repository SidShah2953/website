import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import robotsTxt from 'astro-robots-txt';
import mdx from '@astrojs/mdx';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import rehypeToc from 'rehype-toc';

const BLOG_HOST = process.env.PUBLIC_BLOG_HOST || 'blog.example.com';

export default defineConfig({
  site: `https://${BLOG_HOST}`,
  integrations: [tailwind(), sitemap(), robotsTxt(), mdx({
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex, [rehypeToc, { headings: ['h2','h3'] }]]
  })],
  markdown: {
    syntaxHighlight: 'shiki',
    shikiConfig: { theme: 'dracula', wrap: true }
  }
});
