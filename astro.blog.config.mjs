import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import robotsTxt from "astro-robots-txt";
import react from "@astrojs/react";
import { SITE_URL } from "./src/data/config";

import mdx from "@astrojs/mdx";
// For Latex Integration
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [
    sitemap(),
    robotsTxt(),
    react(),
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
