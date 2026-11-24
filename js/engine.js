// ===== ENGINE (pure game logic, no DOM) =====
const N = 9;
const SP = { NONE: 0, H: 1, V: 2, WRAP: 3, BOMB: 4 };

function makeRng(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function grid(v) { return Array.from({ length: N }, () => Array(N).fill(v)); }

class Engine {
  constructor(o) {
    this.k = o.colors;
    this.rng = o.rng || Math.random;
    this.nextId = 1;
    this.ice = o.ice ? o.ice.map(r => r.slice()) : grid(0);
    this.g = grid(null);
    this.score = 0;
    this.collected = Array(7).fill(0);
    this.cascade = 0;
    this.fill();
  }
  rc() { return Math.floor(this.rng() * this.k); }
  newGem(c, s = 0) { return { id: this.nextId++, c, s }; }
  get(p) { return this.g[p[0]][p[1]]; }
  set(p, v) { this.g[p[0]][p[1]] = v; }
  colorAt(r, c) { const x = this.g[r][c]; return x && x.s !== SP.BOMB ? x.c : -1; }
  iceLeft() { let n = 0; for (const row of this.ice) for (const v of row) if (v > 0) n++; return n; }

  fill() {
    for (let tries = 0; tries < 200; tries++) {
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const ban = new Set();
        if (c >= 2 && this.g[r][c - 1].c === this.g[r][c - 2].c) ban.add(this.g[r][c - 1].c);
        if (r >= 2 && this.g[r - 1][c].c === this.g[r - 2][c].c) ban.add(this.g[r - 1][c].c);
        let col; do { col = this.rc(); } while (ban.has(col));
        this.g[r][c] = this.newGem(col);
      }
      if (this.findMoves().length >= 3) return;
    }
  }

  // ---- matching ----
  findGroups() {
    const runs = [];
    for (let r = 0; r < N; r++) {
      let c = 0;
      while (c < N) {
        const col = this.colorAt(r, c); let e = c + 1;
        if (col >= 0) while (e < N && this.colorAt(r, e) === col) e++;
        if (col >= 0 && e - c >= 3) { const cells = []; for (let x = c; x < e; x++) cells.push([r, x]); runs.push({ dir: 'h', cells, color: col }); }
        c = e;
      }
    }
    for (let c = 0; c < N; c++) {
      let r = 0;
      while (r < N) {
        const col = this.colorAt(r, c); let e = r + 1;
        if (col >= 0) while (e < N && this.colorAt(e, c) === col) e++;
        if (col >= 0 && e - r >= 3) { const cells = []; for (let y = r; y < e; y++) cells.push([y, c]); runs.push({ dir: 'v', cells, color: col }); }
        r = e;
      }
    }
    if (!runs.length) return [];
    const parent = runs.map((_, i) => i);
    const find = i => parent[i] === i ? i : (parent[i] = find(parent[i]));
    const owner = new Map();
    runs.forEach((run, i) => run.cells.forEach(([r, c]) => {
      const k = r * N + c;
      if (owner.has(k)) parent[find(i)] = find(owner.get(k)); else owner.set(k, i);
    }));
    const groups = new Map();
    runs.forEach((run, i) => {
      const root = find(i);
      if (!groups.has(root)) groups.set(root, { runs: [], keys: new Set(), cells: [], color: run.color });
      const gr = groups.get(root); gr.runs.push(run);
      run.cells.forEach(([r, c]) => { const k = r * N + c; if (!gr.keys.has(k)) { gr.keys.add(k); gr.cells.push([r, c]); } });
    });
    return [...groups.values()];
  }

  specialFor(gr, swapCells) {
    const max = Math.max(...gr.runs.map(r => r.cells.length));
    const hasH = gr.runs.some(r => r.dir === 'h'), hasV = gr.runs.some(r => r.dir === 'v');
    let s = 0;
    if (max >= 5) s = SP.BOMB; else if (hasH && hasV) s = SP.WRAP; else if (max === 4) s = gr.runs[0].dir === 'h' ? SP.V : SP.H;
    if (!s) return null;
    let pos = null;
    if (swapCells) for (const p of swapCells) if (gr.keys.has(p[0] * N + p[1])) pos = p;
    if (!pos && hasH && hasV) {
      const hk = new Set(); gr.runs.filter(r => r.dir === 'h').forEach(r => r.cells.forEach(([y, x]) => hk.add(y * N + x)));
      for (const r of gr.runs) if (r.dir === 'v') for (const [y, x] of r.cells) if (hk.has(y * N + x)) pos = [y, x];
    }
    if (!pos) {
      const run = gr.runs.reduce((a, b) => b.cells.length > a.cells.length ? b : a);
      pos = run.cells[Math.floor((run.cells.length - 1) / 2 + (this.rng() < 0.5 ? 0 : 0.5))];
    }
    return { r: pos[0], c: pos[1], gem: this.newGem(s === SP.BOMB ? -1 : gr.color, s) };
  }

  matchLenAt(r, c) {
    const col = this.colorAt(r, c); if (col < 0) return 0;
    let h = 1, v = 1, x;
    for (x = c - 1; x >= 0 && this.colorAt(r, x) === col; x--) h++;
    for (x = c + 1; x < N && this.colorAt(r, x) === col; x++) h++;
    for (x = r - 1; x >= 0 && this.colorAt(x, c) === col; x--) v++;
    for (x = r + 1; x < N && this.colorAt(x, c) === col; x++) v++;
    let s = 0; if (h >= 3) s += h; if (v >= 3) s += v;
    if (h >= 3 && v >= 3) s += 3;
    return s;
  }

  findMoves() {
    const res = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [dr, dc] of [[0, 1], [1, 0]]) {
      const r2 = r + dr, c2 = c + dc; if (r2 >= N || c2 >= N) continue;
      const A = this.g[r][c], B = this.g[r2][c2];
      if (A.s === SP.BOMB || B.s === SP.BOMB || (A.s && B.s)) { res.push({ a: [r, c], b: [r2, c2], v: 12 + A.s + B.s }); continue; }
      this.g[r][c] = B; this.g[r2][c2] = A;
      const v = this.matchLenAt(r, c) + this.matchLenAt(r2, c2);
      this.g[r][c] = A; this.g[r2][c2] = B;
      if (v) res.push({ a: [r, c], b: [r2, c2], v: v + (A.s || B.s ? 4 : 0) });
    }
    return res;
  }

  // ---- moves ----
  trySwap(a, b) {
    const A = this.get(a), B = this.get(b), phases = [];
    this.set(a, B); this.set(b, A);
    phases.push({ t: 'swap', a, b, ids: [A.id, B.id] });
    const isCombo = A.s === SP.BOMB || B.s === SP.BOMB || (A.s && B.s);
    if (!isCombo && !this.findGroups().length) {
      this.set(a, A); this.set(b, B);
      phases.push({ t: 'unswap', a, b, ids: [A.id, B.id] });
      return { valid: false, phases };
    }
    this.cascade = 0;
    if (isCombo) this.runCombo(A, B, a, b, phases);
    this.cascadeLoop(phases, [a, b]);
    this.ensureMoves(phases);
    return { valid: true, phases };
  }

  runCombo(A, B, a, b, phases) {
    // A now sits at b, B at a
    this.cascade = 1;
    const noAct = new Set(), effects = [], cells = [];
    const [r0, c0] = b;
    if (A.s === SP.BOMB && B.s === SP.BOMB) {
      noAct.add(A.id); noAct.add(B.id);
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) cells.push([r, c]);
      effects.push({ t: 'nova', r: r0, c: c0 });
    } else if (A.s === SP.BOMB || B.s === SP.BOMB) {
      const [bomb, other, bp] = A.s === SP.BOMB ? [A, B, b] : [B, A, a];
      noAct.add(bomb.id);
      const targets = [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const g = this.g[r][c]; if (g.s !== SP.BOMB && g.c === other.c) targets.push([r, c]); }
      if (other.s) {
        const items = [];
        for (const [r, c] of targets) {
          const g = this.g[r][c];
          if (!g.s) { g.s = other.s === SP.WRAP ? SP.WRAP : (this.rng() < 0.5 ? SP.H : SP.V); items.push({ id: g.id, s: g.s, r, c }); }
        }
        phases.push({ t: 'transform', r: bp[0], c: bp[1], items, targets });
      } else effects.push({ t: 'zap', r: bp[0], c: bp[1], targets });
      cells.push(bp, ...targets);
    } else {
      noAct.add(A.id); noAct.add(B.id);
      cells.push(a, b);
      const st = s => s === SP.H || s === SP.V;
      if (st(A.s) && st(B.s)) {
        for (let i = 0; i < N; i++) cells.push([r0, i], [i, c0]);
        effects.push({ t: 'line', dir: 'h', r: r0, c: c0 }, { t: 'line', dir: 'v', r: r0, c: c0 });
      } else if (A.s === SP.WRAP && B.s === SP.WRAP) {
        for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) cells.push([r0 + dr, c0 + dc]);
        effects.push({ t: 'blast', r: r0, c: c0, rad: 2 });
      } else {
        for (let d = -1; d <= 1; d++) {
          for (let i = 0; i < N; i++) cells.push([r0 + d, i], [i, c0 + d]);
          if (r0 + d >= 0 && r0 + d < N) effects.push({ t: 'line', dir: 'h', r: r0 + d, c: c0 });
          if (c0 + d >= 0 && c0 + d < N) effects.push({ t: 'line', dir: 'v', r: r0, c: c0 + d });
        }
      }
    }
    this.clearPhase(cells, { noAct, effects }, phases);
    this.gravity(phases);
  }

  cascadeLoop(phases, swapCells) {
    let first = true, guard = 0;
    while (guard++ < 60) {
      const groups = this.findGroups();
      if (!groups.length) break;
      this.cascade++;
      const cells = [], created = [];
      for (const gr of groups) { cells.push(...gr.cells); const sp = this.specialFor(gr, first ? swapCells : null); if (sp) created.push(sp); }
      this.clearPhase(cells, { created }, phases);
      this.gravity(phases);
      first = false;
    }
  }

  commonColor(set) {
    const cnt = Array(this.k).fill(0);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const g = this.g[r][c]; if (g && g.c >= 0 && !set.has(r * N + c)) cnt[g.c]++; }
    let best = 0; cnt.forEach((v, i) => { if (v > cnt[best]) best = i; }); return best;
  }

  activate(r, c, gm, add, effects, set) {
    if (gm.s === SP.H) { effects.push({ t: 'line', dir: 'h', r, c }); for (let x = 0; x < N; x++) add(r, x); }
    else if (gm.s === SP.V) { effects.push({ t: 'line', dir: 'v', r, c }); for (let y = 0; y < N; y++) add(y, c); }
    else if (gm.s === SP.WRAP) { effects.push({ t: 'blast', r, c, rad: 1 }); for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) add(r + dr, c + dc); }
    else if (gm.s === SP.BOMB) {
      const col = this.commonColor(set), targets = [];
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const g = this.g[y][x]; if (g && g.s !== SP.BOMB && g.c === col) targets.push([y, x]); }
      effects.push({ t: 'zap', r, c, targets });
      targets.forEach(([y, x]) => add(y, x));
    }
  }

  clearPhase(cells, o, phases) {
    const noAct = o.noAct || new Set(), effects = o.effects || [], created = o.created || [];
    const set = new Map(), queue = [];
    const add = (r, c) => {
      if (r < 0 || c < 0 || r >= N || c >= N) return;
      const k = r * N + c; if (set.has(k)) return;
      const gm = this.g[r][c]; if (!gm) return;
      set.set(k, [r, c, gm]);
      if (gm.s && !noAct.has(gm.id)) queue.push([r, c, gm]);
    };
    cells.forEach(([r, c]) => add(r, c));
    while (queue.length) { const [r, c, gm] = queue.shift(); this.activate(r, c, gm, add, effects, set); }
    const cleared = [], ice = [], collected = Array(7).fill(0);
    let iceN = 0;
    for (const [r, c, gm] of set.values()) {
      cleared.push({ id: gm.id, r, c, col: gm.c, s: gm.s });
      this.g[r][c] = null;
      if (gm.c >= 0) collected[gm.c]++;
      if (this.ice[r][c] > 0) { this.ice[r][c]--; ice.push({ r, c, v: this.ice[r][c] }); iceN++; }
    }
    for (const cr of created) this.g[cr.r][cr.c] = cr.gem;
    const mult = Math.min(8, Math.max(1, this.cascade));
    const bonus = created.reduce((s, cr) => s + [0, 120, 120, 200, 300][cr.gem.s], 0);
    const score = (cleared.length * 60 + bonus) * mult + iceN * 100;
    this.score += score;
    collected.forEach((v, i) => this.collected[i] += v);
    phases.push({ t: 'clear', cleared, effects, created: created.map(cr => ({ r: cr.r, c: cr.c, id: cr.gem.id, col: cr.gem.c, sp: cr.gem.s })), ice, score, cascade: this.cascade, collected });
  }

  gravity(phases) {
    const moves = [], spawns = [];
    for (let c = 0; c < N; c++) {
      let w = N - 1;
      for (let r = N - 1; r >= 0; r--) {
        const gm = this.g[r][c];
        if (gm) { if (w !== r) { this.g[w][c] = gm; this.g[r][c] = null; moves.push({ id: gm.id, r: w, c, from: r }); } w--; }
      }
      for (let r = w; r >= 0; r--) {
        const gm = this.newGem(this.rc()); this.g[r][c] = gm;
        spawns.push({ id: gm.id, col: gm.c, sp: 0, r, c, from: r - (w + 1) });
      }
    }
    phases.push({ t: 'fall', moves, spawns });
  }

  ensureMoves(phases) {
    if (this.findMoves().length) return;
    const gems = []; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) gems.push(this.g[r][c]);
    for (let t = 0; t < 300; t++) {
      for (let i = gems.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [gems[i], gems[j]] = [gems[j], gems[i]]; }
      if (t > 150) gems.forEach(g => { if (!g.s) g.c = this.rc(); });
      gems.forEach((g, i) => this.g[Math.floor(i / N)][i % N] = g);
      if (!this.findGroups().length && this.findMoves().length) break;
    }
    const moves = []; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) moves.push({ id: this.g[r][c].id, r, c, col: this.g[r][c].c });
    phases.push({ t: 'shuffle', moves });
  }

  // End-of-level bonus: leftover moves become line gems that all fire.
  rush(movesLeft) {
    const phases = []; this.cascade = 1;
    const cand = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!this.g[r][c].s) cand.push([r, c]);
    for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
    const items = [];
    for (let i = 0; i < Math.min(movesLeft, 15, cand.length); i++) {
      const [r, c] = cand[i], g = this.g[r][c];
      g.s = this.rng() < 0.5 ? SP.H : SP.V; items.push({ id: g.id, s: g.s, r, c });
    }
    if (items.length) phases.push({ t: 'transform', items, rush: true });
    for (let loop = 0; loop < 6; loop++) {
      const sp = [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (this.g[r][c].s) sp.push([r, c]);
      if (!sp.length) break;
      this.cascade = 1;
      this.clearPhase(sp, {}, phases);
      this.gravity(phases);
      this.cascadeLoop(phases, null);
    }
    return phases;
  }
}

// ===== LEVELS =====
const ICE = {
  center3: (r, c) => Math.abs(r - 4) <= 1 && Math.abs(c - 4) <= 1,
  center5: (r, c) => Math.abs(r - 4) <= 2 && Math.abs(c - 4) <= 2,
  cross: (r, c) => r === 4 || c === 4,
  plus: (r, c) => Math.abs(r - 4) <= 1 || Math.abs(c - 4) <= 1,
  x: (r, c) => r === c || r + c === 8,
  diamond: (r, c) => Math.abs(r - 4) + Math.abs(c - 4) <= 3,
  frame: (r, c) => { const d = Math.abs(r - 4) + Math.abs(c - 4); return d === 3 || d === 4; },
  ring: (r, c) => r === 0 || r === 8 || c === 0 || c === 8,
  inner: (r, c) => (r === 1 || r === 7 || c === 1 || c === 7) && r > 0 && r < 8 && c > 0 && c < 8,
  checker: (r, c) => (r + c) % 2 === 0 && r > 0 && r < 8 && c > 0 && c < 8,
  bottom: r => r >= 6,
  bottom2: r => r >= 7,
  top: r => r <= 2,
  corners: (r, c) => (r < 3 || r > 5) && (c < 3 || c > 5),
  stripes: (r, c) => c % 2 === 0,
  full: () => true,
};
// [moves, score, ice, ice2, collect]  collect = [[color,count],...]
const LEVEL_DEFS = [
  [18, 8000], [18, 0, 0, 0, [[0, 14], [4, 14]]], [18, 0, 'center3'], [20, 18000], [20, 0, 'cross'],
  [22, 0, 0, 0, [[3, 22], [2, 22]]], [22, 0, 'diamond'], [22, 0, 'center3', 'center3'], [22, 28000], [26, 0, 'x', 0, [[2, 16]]],
  [22, 15000], [27, 0, 'bottom'], [24, 0, 0, 0, [[0, 22], [1, 22]]], [28, 0, 'checker'], [26, 0, 'center5', 'center3'],
  [24, 20000], [28, 0, 'cross', 0, [[4, 24]]], [27, 0, 'frame'], [30, 0, 'corners'], [26, 0, 0, 0, [[0, 18], [3, 18], [5, 18]]],
  [30, 0, 'plus', 'cross'], [24, 25000], [34, 0, 'ring'], [36, 0, 'full'], [28, 0, 0, 0, [[5, 30], [3, 30]]],
  [30, 0, 'x', 'center3', [[2, 15]]], [26, 15000], [28, 0, 'center5'], [28, 0, 0, 0, [[0, 14], [1, 14], [2, 14], [4, 14]]], [30, 0, 'diamond', 'center3'],
  [30, 0, 'bottom2'], [28, 19000], [34, 0, 'plus'], [32, 0, 'cross', 0, [[0, 26], [4, 26]]], [32, 0, 'inner'],
  [40, 0, 'plus', 'center3', [[6, 24]]],
];
const STARS = [[15500,34000],[20000,48000],[21500,39500],[27500,41500],[31000,65000],[27000,49000],[36000,64000],[29500,47500],[36500,53000],[49000,83500],[19500,26000],[23000,38500],[18500,30500],[25500,40500],[23500,38000],[26000,33500],[23500,37000],[25000,40500],[26500,53000],[20000,31000],[35000,49000],[32500,37000],[30500,53500],[40000,59500],[25000,39000],[31000,49000],[19500,23000],[16000,24500],[15000,22000],[17000,28500],[19000,36500],[24500,27500],[24000,36500],[23000,33000],[17000,28500],[27000,38000]];
function levelColors(n) { return n <= 10 ? 5 : n <= 26 ? 6 : 7; }
function makeLevel(n) {
  const [moves, score, ice, ice2, collect] = LEVEL_DEFS[n - 1];
  const colors = levelColors(n);
  let iceGrid = null;
  if (ice) {
    iceGrid = grid(0);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (ICE[ice](r, c)) iceGrid[r][c] = 1;
      if (ice2 && ICE[ice2](r, c)) iceGrid[r][c] = 2;
    }
  }
  const [s2, s3] = STARS[n - 1];
  return { n, moves, colors, score, ice: iceGrid, collect: collect || [], stars: [score || 0, s2, s3] };
}
const LEVEL_COUNT = LEVEL_DEFS.length;

if (typeof module !== 'undefined') module.exports = { Engine, makeLevel, LEVEL_COUNT, SP, N, makeRng };
