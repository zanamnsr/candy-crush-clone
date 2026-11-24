// Level-balance check: a bot with one move of lookahead plays every level and reports win rate and scores.
// Usage: node tools/simulate.js [runs per level] [comma-separated level numbers]
const { Engine, makeLevel, LEVEL_COUNT, makeRng, N } = require('../js/engine.js');
function clone(e){ const o=Object.create(Engine.prototype); Object.assign(o,e); o.g=e.g.map(r=>r.map(g=>({...g}))); o.ice=e.ice.map(r=>r.slice()); o.collected=e.collected.slice(); return o; }
function goalsMet(lv, e) { if (e.score < lv.score) return false; if (lv.ice && e.iceLeft() > 0) return false; for (const [c, n] of lv.collect) if (e.collected[c] < n) return false; return true; }
function value(lv,e){ let v=0; if(lv.score) v+=Math.min(e.score,lv.score)/lv.score*100; if(lv.ice){ let s=0; for(const r of e.ice) for(const x of r) s+=x; v-= s*4; } for(const [c,n] of lv.collect) v+=Math.min(e.collected[c],n)*3; let sp=0; for(const r of e.g) for(const g of r) if(g.s) sp+= g.s===4?6:3; return v+sp+e.score/2000; }
function play(n, seed){ const lv=makeLevel(n); const rng=makeRng(seed); const e=new Engine({colors:lv.colors,ice:lv.ice,rng});
  for(let m=0;m<lv.moves;m++){ const mv=e.findMoves(); let best=null,bv=-1e9; for(const x of mv){ const c=clone(e); c.rng=makeRng(seed*31+m); c.trySwap(x.a,x.b); const v=value(lv,c); if(v>bv){bv=v;best=x;} }
    e.trySwap(best.a,best.b); if(goalsMet(lv,e)){ e.rush(lv.moves-m-1); return {win:1,score:e.score,left:lv.moves-m-1}; } }
  return {win:0,score:e.score}; }
const T=+process.argv[2]||20; const only=process.argv[3]?process.argv[3].split(',').map(Number):null;
for(let n=1;n<=LEVEL_COUNT;n++){ if(only&&!only.includes(n)) continue; const lv=makeLevel(n); let w=0,sc=0,left=0,scs=[]; for(let t=0;t<T;t++){ const r=play(n,5000*n+t*13+3); w+=r.win; sc+=r.score; if(r.win){left+=r.left; scs.push(r.score);} }
 scs.sort((a,b)=>a-b); console.log(n, lv.colors+'c', lv.moves+'m', `smart win ${Math.round(100*w/T)}% avg ${Math.round(sc/T)} left ${w?(left/w).toFixed(1):'-'} med ${scs[scs.length>>1]||0} p80 ${scs[Math.floor(scs.length*0.8)]||0}`); }
