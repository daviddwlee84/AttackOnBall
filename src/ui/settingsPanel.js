// HTML overlay settings panel shown on the menu screen. Difficulty presets are
// always visible; physics/tuning lives behind an "Advanced settings" toggle.
// Edits go straight into src/settings.js (persisted); "Play" calls onPlay().
import {
  getSettings,
  setSettings,
  applyPreset,
  resetSettings,
  PRESETS,
  PRESET_KEYS,
} from '../settings.js';
import { isMuted, setMuted } from '../audio.js';

const BEST_KEY = 'aob-best';

// Always-visible control(s).
const COMMON = [{ key: 'playerSpeed', label: 'Move speed', min: 200, max: 600, step: 10 }];

// Advanced / physics controls (hidden until expanded).
const ADVANCED = [
  { key: 'gravity', label: 'Gravity', min: 400, max: 2000, step: 50 },
  { key: 'ballBounce', label: 'Ball bounciness', min: 0.7, max: 1.05, step: 0.01 },
  { key: 'ballSpeedMin', label: 'Ball speed — min', min: 200, max: 1400, step: 20 },
  { key: 'ballSpeedMax', label: 'Ball speed — max', min: 400, max: 2000, step: 20 },
  { key: 'angleMin', label: 'Launch angle — min°', min: 20, max: 70, step: 1 },
  { key: 'angleMax', label: 'Launch angle — max°', min: 50, max: 89, step: 1 },
  { key: 'minApexClearance', label: 'Min bounce clearance', min: 0, max: 160, step: 5 },
  { key: 'spawnStart', label: 'Spawn interval start (s)', min: 0.5, max: 3, step: 0.1 },
  { key: 'spawnMin', label: 'Spawn interval floor (s)', min: 0.15, max: 1.5, step: 0.05 },
  { key: 'spawnRamp', label: 'Spawn speed-up / s', min: 0, max: 0.06, step: 0.002 },
  { key: 'doubleAfter', label: '2nd ball after (s)', min: 0, max: 90, step: 1 },
  { key: 'tripleAfter', label: '3rd ball after (s)', min: 0, max: 120, step: 1 },
  { key: 'densityRamp', label: 'Density ramp (s)', min: 5, max: 80, step: 1 },
  { key: 'speedRamp', label: 'Speed creep / s', min: 0, max: 0.02, step: 0.001 },
  { key: 'speedRampCap', label: 'Speed creep cap', min: 0, max: 1.5, step: 0.05 },
];

let root;
let onPlayCb;
const controls = {};
const presetBtns = {};
let diffLabel;
let bestLabel;
let soundBtn;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function fmt(v, step) {
  const decimals = (String(step).split('.')[1] || '').length;
  return Number(v).toFixed(decimals);
}

function makeSlider(spec) {
  const row = el('label', 'aob-row');
  const top = el('div', 'aob-row-top');
  top.appendChild(el('span', 'aob-row-label', spec.label));
  const valSpan = el('span', 'aob-row-val', '');
  top.appendChild(valSpan);

  const input = document.createElement('input');
  input.type = 'range';
  input.min = spec.min;
  input.max = spec.max;
  input.step = spec.step;
  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    const patch = { [spec.key]: v };
    if (PRESET_KEYS.includes(spec.key)) patch.difficulty = 'custom';
    setSettings(patch);
    valSpan.textContent = fmt(v, spec.step);
    refreshPresetHighlight();
  });

  row.appendChild(top);
  row.appendChild(input);
  controls[spec.key] = { input, valSpan, spec };
  return row;
}

function refresh() {
  const s = getSettings();
  for (const k in controls) {
    const { input, valSpan, spec } = controls[k];
    input.value = s[k];
    valSpan.textContent = fmt(s[k], spec.step);
  }
  const best = Number(localStorage.getItem(BEST_KEY) || 0);
  bestLabel.textContent = best > 0 ? `Best: ${best.toFixed(1)}s` : '';
  syncSound();
  refreshPresetHighlight();
}

function syncSound() {
  if (soundBtn) soundBtn.textContent = isMuted() ? '🔇 Sound: Off' : '🔊 Sound: On';
}

function refreshPresetHighlight() {
  const s = getSettings();
  for (const n in presetBtns) presetBtns[n].classList.toggle('active', s.difficulty === n);
  diffLabel.textContent = s.difficulty === 'custom' ? 'Custom setup' : `${cap(s.difficulty)} mode`;
}

function buildOnce() {
  if (root) return;
  injectStyle();

  root = el('div');
  root.id = 'aob-settings';
  root.classList.add('aob-hidden');

  const panel = el('div', 'aob-panel');
  panel.appendChild(el('h1', null, 'Attack on Ball'));
  bestLabel = el('div', 'aob-best', '');
  panel.appendChild(bestLabel);

  panel.appendChild(el('div', 'aob-section', 'Difficulty'));
  const presetRow = el('div', 'aob-presets');
  for (const name of Object.keys(PRESETS)) {
    const b = el('button', 'aob-preset', cap(name));
    b.addEventListener('click', () => {
      applyPreset(name);
      refresh();
    });
    presetRow.appendChild(b);
    presetBtns[name] = b;
  }
  panel.appendChild(presetRow);
  diffLabel = el('div', 'aob-diff', '');
  panel.appendChild(diffLabel);

  for (const spec of COMMON) panel.appendChild(makeSlider(spec));

  const advToggle = el('button', 'aob-adv-toggle', '⚙ Advanced settings');
  const advSection = el('div', 'aob-advanced aob-hidden');
  advToggle.addEventListener('click', () => {
    const open = advSection.classList.toggle('aob-hidden');
    advToggle.textContent = open ? '⚙ Advanced settings' : '⚙ Advanced settings ▴';
  });
  for (const spec of ADVANCED) advSection.appendChild(makeSlider(spec));
  const reset = el('button', 'aob-reset', '↺ Reset to defaults');
  reset.addEventListener('click', () => {
    resetSettings();
    refresh();
  });
  advSection.appendChild(reset);
  panel.appendChild(advToggle);
  panel.appendChild(advSection);

  soundBtn = el('button', 'aob-sound', '');
  soundBtn.addEventListener('click', () => {
    setMuted(!isMuted());
    syncSound();
  });
  syncSound();
  panel.appendChild(soundBtn);

  const play = el('button', 'aob-play', '▶ Play');
  play.addEventListener('click', () => {
    closeSettings();
    if (onPlayCb) onPlayCb();
  });
  panel.appendChild(play);

  root.appendChild(panel);
  document.body.appendChild(root);
}

export function openSettings({ onPlay } = {}) {
  buildOnce();
  onPlayCb = onPlay;
  refresh();
  root.classList.remove('aob-hidden');
}

export function closeSettings() {
  if (root) root.classList.add('aob-hidden');
}

function injectStyle() {
  if (document.getElementById('aob-settings-style')) return;
  const css = `
  #aob-settings{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
    background:rgba(43,43,43,.55);z-index:10;font-family:'Comic Sans MS','Marker Felt',sans-serif;color:#2b2b2b;}
  #aob-settings.aob-hidden,.aob-advanced.aob-hidden{display:none;}
  .aob-panel{background:#fdf6e3;border:4px solid #2b2b2b;border-radius:20px;padding:18px 22px;
    width:min(460px,92vw);max-height:92vh;overflow-y:auto;box-shadow:0 12px 0 rgba(43,43,43,.22);}
  .aob-panel h1{margin:0;text-align:center;font-size:34px;}
  .aob-best{text-align:center;color:#e0991a;font-weight:bold;min-height:18px;margin:2px 0 10px;}
  .aob-section{font-weight:bold;margin:6px 0 6px;}
  .aob-presets{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}
  .aob-preset{font-family:inherit;cursor:pointer;border:3px solid #2b2b2b;border-radius:12px;
    background:#fff;padding:9px 0;font-size:15px;font-weight:bold;transition:transform .05s;}
  .aob-preset:hover{filter:brightness(1.04);} .aob-preset:active{transform:translateY(2px);}
  .aob-preset.active{background:#9ad42b;}
  .aob-diff{text-align:center;margin:8px 0 4px;opacity:.75;font-size:14px;}
  .aob-row{display:block;margin:11px 0;}
  .aob-row-top{display:flex;justify-content:space-between;font-size:14px;margin-bottom:3px;}
  .aob-row-val{font-weight:bold;}
  .aob-row input[type=range]{width:100%;accent-color:#4dabf7;}
  .aob-adv-toggle,.aob-reset,.aob-play,.aob-sound{font-family:inherit;cursor:pointer;border:3px solid #2b2b2b;
    border-radius:12px;background:#fff;font-weight:bold;}
  .aob-adv-toggle{width:100%;padding:11px;margin-top:14px;font-size:15px;}
  .aob-sound{width:100%;padding:11px;margin-top:12px;font-size:15px;}
  .aob-advanced{margin-top:10px;padding-top:8px;border-top:2px dashed #b9ad8e;}
  .aob-reset{width:100%;padding:8px;margin-top:10px;font-size:13px;background:#ffe9ec;}
  .aob-play{width:100%;padding:15px;margin-top:16px;font-size:21px;background:#4dabf7;color:#08334d;}
  .aob-play:hover{filter:brightness(1.05);} .aob-play:active{transform:translateY(2px);}
  `;
  const style = document.createElement('style');
  style.id = 'aob-settings-style';
  style.textContent = css;
  document.head.appendChild(style);
}
