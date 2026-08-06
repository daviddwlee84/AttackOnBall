// Runtime-configurable game settings: difficulty presets + advanced physics,
// persisted to localStorage. The settings panel (ui/settingsPanel.js) edits
// these; gameplay code reads the SCALE-applied values via gameParams().
//
// All values here are in *design units* (the unscaled 960x540 space). Spatial
// quantities are multiplied by SCALE in gameParams() before the game uses them.
import { SCALE } from './config.js';

// v2 dropped ballSpeedMin/Max + angleMin/Max in favour of apex + crossTime (see
// systems/ballistics.js). A new key rather than a merge, so stale physics values
// can't survive in a 'custom' profile and quietly produce the old behaviour.
const STORAGE_KEY = 'aob-settings-v2';
const LEGACY_KEY = 'aob-settings';

// Difficulty presets bundle the common "feel" parameters. Picking one sets all
// of these at once; tweaking any value afterwards switches difficulty to 'custom'.
//
// apex   = clearance of the ball's underside over the water line, design px
//          (the hero is 56 tall, so 150 ≈ 2.7 hero-heights)
// cross  = seconds to traverse the arena
// Bounces while crossing ≈ cross / (2·√(2·apex/g)); with g = 1000 that puts
// Easy at ~3.5-5 bounces and Crazy at ~1.7-2.5 — Easy finally arcs *high*, and
// Crazy still lands inside the arena instead of sailing clean over it.
// minBounces is a floor on how many times a ball must land while crossing the
// arena. It's what stops the long-run pressure ramp from turning fast balls
// back into harmless fly-overs.
export const PRESETS = {
  easy:   { playerSpeed: 400, apexMin: 150, apexMax: 240, crossMin: 3.6, crossMax: 5.0, minBounces: 3.0, spawnStart: 2.2,  spawnMin: 0.8,  spawnRamp: 0.012, doubleAfter: 35, tripleAfter: 80, densityRamp: 55 },
  medium: { playerSpeed: 380, apexMin: 110, apexMax: 190, crossMin: 2.4, crossMax: 3.4, minBounces: 2.2, spawnStart: 1.6,  spawnMin: 0.35, spawnRamp: 0.022, doubleAfter: 18, tripleAfter: 45, densityRamp: 35 },
  hard:   { playerSpeed: 380, apexMin: 95,  apexMax: 170, crossMin: 1.9, crossMax: 2.7, minBounces: 1.9, spawnStart: 1.2,  spawnMin: 0.28, spawnRamp: 0.03,  doubleAfter: 10, tripleAfter: 28, densityRamp: 25 },
  crazy:  { playerSpeed: 360, apexMin: 90,  apexMax: 150, crossMin: 1.5, crossMax: 2.2, minBounces: 1.6, spawnStart: 0.85, spawnMin: 0.2,  spawnRamp: 0.045, doubleAfter: 5,  tripleAfter: 14, densityRamp: 14 },
};

// The keys a preset controls (so the panel knows what to refresh / compare).
export const PRESET_KEYS = Object.keys(PRESETS.medium);

// Advanced / physics defaults — not touched by presets.
const ADVANCED_DEFAULTS = {
  gravity: 1000,
  ballBounce: 1,
  // Hard floor under the random apex, on top of the hero's height. Lower than
  // the old 40 because the dodgeability guarantee (systems/safety.js) now does
  // the real work — this is just a physical sanity bound.
  minApexClearance: 20,
  // How far off-screen balls start. Randomised per ball, which also randomises
  // where in its bounce cycle it enters the arena.
  spawnMarginMin: 40,
  spawnMarginMax: 160,
  speedRamp: 0.006,
  speedRampCap: 0.6,
  // Reject spawns that would make death unavoidable (systems/safety.js).
  guaranteeDodgeable: true,
};

export const DEFAULT_DIFFICULTY = 'medium';

// Non-physics preferences (not touched by presets).
const PREF_DEFAULTS = {
  mode: 'classic', // 'classic' (1 hit = over) | 'lives' (N lives + revive)
  lives: 3, // starting lives in lives mode (2..5)
  autoRecover: false, // lives mode: also fill the heart passively over time
  heartDropChance: 0.08, // lives mode: chance a pickup spawn is a bonus heart
  muted: false, // master sound on/off
  sfxVolume: 0.6, // 0..1
  musicVolume: 0.35, // 0..1
  musicOn: true, // background music toggle
  tauntOn: true, // gloating/幸災樂禍 reaction toggle
  landingMarker: true, // show where each ball will next hit the ground
  playerName: '', // remembered for leaderboard entries
  debug: false, // show the FPS / debug overlay
  // Software-landscape (see src/orientation.js): which way the page is rotated
  // when the browser won't lock the orientation. Undetectable while the OS
  // rotation lock is on, so the player picks whichever matches how they turn
  // the phone.
  rotateClockwise: true,
};

export function defaults() {
  return { difficulty: DEFAULT_DIFFICULTY, ...PRESETS[DEFAULT_DIFFICULTY], ...ADVANCED_DEFAULTS, ...PREF_DEFAULTS };
}

let current = load();

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && typeof saved === 'object') return { ...defaults(), ...saved };
    return migrateV1();
  } catch {
    /* ignore corrupt storage */
  }
  return defaults();
}

// One-time carry-over from the v1 blob: keep the player's *preferences*, drop
// every physics value (the v1 ones describe a launch model that no longer
// exists). A v1 'custom' profile can't be translated, so it falls back to the
// default preset rather than to a half-migrated frankenstein.
function migrateV1() {
  try {
    const old = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
    if (!old || typeof old !== 'object') return defaults();
    const out = defaults();
    for (const k of Object.keys(PREF_DEFAULTS)) {
      if (old[k] !== undefined) out[k] = old[k];
    }
    if (PRESETS[old.difficulty]) {
      out.difficulty = old.difficulty;
      Object.assign(out, PRESETS[old.difficulty]);
    }
    return out;
  } catch {
    return defaults();
  }
}

export function getSettings() {
  return current;
}

export function setSettings(patch) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* ignore */
  }
  return current;
}

export function applyPreset(name) {
  return setSettings({ ...PRESETS[name], difficulty: name });
}

export function resetSettings() {
  return setSettings(defaults());
}

// Spatial fields that must be multiplied by the render SCALE for gameplay.
// (crossMin/crossMax are times and spawn*/density* are rates — not spatial.)
const SPATIAL = [
  'playerSpeed',
  'gravity',
  'apexMin',
  'apexMax',
  'minApexClearance',
  'spawnMarginMin',
  'spawnMarginMax',
];

// Final parameters consumed by the gameplay code (read once per GameScene start).
export function gameParams() {
  const out = { ...current };
  for (const k of SPATIAL) out[k] = current[k] * SCALE;
  return out;
}
