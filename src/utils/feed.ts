/**
 * The unified feed: long pieces (stock) and short notes (flow) in one stream.
 * Kleon's split, made literal — the blog was only ever the first half, which is
 * why it went quiet between finished essays.
 */
import { getCollection } from "astro:content";
import { live } from "@/utils/archive";

export type FeedItem = {
  kind: "post" | "note";
  /** Parts of a series. Present only on a synthesised series card. */
  children?: FeedItem[];
  articleNumber?: number;
  seriesName?: string;
  slug: string;
  href: string;
  title?: string;
  description?: string;
  body: string;
  date: Date;
  tags: string[];
  words: number;
  /** Themes declared in frontmatter, merged with any inline markers downstream. */
  themes?: string[];
  crosspost?: string;
  via?: string;
};

const slugOf = (id: string) => id.replace(/\.(md|mdx)$/, "").toLowerCase();

export async function getFeed(): Promise<FeedItem[]> {
  const [posts, notes] = await Promise.all([
    getCollection("blog"),
    getCollection("notes"),
  ]);

  const all: FeedItem[] = live(posts)
    .filter((e) => !e.data.isHidden)
    .map((e) => ({
      kind: "post",
      slug: slugOf(e.id),
      href: `/blog/${slugOf(e.id)}/`,
      title: e.data.title,
      description: e.data.description,
      body: e.body,
      date: e.data.publishedAt,
      tags: e.data.tags ?? [],
      words: e.body.split(/\s+/).length,
      articleNumber: e.data.articleNumber,
      seriesName: e.data.series,
      themes: e.data.themes ?? [],
    }));

  // Collapse a series into a single row. Parts are identified by the shared
  // `series` field rather than the folder, because the folder and the home post
  // can disagree — here the home is COIN-Research-202603.mdx while its parts sit
  // in COIN-Research-202602/. Folder-based grouping produced two rows for one
  // series: a synthesised card plus the home post listed on its own.
  const p: FeedItem[] = [];
  const partsOf = new Map<string, FeedItem[]>();
  for (const item of all) {
    if (item.seriesName && item.articleNumber != null) {
      (partsOf.get(item.seriesName) ?? partsOf.set(item.seriesName, []).get(item.seriesName)!).push(item);
    }
  }

  const claimed = new Set<string>();
  for (const item of all) {
    if (item.seriesName && item.articleNumber != null) continue;   // a part, never top level
    const name = item.seriesName;
    const parts = name ? partsOf.get(name) : undefined;
    if (name && parts?.length) {
      // this is the series home: hang the parts off it
      item.children = [...parts].sort((a, b) => (a.articleNumber ?? 0) - (b.articleNumber ?? 0));
      item.date = new Date(Math.max(+item.date, ...parts.map((c) => +c.date)));
      claimed.add(name);
    }
    p.push(item);
  }

  // a series with parts but no home post still gets one synthesised card
  for (const [name, parts] of partsOf) {
    if (claimed.has(name)) continue;
    const sorted = [...parts].sort((a, b) => (a.articleNumber ?? 0) - (b.articleNumber ?? 0));
    p.push({
      kind: "post", slug: name.toLowerCase().replace(/\W+/g, "-"),
      href: sorted[0].href, body: "", tags: [], title: name,
      words: sorted.reduce((n, c) => n + c.words, 0),
      date: new Date(Math.max(...sorted.map((c) => +c.date))),
      children: sorted,
    });
  }

  const n: FeedItem[] = live(notes)
    .filter((e) => !e.data.isHidden)
    .map((e) => ({
      kind: "note",
      slug: slugOf(e.id),
      href: `/notes/${slugOf(e.id)}/`,
      title: e.data.title,
      body: e.body,
      date: e.data.publishedAt,
      tags: e.data.tags ?? [],
      words: e.body.split(/\s+/).length,
      themes: e.data.themes ?? [],
      crosspost: e.data.crosspost,
      via: e.data.via,
    }));

  return [...p, ...n].sort((a, b) => +b.date - +a.date);
}

export const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export const readingMinutes = (words: number) => Math.max(1, Math.round(words / 220));

/**
 * A clean meta description from raw MDX body text. Slicing the body directly
 * leaks newlines, markdown syntax and mid-word truncation into <meta> and
 * og:description, which is what the notes route was doing.
 */
export function excerpt(md: string, max = 155): string {
  const flat = md
    .replace(/^---[\s\S]*?---/, "")          // frontmatter
    .replace(/```[\s\S]*?```/g, " ")          // fenced code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")    // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")  // links -> text
    .replace(/<[^>]+>/g, " ")                  // html / jsx
    .replace(/[*_`#>]/g, "")                   // markdown marks
    .replace(/\s+/g, " ")
    .trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.]$/, "") + "…";
}

/** First sentence, for notes with no title of their own. */
export const firstSentence = (md: string, max = 70): string => {
  const e = excerpt(md, 300);
  const stop = e.search(/[.!?](\s|$)/);
  const s = stop > 0 ? e.slice(0, stop + 1) : e;
  return s.length <= max ? s : s.slice(0, max).replace(/\s\S*$/, "") + "…";
};
