// The llms.txt index (https://llmstxt.org). Built from the collections; see
// src/utils/agentIndex.ts.
import type { APIRoute } from "astro";
import { llmsTxt } from "@/utils/agentIndex";

export const GET: APIRoute = async () =>
  new Response(await llmsTxt(), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
