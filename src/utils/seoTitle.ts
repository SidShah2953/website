// Search results show roughly 60 characters of a title. The " | Siddhant Shah"
// suffix is worth carrying when it fits, but on a long headline it only pushes
// the words that matter past the cut, so it is dropped rather than truncated.
const SUFFIX = " | Siddhant Shah";
const LIMIT = 60;

export const seoTitle = (title: string) =>
  title.length + SUFFIX.length <= LIMIT ? title + SUFFIX : title;
