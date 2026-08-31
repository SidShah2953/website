import rss from "@astrojs/rss";
import { SITE_URL } from "@/data/config";
import { getFeed, excerpt } from "@/utils/feed";

export async function GET() {
  // The feed now carries both halves: long pieces and short notes. Notes are
  // the half a reader most wants pushed to them, and excluding them meant the
  // feed went quiet for months at a time between essays.
  //
  // getFeed() already drops archived and hidden entries and collapses series
  // sub-articles under a synthesised card, so the feed shows the series once
  // rather than eight times.
  const items = (await getFeed()).flatMap((f) => {
    // a series card is not itself a page worth syndicating; syndicate its parts
    const rows = f.children?.length ? f.children : [f];
    return rows.map((r) => ({
      title: r.title ?? excerpt(r.body, 70),
      description: r.description ?? excerpt(r.body),
      link: r.href,
      pubDate: r.date,
      categories: r.tags,
    }));
  });

  return rss({
    title: "Siddhant Shah",
    description:
      "Essays and notes on finance, digital assets and technology — plus whatever else I end up measuring.",
    site: SITE_URL,
    items,
    customData: "<language>en-us</language>",
  });
}
