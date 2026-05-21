// Render scale. The game is authored at a 960x540 "design" resolution, then
// every spatial value (positions, sizes, velocities, gravity, fonts) is
// multiplied by SCALE so the canvas backing buffer is high-resolution and
// stays crisp on hi-DPI displays. Gameplay/feel is identical at any SCALE
// because all spatial quantities scale together. Bump to 3 for extra sharpness.
export const SCALE = 2;

// Logical game size (landscape — wider arena gives the balls room to fly).
export const GAME_W = 960 * SCALE;
export const GAME_H = 540 * SCALE;

// Ground: the top edge of the blue "water" strip the hero stands on.
export const GROUND_H = 64 * SCALE; // thickness of the water strip
export const GROUND_Y = GAME_H - GROUND_H; // y of the surface line

// --- Player (visual size is fixed; movement speed is a runtime setting) ---
export const PLAYER_SIZE = 56 * SCALE; // hero sprite is square-ish

// Ball sizes (fixed). Launch speed/angle, gravity, bounce, spawn rates and the
// difficulty ramp are all runtime-configurable — see src/settings.js.
export const BALL_SIZES = [
  { r: 18 * SCALE },
  { r: 26 * SCALE },
  { r: 36 * SCALE },
  { r: 48 * SCALE },
];

// --- Number pickups ---
export const PICKUP_INTERVAL = 5; // seconds between drops (with jitter)
export const PICKUP_VALUES = [1, 2, 3, 4]; // seconds added straight to the clock

// --- Scoring ---
// Score *is* the survival time in seconds (continuous, one decimal); pickups
// add seconds directly.
export const SEGMENT = 10; // every 10 seconds: reset bar + shuffle palette

// Arena palettes cycled every SEGMENT seconds. Colors are Phaser numeric hex.
// bg = paper/background, grid = grid line tint, water = ground strip.
export const PALETTES = [
  { bg: 0xfdf6e3, grid: 0xd9cba8, water: 0x4cc3e8 },
  { bg: 0xffe9ec, grid: 0xf2b8c0, water: 0x6bd6a0 },
  { bg: 0xe6f4ff, grid: 0xa8d4f2, water: 0xffb454 },
  { bg: 0xf3e9ff, grid: 0xc9aef2, water: 0x57d6c4 },
  { bg: 0xeafbe5, grid: 0xb2e0a0, water: 0xff7eb6 },
  { bg: 0xfff4dd, grid: 0xf2d39a, water: 0x8b7eff },
];

// Doodle ball fill colors (crayon palette).
export const BALL_COLORS = [
  '#ff6b6b',
  '#ffa94d',
  '#ffd43b',
  '#69db7c',
  '#4dabf7',
  '#b197fc',
  '#f783ac',
  '#3bc9db',
];

export const HERO_COLOR = '#9ad42b';

// Lives mode: how long the hero is invincible (and blinking) after respawning.
export const INVINCIBLE_MS = 1800;
