/* Kenar Düellosu — weapon art. Every gun is assembled from a frame type and parts
   (stock, magazine, sight, muzzle, handguard) in its own colour scheme, outlined cartoon style.
   Origin (0,0) is the shooting hand; the barrel axis runs along y≈-2 and ends at x = wd.len. */
(() => {
"use strict";
const K = window.K;
const OL = '#0b0b10';
const SCHEMES = {
  black:    { b: '#34363f', d: '#1c1d23', l: '#5a5e6e', f: '#34363f', fd: '#1c1d23', fl: '#5a5e6e' },
  gunmetal: { b: '#525866', d: '#2d3139', l: '#7c8394', f: '#2d3139', fd: '#18191e', fl: '#4d525e' },
  tan:      { b: '#c6a66c', d: '#86703f', l: '#e8d29b', f: '#c6a66c', fd: '#86703f', fl: '#e8d29b' },
  olive:    { b: '#62703f', d: '#3b4428', l: '#879660', f: '#62703f', fd: '#3b4428', fl: '#879660' },
  wood:     { b: '#34363f', d: '#1c1d23', l: '#5a5e6e', f: '#9c6334', fd: '#5e3a1b', fl: '#cb8c54' },
  chrome:   { b: '#c3c8d2', d: '#7c828e', l: '#f3f5f8', f: '#2c2d34', fd: '#151519', fl: '#4a4c55' },
  gold:     { b: '#dcae26', d: '#906e10', l: '#fae47c', f: '#3a2a12', fd: '#20160a', fl: '#5a4422' },
  white:    { b: '#e3e6eb', d: '#9ea3ae', l: '#ffffff', f: '#34363f', fd: '#1c1d23', fl: '#5a5e6e' },
  blue:     { b: '#3f74b8', d: '#26497a', l: '#72a3e2', f: '#34363f', fd: '#1c1d23', fl: '#5a5e6e' },
  toy:      { b: '#ff8a3d', d: '#c05a1a', l: '#ffb27a', f: '#3fd6d0', fd: '#1f9c97', fl: '#8ef0ec' },
  toyY:     { b: '#ffc531', d: '#b3860f', l: '#ffe08a', f: '#2a2b33', fd: '#141419', fl: '#4a4c55' },
};
const WOOD = SCHEMES.wood;

let g = null;
function rrPath(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}
function rect(x, y, w, h, fill, r = .5) { g.beginPath(); rrPath(x, y, w, h, r); g.fillStyle = fill; g.fill(); g.stroke(); }
function poly(fill, pts, close = true) {
  g.beginPath(); g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  if (close) g.closePath();
  g.fillStyle = fill; g.fill(); g.stroke();
}
function circ(x, y, r, fill) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); g.stroke(); }
function shine(x, y, w, col, h = .6) { g.fillStyle = col; g.fillRect(x, y, w, h); }
function lines(col, w, segs) { g.save(); g.strokeStyle = col; g.lineWidth = w; g.beginPath(); for (let i = 0; i < segs.length; i += 4) { g.moveTo(segs[i], segs[i + 1]); g.lineTo(segs[i + 2], segs[i + 3]); } g.stroke(); g.restore(); }

/* ---------- parts ---------- */
function grip(c, x = 0, fill) {
  poly(fill || c.f, [x - 1.2, .2, x + 3.2, .2, x + 2.3, 7.6, x - 1.9, 7.1]);
  lines(c.fd, .35, [x - .6, 2.4, x + 2.2, 2.6, x - .9, 4, x + 1.9, 4.2, x - 1.2, 5.6, x + 1.7, 5.8]);
}
function guard(c, x = 3) { g.save(); g.strokeStyle = OL; g.lineWidth = .9; g.beginPath(); g.moveTo(x, .4); g.quadraticCurveTo(x + 1.4, 3.6, x + 4, .4); g.stroke(); g.strokeStyle = c.d; g.lineWidth = .45; g.stroke(); g.restore(); lines(OL, .6, [x + 1.6, .4, x + 1.9, 2]); }
function stock(type, c, x) {
  switch (type) {
    case 'fixed':
      poly(c.f, [x, -4.8, x - 10, -4.2, x - 11.4, -4, x - 12, 2.8, x - 10.2, 3.2, x - 3.4, .6, x, .6]);
      rect(x - 12.6, -4.2, 1.8, 7.4, c.fd, .4); shine(x - 10, -3.9, 9, c.fl); break;
    case 'wood':
      poly(c.f, [x, -4.4, x - 6, -3.6, x - 13, -3, x - 14, 3.8, x - 11.4, 4.2, x - 4.6, 1.6, x, 1.2]);
      rect(x - 14.6, -3.2, 1.6, 7.2, c.fd, .5);
      lines(c.fl, .35, [x - 12, -2, x - 3, -3.3, x - 11.5, 1, x - 5, .2]); break;
    case 'thumb':
      g.beginPath();
      g.moveTo(x, -4.8); g.lineTo(x - 12.4, -4.2); g.lineTo(x - 13.2, 3.4); g.lineTo(x - 10.4, 3.8); g.lineTo(x - 4.4, 1.2); g.lineTo(x, 1.2); g.closePath();
      g.moveTo(x - 4, -2); g.lineTo(x - 8.4, -2.2); g.quadraticCurveTo(x - 9.2, .4, x - 6.6, .3); g.closePath();
      g.fillStyle = c.f; g.fill('evenodd'); g.stroke();
      rect(x - 13.8, -4.2, 1.6, 8, c.fd, .4); break;
    case 'skel':
      rect(x - 11, -4.6, 11, 1.6, c.f, .5);
      poly(c.f, [x - 1, -1, x - 10.6, 2.4, x - 10.6, 3.8, x, .6]);
      rect(x - 12, -4.8, 1.8, 8.8, c.fd, .5); break;
    case 'fold':
      rect(x - 9, -4, 9, 1.3, c.d, .4); rect(x - 9, .6, 9, 1.1, c.d, .4);
      rect(x - 10.2, -4.6, 1.8, 7, c.fd, .4); break;
    case 'wire':
      g.save(); g.strokeStyle = OL; g.lineWidth = 1.3; g.beginPath(); g.moveTo(x, -3.6); g.lineTo(x - 8, -3.6); g.lineTo(x - 8, 1.6); g.lineTo(x, 1.6); g.stroke();
      g.strokeStyle = c.l; g.lineWidth = .5; g.stroke(); g.restore(); break;
  }
}
function mag(type, c, x, col) {
  const m = col || c.d;
  switch (type) {
    case 'straight': poly(m, [x, .2, x + 3, .2, x + 3.7, 8.2, x + .7, 8.4]); shine(x + .5, 1.2, 2, 'rgba(255,255,255,.18)', 6); break;
    case 'curved':
      g.beginPath(); g.moveTo(x, .2); g.lineTo(x + 3.2, .2); g.quadraticCurveTo(x + 4.4, 5, x + 6.6, 8.4); g.lineTo(x + 3.6, 9.6); g.quadraticCurveTo(x + 1.6, 5.6, x, .2); g.closePath();
      g.fillStyle = m; g.fill(); g.stroke();
      lines('rgba(0,0,0,.35)', .35, [x + 1, 3, x + 3.8, 3, x + 1.8, 5.6, x + 4.8, 5.4]); break;
    case 'drum': circ(x + 2.4, 4.6, 4.2, m); circ(x + 2.4, 4.6, 1.8, c.l); circ(x + 2.4, 4.6, .6, OL); break;
    case 'box': rect(x - .5, .2, 6.6, 5.6, m, .6); lines('rgba(255,255,255,.18)', .4, [x + .5, 2, x + 5, 2, x + .5, 3.6, x + 5, 3.6]); break;
    case 'dual': poly(m, [x - 1.6, .2, x + 1.4, .2, x + 2.6, 8.6, x - .4, 9]); poly(m, [x + 1.6, .2, x + 4.6, .2, x + 6.4, 8.4, x + 3.4, 9]); break;
    case 'belt':
      rect(x - 1, .4, 8, 6.4, '#5a6639', .6); shine(x, 1.4, 6, 'rgba(255,255,255,.2)');
      g.save(); g.fillStyle = '#d1a43a'; g.strokeStyle = OL; g.lineWidth = .35;
      for (let i = 0; i < 4; i++) { g.beginPath(); rrPath(x - 3 - i * 1.6, -2 + i * 1.6, 1.4, 2.6, .4); g.fill(); g.stroke(); }
      g.restore(); break;
    case 'ext': rect(-1.6, 7, 3.6, 4.4, m, .4); break;
  }
}
function sight(type, c, x, w) {
  switch (type) {
    case 'iron': rect(x, -6.6, 1.3, 1.8, c.d, .2); break;
    case 'dot': rect(x - .6, -6.4, 1.6, 1.4, c.d, .2); rect(x, -8.2, 4.4, 2.6, '#1d1e24', .8); circ(x + 4, -6.9, .75, '#ff4040'); break;
    case 'holo':
      rect(x - .4, -6.2, 5.4, 1.2, c.d, .2);
      g.beginPath(); rrPath(x, -9.4, 4.6, 3.6, .6); g.fillStyle = 'rgba(140,210,255,.45)'; g.fill(); g.lineWidth = .9; g.stroke(); g.lineWidth = .55;
      circ(x + 2.3, -7.6, .45, '#ff4040'); break;
    case 'mid': case 'long': case 'huge': {
      const h = type === 'huge' ? 3.4 : 2.6, top = type === 'huge' ? -10.4 : -9;
      rect(x + w * .25, top + h - .2, 1.4, 2.2, c.d, .2); rect(x + w * .7, top + h - .2, 1.4, 2.2, c.d, .2);
      rect(x, top, w, h, '#18191f', 1);
      rect(x - 1.4, top - .6, 3, h + 1.2, '#18191f', .8); rect(x + w - 1.8, top - .9, 3.4, h + 1.8, '#18191f', .8);
      shine(x + 1.8, top + .5, w - 4, 'rgba(255,255,255,.22)');
      g.fillStyle = '#7ec8ff'; g.fillRect(x + w + 1.3, top - .4, .6, h + .8); break;
    }
  }
}
function muzzle(type, c, x) {
  switch (type) {
    case 'supp': rect(x, -3.6, 7, 3.8, c.d, 1.2); lines('rgba(255,255,255,.15)', .4, [x + 1.5, -3, x + 1.5, -.4, x + 3.5, -3, x + 3.5, -.4]); return 7;
    case 'brake': rect(x, -3.4, 3.2, 3.4, c.d, .5); lines(OL, .45, [x + 1, -3.2, x + 1, -.2, x + 2.2, -3.2, x + 2.2, -.2]); return 3.2;
    case 'bigbrake': rect(x, -4.6, 5, 5.6, c.d, .6); lines(OL, .55, [x + 1.4, -4.4, x + 1.4, .8, x + 3.2, -4.4, x + 3.2, .8]); return 5;
  }
  return 0;
}
function handguard(type, c, x0, x1) {
  const w = x1 - x0;
  switch (type) {
    case 'rail': rect(x0, -4.8, w, 4.2, c.d, .5); g.fillStyle = OL; for (let x = x0 + .8; x < x1 - .8; x += 1.4) g.fillRect(x, -5.4, .7, .7); break;
    case 'wood': rect(x0, -4.4, w, 3.6, c.f, 1.2); lines(c.fl, .35, [x0 + 1, -3.4, x1 - 1.4, -3.6]); break;
    case 'vent': rect(x0, -4.6, w, 4, c.d, .8); g.fillStyle = OL; for (let x = x0 + 1.4; x < x1 - 1; x += 2.2) { g.beginPath(); g.arc(x, -2.6, .55, 0, 7); g.fill(); } break;
    case 'fin': rect(x0, -4.2, w, 3.4, c.d, .6); lines(OL, .4, Array.from({ length: Math.floor(w / 1.3) }, (_, i) => [x0 + .8 + i * 1.3, -4, x0 + .8 + i * 1.3, -1]).flat()); break;
    default: return false;
  }
  return true;
}
function bipod(c, x) { lines(OL, 1.2, [x, -.2, x - 2.6, 8.6, x + .6, -.2, x + 3.2, 8.6]); lines(c.l, .45, [x, -.2, x - 2.6, 8.6, x + .6, -.2, x + 3.2, 8.6]); }
function stripe(col, x, y, w, h) { if (!col) return; g.fillStyle = col; g.fillRect(x, y, w, h); }

/* ---------- frames ---------- */
const FRAMES = {
  pistol(L, c, o) {
    const top = o.big ? -5.8 : -4.8;
    grip(c, 0, o.furn === 'wood' ? WOOD.f : c.f);
    mag(o.mg, c, 0);
    poly(c.d, [-2.4, -.8, L * .74, -.8, L * .74, .8, 6.6, .8, 3, 1.2, -2.4, 1]);
    guard(c, 2.6);
    if (o.big) poly(c.b, [-3.4, top, L - 1.2, top, L, top + 1.4, L, -.8, -3.4, -.8]);
    else rect(-3.4, top, L + 3.4, -.8 - top, c.b, .6);
    shine(-2.6, top + .45, L + 1.6, c.l);
    lines(OL, .32, [-2.6, top + 1.2, -2.6, -1.4, -1.6, top + 1.2, -1.6, -1.4, -.6, top + 1.2, -.6, -1.4]);
    rect(L * .38, top + .9, 2.6, 1.3, c.d, .2);
    rect(-4.4, top + .4, 1.4, 1.6, c.d, .3);
    if (o.engr) lines(c.l, .35, [1, top + 2.2, 3, top + 1.4, 3, top + 1.4, 5, top + 2.4, 5, top + 2.4, 7, top + 1.6]);
    return -2;
  },
  revolver(L, c, o) {
    const fur = o.furn === 'wood' ? WOOD : c;
    poly(fur.f, [-1.6, -.4, 2.2, -.4, 1.4, 4.4, -.8, 8, -3.8, 7.8, -2.6, 3.6]);
    lines(fur.fl, .35, [-2.2, 4.2, .6, 3.4, -2.8, 6, -.4, 5.4]);
    poly(c.b, [-2.6, -4.8, 7, -4.8, 7, .4, 4.8, 1.2, -1.4, .2]);
    guard(c, 2.4);
    rect(6.4, -4.4, L - 6.4, 2.8, c.b, .6); rect(6.4, -5.2, L - 6.4, .9, c.d, .2); shine(7, -3.9, L - 8, c.l);
    rect(.6, -5.2, 6.4, 5.4, c.d, 1.4); lines(OL, .35, [2.2, -4.6, 2.2, -.4, 3.8, -4.6, 3.8, -.4, 5.4, -4.6, 5.4, -.4]);
    rect(L - 1.6, -6.2, 1.2, 1.2, c.d, .2);
    poly(c.d, [-2.6, -4.8, -4.6, -6.2, -4.2, -4.4]);
    if (o.sc) sight(o.sc, c, L * .5, 0);
    return -2;
  },
  smg(L, c, o) {
    const r1 = L * .58;
    stock(o.st, c, -4);
    if (o.mg === 'grip') { grip(c, 0); rect(-1.2, 7, 3.4, 4.2, c.d, .4); } else grip(c, 0);
    if (o.mg !== 'grip') mag(o.mg, c, L * .26, o.magc);
    if (o.vg) rect(r1 - 3, .2, 2.4, 5.6, c.f, .6);
    guard(c, 2.8);
    rect(-4, -5.2, r1 + 4, 5.6, c.b, .8); shine(-3.2, -4.6, r1 + 2.4, c.l);
    rect(L * .1, -3.4, 2.4, 1.2, c.d, .2);
    stripe(o.stripe, -3.4, -2.2, r1 + 2.8, .9);
    const md = o.md ? (o.md === 'supp' ? 7 : 3.2) : 0;
    if (!handguard(o.hg, c, r1, L - md - 1.6)) rect(r1, -3.8, L - md - r1, 2.6, c.d, .4);
    else rect(L - md - 1.8, -3.4, 1.8, 2, c.d, .2);
    muzzle(o.md, c, L - md);
    if (o.sc) sight(o.sc, c, o.sc === 'iron' ? r1 - 1.6 : L * .12, 0);
    return -4;
  },
  p90(L, c, o) {
    poly(c.b, [-12, -4.2, -11, -5.8, L - 6, -5.8, L - 4, -3.8, L - 4, -.6, 6, 2.8, 4.4, 6.8, 1, 6.8, -1, 2.6, -6, 2.6, -11.6, 3.4]);
    g.beginPath(); g.ellipse(1.8, 2, 1.6, 2.6, 0, 0, 7); g.fillStyle = 'rgba(0,0,0,.55)'; g.fill();
    rect(-6, -7.8, L * .6, 2.4, 'rgba(220,226,236,.85)', .8);
    g.fillStyle = '#d9a33a'; for (let x = -5; x < L * .6 - 7; x += 1.4) g.fillRect(x, -7.2, .8, 1.2);
    rect(L - 4, -3.4, 4.4, 2, c.d, .3);
    stripe(o.stripe, -10.4, -1.4, L - 8, 1);
    shine(-10, -5.2, L - 8, c.l);
    rect(L * .2, -9.8, 3.6, 2.4, '#1d1e24', .6); circ(L * .2 + 3.2, -8.6, .6, '#ff4040');
    return -12;
  },
  vector(L, c, o) {
    stock('fold', c, -4);
    mag('straight', c, 4.2, c.d);
    poly(c.b, [-4, -5.4, L * .62, -5.4, L * .62, -1.2, 9, 4.2, 4, 4.2, 3, .4, -4, .4]);
    grip(c, -.4, c.d);
    shine(-3.2, -4.8, L * .6, c.l);
    rect(L * .62, -3.6, L * .38, 2.2, c.d, .4);
    lines(OL, .4, [L * .3, -4.4, L * .5, -2]);
    if (o.sc) sight(o.sc, c, L * .08, 0);
    return -4;
  },
  rifle(L, c, o) {
    const r1 = L * .4, h1 = L * .8;
    stock(o.st, c, -4);
    grip(c, 0, o.st === 'wood' ? c.f : c.d);
    mag(o.mg, c, L * .22, o.magc);
    guard(c, 2.6);
    rect(-4, -5.2, r1 + 4, 5.2, c.b, .8); shine(-3.2, -4.6, r1 + 2.4, c.l);
    rect(L * .08, -3.4, 2.6, 1.1, c.d, .2);
    stripe(o.stripe, -3.4, -2.2, r1 + 2.6, .9);
    const md = o.md ? (o.md === 'supp' ? 7 : 3.2) : 0;
    rect(h1 - 1, -3.2, L - h1 - md + 1, 1.7, c.d, .3);
    if (!handguard(o.hg || 'plain', c, r1, h1)) rect(r1, -4.6, h1 - r1, 3.8, c.d, 1.2);
    rect(h1 - 2.2, -6.4, 1.3, 3.4, c.d, .2);
    muzzle(o.md, c, L - md);
    if (o.handle) { rect(-.4, -8.4, r1 - 2, 1.6, c.b, .6); rect(0, -7, 1.2, 2, c.b, .2); rect(r1 - 3.6, -7, 1.2, 2, c.b, .2); }
    if (o.sc) sight(o.sc, c, o.sc === 'iron' ? -1.4 : 0, L * .38);
    return -4;
  },
  bullpup(L, c, o) {
    grip(c, 0, c.d); guard(c, 2.6);
    mag(o.mg || 'curved', c, -8.6, c.d);
    poly(c.b, [-14, -4.6, -12.4, -5.6, L * .58, -5.6, L * .62, -3, L * .62, .6, 5.4, .6, -1.4, .6, -14, 2.4]);
    rect(-14.6, -4.6, 1.6, 7.4, c.fd, .5);
    shine(-12, -5, L * .58 + 10, c.l);
    stripe(o.stripe, -12, -2.6, L * .6 + 10, 1);
    rect(L * .62, -4.4, L * .24, 3.6, c.d, 1);
    rect(L * .86 - .5, -3.2, L * .14 + .5, 1.6, c.d, .3);
    if (o.handle) { rect(-8, -9, L * .55, 1.8, c.b, .8); rect(-7, -7.4, 1.4, 2, c.b, .2); rect(L * .4, -7.4, 1.4, 2, c.b, .2); }
    if (o.sc) sight(o.sc, c, L * .05, L * .3);
    return -14;
  },
  lmg(L, c, o) {
    const r1 = L * .48;
    stock(o.st || 'fixed', c, -5);
    grip(c, 0, c.d); guard(c, 2.6);
    rect(-5, -6.4, r1 + 5, 6.8, c.b, .8); shine(-4, -5.8, r1 + 3, c.l);
    rect(-3, -7.4, r1, 1.4, c.d, .4);
    mag(o.mg, c, L * .16);
    rect(r1, -3.6, L - r1, 2.2, c.d, .4);
    if (!handguard(o.hg || 'vent', c, r1, L * .86)) {}
    rect(L - 2.4, -4.4, 2.4, 3.6, c.d, .4);
    if (o.bipod) bipod(c, L * .78);
    if (o.handle) { g.save(); g.lineWidth = 1.4; g.strokeStyle = OL; g.beginPath(); g.moveTo(r1 * .3, -7.4); g.quadraticCurveTo(r1 * .55, -11, r1 * .8, -7.4); g.stroke(); g.restore(); }
    return -5;
  },
  sniper(L, c, o) {
    const r1 = L * .38;
    stock(o.st, c, -4);
    grip(c, 0, o.st === 'wood' || o.st === 'thumb' ? c.f : c.d); guard(c, 2.6);
    if (o.mg) mag(o.mg, c, L * .14);
    rect(-4, -4.6, r1 + 4, 4.6, c.b, .8); shine(-3.2, -4, r1 + 2.4, c.l);
    stripe(o.stripe, -3.4, -1.8, r1 + 2.6, .9);
    const md = o.md === 'supp' ? 7 : o.md === 'bigbrake' ? 5 : o.md ? 3.2 : 0;
    const bh = o.thick ? 2.6 : 1.7;
    rect(r1, -3.2 - (o.thick ? .4 : 0), L - r1 - md, bh, c.d, .4);
    if (o.fore || o.st === 'wood') rect(r1 - 1, -3.8, L * .3, 3.6, c.f, 1.2);
    if (o.hg === 'rail') rect(r1, -4.6, L * .3, 3.8, c.d, .4);
    lines(OL, .6, [r1 * .6, -1, r1 * .6 + .6, 2.2]); circ(r1 * .6 + .7, 2.4, .9, c.l);
    muzzle(o.md, c, L - md);
    if (o.bipod) bipod(c, L * .66);
    if (o.sc === 'iron') { rect(L - md - 1.6, -5.2, 1.2, 2.2, c.d, .2); rect(-1, -6, 1.6, 1.4, c.d, .2); }
    else sight(o.sc || 'long', c, -1, o.sc === 'mid' ? L * .3 : L * .42);
    return -4;
  },
  pump(L, c, o) {
    const r1 = L * .34;
    if (o.pg) grip(c, 0, c.d); else stock(o.st || 'wood', c, -3);
    if (!o.pg) grip(c, 0, o.st === 'skel' || o.st === 'fixed' ? c.d : c.f);
    guard(c, 2.6);
    const md = o.md ? 3.2 : 0;
    rect(r1, -2.4, L * .56, 2, c.d, .5);
    rect(r1, -4.8, L - r1 - md, 2.4, c.b, .5); shine(r1 + .6, -4.4, L - r1 - md - 1.4, c.l);
    if (o.hg === 'vent') { rect(r1 + 1, -5.6, L * .45, 1.4, c.d, .4); g.fillStyle = OL; for (let x = r1 + 2; x < r1 + L * .45; x += 1.8) g.fillRect(x, -5.2, .8, .6); }
    const fc = o.fore === 'wood' ? WOOD.f : c.d;
    rect(L * .46, -2.9, L * .26, 3.6, fc, 1);
    lines(OL, .35, [L * .5, -2.6, L * .5, .4, L * .55, -2.6, L * .55, .4, L * .6, -2.6, L * .6, .4, L * .65, -2.6, L * .65, .4]);
    rect(-3, -5.2, r1 + 3, 5.4, c.b, .8); shine(-2.2, -4.7, r1 + 1.6, c.l);
    stripe(o.stripe, -2.6, -2.2, r1 + 2.2, .9);
    circ(L - md - 1, -5.4, .6, c.l);
    muzzle(o.md, c, L - md);
    if (o.sc) sight(o.sc, c, 0, 0);
    return -3;
  },
  double(L, c, o) {
    if (o.sawed) { poly(c.f, [-1.6, -.6, 2.4, -.6, 1.6, 4.2, -1, 8.2, -4.4, 8, -3, 3.4]); lines(c.fl, .35, [-2.6, 4.4, .6, 3.4]); }
    else { stock('wood', c, -3); grip(c, 0, c.f); }
    guard(c, 2.4);
    rect(1.6, -5.4, L - 1.6, 2.5, c.b, .9); rect(1.6, -3, L - 1.6, 2.5, c.b, .9);
    shine(2.4, -5, L - 3.4, c.l); shine(2.4, -2.6, L - 3.4, c.l);
    rect(L * .3, -.8, L * .42, 2.4, c.f, 1);
    rect(-3.4, -5.4, 5.6, 5.8, c.d, .8);
    rect(-2.6, -6.8, 1.4, 1.8, c.d, .3); rect(-.8, -6.8, 1.4, 1.8, c.d, .3);
    return -3;
  },
  autosg(L, c, o) {
    const r1 = L * .56;
    stock(o.st || 'fixed', c, -5);
    grip(c, 0, c.d); guard(c, 2.6);
    mag(o.mg || 'box', c, L * .24);
    rect(-5, -6.2, r1 + 5, 7, c.b, 1); shine(-4, -5.6, r1 + 3, c.l);
    rect(r1, -4.6, L - r1, 3.4, c.d, .5);
    rect(r1, -5.6, L * .26, 1.2, c.d, .3);
    if (o.handle) rect(-2, -8.4, r1 - 2, 1.8, c.b, .8);
    rect(L - 2, -5, 2, 4.2, c.d, .3);
    return -5;
  },
  blunder(L, c, o) {
    stock('wood', c, -2);
    grip(c, 0, c.f); guard(c, 2.4);
    rect(-2, -4.4, 8, 4.6, c.f, 1);
    poly('#c9a14a', [2, -4.6, L - 3.4, -4.6, L, -7, L, 2, L - 3.4, -.4, 2, -.4]);
    shine(3, -4, L - 7, '#f0d488');
    lines('#7a5a20', .7, [L * .35, -4.6, L * .35, -.4, L * .65, -4.6, L * .65, -.4]);
    poly(c.d, [-1, -4.4, -3.4, -7.4, -1.8, -7.6, .6, -4.4]);
    return -2;
  },
  minigun(L, c) {
    rect(-2, 2, 9, 6.4, '#5a6639', .8); shine(-1.2, 3, 7, 'rgba(255,255,255,.2)');
    g.save(); g.strokeStyle = '#d1a43a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(7, 3); g.quadraticCurveTo(11, 3, 12, -.6); g.stroke(); g.restore();
    for (let i = 0; i < 4; i++) rect(8, -6 + i * 1.6, L - 8, 1.3, i % 2 ? c.d : c.b, .3);
    rect(10, -6.8, 2.2, 7.8, c.d, .4); rect(L * .7, -6.8, 2.2, 7.8, c.d, .4); rect(L - 2, -7.2, 2.4, 8.6, c.d, .5);
    rect(-5, -7.4, 13.6, 9.2, c.b, 2.2); shine(-4, -6.6, 11.6, c.l);
    g.save(); g.lineWidth = 1.6; g.strokeStyle = OL; g.beginPath(); g.moveTo(-3, -7.4); g.quadraticCurveTo(1.4, -12, 6, -7.4); g.stroke(); g.restore();
    grip(c, 0, c.d);
    return -5;
  },
  rocket(L, c) {
    grip(c, 0, c.d); rect(L * .45, .2, 2.4, 5, c.d, .5);
    rect(-12, -5.6, L + 12, 5.8, c.b, 2.6); shine(-10, -5, L + 8, c.l);
    rect(L - 3.4, -6.8, 3.6, 8.2, c.d, 1); rect(-13.4, -6.4, 3.4, 7.4, c.d, 1);
    g.save(); g.beginPath(); rrPath(L * .62, -5.6, 4, 5.8, .4); g.clip();
    for (let x = L * .62 - 6; x < L * .62 + 6; x += 2.4) { g.fillStyle = '#ffc531'; g.beginPath(); g.moveTo(x, .2); g.lineTo(x + 1.2, .2); g.lineTo(x + 4.6, -5.6); g.lineTo(x + 3.4, -5.6); g.fill(); }
    g.restore();
    rect(1, -9, 4.6, 3.6, c.d, .6); circ(5.2, -7.2, .7, '#7ec8ff');
    return -13;
  },
  launcher(L, c) {
    stock('fold', c, -3);
    grip(c, 0, c.d); guard(c, 2.6);
    rect(L * .5, .2, 2.4, 5, c.d, .5);
    rect(-3, -4.8, 6, 4.8, c.b, .8);
    rect(2, -7, 9, 9.6, c.b, 2.6); circ(4.4, -4.4, 1.4, c.d); circ(8.6, -4.4, 1.4, c.d); circ(4.4, -.4, 1.4, c.d); circ(8.6, -.4, 1.4, c.d);
    rect(11, -5.4, L - 11, 4.2, c.d, 1.2); shine(12, -4.8, L - 13, c.l);
    rect(L - 1.6, -6, 1.8, 5.4, c.b, .4);
    return -3;
  },
  laser(L, c, o, wd) {
    grip(c, 0, '#34363f'); guard({ d: '#1c1d23' }, 2.6);
    rect(2, .4, 5, 3, '#34363f', .6); circ(4.4, 2, .9, wd.accent);
    poly(c.b, [-6, -5, L - 5, -3.6, L, -2.2, L - 5, -.6, 6, .8, -6, .8]);
    shine(-5, -4.4, L - 8, c.l);
    g.save(); g.shadowColor = wd.accent; g.shadowBlur = 3;
    for (let i = 0; i < 3; i++) rect(L * .35 + i * 3, -4.4, 1.6, 4.6, wd.accent, .5);
    g.restore();
    circ(L, -2.2, .9, wd.accent);
    return -6;
  },
  demat(L, c, o, wd) {
    grip(c, 0, '#2c2d34'); guard({ d: '#1c1d23' }, 2.6);
    rect(-6, -6, L * .58 + 6, 7, c.b, 3.2); shine(-4.4, -5.2, L * .5, c.l);
    rect(L * .55, -4, L * .32, 3, c.d, 1.4);
    g.save(); g.shadowColor = wd.accent; g.shadowBlur = 4;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(L * .6 + i * 2.6, -2.5, 1.1, 3.1, 0, 0, 7); g.fillStyle = wd.accent; g.fill(); g.stroke(); }
    g.restore();
    poly(c.b, [L * .87, -4, L, -6.6, L, 1.6, L * .87, -1]);
    circ(-1.6, -2.6, 1.6, wd.accent);
    return -6;
  },
  nail(L, c) {
    poly('#3a3b44', [L * .2, 1, L * .2 + 2.6, 1, -4, 9, -6.6, 9]);
    g.fillStyle = '#c9ccd4'; for (let i = 0; i < 6; i++) g.fillRect(L * .2 - 1.2 - i * 1.1, 2 + i * 1.2, 1.6, .5);
    grip(c, 0, '#2a2b33');
    rect(-5, -5.6, L * .58 + 5, 6.2, c.b, 2); shine(-4, -5, L * .5, c.l);
    lines(OL, .45, [-2.4, -4.4, -2.4, -1.4, -1, -4.4, -1, -1.4, .4, -4.4, .4, -1.4]);
    rect(L * .58, -3.8, L * .42, 2.8, '#2a2b33', .8); rect(L - 1.6, -4.4, 1.6, 4, '#2a2b33', .4);
    return -5;
  },
  air(L, c) {
    rect(-7, .6, L * .62, 4.2, c.b, 2); shine(-6, 1.2, L * .55, c.l);
    grip(c, 0, '#34363f');
    rect(-5, -5.2, L * .5 + 5, 5, '#d9dde6', 1.2);
    circ(1.4, -7.2, 2, '#ffffff'); lines(OL, .45, [1.4, -7.2, 2.4, -8.4]);
    poly(c.b, [L * .45, -4.2, L - 4, -4.2, L, -7, L, 2.6, L - 4, -.6, L * .45, -.6]);
    shine(L * .5, -3.6, L * .4, c.l);
    return -7;
  },
  toy(L, c) {
    grip(c, 0, c.f);
    rect(-5, -5.8, L * .62 + 5, 7, c.b, 3); shine(-3.6, -5, L * .5, c.l);
    rect(L * .62, -4.2, L * .38 - 3, 3, c.d, 1); rect(L - 3.2, -4.6, 3.4, 3.8, '#ffd23f', 1);
    circ(-1.6, -2.4, 1, c.f); circ(1.4, -2.4, 1, '#ffd23f'); circ(4.4, -2.4, 1, c.f);
    return -5;
  },
  twin(L, c, o) {
    grip(c, 0, c.f); guard(c, 2.6);
    rect(-3.4, -6.6, L + 3.4, 2.8, c.b, .6); rect(-3.4, -3.6, L + 3.4, 2.8, c.b, .6);
    shine(-2.6, -6.2, L + 1.6, c.l); shine(-2.6, -3.2, L + 1.6, c.l);
    stripe(o.stripe, -2.6, -.9, L * .7, .9);
    rect(-4.4, -7, 2, 6.4, c.d, .4);
    return -4;
  },
};

K.drawGunArt = (ctx, wd) => {
  g = ctx;
  const o = wd.look || { t: 'pistol', c: 'black' };
  const c = SCHEMES[o.c] || SCHEMES.black;
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = OL; g.lineWidth = .55;
  (FRAMES[o.t] || FRAMES.pistol)(wd.len, c, o, wd);
  g.restore();
};

/* ---------- sprite cache ---------- */
const SPR = {}, S = 5, PAD_L = 19, PAD_T = 13;
K.gunSprite = (wd) => {
  if (SPR[wd.id]) return SPR[wd.id];
  const c = document.createElement('canvas');
  c.width = Math.ceil((wd.len + PAD_L + 6) * S); c.height = Math.ceil(PAD_T * 2 * S);
  const x = c.getContext('2d');
  x.scale(S, S); x.translate(PAD_L, PAD_T);
  K.drawGunArt(x, wd);
  return (SPR[wd.id] = c);
};
// draw a gun with its grip at (x, y), barrel to the right, s = world scale
K.drawGun = (ctx, wd, x, y, s = 1) => {
  const spr = K.gunSprite(wd);
  ctx.drawImage(spr, x - PAD_L * s, y - PAD_T * s, spr.width / S * s, spr.height / S * s);
};
// fit a gun into a box (for menus)
K.drawGunFit = (ctx, wd, bw, bh) => {
  const spr = K.gunSprite(wd);
  const left = (wd.look && ({ p90: 12, bullpup: 15, rocket: 14, sniper: 15, rifle: 17, lmg: 18, smg: 15, minigun: 6, laser: 7, demat: 7, air: 8, toy: 6, nail: 7, launcher: 13, double: 18, pump: 18, autosg: 17, blunder: 17, vector: 14, twin: 5, revolver: 5, pistol: 5 })[wd.look.t]) || 6;
  const t = wd.look && wd.look.t;
  const w = wd.len + left + 1, h = t === 'pistol' || t === 'revolver' || t === 'twin' ? 14 : t === 'sniper' || t === 'minigun' ? 21 : 18;
  const s = Math.min(bw * .9 / w, bh * .85 / h);
  K.drawGun(ctx, wd, bw / 2 - (w / 2 - left) * s, bh / 2 + 1 * s, s);
};
})();
