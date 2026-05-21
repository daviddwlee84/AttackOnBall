// Procedural sound effects via ZzFX (https://github.com/KilledByAPixel/ZzFX).
// No audio files — every sound is synthesized at runtime from a parameter array,
// mirroring how the doodle art is generated with rough.js. Honors the global
// `muted` setting; the AudioContext is unlocked on the first user gesture.
import { ZZFX, zzfx } from 'zzfx';
import { getSettings, setSettings } from './settings.js';

ZZFX.volume = 0.35; // master scale — keep the blips gentle

// Preset parameter arrays. Empty slots fall back to zzfx's own defaults.
// (param order: volume, randomness, frequency, attack, sustain, release, shape,
//  shapeCurve, slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise, …)
const SFX = {
  collect: [, , 1675, , 0.06, 0.24, 1, 1.82, , , 837, 0.06], // bright coin
  taunt: [, , 537, 0.02, 0.02, 0.22, 1, 1.59, -6.98, 4.97], // cheeky two-note
  scared: [0.7, , 440, , 0.04, 0.1, 1, 2, -8, , , , , , , , , 0.5], // quick "uh-oh" dip
  death: [, , 925, 0.04, 0.3, 0.6, 1, 0.3, , 6.27, -184, 0.09, 0.17], // game-over splat
  milestone: [, , 539, 0, 0.04, 0.29, 1, 1.92, , , 567, 0.02, 0.02, , , , 0.04], // power-up rise
  ui: [, , 1500, , 0.01, 0.03, 1, , , , , , , , , , , 0.6], // soft click
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
  if (getSettings().muted) return;
  try {
    zzfx(...params);
  } catch {
    /* never let a sound failure break gameplay */
  }
}

export const Sfx = {
  collect: () => play(SFX.collect),
  taunt: () => play(SFX.taunt),
  scared: () => play(SFX.scared),
  death: () => play(SFX.death),
  milestone: () => play(SFX.milestone),
  ui: () => play(SFX.ui),
  // Bounce thud; pitch drops as the ball gets bigger (sizeIdx 0..3).
  bounce: (sizeIdx = 0) => play([, , 200 - sizeIdx * 38, 0.01, , 0.15, , , , , , , , 5]),
};
