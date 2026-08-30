import { defineCollection, z } from "astro:content";

// Explicit collections (Astro v5 deprecates auto-generation).
const projects = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    publishedAt: z.date(),
    description: z.string(),
    isPublish: z.boolean(),
    isOngoing: z.boolean().default(false),
    thesis: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

// Use loose schema for education JSON data; tighten later as needed.
const education = defineCollection({
  type: "data",
  schema: z.any(),
});

// Blog posts collection (dedicated blog subdomain)
const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string().max(300),
    publishedAt: z.date(),
    updatedAt: z.date().optional(),
    tags: z.array(z.string()).default([]),
    isHidden: z.boolean().default(false),
    readingTimeMinutes: z.number().optional(), // injected at build
    canonical: z.string().url().optional(),
    ogImage: z.string().optional(),
    thesis: z.string().optional(),
    articleNumber: z.number().optional(), // sub-articles: sort order within series
  }),
});

// Research papers collection
const research = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    publishedAt: z.date(),
    description: z.string(),
    authors: z.array(z.string()),
    publication: z.string().optional(),
    doi: z.string().optional(),
    arxiv: z.string().optional(),
    pdfUrl: z.string().url().optional(),
    tags: z.array(z.string()).default([]),
    isPublished: z.boolean().default(true),
    thesis: z.string().optional(),
  }),
});

// Short-form notes: the "flow" half of Show Your Work. A note is a thought, a
// link with a comment, a chart that surprised me — typically under 150 words.
//
// These live here rather than being pulled from X on purpose. The X API removed
// its free read tier in Feb 2026 (reads are now $0.005 each, pay-per-use), and
// a static build cannot call an authenticated API at request time anyway. So the
// repo is the source of truth and X is a mirror: write here, cross-post there.
// Nothing breaks if the API changes terms again, and the writing stays owned.
const notes = defineCollection({
  type: "content",
  schema: z.object({
    publishedAt: z.date(),
    // Optional — most notes are too short to deserve a headline.
    title: z.string().optional(),
    tags: z.array(z.string()).default([]),
    // Where this was also posted, if anywhere.
    crosspost: z.string().url().optional(),
    // A link the note is about.
    via: z.string().url().optional(),
    isHidden: z.boolean().default(false),
  }),
});

export const collections = { projects, education, blog, research, notes };
