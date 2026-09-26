// Markdown sibling of every published research page. See src/utils/agentMarkdown.ts.
import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection, type CollectionEntry } from "astro:content";
import { markdownResponse, renderPiece } from "@/utils/agentMarkdown";

// Same filter as src/pages/research/[slug].astro: drafts emit no page.
export const getStaticPaths = (async () =>
  (await getCollection("research"))
    .filter((r) => r.data.isPublished)
    .map((entry) => ({ params: { slug: entry.slug }, props: { entry } }))) satisfies GetStaticPaths;

export const GET: APIRoute<{ entry: CollectionEntry<"research"> }> = ({ props }) =>
  markdownResponse(renderPiece({ kind: "research", entry: props.entry }));
