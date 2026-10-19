/* Kenar Düellosu — engine: simulation, AI, rendering */
(() => {
"use strict";
const K = window.K, W = K.W, H = K.H, DT = 1 / 60;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const approach = (v, t, d) => v < t ? Math.min(v + d, t) : Math.max(v - d, t);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
K.util = { clamp, approach, rand, pick };
K.settings = K.settings || { sound: true, shake: true, touchSize: 1 };
const OUT = '#111219';
const MAX_HP = 100;
const DYN = { fuse: 1.6, duckFuse: 1.9, r: 125, kb: 1000, dmg: 42 };

/* ================= audio ================= */
const A = { ctx: null, noise: null, lastShot: 0, lastJet: 0, lastHit: 0 };
K.audioInit = () => {
  try {
    if (!A.ctx) {
      A.ctx = new (window.AudioContext || window.webkitAudioContext)();
      A.noise = A.ctx.createBuffer(1, A.ctx.sampleRate, A.ctx.sampleRate);
      const d = A.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (A.ctx.state === 'suspended') A.ctx.resume();
  } catch (_) { A.ctx = null; }
};
K.sfx = (type, vol = 1) => {
  const ac = A.ctx;
  if (!ac || !K.settings.sound) return;
  const t = ac.currentTime;
  const noise = (filterF, dur, v, sweepTo) => {
    const s = ac.createBufferSource(); s.buffer = A.noise;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(filterF, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(v * vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    s.connect(f).connect(g).connect(ac.destination); s.start(t, Math.random() * .5, dur + .02);
  };
  const tone = (wave, f0, f1, dur, v) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = wave; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(v * vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + .02);
  };
  switch (type) {
    case 'shot': if (t - A.lastShot < .03) return; A.lastShot = t; noise(2600, .08, .2); break;
    case 'heavy': if (t - A.lastShot < .03) return; A.lastShot = t; noise(900, .22, .26); break;
    case 'boom': noise(700, .8, .55, 60); tone('sine', 120, 40, .5, .2); break;
    case 'hit': if (t - A.lastHit < .05) return; A.lastHit = t; tone('square', 260, 140, .05, .05); break;
    case 'ko': tone('square', 700, 120, .45, .09); noise(1200, .3, .2); break;
    case 'laser': tone('sawtooth', 1400, 200, .18, .06); break;
    case 'demat': tone('sine', 300, 1800, .4, .1); break;
    case 'pick': tone('square', 520, 880, .12, .07); break;
    case 'power': tone('triangle', 400, 1200, .25, .09); break;
    case 'fall': tone('sine', 500, 90, .45, .08); break;
    case 'tick': tone('square', 700, 700, .06, .06); break;
    case 'fuse': tone('square', 1500, 1500, .03, .03); break;
    case 'go': tone('square', 900, 900, .18, .07); break;
    case 'win': tone('triangle', 440, 990, .6, .1); break;
    case 'lose': tone('triangle', 400, 120, .6, .1); break;
    case 'click': tone('square', 600, 500, .04, .04); break;
    case 'throw': noise(1800, .12, .1, 600); break;
    case 'jet': if (t - A.lastJet < .09) return; A.lastJet = t; noise(500, .1, .05); break;
    case 'target': tone('square', 1200, 600, .08, .06); break;
    case 'boing': tone('sine', 220, 660, .18, .09); break;
    case 'crumble': noise(400, .5, .25, 80); break;
  }
};

/* ================= match ================= */
let M = null;
K.getMatch = () => M;
K.onMatchEnd = null;

const sameTeam = (a, b) => a && b && a !== b && a.team === b.team;
const gunList = () => M.mode === 'gungamer' ? K.GUNGAME.slice().reverse() : K.GUNGAME;

K.newMatch = (cfg) => {
  const map = K.MAP[cfg.map] || K.MAPS[0];
  const rules = cfg.rules || {};
  M = {
    cfg, mode: cfg.mode, rules, map, theme: K.THEMES[map.theme],
    plats: map.plats.map(p => Object.assign({}, p, { bx: p.x, by: p.y, dx: 0, dy: 0, on: true, cr: 0, gone: 0, back: 0, squash: 0, warn: false })),
    zones: map.zones || [], windDef: map.wind || null, wind: { dir: 1, on: false, warn: false },
    cam: { x: W / 2, y: H / 2, z: 1 }, view: { w: W, h: H },
    g: 1800 * (map.g || 1), ice: !!map.ice, jet: cfg.mode === 'jetpack',
    crates: cfg.crates !== false && !rules.dynamiteOnly && !rules.pistolOnly && rules.crates !== false &&
            !['gungame', 'gungamer', 'onehit', 'challenge', 'tutorial'].includes(cfg.mode) && !rules.oneHit,
    pickupsOn: !!cfg.pickups && !['challenge', 'tutorial'].includes(cfg.mode),
    hpOn: cfg.mode !== 'challenge',
    players: [], bullets: [], dyn: [], crateList: [], pickups: [], targets: [], parts: [], pops: [],
    time: 0, speed: rules.speed || 1, countdown: cfg.mode === 'demo' ? 0 : 2.4, lastCount: 9,
    ending: 0, result: null, crateT: 3, pickT: 9, shake: 0, wave: 0, waveT: 1, score: 0,
    hint: '', tut: null, chal: null, clock: 0, winner: null,
  };
  updatePlats(0);
  for (const pl of M.plats) pl.dx = pl.dy = 0;
  let h = 0;
  cfg.slots.forEach((s, i) => M.players.push(makePlayer(s, i, s.type === 'human' ? h++ : -1)));
  M.players.forEach((p, i) => spawn(p, i * 60));
  if (cfg.mode === 'challenge') setupChallenge(cfg.challenge);
  if (cfg.mode === 'tutorial') M.tut = { step: 0, moved: 0, done: false };
  return M;
};

function makePlayer(s, i, hIdx) {
  const cos = s.cos || { color: i % K.COLORS.length, hat: 0, face: 0, outfit: 0 };
  const mini = !!(s.mods && s.mods.mini);
  const sc = mini ? .7 : 1;
  const lives = s.lives != null ? s.lives : (M.cfg.lives != null ? M.cfg.lives : 10);
  return {
    i, type: s.type, hIdx, team: s.team != null ? s.team : i, isRobot: !!s.robot,
    name: s.name || (s.type === 'human' ? 'Oyuncu ' + (hIdx + 1) : 'Bot ' + (i + 1)),
    color: s.colorHex || K.COLORS[cos.color % K.COLORS.length], cos,
    diff: K.DIFFS[s.diff || 'orta'], diffId: s.diff || 'orta', perk: s.perk || 'none',
    gunStart: s.gun && K.WEAP[s.gun] && K.WEAP[s.gun].cat === 'tabanca' ? s.gun : 'klasik',
    forceGun: s.forceGun || null, invis: !!(s.mods && s.mods.invis), mini, scale: sc,
    w: 24 * sc, h: 38 * sc, x: 0, y: 0, vx: 0, vy: 0, face: 1, ground: null, jumps: 0, drop: 0,
    lives, livesStart: lives, gren: 3, gcd: 0, charge: -1, aim: null, weapon: null, ammo: 0, clips: 0, reload: 0, cool: 0,
    burstLeft: 0, burstT: 0, spin: 0, shield: 0, out: true, elim: false, respawn: 0, hitT: 0, reveal: 0, anim: 0, recoilT: 0,
    hp: MAX_HP, hpG: MAX_HP, hurtT: 9, ko: false, koT: 0,
    lastHit: null, lastHitT: -99, kills: 0, falls: 0, shots: 0, hits: 0, dmgDone: 0, elimAt: 0, jet: 1, jetOn: false,
    buffs: {}, gg: 0, ai: newAI(),
  };
}
function newAI() {
  return { tgt: null, retarget: 0, aim: 0, tog: false, jumpCd: 0, hopCd: 1, dodgeCd: 0, think: 0, plan: null, air: null,
           rec: null, recT: 0, item: null, itemT: 0, sprayRoll: 0, hopT: 0, nadeCd: 1.5, power: .6, willRecover: true, wasAir: false };
}

function weaponFor(p) {
  if (M.mode === 'challenge') return p.forceGun;
  if (M.rules.dynamiteOnly) return null;
  if (M.mode === 'onehit' || M.rules.oneHit) return 'buhar';
  if (M.mode === 'gungame' || M.mode === 'gungamer') return gunList()[Math.min(p.gg, gunList().length - 1)];
  if (p.forceGun) return p.forceGun;
  if (M.rules.pistolOnly) return p.gunStart;
  if (p.perk === 'random') return pick(K.CRATE_POOL);
  return p.gunStart;
}
function baseGun(p) {
  if (M.rules.dynamiteOnly) return null;
  if (M.mode === 'onehit' || M.rules.oneHit) return 'buhar';
  if (M.mode === 'challenge') return p.forceGun;
  if (M.mode === 'gungame' || M.mode === 'gungamer') return 'klasik';
  return p.gunStart;
}
function fullClip(p, wd) { return Math.max(1, Math.round(wd.clip * (p.perk === 'ammo' ? 1.33 : 1))); }
function setWeapon(p, id) {
  p.weapon = id; p.burstLeft = 0; p.spin = 0; p.reload = 0; p.cool = .15;
  if (!id) { p.ammo = 0; p.clips = 0; return; }
  const wd = K.WEAP[id];
  p.ammo = fullClip(p, wd);
  p.clips = (M.mode === 'gungame' || M.mode === 'gungamer') && wd.cat !== 'tabanca' ? 2 : wd.clips;
}

function spawn(p, stagger = 0) {
  const others = M.players.filter(q => q !== p && !q.out && !q.elim).map(q => q.x + q.w / 2);
  let cand = M.plats.filter(pl => pl.w >= 140 && K.isStatic(pl));
  if (!cand.length) cand = M.plats.filter(K.isStatic);
  let x = W / 2;
  for (let k = 0; k < 12; k++) {
    const pl = pick(cand.length ? cand : M.plats);
    x = rand(pl.x + 30, pl.x + pl.w - 30);
    if (others.every(o => Math.abs(o - x) > 110)) break;
  }
  Object.assign(p, { out: false, x: x - p.w / 2, y: -70 - stagger, vx: 0, vy: 0, shield: 2.2, jumps: 1, ground: null,
    drop: 0, lastHit: null, charge: -1, aim: null, burstLeft: 0, spin: 0, jet: 1, buffs: {}, reveal: 0,
    hp: MAX_HP, hpG: MAX_HP, hurtT: 9, ko: false, koT: 0 });
  p.gren = M.mode === 'challenge' ? (p.forceGun ? 0 : Infinity) : M.rules.dynamiteOnly ? Infinity : 3 + (p.perk === 'nades' ? 2 : 0);
  setWeapon(p, weaponFor(p));
  p.ai = newAI();
}

/* ---------- challenge setup ---------- */
function setupChallenge(ch) {
  M.chal = { def: ch, crateIdx: 0, total: ch.crates ? ch.crates.length : ch.targets.length, done: 0, finished: false };
  const p = M.players[0];
  p.forceGun = ch.gun; p.lives = Infinity; p.livesStart = Infinity;
  setWeapon(p, ch.gun);
  p.gren = ch.gun ? 0 : Infinity;
  if (ch.targets) ch.targets.forEach(([x, y]) => M.targets.push({ x, y, r: 15, alive: true, ph: Math.random() * 6 }));
  if (ch.crates) dropChallengeCrate();
}
function dropChallengeCrate() {
  const c = M.chal, list = c.def.crates;
  if (c.crateIdx >= list.length) return;
  const [x] = list[c.crateIdx++];
  M.crateList.push({ x: x - 14, y: -30, vy: 0, w: 28, h: 24, t: Infinity, ground: null, chal: true });
}

/* ================= helpers ================= */
function platUnder(x, feetY) {
  let best = null;
  for (const pl of M.solid) if (x >= pl.x && x <= pl.x + pl.w && pl.y >= feetY - 1 && (!best || pl.y < best.y)) best = pl;
  return best;
}
function inPlatRect(x, y) {
  for (const pl of M.solid) if (x >= pl.x && x <= pl.x + pl.w && y >= pl.y && y <= pl.y + 14) return true;
  return false;
}
function popup(x, y, text, color, big) { M.pops.push({ x, y, text, color, t: 1.3, max: 1.3, size: big ? 26 : 15 }); }
function dmgPop(x, y, n, crit) { M.pops.push({ x: x + rand(-6, 6), y, text: '-' + n, color: crit ? '#ffc531' : '#ff6b5a', t: .75, max: .75, size: crit ? 15 : 12, vy: -70 }); }
function puff(x, y, n, color, spd = 220, life = .45, size = 3, grav = 0) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = rand(.3, 1) * spd;
    M.parts.push({ type: 'dot', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: life * rand(.6, 1), max: life, size, color, grav });
  }
}
function sparks(x, y, n, dir, spd = 320, color = '#ffe08a') {
  for (let i = 0; i < n; i++) {
    const a = (dir == null ? Math.random() * Math.PI * 2 : (dir > 0 ? 0 : Math.PI) + rand(-.9, .9));
    const s = rand(.4, 1) * spd;
    M.parts.push({ type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, t: rand(.15, .35), max: .35, color, grav: 1 });
  }
}
function shake(n) { if (K.settings.shake) M.shake = Math.max(M.shake, n); }
const blankC = () => ({ l: 0, r: 0, u: 0, uP: 0, d: 0, dP: 0, f: 0, fP: 0, g: 0, gP: 0, face: 0 });

/* ---------- dynamite trajectory ---------- */
function throwVec(p, pw, face) {
  const f = face || p.face;
  return {
    x: p.x + p.w / 2 + f * 9 * p.scale, y: p.y + 13 * p.scale,
    vx: f * (240 + 480 * pw) + p.vx * .35, vy: -(260 + 300 * pw) + Math.min(0, p.vy) * .25,
  };
}
function simDyn(v, pts) {
  let { x, y, vx, vy } = v; const g = M.g * .85;
  for (let i = 0; i < 200; i++) {
    const py = y; vy += g * DT; x += vx * DT; y += vy * DT;
    if (pts && i % 3 === 0) pts.push(x, y);
    if (vy > 0) for (const pl of M.solid) if (x >= pl.x && x <= pl.x + pl.w && py <= pl.y && y >= pl.y) return { x, y: pl.y };
    if (y > H + 60 || x < -100 || x > W + 100) return null;
  }
  return null;
}
const chargePower = c => .3 + .7 * clamp(c / .7, 0, 1);

/* ================= AI ================= */
// A bot reads the arena the way a player does: which platforms it can reach (navigation graph),
// where a fall will end (forward simulation of its own physics), what is about to hit it, and where
// to stand so its shots push the target toward an edge.
const standable = pl => pl.on && !pl.bounce && !pl.warn && !(pl.crumble && pl.cr > 0);
function feetPlat(q) { return q.ground || platUnder(q.x + q.w / 2, q.y + q.h); }
function exiting(pl) { return !!pl.drive && ((pl.drive > 0 && pl.x + pl.w > W - 30) || (pl.drive < 0 && pl.x < 30)); }

function navEdge(A, B) {
  const gap = Math.max(0, B.x - (A.x + A.w), A.x - (B.x + B.w));
  const dy = A.y - B.y;
  if (dy > 30) { if (dy > 195 || gap > 170 - Math.max(0, dy - 110) * .8) return null; return { type: 'up', cost: dy * 1.3 + gap + 40 }; }
  if (dy < -30) { if (gap > 230) return null; return { type: gap > 0 ? 'off' : 'drop', cost: -dy * .4 + gap + 25 }; }
  if (gap > 210) return null;
  return { type: 'gap', cost: gap + 30 };
}
function navNext(from, to) {
  const nodes = M.solid.filter(pl => standable(pl) || pl === to);
  if (!nodes.includes(from)) nodes.push(from);
  const dist = new Map(), prev = new Map(), edgeOf = new Map(), done = new Set();
  for (const n of nodes) dist.set(n, Infinity);
  dist.set(from, 0);
  for (let it = 0; it < nodes.length; it++) {
    let u = null, ud = Infinity;
    for (const n of nodes) if (!done.has(n) && dist.get(n) < ud) { ud = dist.get(n); u = n; }
    if (!u || u === to) break;
    done.add(u);
    for (const v of nodes) {
      if (v === u || done.has(v)) continue;
      const e = navEdge(u, v); if (!e) continue;
      const nd = ud + e.cost + (K.isStatic(v) ? 0 : 60);
      if (nd < dist.get(v)) { dist.set(v, nd); prev.set(v, u); edgeOf.set(v, e); }
    }
  }
  if (!isFinite(dist.get(to))) return null;
  let v = to;
  while (prev.get(v) && prev.get(v) !== from) v = prev.get(v);
  if (prev.get(v) !== from) return null;
  return { B: v, edge: edgeOf.get(v), cost: dist.get(to) };
}

// simulate this player's own movement: steer `dir`, jump once at `jumpAt` seconds (-1 = never)
function simFall(p, dir, jumpAt, maxT = 1.6, fromGround = false) {
  const maxJ = p.perk === 'jump3' ? 3 : 2, jm = (p.buffs.yay > 0 ? 1.25 : 1) * (M.map.g ? Math.sqrt(M.map.g) : 1);
  const wd = p.weapon ? K.WEAP[p.weapon] : null;
  const maxS = (260 - (wd && p.perk !== 'weight' ? wd.weight * 22 : 0)) * (p.buffs.hiz > 0 ? 1.4 : 1);
  let x = p.x + p.w / 2, y = p.y + p.h, vx = p.vx, vy = p.vy, jumps = p.jumps, jumped = false;
  if (fromGround) { vy = -650 * jm; jumps = 1; }
  const wf = windForce(), n = Math.round(maxT / DT), sp = DT * M.speed;
  for (let i = 0; i < n; i++) {
    if (jumpAt >= 0 && !jumped && i * DT >= jumpAt && jumps < maxJ) { vy = -560 * jm; jumps++; jumped = true; }
    if (dir && dir * vx < maxS) { vx += dir * 1500 * DT; if (dir * vx > maxS) vx = dir * maxS; }
    else vx = approach(vx, 0, 150 * DT);
    vx += wf * DT;
    for (const z of M.zones) if (x > z.x && x < z.x + z.w && y - 19 > z.y && y - 19 < z.y + z.h) vy = Math.max(vy - z.f * DT, -430);
    vy += M.g * DT; if (vy > 1000) vy = 1000;
    const py = y; x += vx * DT; y += vy * DT;
    if (vy >= 0) {
      const tt = i * DT;
      for (const pl of M.solid) {
        const ox = pl.dx / sp * tt, oy = pl.dy / sp * tt;
        if (x > pl.x + ox + 3 && x < pl.x + ox + pl.w - 3 && py <= pl.y + oy + 1 && y >= pl.y + oy) return { pl, t: tt, x };
      }
    }
    if (y > H + 140 || x < -320 || x > W + 320) return null;
  }
  return { pl: null, t: maxT, x };
}
// before jumping, check that some double-jump timing actually lands on solid ground
function jumpOk(p, B, landX) {
  const dir = Math.sign(landX - (p.x + p.w / 2));
  for (const ja of [-1, .28, .42, .56]) {
    const r = simFall(p, dir, ja, 1.7, true);
    if (r && r.pl && standable(r.pl) && (r.pl === B || r.pl.y <= (p.ground ? p.ground.y : 9999) + 2)) return true;
  }
  return false;
}
function bestRecovery(p) {
  const maxJ = p.perk === 'jump3' ? 3 : 2, canJump = p.jumps < maxJ;
  let best = null, bs = -1e9;
  for (const dir of [-1, 0, 1]) for (const ja of canJump ? [-1, 0, .12, .24, .38] : [-1]) {
    const r = simFall(p, dir, ja); if (!r) continue;
    let s = 1000 - r.t * 150;
    if (r.pl) {
      if (!standable(r.pl)) s -= r.pl.bounce ? 120 : 350;
      s += Math.min(Math.min(r.x - r.pl.x, r.pl.x + r.pl.w - r.x), 60) * 2;
      if (!K.isStatic(r.pl)) s -= 60;
    } else s -= 300;
    if (ja < 0) s += 40;
    if (s > bs) { bs = s; best = { dir, ja }; }
  }
  if (!best) {
    let np = null, nd = 1e9; const cx = p.x + p.w / 2;
    for (const pl of M.solid) { const d = Math.abs(clamp(cx, pl.x, pl.x + pl.w) - cx) + Math.max(0, p.y - pl.y) * .3; if (d < nd) { nd = d; np = pl; } }
    best = { dir: np ? Math.sign(np.x + np.w / 2 - cx) : 0, ja: canJump ? 0 : -1, desperate: true };
  }
  return best;
}

function bestThrow(p, tx, ty) {
  const face = Math.sign(tx - (p.x + p.w / 2)) || p.face;
  let best = null, be = 1e9;
  for (let k = 0; k <= 10; k++) {
    const pw = k / 10, land = simDyn(throwVec(p, pw, face));
    if (!land) continue;
    const e = Math.abs(land.x - tx) + Math.abs(land.y - ty) * .6;
    if (e < be) { be = e; best = pw; }
  }
  return be < 70 ? { pw: best, face } : null;
}

function pickTarget(p) {
  let best = null, bs = 1e9;
  for (const q of M.players) {
    if (q === p || q.out || q.elim || q.ko || sameTeam(p, q)) continue;
    let d = Math.hypot(q.x - p.x, (q.y - p.y) * 1.6);
    if (q.shield > 0) d *= 1.5;
    d *= .55 + q.hp / 220;
    if (q === p.ai.tgt) d *= .8;
    if ((q.invis || q.buffs.gizli > 0) && q.reveal <= 0) d *= 1.6;
    if (d < bs) { bs = d; best = q; }
  }
  return best;
}

function planEdge(p, A, B, e, landX) {
  const cx = p.x + p.w / 2;
  const lx = clamp(landX, B.x + 18, B.x + B.w - 18);
  if (e.type === 'drop') {
    const lo = Math.max(A.x, B.x) + 14, hi = Math.min(A.x + A.w, B.x + B.w) - 14;
    if (lo <= hi) { const x = clamp(cx, lo, hi); return { gx: x, dropAt: x, B, landX: lx }; }
  }
  if (e.type === 'off' || e.type === 'drop') {
    const right = B.x + B.w / 2 > A.x + A.w / 2;
    return { gx: right ? A.x + A.w + 14 : A.x - 14, off: true, B, landX: lx };
  }
  const near = clamp(clamp(cx, B.x + 10, B.x + B.w - 10), A.x + 10, A.x + A.w - 10);
  const overlap = near > B.x && near < B.x + B.w;
  const tx = overlap ? near : (B.x > A.x + A.w ? A.x + A.w - 12 : A.x + 12);
  return { gx: tx, jumpAt: tx, B, landX: lx };
}

function groundPlan(p, t, wd) {
  const g = p.ground, D = p.diff, ai = p.ai, cx = p.x + p.w / 2;
  // leave a platform that is about to vanish, crumble or drive off screen
  if (!standable(g) || exiting(g)) {
    let best = null, bc = 1e9;
    for (const B of M.solid) {
      if (B === g || !standable(B) || exiting(B)) continue;
      const e = navEdge(g, B); if (!e) continue;
      const c = e.cost + (K.isStatic(B) ? 0 : 80);
      if (c < bc) { bc = c; best = { B, e }; }
    }
    if (best) return planEdge(p, g, best.B, best.e, best.B.x + best.B.w / 2);
    return { gx: clamp(cx, g.x + 20, g.x + g.w - 20) };
  }
  // crates and pickups worth a detour
  const itemLive = ai.item && (M.crateList.includes(ai.item) || M.pickups.includes(ai.item));
  if (!itemLive || ai.itemT <= 0) {
    ai.item = null;
    if (Math.random() < D.crate) {
      const weak = !wd || wd.cat === 'tabanca' || (p.clips !== Infinity && p.clips <= 1 && p.ammo < wd.clip * .35);
      let bv = .25;
      for (const k of M.crateList) { if (!k.ground || !weak) continue; const v = 1.2 - Math.abs(k.x - cx) / 800; if (v > bv) { bv = v; ai.item = k; } }
      for (const k of M.pickups) {
        let v = k.def.id === 'saglik' ? (p.hp < 55 ? 1.5 : 0) : k.def.id === 'dinamit' && p.gren === Infinity ? 0 : .6;
        v -= Math.abs(k.x - cx) / 800; if (v > bv) { bv = v; ai.item = k; }
      }
      ai.itemT = 2.5;
    }
  }
  let goalPl = null, goalX = cx;
  if (ai.item) {
    const it = ai.item, crate = !!it.w;
    const ix = crate ? it.x + it.w / 2 : it.x, iy = crate ? it.y + it.h : it.y + 26;
    const ip = crate ? it.ground : platUnder(ix, iy - 4);
    if (ip && ip.on) { goalPl = ip; goalX = ix; }
  }
  if (!goalPl && t) {
    const tp = feetPlat(t), tcx = t.x + t.w / 2;
    const base = !wd ? 240 : wd.cat === 'pompali' ? 95 : wd.cat === 'keskin' ? 360 : (wd.kind === 'rocket' || wd.kind === 'arc') ? 300 : wd.cat === 'tabanca' ? 200 : 230;
    const pref = base * (p.hp < 35 ? 1.45 : 1) / (D.aggr || 1);
    const sameBand = Math.abs((t.y + t.h) - (p.y + p.h)) < 26;
    if (!tp || tp === g || (sameBand && tcx > g.x - 60 && tcx < g.x + g.w + 60)) {
      let side = Math.sign(cx - tcx) || 1;
      if (D.edge && tp === g) side = Math.sign(g.x + g.w / 2 - tcx) || side;   // stay inward: hits push the target out
      if (p.reload > 0 && Math.abs(tcx - cx) < 220) side = Math.sign(cx - tcx) || side;
      goalPl = g;
      goalX = clamp(tcx + side * pref + Math.sin(M.time * 1.7 + p.i * 2) * (D.wobble || 0) * .5, g.x + 16, g.x + g.w - 16);
    } else {
      goalPl = tp;
      goalX = clamp(tcx + (Math.sign(cx - tcx) || 1) * pref * .6, tp.x + 16, tp.x + tp.w - 16);
    }
  }
  if (!goalPl) { goalPl = g; goalX = g.x + g.w / 2; }
  if (goalPl === g) return { gx: clamp(goalX, g.x + 12, g.x + g.w - 12) };
  const hop = navNext(g, goalPl);
  if (!hop) return { gx: clamp(goalX, g.x + 16, g.x + g.w - 16) };
  return planEdge(p, g, hop.B, hop.edge, hop.B === goalPl ? goalX : hop.B.x + hop.B.w / 2);
}

function airControl(p, c, dt) {
  const ai = p.ai, D = p.diff, cx = p.x + p.w / 2, feet = p.y + p.h;
  const maxJ = p.perk === 'jump3' ? 3 : 2;
  if (!ai.wasAir) {
    ai.wasAir = true; ai.willRecover = Math.random() < D.recover; ai.rec = null; ai.recT = 0;
    if (!ai.air && ai.plan && ai.plan.off && ai.plan.B) ai.air = { B: ai.plan.B, ox: ai.plan.landX - ai.plan.B.x };
  }
  if (ai.air && ai.air.B && ai.air.B.on) {
    const B = ai.air.B, tx = clamp(B.x + ai.air.ox, B.x + 14, B.x + B.w - 14);
    const dir = Math.abs(tx - cx) > 8 ? Math.sign(tx - cx) : 0;
    if (dir < 0) c.l = 1; else if (dir > 0) c.r = 1;
    c.u = 1;
    const r = simFall(p, dir, -1, 1.4);
    const lands = r && r.pl && (standable(r.pl) || r.pl.bounce);
    if (p.jumps < maxJ && p.vy > -90) {
      if (!lands) c.uP = 1;
      else if (r.pl !== B && B.y < r.pl.y - 20 && feet > B.y - 4) c.uP = 1;
      return;
    }
    if (lands || p.vy < 0) return;
    ai.air = null;  // the planned landing is gone: fall back to recovery
  }
  ai.air = null;
  if (!ai.willRecover) return;
  const under = platUnder(cx, feet);
  if (under && standable(under)) {
    let d = ai.plan && ai.plan.on === under ? Math.sign(Math.round(ai.plan.gx - cx) / 10 | 0) : 0;
    const r = simFall(p, d, -1, 1.4);
    if (r && r.pl && standable(r.pl)) { if (d < 0) c.l = 1; else if (d > 0) c.r = 1; c.u = ai.hopT > 0 ? 0 : 1; return; }
    const r0 = d ? simFall(p, 0, -1, 1.4) : null;
    if (r0 && r0.pl && standable(r0.pl)) { c.u = ai.hopT > 0 ? 0 : 1; return; }
  }
  ai.recT -= dt;
  if (!ai.rec || ai.recT <= 0) { ai.rec = bestRecovery(p); ai.rec.t = 0; ai.rec.used = false; ai.recT = .12; }
  const r = ai.rec; r.t += dt;
  if (r.dir < 0) c.l = 1; else if (r.dir > 0) c.r = 1;
  c.u = 1;
  if (!r.used && r.ja >= 0 && r.t >= r.ja && p.jumps < maxJ) { c.uP = 1; r.used = true; }
}

function aiControl(p, dt) {
  const ai = p.ai, D = p.diff, c = blankC();
  if (p.diffId === 'kukla') return c;
  ai.think -= dt; ai.nadeCd -= dt; ai.jumpCd -= dt; ai.hopCd -= dt; ai.retarget -= dt; ai.dodgeCd -= dt; ai.itemT -= dt; ai.hopT -= dt;
  if (ai.retarget <= 0 || !ai.tgt || ai.tgt.out || ai.tgt.elim || ai.tgt.ko) { ai.tgt = pickTarget(p); ai.retarget = rand(.5, 1); }
  const t = ai.tgt, wd = p.weapon ? K.WEAP[p.weapon] : null;
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  let wantFace = 0;

  if (!p.ground) airControl(p, c, dt);
  else {
    if (ai.wasAir) { ai.wasAir = false; ai.air = null; ai.think = 0; }
    if (ai.think <= 0 || !ai.plan || ai.plan.on !== p.ground) {
      ai.plan = groundPlan(p, t, wd); ai.plan.on = p.ground;
      ai.think = D.think * rand(.8, 1.25); ai.sprayRoll = Math.random();
    }
    const pl = ai.plan, g = p.ground;
    let gx = pl.gx, flee = 0;
    for (const d of M.dyn) {
      if (d.fuse > 1.1 || (d.owner !== p && sameTeam(p, d.owner))) continue;
      if (Math.hypot(d.x - cx, d.y - cy) < DYN.r + 30 && Math.random() < D.dodge + .3) { flee = Math.sign(cx - d.x) || 1; break; }
    }
    if (flee) gx = cx + flee * 140;
    if (ai.dodgeCd <= 0 && M.countdown <= 0) {
      for (const b of M.bullets) {
        if (b.owner === p || sameTeam(p, b.owner) || b.kind === 'arc') continue;
        const dx = cx - b.x;
        if (Math.sign(dx) !== Math.sign(b.vx) || Math.abs(b.y - cy) > 22) continue;
        if (Math.abs(dx) / Math.max(1, Math.abs(b.vx)) < .3) { ai.dodgeCd = .55; if (Math.random() < D.dodge) { c.uP = 1; ai.hopT = .5; } break; }
      }
    }
    if (pl.jumpAt != null && !flee && Math.abs(cx - pl.jumpAt) < 16 && ai.jumpCd <= 0) {
      if (jumpOk(p, pl.B, pl.landX)) { c.uP = 1; c.u = 1; ai.air = { B: pl.B, ox: pl.landX - pl.B.x }; ai.jumpCd = .35; }
      else { gx = cx; ai.jumpCd = .12; }
    }
    if (pl.dropAt != null && !flee && Math.abs(cx - pl.dropAt) < 16) { c.dP = 1; c.d = 1; ai.air = { B: pl.B, ox: pl.landX - pl.B.x }; }
    let dir = Math.abs(gx - cx) > 9 ? Math.sign(gx - cx) : 0;
    const allowOff = pl.off && !flee;
    if (dir && !allowOff) {
      const ahead = cx + dir * 22;
      if ((ahead < g.x || ahead > g.x + g.w) && !platUnder(ahead, g.y + 2)) { dir = 0; if (flee) c.uP = 1; }
    }
    if (D.recover > .5 && !allowOff) {
      const slide = p.vx * Math.abs(p.vx) / (2 * 620);
      if (cx + slide > g.x + g.w - 6 && !platUnder(g.x + g.w + 20, g.y + 2)) dir = -1;
      if (cx + slide < g.x + 6 && !platUnder(g.x - 20, g.y + 2)) dir = 1;
    }
    if (dir < 0) c.l = 1; else if (dir > 0) c.r = 1;
    if (t && ai.hopCd <= 0 && Math.random() < D.hop * dt * 2 && Math.abs(t.x - p.x) < 450) { c.uP = 1; ai.hopCd = 1.1; ai.hopT = .6; }
  }

  // shooting, on the ground and in the air
  if (wd && t && !t.out && !t.ko && M.countdown <= 0) {
    const tcx = t.x + t.w / 2, dist = Math.abs(tcx - cx);
    const range = wd.cat === 'pompali' ? 280 : wd.cat === 'keskin' ? 980 : wd.kind === 'laser' ? 900 : 700;
    const gunY = p.y + 21 * p.scale;
    let ty = t.y + t.h * .5;
    if (D.lead && wd.speed) { const tt = dist / wd.speed; ty += t.vy * tt + (t.ground ? 0 : .5 * M.g * tt * tt); }
    const err = Math.abs(ty - gunY), tol = D.aimTol * (t.mini ? .75 : 1);
    const ok = err < tol || (err < tol * 1.9 && ai.sprayRoll < D.spray);
    const seen = !((t.invis || t.buffs.gizli > 0) && t.reveal <= 0) || ai.sprayRoll < .25;
    if (ok && seen && dist < range) { ai.aim += dt; wantFace = Math.sign(tcx - cx) || p.face; }
    else ai.aim = Math.max(0, ai.aim - dt * 2);
    let safe = true;
    if (p.ground && D.edge && wd.recoil > 100) {
      const g = p.ground, f = wantFace || p.face, back = f > 0 ? cx - g.x : g.x + g.w - cx;
      if (back < 30 && !platUnder(f > 0 ? g.x - 20 : g.x + g.w + 20, g.y + 2)) safe = false;
    }
    if (ai.aim > D.react && p.shield < 1.6 && safe) {
      if (wd.auto) c.f = 1; else { c.fP = ai.tog ? 1 : 0; ai.tog = !ai.tog; }
    }
  }
  // dynamite: more likely when the target is on another level where bullets cannot reach
  if (t && p.gren > 0 && ai.nadeCd <= 0 && p.perk !== 'kamikaze' && M.countdown <= 0) {
    const dist = Math.abs(t.x - p.x), dy = Math.abs(t.y - p.y);
    const rate = (wd ? D.nade : 2.5) * (dy > 40 ? 1.8 : 1);
    if (dist > 70 && dist < 540 && Math.random() < rate * dt) {
      const th = bestThrow(p, t.x + t.w / 2 + t.vx * .45, t.y + t.h);
      ai.nadeCd = th ? (wd ? rand(2, 3.5) : rand(.6, 1)) : .25;
      if (th) { c.gP = 1; ai.power = th.pw; wantFace = th.face; }
    }
  }
  c.face = wantFace;
  return c;
}

/* ================= simulation ================= */
function updatePlats(dt) {
  const t = M.time;
  for (const pl of M.plats) {
    let nx = pl.x, ny = pl.y;
    if (pl.move) {
      const [mx, my, per] = pl.move, k = (1 - Math.cos(t * Math.PI * 2 / per)) / 2;
      nx = pl.bx + mx * k; ny = pl.by + my * k;
    } else if (pl.orbit) {
      const [ocx, ocy, r, per, ph] = pl.orbit, a = (t / per + ph) * Math.PI * 2;
      nx = ocx + Math.cos(a) * r - pl.w / 2; ny = ocy + Math.sin(a) * r * .6;
    } else if (pl.drive) {
      nx = pl.x + pl.drive * dt;
      if (pl.drive > 0 && nx > W + 300) nx -= W + 600 + pl.w;
      if (pl.drive < 0 && nx + pl.w < -300) nx += W + 600 + pl.w;
    }
    pl.dx = nx - pl.x; pl.dy = ny - pl.y;
    if (Math.abs(pl.dx) > 200) pl.dx = 0;
    pl.x = nx; pl.y = ny;
    if (pl.blink) {
      const [on, off, ph] = pl.blink, cyc = (t + ph) % (on + off);
      const was = pl.on; pl.on = cyc < on; pl.warn = pl.on && cyc > on - .8;
      if (was && !pl.on) for (let i = 0; i < 8; i++) M.parts.push({ type: 'spark', x: pl.x + Math.random() * pl.w, y: pl.y + 4, vx: rand(-60, 60), vy: rand(-120, 40), t: .3, max: .3, color: '#7ef0d0', grav: 0 });
    }
    if (pl.crumble) {
      if (pl.gone > 0) { pl.gone -= dt; pl.on = false; if (pl.gone <= 0) { pl.on = true; pl.cr = 0; pl.back = .6; } }
      else if (pl.cr > 0) {
        pl.cr += dt;
        if (pl.cr > .65) {
          pl.gone = 4.5; pl.on = false; K.sfx('crumble');
          for (let i = 0; i < 10; i++) M.parts.push({ type: 'debris', x: pl.x + Math.random() * pl.w, y: pl.y + 6, vx: rand(-60, 60), vy: rand(-80, 40), t: 1, max: 1, size: rand(5, 10), color: M.theme.plat[1], grav: 1, rot: rand(0, 6), vr: rand(-6, 6) });
        }
      }
    }
    if (pl.back > 0) pl.back -= dt;
    if (pl.squash > 0) pl.squash -= dt;
  }
  M.solid = M.plats.filter(pl => pl.on);
}
function updateWind(dt) {
  const w = M.windDef; if (!w) return;
  const ph = M.time % w.period, cyc = Math.floor(M.time / w.period);
  M.wind.dir = cyc % 2 ? -1 : 1;
  M.wind.on = M.countdown <= 0 && ph > w.period - w.dur;
  M.wind.warn = M.countdown <= 0 && !M.wind.on && ph > w.period - w.dur - 1.6;
  if (M.wind.on && Math.random() < .9) {
    const L = M.cam.x - 700, R = M.cam.x + 700;
    M.parts.push({ type: 'streak', x: M.wind.dir > 0 ? L : R, y: rand(-40, H), vx: M.wind.dir * rand(900, 1400), vy: rand(-20, 20), t: 1.4, max: 1.4, color: 'rgba(240,200,140,' });
  }
}
function windForce() { return M.wind && M.wind.on ? M.wind.dir * M.windDef.f : 0; }

function updatePlayer(p, c, dt) {
  p.anim += dt;
  if (p.ko) {
    p.koT += dt; p.vy += M.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (Math.random() < .5) M.parts.push({ type: 'star', x: p.x + p.w / 2 + rand(-8, 8), y: p.y + rand(0, 10), vx: rand(-40, 40), vy: rand(-60, 0), t: .5, max: .5, size: 4, color: '#ffe08a' });
    if (p.y > H + 140 || p.x < -320 || p.x > W + 320 || p.koT > 2.5) kill(p);
    return;
  }
  const wd = p.weapon ? K.WEAP[p.weapon] : null;
  const b = p.buffs;
  if (p.ground && !p.ground.on) { p.ground = null; p.jumps = Math.max(p.jumps, 1); }
  const onG = !!p.ground;
  if (p.ground) { p.x += p.ground.dx + (p.ground.conv || 0) * dt; p.y = p.ground.y - p.h; }
  const wf = windForce();
  if (wf) p.vx += wf * dt * (onG ? .55 : 1);
  if (!onG && M.zones.length) {
    const zx = p.x + p.w / 2, zy = p.y + p.h / 2;
    for (const z of M.zones) if (zx > z.x && zx < z.x + z.w && zy > z.y && zy < z.y + z.h) p.vy = Math.max(p.vy - z.f * dt, -430);
  }
  const weightPen = wd && p.perk !== 'weight' ? wd.weight * 22 : 0;
  const maxS = (260 - weightPen) * (b.hiz > 0 ? 1.4 : 1) * (p.mini ? 1.15 : 1);
  const want = (c.r ? 1 : 0) - (c.l ? 1 : 0);

  if (want) {
    p.face = want;
    if (want * p.vx < maxS) { p.vx += want * (onG ? 2600 : 1500) * dt; if (want * p.vx > maxS) p.vx = want * maxS; }
  }
  if (c.face) p.face = c.face;
  const sliding = Math.abs(p.vx) > maxS + 1;
  let decel = onG ? (sliding ? 620 : 1800) : 150;
  if (onG && M.ice) decel *= .3;
  if (want && Math.sign(p.vx) === want && !sliding) decel = 0;
  p.vx = approach(p.vx, 0, decel * dt);

  const maxJ = p.perk === 'jump3' ? 3 : 2;
  const jm = (b.yay > 0 ? 1.25 : 1) * (M.map.g ? Math.sqrt(M.map.g) : 1);
  if (c.uP) {
    if (onG) { p.vy = -650 * jm; p.ground = null; p.jumps = 1; }
    else if (p.jumps < maxJ) {
      p.vy = -560 * jm; p.jumps++;
      M.parts.push({ type: 'ring', x: p.x + p.w / 2, y: p.y + p.h, t: .25, max: .25, size: 16, color: 'rgba(255,255,255,.8)' });
    }
  }
  p.jetOn = false;
  if (M.jet && !p.ground && c.u && p.vy > -140 && p.jet > 0) {
    p.vy = Math.max(p.vy - 3400 * dt, -380); p.jet -= .45 * dt; p.jetOn = true;
    M.parts.push({ type: 'fire', x: p.x + p.w / 2 - p.face * 9, y: p.y + p.h * .75, vx: rand(-30, 30), vy: rand(160, 260), t: .25, max: .25, size: 6 });
    K.sfx('jet', .7);
  } else if (M.jet) p.jet = Math.min(1, p.jet + .2 * dt);

  if (c.dP && p.ground && platUnder(p.x + p.w / 2, p.ground.y + 16)) { p.drop = .22; p.ground = null; p.jumps = Math.max(p.jumps, 1); }

  p.vy += M.g * dt;
  if (!c.u && p.vy < 0 && !p.jetOn) p.vy += M.g * .6 * dt;
  if (p.vy > 1000) p.vy = 1000;
  p.vx = clamp(p.vx, -1500, 1500);

  const prevBottom = p.y + p.h;
  const wasG = p.ground;
  p.x += p.vx * dt; p.y += p.vy * dt;
  p.ground = null; p.drop -= dt;
  if (p.vy >= 0 && p.drop <= 0) {
    for (const pl of M.solid) {
      if (p.x + 4 < pl.x + pl.w && p.x + p.w - 4 > pl.x && prevBottom <= pl.y - pl.dy + Math.abs(pl.dy) + 1 && p.y + p.h >= pl.y) {
        if (pl.bounce) {
          p.y = pl.y - p.h; p.vy = -pl.bounce * jm; p.jumps = 1; pl.squash = .25;
          K.sfx('boing'); puff(p.x + p.w / 2, pl.y, 6, 'rgba(255,255,255,.7)', 110, .3, 3);
          break;
        }
        if (!wasG && p.vy > 500) puff(p.x + p.w / 2, pl.y, 6, 'rgba(230,230,230,.7)', 90, .3, 3);
        p.y = pl.y - p.h; p.vy = 0; p.ground = pl; p.jumps = 0;
        if (pl.crumble && !pl.cr) pl.cr = .001;
        break;
      }
    }
  }
  if (wasG && !p.ground && p.jumps === 0) p.jumps = 1;

  if (p.shield > 0) p.shield -= dt;
  if (p.hitT > 0) p.hitT -= dt;
  if (p.reveal > 0) p.reveal -= dt;
  if (p.gcd > 0) p.gcd -= dt;
  if (p.recoilT > 0) p.recoilT -= dt;
  p.hurtT += dt;
  if (p.hurtT > .45) p.hpG = approach(p.hpG, p.hp, 60 * dt);
  for (const k in b) if (b[k] > 0) b[k] -= dt;

  // weapon
  p.cool -= dt;
  if (wd) {
    if (p.reload > 0) { p.reload -= dt; if (p.reload <= 0) { p.ammo = fullClip(p, wd); K.sfx('tick', .5); } }
    if (wd.spin) p.spin = c.f ? Math.min(1, p.spin + dt * 1.6) : Math.max(0, p.spin - dt * 2);
    if (p.burstLeft > 0) {
      p.burstT -= dt;
      if (p.burstT <= 0 && p.ammo > 0 && p.reload <= 0) { p.burstLeft--; p.burstT = .06; shoot(p, wd); }
    }
    const trig = wd.auto ? c.f : c.fP;
    if (trig && p.weapon === wd.id && p.cool <= 0 && p.reload <= 0 && p.ammo > 0 && M.countdown <= 0 && p.charge < 0) {
      p.cool = wd.rate * (wd.spin ? 1 / (.25 + .75 * p.spin) : 1);
      if (wd.burst) { p.burstLeft = wd.burst - 1; p.burstT = .06; }
      shoot(p, wd);
    }
  }
  // dynamite: hold to aim (power grows, path is previewed), release to throw
  if (c.gP && M.countdown <= 0) {
    if (p.perk === 'kamikaze' && M.mode !== 'challenge') { kamikaze(p); return; }
    if (p.gren > 0 && p.gcd <= 0 && p.charge < 0) {
      if (p.type === 'ai') throwDyn(p, p.ai.power);
      else p.charge = 0;
    }
  }
  if (p.charge >= 0) {
    if (c.g) {
      p.charge += dt;
      const pts = [];
      const land = simDyn(throwVec(p, chargePower(p.charge)), pts);
      p.aim = { pts, land };
    } else throwDyn(p, chargePower(p.charge));
  }

  if (p.y > H + 140 || p.x < -320 || p.x > W + 320) kill(p);
}

function muzzle(p, wd) {
  return { x: p.x + p.w / 2 + p.face * (6 + wd.len) * p.scale, y: p.y + 21 * p.scale };
}

function shoot(p, wd) {
  const m = muzzle(p, wd);
  const pow = p.buffs.guc > 0;
  const kbMul = pow ? 1.7 : 1, dmgMul = pow ? 1.5 : 1;
  p.shield = 0; p.shots++; p.reveal = .35; p.recoilT = .08;
  if (wd.kind === 'laser') fireLaser(p, wd, m, kbMul, dmgMul);
  else {
    for (let i = 0; i < wd.pellets; i++) {
      const a = (Math.random() - .5) * 2 * wd.spread;
      const sp = wd.speed * (wd.pellets > 1 ? rand(.88, 1.06) : 1);
      M.bullets.push({ x: m.x, y: m.y, px: m.x, py: m.y, vx: p.face * Math.cos(a) * sp, vy: Math.sin(a) * sp - (wd.kind === 'arc' ? 260 : 0),
        kb: wd.kb * kbMul, dmg: Math.round(wd.dmg * dmgMul), t: wd.life, owner: p, kind: wd.kind, pierce: wd.pierce, hit: null, heavy: wd.kb >= 550 });
    }
    M.parts.push({ type: 'muzzle', x: m.x, y: m.y, t: .07, max: .07, size: wd.kind === 'rocket' ? 15 : 7 + Math.min(wd.kb / 110, 8) + (wd.pellets > 1 ? 4 : 0), face: p.face, color: wd.kind === 'demat' ? '#7ef0d0' : '#ffd36b' });
    if (wd.kind === 'bullet') M.parts.push({ type: 'shell', x: p.x + p.w / 2 + p.face * 6, y: m.y - 2, vx: -p.face * rand(60, 140), vy: rand(-260, -160), t: .7, max: .7, size: 2, color: wd.pellets > 1 ? '#d94a3a' : '#e7b85a', grav: 1, rot: 0 });
  }
  if (p.perk !== 'recoil') p.vx -= p.face * wd.recoil * (p.ground ? .6 : 1);
  K.sfx(wd.kind === 'laser' ? 'laser' : wd.kind === 'demat' ? 'demat' : (wd.kb >= 500 || wd.pellets > 1 || wd.kind !== 'bullet') ? 'heavy' : 'shot', .8);

  if (!(p.perk === 'infpistol' && wd.cat === 'tabanca')) p.ammo--;
  if (p.ammo <= 0) {
    if (p.clips !== Infinity) {
      p.clips--;
      if (p.clips <= 0) { setWeapon(p, baseGun(p)); return; }
    }
    p.reload = wd.reload;
  }
}

function fireLaser(p, wd, m, kbMul, dmgMul) {
  let x = m.x, endX = p.face > 0 ? W + 200 : -200;
  let hitP = null;
  for (let s = 0; s < 150; s++) {
    x += p.face * 8;
    for (const q of M.players) {
      if (q === p || q.out || q.elim || q.ko || sameTeam(p, q)) continue;
      if (x > q.x && x < q.x + q.w && m.y > q.y && m.y < q.y + q.h) { hitP = q; break; }
    }
    if (hitP) { endX = x; break; }
    for (const tg of M.targets) if (tg.alive && Math.hypot(x - tg.x, m.y - tg.y) < tg.r) breakTarget(tg);
    if (x < -200 || x > W + 200) break;
  }
  M.parts.push({ type: 'beam', x: m.x, y: m.y, x2: endX, t: .16, max: .16, color: wd.accent });
  if (hitP) applyHit(hitP, p, p.face * wd.kb * kbMul, wd.kb * kbMul, Math.round(wd.dmg * dmgMul), endX, m.y, true);
}

/* ---------- health ---------- */
function hurt(q, amount, owner, dir) {
  if (!M.hpOn || q.shield > 0 || q.ko || q.out || amount <= 0) return;
  amount = Math.round(amount);
  q.hp = Math.max(0, q.hp - amount); q.hurtT = 0;
  if (owner && owner !== q) owner.dmgDone += amount;
  dmgPop(q.x + q.w / 2, q.y - 4, amount, amount >= 25);
  if (q.hp <= 0) knockout(q, owner, dir);
}
function knockout(q, owner, dir) {
  q.ko = true; q.hp = 0; q.koT = 0; q.charge = -1; q.aim = null;
  q.vx = (dir || (Math.random() < .5 ? -1 : 1)) * 560; q.vy = -820; q.ground = null; q.shield = 0;
  if (owner && owner !== q) { q.lastHit = owner; q.lastHitT = M.time; }
  popup(q.x + q.w / 2, q.y - 24, 'KO!', '#ffc531', true); K.sfx('ko'); shake(8);
  for (let i = 0; i < 10; i++) M.parts.push({ type: 'star', x: q.x + q.w / 2, y: q.y + 10, vx: rand(-220, 220), vy: rand(-260, -40), t: .6, max: .6, size: 5, color: i % 2 ? '#ffe08a' : '#ffffff' });
}

function applyHit(q, owner, push, kb, dmg, x, y, heavy) {
  q.reveal = .5;
  if (q.ko) return;
  if (q.shield > 0) { sparks(x, y, 5, null, 160, '#cfe8ff'); return; }
  const m = M.hpOn ? 1 + (1 - q.hp / MAX_HP) * .8 : 1;
  q.vx += push * m * (q.ground ? 1 : 1.3);
  if (kb >= 400) { q.vy -= 120; q.ground = null; }
  q.lastHit = owner; q.lastHitT = M.time; q.hitT = .1;
  if (owner) owner.hits++;
  // combo counter like "5 VURUŞ" for consecutive hits from the same shooter
  if (q.combo && q.combo.by === owner && M.time - q.combo.t < 1.1) q.combo.n++;
  else q.combo = { by: owner, n: 1, pop: null };
  q.combo.t = M.time;
  if (q.combo.n >= 3) {
    const txt = q.combo.n + ' VURUŞ', size = Math.min(28, 15 + q.combo.n * .6);
    const pp = q.combo.pop;
    if (pp && M.pops.includes(pp)) { pp.text = txt; pp.t = pp.max; pp.size = size; pp.x = q.x + q.w / 2; pp.y = q.y - 34; }
    else { q.combo.pop = { x: q.x + q.w / 2, y: q.y - 34, text: txt, color: '#ff9b3a', t: 1, max: 1, size, vy: -12, tilt: rand(-.12, .12) }; M.pops.push(q.combo.pop); }
  }
  sparks(x, y, heavy ? 9 : 5, Math.sign(push), heavy ? 380 : 260);
  M.parts.push({ type: 'flash', x, y, t: .06, max: .06, size: heavy ? 10 : 6, color: '#fff6d0' });
  K.sfx('hit');
  if (heavy) shake(5);
  hurt(q, dmg, owner, Math.sign(push));
}

function dematerialize(q, owner) {
  if (q.shield > 0) { sparks(q.x + q.w / 2, q.y + q.h / 2, 6, null, 160, '#7ef0d0'); return; }
  q.lastHit = owner; q.lastHitT = M.time;
  for (let i = 0; i < 30; i++) M.parts.push({ type: 'sq', x: q.x + rand(0, q.w), y: q.y + rand(0, q.h), vx: rand(-40, 40), vy: rand(-160, -40), t: rand(.5, .9), max: .9, size: rand(3, 6), color: i % 2 ? '#7ef0d0' : q.color });
  M.parts.push({ type: 'ring', x: q.x + q.w / 2, y: q.y + q.h / 2, t: .35, max: .35, size: 40, color: '#7ef0d0' });
  K.sfx('demat');
  kill(q, true);
}

function explode(x, y, r, kb, owner, dmgMax = 40) {
  K.sfx('boom'); shake(13);
  M.parts.push({ type: 'flash', x, y, t: .1, max: .1, size: r * .9, color: '#fffbe8' });
  M.parts.push({ type: 'ring', x, y, t: .3, max: .3, size: r * 1.1, color: '#ffffff' });
  for (let i = 0; i < 9; i++) M.parts.push({ type: 'fire', x: x + rand(-r * .25, r * .25), y: y + rand(-r * .25, r * .15), vx: rand(-60, 60), vy: rand(-90, 10), t: rand(.35, .6), max: .6, size: rand(r * .25, r * .45) });
  for (let i = 0; i < 10; i++) M.parts.push({ type: 'smoke', x: x + rand(-25, 25), y: y + rand(-20, 10), vx: rand(-50, 50), vy: rand(-90, -30), t: rand(.8, 1.3), max: 1.3, size: rand(12, 24), color: 'rgba(55,50,62,' });
  for (let i = 0; i < 14; i++) { const a = rand(0, Math.PI * 2), s = rand(200, 520); M.parts.push({ type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, t: rand(.3, .6), max: .6, color: i % 3 ? '#ffd36b' : '#ff8a3d', grav: 1 }); }
  for (let i = 0; i < 6; i++) M.parts.push({ type: 'debris', x, y, vx: rand(-260, 260), vy: rand(-480, -160), t: rand(.6, 1), max: 1, size: rand(2.5, 5), color: '#2a2630', grav: 1, rot: rand(0, 6), vr: rand(-12, 12) });
  for (const q of M.players) {
    if (q.out || q.elim || q.ko || (owner && sameTeam(owner, q))) continue;
    const dx = q.x + q.w / 2 - x, dy = q.y + q.h / 2 - y, d = Math.max(Math.hypot(dx, dy), 1);
    if (d > r + 12) continue;
    if (q.shield > 0) { q.shield = Math.min(q.shield, .2); continue; }
    const near = 1 - Math.min(d / r, 1);
    const blast = q.perk === 'blast' ? .3 : 1;
    const m = M.hpOn ? 1 + (1 - q.hp / MAX_HP) * .8 : 1;
    const f = kb * (1 - .55 * Math.min(d / r, 1)) * blast * m;
    q.vx += dx / d * f; q.vy += dy / d * f * .5 - 260 * near * blast;
    if (q.vy < 0) q.ground = null;
    if (q !== owner) { q.lastHit = owner; q.lastHitT = M.time; }
    q.hitT = .15; q.reveal = .6;
    hurt(q, dmgMax * (.4 + .6 * near) * (q.perk === 'blast' ? .5 : 1), owner, Math.sign(dx) || 1);
  }
  for (const tg of M.targets) if (tg.alive && Math.hypot(tg.x - x, tg.y - y) < r + tg.r) breakTarget(tg);
}

function kamikaze(p) {
  explode(p.x + p.w / 2, p.y + p.h / 2, 150, 1150, p, 60);
  kill(p);
}

function throwDyn(p, pw) {
  const v = throwVec(p, pw);
  p.charge = -1; p.aim = null;
  if (p.gren !== Infinity) p.gren--;
  p.gcd = M.rules.dynamiteOnly || p.gren === Infinity ? .5 : .4;
  p.shield = 0;
  K.sfx('throw');
  M.dyn.push({ x: v.x, y: v.y, vx: v.vx, vy: v.vy, age: 0, owner: p, duck: p.perk === 'duck', ground: false, rot: 0,
    fuse: p.perk === 'duck' ? DYN.duckFuse : DYN.fuse, beep: 0 });
}

function breakTarget(tg) {
  tg.alive = false;
  K.sfx('target');
  sparks(tg.x, tg.y, 10, null, 260, '#ff5a5a');
  puff(tg.x, tg.y, 8, '#f3efe6', 180, .4, 3);
  for (let i = 0; i < 5; i++) M.parts.push({ type: 'debris', x: tg.x, y: tg.y, vx: rand(-200, 200), vy: rand(-300, -80), t: .8, max: .8, size: 4, color: i % 2 ? '#ff5a5a' : '#f3efe6', grav: 1, rot: rand(0, 6), vr: rand(-10, 10) });
  if (M.chal) { M.chal.done++; popup(tg.x, tg.y - 20, M.chal.done + '/' + M.chal.total, '#ffc531'); }
  if (M.tut) M.tut.targets = (M.tut.targets || 0) + 1;
}

function kill(p, demat) {
  if (p.out) return;
  p.out = true; p.falls++; p.ko = false; p.charge = -1; p.aim = null;
  const px = clamp(p.x + p.w / 2, 30, W - 30);
  if (!demat) {
    K.sfx('fall');
    for (let i = 0; i < 18; i++) M.parts.push({ type: 'dot', x: px, y: H - 4, vx: rand(-140, 140), vy: rand(-520, -220), t: rand(.5, .9), max: .9, size: 4, color: p.color, grav: 1 });
  }
  const k = p.lastHit && p.lastHit !== p && M.time - p.lastHitT < 5 && !sameTeam(p, p.lastHit) ? p.lastHit : null;
  if (k) {
    k.kills++;
    if ((M.mode === 'gungame' || M.mode === 'gungamer') && !k.out) {
      k.gg++;
      const list = gunList();
      if (k.gg >= list.length) { M.winner = k; if (!M.ending) M.ending = 1.6; }
      else { setWeapon(k, list[k.gg]); popup(k.x + k.w / 2, k.y - 24, (k.gg + 1) + '. ' + K.WEAP[list[k.gg]].name, k.color); K.sfx('power'); }
    }
  }
  if (p.isRobot && k && !k.isRobot) M.score++;
  if (p.lives !== Infinity) p.lives--;
  if (M.mode !== 'challenge' && M.mode !== 'demo') popup(px, H - 40, p.lives === Infinity ? 'düştü' : (p.lives > 0 ? '-1 can' : 'elendi'), p.color);
  if (p.lives <= 0) { p.elim = true; p.elimAt = M.time; }
  else p.respawn = M.mode === 'challenge' ? .6 : 1.2;
}

/* ---------- crates & pickups ---------- */
const PICKUPS = [
  { id: 'saglik', name: '+50 Can', color: '#ff5a7a', icon: 'heart' },
  { id: 'kalkan', name: 'Kalkan', color: '#7ec8ff', icon: 'shield' },
  { id: 'hiz', name: 'Hız', color: '#5fd36a', icon: 'bolt' },
  { id: 'yay', name: 'Süper Zıplama', color: '#c98bff', icon: 'up' },
  { id: 'guc', name: 'Güç', color: '#ff8a3d', icon: 'star' },
  { id: 'gizli', name: 'Görünmezlik', color: '#d9dde6', icon: 'eye' },
  { id: 'dinamit', name: '+2 Dinamit', color: '#ffc531', icon: 'dyn' },
];
K.PICKUPS = PICKUPS;
function givePickup(p, k) {
  const d = k.def;
  if (d.id === 'kalkan') p.shield = 6;
  else if (d.id === 'saglik') { p.hp = Math.min(MAX_HP, p.hp + 50); p.hpG = Math.max(p.hpG, p.hp); }
  else if (d.id === 'dinamit') { if (p.gren !== Infinity) p.gren += 2; }
  else p.buffs[d.id] = 8;
  popup(p.x + p.w / 2, p.y - 20, d.name, d.color);
  M.parts.push({ type: 'ring', x: k.x, y: k.y, t: .3, max: .3, size: 30, color: d.color });
  K.sfx('power');
}
function crateWeapon(p) {
  if (p.perk === 'shotgun') return 'kisanamlu';
  if (p.perk === 'minigun' && Math.random() < .33) return 'minigun';
  return pick(K.CRATE_POOL);
}

function updateWorldObjects(dt) {
  // bullets
  for (let i = M.bullets.length - 1; i >= 0; i--) {
    const b = M.bullets[i];
    b.px = b.x; b.py = b.y;
    if (b.kind === 'arc') b.vy += 900 * dt;
    const len = Math.hypot(b.vx, b.vy) * dt, n = Math.max(1, Math.ceil(len / 9));
    let dead = false;
    for (let s = 0; s < n && !dead; s++) {
      b.x += b.vx * dt / n; b.y += b.vy * dt / n;
      for (const q of M.players) {
        if (q === b.owner || q.out || q.elim || q.ko || sameTeam(b.owner, q)) continue;
        if (b.pierce && b.hit && b.hit.includes(q)) continue;
        if (b.x > q.x - 2 && b.x < q.x + q.w + 2 && b.y > q.y && b.y < q.y + q.h) {
          if (b.kind === 'rocket' || b.kind === 'arc') { explode(b.x, b.y, b.kind === 'rocket' ? 120 : 100, b.kb, b.owner, b.kind === 'rocket' ? 40 : 32); dead = true; break; }
          if (b.kind === 'demat') { dematerialize(q, b.owner); dead = true; break; }
          applyHit(q, b.owner, (Math.sign(b.vx) || 1) * b.kb, b.kb, b.dmg, b.x, b.y, b.heavy);
          if (b.pierce) { (b.hit = b.hit || []).push(q); } else { dead = true; break; }
        }
      }
      if (dead) break;
      for (const tg of M.targets) {
        if (tg.alive && Math.hypot(b.x - tg.x, b.y - tg.y) < tg.r) {
          if (b.kind === 'rocket' || b.kind === 'arc') { explode(b.x, b.y, 100, b.kb, b.owner); dead = true; break; }
          breakTarget(tg); if (!b.pierce) { dead = true; break; }
        }
      }
      if (!dead && (b.kind === 'rocket' || b.kind === 'arc') && inPlatRect(b.x, b.y)) { dead = true; explode(b.x, b.y, b.kind === 'rocket' ? 120 : 100, b.kb, b.owner, b.kind === 'rocket' ? 40 : 32); }
    }
    b.t -= dt;
    if (b.kind === 'rocket' && !dead) {
      M.parts.push({ type: 'smoke', x: b.x - Math.sign(b.vx) * 12, y: b.y, vx: rand(-10, 10), vy: rand(-30, -5), t: .5, max: .6, size: 5, color: 'rgba(200,190,200,' });
      M.parts.push({ type: 'fire', x: b.x - Math.sign(b.vx) * 12, y: b.y, vx: -b.vx * .1, vy: 0, t: .12, max: .12, size: 6 });
    }
    if (!dead && (b.t <= 0 || b.x < -60 || b.x > W + 60 || b.y > H + 60)) {
      if ((b.kind === 'rocket' || b.kind === 'arc') && b.t <= 0) explode(b.x, b.y, 110, b.kb, b.owner, 36);
      dead = true;
    }
    if (dead) M.bullets.splice(i, 1);
  }

  // dynamite: arcs, bounces once or twice, settles fast, explodes on fuse or on a direct hit
  for (let i = M.dyn.length - 1; i >= 0; i--) {
    const d = M.dyn[i];
    d.age += dt; d.fuse -= dt;
    const prevY = d.y;
    d.vy += M.g * .85 * dt; d.x += d.vx * dt; d.y += d.vy * dt;
    d.rot += (d.ground ? d.vx * .02 : Math.sign(d.vx) * 12) * dt;
    d.ground = false;
    d.vx += windForce() * .5 * dt;
    if (d.vy > 0) for (const pl of M.solid) {
      if (d.x >= pl.x && d.x <= pl.x + pl.w && prevY <= pl.y - pl.dy + Math.abs(pl.dy) + 1 && d.y >= pl.y) {
        d.y = pl.y; d.x += pl.dx + (pl.conv || 0) * dt;
        if (pl.bounce) { d.vy = -pl.bounce * .8; pl.squash = .2; }
        else if (d.vy > 220) { d.vy *= d.duck ? -.6 : -.3; d.vx *= d.duck ? .85 : .6; puff(d.x, d.y, 3, 'rgba(230,230,230,.6)', 60, .25, 2); }
        else { d.vy = 0; d.ground = true; }
        break;
      }
    }
    if (d.ground) d.vx = approach(d.vx, 0, (d.duck ? 300 : 1400) * dt);
    if (!d.ground && d.age > .06) {
      for (const q of M.players) {
        if (q === d.owner || q.out || q.elim || q.ko || sameTeam(d.owner, q)) continue;
        if (d.x > q.x - 4 && d.x < q.x + q.w + 4 && d.y > q.y - 4 && d.y < q.y + q.h + 4) { d.fuse = 0; break; }
      }
    }
    if (d.fuse < .6) { d.beep -= dt; if (d.beep <= 0) { d.beep = .15; K.sfx('fuse'); } }
    else M.parts.push({ type: 'spark', x: d.x + Math.cos(d.rot - .6) * 10, y: d.y - 6 + Math.sin(d.rot - .6) * 10, vx: rand(-60, 60), vy: rand(-120, -20), t: .18, max: .18, color: '#ffd36b', grav: 1 });
    if (d.fuse <= 0) { explode(d.x, d.y - 6, d.duck ? 115 : DYN.r, d.duck ? 900 : DYN.kb, d.owner, d.duck ? 36 : DYN.dmg); M.dyn.splice(i, 1); }
    else if (d.y > H + 80 || d.x < -120 || d.x > W + 120) M.dyn.splice(i, 1);
  }

  // crates
  if (M.crates && M.countdown <= 0) {
    M.crateT -= dt;
    if (M.crateT <= 0) {
      M.crateT = rand(5, 8.5);
      if (M.crateList.length < 3) {
        const pl = pick(M.plats.filter(q => K.isStatic(q) || q.conv));
        M.crateList.push({ x: rand(pl.x + 8, pl.x + pl.w - 36), y: -30, vy: 0, w: 28, h: 24, t: 16, ground: null });
      }
    }
  }
  for (let i = M.crateList.length - 1; i >= 0; i--) {
    const k = M.crateList[i];
    if (k.ground && (!k.ground.on || k.x + k.w < k.ground.x || k.x > k.ground.x + k.ground.w)) k.ground = null;
    if (k.ground) { k.x += k.ground.dx + (k.ground.conv || 0) * dt; k.y = k.ground.y - k.h; }
    else {
      const prev = k.y + k.h;
      k.vy = Math.min(k.vy + 1200 * dt, 300); k.y += k.vy * dt;
      for (const pl of M.solid) if (!pl.bounce && k.x + k.w > pl.x && k.x < pl.x + pl.w && prev <= pl.y - pl.dy + Math.abs(pl.dy) + 1 && k.y + k.h >= pl.y) {
        k.y = pl.y - k.h; k.vy = 0; k.ground = pl; puff(k.x + k.w / 2, pl.y, 5, 'rgba(230,220,200,.6)', 80, .3, 3); break;
      }
    }
    k.t -= dt;
    let taken = false;
    for (const p of M.players) {
      if (p.out || p.elim || p.ko) continue;
      if (p.x < k.x + k.w && p.x + p.w > k.x && p.y < k.y + k.h && p.y + p.h > k.y) {
        if (k.chal) {
          M.chal.done++; popup(k.x + k.w / 2, k.y - 14, M.chal.done + '/' + M.chal.total, '#ffc531'); K.sfx('pick');
          dropChallengeCrate();
        } else {
          const wid = crateWeapon(p);
          setWeapon(p, wid); K.sfx('pick');
          popup(p.x + p.w / 2, p.y - 20, K.WEAP[wid].name, p.color);
          if (M.tut) M.tut.crate = true;
        }
        for (let j = 0; j < 6; j++) M.parts.push({ type: 'debris', x: k.x + k.w / 2, y: k.y + k.h / 2, vx: rand(-200, 200), vy: rand(-300, -100), t: .7, max: .7, size: rand(3, 6), color: '#b9773a', grav: 1, rot: rand(0, 6), vr: rand(-10, 10) });
        taken = true; break;
      }
    }
    if (taken || k.t <= 0 || k.y > H + 40) M.crateList.splice(i, 1);
  }

  // pickups
  if (M.pickupsOn && M.countdown <= 0) {
    M.pickT -= dt;
    if (M.pickT <= 0) {
      M.pickT = rand(10, 15);
      if (M.pickups.length < 2) {
        const pl = pick(M.plats.filter(K.isStatic));
        const def = M.hpOn && Math.random() < .3 ? PICKUPS[0] : pick(PICKUPS);
        M.pickups.push({ x: rand(pl.x + 20, pl.x + pl.w - 20), y: pl.y - 26, def, t: 14, ph: Math.random() * 6 });
      }
    }
  }
  for (let i = M.pickups.length - 1; i >= 0; i--) {
    const k = M.pickups[i];
    k.t -= dt; k.ph += dt;
    let taken = false;
    for (const p of M.players) {
      if (p.out || p.elim || p.ko) continue;
      if (Math.abs(p.x + p.w / 2 - k.x) < p.w / 2 + 12 && Math.abs(p.y + p.h / 2 - k.y) < p.h / 2 + 12) { givePickup(p, k); taken = true; break; }
    }
    if (taken || k.t <= 0) M.pickups.splice(i, 1);
  }

  // particles
  for (let i = M.parts.length - 1; i >= 0; i--) {
    const q = M.parts[i];
    q.t -= dt;
    if (q.vx !== undefined) { q.x += q.vx * dt; q.y += q.vy * dt; }
    if (q.grav) q.vy += 1400 * dt;
    if (q.vr) q.rot += q.vr * dt;
    if (q.type === 'dot' && !q.grav) { q.vx *= .9; q.vy *= .9; }
    if (q.type === 'fire' || q.type === 'smoke') { q.vx *= .94; q.vy *= .94; }
    if (q.t <= 0) M.parts.splice(i, 1);
  }
  for (let i = M.pops.length - 1; i >= 0; i--) { const t = M.pops[i]; t.t -= dt; t.y += (t.vy || -30) * dt; if (t.t <= 0) M.pops.splice(i, 1); }
  M.shake = Math.max(0, M.shake - 30 * dt);
}

/* ---------- survival ---------- */
function spawnWave() {
  M.wave++;
  const n = Math.min(1 + Math.floor((M.wave - 1) / 2), 3);
  const diff = M.wave <= 2 ? 'kolay' : M.wave <= 4 ? 'orta' : M.wave <= 7 ? 'zor' : 'usta';
  for (let k = 0; k < n; k++) {
    const s = { type: 'ai', diff, robot: true, team: 99, lives: 1, name: 'Robot', colorHex: '#9aa0ae',
      cos: { color: 7, hat: 6, face: 5, outfit: 4 }, perk: M.wave >= 3 ? 'random' : 'none' };
    const p = makePlayer(s, M.players.length, -1);
    M.players.push(p); spawn(p, k * 60);
  }
  popup(W / 2, 120, M.wave + '. dalga', '#ffc531', true);
  K.sfx('go');
}

/* ---------- tutorial ---------- */
const TUT = [
  { text: 'Sağa ve sola yürü', check: (t) => t.moved > 220 },
  { text: 'Zıpla', check: (t) => t.jumped },
  { text: 'Havadayken bir kez daha zıpla', check: (t) => t.dbl },
  { text: 'Aşağı basarak alt kirişe in', check: (t) => t.dropped },
  { text: 'Ateş et ve üç hedefi vur', check: (t) => (t.targets || 0) >= 3, enter: () => { [[200, 300], [760, 300], [480, 200]].forEach(([x, y]) => M.targets.push({ x, y, r: 15, alive: true, ph: Math.random() * 6 })); } },
  { text: 'Dinamit: basılı tut, çizgiyle nişan al, bırakınca fırlar', check: (t) => t.threw },
  { text: 'Gökten düşen sandığı al: yeni silah verir', check: (t) => t.crate, enter: () => { M.crateList.push({ x: 466, y: -30, vy: 0, w: 28, h: 24, t: Infinity, ground: null }); } },
  { text: 'Kuklayı vurarak canını bitir ya da aşağı düşür', check: (t) => M.players[1] && M.players[1].falls > t.kukFalls, enter: () => { M.tut.kukFalls = M.players[1] ? M.players[1].falls : 0; } },
];
function updateTutorial() {
  const t = M.tut, p = M.players[0];
  if (!p || t.done) return;
  const c = t.lastC || {};
  if (t.prevX != null && !p.out) t.moved += Math.abs(p.x - t.prevX);
  t.prevX = p.x;
  if (c.uP && p.ground == null && p.jumps === 1 && p.vy < -500) t.jumped = true;
  if (p.jumps >= 2) t.dbl = true;
  if (p.drop > 0) t.dropped = true;
  if (M.dyn.length) t.threw = true;
  const step = TUT[t.step];
  if (step && step.check(t, p)) {
    t.step++; K.sfx('pick');
    popup(p.x + p.w / 2, p.y - 30, 'Tamam!', '#5fd36a');
    if (TUT[t.step] && TUT[t.step].enter) TUT[t.step].enter();
    if (t.step >= TUT.length) { t.done = true; finish({ win: true, title: 'Eğitim tamam', sub: 'Artık senaryonun ilk görevine hazırsın.' }); }
  }
  M.hint = TUT[t.step] ? (t.step + 1) + '/' + TUT.length + ' · ' + TUT[t.step].text : '';
}

/* ---------- end conditions ---------- */
function finish(res) {
  if (M.result) return;
  M.result = res;
  K.sfx(res.win === false ? 'lose' : 'win');
  if (K.onMatchEnd) K.onMatchEnd(res, M);
}
function standings() {
  return M.players.filter(p => !p.isRobot).slice().sort((a, b) => {
    const ae = a.elim ? a.elimAt : 1e9, be = b.elim ? b.elimAt : 1e9;
    if (ae !== be) return be - ae;
    return b.kills - a.kills;
  });
}
function checkEnd(dt) {
  if (M.mode === 'demo' || M.result) return;
  if (M.ending) { M.ending -= dt; if (M.ending <= 0) finalize(); return; }
  const live = M.players.filter(p => !p.elim);
  const humans = M.players.filter(p => p.type === 'human');
  switch (M.mode) {
    case 'challenge':
      if (M.chal.done >= M.chal.total && !M.chal.finished) { M.chal.finished = true; M.ending = .8; }
      break;
    case 'survival':
      if (humans.every(p => p.elim)) M.ending = 1.4;
      break;
    case 'campaign':
      if (humans.every(p => p.elim)) { M.winTeam = 1; M.ending = 1.4; }
      else if (M.players.filter(p => p.type !== 'human').every(p => p.elim)) { M.winTeam = 0; M.ending = 1.4; }
      break;
    case 'gungame': case 'gungamer': case 'tutorial': break;
    default: {
      const teams = new Set(live.map(p => p.team));
      if (teams.size <= 1) { M.winTeam = live.length ? live[0].team : null; M.ending = 1.4; }
    }
  }
}
function finalize() {
  const rows = standings().map(p => ({ name: p.name, color: p.color, cos: p.cos, kills: p.kills, falls: p.falls, dmg: p.dmgDone, team: p.team, gg: p.gg, type: p.type }));
  switch (M.mode) {
    case 'challenge': {
      const tm = M.clock, st = M.chal.def.stars;
      const stars = tm <= st[2] ? 3 : tm <= st[1] ? 2 : tm <= st[0] ? 1 : 0;
      finish({ win: true, title: tm.toFixed(2) + ' saniye', sub: stars ? stars + ' yıldız' : 'Yıldız için ' + st[0] + ' saniyenin altına in', time: tm, stars, rows: [] });
      break;
    }
    case 'survival':
      finish({ win: false, title: M.wave + '. dalgada düştün', sub: M.score + ' robot devirdin', wave: M.wave, score: M.score, rows });
      break;
    case 'campaign': {
      const win = M.winTeam === 0;
      finish({ win, title: win ? 'Görev tamamlandı' : 'Görev başarısız', sub: win ? 'Sonraki görev açıldı.' : 'Tekrar dene.', rows });
      break;
    }
    case 'gungame': case 'gungamer': {
      const w = M.winner;
      finish({ win: true, title: w ? w.name + ' kazandı' : 'Berabere', winner: w && w.name, color: w && w.color, rows });
      break;
    }
    default: {
      const winners = M.players.filter(p => p.team === M.winTeam && !p.isRobot);
      const title = !winners.length ? 'Berabere' : M.mode === 'team' ? (M.winTeam === 0 ? 'Mavi takım' : 'Kırmızı takım') + ' kazandı' : winners[0].name + ' kazandı';
      finish({ win: true, title, color: winners[0] && (M.mode === 'team' ? (M.winTeam === 0 ? '#4aa3ff' : '#ff5a5a') : winners[0].color), rows });
    }
  }
}

/* ---------- step ---------- */
K.step = (readHuman) => {
  if (!M || M.result) return;
  const dt = DT * M.speed;
  M.time += dt;
  if (M.countdown > 0) {
    M.countdown -= dt;
    const n = Math.ceil(M.countdown / .8);
    if (n !== M.lastCount) { M.lastCount = n; K.sfx(n > 0 ? 'tick' : 'go'); }
  } else if (M.mode === 'challenge' && !M.chal.finished) M.clock += dt;

  updatePlats(dt);
  updateWind(dt);
  for (const p of M.players) {
    if (p.elim) continue;
    if (p.out) { p.respawn -= dt; if (p.respawn <= 0) spawn(p); continue; }
    let c = p.type === 'human' ? readHuman(p.hIdx) : aiControl(p, dt);
    if (M.countdown > 0) c = Object.assign(blankC(), { l: c.l, r: c.r, u: c.u, uP: c.uP });
    if (p.type === 'human' && M.tut) M.tut.lastC = c;
    updatePlayer(p, c, dt);
  }
  updateWorldObjects(dt);
  if (M.mode === 'survival' && M.countdown <= 0) {
    const bots = M.players.filter(p => p.isRobot && !p.elim);
    if (!bots.length) { M.waveT -= dt; if (M.waveT <= 0) { spawnWave(); M.waveT = 2.5; } }
    M.players = M.players.filter(p => !(p.isRobot && p.elim && M.time - p.elimAt > 1));
  }
  if (M.tut) updateTutorial();
  updateCam(dt);
  checkEnd(dt);
};

/* ---------- camera: frames the living players, zooms in when they are close ---------- */
function updateCam(dt) {
  const c = M.cam, v = M.view;
  let tx = W / 2, ty = H / 2, tz = 1;
  const zoomOn = K.settings.cam !== false && M.mode !== 'challenge' && M.countdown <= 0;
  if (zoomOn) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, n = 0;
    for (const p of M.players) {
      if (p.elim || p.out) continue;
      const x = clamp(p.x + p.w / 2, -60, W + 60), y = clamp(p.y + p.h / 2, -40, H + 30);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); n++;
    }
    if (n) {
      x0 -= 170; x1 += 170; y0 -= 150; y1 += 110;
      tz = clamp(Math.min(v.w / (x1 - x0), v.h / (y1 - y0)), 1, 1.75);
      tx = (x0 + x1) / 2; ty = (y0 + y1) / 2;
    }
  }
  const hw = v.w / tz / 2, hh = v.h / tz / 2;
  const XL = -30, XR = W + 30, YT = -90, YB = H + 40;
  tx = XR - XL <= hw * 2 ? W / 2 : clamp(tx, XL + hw, XR - hw);
  ty = YB - YT <= hh * 2 ? (YT + YB) / 2 : clamp(ty, YT + hh, YB - hh);
  const k = 1 - Math.exp(-dt * 3.2);
  c.x += (tx - c.x) * k; c.y += (ty - c.y) * k; c.z += (tz - c.z) * k;
}

/* ================= rendering ================= */
function shade(hex, f) {
  if (hex[0] !== '#') return hex;
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
}
K.shade = shade;
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
function fs(ctx, fill) { ctx.fillStyle = fill; ctx.fill(); ctx.stroke(); }

/* ---------- characters ---------- */
const SKIN = '#f1d9bc';
const PANTS = ['#2c2f45', '#1f2030', '#2f3d62', null, '#2c2f3c', '#30303a'];
const TWO_HAND = new Set(['smg', 'rifle', 'bullpup', 'lmg', 'sniper', 'pump', 'double', 'autosg', 'blunder', 'minigun', 'rocket', 'launcher', 'air', 'nail', 'p90', 'vector', 'demat', 'laser']);
K.drawChar = (ctx, o) => {
  const f = o.face || 1, col = o.color, cos = o.cos || { hat: 0, face: 0, outfit: 0 };
  ctx.save(); ctx.translate(o.x, o.y); ctx.scale(o.scale || 1, o.scale || 1);
  ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
  if (o.spin) { ctx.translate(0, 19); ctx.rotate(o.spin); ctx.translate(0, -19); }
  if (o.hitT > 0 && 'filter' in ctx) ctx.filter = 'brightness(2.2)';
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.4;
  const run = o.run || 0, air = o.air;
  const dark = shade(col, -.3), light = shade(col, .3);
  // jetpack
  if (o.jet) {
    rr(ctx, -f * 15 - 3.5, 14, 7, 15, 2.5); fs(ctx, '#5b5e70');
    rr(ctx, -f * 15 - 2.5, 27, 5, 3, 1); fs(ctx, '#ffc531');
    if (o.jetOn) { ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.moveTo(-f * 15 - 3, 30); ctx.lineTo(-f * 15 + 3, 30); ctx.lineTo(-f * 15, 40 + Math.random() * 7); ctx.fill(); ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.moveTo(-f * 15 - 1.5, 30); ctx.lineTo(-f * 15 + 1.5, 30); ctx.lineTo(-f * 15, 35 + Math.random() * 4); ctx.fill(); }
  }
  if (cos.outfit === 5) { ctx.beginPath(); ctx.arc(-f * 1.5, 11, 10.2, 0, 7); fs(ctx, dark); }
  // legs
  const pants = PANTS[cos.outfit] || dark;
  const leg = (x, y) => {
    rr(ctx, x, y, 6.2, 8.6, 2.4); fs(ctx, pants);
    rr(ctx, x - (f > 0 ? .4 : 1.6), y + 6.4, 8, 3.4, 1.6); fs(ctx, '#17181f');
  };
  leg(-7.6 - run * .9, 28 - (air ? 2.4 : 0));
  leg(1.4 + run * .9, 28 - (air ? .8 : 0));
  // torso
  ctx.lineWidth = 1.4;
  switch (cos.outfit) {
    case 1: // takım
      rr(ctx, -10, 15.5, 20, 15.5, 5); fs(ctx, col);
      ctx.fillStyle = '#f5f1e6'; ctx.beginPath(); ctx.moveTo(-3.2, 15.8); ctx.lineTo(3.2, 15.8); ctx.lineTo(0, 22.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#1b1b22'; ctx.beginPath(); ctx.moveTo(-1, 17); ctx.lineTo(1, 17); ctx.lineTo(1.4, 24); ctx.lineTo(0, 25.5); ctx.lineTo(-1.4, 24); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = dark; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-3.2, 16); ctx.lineTo(-5, 24); ctx.moveTo(3.2, 16); ctx.lineTo(5, 24); ctx.stroke();
      break;
    case 2: // tişört
      rr(ctx, -10, 15.5, 20, 14, 5); fs(ctx, col);
      rr(ctx, -4.5, 19.5, 9, 4, 1.5); ctx.fillStyle = light; ctx.fill();
      rr(ctx, -10, 27.5, 20, 3.5, 1.5); fs(ctx, '#2f3d62');
      break;
    case 3: // tulum
      rr(ctx, -10, 15.5, 20, 15.5, 5); fs(ctx, '#ece5d3');
      rr(ctx, -8, 21, 16, 10, 2.5); fs(ctx, col);
      ctx.fillStyle = col; ctx.fillRect(-7, 15.6, 2.2, 6); ctx.fillRect(4.8, 15.6, 2.2, 6);
      rr(ctx, -3, 23, 6, 3.6, 1); fs(ctx, dark);
      ctx.fillStyle = '#ffc531'; ctx.beginPath(); ctx.arc(-5.9, 21, 1, 0, 7); ctx.arc(5.9, 21, 1, 0, 7); ctx.fill();
      break;
    case 4: // zırh
      rr(ctx, -10, 15.5, 20, 15.5, 4); fs(ctx, dark);
      rr(ctx, -8.6, 16.8, 17.2, 5.6, 2); fs(ctx, col);
      rr(ctx, -8.6, 23.2, 17.2, 5.4, 2); fs(ctx, col);
      rr(ctx, -12.5, 14.5, 7.5, 5.5, 2.5); fs(ctx, light); rr(ctx, 5, 14.5, 7.5, 5.5, 2.5); fs(ctx, light);
      break;
    case 5: // kapüşon
      rr(ctx, -10, 15.5, 20, 15.5, 6); fs(ctx, col);
      rr(ctx, -5.5, 24, 11, 4.5, 2); fs(ctx, dark);
      ctx.strokeStyle = '#f5f1e6'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-2, 16.5); ctx.lineTo(-2, 21.5); ctx.moveTo(2, 16.5); ctx.lineTo(2, 21.5); ctx.stroke();
      break;
    default: // yelek
      rr(ctx, -10, 15.5, 20, 15.5, 5); fs(ctx, '#3b3e57');
      rr(ctx, -10, 16.4, 20, 9.6, 4); fs(ctx, col);
      ctx.fillStyle = 'rgba(245,241,230,.95)'; ctx.fillRect(-9.4, 21, 18.8, 2.2);
      ctx.strokeStyle = dark; ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(0, 16.6); ctx.lineTo(0, 25.6); ctx.stroke();
  }
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4;
  // head
  ctx.beginPath(); ctx.arc(0, 10.2, 8.6, 0, 7); fs(ctx, SKIN);
  ctx.fillStyle = 'rgba(255,120,120,.28)'; ctx.beginPath(); ctx.arc(f * 6.4, 13.4, 1.8, 0, 7); ctx.fill();
  const ex1 = f * 2.4, ex2 = f * 6.1;
  if (cos.face === 3) { // güneş gözlüğü
    rr(ctx, Math.min(ex1, ex2) - 2.6, 8, 8.8, 3.6, 1.4); fs(ctx, '#15161d');
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(Math.min(ex1, ex2) - 1.4, 8.8, 2.2, .9);
  } else if (cos.face === 5) { // maske
    rr(ctx, -8.4, 7.6, 16.8, 5.4, 1.5); fs(ctx, '#1d1e28');
    ctx.fillStyle = '#f5f1e6'; ctx.beginPath(); ctx.ellipse(ex1, 10.2, 1.4, 1, 0, 0, 7); ctx.ellipse(ex2, 10.2, 1.4, 1, 0, 0, 7); ctx.fill();
  } else {
    ctx.lineWidth = .9;
    ctx.beginPath(); ctx.ellipse(ex1, 9.8, 1.9, 2.3, 0, 0, 7); fs(ctx, '#ffffff');
    ctx.beginPath(); ctx.ellipse(ex2, 9.8, 1.9, 2.3, 0, 0, 7); fs(ctx, '#ffffff');
    ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(ex1 + f * .7, 10.1, 1.05, 0, 7); ctx.arc(ex2 + f * .7, 10.1, 1.05, 0, 7); ctx.fill();
    ctx.lineWidth = 1.2;
    if (cos.face === 1) { ctx.beginPath(); ctx.moveTo(ex1 - 2.2 * f, 6.4); ctx.lineTo(ex1 + 1.6 * f, 7.6); ctx.moveTo(ex2 + 2.2 * f, 6.4); ctx.lineTo(ex2 - 1.6 * f, 7.6); ctx.stroke(); }
    if (cos.face === 2) { ctx.lineWidth = .9; ctx.beginPath(); ctx.arc(ex1, 9.8, 2.9, 0, 7); ctx.moveTo(ex2 + 2.9, 9.8); ctx.arc(ex2, 9.8, 2.9, 0, 7); ctx.moveTo(ex1 + 2.9 * f, 9.6); ctx.lineTo(ex2 - 2.9 * f, 9.6); ctx.stroke(); }
    if (cos.face === 4) { ctx.fillStyle = '#4a3020'; ctx.beginPath(); ctx.ellipse(f * 4.2, 14.2, 4.4, 1.5, 0, 0, 7); ctx.fill(); }
    else { ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(f * 3, 14.4); ctx.quadraticCurveTo(f * 4.6, 15.4, f * 6, 14.2); ctx.stroke(); }
  }
  ctx.lineWidth = 1.4; ctx.strokeStyle = OUT;
  // hat
  switch (cos.hat) {
    case 1: // baret
      ctx.beginPath(); ctx.arc(0, 7.6, 9.2, Math.PI, 0); ctx.closePath(); fs(ctx, '#ffc531');
      rr(ctx, -10.6 + f * 1.6, 6.2, 21, 3, 1.4); fs(ctx, '#f0b41e');
      ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(-1.6, -.4, 3.2, 6); break;
    case 2: // fötr
      rr(ctx, -7, -2.4, 14, 9, 2.5); fs(ctx, '#2a2b36');
      rr(ctx, -11.5, 5.6, 23, 2.8, 1.4); fs(ctx, '#2a2b36');
      ctx.fillStyle = col; ctx.fillRect(-6.4, 3.4, 12.8, 2); break;
    case 3: // kovboy
      ctx.beginPath(); ctx.moveTo(-14, 5); ctx.quadraticCurveTo(0, 10.5, 14, 5); ctx.quadraticCurveTo(0, 7, -14, 5); ctx.closePath(); fs(ctx, '#86592f');
      rr(ctx, -7, -3, 14, 9.5, 4); fs(ctx, '#86592f');
      ctx.fillStyle = '#4e3420'; ctx.fillRect(-6.4, 2.6, 12.8, 2); break;
    case 4: // bere
      ctx.beginPath(); ctx.arc(0, 7.4, 9, Math.PI, 0); ctx.closePath(); fs(ctx, col);
      rr(ctx, -9.4, 5.2, 18.8, 3.4, 1.6); fs(ctx, dark);
      ctx.beginPath(); ctx.arc(0, -2.4, 2.8, 0, 7); fs(ctx, '#f5f1e6'); break;
    case 5: // taç
      ctx.beginPath(); ctx.moveTo(-7, 4.4); ctx.lineTo(-7.4, -3); ctx.lineTo(-3.6, 1); ctx.lineTo(0, -4.4); ctx.lineTo(3.6, 1); ctx.lineTo(7.4, -3); ctx.lineTo(7, 4.4); ctx.closePath(); fs(ctx, '#f0be2a');
      ctx.fillStyle = '#ff5a5a'; ctx.beginPath(); ctx.arc(0, 1.6, 1.3, 0, 7); ctx.fill(); break;
    case 6: // kask
      ctx.beginPath(); ctx.arc(0, 8, 9.8, Math.PI, 0); ctx.closePath(); fs(ctx, '#56653c');
      rr(ctx, -10.8, 6.4, 21.6, 2.8, 1.2); fs(ctx, '#3e4a2a');
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(-6, 1, 3, 2); ctx.fillRect(2, 3, 3, 2); break;
    case 7: // kep
      ctx.beginPath(); ctx.arc(0, 7.6, 8.8, Math.PI, 0); ctx.closePath(); fs(ctx, col);
      rr(ctx, f > 0 ? 1 : -13, 5.6, 12, 3, 1.4); fs(ctx, dark);
      ctx.fillStyle = light; ctx.beginPath(); ctx.arc(0, -1, 1.2, 0, 7); ctx.fill(); break;
  }
  // gun and hands
  const wd = o.weapon ? K.WEAP[o.weapon] : null;
  const kick = o.recoil ? -1.6 : 0;
  ctx.save(); ctx.scale(f, 1);
  if (o.charge) { // dynamite raised in the back hand
    ctx.save(); ctx.translate(-7, 12); ctx.rotate(-.5);
    for (let i = 0; i < 3; i++) { rr(ctx, -1.8 + i * 2, -6, 2.2, 9, 1); fs(ctx, '#d0342c'); }
    ctx.restore();
    ctx.beginPath(); ctx.arc(-7, 13, 2.7, 0, 7); fs(ctx, SKIN);
  }
  if (wd) {
    K.drawGun(ctx, wd, 6 + kick, 22, 1);
    if (TWO_HAND.has(wd.look && wd.look.t) && !o.charge) { ctx.beginPath(); ctx.arc(Math.min(6 + wd.len * .6, 22) + kick, 21.2, 2.5, 0, 7); fs(ctx, SKIN); }
    ctx.beginPath(); ctx.arc(7 + kick, 22.6, 2.7, 0, 7); fs(ctx, SKIN);
  } else { ctx.beginPath(); ctx.arc(8, 23, 2.7, 0, 7); fs(ctx, SKIN); }
  ctx.restore();
  ctx.restore();
};
K.drawPortrait = (ctx, cos, color, cx, cy, r) => {
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.clip();
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  g.addColorStop(0, shade(color, .15)); g.addColorStop(1, shade(color, -.35));
  ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  const s = r / 11;
  K.drawChar(ctx, { x: cx, y: cy - 8 * s, scale: s, face: 1, color, cos });
  ctx.restore();
};

/* ---------- background ---------- */
function seeded(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function drawLayer(g, type, col, L, R, minH, maxH, r, win, theme) {
  g.fillStyle = col;
  switch (type) {
    case 'city': {
      let x = L - 10;
      while (x < R) {
        const w = 34 + r() * 60, h = minH + r() * (maxH - minH);
        g.fillStyle = col; g.fillRect(x, H - h, w, h + 400);
        g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(x, H - h, 3, h);
        g.fillStyle = col;
        if (r() < .3) g.fillRect(x + w / 2 - 1, H - h - 18, 2, 18);
        if (win) for (let yy = H - h + 10; yy < H - 8; yy += 14) for (let xx = x + 6; xx < x + w - 8; xx += 10)
          if (r() < .22) { g.fillStyle = `rgba(255,205,120,${.35 + r() * .5})`; g.fillRect(xx, yy, 4, 6); }
        x += w + 2;
      }
      break;
    }
    case 'houses': {
      let x = L - 10;
      while (x < R) {
        const w = 50 + r() * 50, h = minH + r() * (maxH - minH) * .7;
        g.fillStyle = col; g.fillRect(x, H - h, w, h + 400);
        g.beginPath(); g.moveTo(x - 4, H - h); g.lineTo(x + w / 2, H - h - 26 - r() * 16); g.lineTo(x + w + 4, H - h); g.fill();
        if (win) for (let yy = H - h + 14; yy < H - 20; yy += 26) for (let xx = x + 8; xx < x + w - 14; xx += 18)
          if (r() < .5) { g.fillStyle = `rgba(255,190,110,${.4 + r() * .5})`; g.fillRect(xx, yy, 8, 11); }
        x += w + 4;
      }
      break;
    }
    case 'hills': case 'dunes': {
      const a = r() * 6, amp = (maxH - minH) / 2, base = H - (minH + maxH) / 2;
      g.beginPath(); g.moveTo(L, H + 400);
      for (let x = L; x <= R + 20; x += 16) g.lineTo(x, base - Math.sin(x / (type === 'dunes' ? 160 : 110) + a) * amp - Math.sin(x / 47 + a * 2) * amp * .25);
      g.lineTo(R + 20, H + 400); g.fill();
      break;
    }
    case 'peaks': {
      g.beginPath(); g.moveTo(L, H + 400);
      let x = L; const pts = [];
      while (x < R + 100) { const h = minH + r() * (maxH - minH); pts.push([x, H - h]); x += 70 + r() * 90; pts.push([x, H - minH * .6]); x += 40 + r() * 50; }
      pts.forEach(([px, py]) => g.lineTo(px, py)); g.lineTo(R + 100, H + 400); g.fill();
      if (theme === 'kar' || theme === 'teleferik') {
        g.fillStyle = 'rgba(255,255,255,.75)';
        for (let i = 0; i < pts.length; i += 2) { const [px, py] = pts[i]; g.beginPath(); g.moveTo(px - 18, py + 22); g.lineTo(px, py); g.lineTo(px + 14, py + 18); g.fill(); }
      }
      break;
    }
    case 'trees': {
      for (let x = L - 20; x < R + 20; x += 40 + r() * 40) {
        const h = minH + r() * (maxH - minH);
        g.fillStyle = col; g.fillRect(x - 3, H - h, 6, h + 400);
        for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + (r() - .5) * 44, H - h + (r() - .4) * 28, 18 + r() * 14, 0, 7); g.fill(); }
      }
      break;
    }
    case 'pines': {
      for (let x = L - 20; x < R + 20; x += 26 + r() * 30) {
        const h = minH + r() * (maxH - minH);
        g.fillStyle = col; g.beginPath(); g.moveTo(x, H - h); g.lineTo(x + h * .22, H); g.lineTo(x - h * .22, H); g.fill();
        g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.moveTo(x, H - h); g.lineTo(x + 7, H - h + 18); g.lineTo(x - 7, H - h + 18); g.fill();
      }
      break;
    }
    case 'reef': {
      for (let x = L; x < R; x += 30 + r() * 50) {
        g.fillStyle = col; g.beginPath(); g.ellipse(x, H, 30 + r() * 40, minH * (.5 + r() * .7), 0, 0, 7); g.fill();
        g.strokeStyle = col; g.lineWidth = 3;
        const kx = x + (r() - .5) * 40, kh = maxH * (.4 + r() * .6);
        g.beginPath(); g.moveTo(kx, H); for (let y = 0; y < kh; y += 10) g.lineTo(kx + Math.sin(y / 14 + x) * 6, H - y); g.stroke();
      }
      break;
    }
    case 'castle': {
      const top = H - maxH * .7;
      g.fillRect(L, top, R - L, H - top + 400);
      for (let x = L; x < R; x += 24) g.fillRect(x, top - 12, 12, 12);
      for (let x = L + 60; x < R; x += 220 + r() * 80) {
        g.fillRect(x, top - 90, 50, 100);
        for (let k = 0; k < 4; k++) g.fillRect(x + k * 14 - 2, top - 102, 9, 12);
        g.fillStyle = 'rgba(255,200,120,.6)'; g.fillRect(x + 21, top - 70, 8, 14); g.fillStyle = col;
        g.fillRect(x + 24, top - 140, 2, 40);
        g.fillStyle = '#c9553b'; g.beginPath(); g.moveTo(x + 26, top - 140); g.lineTo(x + 46, top - 133); g.lineTo(x + 26, top - 126); g.fill(); g.fillStyle = col;
      }
      break;
    }
    case 'station': {
      for (let x = L + 40; x < R; x += 260) {
        g.fillStyle = col; g.fillRect(x, H - 120, 160, 120 + 400);
        g.fillRect(x + 60, H - 200, 40, 90);
        g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 80, H - 200); g.lineTo(x + 80, H - 250); g.stroke();
        g.fillStyle = 'rgba(126,240,208,.5)';
        for (let k = 0; k < 6; k++) g.fillRect(x + 12 + k * 24, H - 100, 10, 6);
      }
      break;
    }
  }
}
function drawStaticDeco(g, th, L, R) {
  const kind = th.deco;
  if (kind === 'crane') {
    g.strokeStyle = '#2a1f3b'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(930, H); g.lineTo(930, 60); g.moveTo(950, H); g.lineTo(950, 60); g.stroke();
    g.lineWidth = 1.5; g.beginPath();
    for (let y = H; y > 70; y -= 22) { g.moveTo(930, y); g.lineTo(950, y - 22); g.moveTo(950, y); g.lineTo(930, y - 22); }
    g.stroke();
    g.lineWidth = 3; g.beginPath(); g.moveTo(560, 62); g.lineTo(1000, 62); g.moveTo(560, 74); g.lineTo(1000, 74); g.stroke();
    g.lineWidth = 1.2; g.beginPath(); for (let x = 560; x < 1000; x += 16) { g.moveTo(x, 62); g.lineTo(x + 16, 74); } g.stroke();
    g.beginPath(); g.moveTo(940, 30); g.lineTo(560, 62); g.moveTo(940, 30); g.lineTo(1000, 62); g.moveTo(940, 30); g.lineTo(940, 60); g.stroke();
  } else if (kind === 'cables') {
    g.strokeStyle = 'rgba(40,50,70,.6)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(L, 40); g.quadraticCurveTo(480, 120, R, 30); g.moveTo(L, 70); g.quadraticCurveTo(480, 150, R, 60); g.stroke();
  } else if (kind === 'vines') {
    g.strokeStyle = 'rgba(20,60,30,.7)'; g.lineWidth = 3;
    const r = seeded(5);
    for (let x = L; x < R; x += 50 + r() * 60) { const l = 40 + r() * 140; g.beginPath(); g.moveTo(x, -400); for (let y = -400; y < l; y += 10) g.lineTo(x + Math.sin(y / 20 + x) * 5, y); g.stroke(); g.fillStyle = 'rgba(40,110,50,.8)'; g.beginPath(); g.ellipse(x, l, 6, 3, .5, 0, 7); g.fill(); }
  } else if (kind === 'ruins') {
    g.fillStyle = 'rgba(150,100,60,.5)';
    for (const x of [60, 250, 720, 880]) { g.fillRect(x, H - 210, 26, 210); g.fillRect(x - 6, H - 218, 38, 10); }
  } else if (kind === 'road') {
    g.fillStyle = '#1d1a28'; g.fillRect(L, H - 40, R - L, 440);
    g.fillStyle = '#ffc531'; for (let x = L; x < R; x += 60) g.fillRect(x, H - 22, 30, 3);
  } else if (kind === 'hull') {
    g.strokeStyle = 'rgba(126,240,208,.18)'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(L, 20); g.lineTo(R, 20); g.moveTo(L, H - 10); g.lineTo(R, H - 10); g.stroke();
    for (let x = L; x < R; x += 120) { g.beginPath(); g.moveTo(x, 20); g.lineTo(x + 40, -400); g.stroke(); }
  } else if (kind === 'water') {
    g.fillStyle = 'rgba(30,60,110,.7)'; g.fillRect(L, H - 30, R - L, 430);
  }
}
function buildBg(cw, ch, s, ox, oy, dpr) {
  const c = document.createElement('canvas'); c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr);
  const g = c.getContext('2d');
  g.setTransform(s * dpr, 0, 0, s * dpr, ox * dpr, oy * dpr);
  const L = -ox / s - 4, R = (cw - ox) / s + 4, T = -oy / s - 4, B = (ch - oy) / s + 4;
  const th = M.theme;
  const sky = g.createLinearGradient(0, Math.min(T, 0), 0, H);
  th.sky.forEach((col, i) => sky.addColorStop(i / (th.sky.length - 1), col));
  g.fillStyle = sky; g.fillRect(L, T, R - L, B - T);
  const r = seeded(11);
  if (th.stars) for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(255,245,230,${r() * .8})`; const sz = r() < .1 ? 2 : 1.2; g.fillRect(L + r() * (R - L), T + r() * (H * .7 - T), sz, sz); }
  if (th.sun) {
    const [sx, sy, sr, sc] = th.sun;
    const sg = g.createRadialGradient(sx, sy, 4, sx, sy, sr * 4);
    sg.addColorStop(0, 'rgba(255,240,200,.75)'); sg.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = sg; g.fillRect(L, T, R - L, B - T);
    g.fillStyle = sc; g.beginPath(); g.arc(sx, sy, sr, 0, 7); g.fill();
  }
  if (th.planet) {
    const [px, py, pr, pc] = th.planet;
    const pg = g.createRadialGradient(px - pr * .4, py - pr * .4, pr * .1, px, py, pr);
    pg.addColorStop(0, shade(pc, .3)); pg.addColorStop(1, shade(pc, -.5));
    g.fillStyle = pg; g.beginPath(); g.arc(px, py, pr, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3; g.beginPath(); g.ellipse(px, py, pr * 1.6, pr * .3, -.3, 0, 7); g.stroke();
  }
  if (th.far[0] !== 'none') drawLayer(g, th.far[0], th.far[1], L, R, 60, 170, seeded(3), false, M.map.theme);
  const fog = g.createLinearGradient(0, H - 260, 0, H);
  fog.addColorStop(0, 'rgba(255,255,255,0)'); fog.addColorStop(1, 'rgba(255,255,255,.07)');
  g.fillStyle = fog; g.fillRect(L, H - 260, R - L, 260);
  drawStaticDeco(g, th, L, R);
  if (th.near[0] !== 'none') drawLayer(g, th.near[0], th.near[1], L, R, 90, 250, seeded(7), th.near[2], M.map.theme);
  const haze = g.createLinearGradient(0, H - 90, 0, H + 40);
  haze.addColorStop(0, 'rgba(10,8,20,0)'); haze.addColorStop(1, 'rgba(10,8,20,.8)');
  g.fillStyle = haze; g.fillRect(L, H - 90, R - L, B - H + 90);
  const vig = g.createRadialGradient(W / 2, H / 2, H * .4, W / 2, H / 2, Math.max(R - L, B - T) * .75);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.35)');
  g.fillStyle = vig; g.fillRect(L, T, R - L, B - T);
  return c;
}
const BG = { XL: -320, XR: W + 320, YT: -260, YB: H + 80 };
let wbg = { key: '', canvas: null };
function getWorldBg(s0, dpr) {
  const bs = clamp(s0 * dpr * 1.25, .7, 1.6);
  const key = M.map.id + '|' + bs.toFixed(2);
  if (wbg.key !== key) {
    const w = Math.round((BG.XR - BG.XL) * bs), h = Math.round((BG.YB - BG.YT) * bs);
    wbg = { key, canvas: buildBg(w, h, bs, -BG.XL * bs, -BG.YT * bs, 1) };
  }
  return wbg.canvas;
}
K.clearBgCache = () => { wbg.key = ''; };

function drawAmbient(ctx, L, R) {
  const kind = M.theme.deco, t = M.time;
  if (kind === 'snow') {
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 70; i++) { const x = ((i * 137.5 + t * (20 + i % 5 * 6)) % (R - L + 40)) + L - 20 + Math.sin(t + i) * 8; const y = ((i * 61.3 + t * (40 + i % 7 * 8)) % (H + 60)) - 30; ctx.beginPath(); ctx.arc(x, y, 1 + i % 3 * .5, 0, 7); ctx.fill(); }
  } else if (kind === 'bubbles') {
    ctx.strokeStyle = 'rgba(200,255,255,.45)'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 28; i++) { const x = ((i * 97.1) % (R - L)) + L + Math.sin(t * 2 + i) * 6; const y = H - ((i * 73 + t * (30 + i % 4 * 10)) % (H + 40)); ctx.beginPath(); ctx.arc(x, y, 2 + i % 4, 0, 7); ctx.stroke(); }
  } else if (kind === 'water') {
    ctx.strokeStyle = 'rgba(160,200,255,.35)'; ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); for (let x = L; x < R; x += 12) ctx.lineTo(x, H - 24 + k * 8 + Math.sin(x / 30 + t * 2 + k) * 2); ctx.stroke(); }
  } else if (kind === 'lanterns') {
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(L, 40); ctx.quadraticCurveTo(480, 110, R, 40); ctx.stroke();
    for (let i = 0; i < 14; i++) {
      const u = i / 13, x = L + (R - L) * u, y = 40 + 70 * (1 - Math.pow(2 * u - 1, 2)) * .98 + 10;
      const sw = Math.sin(t * 1.5 + i) * 3;
      ctx.fillStyle = ['#ff5a5a', '#ffc531', '#ff8a3d'][i % 3];
      ctx.globalAlpha = .25; ctx.beginPath(); ctx.arc(x + sw, y, 14, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      rr(ctx, x + sw - 5, y - 7, 10, 14, 4); ctx.fill();
    }
  } else if (kind === 'road') {
    for (let i = 0; i < 4; i++) {
      const x = ((t * (120 + i * 40) + i * 300) % (R - L + 200)) + L - 100, y = H - 34 + (i % 2) * 10;
      ctx.fillStyle = '#2b2838'; rr(ctx, x, y - 10, 46, 12, 3); ctx.fill();
      ctx.fillStyle = '#ffe9a0'; ctx.fillRect(x + 44, y - 6, 3, 3); ctx.fillStyle = '#ff5a5a'; ctx.fillRect(x - 1, y - 6, 3, 3);
    }
  } else if (kind === 'vines') {
    for (let i = 0; i < 10; i++) { const x = L + ((i * 131) % (R - L)) + Math.sin(t + i) * 20, y = 200 + Math.sin(t * .7 + i * 2) * 120; ctx.fillStyle = `rgba(230,255,140,${.4 + .4 * Math.sin(t * 3 + i)})`; ctx.fillRect(x, y, 3, 3); }
  }
}

function drawSupports(ctx) {
  const kind = M.map.supports; if (!kind) return;
  ctx.strokeStyle = 'rgba(8,8,14,.6)'; ctx.lineWidth = 1.2;
  for (const pl of M.plats) {
    if (!K.isStatic(pl) || pl.k || pl.w < 90) continue;
    const xs = pl.w > 200 ? [pl.x + 24, pl.x + pl.w - 24] : [pl.x + pl.w / 2];
    const y0 = pl.y + 12, y1 = H + 60;
    for (const x of xs) {
      switch (kind) {
        case 'bamboo':
          ctx.fillStyle = '#8a5a26'; ctx.fillRect(x - 3.5, y0, 7, y1 - y0); ctx.strokeRect(x - 3.5, y0, 7, y1 - y0);
          ctx.fillStyle = 'rgba(255,220,150,.25)'; ctx.fillRect(x - 2.4, y0, 2, y1 - y0);
          ctx.fillStyle = '#5e3a14'; for (let y = y0 + 22; y < y1; y += 26) ctx.fillRect(x - 4.5, y, 9, 3);
          break;
        case 'stone':
          ctx.fillStyle = '#4c4c5a'; ctx.fillRect(x - 11, y0, 22, y1 - y0); ctx.strokeRect(x - 11, y0, 22, y1 - y0);
          ctx.fillStyle = '#5e5e6c'; for (let y = y0 + 4; y < y1; y += 18) { ctx.fillRect(x - 11, y, 22, 1.5); ctx.fillRect(x + ((y / 18) % 2 ? -3 : 4), y, 1.5, 18); }
          break;
        case 'sand':
          ctx.fillStyle = '#b08850'; ctx.fillRect(x - 9, y0, 18, y1 - y0); ctx.strokeRect(x - 9, y0, 18, y1 - y0);
          ctx.fillStyle = '#c99d62'; ctx.fillRect(x - 12, y0, 24, 6); ctx.strokeRect(x - 12, y0, 24, 6);
          ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(x - 4, y0 + 6, 2, y1 - y0); ctx.fillRect(x + 3, y0 + 6, 2, y1 - y0);
          break;
        case 'piles':
          ctx.fillStyle = '#5a3a20'; ctx.fillRect(x - 5, y0, 10, y1 - y0); ctx.strokeRect(x - 5, y0, 10, y1 - y0);
          ctx.fillStyle = '#3a2414'; for (let y = y0 + 30; y < y1; y += 40) ctx.fillRect(x - 5, y, 10, 3);
          break;
        case 'poles':
          ctx.fillStyle = '#3a2430'; ctx.fillRect(x - 3, y0, 6, y1 - y0);
          break;
      }
    }
  }
}
function drawZones(ctx) {
  for (const z of M.zones) {
    const t = M.time;
    const g = ctx.createLinearGradient(0, z.y, 0, H);
    g.addColorStop(0, 'rgba(160,240,255,0)'); g.addColorStop(1, 'rgba(160,240,255,.18)');
    ctx.fillStyle = g; ctx.fillRect(z.x, z.y, z.w, H + 40 - z.y);
    ctx.strokeStyle = 'rgba(220,255,255,.75)'; ctx.lineWidth = 1.4;
    for (let i = 0; i < 26; i++) {
      const x = z.x + 10 + ((i * 53.7) % (z.w - 20)) + Math.sin(t * 3 + i) * 5;
      const span = H + 40 - z.y, y = H + 30 - ((i * 37 + t * (160 + (i % 5) * 40)) % span);
      ctx.beginPath(); ctx.arc(x, y, 2 + (i % 4), 0, 7); ctx.stroke();
    }
    ctx.fillStyle = '#4a5260'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.6;
    rr(ctx, z.x + 24, H - 18, z.w - 48, 40, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1b1d24'; for (let x = z.x + 34; x < z.x + z.w - 30; x += 12) ctx.fillRect(x, H - 12, 6, 20);
  }
}

function drawPlatBase(ctx, pl, st) {
  const [top, body, bot, kind] = st, x = pl.x, y = pl.y, w = pl.w;
  const h = kind === 'stone' ? 16 : 14;
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(x + 4, y + h, w - 8, 6);
  ctx.strokeStyle = 'rgba(25,18,35,.55)'; ctx.lineWidth = 2;
  if (!pl.crumble && (kind === 'girder' || (kind === 'metal' && M.map.theme === 'teleferik'))) {
    ctx.beginPath();
    if (pl.y > 440 && K.isStatic(pl)) {
      ctx.fillStyle = shade(bot, -.2); ctx.fillRect(x + 60, y + 14, 14, H + 200 - y); ctx.fillRect(x + w - 74, y + 14, 14, H + 200 - y);
    } else if (K.isStatic(pl)) { ctx.moveTo(x + 18, y); ctx.lineTo(x + w / 2, y - 60); ctx.lineTo(x + w - 18, y); ctx.moveTo(x + w / 2, y - 60); ctx.lineTo(x + w / 2, -400); }
    ctx.stroke();
  }
  switch (kind) {
    case 'girder':
      ctx.fillStyle = body; ctx.fillRect(x, y, w, 14);
      ctx.fillStyle = top; ctx.fillRect(x, y, w, 4);
      ctx.fillStyle = shade(top, .35); ctx.fillRect(x, y, w, 1.2);
      ctx.fillStyle = bot; ctx.fillRect(x, y + 11, w, 3);
      ctx.fillStyle = shade(body, -.25); for (let i = x + 30; i < x + w - 20; i += 44) { ctx.beginPath(); ctx.moveTo(i, y + 4); ctx.lineTo(i + 10, y + 11); ctx.lineTo(i + 13, y + 11); ctx.lineTo(i + 3, y + 4); ctx.fill(); }
      ctx.fillStyle = shade(top, .35); for (let i = x + 12; i < x + w - 8; i += 22) { ctx.beginPath(); ctx.arc(i, y + 7.5, 1.4, 0, 7); ctx.fill(); }
      for (const ex of [x, x + w - 16]) {
        ctx.save(); ctx.beginPath(); ctx.rect(ex, y + 4, 16, 7); ctx.clip();
        for (let s = -8; s < 24; s += 6) { ctx.fillStyle = (s / 6) % 2 ? '#1b1b1b' : '#ffc531'; ctx.beginPath(); ctx.moveTo(ex + s, y + 11); ctx.lineTo(ex + s + 3, y + 11); ctx.lineTo(ex + s + 10, y + 4); ctx.lineTo(ex + s + 7, y + 4); ctx.fill(); }
        ctx.restore();
      }
      break;
    case 'bamboo':
      ctx.fillStyle = body; rr(ctx, x, y, w, 14, 6); ctx.fill();
      ctx.fillStyle = top; ctx.fillRect(x + 2, y + 1, w - 4, 4);
      ctx.fillStyle = shade(top, .4); ctx.fillRect(x + 4, y + 1.6, w - 8, 1.2);
      ctx.fillStyle = bot; for (let i = x + 20; i < x + w - 6; i += 24) ctx.fillRect(i, y, 2, 14);
      ctx.fillStyle = '#5a3a1a'; ctx.fillRect(x + 8, y - 1, 5, 16); ctx.fillRect(x + w - 13, y - 1, 5, 16);
      break;
    case 'metal':
      ctx.fillStyle = body; ctx.fillRect(x, y, w, 14);
      ctx.fillStyle = top; ctx.fillRect(x, y, w, 3);
      ctx.fillStyle = shade(top, .4); ctx.fillRect(x, y, w, 1);
      ctx.fillStyle = bot; ctx.fillRect(x, y + 12, w, 2);
      ctx.fillStyle = shade(body, -.25); for (let i = x + 40; i < x + w; i += 40) ctx.fillRect(i, y + 3, 1.5, 9);
      ctx.fillStyle = shade(top, -.1); for (let i = x + 6; i < x + w - 4; i += 20) { ctx.beginPath(); ctx.arc(i, y + 7.5, 1.2, 0, 7); ctx.fill(); }
      break;
    case 'stone':
      ctx.fillStyle = body; ctx.fillRect(x, y, w, 16);
      ctx.fillStyle = top; ctx.fillRect(x, y, w, 3);
      ctx.fillStyle = shade(top, .3); ctx.fillRect(x, y, w, 1);
      ctx.strokeStyle = bot; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y + 9.5); ctx.lineTo(x + w, y + 9.5);
      for (let i = x + 18; i < x + w; i += 30) { ctx.moveTo(i, y + 3); ctx.lineTo(i, y + 9.5); ctx.moveTo(i + 15, y + 9.5); ctx.lineTo(i + 15, y + 16); }
      ctx.stroke();
      break;
    case 'ice':
      ctx.fillStyle = body; rr(ctx, x, y, w, 14, 4); ctx.fill();
      ctx.fillStyle = top; ctx.fillRect(x + 2, y, w - 4, 4);
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(x + 10, y + 6, w * .3, 2);
      ctx.fillStyle = shade(body, .2);
      for (let i = x + 10; i < x + w - 10; i += 26) { ctx.beginPath(); ctx.moveTo(i, y + 14); ctx.lineTo(i + 6, y + 14); ctx.lineTo(i + 3, y + 22 + (i % 3) * 3); ctx.fill(); }
      break;
    case 'wood':
      ctx.fillStyle = body; ctx.fillRect(x, y, w, 14);
      ctx.fillStyle = top; ctx.fillRect(x, y, w, 4);
      ctx.fillStyle = shade(top, .3); ctx.fillRect(x, y, w, 1);
      ctx.fillStyle = bot; for (let i = x + 30; i < x + w; i += 30) ctx.fillRect(i, y + 4, 2, 10);
      ctx.fillStyle = '#ffd9a0'; for (let i = x + 6; i < x + w; i += 30) ctx.fillRect(i, y + 7, 2, 2);
      break;
    case 'neon':
      ctx.fillStyle = body; ctx.fillRect(x, y, w, 12);
      ctx.save(); ctx.shadowColor = top; ctx.shadowBlur = 10; ctx.fillStyle = top; ctx.fillRect(x, y, w, 3); ctx.restore();
      ctx.fillStyle = shade(top, -.3); for (let i = x + 10; i < x + w - 6; i += 18) ctx.fillRect(i, y + 6, 8, 2);
      break;
  }
  ctx.strokeStyle = 'rgba(8,8,14,.85)'; ctx.lineWidth = 1.4;
  if (kind === 'bamboo' || kind === 'ice') { rr(ctx, x, y, w, 14, kind === 'ice' ? 4 : 6); ctx.stroke(); }
  else ctx.strokeRect(x, y, w, kind === 'neon' ? 12 : h);
  if (pl.crumble) {
    ctx.strokeStyle = 'rgba(10,8,12,.7)'; ctx.lineWidth = 1.2; ctx.beginPath();
    ctx.moveTo(x + w * .3, y); ctx.lineTo(x + w * .36, y + 7); ctx.lineTo(x + w * .3, y + h);
    ctx.moveTo(x + w * .66, y); ctx.lineTo(x + w * .6, y + 8); ctx.lineTo(x + w * .7, y + h); ctx.stroke();
  }
}

function drawPlat(ctx, pl, st) {
  if (!pl.on && !pl.blink) return;
  const x = pl.x, y = pl.y, w = pl.w, t = M.time;
  ctx.save();
  if (pl.crumble && pl.cr > 0) ctx.translate(rand(-1.6, 1.6), rand(-1, 1));
  if (pl.back > 0) ctx.globalAlpha = 1 - pl.back / .6;
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
  switch (pl.k) {
    case 'belt': {
      ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(x + 4, y + 14, w - 8, 6);
      ctx.fillStyle = '#4a4e5c'; ctx.fillRect(x + 20, y + 14, 10, 40); ctx.fillRect(x + w - 30, y + 14, 10, 40);
      rr(ctx, x, y, w, 14, 7); fs(ctx, '#2b2e38');
      ctx.save(); rr(ctx, x + 4, y + 2, w - 8, 9, 4); ctx.clip();
      ctx.fillStyle = '#3d4150'; ctx.fillRect(x, y, w, 14);
      const dir = Math.sign(pl.conv), off = ((t * pl.conv) % 20 + 20) % 20;
      ctx.strokeStyle = 'rgba(255,197,49,.85)'; ctx.lineWidth = 2;
      for (let i = x - 20 + off; i < x + w + 20; i += 20) { ctx.beginPath(); ctx.moveTo(i - 3 * dir, y + 3); ctx.lineTo(i + 3 * dir, y + 6.5); ctx.lineTo(i - 3 * dir, y + 10); ctx.stroke(); }
      ctx.restore();
      ctx.strokeStyle = OUT; ctx.lineWidth = 1.4;
      for (const rx of [x + 7, x + w - 7]) { ctx.beginPath(); ctx.arc(rx, y + 7, 6, 0, 7); fs(ctx, '#7a7e90'); ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(rx, y + 7, 1.6, 0, 7); ctx.fill(); }
      break;
    }
    case 'hook': {
      const cx = x + w / 2;
      ctx.strokeStyle = '#1d1730'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, 70); ctx.lineTo(cx, y - 30); ctx.stroke();
      rr(ctx, cx - 9, y - 34, 18, 12, 2); ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; fs(ctx, '#ffc531');
      ctx.strokeStyle = 'rgba(25,18,35,.8)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(cx - 4, y - 22); ctx.lineTo(x + 8, y); ctx.moveTo(cx + 4, y - 22); ctx.lineTo(x + w - 8, y); ctx.stroke();
      ctx.restore(); ctx.save();
      drawPlatBase(ctx, pl, st);
      break;
    }
    case 'leaf': {
      const sq = pl.squash > 0 ? pl.squash * 1.4 : 0;
      ctx.translate(x + w / 2, y + 4 + sq * 10); ctx.scale(1 + sq * .4, 1 - sq);
      ctx.strokeStyle = '#2d5a1e'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x < W / 2 ? -w / 2 + 6 : w / 2 - 6, 4); ctx.quadraticCurveTo(0, 50, x < W / 2 ? -w / 2 - 10 : w / 2 + 10, 140); ctx.stroke();
      ctx.strokeStyle = OUT; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-w / 2 - 6, 0); ctx.quadraticCurveTo(0, -12, w / 2 + 6, 0); ctx.quadraticCurveTo(0, 14, -w / 2 - 6, 0); fs(ctx, '#5fbf3a');
      ctx.strokeStyle = '#3d8a24'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0);
      for (let i = -2; i <= 2; i++) { ctx.moveTo(i * w / 6, 0); ctx.lineTo(i * w / 6 + 6, -6); ctx.moveTo(i * w / 6, 0); ctx.lineTo(i * w / 6 + 6, 5); }
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.ellipse(-w / 6, -4, w / 5, 2, -.1, 0, 7); ctx.fill();
      break;
    }
    case 'station': {
      ctx.fillStyle = '#c9ccd6'; ctx.fillRect(x, y + 12, w, H + 60 - y); ctx.strokeRect(x, y + 12, w, H + 60 - y);
      ctx.fillStyle = '#7ec8ff'; for (let wy = y + 30; wy < H; wy += 34) for (let wx = x + 16; wx < x + w - 20; wx += 34) { ctx.fillRect(wx, wy, 18, 18); ctx.strokeRect(wx, wy, 18, 18); }
      rr(ctx, x - 6, y, w + 12, 14, 3); fs(ctx, '#5c6677');
      ctx.fillStyle = '#d8473b'; rr(ctx, x + w / 2 - 34, y + 18, 68, 14, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '700 8px Rubik, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('İSTASYON', x + w / 2, y + 25.5);
      break;
    }
    case 'cabin': {
      const cy = y - 36;
      ctx.strokeStyle = '#2b3546'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-200, cy - 6); ctx.quadraticCurveTo(W / 2, cy + 18, W + 200, cy - 6); ctx.stroke();
      ctx.strokeStyle = OUT; ctx.lineWidth = 1.4;
      ctx.fillStyle = '#5c6677'; ctx.fillRect(x + w / 2 - 2, cy, 4, 36); ctx.strokeRect(x + w / 2 - 2, cy, 4, 36);
      ctx.beginPath(); ctx.arc(x + w / 2 - 7, cy + 2, 4, 0, 7); fs(ctx, '#9aa0ae'); ctx.beginPath(); ctx.arc(x + w / 2 + 7, cy + 2, 4, 0, 7); fs(ctx, '#9aa0ae');
      rr(ctx, x, y, w, 46, 7); fs(ctx, '#d8473b');
      ctx.fillStyle = '#b13328'; ctx.fillRect(x + 1, y + 36, w - 2, 9);
      ctx.fillStyle = '#bfe1f7'; for (let wx = x + 8; wx < x + w - 14; wx += 25) { rr(ctx, wx, y + 10, 18, 18, 3); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = '#f5f1e6'; ctx.fillRect(x + 2, y + 32, w - 4, 2.4);
      rr(ctx, x - 3, y - 2, w + 6, 6, 3); fs(ctx, '#e8ebf0');
      break;
    }
    case 'pylon': {
      ctx.strokeStyle = '#5c6677'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x + 20, y + 12); ctx.lineTo(x - 10, H + 60); ctx.moveTo(x + w - 20, y + 12); ctx.lineTo(x + w + 10, H + 60); ctx.stroke();
      ctx.lineWidth = 1.6; ctx.beginPath();
      for (let yy = y + 30, i = 0; yy < H + 40; yy += 40, i++) { const k = (yy - y) / (H + 60 - y); const l = x + 20 - 30 * k, r = x + w - 20 + 30 * k; ctx.moveTo(l, yy); ctx.lineTo(r, yy + 40); ctx.moveTo(r, yy); ctx.lineTo(l, yy + 40); }
      ctx.stroke();
      ctx.restore(); ctx.save(); drawPlatBase(ctx, pl, st);
      break;
    }
    case 'module': {
      rr(ctx, x - 40, y + 18, 34, 10, 2); fs(ctx, '#2a4a7a'); rr(ctx, x + w + 6, y + 18, 34, 10, 2); fs(ctx, '#2a4a7a');
      ctx.strokeStyle = 'rgba(126,240,208,.4)'; ctx.lineWidth = 1; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x - 40 + i * 9, y + 18); ctx.lineTo(x - 40 + i * 9, y + 28); ctx.moveTo(x + w + 6 + i * 9, y + 18); ctx.lineTo(x + w + 6 + i * 9, y + 28); ctx.stroke(); }
      ctx.strokeStyle = OUT; ctx.lineWidth = 1.5;
      rr(ctx, x, y, w, 62, 16); fs(ctx, '#c9d2e0');
      ctx.fillStyle = '#9aa6ba'; ctx.fillRect(x + 6, y + 44, w - 12, 4);
      ctx.fillStyle = '#7ef0d0'; for (let wx = x + 22; wx < x + w - 20; wx += 30) { ctx.beginPath(); ctx.arc(wx, y + 26, 7, 0, 7); ctx.fill(); ctx.stroke(); }
      rr(ctx, x, y, w, 6, 3); fs(ctx, '#9ad7ff');
      break;
    }
    case 'boat': {
      const by = y + 2;
      ctx.fillStyle = 'rgba(160,200,255,.35)'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + 16, w * .7, 4, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 14, by - 10); ctx.quadraticCurveTo(x - 6, by + 16, x + w / 2, by + 16); ctx.quadraticCurveTo(x + w + 6, by + 16, x + w + 14, by - 10);
      ctx.lineTo(x + w, by); ctx.lineTo(x, by); ctx.closePath(); fs(ctx, '#1b1b24');
      ctx.strokeStyle = '#d6a920'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 4, by + 4); ctx.quadraticCurveTo(x + w / 2, by + 12, x + w + 4, by + 4); ctx.stroke();
      ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; rr(ctx, x, by - 3, w, 5, 2); fs(ctx, '#8a5a2a');
      ctx.fillStyle = '#d6a920'; ctx.beginPath(); ctx.arc(x - 14, by - 11, 2.4, 0, 7); ctx.arc(x + w + 14, by - 11, 2.4, 0, 7); ctx.fill();
      break;
    }
    case 'bridge': {
      ctx.beginPath();
      ctx.moveTo(x, y + 14); ctx.lineTo(x + w, y + 14); ctx.lineTo(x + w, H + 60); ctx.lineTo(x + w - 46, H + 60);
      ctx.quadraticCurveTo(x + w / 2, y + 40, x + 46, H + 60); ctx.lineTo(x, H + 60); ctx.closePath();
      fs(ctx, '#8d7458');
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let yy = y + 30; yy < H + 50; yy += 16) { ctx.moveTo(x, yy); ctx.lineTo(x + 40, yy); ctx.moveTo(x + w - 40, yy); ctx.lineTo(x + w, yy); }
      ctx.stroke();
      ctx.restore(); ctx.save(); drawPlatBase(ctx, pl, st);
      ctx.fillStyle = '#6e5a44'; for (let px = x + 8; px < x + w - 4; px += 24) ctx.fillRect(px, y - 8, 4, 8);
      ctx.fillRect(x, y - 9, w, 2.5);
      break;
    }
    case 'drawbridge': {
      const L = 180, R = 780;
      if (pl.on) {
        ctx.strokeStyle = '#2a2a30'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 6, y); ctx.lineTo(L, 252); ctx.moveTo(x + w - 6, y); ctx.lineTo(R, 252); ctx.stroke();
        if (pl.warn) ctx.translate(rand(-1, 1), 0);
        rr(ctx, x, y, w, 12, 2); ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; fs(ctx, '#8a5a2a');
        ctx.fillStyle = '#6b4220'; for (let px = x + 20; px < x + w; px += 20) ctx.fillRect(px, y + 1, 2, 10);
        ctx.fillStyle = '#9aa0ae'; ctx.fillRect(x, y + 4, w, 2);
      } else {
        for (const [ox, sgn] of [[x, -1], [x + w, 1]]) {
          ctx.save(); ctx.translate(ox, y + 6); ctx.rotate(sgn * 1.2);
          rr(ctx, sgn > 0 ? -w / 2 : 0, -6, w / 2, 12, 2); ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; fs(ctx, '#7a4e24');
          ctx.restore();
        }
        ctx.strokeStyle = '#2a2a30'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 40, y - 100); ctx.lineTo(L, 252); ctx.moveTo(x + w - 40, y - 100); ctx.lineTo(R, 252); ctx.stroke();
      }
      break;
    }
    case 'lift': {
      const top = pl.by + (pl.move ? Math.min(0, pl.move[1]) : 0) - 30;
      ctx.strokeStyle = '#5b6170'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x - 4, top); ctx.lineTo(x - 4, H + 60); ctx.moveTo(x + w + 4, top); ctx.lineTo(x + w + 4, H + 60); ctx.stroke();
      ctx.strokeStyle = '#1b1d24'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x + 10, y); ctx.lineTo(x + 10, -400); ctx.moveTo(x + w - 10, y); ctx.lineTo(x + w - 10, -400); ctx.stroke();
      ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; rr(ctx, x, y, w, 14, 2); fs(ctx, '#4a5260');
      ctx.save(); ctx.beginPath(); ctx.rect(x + 2, y + 3, w - 4, 6); ctx.clip();
      for (let s = x - 10; s < x + w + 10; s += 10) { ctx.fillStyle = '#ffc531'; ctx.beginPath(); ctx.moveTo(s, y + 9); ctx.lineTo(s + 5, y + 9); ctx.lineTo(s + 11, y + 3); ctx.lineTo(s + 6, y + 3); ctx.fill(); }
      ctx.restore();
      break;
    }
    case 'overpass': {
      ctx.fillStyle = '#6e7383'; ctx.fillRect(x + w / 2 - 14, y + 18, 28, H + 60 - y); ctx.strokeRect(x + w / 2 - 14, y + 18, 28, H + 60 - y);
      rr(ctx, x, y, w, 18, 2); fs(ctx, '#8a8f9e');
      ctx.fillStyle = '#ffc531'; for (let px = x + 10; px < x + w; px += 30) ctx.fillRect(px, y + 8, 14, 2);
      ctx.fillStyle = '#4a4e5c'; for (let px = x + 6; px < x + w; px += 18) ctx.fillRect(px, y - 10, 3, 10);
      ctx.fillRect(x, y - 11, w, 3);
      break;
    }
    case 'gantry': {
      ctx.fillStyle = '#7a7f8e'; ctx.fillRect(x - 8, y + 4, 8, H + 60 - y); ctx.fillRect(x + w, y + 4, 8, H + 60 - y);
      rr(ctx, x + 18, y + 16, w - 36, 42, 4); fs(ctx, '#1f7a4a');
      ctx.strokeStyle = '#f5f1e6'; ctx.lineWidth = 1.4; rr(ctx, x + 22, y + 20, w - 44, 34, 3); ctx.stroke();
      ctx.fillStyle = '#f5f1e6'; ctx.font = '700 12px Rubik, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('ÇIKIŞ 3  →', x + w / 2, y + 37);
      ctx.restore(); ctx.save(); drawPlatBase(ctx, pl, st);
      break;
    }
    case 'truck': case 'van': {
      const f = Math.sign(pl.drive) || 1, truck = pl.k === 'truck', bh = truck ? 30 : 26;
      ctx.fillStyle = '#15161d';
      const wheels = truck ? [x + 24, x + w - 24, f > 0 ? x + w + 28 : x - 28] : [x + 22, x + w - 22];
      ctx.strokeStyle = OUT; ctx.lineWidth = 1.4;
      for (const wx of wheels) { ctx.beginPath(); ctx.arc(wx, y + bh + 2, 7, 0, 7); fs(ctx, '#1b1b22'); ctx.fillStyle = '#9aa0ae'; ctx.beginPath(); ctx.arc(wx, y + bh + 2, 2.4, 0, 7); ctx.fill(); }
      if (truck) {
        const cx0 = f > 0 ? x + w + 4 : x - 48;
        rr(ctx, cx0, y + 4, 44, bh - 2, 6); fs(ctx, '#2f6fbf');
        ctx.fillStyle = '#bfe1f7'; rr(ctx, f > 0 ? cx0 + 24 : cx0 + 4, y + 8, 16, 11, 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffe9a0'; ctx.fillRect(f > 0 ? cx0 + 40 : cx0, y + bh - 8, 4, 4);
        rr(ctx, x, y, w, bh, 3); fs(ctx, '#e3e6eb');
        ctx.fillStyle = '#c9553b'; ctx.fillRect(x + 2, y + 12, w - 4, 6);
        ctx.fillStyle = '#2a2b36'; ctx.font = '400 10px Bungee, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('KENAR NAKLİYAT', x + w / 2, y + 24);
      } else {
        rr(ctx, x, y, w, bh, 8); fs(ctx, '#ffc531');
        ctx.fillStyle = '#bfe1f7'; for (let wx = x + 12; wx < x + w - 20; wx += 26) { rr(ctx, wx, y + 5, 20, 10, 2); ctx.fill(); ctx.stroke(); }
        ctx.fillStyle = '#2a2b36'; ctx.fillRect(x + 2, y + 18, w - 4, 3);
        ctx.fillStyle = '#ff5a5a'; ctx.fillRect(f > 0 ? x : x + w - 4, y + 14, 4, 4);
      }
      break;
    }
    case 'chair': {
      const [mx, my] = pl.move, ax = pl.bx + w / 2, ay = pl.by - 70;
      ctx.strokeStyle = '#2b3546'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ax - mx * .4, ay - my * .4); ctx.lineTo(ax + mx * 1.4, ay + my * 1.4); ctx.stroke();
      ctx.strokeStyle = OUT; ctx.lineWidth = 1.4;
      ctx.fillStyle = '#5c6677'; ctx.fillRect(x + w / 2 - 1.5, y - 70, 3, 64);
      ctx.beginPath(); ctx.arc(x + w / 2, y - 70, 4, 0, 7); fs(ctx, '#9aa0ae');
      rr(ctx, x + 4, y - 26, 6, 26, 2); fs(ctx, '#2f6fbf');
      rr(ctx, x, y, w, 8, 3); fs(ctx, '#2f6fbf');
      ctx.fillStyle = '#5c6677'; ctx.fillRect(x + w / 2 - 14, y - 8, 28, 2);
      break;
    }
    case 'awning': {
      const sq = pl.squash > 0 ? pl.squash * 1.2 : 0;
      ctx.fillStyle = '#3a2430'; ctx.fillRect(x + 6, y + 10, 4, H + 60 - y); ctx.fillRect(x + w - 10, y + 10, 4, H + 60 - y);
      ctx.translate(0, sq * 10);
      ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + w + 6, y); ctx.lineTo(x + w, y + 16);
      for (let i = 6; i >= 0; i--) ctx.quadraticCurveTo(x + w * (i + .5) / 7, y + 22 - sq * 8, x + w * i / 7, y + 16);
      ctx.closePath();
      ctx.save(); ctx.clip();
      const cols = (pl.x + pl.w / 2) < W / 2 ? ['#ff5a5a', '#f5f1e6'] : (pl.x > W * .6 ? ['#ffc531', '#7a3044'] : ['#5fd36a', '#f5f1e6']);
      for (let i = 0; i < 9; i++) { ctx.fillStyle = cols[i % 2]; ctx.fillRect(x - 6 + i * (w + 12) / 9, y - 2, (w + 12) / 9 + 1, 30); }
      ctx.restore();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x - 4, y + 1, w + 8, 2);
      break;
    }
    case 'energy': {
      for (const ex of [x - 12, x + w]) { rr(ctx, ex, y - 4, 12, 20, 3); fs(ctx, '#2a5a5a'); ctx.fillStyle = pl.on ? '#7ef0d0' : '#2f4a4a'; ctx.fillRect(ex + 3, y + 1, 6, 10); }
      if (pl.on) {
        const a = pl.warn ? (Math.floor(t * 14) % 2 ? .35 : .9) : .9;
        ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(126,240,208,.28)'; ctx.fillRect(x, y, w, 12);
        ctx.save(); ctx.shadowColor = '#7ef0d0'; ctx.shadowBlur = 12; ctx.fillStyle = '#c8fff0'; ctx.fillRect(x, y, w, 3); ctx.restore();
        ctx.strokeStyle = 'rgba(126,240,208,.6)'; ctx.lineWidth = 1; ctx.beginPath();
        for (let i = x + 8; i < x + w; i += 16) { ctx.moveTo(i, y + 4); ctx.lineTo(i + 8, y + 11); }
        ctx.stroke();
      } else {
        ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(126,240,208,.35)'; ctx.lineWidth = 1.4; ctx.strokeRect(x, y, w, 12); ctx.setLineDash([]);
      }
      break;
    }
    default:
      drawPlatBase(ctx, pl, st);
  }
  ctx.restore();
}

/* ---------- world objects ---------- */
function drawTarget(ctx, tg) {
  const y = tg.y + Math.sin(M.time * 2 + tg.ph) * 3;
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4;
  ctx.fillStyle = '#5b5e70'; ctx.fillRect(tg.x - 1, y - tg.r - 6, 2, 6);
  const sp = M.time * 40 + tg.ph;
  ctx.fillStyle = 'rgba(220,225,235,.75)'; ctx.beginPath(); ctx.ellipse(tg.x, y - tg.r - 6, 13 * Math.abs(Math.cos(sp)), 1.8, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(tg.x, y, tg.r, 0, 7); fs(ctx, '#f5f1e6');
  ctx.fillStyle = '#e04a3c'; ctx.beginPath(); ctx.arc(tg.x, y, tg.r * .72, 0, 7); ctx.fill();
  ctx.fillStyle = '#f5f1e6'; ctx.beginPath(); ctx.arc(tg.x, y, tg.r * .45, 0, 7); ctx.fill();
  ctx.fillStyle = '#e04a3c'; ctx.beginPath(); ctx.arc(tg.x, y, tg.r * .2, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(tg.x - tg.r * .4, y - tg.r * .45, tg.r * .25, tg.r * .14, -.6, 0, 7); ctx.fill();
}
function drawCrate(ctx, k) {
  if (k.t < 3 && Math.floor(k.t * 8) % 2) return;
  ctx.save(); ctx.translate(k.x, k.y);
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.lineJoin = 'round';
  if (!k.ground) {
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = .8;
    ctx.beginPath(); ctx.moveTo(3, 0); ctx.lineTo(k.w / 2 - 15, -22); ctx.moveTo(k.w - 3, 0); ctx.lineTo(k.w / 2 + 15, -22); ctx.moveTo(k.w / 2, 0); ctx.lineTo(k.w / 2, -22); ctx.stroke();
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(k.w / 2 - 18, -22); ctx.quadraticCurveTo(k.w / 2, -46, k.w / 2 + 18, -22); ctx.closePath();
    ctx.save(); ctx.clip();
    for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#f5f1e6' : '#e04a3c'; ctx.fillRect(k.w / 2 - 18 + i * 6, -46, 6, 26); }
    ctx.restore(); ctx.stroke();
  }
  rr(ctx, 0, 0, k.w, k.h, 2); fs(ctx, '#b9773a');
  ctx.fillStyle = '#8a5526'; ctx.fillRect(2, k.h / 3, k.w - 4, 1.4); ctx.fillRect(2, k.h * 2 / 3, k.w - 4, 1.4);
  ctx.strokeStyle = '#6b3f18'; ctx.lineWidth = 2.4; ctx.strokeRect(3, 3, k.w - 6, k.h - 6);
  ctx.fillStyle = '#9aa0ae'; ctx.strokeStyle = OUT; ctx.lineWidth = .8;
  for (const [cx, cy] of [[0, 0], [k.w - 5, 0], [0, k.h - 5], [k.w - 5, k.h - 5]]) { ctx.fillRect(cx, cy, 5, 5); ctx.strokeRect(cx, cy, 5, 5); }
  ctx.fillStyle = '#ffc531'; rr(ctx, k.w / 2 - 8, k.h / 2 - 4.5, 16, 9, 2); ctx.fill();
  ctx.fillStyle = '#3a2410';
  ctx.fillRect(k.w / 2 - 5.5, k.h / 2 - 2.2, 10, 2.4); ctx.fillRect(k.w / 2 - 4.5, k.h / 2, 2, 3);
  ctx.restore();
}
function drawDyn(ctx, d) {
  ctx.save(); ctx.translate(d.x, d.y - 5);
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.1; ctx.lineJoin = 'round';
  const warn = d.fuse < .6;
  if (warn) {
    ctx.save(); ctx.globalAlpha = .18 + .14 * Math.sin(M.time * 30); ctx.fillStyle = '#ff5a5a';
    ctx.beginPath(); ctx.arc(0, 0, d.duck ? 115 : DYN.r, 0, 7); ctx.fill();
    ctx.globalAlpha = .6; ctx.setLineDash([6, 5]); ctx.strokeStyle = '#ff5a5a'; ctx.lineWidth = 1.6; ctx.stroke(); ctx.restore();
  }
  ctx.rotate(d.duck ? 0 : d.rot);
  if (d.duck) {
    const f = Math.sign(d.vx || 1);
    ctx.beginPath(); ctx.ellipse(0, 0, 8, 6, 0, 0, 7); fs(ctx, '#ffd23f');
    ctx.beginPath(); ctx.arc(f * 5, -6, 4.2, 0, 7); fs(ctx, '#ffd23f');
    ctx.beginPath(); ctx.ellipse(f * 9, -5.6, 2.4, 1.2, 0, 0, 7); fs(ctx, '#ff8a3d');
    ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(f * 6, -7, .9, 0, 7); ctx.fill();
  } else {
    for (let i = 0; i < 3; i++) { rr(ctx, -8, -4.2 + i * 2.8, 16, 2.9, 1.3); fs(ctx, warn && Math.floor(M.time * 14) % 2 ? '#ffffff' : '#d0342c'); }
    ctx.fillStyle = '#1b1b22'; ctx.fillRect(-1.6, -4.6, 3.2, 9.2);
    const fl = 4 + 8 * clamp(d.fuse / DYN.fuse, 0, 1);
    ctx.strokeStyle = '#d9cfa8'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(8, -3); ctx.quadraticCurveTo(8 + fl * .6, -3 - fl * .4, 8 + fl * .4, -3 - fl); ctx.stroke();
    ctx.fillStyle = Math.random() < .5 ? '#fff3c0' : '#ff8a3d'; ctx.beginPath(); ctx.arc(8 + fl * .4, -3 - fl, 1.8 + Math.random() * 1.4, 0, 7); ctx.fill();
  }
  ctx.restore();
}
function pickupIcon(ctx, icon, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 1.2; ctx.lineJoin = 'round';
  ctx.beginPath();
  switch (icon) {
    case 'heart': ctx.moveTo(0, 6); ctx.bezierCurveTo(-9, -1, -5, -8, 0, -3.4); ctx.bezierCurveTo(5, -8, 9, -1, 0, 6); break;
    case 'shield': ctx.moveTo(0, -7); ctx.lineTo(6, -4.6); ctx.lineTo(5.4, 1.6); ctx.quadraticCurveTo(3, 5.6, 0, 7); ctx.quadraticCurveTo(-3, 5.6, -5.4, 1.6); ctx.lineTo(-6, -4.6); break;
    case 'bolt': ctx.moveTo(2, -7.5); ctx.lineTo(-5, 1); ctx.lineTo(-.4, 1); ctx.lineTo(-2, 7.5); ctx.lineTo(5, -1); ctx.lineTo(.4, -1); break;
    case 'up': ctx.moveTo(0, -7.5); ctx.lineTo(6, -1.5); ctx.lineTo(2.4, -1.5); ctx.lineTo(2.4, 7); ctx.lineTo(-2.4, 7); ctx.lineTo(-2.4, -1.5); ctx.lineTo(-6, -1.5); break;
    case 'star': for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3 : 7.4; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } break;
    case 'eye': ctx.moveTo(-7, 0); ctx.quadraticCurveTo(0, -7, 7, 0); ctx.quadraticCurveTo(0, 7, -7, 0); break;
    case 'dyn': ctx.rect(-6, -3.4, 12, 6.8); break;
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  if (icon === 'eye') { ctx.fillStyle = '#5b5e70'; ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, 7); ctx.fill(); }
  if (icon === 'dyn') { ctx.fillStyle = '#d0342c'; ctx.fillRect(-5, -2.4, 10, 4.8); ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(6, -2); ctx.lineTo(8, -6); ctx.stroke(); }
  ctx.restore();
}
function drawPickup(ctx, k) {
  if (k.t < 3 && Math.floor(k.t * 8) % 2) return;
  const y = k.y + Math.sin(k.ph * 3) * 4, col = k.def.color;
  ctx.fillStyle = col; ctx.globalAlpha = .22 + .1 * Math.sin(k.ph * 5); ctx.beginPath(); ctx.arc(k.x, y, 19, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  const gr = ctx.createRadialGradient(k.x - 4, y - 5, 2, k.x, y, 13);
  gr.addColorStop(0, shade(col, .55)); gr.addColorStop(1, shade(col, -.35));
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(k.x, y, 13, 0, 7); fs(ctx, gr);
  pickupIcon(ctx, k.def.icon, k.x, y + .5, .95);
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(k.x - 5, y - 7, 4.4, 2.2, -.5, 0, 7); ctx.fill();
}

function hpColor(f) { return f > .55 ? '#5fd36a' : f > .28 ? '#ffc531' : '#ff5a5a'; }
function hpBar(ctx, x, y, w, h, hp, ghost, segs) {
  const f = clamp(hp / MAX_HP, 0, 1), gf = clamp(ghost / MAX_HP, 0, 1);
  ctx.fillStyle = 'rgba(8,8,14,.85)'; rr(ctx, x - 1, y - 1, w + 2, h + 2, (h + 2) / 2); ctx.fill();
  ctx.save(); rr(ctx, x, y, w, h, h / 2); ctx.clip();
  ctx.fillStyle = '#3a1c22'; ctx.fillRect(x, y, w, h);
  if (gf > f) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, w * gf, h); }
  ctx.fillStyle = hpColor(f); ctx.fillRect(x, y, w * f, h);
  ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(x, y, w * f, h * .4);
  if (segs) { ctx.fillStyle = 'rgba(8,8,14,.5)'; for (let i = 1; i < segs; i++) ctx.fillRect(x + w * i / segs - .5, y, 1, h); }
  ctx.restore();
}

function drawPlayer(ctx, p) {
  let alpha = 1;
  if (p.invis || p.buffs.gizli > 0) alpha = p.reveal > 0 || p.hitT > 0 ? .75 : (p.type === 'human' ? .3 : .06);
  K.drawChar(ctx, {
    x: Math.round(p.x + p.w / 2), y: Math.round(p.y), scale: p.scale, face: p.face, color: p.color, cos: p.cos, weapon: p.ko ? null : p.weapon,
    run: p.ground && Math.abs(p.vx) > 30 ? Math.sin(p.anim * 16) * 4 : 0, air: !p.ground, alpha, hitT: p.hitT,
    jet: M.jet, jetOn: p.jetOn, charge: p.charge >= 0 ? 1 : 0, recoil: p.recoilT > 0, spin: p.ko ? p.koT * 14 * Math.sign(p.vx || 1) : 0,
  });
  if (p.ko) return;
  const cx = p.x + p.w / 2;
  if (p.shield > 0) {
    ctx.strokeStyle = p.color; ctx.globalAlpha = (.5 + .25 * Math.sin(M.time * 18)) * Math.max(alpha, .4);
    ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, p.y + p.h / 2, 27 * p.scale, 0, 7); ctx.stroke();
    ctx.globalAlpha = .12; ctx.fillStyle = p.color; ctx.fill(); ctx.globalAlpha = 1;
  }
  if (alpha <= .2) return;
  const top = p.y - 6;
  ctx.font = '700 10px Rubik, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(12,12,20,.9)'; ctx.lineJoin = 'round';
  if (M.hpOn) {
    hpBar(ctx, cx - 15, top - 4, 30, 4, p.hp, p.hpG, 0);
    ctx.strokeText(p.name, cx, top - 8); ctx.fillStyle = p.color; ctx.fillText(p.name, cx, top - 8);
  } else { ctx.strokeText(p.name, cx, top); ctx.fillStyle = p.color; ctx.fillText(p.name, cx, top); }
  let by = top - (M.hpOn ? 22 : 14);
  const wd = p.weapon;
  if (p.reload > 0 && wd) {
    ctx.fillStyle = 'rgba(12,12,20,.8)'; rr(ctx, cx - 14, by, 28, 4, 2); ctx.fill();
    ctx.fillStyle = '#ffc531'; rr(ctx, cx - 14, by, 28 * (1 - p.reload / K.WEAP[wd].reload), 4, 2); ctx.fill();
    by -= 6;
  }
  if (p.charge >= 0) {
    const pw = chargePower(p.charge);
    ctx.fillStyle = 'rgba(12,12,20,.8)'; rr(ctx, cx - 14, by, 28, 4, 2); ctx.fill();
    ctx.fillStyle = pw > .95 ? '#ff5a5a' : '#ff8a3d'; rr(ctx, cx - 14, by, 28 * pw, 4, 2); ctx.fill();
  }
  if (M.jet && p.jet < 1) {
    ctx.fillStyle = 'rgba(12,12,20,.8)'; ctx.fillRect(cx - 14, p.y + p.h + 3, 28, 3);
    ctx.fillStyle = '#ff8a3d'; ctx.fillRect(cx - 14, p.y + p.h + 3, 28 * p.jet, 3);
  }
}
function drawAim(ctx, p) {
  const a = p.aim; if (!a) return;
  const pts = a.pts;
  for (let i = 0; i < pts.length; i += 2) {
    const k = i / pts.length;
    ctx.globalAlpha = .9 - k * .5;
    ctx.fillStyle = i % 4 ? '#ffffff' : '#ffc531'; ctx.strokeStyle = 'rgba(10,10,16,.85)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(pts[i], pts[i + 1], 3.2 - k * 1.4, 0, 7); ctx.fill(); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (a.land) {
    ctx.save(); ctx.translate(a.land.x, a.land.y - 4);
    ctx.globalAlpha = .16; ctx.fillStyle = '#ff5a5a'; ctx.beginPath(); ctx.ellipse(0, 0, DYN.r, DYN.r * .32, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = .85; ctx.setLineDash([5, 4]); ctx.strokeStyle = '#ff5a5a'; ctx.lineWidth = 1.6; ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-5, -5); ctx.lineTo(5, 5); ctx.moveTo(5, -5); ctx.lineTo(-5, 5); ctx.stroke();
    ctx.restore();
  }
}

/* ---------- HUD ---------- */
function heart(ctx, x, y, s, col) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(0, 5); ctx.bezierCurveTo(-7, -.5, -4, -6.5, 0, -2.8); ctx.bezierCurveTo(4, -6.5, 7, -.5, 0, 5); ctx.closePath();
  ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore();
}
function hudChips(ctx, cw) {
  const list = M.players.filter(p => !p.isRobot);
  if (!list.length || M.mode === 'demo') return 0;
  const n = list.length;
  const chipW = Math.min(176, (cw - 16 - (n - 1) * 8) / n), chipH = 46;
  const total = n * chipW + (n - 1) * 8;
  let x = Math.max(8, (cw - total) / 2);
  const y = 6;
  for (const p of list) {
    ctx.globalAlpha = p.elim ? .4 : 1;
    ctx.fillStyle = 'rgba(14,15,24,.88)'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
    rr(ctx, x, y, chipW, chipH, 9); ctx.fill(); ctx.stroke();
    ctx.fillStyle = p.color; rr(ctx, x + 2, y + 2, chipW - 4, 3, 2); ctx.fill();
    const pr = 16;
    K.drawPortrait(ctx, p.cos, p.color, x + 6 + pr, y + chipH / 2 + 1, pr);
    ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + 6 + pr, y + chipH / 2 + 1, pr, 0, 7); ctx.stroke();
    const tx = x + 12 + pr * 2, tw = chipW - (12 + pr * 2) - 7;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = '700 11px Rubik, system-ui, sans-serif'; ctx.fillStyle = '#f5f1e6';
    const gg = M.mode === 'gungame' || M.mode === 'gungamer';
    const livesTxt = gg ? 'Sv ' + (p.gg + 1) : p.lives === Infinity ? '∞' : '×' + (p.elim ? 0 : p.lives);
    ctx.font = '400 12px Bungee, Impact, sans-serif'; const lw = ctx.measureText(livesTxt).width;
    ctx.fillStyle = '#ffc531'; ctx.textAlign = 'right'; ctx.fillText(livesTxt, x + chipW - 7, y + 14);
    if (!gg) heart(ctx, x + chipW - 12 - lw, y + 14, .9, '#ff5a5a');
    ctx.textAlign = 'left'; ctx.font = '700 11px Rubik, system-ui, sans-serif'; ctx.fillStyle = '#f5f1e6';
    ctx.fillText(fit(ctx, p.name, tw - lw - 18), tx, y + 14);
    if (M.hpOn) hpBar(ctx, tx, y + 21, tw, 6, p.out || p.elim ? 0 : p.hp, p.out || p.elim ? 0 : p.hpG, 5);
    const wd = p.weapon ? K.WEAP[p.weapon] : null;
    const rowY = y + (M.hpOn ? 36 : 30);
    if (wd) {
      ctx.save(); ctx.beginPath(); ctx.rect(tx, rowY - 7, 30, 14); ctx.clip();
      K.drawGun(ctx, wd, tx + 10, rowY + 1, .62); ctx.restore();
    }
    ctx.font = '700 10px Rubik, system-ui, sans-serif'; ctx.fillStyle = '#a9adc2';
    const ammo = !wd ? 'Silahsız' : p.reload > 0 ? 'dolum' : (p.perk === 'infpistol' && wd.cat === 'tabanca' ? '∞' : p.ammo);
    ctx.fillText(ammo, tx + 32, rowY);
    const dx = x + chipW - 8;
    ctx.textAlign = 'right'; ctx.fillStyle = '#f5f1e6'; ctx.fillText(p.gren === Infinity ? '∞' : p.gren, dx, rowY);
    const dw = ctx.measureText(p.gren === Infinity ? '∞' : String(p.gren)).width;
    ctx.fillStyle = '#d0342c'; ctx.strokeStyle = OUT; ctx.lineWidth = 1; rr(ctx, dx - dw - 13, rowY - 3, 10, 6, 1.5); ctx.fill(); ctx.stroke();
    x += chipW + 8;
  }
  ctx.globalAlpha = 1;
  return y + chipH;
}
function fit(ctx, s, w) {
  s = String(s);
  if (w <= 0) return '';
  if (ctx.measureText(s).width <= w) return s;
  while (s.length > 1 && ctx.measureText(s + '…').width > w) s = s.slice(0, -1);
  return s + '…';
}
function bigText(ctx, text, x, y, size, color, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `400 ${size}px Bungee, Impact, sans-serif`;
  ctx.lineWidth = Math.max(5, size / 7); ctx.strokeStyle = '#0b0b10'; ctx.lineJoin = 'round';
  ctx.fillStyle = '#0b0b10'; ctx.fillText(text, x, y + size * .08);
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color; ctx.fillText(text, x, y); ctx.restore();
}

/* ---------- particles ---------- */
function drawParts(ctx) {
  for (const q of M.parts) {
    const a = Math.max(0, q.t / q.max);
    ctx.globalAlpha = a;
    switch (q.type) {
      case 'dot': case 'sq': ctx.fillStyle = q.color; ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size); break;
      case 'shell': ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.t * 20); ctx.fillStyle = q.color; ctx.fillRect(-1.6, -.8, 3.2, 1.6); ctx.restore(); break;
      case 'debris': ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot || 0); ctx.fillStyle = q.color; ctx.fillRect(-q.size / 2, -q.size / 3, q.size, q.size * .66); ctx.restore(); break;
      case 'spark': {
        const l = .028; ctx.strokeStyle = q.color; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * l, q.y - q.vy * l); ctx.stroke(); break;
      }
      case 'star': {
        ctx.fillStyle = q.color; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.t * 8); ctx.beginPath();
        for (let i = 0; i < 8; i++) { const ang = i * Math.PI / 4, r = i % 2 ? q.size * .4 : q.size; ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r); }
        ctx.fill(); ctx.restore(); break;
      }
      case 'flash': {
        const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.size);
        g.addColorStop(0, q.color); g.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, 7); ctx.fill(); break;
      }
      case 'muzzle': {
        ctx.save(); ctx.translate(q.x, q.y); ctx.scale(q.face, 1);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, q.size * 1.6);
        g.addColorStop(0, '#ffffff'); g.addColorStop(.35, q.color); g.addColorStop(1, 'rgba(255,140,40,0)');
        ctx.fillStyle = g; ctx.beginPath();
        for (let i = 0; i < 10; i++) { const ang = i * Math.PI / 5, r = i % 2 ? q.size * .4 : q.size * (i === 0 ? 1.7 : 1); ctx.lineTo(Math.cos(ang) * r + q.size * .4, Math.sin(ang) * r * .75); }
        ctx.fill(); ctx.restore(); break;
      }
      case 'fire': {
        const r = q.size * (1.3 - a * .5);
        const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
        g.addColorStop(0, a > .6 ? '#fffbe0' : '#ffe08a'); g.addColorStop(.45, '#ff9b3a'); g.addColorStop(1, 'rgba(200,40,20,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, 7); ctx.fill(); break;
      }
      case 'streak': ctx.globalAlpha = 1; ctx.strokeStyle = q.color + (a * .5).toFixed(3) + ')'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * .05, q.y - q.vy * .05); ctx.stroke(); break;
      case 'ring': ctx.strokeStyle = q.color; ctx.lineWidth = 3 * a + 1; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1 - a * .75), 0, 7); ctx.stroke(); break;
      case 'smoke': ctx.globalAlpha = 1; ctx.fillStyle = q.color + (a * .55).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1.7 - a * .7), 0, 7); ctx.fill(); break;
      case 'beam':
        ctx.save(); ctx.shadowColor = q.color; ctx.shadowBlur = 14; ctx.strokeStyle = q.color; ctx.lineWidth = 5 * a + 1;
        ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x2, q.y); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.stroke(); ctx.restore(); break;
    }
  }
  ctx.globalAlpha = 1;
}
function drawBullets(ctx) {
  for (const b of M.bullets) {
    if (b.kind === 'rocket') {
      const f = Math.sign(b.vx) || 1;
      ctx.save(); ctx.translate(b.x, b.y); ctx.scale(f, 1); ctx.strokeStyle = OUT; ctx.lineWidth = 1;
      rr(ctx, -9, -3, 16, 6, 3); fs(ctx, '#d9d4c7');
      ctx.beginPath(); ctx.moveTo(7, -3); ctx.lineTo(11, 0); ctx.lineTo(7, 3); ctx.closePath(); fs(ctx, '#c9553b');
      ctx.beginPath(); ctx.moveTo(-9, -3); ctx.lineTo(-12, -6); ctx.lineTo(-6, -3); ctx.moveTo(-9, 3); ctx.lineTo(-12, 6); ctx.lineTo(-6, 3); fs(ctx, '#5b5e70');
      ctx.restore();
    } else if (b.kind === 'arc') {
      ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, 7); fs(ctx, '#56653c'); ctx.fillStyle = '#ffc531'; ctx.fillRect(b.x - 5, b.y - 1, 10, 2);
    } else if (b.kind === 'demat') {
      ctx.save(); ctx.shadowColor = '#7ef0d0'; ctx.shadowBlur = 12; ctx.fillStyle = '#c8fff0'; ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, 7); ctx.fill(); ctx.restore();
    } else {
      const n = Math.hypot(b.vx, b.vy) || 1, l = b.heavy ? 30 : b.kb < 100 ? 8 : 18;
      const tx = b.x - b.vx / n * l, ty = b.y - b.vy / n * l;
      const g = ctx.createLinearGradient(tx, ty, b.x, b.y);
      g.addColorStop(0, 'rgba(255,200,90,0)'); g.addColorStop(1, b.heavy ? '#fffbe6' : '#ffe08a');
      ctx.strokeStyle = g; ctx.lineWidth = b.heavy ? 3.4 : 2.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(b.x, b.y, b.heavy ? 1.8 : 1.2, 0, 7); ctx.fill();
    }
  }
  ctx.lineCap = 'butt';
}

/* ---------- map preview for menus ---------- */
K.mapPreview = (cv, id) => {
  const saved = M, map = K.MAP[id]; if (!map) return;
  M = { map, theme: K.THEMES[map.theme], zones: map.zones || [], time: 0,
    plats: map.plats.map(p => Object.assign({}, p, { bx: p.x, by: p.y, dx: 0, dy: 0, on: true, cr: 0, back: 0, squash: 0 })) };
  for (const pl of M.plats) if (pl.orbit) { const [ocx, ocy, r, , ph] = pl.orbit, a = ph * Math.PI * 2; pl.x = ocx + Math.cos(a) * r - pl.w / 2; pl.y = ocy + Math.sin(a) * r * .6; }
  const g = cv.getContext('2d'), w = cv.width, h = cv.height;
  const s = Math.min(w / W, h / H), ox = (w - W * s) / 2, oy = (h - H * s) / 2;
  g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(buildBg(w, h, s, ox, oy, 1), 0, 0);
  g.setTransform(s, 0, 0, s, ox, oy);
  drawZones(g); drawSupports(g);
  for (const pl of M.plats) drawPlat(g, pl, M.theme.plat);
  g.setTransform(1, 0, 0, 1, 0, 0);
  M = saved;
};

/* ---------- main render (camera follows the fight) ---------- */
K.render = (ctx, cw, ch, dpr) => {
  if (!M) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#14151f'; ctx.fillRect(0, 0, cw, ch); return; }
  const s0 = Math.min(cw / W, ch / H);
  M.view = { w: cw / s0, h: ch / s0 };
  const cam = M.cam, S = s0 * cam.z;
  const camL = cam.x - cw / 2 / S, camT = cam.y - ch / 2 / S;
  let sx = 0, sy = 0;
  if (M.shake > 0) { sx = (Math.random() - .5) * M.shake; sy = (Math.random() - .5) * M.shake; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = M.theme.sky[0]; ctx.fillRect(0, 0, cw * dpr, ch * dpr);
  ctx.setTransform(S * dpr, 0, 0, S * dpr, (-camL + sx) * S * dpr, (-camT + sy) * S * dpr);
  ctx.drawImage(getWorldBg(s0, dpr), BG.XL, BG.YT, BG.XR - BG.XL, BG.YB - BG.YT);
  const L = camL, R = camL + cw / S;
  drawAmbient(ctx, L, R);
  drawZones(ctx);
  drawSupports(ctx);
  for (const pl of M.plats) drawPlat(ctx, pl, M.theme.plat);
  for (const tg of M.targets) if (tg.alive) drawTarget(ctx, tg);
  for (const k of M.crateList) drawCrate(ctx, k);
  for (const k of M.pickups) drawPickup(ctx, k);
  for (const p of M.players) if (!p.out && !p.elim) drawPlayer(ctx, p);
  for (const p of M.players) if (p.aim && p.type === 'human') drawAim(ctx, p);
  for (const d of M.dyn) drawDyn(ctx, d);
  drawBullets(ctx);
  drawParts(ctx);
  for (const t of M.pops) {
    ctx.save(); ctx.translate(t.x, t.y); if (t.tilt) ctx.rotate(t.tilt);
    ctx.font = `400 ${t.size}px Bungee, Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = Math.min(1, t.t / t.max * 2.5);
    ctx.lineWidth = Math.max(3, t.size / 4); ctx.strokeStyle = 'rgba(11,11,16,.95)'; ctx.lineJoin = 'round'; ctx.strokeText(t.text, 0, 0);
    ctx.fillStyle = t.color; ctx.fillText(t.text, 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // screen space
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (M.wind && M.wind.on) { ctx.fillStyle = 'rgba(230,180,110,.12)'; ctx.fillRect(0, 0, cw, ch); }
  const hudBottom = hudChips(ctx, cw);
  for (const p of M.players) {
    if (p.out || p.elim || p.ko || (p.invis && p.reveal <= 0)) continue;
    const cx = (p.x + p.w / 2 - camL) * S, top = (p.y - camT) * S, bottom = (p.y + p.h - camT) * S;
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.6; ctx.fillStyle = p.color;
    if (bottom < hudBottom + 4) {
      const x = clamp(cx, 18, cw - 18), y = hudBottom + 8;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 9, y + 15); ctx.lineTo(x + 9, y + 15); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (p.y + p.h < 0) {
        ctx.font = '700 11px Rubik, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.lineWidth = 3; ctx.strokeText(Math.round(-p.y - p.h), x, y + 17); ctx.fillStyle = '#f3efe6'; ctx.fillText(Math.round(-p.y - p.h), x, y + 17);
      }
    } else if (cx < 0 || cx > cw) {
      const left = cx < 0, x = left ? 6 : cw - 6, y = clamp((top + bottom) / 2, hudBottom + 20, ch - 20);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (left ? 16 : -16), y - 9); ctx.lineTo(x + (left ? 16 : -16), y + 9); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (top > ch) {
      const x = clamp(cx, 18, cw - 18), y = ch - 8;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 9, y - 15); ctx.lineTo(x + 9, y - 15); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  const cy = ch / 2 - 20, ts = Math.min(1, ch / 540 + .2);
  if (M.countdown > 0) {
    const n = Math.ceil(M.countdown / .8), k = (M.countdown / .8) % 1;
    bigText(ctx, n, cw / 2, cy, Math.round((76 + 34 * k) * ts), '#ffc531');
  } else if (M.mode !== 'demo' && M.time < 3.2 && M.time > 2.4) {
    bigText(ctx, M.mode === 'challenge' ? 'BAŞLA!' : 'İT!', cw / 2, cy, Math.round(70 * ts), '#5fd36a', clamp((3.2 - M.time) * 2, 0, 1));
  }
  const info = [];
  if (M.mode === 'challenge') info.push(M.clock.toFixed(2) + ' sn · ' + M.chal.done + '/' + M.chal.total);
  if (M.mode === 'survival') info.push(M.wave + '. dalga · ' + M.score + ' robot');
  if (M.mode === 'gungame' || M.mode === 'gungamer') info.push('Silah seviyesi · hedef ' + gunList().length);
  if (M.wind && (M.wind.on || M.wind.warn) && M.mode !== 'demo') info.push((M.wind.warn ? 'Kum fırtınası geliyor ' : 'Kum fırtınası ') + (M.wind.dir > 0 ? '→' : '←'));
  if (M.hint) info.push(M.hint);
  if (info.length) {
    ctx.font = '700 13px Rubik, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    info.forEach((t, i) => {
      const w = Math.min(cw - 24, ctx.measureText(t).width + 28), y = hudBottom + 22 + i * 28;
      ctx.fillStyle = 'rgba(14,15,24,.9)'; ctx.strokeStyle = OUT; ctx.lineWidth = 2; rr(ctx, cw / 2 - w / 2, y - 12, w, 24, 12); ctx.fill(); ctx.stroke();
      ctx.fillStyle = i === info.length - 1 && M.hint ? '#ffc531' : '#f3efe6'; ctx.fillText(fit(ctx, t, w - 18), cw / 2, y + .5);
    });
  }
};
})();
