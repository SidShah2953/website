import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";
import robotsTxt from "astro-robots-txt";
import { SITE_URL } from "./src/data/config";

import mdx from "@astrojs/mdx";
// For Latex Integration 
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';

// For ToC
import remarkToc from "remark-toc";
import rehypeToc from "rehype-toc";

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind(),
    sitemap(),
    robotsTxt(),
    mdx({
			remarkPlugins: [
        remarkMath, 
      ], // For Latex Integration
			rehypePlugins: [
        rehypeKatex,
        [
          rehypeToc, {
            headings: ["h2", "h3"],
          },
        ],
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