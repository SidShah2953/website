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
    }));

  // A sub-article's slug is "folder/child". Collapse each folder into a single
  // series card so a nine-part run occupies one row instead of nine.
  //
  // There is no "series home" post to hang them on — the folder has no parent
  // file — so the card is synthesised from the folder itself and titled by the
  // `series` field the parts share.
  const p: FeedItem[] = [];
  const groups = new Map<string, FeedItem>();
  for (const item of all) {
    const cut = item.slug.indexOf("/");
    if (cut < 0) { p.push(item); continue; }
    const key = item.slug.slice(0, cut);
    let g = groups.get(key);
    if (!g) {
      g = {
        kind: "post", slug: key, href: "", body: "", words: 0, tags: [],
        date: item.date, children: [],
        title: item.seriesName ?? key.replace(/-/g, " "),
      };
      groups.set(key, g);
      p.push(g);
    }
    g.children!.push(item);
    if (item.seriesName) g.title = item.seriesName;
  }
  for (const g of groups.values()) {
    g.children!.sort((a, b) => (a.articleNumber ?? 0) - (b.articleNumber ?? 0));
    g.date = new Date(Math.max(...g.children!.map((c) => +c.date)));   // as recent as its newest part
    g.href = g.children![0].href;                                      // the card opens part one
    g.words = g.children!.reduce((n, c) => n + c.words, 0);
    g.description = `${g.children!.length} parts · ${g.children!.reduce((n, c) => n + c.words, 0).toLocaleString()} words`;
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
      crosspost: e.data.crosspost,
      via: e.data.via,
    }));

  return [...p, ...n].sort((a, b) => +b.date - +a.date);
}

export const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export const readingMinutes = (words: number) => Math.max(1, Math.round(words / 220));
