/** Every piece across the three collections, with its slug and area weights. */
import { getCollection } from "astro:content";
import { areasFor } from "@/data/pieceAreas";
import { live } from "@/utils/archive";

export const slugOf = (id: string) =>
  id.replace(/\.(md|mdx)$/, "").split("/").pop()!.toLowerCase();

export async function allPieces() {
  const [blog, projects, research] = await Promise.all([
    getCollection("blog"),
    getCollection("projects"),
    getCollection("research"),
  ]);
  const rows = [
    ...blog.map((e) => ({ e, kind: "blog" as const })),
    ...projects.map((e) => ({ e, kind: "projects" as const })),
    ...research.map((e) => ({ e, kind: "research" as const })),
  ];
  return live(rows.map((r) => r.e)).map((e) => {
    const kind = rows.find((r) => r.e === e)!.kind;
    const slug = slugOf(e.id);
    return { entry: e, kind, slug, areas: areasFor(slug) };
  });
}
