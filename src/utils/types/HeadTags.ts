export type HeadTags = {
  title?: string;
  description?: string;
  noindex?: boolean;
  canonical?: string;
  /** Path of this page's plain-Markdown rendition for AI agents, advertised
   *  as <link rel="alternate" type="text/markdown">. See utils/agentMarkdown. */
  markdown?: string;
  og?: {
    title?: string;
    type?: string;
    description?: string;
    image?: string;
    alt?: string;
  };
};
