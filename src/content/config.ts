import { defineCollection, z } from "astro:content";

const postsCollection = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    publishedAt: z.date(),
    description: z.string(),
    isPublish: z.boolean(),
    isDraft: z.boolean().default(false)
  }),
});

const projectsCollection = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    publishedAt: z.date(),
    description: z.string(),
    isPublish: z.boolean(),
    isOngoing: z.boolean().default(false)
  }),
});

const coursesCollection = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    completedOn: z.date(),
    offeredBy: z.string(),
    description: z.string()
  }),
});

export const collections = { posts: postsCollection, projects: projectsCollection, education:coursesCollection};
