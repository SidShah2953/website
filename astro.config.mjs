import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import robotsTxt from "astro-robots-txt";
import { SITE_URL } from "./src/data/config";
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

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

// ---------------------------------------------------------------------------
// robots.txt policy for search engines and AI crawlers.
//
// Goal: be citable. Search engines, answer engines and user-triggered agents
// may read everything public. /private/ stays out for everyone.
//
// ONE SWITCH for model training. true = training crawlers may collect the site
// (Content-Signal ai-train=yes). false = ai-train=no AND the training-only
// crawlers below are disallowed outright. Flipping it never affects search or
// answer engines: every vendor listed here runs training under a separate
// user agent from its search and user-fetch agents.
//   Note: Google-Extended also governs grounding in the Gemini app (not Google
//   Search or AI Overviews), and Applebot-Extended governs Apple Intelligence.
const ALLOW_AI_TRAINING = true;

// Search indexes and live, user-requested fetches that answer engines cite from.
const ANSWER_AGENTS = [
  "OAI-SearchBot", "ChatGPT-User",                   // OpenAI: ChatGPT search, user fetch
  "Claude-SearchBot", "Claude-User",                 // Anthropic: search index, user fetch
  "PerplexityBot", "Perplexity-User",                // Perplexity
  "Applebot",                                        // Apple: Siri and Spotlight search
  "DuckAssistBot",                                   // DuckDuckGo answers
  "MistralAI-User",                                  // Mistral Le Chat user fetch
  "Meta-ExternalFetcher",                            // Meta AI user fetch
];
// Crawlers (or robots.txt tokens) used only to collect model training data.
const TRAINING_AGENTS = [
  "GPTBot", "ClaudeBot", "Google-Extended", "Applebot-Extended",
  "CCBot", "meta-externalagent",
];
const PRIVATE = ["/private/"];
// Content Signals Policy (contentsignals.org): search / ai-input / ai-train.
const CONTENT_SIGNAL = `search=yes, ai-input=yes, ai-train=${ALLOW_AI_TRAINING ? "yes" : "no"}`;

const robotsPolicy = [
  { userAgent: "*", allow: "/", disallow: PRIVATE },
  ...ANSWER_AGENTS.map((userAgent) => ({ userAgent, allow: "/", disallow: PRIVATE })),
  ...TRAINING_AGENTS.map((userAgent) =>
    ALLOW_AI_TRAINING
      ? { userAgent, allow: "/", disallow: PRIVATE }
      : { userAgent, disallow: "/" }),
];

// The policy text Cloudflare publishes with Content Signals, reproduced so the
// signal lines carry their definitions. Kept verbatim.
const CONTENT_SIGNALS_POLICY = `# As a condition of accessing this website, you agree to abide by the following content signals:
#
# (a)  If a content-signal = yes, you may collect content for the corresponding use.
# (b)  If a content-signal = no, you may not collect content for the corresponding use.
# (c)  If the website operator does not include a content signal for a corresponding use, the website operator neither grants nor restricts permission via content signal with respect to the corresponding use.
#
# The content signals and their meanings are:
#
# search: building a search index and providing search results (e.g., returning hyperlinks and short excerpts from your website's contents).  Search does not include providing AI-generated search summaries.
# ai-input: inputting content into one or more AI models (e.g., retrieval augmented generation, grounding, or other real-time taking of content for generative AI search answers).
# ai-train: training or fine-tuning AI models.
#
# ANY RESTRICTIONS EXPRESSED VIA CONTENT SIGNALS ARE EXPRESS RESERVATIONS OF RIGHTS UNDER ARTICLE 4 OF THE EUROPEAN UNION DIRECTIVE 2019/790 ON COPYRIGHT AND RELATED RIGHTS IN THE DIGITAL SINGLE MARKET.`;

// Adds the policy header and a Content-Signal line to every group.
const robotsTransform = (content) =>
  [
    "# siddhants.com: personal site of Siddhant Shah.",
    "# Search engines, answer engines and AI agents are welcome to read and cite it.",
    `# Plain-Markdown index for AI agents: ${SITE_URL}/llms.txt`,
    "#",
    CONTENT_SIGNALS_POLICY,
    "",
    content.replace(/^(User-agent: .+)$/gm, `$1\nContent-Signal: ${CONTENT_SIGNAL}`),
  ].join("\n");

// Cloudflare Pages headers for the agent-facing Markdown files, written into
// dist/_headers after the build. Each /x.md gets an explicit text/markdown
// type and a canonical Link to its HTML page, so a search engine that finds the
// .md credits the HTML URL instead of indexing a duplicate. One rule per file
// because Pages splats are only documented as whole-path wildcards; Pages
// allows 100 rules, so the build warns well before that.
const agentHeaders = () => ({
  name: "agent-markdown-headers",
  hooks: {
    "astro:build:done": ({ dir, logger }) => {
      const root = fileURLToPath(dir);
      const out = [];
      const walk = (d) => {
        for (const e of readdirSync(d, { withFileTypes: true })) {
          const p = join(d, e.name);
          if (e.isDirectory()) walk(p);
          else if (e.name.endsWith(".md")) out.push("/" + relative(root, p).split(sep).join("/"));
        }
      };
      walk(root);
      const rules = out.sort().map((path) => {
        const html = `${SITE_URL}${path.replace(/\.md$/, "/")}`;
        return `${encodeURI(path)}\n  Content-Type: text/markdown; charset=utf-8\n  Link: <${encodeURI(html)}>; rel="canonical"`;
      });
      rules.push("/llms.txt\n  Content-Type: text/plain; charset=utf-8");
      rules.push("/llms-full.txt\n  Content-Type: text/plain; charset=utf-8");
      if (existsSync(join(root, "_headers")))
        throw new Error("dist/_headers already exists (public/_headers?); merge it into agentHeaders() in astro.config.mjs");
      if (rules.length > 90)
        logger.warn(`${rules.length} _headers rules; Cloudflare Pages allows 100. Switch the .md rules to a splat.`);
      writeFileSync(join(root, "_headers"), rules.join("\n\n") + "\n");
      logger.info(`wrote _headers with ${rules.length} rules`);
    },
  },
});

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
    // The COIN series was renamed 202602 -> 202603. Both the series home and
    // all eight parts were live and indexed under the old slug, so every one
    // needs a redirect, not just the home.
    '/blog/coin-research-202602': '/blog/coin-research-202603/',
    '/posts/coin-research-202602': '/blog/coin-research-202603/',
    '/blog/coin-research-202602/asc350-gaap-loss': '/blog/coin-research-202603/asc350-gaap-loss/',
    '/posts/coin-research-202602/asc350-gaap-loss': '/blog/coin-research-202603/asc350-gaap-loss/',
    '/blog/coin-research-202602/base-chain': '/blog/coin-research-202603/base-chain/',
    '/posts/coin-research-202602/base-chain': '/blog/coin-research-202603/base-chain/',
    '/blog/coin-research-202602/coinbase-one': '/blog/coin-research-202603/coinbase-one/',
    '/posts/coin-research-202602/coinbase-one': '/blog/coin-research-202603/coinbase-one/',
    '/blog/coin-research-202602/deribit': '/blog/coin-research-202603/deribit/',
    '/posts/coin-research-202602/deribit': '/blog/coin-research-202603/deribit/',
    '/blog/coin-research-202602/developer-platform': '/blog/coin-research-202603/developer-platform/',
    '/posts/coin-research-202602/developer-platform': '/blog/coin-research-202603/developer-platform/',
    '/blog/coin-research-202602/eth-staking': '/blog/coin-research-202603/eth-staking/',
    '/posts/coin-research-202602/eth-staking': '/blog/coin-research-202603/eth-staking/',
    '/blog/coin-research-202602/model-walkthrough': '/blog/coin-research-202603/model-walkthrough/',
    '/posts/coin-research-202602/model-walkthrough': '/blog/coin-research-202603/model-walkthrough/',
    '/blog/coin-research-202602/usdc-stablecoin': '/blog/coin-research-202603/usdc-stablecoin/',
    '/posts/coin-research-202602/usdc-stablecoin': '/blog/coin-research-202603/usdc-stablecoin/',
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
    robotsTxt({ policy: robotsPolicy, transform: robotsTransform }),
    agentHeaders(),
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