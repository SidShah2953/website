/**
 * Plain-Markdown renditions of the site, for AI agents and answer engines.
 *
 * Every piece is also published at `<url-without-trailing-slash>.md`
 * (`/blog/dcf-for-crypto/` -> `/blog/dcf-for-crypto.md`), the convention from
 * llmstxt.org, and linked from its HTML page with
 * `<link rel="alternate" type="text/markdown">`. `/llms.txt` indexes them and
 * `/llms-full.txt` concatenates them. All of it is generated from the content
 * collections at build time, so none of it can drift from the HTML.
 *
 * The source is the MDX body itself, not scraped HTML, so there is no
 * navigation, script or styling noise. The MDX-only parts are rewritten into
 * plain Markdown: imports and JSX comments are dropped, theme markers become
 * their text, and the few site components become links or quotes. Code fences
 * are left untouched (a Python `import` inside one is code, not MDX).
 *
 * Post bodies are never edited; this only changes how they are served.
 */
import type { CollectionEntry } from "astro:content";
import { SITE_URL } from "@/data/config";

export const PERSON_SUMMARY =
  "Siddhant Shah is an Equity Research Associate at Rosenblatt Securities in New York, supporting FinTech and Digital Assets coverage. He came to markets from mathematics and data. He writes at siddhants.com in a personal capacity.";

/** Verbatim from src/components/Disclosure.astro. Do not reword. */
export const DISCLOSURE =
  "The views expressed here are my own personal opinions. This is **not investment advice** and should not be relied upon as such. Nothing here is connected to, endorsed by, or written on behalf of Rosenblatt Securities.";

/** Verbatim from the `exercise` variant of src/components/Disclosure.astro. */
export const EXERCISE_NOTICE =
  "This is a **demonstrative modelling exercise**, written to show a method: how the numbers are built, which assumptions carry the answer, and where the disclosure gaps are. It is **not a price target, not a recommendation, and not a view on the security**. Any valuation range shown is an output of the stated assumptions, not a judgement about what the shares are worth.";

export type Kind = "blog" | "projects" | "research";
type AnyEntry =
  | CollectionEntry<"blog">
  | CollectionEntry<"projects">
  | CollectionEntry<"research">;

export const slugOf = (id: string) => id.replace(/\.(md|mdx)$/, "").toLowerCase();

// Blog routes slug by lowercased id (it keeps the series folder); projects and
// research route by Astro's entry.slug. Mirror each route exactly.
const routeSlug = (kind: Kind, e: { id: string; slug: string }) =>
  kind === "blog" ? slugOf(e.id) : e.slug;

/** The HTML page's path, e.g. `/blog/dcf-for-crypto/`. */
export const htmlPath = (kind: Kind, e: { id: string; slug: string }) => `/${kind}/${routeSlug(kind, e)}/`;
/** The Markdown sibling, e.g. `/blog/dcf-for-crypto.md`. */
export const mdPath = (kind: Kind, e: { id: string; slug: string }) => `/${kind}/${routeSlug(kind, e)}.md`;

// Root-relative hrefs become absolute. Page links get the trailing slash the
// canonical URLs use, so a quoted link does not land on a redirect.
const abs = (href: string) => {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const [path, rest = ""] = href.split(/(?=[#?])/);
  const last = path.split("/").pop() ?? "";
  const withSlash = path.endsWith("/") || last.includes(".") ? path : `${path}/`;
  return encodeURI(`${SITE_URL}${decodeURI(withSlash)}`) + rest;
};

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Read a string attribute (`name="..."` or `name='...'`) from a JSX tag. */
const attr = (tag: string, name: string) =>
  tag.match(new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)')`))?.slice(1).find((v) => v != null);

/** Strip the indentation every non-blank line shares (JSX children are often indented). */
const dedent = (s: string) => {
  const lines = s.replace(/^\n+|\s+$/g, "").split("\n");
  const pad = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^[ \t]*/)![0].length));
  return lines.map((l) => l.slice(Number.isFinite(pad) ? pad : 0)).join("\n");
};

/** Rewrite the MDX-only parts of a body into plain Markdown. */
export function mdxToMarkdown(body: string): string {
  // Split on fenced code blocks so nothing inside them is touched.
  const parts = body.split(/(^(?:```|~~~)[^\n]*\n[\s\S]*?^(?:```|~~~)[ \t]*$)/m);
  const out = parts.map((chunk, i) => {
    if (i % 2 === 1) return chunk; // a code fence
    let s = chunk;
    // JSX comments, possibly multi-line, and HTML comments
    s = s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    s = s.replace(/<!--[\s\S]*?-->/g, "");
    // ESM lines
    s = s.replace(/^(?:import|export)\s.*$/gm, "");
    // theme markers: keep the words, drop the tag
    s = s.replace(/<T\b[^>]*>([\s\S]*?)<\/T>/g, "$1");
    // deep-dive cards
    s = s.replace(/<ArticleLink\b[\s\S]*?\/>/g, (t) => {
      const href = attr(t, "href"), title = attr(t, "title");
      return href && title ? `Deep dive: [${title}](${abs(href)})` : "";
    });
    // downloads
    s = s.replace(/<ModelDownload\b[\s\S]*?\/>/g, (t) => {
      const href = attr(t, "href"), file = attr(t, "filename") ?? href;
      return href ? `Download: [${file}](${abs(href)})` : "";
    });
    s = s.replace(/<ExcelEmbed\b[\s\S]*?\/>/g, (t) => {
      const src = attr(t, "src"), file = attr(t, "filename") ?? src;
      return src ? `Spreadsheet: [${file}](${abs(src)})` : "";
    });
    // figures: the image is a build asset, so describe it rather than link a hash
    s = s.replace(/<(?:ImageWithCaption|Image)\b[\s\S]*?\/>/g, (t) => {
      const text = attr(t, "caption") ?? attr(t, "alt");
      return text ? `*[Figure: ${text.replace(/\s*\n\s*/g, " ").trim()}]*` : "";
    });
    // call-outs become block quotes
    s = s.replace(/<CallOutForMDX\b([^>]*)>([\s\S]*?)<\/CallOutForMDX>/g, (_m, a: string, inner: string) => {
      const title = attr(a, "title");
      const lines = dedent(inner).split("\n").map((l) => (l.trim() ? `> ${l}` : ">"));
      return (title ? [`> **${title}**`, ">", ...lines] : lines).join("\n");
    });
    // root-relative Markdown links become absolute, so they survive being quoted
    s = s.replace(/\]\((\/[^)\s]*)\)/g, (_m, h: string) => `](${abs(h)})`);
    return s;
  });
  return out.join("").replace(/\n{3,}/g, "\n\n").trim();
}

export type RenderOpts = {
  kind: Kind;
  entry: AnyEntry;
  /** Series display name and position, for parts of a series. */
  series?: { name: string; part?: number; of?: number; homeUrl?: string };
};

/** One piece as a standalone Markdown document. */
export function renderPiece({ kind, entry, series }: RenderOpts): string {
  const d = entry.data as Record<string, any>;
  const url = `${SITE_URL}${htmlPath(kind, entry)}`;
  const authors: string[] = kind === "research" ? d.authors : ["Siddhant Shah"];
  const meta = [
    `- Author: ${authors.join(", ")}`,
    `- Published: ${ymd(d.publishedAt)}`,
    ...(d.updatedAt ? [`- Updated: ${ymd(d.updatedAt)}`] : []),
    `- Canonical URL: ${url}`,
    ...(series
      ? [`- Series: ${series.name}${series.part && series.of ? `, part ${series.part} of ${series.of}` : ""}${series.homeUrl ? ` (${series.homeUrl})` : ""}`]
      : []),
    ...(d.publication ? [`- Published in: ${d.publication}`] : []),
    ...(d.doi ? [`- DOI: https://doi.org/${String(d.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//, "")}`] : []),
    ...(d.arxiv ? [`- arXiv: ${d.arxiv}`] : []),
    ...(d.pdfUrl ? [`- PDF: ${d.pdfUrl}`] : []),
  ];

  const blocks = [
    `# ${d.title}`,
    `> ${String(d.description).trim().replace(/\n+/g, " ")}`,
    meta.join("\n"),
    ...(d.demonstrative ? [`## Illustrative exercise\n\n${EXERCISE_NOTICE}`] : []),
    ...(d.thesis ? [`## Thesis\n\n${String(d.thesis).trim()}`] : []),
    mdxToMarkdown(entry.body),
    `## Disclosure\n\n${DISCLOSURE}`,
    `---\n\nSource: ${url}\nAbout the author: ${SITE_URL}/about.md\nSite index for agents: ${SITE_URL}/llms.txt`,
  ];
  return blocks.join("\n\n") + "\n";
}

type Blog = CollectionEntry<"blog">;

/** Series membership, derived the same way as src/pages/blog/[...slug].astro. */
export function seriesOf(posts: Blog[], entry: Blog): RenderOpts["series"] {
  const name = entry.data.series;
  if (!name) return undefined;
  const parts = posts.filter((p) => p.data.series === name && p.data.articleNumber != null);
  const home = posts.find((p) => p.data.series === name && p.data.articleNumber == null);
  const isPart = entry.data.articleNumber != null;
  return {
    name,
    part: isPart ? entry.data.articleNumber : undefined,
    of: isPart ? parts.length : undefined,
    homeUrl: isPart && home ? `${SITE_URL}${htmlPath("blog", home)}` : undefined,
  };
}

/** Blog posts that get a public rendition: hidden posts are unlisted, so never. */
export const listedPosts = (posts: Blog[]) => posts.filter((p) => !p.data.isHidden);

export const markdownResponse = (body: string) =>
  new Response(body, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
