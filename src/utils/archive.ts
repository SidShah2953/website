/**
 * "archive" is a plain tag, so an old piece can be retired from the map,
 * the word map and the listings without being deleted or unpublished.
 * Matching is case- and whitespace-insensitive so "Archive" and "archive"
 * can never silently diverge into two different states.
 */
export const ARCHIVE_TAG = "archive";

type HasTags = { data: { tags?: string[] } };

export const isArchived = (entry: HasTags): boolean =>
  (entry.data.tags ?? []).some(
    (t) => t.trim().toLowerCase() === ARCHIVE_TAG,
  );

/** Everything still on show. Use this for listings, the map and the word map. */
export const live = <T extends HasTags>(entries: T[]): T[] =>
  entries.filter((e) => !isArchived(e));

/** Only the retired pieces — for a future /archive page. */
export const archived = <T extends HasTags>(entries: T[]): T[] =>
  entries.filter(isArchived);
