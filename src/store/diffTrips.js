/**
 * Work out what changed between two versions of the trip list, comparing by object identity
 * (the reducer never mutates, so an unchanged trip is the very same object).
 *
 * @param {Map<string, object>} before  trips by id, from the last time we looked
 * @param {object[]} after              the current trips
 * @returns {{ upserts: string[], deletes: string[], next: Map<string, object> }} ids to save, ids to delete, and the new map
 */
export function diffTrips(before, after) {
  const next = new Map(after.map((t) => [t.id, t]));
  const upserts = after.filter((t) => before.get(t.id) !== t).map((t) => t.id);
  const deletes = [...before.keys()].filter((id) => !next.has(id));
  return { upserts, deletes, next };
}
