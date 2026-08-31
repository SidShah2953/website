import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import robotsTxt from "astro-robots-txt";
import { SITE_URL } from "./src/data/config";
import { readdirSync, readFileSync } from "node:fs";

// Posts flagged isHidden are deliberately unlisted; keep them out of the sitemap.
const HIDDEN = (() => {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (/\.mdx?$/.test(e.name) && /^isHidden:\s*true/m.test(readFileSync(p, "utf8")))
        out.push(e.name.replace(/\.mdx?$/, "").toLowerCase());
    }
  };
  walk("./src/content/blog");
  return out;
})();

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
        !HIDDEN.some((slug) => page.includes(`/blog/${slug}/`)) &&
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