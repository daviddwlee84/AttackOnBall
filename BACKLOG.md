# Backlog

Ideas captured for later, with enough notes to pick up cold.

## Rewind mode (time-rollback continue)

**Idea:** A third game mode where, instead of losing a life outright, death lets you
*rewind* a second or two to just before the fatal hit and resume (with brief
invincibility). Distinct from Lives mode — here the ball trajectories are *rewound*
too, not just continued.

**Why it's harder than Lives mode:** Lives mode only needs a flag + invincibility
timer; the world keeps running forward. Rewind needs the world to actually go
*backwards*, which means recording and restoring full simulation state.

**Sketch:**
- Keep a ring buffer of world snapshots, ~1 per frame for the last ~2–3s
  (e.g. 180 frames). Each snapshot stores: player x; every ball's
  `{textureKey, x, y, vx, vy, angularVelocity, scale}`; every pickup's
  `{value, x, y, vx, vy}`; `elapsed`/`collected`/`segment`.
- On death: pick the snapshot from ~1.2s before now, then rebuild the scene from it
  — destroy current balls/pickups, recreate from the snapshot (Arcade physics isn't
  deterministic to *replay*, but restoring a position+velocity snapshot is exact),
  rewind `elapsed`/score, grant invincibility, resume.
- Optional polish: a visual "rewind" effect (fast-reverse a few frames by stepping
  the buffer backwards before resuming, desaturate/scanline shader, a whoosh SFX).
- Limit uses (e.g. N rewinds per run) so it's not infinite, like Lives.

**Cost / risk:** Memory for the buffer is small (a few hundred plain objects).
Main work is a clean serialize/restore of Ball/NumberPickup (their constructors take
indices, not raw state — would need a `fromSnapshot()` path or a restore method that
bypasses `launch()`/`configure()`). Moderate effort; well-contained.

**Status:** Not started. Lives mode (shipped) covers the "more forgiving" need for now.
