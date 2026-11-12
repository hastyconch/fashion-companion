/**
 * Stable, cacheable URL for a stored photo. Signed Storage URLs change on every
 * page load (new token), so browsers re-downloaded every photo on every visit.
 * /photos/... never changes for a given item, so the browser keeps it.
 */
export function photoUrl(storagePath: string | null | undefined): string | null {
  return storagePath ? `/photos/${storagePath}` : null;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PHOTO_PATH = new RegExp(`^${UUID}/${UUID}/(full|thumb)\\.jpg$`, "i");

/** Accepts only {user_id}/{item_id}/(full|thumb).jpg. */
export function isPhotoPath(path: string): boolean {
  return PHOTO_PATH.test(path);
}
