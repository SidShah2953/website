/**
 * Builds the theme index by reading the inline <T k="..."> markers out of raw
 * MDX bodies at build time. Occurrence counts are therefore real usage — how
 * often an idea is actually invoked — not a frontmatter declaration.
 */
import { THEMES, AREAS, type AreaId } from "@/data/themes";
import { isArchived } from "@/utils/archive";

const TAG = /<T\s+k=["']([a-z0-9-]+)["'][^>]*>/g;

export type Entry = { body: string; data: { tags?: string[]; themes?: string[] } };

/** Slug -> occurrence count, for one body. */
export function countThemes(body: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of body.matchAll(TAG)) {
    out.set(m[1], (out.get(m[1]) ?? 0) + 1);
  }
  return out;
}

/**
 * Everything a piece is about: inline <T> markers plus themes declared in
 * frontmatter. Notes are too short to mark up inline, and some longer pieces are
 * about a theme whose word never appears in the prose, so a marker has nothing
 * to attach to. A declared theme counts once; an inline marker counts per use.
 */
export function themesFor(entry: Entry): Map<string, number> {
  const out = countThemes(entry.body);
  for (const slug of entry.data.themes ?? []) {
    if (!THEMES[slug]) {
      throw new Error(
        `Unknown theme "${slug}" in frontmatter. ` +
        `Add it to src/data/themes.ts or fix the slug. ` +
        `Known: ${Object.keys(THEMES).join(", ")}`,
      );
    }
    if (!out.has(slug)) out.set(slug, 1);
  }
  return out;
}

export type ThemeStat = {
  slug: string;
  label: string;
  area: AreaId;
  count: number;             // total inline occurrences
  pieces: number;            // how many pieces use it
  /** Area blend, weighted by the areas of the pieces that carry it. */
  blend: Record<AreaId, number>;
  rgb: [number, number, number];
};

/**
 * @param entries  content entries, each with `body` and an `areas` weighting
 *                 describing what that piece is about.
 */
export function buildIndex<T extends Entry>(
  entries: Array<{ entry: T; areas: Partial<Record<AreaId, number>> }>,
): ThemeStat[] {
  const acc = new Map<string, { count: number; pieces: number; blend: Record<AreaId, number> }>();

  for (const { entry, areas } of entries) {
    if (isArchived(entry)) continue;                 // archived pieces leave the map
    for (const [slug, n] of themesFor(entry)) {
      if (!THEMES[slug]) continue;                   // T.astro already threw; belt and braces
      const cur = acc.get(slug) ?? { count: 0, pieces: 0, blend: { fin: 0, da: 0, tech: 0, side: 0 } };
      cur.count += n;
      cur.pieces += 1;
      for (const [a, w] of Object.entries(areas)) {
        cur.blend[a as AreaId] += n * (w ?? 0);
      }
      acc.set(slug, cur);
    }
  }

  return [...acc.entries()]
    .map(([slug, v]) => {
      const total = Object.values(v.blend).reduce((a, b) => a + b, 0) || 1;
      const blend = Object.fromEntries(
        Object.entries(v.blend).map(([a, w]) => [a, w / total]),
      ) as Record<AreaId, number>;
      let r = 0, g = 0, b = 0;
      for (const a of Object.keys(AREAS) as AreaId[]) {
        const [ar, ag, ab] = AREAS[a].rgb;
        r += ar * blend[a]; g += ag * blend[a]; b += ab * blend[a];
      }
      return {
        slug, label: THEMES[slug].label, area: THEMES[slug].area,
        count: v.count, pieces: v.pieces, blend,
        rgb: [Math.round(r), Math.round(g), Math.round(b)] as [number, number, number],
      };
    })
    .sort((a, b) => b.count - a.count);
}
