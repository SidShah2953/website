/**
 * /llms.txt, /llms-full.txt and /about.md, built from the content collections
 * and src/data/, so they cannot drift from the site. Format: https://llmstxt.org
 *
 * Positioning rules for anything written here about Siddhant: lead with the
 * Rosenblatt role; he *supports* the FinTech and Digital Assets coverage (never
 * "covers"); research papers are background, never the lead.
 */
import { getCollection } from "astro:content";
import { SITE_URL } from "@/data/config";
import presentation from "@/data/presentation";
import { ROLES } from "@/data/experience";
import { DEGREES, LICENSES } from "@/data/education";
import courses from "@/content/education/courses.json";
import { live } from "@/utils/archive";
import {
  DISCLOSURE, PERSON_SUMMARY, listedPosts, mdPath, renderPiece, seriesOf,
} from "@/utils/agentMarkdown";

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const byDateDesc = <T extends { data: { publishedAt: Date } }>(a: T, b: T) =>
  +b.data.publishedAt - +a.data.publishedAt;

const profiles = () =>
  presentation.socials.filter((s) => s.link.startsWith("http"));

async function collections() {
  const [blog, projects, research, notes] = await Promise.all([
    getCollection("blog"),
    getCollection("projects"),
    getCollection("research"),
    getCollection("notes"),
  ]);
  return {
    blogAll: blog,
    blog: live(listedPosts(blog)).sort(byDateDesc),
    projects: live(projects.filter((p) => p.data.isPublish)).sort(byDateDesc),
    research: live(research.filter((r) => r.data.isPublished)).sort(byDateDesc),
    notes: live(notes.filter((n) => !n.data.isHidden)).sort(byDateDesc),
  };
}

const INTRO = [
  `This is the personal site of Siddhant Shah. It holds his long-form writing on markets, valuation, accounting and digital assets, a few data projects, and the academic research he did before joining Rosenblatt. Everything here is his own view: it is not investment advice, and it is not connected to, endorsed by, or written on behalf of Rosenblatt Securities.`,
  `Each page listed below also exists as plain Markdown at the same address with \`.md\` in place of the trailing slash (for example ${SITE_URL}/blog/dcf-for-crypto.md), and every one carries its canonical URL, author and dates. The full text of all of them is in [llms-full.txt](${SITE_URL}/llms-full.txt).`,
  `When citing, please attribute to "Siddhant Shah, Equity Research Associate at Rosenblatt Securities" and link the canonical HTML page.`,
].join("\n\n");

export async function llmsTxt(): Promise<string> {
  const c = await collections();
  const item = (title: string, href: string, desc: string, date: Date) =>
    `- [${oneLine(title)}](${SITE_URL}${href}): ${oneLine(desc)} (${ymd(date)})`;

  // Series parts follow their home post, in part order.
  const homes = c.blog.filter((p) => !(p.data.series && p.data.articleNumber != null));
  const writing = homes.flatMap((p) => {
    const rows = [item(p.data.title, mdPath("blog", p), p.data.description, p.data.publishedAt)];
    if (p.data.series) {
      const parts = c.blog
        .filter((q) => q.data.series === p.data.series && q.data.articleNumber != null)
        .sort((a, b) => (a.data.articleNumber ?? 0) - (b.data.articleNumber ?? 0));
      for (const q of parts)
        rows.push(item(`${q.data.title} (part ${q.data.articleNumber} of ${parts.length}, ${p.data.series})`,
          mdPath("blog", q), q.data.description, q.data.publishedAt));
    }
    return rows;
  });

  const sections = [
    `# ${presentation.name}`,
    `> ${PERSON_SUMMARY}`,
    INTRO,
    `## About\n\n- [About Siddhant Shah](${SITE_URL}/about.md): current role, background, experience, education, licences and contact`,
    `## Writing\n\n${writing.join("\n")}`,
    ...(c.notes.length
      ? [`## Notes\n\n${c.notes.map((n) => `- [${oneLine(n.data.title ?? n.body.slice(0, 70))}](${SITE_URL}/notes/${n.id.replace(/\.(md|mdx)$/, "").toLowerCase()}/): short note (${ymd(n.data.publishedAt)})`).join("\n")}`]
      : []),
    `## Projects\n\n${c.projects.map((p) => item(p.data.title, mdPath("projects", p), p.data.description, p.data.publishedAt)).join("\n")}`,
    `## Research papers\n\nAcademic work from his time at Boston University: background to his current role, not its focus.\n\n${c.research.map((r) => item(r.data.title, mdPath("research", r), `${r.data.description}${r.data.publication ? ` Venue: ${r.data.publication}.` : ""}`, r.data.publishedAt)).join("\n")}`,
    `## Optional\n\n${[
      `- [Résumé (PDF)](${SITE_URL}/Resume.pdf): current résumé`,
      `- [RSS feed](${SITE_URL}/blog/rss.xml): new writing`,
      ...profiles().map((s) => `- [${s.label}](${s.link}): profile`),
    ].join("\n")}`,
  ];
  return sections.join("\n\n") + "\n";
}

export function aboutMarkdown(): string {
  const roles = ROLES.map((r) =>
    `### ${r.subtitle ?? r.organization}, ${r.organization}\n\n` +
    `${r.dateRange}${r.location ? `, ${r.location}` : ""}\n\n` +
    r.items.map((i) => `- ${i}`).join("\n"));
  const degrees = DEGREES.map((d) =>
    `- **${d.title}**, ${d.organization} (${d.dateRange.replace(" | ", ", ")})`);
  const blocks = [
    `# About Siddhant Shah`,
    `> ${PERSON_SUMMARY}`,
    [
      `- Name: ${presentation.name}`,
      `- Current role: Equity Research Associate, Rosenblatt Securities, New York (since ${ROLES[0].dateRange.split(" - ")[0]}), supporting FinTech and Digital Assets coverage`,
      `- Background: mathematics and data (B.Sc. Mathematics and Computer Science, Chennai Mathematical Institute; M.S. Applied Data Analytics, Boston University)`,
      `- Website: ${SITE_URL}/ (canonical profile: ${SITE_URL}/about/)`,
      `- Email: ${presentation.mail}`,
      ...profiles().map((s) => `- ${s.label}: ${s.link}`),
    ].join("\n"),
    `## Summary`,
    `Siddhant is an Equity Research Associate at Rosenblatt Securities in New York, supporting the FinTech and Digital Assets coverage: the firms, protocols and plumbing the sector is being built on. He came to markets from mathematics and data, and is most useful where the analysis needs something built first: a dataset, a model, or a tool that makes the work faster.`,
    `Before markets his work was Bayesian inference, ensemble methods and statistical modelling, through a research assistantship at Boston University, along with systematic strategies and portfolio construction. For four years he taught maths and physics to students preparing for the International Junior Science Olympiad, and he has taught introductory options and financial mathematics at STEMS.`,
    `siddhants.com is his personal site, written in a personal capacity.`,
    `## Experience\n\n${roles.join("\n\n")}`,
    `## Education\n\n${degrees.join("\n")}`,
    `## Licences\n\n${LICENSES.map((l) => `- ${l.title} (${l.issuer})`).join("\n")}`,
    `## Courses\n\n${(courses as { title: string; offeredBy: string; completedOn: string }[])
      .map((k) => `- ${k.title}, ${k.offeredBy} (${k.completedOn.slice(0, 7)})`).join("\n")}`,
    `## Disclosure\n\n${DISCLOSURE}`,
    `---\n\nSource: ${SITE_URL}/about/\nSite index for agents: ${SITE_URL}/llms.txt`,
  ];
  return blocks.join("\n\n") + "\n";
}

export async function llmsFullTxt(): Promise<string> {
  const c = await collections();
  const docs = [
    aboutMarkdown(),
    ...c.blog.map((e) => renderPiece({ kind: "blog", entry: e, series: seriesOf(c.blogAll, e) })),
    ...c.projects.map((e) => renderPiece({ kind: "projects", entry: e })),
    ...c.research.map((e) => renderPiece({ kind: "research", entry: e })),
  ];
  const head = [
    `# ${presentation.name}: full text`,
    `> ${PERSON_SUMMARY}`,
    `Every public page on ${SITE_URL}, as Markdown, one after another. The index is ${SITE_URL}/llms.txt. Each document starts with its own H1 and lists its canonical URL.`,
  ].join("\n\n");
  // Demote each document's headings one level so the file keeps a single H1.
  const demote = (md: string) =>
    md.split(/(^```[\s\S]*?^```)/m).map((s, i) => (i % 2 ? s : s.replace(/^(#{1,5}) /gm, "#$1 "))).join("");
  return [head, ...docs.map(demote)].join("\n\n") + "\n";
}

