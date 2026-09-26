// Markdown sibling of every listed blog post: /blog/<slug>/ -> /blog/<slug>.md
// See src/utils/agentMarkdown.ts.
import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection, type CollectionEntry } from "astro:content";
import { listedPosts, markdownResponse, renderPiece, seriesOf, slugOf } from "@/utils/agentMarkdown";

export const getStaticPaths = (async () => {
  const posts = await getCollection("blog");
  return listedPosts(posts).map((entry) => ({
    params: { slug: slugOf(entry.id) },
    props: { entry, series: seriesOf(posts, entry) },
  }));
}) satisfies GetStaticPaths;

type Props = { entry: CollectionEntry<"blog">; series: ReturnType<typeof seriesOf> };

export const GET: APIRoute<Props> = ({ props }) =>
  markdownResponse(renderPiece({ kind: "blog", entry: props.entry, series: props.series }));
