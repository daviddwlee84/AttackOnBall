// Procedural audio via ZzFX (https://github.com/KilledByAPixel/ZzFX). No audio
// files — every SFX *and* the background music are synthesized at runtime,
// mirroring how the doodle art is generated with rough.js.
//
// Volume model: ZZFX.volume stays at 1 (master) and we bake each channel's
// volume into the sound's own volume parameter, so SFX and music levels are
// independent. Everything is gated by the `muted` setting; the music loop also
// respects `musicOn` and only runs while a game is in progress.
import { ZZFX, zzfx } from 'zzfx';
import { getSettings, setSettings } from './settings.js';

ZZFX.volume = 1; // master; per-channel volume is applied per call

// SFX preset parameter arrays. The first slot is the base volume (balanced
// across sounds); it gets multiplied by the live `sfxVolume` setting at play
// time. (Order: volume, randomness, frequency, attack, sustain, release, shape,
// shapeCurve, slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise…)
const SFX = {
  collect: [0.5, , 1675, , 0.06, 0.24, 1, 1.82, , , 837, 0.06], // bright coin
  taunt: [0.5, , 537, 0.02, 0.02, 0.22, 1, 1.59, -6.98, 4.97], // cheeky two-note
  scared: [0.5, , 440, , 0.04, 0.1, 1, 2, -8, , , , , , , , , 0.5], // quick "uh-oh" dip
  death: [0.6, , 925, 0.04, 0.3, 0.6, 1, 0.3, , 6.27, -184, 0.09, 0.17], // splat
  hurt: [0.55, , 280, 0.01, 0.05, 0.15, 1, 2.5, -6, , , , , 0.4], // lose-a-life zap
  milestone: [0.5, , 539, 0, 0.04, 0.29, 1, 1.92, , , 567, 0.02, 0.02, , , , 0.04], // rise
  ui: [0.4, , 1500, , 0.01, 0.03, 1, , , , , , , , , , , 0.6], // soft click
};

export function isMuted() {
  return getSettings().muted;
}

export function setMuted(muted) {
  setSettings({ muted });
  if (!muted) unlockAudio();
  return muted;
}

export function toggleMuted() {
  return setMuted(!isMuted());
}

// Browsers start the AudioContext suspended until a user gesture; call this from
// within a click/keydown handler (e.g. the Play button) to enable sound.
export function unlockAudio() {
  try {
    if (ZZFX.audioContext && ZZFX.audioContext.state === 'suspended') ZZFX.audioContext.resume();
  } catch {
    /* audio unavailable — ignore */
  }
}

function play(params) {
  const s = getSettings();
  if (s.muted || s.sfxVolume <= 0) return;
  const p = [...params];
  p[0] = (p[0] || 1) * s.sfxVolume;
  try {
    zzfx(...p);
  } catch {
    /* never let a sound failure break gameplay */
  }
}

export const Sfx = {
  collect: () => play(SFX.collect),
  taunt: () => play(SFX.taunt),
  scared: () => play(SFX.scared),
  death: () => play(SFX.death),
  hurt: () => play(SFX.hurt),
  milestone: () => play(SFX.milestone),
  ui: () => play(SFX.ui),
  // Bounce thud; pitch drops as the ball gets bigger (sizeIdx 0..3).
  bounce: (sizeIdx = 0) => play([0.45, , 200 - sizeIdx * 38, 0.01, , 0.15, , , , , , , , 5]),
};

// --- Background music -------------------------------------------------------
// A gentle generative loop: a soft melody that random-walks a C-major pentatonic
// scale (so it never hits a dissonant note) over a slow root bass. Asset-free
// and non-repetitive; toggle/level via the `musicOn` / `musicVolume` settings.
const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33]; // C D E G A C5 D5
let musicTimer = null;
let musicStep = 0;
let melodyIdx = 2;

function musicTick() {
  const s = getSettings();
  if (s.muted || !s.musicOn || s.musicVolume <= 0) {
    stopMusic();
    return;
  }
  const v = s.musicVolume;
  try {
    // Melody: random walk, with the occasional rest for breathing room.
    melodyIdx += [-1, -1, 0, 1, 1][Math.floor(Math.random() * 5)];
    if (melodyIdx < 0) melodyIdx = 1;
    if (melodyIdx >= PENTA.length) melodyIdx = PENTA.length - 2;
    if (Math.random() < 0.82) {
      zzfx(...[0.18 * v, 0.04, PENTA[melodyIdx], 0.02, 0.12, 0.16, 1, 1.5, , , , , , , , , 0.06]);
    }
    // Bass: root note an octave down on every 4th step.
    if (musicStep % 4 === 0) {
      zzfx(...[0.2 * v, 0.02, PENTA[0] / 2, 0.03, 0.26, 0.3, 0, 1, , , , , , , , , 0.1]);
    }
  } catch {
    /* ignore audio errors */
  }
  musicStep++;
}

export function startMusic() {
  if (musicTimer) return;
  const s = getSettings();
  if (s.muted || !s.musicOn) return;
  unlockAudio();
  musicTimer = setInterval(musicTick, 360);
}

export function stopMusic() {
  if (musicTimer) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
}
