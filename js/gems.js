// ===== GEM ARTWORK (canvas-drawn, shared by the game and the icon generator) =====
const GEM = [
  { name: 'ruby', base: '#e8173f', light: '#ff9aa9', dark: '#6a0015' },
  { name: 'topaz', base: '#ff8c1a', light: '#ffd79c', dark: '#7a3000' },
  { name: 'citrine', base: '#ffd21f', light: '#fff6b8', dark: '#8a5c00' },
  { name: 'emerald', base: '#16c46b', light: '#a0ffcb', dark: '#034d27' },
  { name: 'sapphire', base: '#2e6cff', light: '#a8c8ff', dark: '#081d72' },
  { name: 'amethyst', base: '#a63cff', light: '#e6b8ff', dark: '#3f0a7a' },
  { name: 'diamond', base: '#d6e6f7', light: '#ffffff', dark: '#5e7696' },
];
function ngon(n, r = 1, rot = -Math.PI / 2) { return Array.from({ length: n }, (_, i) => { const a = rot + i * 2 * Math.PI / n; return [Math.cos(a) * r, Math.sin(a) * r]; }); }
const SHAPES = (() => {
  const heart = []; for (let i = 0; i < 20; i++) { const t = i / 20 * 2 * Math.PI; heart.push([16 * Math.sin(t) ** 3 / 17, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17 - 0.12]); }
  const tri = ngon(3, 1.18).map(([x, y]) => [x, y + 0.14]), trillion = [];
  tri.forEach((v, i) => { const p = tri[(i + 2) % 3], n = tri[(i + 1) % 3]; trillion.push([v[0] + (p[0] - v[0]) * .2, v[1] + (p[1] - v[1]) * .2], [v[0] + (n[0] - v[0]) * .2, v[1] + (n[1] - v[1]) * .2]); });
  const pear = [[0, -1.02]]; for (let a = -30; a <= 210; a += 20) { const r = a * Math.PI / 180; pear.push([Math.cos(r) * 0.66, 0.32 + Math.sin(r) * 0.66]); }
  const rh = [[0, -1.04], [0.8, 0], [0, 1.04], [-0.8, 0]], rhombus = [];
  rh.forEach((v, i) => { const n = rh[(i + 1) % 4]; rhombus.push(v, [(v[0] + n[0]) / 2 * 1.1, (v[1] + n[1]) / 2 * 1.1]); });
  return [heart, ngon(6, 1), rhombus,
    [[-0.42, -0.98], [0.42, -0.98], [0.74, -0.66], [0.74, 0.66], [0.42, 0.98], [-0.42, 0.98], [-0.74, 0.66], [-0.74, -0.66]],
    ngon(14, 0.96), trillion, pear];
})();
const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const mixc = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
function trace(c, P) { c.beginPath(); P.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); }
function glint(c, x, y, s, a) {
  c.save(); c.globalAlpha = a; c.fillStyle = '#fff'; c.beginPath(); c.moveTo(x, y - s);
  c.quadraticCurveTo(x, y, x + s, y); c.quadraticCurveTo(x, y, x, y + s); c.quadraticCurveTo(x, y, x - s, y); c.quadraticCurveTo(x, y, x, y - s); c.fill(); c.restore();
}
function drawGem(c, ci, R) {
  const G = GEM[ci], P = SHAPES[ci].map(([x, y]) => [x * R, y * R]);
  const d = hexRgb(G.dark), l = hexRgb(G.light), b = hexRgb(G.base);
  c.save(); c.translate(0, R * 0.1); trace(c, P); c.fillStyle = 'rgba(0,0,0,.4)'; c.fill(); c.restore();
  const tx = -0.03 * R, ty = -0.05 * R, T = P.map(([x, y]) => [x * 0.52 + tx, y * 0.52 + ty]);
  const L = [-0.53, -0.85];
  for (let i = 0; i < P.length; i++) {
    const j = (i + 1) % P.length, ex = P[j][0] - P[i][0], ey = P[j][1] - P[i][1], len = Math.hypot(ex, ey) || 1;
    const k = 0.5 + 0.5 * ((ey / len) * L[0] + (-ex / len) * L[1]);
    c.beginPath(); c.moveTo(P[i][0], P[i][1]); c.lineTo(P[j][0], P[j][1]); c.lineTo(T[j][0], T[j][1]); c.lineTo(T[i][0], T[i][1]); c.closePath();
    c.fillStyle = k > 0.5 ? mixc(b, l, (k - 0.5) * 1.7) : mixc(d, b, k * 2); c.fill();
  }
  c.lineWidth = Math.max(1, R * 0.025); c.strokeStyle = 'rgba(255,255,255,.22)';
  c.beginPath(); P.forEach((p, i) => { c.moveTo(p[0], p[1]); c.lineTo(T[i][0], T[i][1]); }); c.stroke();
  trace(c, T); const g = c.createLinearGradient(-R * .5, -R * .55, R * .45, R * .5);
  g.addColorStop(0, G.light); g.addColorStop(0.55, G.base); g.addColorStop(1, mixc(b, d, 0.4)); c.fillStyle = g; c.fill(); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.13)'; c.beginPath(); T.forEach((p, i) => { if (i % 2 === 0 || T.length < 8) { c.moveTo(tx, ty); c.lineTo(p[0], p[1]); } }); c.stroke();
  trace(c, P); c.strokeStyle = mixc(d, [0, 0, 0], 0.35); c.lineWidth = R * 0.065; c.lineJoin = 'round'; c.stroke();
  glint(c, -R * 0.3, -R * 0.38, R * 0.2, 0.95);
  c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(R * 0.22, R * 0.3, R * 0.05, 0, 7); c.fill();
}
function drawStripes(c, ci, R, s) {
  const P = SHAPES[ci].map(([x, y]) => [x * R, y * R]);
  c.save(); trace(c, P); c.clip();
  for (const k of [-0.46, 0, 0.46]) {
    c.fillStyle = 'rgba(255,255,255,.8)';
    if (s === SP.H) c.fillRect(-R * 1.3, k * R - R * 0.075, R * 2.6, R * 0.15); else c.fillRect(k * R - R * 0.075, -R * 1.3, R * 0.15, R * 2.6);
  }
  c.restore();
  c.fillStyle = '#fff'; c.strokeStyle = 'rgba(40,10,60,.6)'; c.lineWidth = R * 0.05;
  for (const sg of [-1, 1]) {
    c.save(); c.rotate(s === SP.H ? (sg > 0 ? 0 : Math.PI) : (sg > 0 ? Math.PI / 2 : -Math.PI / 2));
    c.beginPath(); c.moveTo(R * 1.2, 0); c.lineTo(R * 0.98, -R * 0.17); c.lineTo(R * 0.98, R * 0.17); c.closePath(); c.fill(); c.stroke(); c.restore();
  }
}
function drawSetting(c, R) {
  const h = R * 1.02, r = R * 0.34;
  c.save(); c.shadowColor = 'rgba(255,205,90,.85)'; c.shadowBlur = R * 0.35;
  c.beginPath(); c.roundRect(-h, -h, 2 * h, 2 * h, r);
  c.fillStyle = 'rgba(255,214,120,.16)'; c.fill();
  const g = c.createLinearGradient(-h, -h, h, h); g.addColorStop(0, '#fff3c0'); g.addColorStop(0.35, '#e0a93c'); g.addColorStop(0.6, '#ffe08a'); g.addColorStop(1, '#8a5512');
  c.lineWidth = R * 0.15; c.strokeStyle = g; c.stroke(); c.restore();
  c.fillStyle = '#ffe9a6'; c.strokeStyle = '#8a5512'; c.lineWidth = R * 0.04;
  for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { c.beginPath(); c.arc(x * h * 0.62, y * h * 0.62, R * 0.12, 0, 7); c.fill(); c.stroke(); }
}
function drawPrism(c, x, y, R, t) {
  c.save(); c.translate(x, y);
  c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.arc(0, R * 0.1, R, 0, 7); c.fill();
  const g = c.createRadialGradient(-R * .3, -R * .35, R * .05, 0, 0, R);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.22, '#d7c8ff'); g.addColorStop(0.6, '#5530a0'); g.addColorStop(1, '#14072a');
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, R, 0, 7); c.fill();
  c.lineWidth = R * 0.07; c.strokeStyle = 'rgba(255,255,255,.55)'; c.stroke();
  for (let i = 0; i < 7; i++) {
    const a = t / 700 + i * 2 * Math.PI / 7, px = Math.cos(a) * R * 0.6, py = Math.sin(a) * R * 0.6, s = R * 0.2;
    c.fillStyle = GEM[i].base; c.beginPath(); c.moveTo(px, py - s); c.lineTo(px + s * .75, py); c.lineTo(px, py + s); c.lineTo(px - s * .75, py); c.closePath(); c.fill();
    c.lineWidth = R * 0.04; c.strokeStyle = 'rgba(255,255,255,.8)'; c.stroke();
  }
  glint(c, 0, 0, R * (0.3 + 0.07 * Math.sin(t / 150)), 1);
  c.restore();
}
const spriteCache = new Map();
function sprite(ci, s, px) {
  px = Math.max(8, Math.round(px)); const key = ci + '-' + s + '-' + px;
  let cv = spriteCache.get(key); if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = cv.height = px;
  const c = cv.getContext('2d'); c.translate(px / 2, px / 2);
  const R = px * 0.4;
  if (s === SP.BOMB) drawPrism(c, 0, 0, R * 0.98, 0);
  else if (s === SP.WRAP) { drawSetting(c, R); drawGem(c, ci, R * 0.76); }
  else { drawGem(c, ci, R); if (s === SP.H || s === SP.V) drawStripes(c, ci, R, s); }
  spriteCache.set(key, cv); return cv;
}
function iceSprite(v, px) {
  px = Math.round(px); const key = 'ice' + v + '-' + px;
  let cv = spriteCache.get(key); if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = cv.height = px; const c = cv.getContext('2d');
  const m = px * 0.05, s = px - 2 * m, r = px * 0.16;
  const g = c.createLinearGradient(0, 0, px, px);
  if (v === 1) { g.addColorStop(0, 'rgba(190,235,255,.55)'); g.addColorStop(1, 'rgba(110,180,255,.35)'); }
  else { g.addColorStop(0, 'rgba(235,250,255,.92)'); g.addColorStop(1, 'rgba(150,210,255,.75)'); }
  c.beginPath(); c.roundRect(m, m, s, s, r); c.fillStyle = g; c.fill();
  c.lineWidth = px * 0.045; c.strokeStyle = 'rgba(255,255,255,.85)'; c.stroke();
  if (v === 2) { c.beginPath(); c.roundRect(m + px * 0.1, m + px * 0.1, s - px * 0.2, s - px * 0.2, r * 0.6); c.lineWidth = px * 0.03; c.strokeStyle = 'rgba(255,255,255,.7)'; c.stroke(); }
  c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = px * 0.02; c.beginPath();
  c.moveTo(px * .12, px * .3); c.lineTo(px * .26, px * .2); c.lineTo(px * .3, px * .08);
  c.moveTo(px * .9, px * .7); c.lineTo(px * .76, px * .78); c.lineTo(px * .8, px * .92);
  c.moveTo(px * .88, px * .14); c.lineTo(px * .74, px * .22); c.stroke();
  spriteCache.set(key, cv); return cv;
}
