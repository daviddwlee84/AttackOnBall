// Runtime-configurable game settings: difficulty presets + advanced physics,
// persisted to localStorage. The settings panel (ui/settingsPanel.js) edits
// these; gameplay code reads the SCALE-applied values via gameParams().
//
// All values here are in *design units* (the unscaled 960x540 space). Spatial
// quantities are multiplied by SCALE in gameParams() before the game uses them.
import { SCALE } from './config.js';

const STORAGE_KEY = 'aob-settings';

// Difficulty presets bundle the common "feel" parameters. Picking one sets all
// of these at once; tweaking any value afterwards switches difficulty to 'custom'.
export const PRESETS = {
  easy:   { playerSpeed: 400, ballSpeedMin: 420, ballSpeedMax: 720,  spawnStart: 2.2,  spawnMin: 0.8,  spawnRamp: 0.012, doubleAfter: 35, tripleAfter: 80, densityRamp: 55 },
  medium: { playerSpeed: 380, ballSpeedMin: 560, ballSpeedMax: 1000, spawnStart: 1.6,  spawnMin: 0.35, spawnRamp: 0.022, doubleAfter: 18, tripleAfter: 45, densityRamp: 35 },
  hard:   { playerSpeed: 380, ballSpeedMin: 700, ballSpeedMax: 1200, spawnStart: 1.2,  spawnMin: 0.28, spawnRamp: 0.03,  doubleAfter: 10, tripleAfter: 28, densityRamp: 25 },
  crazy:  { playerSpeed: 360, ballSpeedMin: 880, ballSpeedMax: 1500, spawnStart: 0.85, spawnMin: 0.2,  spawnRamp: 0.045, doubleAfter: 5,  tripleAfter: 14, densityRamp: 14 },
};

// The keys a preset controls (so the panel knows what to refresh / compare).
export const PRESET_KEYS = Object.keys(PRESETS.medium);

// Advanced / physics defaults — not touched by presets.
const ADVANCED_DEFAULTS = {
  gravity: 1000,
  ballBounce: 1,
  angleMin: 40,
  angleMax: 78,
  minApexClearance: 40,
  speedRamp: 0.006,
  speedRampCap: 0.6,
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
  debug: false, // show the FPS / debug overlay
};

export function defaults() {
  return { difficulty: DEFAULT_DIFFICULTY, ...PRESETS[DEFAULT_DIFFICULTY], ...ADVANCED_DEFAULTS, ...PREF_DEFAULTS };
}

let current = load();

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && typeof saved === 'object') return { ...defaults(), ...saved };
  } catch {
    /* ignore corrupt storage */
  }
  return defaults();
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
const SPATIAL = ['playerSpeed', 'gravity', 'ballSpeedMin', 'ballSpeedMax', 'minApexClearance'];

// Final parameters consumed by the gameplay code (read once per GameScene start).
export function gameParams() {
  const out = { ...current };
  for (const k of SPATIAL) out[k] = current[k] * SCALE;
  return out;
}
