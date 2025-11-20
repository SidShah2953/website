import { defineCollection, z } from "astro:content";

// Explicit collections (Astro v5 deprecates auto-generation).
const posts = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    publishedAt: z.date(),
    description: z.string(),
    isPublish: z.boolean(),
    isDraft: z.boolean().default(false),
  }),
});

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

export const collections = { posts, projects, education };
