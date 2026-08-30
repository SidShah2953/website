/**
 * The unified feed: long pieces (stock) and short notes (flow) in one stream.
 * Kleon's split, made literal — the blog was only ever the first half, which is
 * why it went quiet between finished essays.
 */
import { getCollection } from "astro:content";
import { live } from "@/utils/archive";

export type FeedItem = {
  kind: "post" | "note";
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

  const p: FeedItem[] = live(posts)
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
    }));

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
