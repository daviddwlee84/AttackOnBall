// "You made the top ten" name prompt.
//
// An HTML overlay rather than a Phaser text field: text entry needs a real
// <input> to get the on-screen keyboard, autocorrect suppression and caret
// handling right on mobile, none of which Phaser provides. Same approach and
// visual idiom as ui/settingsPanel.js.
const STYLE_ID = 'aob-name-style';

let root;
let input;
let resolveCurrent;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
  #aob-name{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
    background:rgba(43,43,43,.6);z-index:40;font-family:'Comic Sans MS','Marker Felt',sans-serif;color:#2b2b2b;}
  #aob-name.aob-hidden{display:none;}
  #aob-name .card{background:#fdf6e3;border:4px solid #2b2b2b;border-radius:20px;padding:20px 22px;
    width:min(360px,88vw);text-align:center;box-shadow:0 12px 0 rgba(43,43,43,.22);}
  #aob-name h2{margin:0 0 4px;font-size:26px;}
  #aob-name .sub{font-size:15px;opacity:.75;margin-bottom:14px;}
  #aob-name input{width:100%;box-sizing:border-box;font-family:inherit;font-size:20px;font-weight:bold;
    text-align:center;padding:11px 10px;border:3px solid #2b2b2b;border-radius:12px;background:#fff;}
  #aob-name .row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px;}
  #aob-name button{font-family:inherit;font-weight:bold;cursor:pointer;border:3px solid #2b2b2b;
    border-radius:12px;padding:12px 0;font-size:17px;}
  #aob-name .save{background:#9ad42b;color:#14310a;}
  #aob-name .skip{background:#fff;}
  #aob-name button:active{transform:translateY(2px);}
  `;
  document.head.appendChild(style);
}

function finish(value) {
  if (!resolveCurrent) return;
  const done = resolveCurrent;
  resolveCurrent = null;
  root.classList.add('aob-hidden');
  done(value);
}

function buildOnce() {
  if (root) return;
  injectStyle();
  root = el('div');
  root.id = 'aob-name';
  root.classList.add('aob-hidden');

  const card = el('div', 'card');
  card.appendChild(el('h2', null, '🏆 Top 10!'));
  const sub = el('div', 'sub', '');
  card.appendChild(sub);

  input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 12;
  input.placeholder = 'Your name';
  // Stop the on-screen keyboard from "helpfully" rewriting short nicknames.
  input.autocomplete = 'off';
  input.autocapitalize = 'characters';
  input.spellcheck = false;
  card.appendChild(input);

  const row = el('div', 'row');
  const save = el('button', 'save', 'Save');
  const skip = el('button', 'skip', 'Skip');
  row.appendChild(save);
  row.appendChild(skip);
  card.appendChild(row);
  root.appendChild(card);
  document.body.appendChild(root);

  save.addEventListener('click', () => finish(input.value));
  skip.addEventListener('click', () => finish(null));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') finish(input.value);
    // Don't let arrow keys / space reach the game underneath.
    e.stopPropagation();
  });
  root.sub = sub;
}

/**
 * Ask for a name. Resolves with the entered string, or null if skipped.
 * Calling it again while a prompt is open resolves the previous one as skipped.
 */
export function askName({ defaultName = '', rank = 0, score = 0 } = {}) {
  buildOnce();
  finish(null);
  root.sub.textContent = `Rank #${rank} — ${score.toFixed(1)}s`;
  input.value = defaultName;
  root.classList.remove('aob-hidden');
  // Deliberately not auto-focused: on mobile that throws the keyboard over the
  // score the moment the run ends. The player taps the field when ready.
  return new Promise((resolve) => {
    resolveCurrent = resolve;
  });
}

// Force-close (scene teardown) without resolving as a save.
export function closeNameEntry() {
  finish(null);
}
