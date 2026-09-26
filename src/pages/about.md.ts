// Markdown profile, the agent-facing sibling of /about/. See src/utils/agentIndex.ts.
import type { APIRoute } from "astro";
import { aboutMarkdown } from "@/utils/agentIndex";
import { markdownResponse } from "@/utils/agentMarkdown";

export const GET: APIRoute = () => markdownResponse(aboutMarkdown());
