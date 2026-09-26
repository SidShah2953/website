// Markdown sibling of every project page. See src/utils/agentMarkdown.ts.
import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection, type CollectionEntry } from "astro:content";
import { markdownResponse, renderPiece } from "@/utils/agentMarkdown";

// Same set as src/pages/projects/[slug].astro, which emits every project.
export const getStaticPaths = (async () =>
  (await getCollection("projects")).map((entry) => ({
    params: { slug: entry.slug },
    props: { entry },
  }))) satisfies GetStaticPaths;

export const GET: APIRoute<{ entry: CollectionEntry<"projects"> }> = ({ props }) =>
  markdownResponse(renderPiece({ kind: "projects", entry: props.entry }));
