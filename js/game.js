// ===== GAME UI: screens, input, animation, sound, saving =====
{
// ===== UI / RENDERING =====
const $ = s => document.querySelector(s);
const DPR = Math.min(2.5, window.devicePixelRatio || 1);

// ---------- save data ----------
const SAVE_KEY = 'jewel-cascade.v1';
const save = { unlocked: 1, stars: {}, best: {}, endless: 0, timed: 0, sound: true, vib: true };
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY)) || {}); } catch (e) { }
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { } }

// ---------- sound (synthesised) ----------
const Sfx = (() => {
  let ac = null, out = null, nbuf = null;
  function unlock() {
    if (!ac) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        out = ac.createGain(); out.gain.value = 0.55; out.connect(ac.destination);
        nbuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { ac = null; }
    }
    if (ac && ac.state === 'suspended') ac.resume().catch(() => { });
  }
  const ok = () => save.sound && ac && ac.state === 'running';
  function tone(f, dur, o = {}) {
    if (!ok()) return;
    const t = ac.currentTime + (o.at || 0), osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, f * o.slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.vol || 0.2, t + (o.attack || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + dur + 0.05);
  }
  function noise(dur, o = {}) {
    if (!ok()) return;
    const t = ac.currentTime + (o.at || 0), src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = nbuf; f.type = 'bandpass'; f.Q.value = o.q || 1; f.frequency.setValueAtTime(o.f || 1000, t);
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.f * o.sweep, t + dur);
    g.gain.setValueAtTime(o.vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(out); src.start(t); src.stop(t + dur + 0.05);
  }
  const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5, 1568, 1760];
  const st = (b, s) => b * 2 ** (s / 12);
  return {
    unlock,
    tap() { tone(760, 0.06, { vol: 0.08 }); },
    swap() { tone(480, 0.09, { type: 'triangle', vol: 0.12, slide: 1.5 }); },
    bad() { tone(240, 0.1, { type: 'square', vol: 0.05 }); tone(190, 0.14, { type: 'square', vol: 0.05, at: 0.09 }); },
    match(k) { const f = scale[Math.min(scale.length - 1, k - 1)]; tone(f, 0.38, { type: 'triangle', vol: 0.2 }); tone(f * 2, 0.26, { vol: 0.07, at: 0.02 }); tone(f * 1.5, 0.3, { vol: 0.05, at: 0.05 }); },
    special() { [0, 4, 7, 12].forEach((s, i) => tone(st(784, s), 0.22, { type: 'triangle', vol: 0.12, at: i * 0.05 })); },
    line() { noise(0.35, { vol: 0.22, f: 700, sweep: 6, q: 2 }); tone(1300, 0.28, { type: 'sawtooth', vol: 0.03, slide: 0.35 }); },
    blast() { tone(150, 0.5, { vol: 0.45, slide: 0.3 }); noise(0.45, { vol: 0.28, f: 380, q: 0.7 }); },
    zap() { for (let i = 0; i < 9; i++) tone(st(1046, i * 2), 0.14, { vol: 0.06, at: i * 0.028 }); noise(0.5, { vol: 0.1, f: 3200, q: 3 }); },
    ice() { noise(0.14, { vol: 0.2, f: 5200, q: 4 }); tone(2600, 0.08, { vol: 0.05, at: 0.02 }); },
    star(i) { tone(st(880, i * 4), 0.35, { type: 'triangle', vol: 0.17 }); tone(st(1760, i * 4), 0.25, { vol: 0.05, at: 0.03 }); },
    win() { [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone(st(523, s), 0.4, { type: 'triangle', vol: 0.14, at: i * 0.08 })); },
    lose() { [7, 4, 0, -5].forEach((s, i) => tone(st(392, s), 0.45, { type: 'triangle', vol: 0.13, at: i * 0.17 })); },
    tick() { tone(1500, 0.05, { type: 'square', vol: 0.035 }); },
    rush() { tone(st(1046, Math.floor(Math.random() * 8)), 0.12, { type: 'triangle', vol: 0.09 }); },
  };
})();
const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;
function buzz(p) { if (save.vib && canVibrate) try { navigator.vibrate(p); } catch (e) { } }

const gemURL = (ci, s = 0) => sprite(ci, s, 112).toDataURL();
const iceURL = v => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 112; const c = cv.getContext('2d');
  c.drawImage(iceSprite(v, 112), 0, 0); return cv.toDataURL();
};
const STAR = on => `<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill="${on ? '#ffd76a' : 'rgba(255,255,255,.18)'}" stroke="${on ? '#9a6212' : 'rgba(0,0,0,.25)'}" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
const ICON = {
  sound: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path class="w" d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  vib: '<svg viewBox="0 0 24 24"><rect x="8" y="3" width="8" height="18" rx="2"/><path d="M4 8v8M20 8v8"/></svg>',
  lock: '<svg class="lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>',
};

// ---------- tween engine ----------
const anims = [];
function tween(dur, fn) { return new Promise(res => anims.push({ t0: performance.now(), dur: dur / G.speed, fn, res })); }
const wait = ms => tween(ms, () => { });
const easeIO = t => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
const easeOutBack = t => { const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
const fallEase = t => t < 0.82 ? (t / 0.82) ** 2 : 1 - 0.07 * Math.sin((t - 0.82) / 0.18 * Math.PI);
const fmt = n => Math.round(n).toLocaleString('en-US');

// ---------- state ----------
const G = {
  screen: 'home', mode: null, lv: null, eng: null, sprites: new Map(), ice: null,
  busy: true, movesUsed: 0, timeLeft: 0, running: false, over: false, modal: false,
  disp: { score: 0, collected: Array(7).fill(0) }, shown: 0, rushLeft: -1,
  sel: null, drag: null, hint: null, lastInput: 0,
  effects: [], parts: [], pops: [], shake: 0, cs: 40, size: 360, speed: 1, gen: 0,
};
const board = $('#board'), bctx = board.getContext('2d');

// ---------- screens ----------
function show(id) {
  G.screen = id;
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  if (id === 'home') refreshHome();
  if (id === 'map') renderMap();
  if (id === 'game') layout();
}
function totalStars() { return Object.values(save.stars).reduce((a, b) => a + b, 0); }
function refreshHome() {
  const done = Math.min(LEVEL_COUNT, Object.keys(save.stars).length);
  $('#lvProg').textContent = done ? `${done} of ${LEVEL_COUNT} cleared · ${totalStars()} ★` : `${LEVEL_COUNT} levels · goals & stars`;
  $('#endBest').textContent = save.endless ? `Best ${fmt(save.endless)} · no move limit` : 'No move limit · relax';
  $('#timBest').textContent = save.timed ? `Best ${fmt(save.timed)} · 90 seconds` : '90 seconds · score big';
  syncToggles();
}
function syncToggles() {
  document.querySelectorAll('[data-act=sound]').forEach(b => { b.setAttribute('aria-pressed', save.sound); b.innerHTML = save.sound ? ICON.sound : ICON.mute; });
  document.querySelectorAll('[data-act=vib]').forEach(b => { b.setAttribute('aria-pressed', save.vib); b.innerHTML = ICON.vib; b.hidden = !canVibrate; });
}
const CHAPTERS = ['Ruby Mine', 'Topaz Hollow', 'Citrine Falls', 'Emerald Caves', 'Sapphire Deep', 'Amethyst Crown'];
function renderMap() {
  $('#starTotal').innerHTML = STAR(true) + `<span>${totalStars()} / ${LEVEL_COUNT * 3}</span>`;
  let h = '';
  for (let ch = 0; ch < Math.ceil(LEVEL_COUNT / 6); ch++) {
    const gem = GEM[[0, 1, 2, 3, 4, 5][ch]], cs = hexRgb(gem.base), cd = hexRgb(gem.dark);
    const got = [1, 2, 3, 4, 5, 6].reduce((a, i) => a + (save.stars[ch * 6 + i] || 0), 0);
    h += `<div class="chapter"><img src="${gemURL(ch)}" alt="">${CHAPTERS[ch]}<span>${got} / 18 ★</span></div><div class="lvrow">`;
    for (let i = 1; i <= 6; i++) {
      const n = ch * 6 + i; if (n > LEVEL_COUNT) break;
      const locked = n > save.unlocked, st = save.stars[n] || 0;
      h += `<button class="lv${n === save.unlocked && !st ? ' next' : ''}" data-act="level" data-n="${n}" ${locked ? 'disabled aria-label="Level ' + n + ' locked"' : 'aria-label="Level ' + n + ', ' + st + ' stars"'}
        style="--c1:${mixc(cs, [255, 255, 255], 0.15)};--c2:${mixc(cd, [0, 0, 0], 0.1)}">${locked ? ICON.lock : `<span>${n}</span><span class="st">${STAR(st > 0) + STAR(st > 1) + STAR(st > 2)}</span>`}</button>`;
    }
    h += '</div>';
  }
  $('#levels').innerHTML = h;
  const nx = $('#levels .next'); if (nx) nx.scrollIntoView({ block: 'center' });
}

// ---------- modal ----------
function openModal(html) { $('#card').innerHTML = html; $('#modal').classList.remove('hidden'); G.modal = true; syncToggles(); }
function closeModal() { $('#modal').classList.add('hidden'); G.modal = false; G.lastInput = performance.now(); }
function goalChips(lv, big) {
  if (!lv) return '';
  let h = '';
  if (lv.score) h += `<div class="goal">${STAR(true).replace('<svg', '<svg width="32" height="32"')}<span>${fmt(lv.score)} pts</span></div>`;
  if (lv.ice) { let n = 0; lv.ice.forEach(r => r.forEach(v => n += v > 0)); h += `<div class="goal"><img src="${iceURL(1)}" alt="Frost"><span>Crack ${n} frost</span></div>`; }
  lv.collect.forEach(([c, n]) => h += `<div class="goal"><img src="${gemURL(c)}" alt="${GEM[c].name}"><span>Collect ${n}</span></div>`);
  return h;
}
function howHTML() {
  return `<h2>How to play</h2>
  <div class="how">
    <div><img src="${gemURL(4)}" alt=""><p><b>Swipe</b> a gem into a neighbour to swap them — or tap one gem, then the next. Line up 3 or more of the same gem.</p></div>
    <div><img src="${gemURL(0, SP.H)}" alt=""><p><b>Line gem</b> — match 4 in a row. Fires across its whole row or column.</p></div>
    <div><img src="${gemURL(3, SP.WRAP)}" alt=""><p><b>Set gem</b> — match in an L or T. Bursts a 3×3 area.</p></div>
    <div><img src="${gemURL(0, SP.BOMB)}" alt=""><p><b>Prism</b> — match 5 in a row. Swap it with any gem to clear every gem of that colour.</p></div>
    <div><img src="${gemURL(5, SP.V)}" alt=""><p><b>Combos</b> — swap two special gems together for a bigger blast. Prism + Prism clears the board.</p></div>
    <div><img src="${iceURL(2)}" alt=""><p><b>Frost</b> — match on top of frosted tiles to crack them. Thick frost needs two hits.</p></div>
  </div>
  <p>Each gem has its own shape as well as its own colour. Leftover moves turn into a Jewel Rush of bonus points.</p>
  <div class="stack"><button class="btn" data-act="close">Got it</button></div>`;
}

// ---------- layout ----------
function layout() {
  if (G.screen !== 'game') return;
  const scr = $('#game'), cs0 = getComputedStyle(scr), wrap = $('#boardWrap');
  const h = scr.clientHeight - parseFloat(cs0.paddingTop) - parseFloat(cs0.paddingBottom) - $('.hud').offsetHeight - $('#goals').offsetHeight - 24;
  const w = scr.clientWidth - parseFloat(cs0.paddingLeft) - parseFloat(cs0.paddingRight);
  const avail = Math.min(w, h) - 12;
  const cs = Math.max(26, Math.floor(avail / N)), size = cs * N;
  G.cs = cs; G.size = size;
  board.style.width = board.style.height = size + 'px';
  board.width = board.height = Math.round(size * DPR);
  wrap.style.height = (size + 12) + 'px';
}
window.addEventListener('resize', layout);

// ---------- game start ----------
function startGame(mode, n) {
  const lv = mode === 'level' ? makeLevel(n) : null;
  G.mode = mode; G.lv = lv; G.gen++; G.speed = 1; anims.length = 0;
  G.eng = new Engine({ colors: lv ? lv.colors : 6, ice: lv && lv.ice });
  G.ice = G.eng.ice.map(r => r.slice());
  G.sprites = new Map();
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const g = G.eng.g[r][c]; addSprite(g.id, g.c, g.s, r, c); }
  G.disp = { score: 0, collected: Array(7).fill(0) }; G.shown = 0;
  G.movesUsed = 0; G.timeLeft = mode === 'timed' ? 90 : 0; G.running = false; G.over = false; G.rushLeft = -1;
  G.sel = null; G.hint = null; G.effects = []; G.parts = []; G.pops = []; G.busy = true;
  $('#modeLbl').textContent = lv ? `Level ${n} · ${CHAPTERS[Math.floor((n - 1) / 6)]}` : mode === 'timed' ? 'Time attack' : 'Endless';
  buildBar(); show('game'); hud();
  if (lv) openModal(`<h2>Level ${n}</h2><p>${lv.moves} moves · ${lv.colors} gem colours</p><div class="goallist">${goalChips(lv)}</div>
    <div class="stack"><button class="btn" data-act="begin">Play</button><button class="btn ghost" data-act="map">Back to levels</button></div>`);
  else begin();
}
async function begin() {
  closeModal();
  const gen = G.gen;
  // drop-in
  const list = [...G.sprites.values()];
  list.forEach(s => { s.y0 = s.y; s.y -= N + 1; });
  await tween(650, (t, el) => list.forEach(s => { const u = Math.min(1, Math.max(0, (el - s.x * 30 - (N - s.y0) * 12) / 420)); s.y = s.y0 - (N + 1) * (1 - fallEase(u)); }));
  if (gen !== G.gen) return;
  list.forEach(s => s.y = s.y0);
  if (G.mode === 'timed') { banner('Go!'); Sfx.special(); }
  G.busy = false; G.running = true; G.lastInput = performance.now();
}
function addSprite(id, c, s, r, col) { const o = { id, c, s, x: col, y: r, sc: 1, a: 1, pop: 0 }; G.sprites.set(id, o); return o; }

// ---------- HUD ----------
function buildBar() {
  const lv = G.lv, bar = $('#bar');
  bar.querySelectorAll('b').forEach(b => b.remove());
  bar.style.visibility = lv ? 'visible' : 'hidden';
  if (!lv) return;
  const max = lv.stars[2];
  lv.stars.forEach((s, i) => { if (!s) return; const b = document.createElement('b'); b.style.left = Math.min(97, s / max * 100) + '%'; b.dataset.i = i; b.innerHTML = STAR(false); bar.appendChild(b); });
}
function goalState() {
  const lv = G.lv, out = [];
  if (!lv) return out;
  if (lv.ice) { let n = 0; G.ice.forEach(r => r.forEach(v => n += v > 0)); out.push({ k: 'ice', left: n }); }
  lv.collect.forEach(([c, n]) => out.push({ k: 'col', c, left: Math.max(0, n - G.disp.collected[c]) }));
  if (lv.score) out.push({ k: 'score', left: Math.max(0, lv.score - G.disp.score) });
  return out;
}
function hud() {
  const lv = G.lv, mv = $('#movesVal'), lbl = $('#movesLbl');
  if (G.mode === 'level') {
    const left = G.rushLeft >= 0 ? G.rushLeft : lv.moves - G.movesUsed;
    mv.textContent = left; lbl.textContent = left === 1 ? 'move' : 'moves'; mv.classList.toggle('warn', left <= 3 && G.rushLeft < 0);
  } else if (G.mode === 'timed') {
    const t = Math.ceil(G.timeLeft); mv.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; lbl.textContent = 'time'; mv.classList.toggle('warn', t <= 10);
  } else { mv.textContent = fmt(Math.max(save.endless, G.disp.score)); lbl.textContent = 'best'; mv.classList.remove('warn'); mv.style.fontSize = '20px'; }
  if (G.mode !== 'endless') mv.style.fontSize = '';
  let h = '';
  if (lv) {
    for (const g of goalState()) {
      if (g.k === 'score') continue;
      const img = g.k === 'ice' ? `<img src="${ICE_URL1}" alt="Frost">` : `<img src="${GEM_URLS[g.c]}" alt="${GEM[g.c].name}">`;
      h += `<div class="goal${g.left ? '' : ' done'}">${img}<span>${g.left ? g.left : '<em>✓</em>'}</span></div>`;
    }
    if (lv.score && !h) h = G.disp.score >= lv.score ? `<div class="goal done">${STAR(true).replace('<svg', '<svg width="28" height="28"')}<span><em>✓</em> ${fmt(lv.score)} points</span></div>` : `<div class="goalnote">Reach ${fmt(lv.score)} points</div>`;
    else if (lv.score) h += `<div class="goal${G.disp.score >= lv.score ? ' done' : ''}">${STAR(true).replace('<svg', '<svg width="28" height="28"')}<span>${G.disp.score >= lv.score ? '<em>✓</em>' : fmt(lv.score)}</span></div>`;
  } else h = `<div class="goalnote">${G.mode === 'timed' ? 'Chain cascades fast — the clock keeps running' : 'No move limit — play at your own pace'}</div>`;
  if ($('#goals').innerHTML !== h) $('#goals').innerHTML = h;
}
function hudScore() {
  if (Math.abs(G.shown - G.disp.score) < 1) G.shown = G.disp.score; else G.shown += (G.disp.score - G.shown) * 0.18;
  const el = $('#scoreVal'), txt = fmt(G.shown);
  if (el.textContent !== txt) {
    el.textContent = txt;
    if (G.lv) {
      $('#barFill').style.width = Math.min(100, G.shown / G.lv.stars[2] * 100) + '%';
      $('#bar').querySelectorAll('b').forEach(b => { const on = G.shown >= G.lv.stars[b.dataset.i]; if (b.dataset.on !== String(on)) { b.dataset.on = on; b.innerHTML = STAR(on); } });
    }
    if (G.mode === 'endless') hud();
  }
}
function banner(text) {
  const s = $('#banner span'); s.textContent = text; s.classList.remove('go'); void s.offsetWidth; s.classList.add('go');
}

// ---------- input ----------
function cellAt(e) {
  const r = board.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / r.width * N), y = Math.floor((e.clientY - r.top) / r.height * N);
  return x >= 0 && y >= 0 && x < N && y < N ? [y, x] : null;
}
const canPlay = () => G.screen === 'game' && !G.busy && !G.modal && !G.over && G.running && !(G.mode === 'timed' && G.timeLeft <= 0);
board.addEventListener('pointerdown', e => {
  Sfx.unlock(); G.lastInput = performance.now(); G.hint = null;
  if (!canPlay()) return;
  const p = cellAt(e); if (!p) return;
  try { board.setPointerCapture(e.pointerId); } catch (_) { }
  G.drag = { p, x: e.clientX, y: e.clientY, done: false };
  e.preventDefault();
});
board.addEventListener('pointermove', e => {
  const d = G.drag; if (!d || d.done) return;
  const dx = e.clientX - d.x, dy = e.clientY - d.y, th = board.getBoundingClientRect().width / N * 0.3;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < th) return;
  d.done = true;
  const [r, c] = d.p, t = Math.abs(dx) > Math.abs(dy) ? [r, c + Math.sign(dx)] : [r + Math.sign(dy), c];
  if (t[0] < 0 || t[1] < 0 || t[0] >= N || t[1] >= N) return;
  G.sel = null; attemptSwap(d.p, t);
});
function endDrag() {
  const d = G.drag; G.drag = null; if (!d || d.done || !canPlay()) return;
  const s = G.sel, p = d.p;
  if (s && Math.abs(s[0] - p[0]) + Math.abs(s[1] - p[1]) === 1) { G.sel = null; attemptSwap(s, p); }
  else if (s && s[0] === p[0] && s[1] === p[1]) G.sel = null;
  else { G.sel = p; Sfx.tap(); }
}
board.addEventListener('pointerup', endDrag);
board.addEventListener('pointercancel', () => { G.drag = null; });

async function attemptSwap(a, b) {
  if (!canPlay()) return;
  G.busy = true; G.hint = null; G.sel = null;
  const res = G.eng.trySwap(a, b);
  if (!res.valid) { const gen = G.gen; Sfx.bad(); buzz(10); await playPhases(res.phases); if (gen === G.gen) G.busy = false; return; }
  Sfx.swap(); G.movesUsed++; hud();
  const gen = G.gen;
  await playPhases(res.phases);
  if (gen !== G.gen) return;
  G.busy = false;
  afterMove();
}

// ---------- phase animation ----------
async function playPhases(phases) {
  const gen = G.gen;
  for (const ph of phases) {
    if (gen !== G.gen) return;
    if (ph.t === 'swap' || ph.t === 'unswap') await animSwap(ph);
    else if (ph.t === 'clear') await animClear(ph);
    else if (ph.t === 'fall') await animFall(ph);
    else if (ph.t === 'transform') await animTransform(ph);
    else if (ph.t === 'shuffle') await animShuffle(ph);
  }
}
async function animSwap(ph) {
  const [A, B] = ph.ids.map(id => G.sprites.get(id));
  const ta = ph.t === 'swap' ? ph.b : ph.a, tb = ph.t === 'swap' ? ph.a : ph.b;
  const ax = A.x, ay = A.y, bx = B.x, by = B.y;
  await tween(ph.t === 'swap' ? 150 : 170, t => {
    const e = easeIO(t);
    A.x = ax + (ta[1] - ax) * e; A.y = ay + (ta[0] - ay) * e; B.x = bx + (tb[1] - bx) * e; B.y = by + (tb[0] - by) * e;
    A.sc = 1 + 0.12 * Math.sin(t * Math.PI);
  });
}
const WORDS = [null, null, null, 'Brilliant!', 'Dazzling!', 'Radiant!', 'Magnificent!'];
async function animClear(ph) {
  let big = 0;
  for (const ef of ph.effects) {
    addEffect(ef);
    if (ef.t === 'line') big = Math.max(big, 1);
    if (ef.t === 'blast') big = Math.max(big, ef.rad > 1 ? 2 : 1);
    if (ef.t === 'zap' || ef.t === 'nova') big = 2;
  }
  Sfx.match(ph.cascade);
  if (ph.effects.some(e => e.t === 'line')) Sfx.line();
  if (ph.effects.some(e => e.t === 'blast')) Sfx.blast();
  if (ph.effects.some(e => e.t === 'zap' || e.t === 'nova')) Sfx.zap();
  if (ph.created.length) Sfx.special();
  if (ph.ice.length) Sfx.ice();
  buzz(big === 2 ? [25, 30, 45] : big || ph.created.length ? 30 : 12);
  if (big) G.shake = Math.max(G.shake, big === 2 ? 11 : 5);
  for (const h of ph.ice) { G.ice[h.r][h.c] = h.v; burst(h.c + 0.5, h.r + 0.5, '#d8f2ff', 7, 0.8); }
  G.disp.score += ph.score; ph.collected.forEach((v, i) => G.disp.collected[i] += v);
  if (ph.cleared.length) {
    let sx = 0, sy = 0; ph.cleared.forEach(x => { sx += x.c; sy += x.r; });
    G.pops.push({ x: sx / ph.cleared.length + 0.5, y: sy / ph.cleared.length + 0.5, text: '+' + fmt(ph.score), t0: performance.now(), big: ph.score >= 1500 });
  }
  if (G.rushLeft < 0) {
    if (ph.effects.some(e => e.t === 'nova')) banner('Spectacular!');
    else if (ph.cascade >= 3) banner(WORDS[Math.min(6, ph.cascade)]);
  }
  const gone = ph.cleared.map(x => G.sprites.get(x.id)).filter(Boolean);
  gone.forEach(s => burst(s.x + 0.5, s.y + 0.5, s.s === SP.BOMB ? null : GEM[s.c].base, s.s ? 12 : 6, 1));
  const born = ph.created.map(x => { const s = addSprite(x.id, x.col, x.sp, x.r, x.c); s.sc = 0; return s; });
  hud();
  await tween(250, t => {
    gone.forEach(s => { s.sc = t < 0.3 ? 1 + 0.22 * (t / 0.3) : 1.22 * (1 - (t - 0.3) / 0.7); s.a = t < 0.45 ? 1 : 1 - (t - 0.45) / 0.55; });
    born.forEach(s => { s.sc = t < 0.4 ? 0 : easeOutBack((t - 0.4) / 0.6); });
  });
  gone.forEach(s => G.sprites.delete(s.id));
  born.forEach(s => { s.sc = 1; s.pop = 0.3; });
  if (big === 2) await wait(120);
}
async function animFall(ph) {
  const items = [];
  for (const m of ph.moves) { const s = G.sprites.get(m.id); if (s) items.push({ s, y0: s.y, y1: m.r }); }
  for (const sp of ph.spawns) { const s = addSprite(sp.id, sp.col, sp.sp, sp.from, sp.c); items.push({ s, y0: sp.from, y1: sp.r }); }
  if (!items.length) return;
  items.forEach(it => it.dur = 150 + 75 * Math.sqrt(Math.max(0.05, it.y1 - it.y0)));
  const max = Math.max(...items.map(i => i.dur));
  await tween(max, (t, el) => { for (const it of items) { const u = Math.min(1, el / it.dur); it.s.y = it.y0 + (it.y1 - it.y0) * fallEase(u); } });
  items.forEach(it => it.s.y = it.y1);
}
async function animTransform(ph) {
  if (ph.rush) {
    for (const it of ph.items) {
      const s = G.sprites.get(it.id); if (!s) continue;
      s.s = it.s; s.pop = 0.45; burst(s.x + 0.5, s.y + 0.5, '#fff6c8', 6, 0.7); Sfx.rush(); buzz(8);
      if (G.rushLeft > 0) { G.rushLeft--; hud(); }
      await wait(70);
    }
    await wait(220);
    return;
  }
  addEffect({ t: 'zap', r: ph.r, c: ph.c, targets: ph.items.map(i => [i.r, i.c]) }); Sfx.zap(); buzz([20, 30]);
  await wait(220);
  ph.items.forEach(it => { const s = G.sprites.get(it.id); if (s) { s.s = it.s; s.pop = 0.4; } });
  Sfx.special(); await wait(320);
}
async function animShuffle(ph) {
  banner('Shuffle!');
  const items = ph.moves.map(m => { const s = G.sprites.get(m.id); return { s, x0: s.x, y0: s.y, m }; });
  await wait(300);
  await tween(450, t => { const e = easeIO(t); items.forEach(({ s, x0, y0, m }) => { s.x = x0 + (m.c - x0) * e; s.y = y0 + (m.r - y0) * e; s.sc = 1 - 0.3 * Math.sin(t * Math.PI); if (t > 0.5) s.c = m.col; }); });
}

// ---------- effects & particles ----------
function addEffect(ef) {
  const e = { ...ef, t0: performance.now() };
  if (e.t === 'zap') e.dur = 520; else if (e.t === 'nova') e.dur = 800; else if (e.t === 'blast') e.dur = 480; else e.dur = 420;
  G.effects.push(e);
}
function burst(x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = (0.003 + Math.random() * 0.006) * speed;
    G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.004, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.02, size: 0.07 + Math.random() * 0.09,
      color: color || GEM[Math.floor(Math.random() * 7)].base, life: 0, max: 500 + Math.random() * 400 });
  }
}

// ---------- rendering ----------
function render(now, dt) {
  const c = bctx, cs = G.cs, S = G.size;
  c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, S, S);
  if (G.shake > 0.3) { c.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake); G.shake *= 0.86; } else G.shake = 0;
  // cells
  for (let r = 0; r < N; r++) for (let x = 0; x < N; x++) {
    c.fillStyle = (r + x) % 2 ? 'rgba(255,255,255,.035)' : 'rgba(255,255,255,.075)';
    c.beginPath(); c.roundRect(x * cs + 1.5, r * cs + 1.5, cs - 3, cs - 3, cs * 0.18); c.fill();
  }
  if (G.ice) for (let r = 0; r < N; r++) for (let x = 0; x < N; x++) { const v = G.ice[r][x]; if (v) c.drawImage(iceSprite(v, cs * DPR), x * cs, r * cs, cs, cs); }
  // selection
  if (G.sel) {
    const [r, x] = G.sel, p = 0.5 + 0.5 * Math.sin(now / 160);
    c.save(); c.strokeStyle = `rgba(255,232,150,${0.6 + 0.4 * p})`; c.lineWidth = 3; c.shadowColor = '#ffd76a'; c.shadowBlur = 12;
    c.beginPath(); c.roundRect(x * cs + 3, r * cs + 3, cs - 6, cs - 6, cs * 0.2); c.stroke(); c.restore();
  }
  // gems
  const px = cs * DPR, hint = G.hint;
  for (const s of G.sprites.values()) {
    if (s.y < -1.2) continue;
    let sc = s.sc * (1 + s.pop), ox = 0, oy = 0;
    if (s.pop > 0.001) s.pop *= 0.86; else s.pop = 0;
    if (hint && !G.busy) {
      const ia = hint.a[0] === s.y && hint.a[1] === s.x, ib = hint.b[0] === s.y && hint.b[1] === s.x;
      if (ia || ib) { const w = Math.max(0, Math.sin(now / 130)) * 0.12, o = ia ? hint.b : hint.a; ox = (o[1] - s.x) * w; oy = (o[0] - s.y) * w; sc *= 1 + w * 0.6; }
    }
    if (sc <= 0.01 || s.a <= 0.01) continue;
    const cx = (s.x + ox + 0.5) * cs, cy = (s.y + oy + 0.5) * cs;
    c.globalAlpha = s.a;
    if (s.s === SP.BOMB) drawPrism(c, cx, cy, cs * 0.39 * sc, now);
    else { const sz = cs * sc; c.drawImage(sprite(s.c, s.s, px), cx - sz / 2, cy - sz / 2, sz, sz); }
  }
  c.globalAlpha = 1;
  // ambient glints
  if (Math.random() < dt / 260 && G.sprites.size) {
    const arr = [...G.sprites.values()], s = arr[Math.floor(Math.random() * arr.length)];
    if (s.s !== SP.BOMB) G.pops.push({ glint: 1, x: s.x + 0.25 + Math.random() * 0.2, y: s.y + 0.22 + Math.random() * 0.2, t0: now });
  }
  // effects
  c.save(); c.globalCompositeOperation = 'lighter';
  G.effects = G.effects.filter(e => {
    const p = (now - e.t0) / e.dur; if (p >= 1) return false;
    const cx = (e.c + 0.5) * cs, cy = (e.r + 0.5) * cs, fade = 1 - p;
    if (e.t === 'line') {
      const w = cs * (0.25 + 0.75 * fade);
      const g = e.dir === 'h' ? c.createLinearGradient(0, cy - w / 2, 0, cy + w / 2) : c.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
      g.addColorStop(0, 'rgba(255,220,140,0)'); g.addColorStop(0.5, `rgba(255,255,255,${fade})`); g.addColorStop(1, 'rgba(255,220,140,0)');
      c.fillStyle = g; if (e.dir === 'h') c.fillRect(0, cy - w / 2, S, w); else c.fillRect(cx - w / 2, 0, w, S);
      const d = p * S * 1.2;
      for (const sg of [-1, 1]) { const hx = e.dir === 'h' ? cx + sg * d : cx, hy = e.dir === 'h' ? cy : cy + sg * d; const rg = c.createRadialGradient(hx, hy, 0, hx, hy, cs * 0.8); rg.addColorStop(0, `rgba(255,255,255,${fade})`); rg.addColorStop(1, 'rgba(255,200,120,0)'); c.fillStyle = rg; c.fillRect(hx - cs, hy - cs, cs * 2, cs * 2); }
    } else if (e.t === 'blast') {
      const R = (e.rad + 0.7) * cs * (0.3 + 0.7 * Math.sqrt(p));
      const rg = c.createRadialGradient(cx, cy, 0, cx, cy, R); rg.addColorStop(0, `rgba(255,250,220,${fade * 0.9})`); rg.addColorStop(0.6, `rgba(255,190,80,${fade * 0.5})`); rg.addColorStop(1, 'rgba(255,150,50,0)');
      c.fillStyle = rg; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fill();
      c.strokeStyle = `rgba(255,230,160,${fade})`; c.lineWidth = cs * 0.25 * fade; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke();
    } else if (e.t === 'zap') {
      c.strokeStyle = `rgba(220,240,255,${fade})`; c.lineWidth = 2.2; c.shadowColor = '#b9e2ff'; c.shadowBlur = 10;
      c.beginPath();
      for (const [tr, tc] of e.targets) {
        const tx = (tc + 0.5) * cs, ty = (tr + 0.5) * cs; c.moveTo(cx, cy);
        for (let k = 1; k <= 5; k++) { const f = k / 5, j = k < 5 ? (Math.random() - 0.5) * cs * 0.5 : 0; c.lineTo(cx + (tx - cx) * f + j, cy + (ty - cy) * f - j); }
      }
      c.stroke(); c.shadowBlur = 0;
      const rg = c.createRadialGradient(cx, cy, 0, cx, cy, cs * 1.5); rg.addColorStop(0, `rgba(255,255,255,${fade})`); rg.addColorStop(1, 'rgba(180,140,255,0)'); c.fillStyle = rg; c.fillRect(cx - cs * 1.5, cy - cs * 1.5, cs * 3, cs * 3);
    } else if (e.t === 'nova') {
      c.fillStyle = `rgba(255,255,255,${fade * fade * 0.8})`; c.fillRect(0, 0, S, S);
      c.strokeStyle = `rgba(255,220,160,${fade})`; c.lineWidth = cs * 0.5 * fade; c.beginPath(); c.arc(cx, cy, p * S * 1.1, 0, 7); c.stroke();
    }
    return true;
  });
  c.restore();
  // particles
  G.parts = G.parts.filter(p => {
    p.life += dt; if (p.life >= p.max) return false;
    p.vy += 0.000012 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    const a = 1 - p.life / p.max, s = p.size * cs;
    c.save(); c.globalAlpha = a; c.translate(p.x * cs, p.y * cs); c.rotate(p.rot); c.fillStyle = p.color;
    c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.6, 0); c.lineTo(0, s); c.lineTo(-s * 0.6, 0); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.6, 0); c.lineTo(0, 0); c.closePath(); c.fill();
    c.restore(); return true;
  });
  // pops
  G.pops = G.pops.filter(p => {
    const t = (now - p.t0) / (p.glint ? 600 : 900); if (t >= 1) return false;
    if (p.glint) { glint(c, p.x * cs, p.y * cs, cs * 0.16 * Math.sin(t * Math.PI), 0.9); return true; }
    const fs = Math.round(cs * (p.big ? 0.6 : 0.46));
    c.save(); c.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3; c.font = `800 ${fs}px Manrope, system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const x = Math.min(S - fs * 1.6, Math.max(fs * 1.6, p.x * cs)), y = (p.y - t * 0.9) * cs;
    c.lineWidth = Math.max(3, fs * 0.18); c.strokeStyle = 'rgba(40,10,60,.85)'; c.strokeText(p.text, x, y);
    c.fillStyle = p.big ? '#ffe08a' : '#fff'; c.fillText(p.text, x, y); c.restore(); return true;
  });
}

// home art: a floating cluster of gems
const home = $('#homeArt'), hctx = home.getContext('2d');
const CLUSTER = [[0, -0.95, 0.35, 0.9], [1, 0.95, 0.38, 0.8], [2, -0.45, 0.72, 0.75], [3, 0.5, -0.6, 0.85], [4, 0, 0, 1.25], [5, -0.6, -0.55, 0.78], [6, 0.48, 0.78, 0.7]];
function renderHome(now) {
  const w = home.clientWidth, h = home.clientHeight; if (!w || !h) return;
  if (home.width !== Math.round(w * DPR)) { home.width = Math.round(w * DPR); home.height = Math.round(h * DPR); }
  const c = hctx; c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, w, h);
  const u = Math.min(w / 3.2, h / 2.5), cx = w / 2, cy = h / 2;
  const rg = c.createRadialGradient(cx, cy, 0, cx, cy, u * 1.7); rg.addColorStop(0, 'rgba(255,215,120,.22)'); rg.addColorStop(1, 'rgba(255,215,120,0)');
  c.fillStyle = rg; c.fillRect(0, 0, w, h);
  CLUSTER.forEach(([ci, x, y, s], i) => {
    const bob = Math.sin(now / 900 + i * 1.3) * u * 0.05, size = u * s * 1.05;
    const img = ci === 4 && false ? null : sprite(ci, i === 4 ? 0 : 0, size * DPR);
    c.save(); c.translate(cx + x * u, cy + y * u + bob); c.rotate(Math.sin(now / 1400 + i) * 0.06);
    c.drawImage(img, -size / 2, -size / 2, size, size); c.restore();
  });
  const p = (now % 2400) / 2400, k = Math.floor(now / 2400) % CLUSTER.length, [, gx, gy, gs] = CLUSTER[k];
  glint(c, cx + gx * u - u * gs * 0.12, cy + gy * u - u * gs * 0.16 + Math.sin(now / 900 + k * 1.3) * u * 0.05, u * 0.16 * gs * Math.sin(p * Math.PI), 0.95);
}

// ---------- game flow ----------
function goalsMet() {
  const lv = G.lv, e = G.eng;
  if (e.score < lv.score) return false;
  if (lv.ice && e.iceLeft() > 0) return false;
  return lv.collect.every(([c, n]) => e.collected[c] >= n);
}
async function afterMove() {
  if (G.over) return;
  if (G.mode === 'level') {
    if (goalsMet()) return winLevel();
    if (G.movesUsed >= G.lv.moves) return loseLevel();
  } else if (G.mode === 'endless') {
    if (G.eng.score > save.endless) { save.endless = G.eng.score; persist(); }
  } else if (G.mode === 'timed' && G.timeLeft <= 0) endTimed();
}
async function winLevel() {
  G.over = true; G.busy = true; G.running = false;
  const lv = G.lv, left = lv.moves - G.movesUsed;
  banner('Goal complete!'); Sfx.win(); buzz([30, 40, 30]);
  const gen0 = G.gen;
  await wait(1100);
  if (gen0 !== G.gen) return;
  if (left > 0) {
    banner('Jewel Rush!'); G.rushLeft = left; hud(); await wait(700);
    const gen = G.gen; G.speed = 1.8;
    await playPhases(G.eng.rush(left));
    G.speed = 1; if (gen !== G.gen) return;
    G.rushLeft = 0; hud();
  }
  await wait(400);
  if (gen0 !== G.gen) return;
  const score = G.eng.score, stars = 1 + (score >= lv.stars[1]) + (score >= lv.stars[2]);
  const prevBest = save.best[lv.n] || 0, isBest = score > prevBest;
  save.stars[lv.n] = Math.max(save.stars[lv.n] || 0, stars);
  if (isBest) save.best[lv.n] = score;
  save.unlocked = Math.max(save.unlocked, Math.min(LEVEL_COUNT, lv.n + 1));
  persist();
  const last = lv.n >= LEVEL_COUNT;
  openModal(`<h2>${last ? 'Crown jewel!' : ['', 'Level complete', 'Brilliant!', 'Flawless!'][stars]}</h2>
    <div class="bigstars">${STAR(true) + STAR(true) + STAR(true)}</div>
    <div class="bigscore">${fmt(score)}</div>
    ${isBest && prevBest ? '<span class="newbest">New best</span>' : `<p>${stars < 3 ? `${fmt(lv.stars[stars])} for ${stars + 1} stars` : 'All three stars'}</p>`}
    ${last ? '<p>You cleared every level. Try Time attack for a new record.</p>' : ''}
    <div class="stack">${last ? '' : '<button class="btn" data-act="next">Next level</button>'}
    <div class="row2"><button class="btn ghost" data-act="replay">Replay</button><button class="btn ghost" data-act="map">Levels</button></div></div>`);
  const svgs = document.querySelectorAll('.bigstars svg');
  for (let i = 0; i < stars; i++) setTimeout(() => { svgs[i].classList.add('on'); Sfx.star(i); buzz(15); }, 350 + i * 380);
}
function loseLevel() {
  G.over = true; G.running = false; Sfx.lose(); buzz([60, 40, 60]);
  const miss = goalState().filter(g => g.left > 0).map(g => g.k === 'ice' ? `${g.left} frost tile${g.left > 1 ? 's' : ''}` : g.k === 'score' ? `${fmt(g.left)} points` : `${g.left} ${GEM[g.c].name}${g.left > 1 ? 's' : ''}`);
  const gl = G.gen;
  setTimeout(() => gl === G.gen && openModal(`<h2>Out of moves</h2><p>So close — still needed: ${miss.join(', ')}.</p>
    <div class="bigscore">${fmt(G.eng.score)}</div>
    <div class="stack"><button class="btn" data-act="replay">Try again</button><button class="btn ghost" data-act="map">Levels</button></div>`), 500);
}
function endTimed() {
  if (G.over) return;
  G.over = true; G.running = false;
  const score = G.eng.score, isBest = score > save.timed;
  if (isBest) { save.timed = score; persist(); }
  banner("Time's up!"); Sfx.win();
  const gt = G.gen;
  setTimeout(() => gt === G.gen && openModal(`<h2>Time's up!</h2><div class="bigscore">${fmt(score)}</div>
    ${isBest && score ? '<span class="newbest">New best</span>' : `<p>Best ${fmt(save.timed)}</p>`}
    <div class="stack"><button class="btn" data-act="timed">Play again</button><button class="btn ghost" data-act="home">Menu</button></div>`), 1100);
}
function pauseMenu() {
  if (G.over && G.mode !== 'endless') return;
  openModal(`<h2>Paused</h2>${G.lv ? `<div class="goallist">${goalChips(G.lv)}</div>` : `<p>Score ${fmt(G.disp.score)}</p>`}
    <div class="setrow"><button class="icon" data-act="sound" aria-label="Sound"></button><button class="icon" data-act="vib" aria-label="Vibration"></button></div>
    <div class="stack"><button class="btn" data-act="close">Resume</button>
    <div class="row2"><button class="btn ghost" data-act="restart">Restart</button><button class="btn ghost" data-act="how">How to play</button></div>
    <button class="btn ghost" data-act="${G.lv ? 'map' : 'home'}">${G.lv ? 'Quit to levels' : 'Quit to menu'}</button></div>`);
}

// ---------- actions ----------
let howReturn = null;
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  Sfx.unlock();
  const a = b.dataset.act;
  switch (a) {
    case 'map': closeModal(); show('map'); break;
    case 'home': closeModal(); show('home'); break;
    case 'endless': closeModal(); startGame('endless'); break;
    case 'timed': closeModal(); startGame('timed'); break;
    case 'level': Sfx.tap(); startGame('level', +b.dataset.n); break;
    case 'begin': begin(); break;
    case 'next': closeModal(); startGame('level', G.lv.n + 1); break;
    case 'replay': case 'restart': closeModal(); if (G.lv) startGame('level', G.lv.n); else startGame(G.mode); break;
    case 'pause': pauseMenu(); break;
    case 'how': howReturn = G.modal && G.screen === 'game' ? 'pause' : null; openModal(howHTML()); break;
    case 'close': if (howReturn === 'pause') { howReturn = null; pauseMenu(); } else closeModal(); break;
    case 'sound': save.sound = !save.sound; persist(); syncToggles(); if (save.sound) Sfx.tap(); break;
    case 'vib': save.vib = !save.vib; persist(); syncToggles(); buzz(30); break;
    case 'install': install(); break;
  }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && G.screen === 'game' && G.running && !G.modal && !G.over) pauseMenu(); });

// ---------- install (PWA) ----------
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let installEvt = null;
function syncInstall() { const b = $('.installpill'); if (b) b.hidden = isStandalone() || !(installEvt || isIOS); }
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; syncInstall(); });
window.addEventListener('appinstalled', () => { installEvt = null; syncInstall(); });
async function install() {
  if (installEvt) {
    installEvt.prompt();
    try { await installEvt.userChoice; } catch (e) { }
    installEvt = null; syncInstall(); return;
  }
  openModal(`<h2>Add to Home Screen</h2><p>Install Jewel Cascade to play full screen, even offline.</p>
    <ol class="steps">
      <li><span>In Safari, tap the <b>Share</b> button <svg viewBox="0 0 24 24"><path d="M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1"/></svg></span></li>
      <li><span>Scroll down and tap <b>Add to Home Screen</b></span></li>
      <li><span>Tap <b>Add</b>, then open the game from your Home Screen</span></li>
    </ol>
    <div class="stack"><button class="btn" data-act="close">Got it</button></div>`);
}
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
}

// ---------- main loop ----------
let lastT = performance.now(), lastTick = 99;
function frame(now) {
  const dt = Math.min(50, now - lastT); lastT = now;
  for (const a of anims.slice()) {
    const el = now - a.t0, t = Math.min(1, el / a.dur);
    a.fn(t, Math.min(el, a.dur));
    if (t >= 1) { anims.splice(anims.indexOf(a), 1); a.res(); }
  }
  if (G.screen === 'game') {
    if (G.mode === 'timed' && G.running && !G.modal && !G.over) {
      G.timeLeft = Math.max(0, G.timeLeft - dt / 1000);
      const s = Math.ceil(G.timeLeft); if (s !== lastTick) { lastTick = s; hud(); if (s <= 5 && s > 0) Sfx.tick(); }
      if (G.timeLeft <= 0 && !G.busy) endTimed();
    }
    if (canPlay() && !G.hint && !G.sel && now - G.lastInput > 5500) {
      const mv = G.eng.findMoves(); mv.sort((x, y) => y.v - x.v); G.hint = mv[0] || null;
    }
    render(now, dt); hudScore();
  } else if (G.screen === 'home') renderHome(now);
  requestAnimationFrame(frame);
}

// ---------- boot ----------
const GEM_URLS = GEM.map((_, i) => gemURL(i)), ICE_URL1 = iceURL(1);
document.querySelectorAll('img[data-gem]').forEach(im => im.src = GEM_URLS[+im.dataset.gem]);
refreshHome();
syncInstall();
requestAnimationFrame(frame);
}
