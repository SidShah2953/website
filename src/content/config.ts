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
    isDraft: z.boolean().default(false),
    readingTimeMinutes: z.number().optional(), // injected at build
    canonical: z.string().url().optional(),
    ogImage: z.string().optional(),
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
  }),
});

export const collections = { projects, education, blog, research };
