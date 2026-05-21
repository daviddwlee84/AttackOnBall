# Rewind Mode — Implementation Plan

> Status: **planned, not started.** A third game mode alongside Classic and Lives.
> Filed from the idea "回退一段時間到還沒被撞死的當下".

## Goal

On a fatal hit, instead of ending the run, **rewind the whole world ~1.2s** to just
before the collision and resume with brief invincibility. Unlike Lives mode (which
keeps time moving *forward*), here the ball trajectories visibly run *backwards* and
then replay. Limited uses per run so it stays a clutch save, not an undo button.

## Player-facing design

- New mode in the start panel: `classic | lives | rewind` (extend the existing
  `mode` setting + `aob-mode` selector).
- A "rewinds left" counter (e.g. 3), shown like the hearts HUD (⏪ ×3).
- On death: short freeze → fast reverse playback of the last ~0.5s of frames →
  settle ~1.2s before death → `INVINCIBLE_MS` of invincibility → resume forward.
- Out of rewinds → normal game over.
- Optional juice: desaturate / scanline shader + a "whoosh" rewind SFX (ZzFX with a
  rising/reversed pitch), VHS-style during the reverse.

## Data model

Ring buffer of per-frame snapshots, ~3s at 60fps (`MAX_SNAPSHOTS ≈ 180`). Push one
each `update()` (cheap; plain objects, reused via a pooled ring to avoid GC):

```
Snapshot {
  t,                     // elapsed at capture
  collected, segment, lives,
  player: { x },
  balls:   [{ key, x, y, vx, vy, av, scaleX, scaleY }],   // key = texture key 'ball-<s>-<c>'
  pickups: [{ value, x, y, vx, vy }],
}
```

Arcade physics is **not** replay-deterministic, but a position+velocity snapshot
restores exactly — so we don't replay, we *restore* a chosen past frame.

## Restore flow (the hard part)

1. Pause spawner + collisions; set `over=false` guard so no double-trigger.
2. (Optional) Reverse-scrub: for N frames, pop snapshots newest→oldest and just set
   positions (no physics step) to render the reverse, ~16ms apart.
3. Land on `snap = buffer[len - rewindFrames]`.
4. Rebuild entities from `snap`:
   - Destroy all current balls/pickups.
   - For each `snap.balls[i]`: recreate a Ball **without** calling `launch()`
     (which re-randomizes), then set body circle, gravity, `setVelocity(vx,vy)`,
     `setAngularVelocity(av)`, scale. → **needs a `Ball.restore(state)` path** that
     bypasses the constructor's RNG and `launch()`.
   - Same for pickups → **`NumberPickup.restore(state)`** bypassing `configure()`'s
     gravity/`delayedCall`.
5. Restore `elapsed/collected/segment/lives`, hearts/score HUD, player x + alpha.
6. Grant invincibility, resume spawner/collisions, decrement rewinds.

## Code touch points

- `config.js`: `MAX_SNAPSHOTS`, `REWIND_FRAMES`, `REWINDS_PER_RUN`.
- `settings.js`: `mode` already supports a string; add `'rewind'` + a `rewinds` count.
- `Ball.js` / `NumberPickup.js`: add `serialize()` + static/instance `restore(scene, state)`
  that sets body + velocity directly (the existing "configure body *after* group add"
  gotcha still applies).
- `GameScene.js`: snapshot ring in `update()`; branch in `die()` → `rewind()` when
  `mode==='rewind' && rewindsLeft>0`; rewinds HUD; optional shader/SFX.
- `audio.js`: a `rewind` SFX preset.

## Edge cases

- Don't snapshot while `over`.
- Balls that had flown off-screen and were culled simply won't be in the snapshot —
  fine (fewer balls after rewind is acceptable / generous).
- If the buffer is shorter than `REWIND_FRAMES` early in a run, rewind to the oldest
  available (or disallow until enough history exists).
- Pause/resume must not corrupt the ring (skip pushes while paused).
- Pickups' fade-out `delayedCall` timers: on restore, re-arm or skip (simplest: give
  restored pickups a fresh fade timer).

## Effort / risk

Memory is trivial (a few hundred small objects). The real work is the clean
serialize/restore on Ball/NumberPickup and the scene re-hydration. **Moderate,
well-contained.** The reverse-scrub visual is optional polish and can ship later.

## Testing

- Headless: drive `window.__aob`, force `die()` in rewind mode, assert
  `rewindsLeft` decremented, `over===false`, ball count/positions match the chosen
  snapshot, invincibility active.
- Smoke test unaffected (Classic remains default).
