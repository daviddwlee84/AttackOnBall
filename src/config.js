// Logical game size (landscape — wider arena gives the balls room to fly).
// Phaser Scale.FIT letterboxes this to any screen.
export const GAME_W = 960;
export const GAME_H = 540;

// Ground: the top edge of the blue "water" strip the hero stands on.
export const GROUND_H = 64; // thickness of the water strip
export const GROUND_Y = GAME_H - GROUND_H; // y of the surface line

// --- Physics (ported & tuned from deprecated/attack_on_ball_canvas.html) ---
export const GRAVITY = 1000; // px/s^2
// Elastic ground bounce: each ball conserves energy and keeps a stable, lively
// bounce height (matching the original). A value <1 would let them die out;
// >1 (or a min-velocity clamp) injects energy and causes runaway bounces.
export const BALL_BOUNCE = 1;

// --- Player ---
export const PLAYER_SPEED = 380; // px/s horizontal
export const PLAYER_SIZE = 56; // hero sprite is square-ish

// --- Ball spawning / difficulty ---
export const BALL_SPAWN_START = 1.7; // seconds between balls at t=0
export const BALL_SPAWN_MIN = 0.5; // floor on spawn interval
export const BALL_SPAWN_RAMP = 0.02; // interval reduction per second survived
export const BALL_SIZES = [
  { r: 18, mass: 0.6 },
  { r: 26, mass: 1.0 },
  { r: 36, mass: 1.6 },
  { r: 48, mass: 2.4 },
];
export const BALL_VX_MIN = 140;
export const BALL_VX_MAX = 300;
export const BALL_VY_MIN = 360;
export const BALL_VY_MAX = 660;

// --- Number pickups ---
export const PICKUP_INTERVAL = 5; // seconds between drops (with jitter)
export const PICKUP_VALUES = [3, 5, 10]; // seconds added straight to the clock

// --- Scoring ---
// Score *is* the survival time in seconds; pickups add seconds directly.
export const SCORE_PER_SECOND = 1;
export const SEGMENT = 10; // every 10 seconds: reset bar + shuffle palette

// Arena palettes cycled every SEGMENT points. Colors are Phaser numeric hex.
// bg = paper/background, accent = grid line tint, water = ground strip.
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
