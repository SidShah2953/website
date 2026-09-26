// Every public page as Markdown in one file. See src/utils/agentIndex.ts.
import type { APIRoute } from "astro";
import { llmsFullTxt } from "@/utils/agentIndex";

export const GET: APIRoute = async () =>
  new Response(await llmsFullTxt(), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
