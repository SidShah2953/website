import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import robotsTxt from "astro-robots-txt";
import { SITE_URL } from "./src/data/config";

import mdx from "@astrojs/mdx";
// For Latex Integration
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';


// https://astro.build/config
export default defineConfig({
  output: 'static',
  // Experience and Education became subpages of About. The old top-level URLs
  // were live, so they redirect rather than 404.
  redirects: {
    '/experience': '/about/experience/',
    '/education': '/about/education/',
    // The COIN series home was renamed 202602 -> 202603, which 404'd two URLs
    // that are live and indexed. The eight parts still live under 202602/.
    '/blog/coin-research-202602': '/blog/coin-research-202603/',
    '/posts/coin-research-202602': '/blog/coin-research-202603/',
  },
  vite: {
    server: {
      watch: {
        ignored: ['**/node_modules/**', '**/.git/**'],
      },
    },
  },
  integrations: [
    sitemap({
      // Keep redirect stubs, the hidden page and the legacy /posts/ tree out of
      // the sitemap. They are all meta-refresh stubs marked noindex, so
      // submitting them just asks Google to crawl pages we tell it to ignore.
      filter: (page) =>
        !page.includes("/posts/") &&
        !page.includes("/private/") &&
        !/\/(experience|education)\/?$/.test(new URL(page).pathname),
    }),
    robotsTxt(),
    mdx({
			remarkPlugins: [
        remarkMath,
      ], // For Latex Integration
			rehypePlugins: [
        rehypeKatex,
      ] // For Latex Integration
		})],
  site: SITE_URL,
  markdown: {
    syntaxHighlight: "shiki",
    shikiConfig: {
      theme: "dracula",
      wrap: true
    }
  }
});