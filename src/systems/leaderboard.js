// Local top-10 boards, one per (mode x difficulty) bucket.
//
// Kept separate per bucket because the numbers aren't comparable: a Lives run
// survives several hits, and Easy balls arc higher than Crazy ones, so a single
// board would just rank "who played the most forgiving setup". A 'custom'
// difficulty gets its own bucket so hand-tuned physics can't pollute the preset
// boards.
//
// Storage is injected rather than reaching for localStorage directly: it keeps
// the module Phaser- and DOM-free for scripts/logic-check.mjs, and leaves room
// to swap in an async/hosted backend later without touching call sites.

const KEY = 'aob-scores-v1';
export const MAX_ENTRIES = 10;
const MAX_NAME = 12;

function cleanName(name) {
  const n = String(name ?? '').trim().slice(0, MAX_NAME);
  return n || 'Anon';
}

export function createLeaderboard(storage) {
  let cache = null;

  function readAll() {
    if (cache) return cache;
    cache = {};
    try {
      const raw = storage?.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') cache = parsed;
    } catch {
      /* corrupt or unavailable storage — start empty */
    }
    return cache;
  }

  function writeAll(all) {
    cache = all;
    try {
      storage?.setItem(KEY, JSON.stringify(all));
    } catch {
      /* quota / private mode — the in-memory cache still works this session */
    }
  }

  function bucketOf(mode, difficulty) {
    return `${mode || 'classic'}:${difficulty || 'custom'}`;
  }

  function top(bucket, n = MAX_ENTRIES) {
    const list = readAll()[bucket];
    return Array.isArray(list) ? list.slice(0, n) : [];
  }

  function qualifies(bucket, score) {
    if (!(score > 0)) return false;
    const list = top(bucket);
    return list.length < MAX_ENTRIES || score > list[list.length - 1].score;
  }

  // Insert and return the 1-based rank, or 0 if the score didn't make the board.
  function submit(bucket, name, score, at = 0) {
    const all = readAll();
    const entry = { name: cleanName(name), score, ts: at };
    const list = [...(all[bucket] || []), entry]
      // Ties keep the existing holder ahead of the newcomer.
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_ENTRIES);
    writeAll({ ...all, [bucket]: list });
    const rank = list.indexOf(entry);
    return rank === -1 ? 0 : rank + 1;
  }

  return { bucketOf, top, qualifies, submit };
}

// Default instance backed by the browser's localStorage (absent under Node).
export const leaderboard = createLeaderboard(
  typeof localStorage !== 'undefined' ? localStorage : null
);
