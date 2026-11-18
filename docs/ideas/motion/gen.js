// Generates frame SVGs for kaiju motion sketches and renders them with Playwright.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2];
const ONLY = process.argv[3]; // optional scene name
const FONT = "IPAGothic, 'WenQuanYi Zen Hei', sans-serif";
const INK = '#2f3e36';
const SKIN = '#6f9a7a';

const defs = `
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#9fcde0"/><stop offset="0.6" stop-color="#d8ebe9"/><stop offset="1" stop-color="#f4e6c6"/>
  </linearGradient>
  <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#b7b29b"/><stop offset="1" stop-color="#9c967d"/>
  </linearGradient>
  <filter id="blurFar" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="3.5"/></filter>
  <filter id="blurNear" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>
  <g id="car">
    <rect x="-80" y="-19" width="160" height="38" rx="9" fill="#f3efe2" stroke="${INK}" stroke-width="3"/>
    <rect x="-80" y="4" width="160" height="7" fill="#3f7fc0"/>
    ${[-64, -40, -16, 8, 32, 58].map(x => `<rect x="${x}" y="-11" width="16" height="11" rx="2" fill="#5b6f7a"/>`).join('')}
    ${[-52, -36, 36, 52].map(x => `<circle cx="${x}" cy="20" r="6" fill="#333"/>`).join('')}
  </g>
  <g id="house">
    <path d="M-18 0 L-18 -22 L0 -36 L18 -22 L18 0 Z" fill="#efe3c6" stroke="${INK}" stroke-width="2.5"/>
    <path d="M-22 -20 L0 -40 L22 -20" fill="none" stroke="#b5533c" stroke-width="6" stroke-linecap="round"/>
    <rect x="-6" y="-14" width="10" height="14" fill="#8a6a4a"/>
  </g>
</defs>`;

// ---------- kaiju parts (local coords as in the original sketch) ----------
const kaijuTorso = `
  <path d="M505 545 C 430 600 360 630 280 612 C 330 600 390 575 470 500 Z" fill="${SKIN}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
  <g fill="#e2a64c" stroke="${INK}" stroke-width="4" stroke-linejoin="round">
    <path d="M545 232 Q 500 205 506 262 Z"/><path d="M520 296 Q 466 280 480 338 Z"/>
    <path d="M500 362 Q 446 354 466 412 Z"/><path d="M494 432 Q 442 432 466 480 Z"/>
    <path d="M440 548 Q 412 540 418 572 Z"/><path d="M372 590 Q 350 580 352 605 Z"/>
  </g>
  <g fill="${SKIN}" stroke="${INK}" stroke-width="5"><ellipse cx="545" cy="625" rx="50" ry="34"/><ellipse cx="665" cy="628" rx="50" ry="34"/></g>
  <g fill="#f4f0e2" stroke="${INK}" stroke-width="3">
    <circle cx="515" cy="650" r="8"/><circle cx="537" cy="655" r="8"/><circle cx="559" cy="655" r="8"/>
    <circle cx="645" cy="655" r="8"/><circle cx="667" cy="658" r="8"/><circle cx="689" cy="655" r="8"/>
  </g>
  <ellipse cx="600" cy="470" rx="125" ry="160" fill="${SKIN}" stroke="${INK}" stroke-width="5"/>
  <ellipse cx="618" cy="505" rx="78" ry="112" fill="#ead9ad" stroke="${INK}" stroke-width="3"/>
  <g stroke="#c9b583" stroke-width="3">
    <line x1="560" y1="450" x2="676" y2="450"/><line x1="548" y1="490" x2="688" y2="490"/>
    <line x1="550" y1="530" x2="686" y2="530"/><line x1="562" y1="570" x2="674" y2="570"/>
  </g>
`;
const backArmStub = `
  <path d="M520 420 Q 490 460 508 490" stroke="${INK}" stroke-width="30" stroke-linecap="round" fill="none"/>
  <path d="M520 420 Q 490 460 508 490" stroke="#628b6d" stroke-width="22" stroke-linecap="round" fill="none"/>`;
const kaijuBody = kaijuTorso + backArmStub;

function head(expr = 'serious', tilt = 0) {
  let eyes, mouth, extra = '';
  if (expr === 'serious') {
    eyes = `<circle cx="612" cy="268" r="9" fill="#1f2a24"/><circle cx="655" cy="262" r="9" fill="#1f2a24"/>
      <circle cx="615" cy="265" r="3" fill="#fff"/><circle cx="658" cy="259" r="3" fill="#fff"/>
      <path d="M598 248 L622 252" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
      <path d="M645 246 L668 242" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
    mouth = `<path d="M668 338 Q 680 344 692 336" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  } else if (expr === 'dizzy') {
    const sp = (cx, cy) => `<path d="M${cx} ${cy} m-2 0 a2 2 0 1 1 4 0 a4 4 0 1 1 -8 0 a6 6 0 1 1 12 0 a8 8 0 1 1 -16 0" fill="none" stroke="${INK}" stroke-width="2.5"/>`;
    eyes = sp(612, 268) + sp(655, 262);
    mouth = `<path d="M664 340 q 6 -6 12 0 q 6 6 12 0 q 6 -6 12 0" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  } else { // surprised "a"
    eyes = `<circle cx="612" cy="268" r="11" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="612" cy="268" r="4" fill="#1f2a24"/>
      <circle cx="655" cy="262" r="11" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="655" cy="262" r="4" fill="#1f2a24"/>`;
    mouth = `<ellipse cx="682" cy="340" rx="8" ry="10" fill="#7a2f2f" stroke="${INK}" stroke-width="3"/>`;
    extra = `<path d="M540 225 Q 530 245 540 252 Q 550 245 540 225 Z" fill="#bfe6f5" stroke="${INK}" stroke-width="2.5"/>
      <path d="M528 255 Q 520 270 528 276 Q 536 270 528 255 Z" fill="#bfe6f5" stroke="${INK}" stroke-width="2"/>`;
  }
  return `<g transform="rotate(${tilt} 600 330)">
    <ellipse cx="600" cy="292" rx="92" ry="84" fill="${SKIN}" stroke="${INK}" stroke-width="5"/>
    <ellipse cx="660" cy="316" rx="62" ry="46" fill="#7aa585" stroke="${INK}" stroke-width="4"/>
    <circle cx="700" cy="300" r="3.5" fill="${INK}"/><circle cx="712" cy="306" r="3.5" fill="${INK}"/>
    ${eyes}${mouth}
    <ellipse cx="596" cy="300" rx="14" ry="7" fill="#e88f86" opacity="0.55"/>
    ${expr === 'serious' ? `<path d="M540 225 Q 530 245 540 252 Q 550 245 540 225 Z" fill="#bfe6f5" stroke="${INK}" stroke-width="2.5"/>` : ''}
    ${extra}
  </g>`;
}

function arm(hx, hy) {
  return `<path d="M672 410 Q ${(672 + hx) / 2 + 20} ${(410 + hy) / 2 + 10} ${hx} ${hy}" stroke="${INK}" stroke-width="36" stroke-linecap="round" fill="none"/>
    <path d="M672 410 Q ${(672 + hx) / 2 + 20} ${(410 + hy) / 2 + 10} ${hx} ${hy}" stroke="${SKIN}" stroke-width="27" stroke-linecap="round" fill="none"/>
    <circle cx="${hx}" cy="${hy}" r="27" fill="${SKIN}" stroke="${INK}" stroke-width="5"/>
    <path d="M${hx - 18} ${hy - 6} q 18 -9 36 1" stroke="${INK}" stroke-width="3" fill="none"/>`;
}

// car drawn between two points (foreshortened by scaling length)
function carBetween(ax, ay, bx, by, opts = {}) {
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx) * 180 / Math.PI;
  const sx = Math.max(len / 160, 0.22);
  const sy = opts.sy || 1;
  return `<use href="#car" transform="translate(${(ax + bx) / 2} ${(ay + by) / 2}) rotate(${ang}) scale(${sx} ${sy})" opacity="${opts.op ?? 1}" ${opts.filter ? `filter="${opts.filter}"` : ''}/>`;
}

function cityBackground() {
  return `
  <rect width="1200" height="750" fill="url(#sky)"/>
  <g fill="#fff" opacity="0.8"><ellipse cx="190" cy="120" rx="90" ry="26"/><ellipse cx="250" cy="105" rx="60" ry="22"/><ellipse cx="1040" cy="90" rx="80" ry="22"/></g>
  <g filter="url(#blurFar)" fill="#8fa3ad">
    <rect x="0" y="390" width="70" height="90"/><rect x="80" y="350" width="55" height="130"/><rect x="145" y="400" width="80" height="80"/>
    <rect x="240" y="330" width="50" height="150"/><rect x="300" y="380" width="90" height="100"/><rect x="820" y="370" width="70" height="110"/>
    <rect x="900" y="340" width="50" height="140"/><rect x="960" y="395" width="90" height="85"/><rect x="1060" y="355" width="60" height="125"/>
    <rect x="1130" y="400" width="70" height="80"/><path d="M1000 380 L1012 250 L1024 380 Z" fill="#c9754f"/>
  </g>
  <rect x="0" y="470" width="1200" height="280" fill="url(#ground)"/>
  <path d="M0 540 L1200 520 L1200 560 L0 585 Z" fill="#8a8572"/>
  <path d="M0 640 L1200 600" stroke="#6b5a48" stroke-width="18"/>
  <path d="M0 634 L1200 594" stroke="#c9c2b0" stroke-width="3"/><path d="M0 646 L1200 606" stroke="#c9c2b0" stroke-width="3"/>
  <g stroke="#555" stroke-width="5"><line x1="150" y1="628" x2="150" y2="555"/><line x1="1060" y1="598" x2="1060" y2="525"/><line x1="880" y1="604" x2="905" y2="545"/></g>
  <g stroke="${INK}" stroke-width="2">
    <rect x="60" y="470" width="60" height="70" fill="#e7d9b8"/><rect x="130" y="450" width="45" height="90" fill="#c8d6d9"/>
    <rect x="980" y="455" width="55" height="75" fill="#e7d9b8"/><rect x="1045" y="440" width="40" height="90" fill="#d9c3c0"/>
  </g>`;
}

function foreground() {
  return `<g filter="url(#blurNear)"><rect x="-20" y="690" width="1240" height="80" fill="#8c8670"/>
    <rect x="40" y="660" width="120" height="100" fill="#d9cfb4"/><rect x="980" y="655" width="150" height="110" fill="#c8d0cf"/></g>`;
}

function telop(kind, line1, line2) {
  const live = kind === 'live';
  return `<g font-family="${FONT}">
    <rect x="0" y="672" width="1200" height="78" fill="#0f2a4a" opacity="0.92"/>
    <rect x="0" y="672" width="128" height="78" fill="${live ? '#d33a2c' : '#3a6fb0'}"/>
    <text x="64" y="722" font-size="30" fill="#fff" font-weight="bold" text-anchor="middle">${live ? '速報' : '中継'}</text>
    <text x="150" y="706" font-size="22" fill="#fff">${line1}</text>
    <text x="150" y="738" font-size="20" fill="#ffd34d">${line2}</text>
  </g>
  <g font-family="${FONT}"><rect x="22" y="22" width="92" height="36" rx="4" fill="#d33a2c"/>
    <text x="68" y="48" font-size="22" fill="#fff" font-weight="bold" text-anchor="middle">LIVE</text></g>`;
}

function sfx(x, y, text, size = 46, rot = -12) {
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-weight="bold" font-size="${size}" fill="#fff" stroke="${INK}" stroke-width="6" paint-order="stroke" transform="rotate(${rot} ${x} ${y})">${text}</text>`;
}

function star(cx, cy, r, fill = '#ffe066') {
  let d = '';
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8, rr = i % 2 ? r * 0.45 : r;
    d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(1) + ' ' + (cy + rr * Math.sin(a)).toFixed(1);
  }
  return `<path d="${d}Z" fill="${fill}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
}

const svg = (inner, shake = [0, 0]) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 750" width="600" height="375">${defs}
   <g transform="translate(${shake[0]} ${shake[1]})">${inner}</g></svg>`;

// ---------- nunchaku geometry ----------
function nunchakuParts(th, opts = {}) {
  const hx = 735 + 35 * Math.cos(th), hy = 320 + 25 * Math.sin(th);
  const ux = Math.cos(th), uy = 0.4 * Math.sin(th);
  const front = Math.sin(th) > -0.05;
  const held = carBetween(hx - 10 * ux, hy - 10 * uy, hx + 150 * ux, hy + 150 * uy);
  const tipx = hx + 150 * ux, tipy = hy + 150 * uy;
  const ax = hx + 195 * ux, ay = hy + 195 * uy, bx = hx + 355 * ux, by = hy + 355 * uy;
  const chain = `<path d="M${tipx} ${tipy} Q ${(tipx + ax) / 2} ${(tipy + ay) / 2 + 12} ${ax} ${ay}" stroke="${INK}" stroke-width="9" fill="none" stroke-dasharray="9 6" stroke-linecap="round"/>`;
  const free = carBetween(ax, ay, bx, by, front ? {} : { op: 0.9, sy: 0.85 });
  let ghosts = '';
  if (opts.ghosts !== false) {
    for (const [k, op] of [[0.35, 0.3], [0.7, 0.14]]) {
      const t2 = th - k, u2x = Math.cos(t2), u2y = 0.4 * Math.sin(t2);
      const h2x = 735 + 35 * Math.cos(t2), h2y = 320 + 25 * Math.sin(t2);
      ghosts += carBetween(h2x + 195 * u2x, h2y + 195 * u2y, h2x + 355 * u2x, h2y + 355 * u2y, { op });
    }
  }
  return { hx, hy, held, chain, free, ghosts, front, ax, ay, bx, by };
}

function nunchakuFrame(th, expr = 'serious', o = {}) {
  const p = nunchakuParts(th, o);
  const far = p.front ? '' : p.ghosts + p.free + p.chain;
  const near = p.front ? p.ghosts + p.chain + p.free : '';
  const swish = o.swish ? sfx(1020, 230, 'ぶぉん') : '';
  return { p, body: cityBackground() + far + kaijuBody + p.held + arm(p.hx, p.hy) + head(expr, o.tilt || 0) + near + swish };
}


const scenes = {};
// ---------- martial-arts nunchaku kata (2D, screen plane) ----------
const D2R = Math.PI / 180;
const dirv = a => [Math.cos(a * D2R), Math.sin(a * D2R)];
const easeOut = t => 1 - (1 - t) * (1 - t);
const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

// keyframes: f, hand x/y, psi = handle angle, phi = free-car angle (deg, may exceed 360 for spins)
function makeTrack(keys) {
  return f => {
    let i = 0;
    while (i < keys.length - 1 && keys[i + 1].f <= f) i++;
    const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
    if (a === b || f <= a.f) return { ...a };
    const t0 = (f - a.f) / (b.f - a.f);
    const t = (b.ease || easeInOut)(Math.min(1, Math.max(0, t0)));
    const L = (k) => a[k] + (b[k] - a[k]) * t;
    return { hx: L('hx'), hy: L('hy'), psi: L('psi'), phi: L('phi'), behind: !!((a.behind && b.behind) || (b.behind && t0 > 0.6) || (a.behind && t0 < 0.4)) };
  };
}

function kataGeom(st) {
  const [dx, dy] = dirv(st.psi);
  const tx = st.hx + 150 * dx, ty = st.hy + 150 * dy;
  const [fx, fy] = dirv(st.phi);
  return {
    held: carBetween(st.hx - 12 * dx, st.hy - 12 * dy, tx, ty),
    tx, ty,
    ax: tx + 38 * fx, ay: ty + 38 * fy, bx: tx + 198 * fx, by: ty + 198 * fy,
  };
}

function kataLayers(track, f, opts = {}) {
  const st = track(f);
  const g = kataGeom(st);
  const chain = `<path d="M${g.tx} ${g.ty} L ${g.ax} ${g.ay}" stroke="${INK}" stroke-width="9" fill="none" stroke-dasharray="8 6" stroke-linecap="round"/>`;
  const free = carBetween(g.ax, g.ay, g.bx, g.by);
  let ghosts = '';
  if (opts.ghosts !== false) {
    for (const [k, op] of [[0.5, 0.32], [1.0, 0.16]]) {
      if (f - k < 0) continue;
      const s2 = track(f - k);
      if (Math.abs(((s2.phi - st.phi) % 360)) < 12) continue; // only when moving fast
      const g2 = kataGeom(s2);
      ghosts += carBetween(g2.ax, g2.ay, g2.bx, g2.by, { op });
    }
  }
  const nun = ghosts + chain + free;
  return { st, g, nun };
}

const KATA_KEYS = [
  { f: 0, hx: 760, hy: 300, psi: -70, phi: -100 },
  { f: 7, hx: 770, hy: 300, psi: -75, phi: -150 },                 // kamae (wind-up)
  { f: 11, hx: 700, hy: 470, psi: 150, phi: 165, ease: easeOut },   // diagonal strike: upper-right -> lower-left
  { f: 14, hx: 700, hy: 470, psi: 150, phi: 165 },                  // hitstop
  { f: 22, hx: 648, hy: 430, psi: 165, phi: 95 },                   // armpit catch
  { f: 32, hx: 648, hy: 430, psi: 165, phi: 95 },                   // hold
  { f: 38, hx: 730, hy: 285, psi: -90, phi: 95 },                   // lift overhead
  { f: 50, hx: 730, hy: 285, psi: -90, phi: -625, ease: t => t },   // overhead spins
  { f: 56, hx: 700, hy: 335, psi: -55, phi: -930, ease: easeOut, behind: true }, // over-the-shoulder catch
  { f: 74, hx: 700, hy: 335, psi: -55, phi: -930, behind: true },  // hold pose
  { f: 82, hx: 760, hy: 300, psi: -70, phi: -1180 },                // back to start
];

function kataKaiju(track, f, extra = {}) {
  const { st, nun } = kataLayers(track, f, extra);
  const behind = st.behind;
  return (behind ? nun : '') + kaijuBody + arm(st.hx, st.hy) +
    head(extra.expr || 'serious', extra.tilt || 0) + (behind ? '' : nun) +
    kataGeom(st).held + `<circle cx="${st.hx}" cy="${st.hy}" r="27" fill="${SKIN}" stroke="${INK}" stroke-width="5"/>`;
}
function kataFrame(track, f, extra = {}) {
  return cityBackground() + (extra.cracks || '') + kataKaiju(track, f, extra);
}
const mirror = (inner) => `<g transform="translate(1200 0) scale(-1 1)">${inner}</g>`;

const slamCracks = `<g stroke="${INK}" stroke-width="3" fill="none"><path d="M360 600 l-25 18 l-20 -6"/><path d="M400 598 l18 22 l25 2"/><path d="M380 603 l-4 28"/></g>
  <g fill="#efeadf" stroke="#c9c2b0"><rect x="330" y="585" width="14" height="9"/><rect x="420" y="590" width="10" height="8"/></g>`;
const dust = (k) => `<g fill="#e8e1cf" opacity="${0.9 - k * 0.12}">
  <ellipse cx="${380 - k * 14}" cy="${600 - k * 4}" rx="${30 + k * 10}" ry="${16 + k * 4}"/>
  <ellipse cx="${430 + k * 12}" cy="${598 - k * 5}" rx="${24 + k * 8}" ry="${14 + k * 3}"/></g>`;

scenes.nunchaku_kata_onesided = () => {
  const track = makeTrack(KATA_KEYS);
  const frames = [];
  const tl = (f) => telop('relay', '怪獣、電車ヌンチャクの型を披露', `被害額　¥${(4820316000 + Math.max(0, f - 10) * 21000000).toLocaleString()}`);
  for (let f = 0; f < 82; f++) {
    let extra = '', sh = [0, 0];
    const cracks = f >= 11 ? slamCracks : '';
    if (f >= 11 && f < 14) sh = [[12, -6], [-9, 5], [5, -2]][f - 11];
    if (f >= 11 && f < 19) extra += dust(f - 11);
    if (f >= 11 && f < 18) extra += sfx(250, 520, 'ズドン', 56, -6);
    if (f >= 22 && f < 32) extra += sfx(760, 250, 'フッ', 44, 0);
    if (f >= 38 && f < 56) extra += sfx(900, 150, 'ヒュンヒュン', 40, -10);
    if (f >= 56 && f < 74) extra += sfx(860, 260, 'アチョー', 56, -8) + `<g fill="#fff6a8">${star(560, 250, 14, '#fff6a8')}</g>`;
    if (f >= 3 && f < 8) extra += sfx(860, 200, 'スッ', 36, 0);
    frames.push(svg(kataFrame(track, f, { cracks }) + extra + foreground() + tl(f), sh));
  }
  return frames;
};


// both sides: right-handed form -> switch hands (turn) -> mirrored form -> final pose
scenes.nunchaku_kata = () => {
  const R = makeTrack(KATA_KEYS.slice(0, 6));          // f0..32 right-handed, ends in armpit catch
  const L = makeTrack([
    { f: 36, hx: 648, hy: 430, psi: 165, phi: 95 },
    { f: 43, hx: 770, hy: 300, psi: -75, phi: -150 },
    { f: 47, hx: 700, hy: 470, psi: 150, phi: 165, ease: easeOut },
    { f: 50, hx: 700, hy: 470, psi: 150, phi: 165 },
    { f: 58, hx: 648, hy: 430, psi: 165, phi: 95 },
    { f: 63, hx: 648, hy: 430, psi: 165, phi: 95 },
    { f: 69, hx: 730, hy: 285, psi: -90, phi: 95 },
    { f: 81, hx: 730, hy: 285, psi: -90, phi: -625, ease: t => t },
    { f: 87, hx: 700, hy: 335, psi: -55, phi: -930, ease: easeOut, behind: true },
    { f: 112, hx: 700, hy: 335, psi: -55, phi: -930, behind: true },
  ]);
  const frames = [];
  const tl = (f) => telop('relay', '怪獣、電車ヌンチャクの型を披露', `被害額　¥${(4820316000 + Math.max(0, f - 10) * 21000000).toLocaleString()}`);
  const cracksR = slamCracks, cracksL = mirror(slamCracks);
  for (let f = 0; f < 112; f++) {
    let extra = '', sh = [0, 0];
    const cracks = (f >= 11 ? cracksR : '') + (f >= 47 ? cracksL : '');
    let kaiju;
    if (f < 34) kaiju = kataKaiju(R, Math.min(f, 32));
    else kaiju = mirror(kataKaiju(L, Math.max(f, 36)));
    // right-handed form
    if (f >= 3 && f < 8) extra += sfx(860, 200, 'スッ', 36, 0);
    if (f >= 11 && f < 14) sh = [[12, -6], [-9, 5], [5, -2]][f - 11];
    if (f >= 11 && f < 19) extra += dust(f - 11);
    if (f >= 11 && f < 18) extra += sfx(250, 520, 'ズドン', 56, -6);
    if (f >= 22 && f < 31) extra += sfx(760, 250, 'フッ', 44, 0);
    // switch hands
    if (f >= 31 && f < 38) extra += sfx(560, 150, '持ち替え', 40, 0) + sfx(780, 300, 'クルッ', 44, 8);
    // mirrored form
    if (f >= 39 && f < 44) extra += sfx(200, 200, 'スッ', 36, 0);
    if (f >= 47 && f < 50) sh = [[-12, -6], [9, 5], [-5, -2]][f - 47];
    if (f >= 47 && f < 55) extra += mirror(dust(f - 47));
    if (f >= 47 && f < 54) extra += sfx(800, 520, 'ズドン', 56, 6);
    if (f >= 58 && f < 63) extra += sfx(300, 250, 'フッ', 44, 0);
    if (f >= 69 && f < 87) extra += sfx(120, 150, 'ヒュンヒュン', 40, 10);
    // final pose
    if (f >= 87) extra += sfx(110, 270, 'アチョー', 64, 8) + star(640, 250, 16, '#fff6a8');
    if (f >= 92) extra += `<g font-family="${FONT}"><rect x="420" y="70" width="360" height="56" rx="6" fill="#fff" stroke="${INK}" stroke-width="4"/>
      <text x="600" y="110" font-size="32" font-weight="bold" fill="${INK}" text-anchor="middle">型、完了。</text></g>`;
    frames.push(svg(cityBackground() + cracks + kaiju + extra + foreground() + tl(f), sh));
  }
  return frames;
};

// failure: the rebound after the strike swings back up into its own head
scenes.nunchaku_kata_fail = () => {
  const keys = KATA_KEYS.slice(0, 4).concat([
    { f: 19, hx: 700, hy: 470, psi: 150, phi: 268, ease: t => t * t },   // rebound swings up the left side...
  ]);
  const track = makeTrack(keys);
  const frames = [];
  const tlOK = () => telop('relay', '怪獣、電車ヌンチャクの型を披露', '被害額　¥4,820,316,000');
  for (let f = 0; f < 19; f++) {
    let extra = '', sh = [0, 0];
    const cracks = f >= 11 ? slamCracks : '';
    if (f >= 11 && f < 14) sh = [[12, -6], [-9, 5], [5, -2]][f - 11];
    if (f >= 11 && f < 19) extra += dust(f - 11);
    if (f >= 11 && f < 17) extra += sfx(250, 520, 'ズドン', 56, -6);
    if (f >= 3 && f < 8) extra += sfx(860, 200, 'スッ', 36, 0);
    frames.push(svg(kataFrame(track, f, { cracks }) + extra + foreground() + tlOK(), sh));
  }
  // ...and hits its own head: hitstop + shake
  for (let k = 0; k < 6; k++) {
    const sh = [[14, -6], [-12, 8], [9, -4], [-6, 3], [3, -1], [0, 0]][k];
    frames.push(svg(kataFrame(track, 19, { cracks: slamCracks, expr: 'dizzy', tilt: -10, ghosts: false }) +
      star(560, 290, 70 - k * 6) + sfx(330, 230, 'ゴンッ', 64, -8) + foreground() + tlOK(), sh));
  }
  // chain snaps, the car flies off to the next prefecture
  const hx = 770, hy = 400;
  const heldOnly = () => carBetween(hx - 5, hy - 10, hx + 40, hy + 150);
  for (let k = 0; k < 14; k++) {
    const t = k / 13;
    const x = 560 + (150 - 560) * t, y = 330 + (395 - 330) * t - 260 * Math.sin(Math.PI * t);
    const flying = `<use href="#car" transform="translate(${x} ${y}) rotate(${k * 47}) scale(${1 - 0.85 * t})"/>`;
    const dizzyStars = [0, 1, 2].map(i => star(600 + 70 * Math.cos(k * 0.6 + i * 2.1), 200 + 18 * Math.sin(k * 0.6 + i * 2.1), 12)).join('');
    frames.push(svg(cityBackground() + slamCracks + kaijuBody + heldOnly() + arm(hx, hy) + head('dizzy', -6 + 4 * Math.sin(k)) + dizzyStars + flying +
      (k < 6 ? sfx(250, 160, 'ひゅ〜', 40, -20) : '') + foreground() + tlOK()));
  }
  for (let k = 0; k < 34; k++) {
    const r = Math.min(k, 10);
    const boom = k < 22 ? `<circle cx="140" cy="380" r="${10 + r * 9}" fill="#ffd34d" opacity="${Math.max(0, 0.9 - k * 0.05)}"/>
      <circle cx="140" cy="380" r="${6 + r * 6}" fill="#ff8a3d" opacity="${Math.max(0, 0.9 - k * 0.05)}"/>` : '';
    const smoke = `<g fill="#6d6d6d" opacity="${Math.min(0.85, k * 0.08)}"><circle cx="130" cy="${360 - k * 3}" r="${20 + k * 1.2}"/>
      <circle cx="160" cy="${340 - k * 3.5}" r="${16 + k}"/><circle cx="115" cy="${330 - k * 4}" r="${14 + k * 0.9}"/></g>`;
    const news = k < 8 ? tlOK() : telop('live', '型の途中で車両がすっぽ抜け隣県に落下　3県で停電', '被害額　¥4,820,316,000 → ¥16,950,000,000');
    frames.push(svg(cityBackground() + slamCracks + boom + smoke + kaijuBody + heldOnly() + arm(hx, hy) + head(k < 8 ? 'dizzy' : 'surprised') +
      (k >= 8 ? sfx(760, 230, 'あ', 60, 0) : '') + (k < 10 ? sfx(60, 300, 'ドーン', 40, -6) : '') + foreground() + news));
  }
  return frames;
};

// ---------- scenes ----------

// 1) success loop: 3 spins
scenes.nunchaku = () => {
  const frames = [];
  const N = 45;
  for (let f = 0; f < N; f++) {
    const th = f * (2 * Math.PI / 15);
    const { body } = nunchakuFrame(th, 'serious', { swish: (f % 15) < 7 });
    frames.push(svg(body + foreground() + telop('relay', '怪獣、電車をヌンチャクにしてトレーニング中', `被害額　¥${(4820316000 + f * 18000000).toLocaleString()}`)));
  }
  return frames;
};

// 2) failure: hits own head, car flies to the next prefecture
scenes.nunchaku_fail = () => {
  const frames = [];
  const step = 2 * Math.PI / 15;
  const hitTh = Math.PI - 0.35;
  const SPIN = 30;
  const telopOK = () => telop('relay', '怪獣、電車をヌンチャクにしてトレーニング中', '被害額　¥4,820,316,000');
  for (let f = 0; f < SPIN; f++) {
    const th = hitTh - (SPIN - f) * step;
    const { body } = nunchakuFrame(th, 'serious', { swish: (f % 15) < 7 });
    frames.push(svg(body + foreground() + telopOK()));
  }
  // hitstop + shake
  for (let k = 0; k < 5; k++) {
    const { body, p } = nunchakuFrame(hitTh, 'dizzy', { ghosts: false, tilt: -10 });
    const sh = [[14, -6], [-12, 8], [9, -4], [-6, 3], [2, -1]][k];
    frames.push(svg(body + star(545, 255, 70 - k * 6) + sfx(380, 200, 'ゴンッ', 64, -8) + foreground() + telopOK(), sh));
  }
  // car flies off (chain snapped)
  const startX = 470, startY = 300, endX = 150, endY = 395;
  for (let k = 0; k < 14; k++) {
    const t = k / 13;
    const x = startX + (endX - startX) * t, y = startY + (endY - startY) * t - 260 * Math.sin(Math.PI * t);
    const s = 1 - 0.85 * t;
    const hx = 770, hy = 400;
    const heldOnly = carBetween(hx - 5, hy - 10, hx + 40, hy + 150);
    const flying = `<use href="#car" transform="translate(${x} ${y}) rotate(${k * 47}) scale(${s})"/>`;
    const dizzyStars = [0, 1, 2].map(i => star(600 + 70 * Math.cos(k * 0.6 + i * 2.1), 200 + 18 * Math.sin(k * 0.6 + i * 2.1), 12)).join('');
    frames.push(svg(cityBackground() + kaijuBody + heldOnly + arm(hx, hy) + head('dizzy', -6 + 4 * Math.sin(k)) + dizzyStars + flying +
      (k < 6 ? sfx(250, 160, 'ひゅ〜', 40, -20) : '') + foreground() + telopOK()));
  }
  // distant explosion, then "a" face + breaking news
  for (let k = 0; k < 34; k++) {
    const hx = 770, hy = 400;
    const heldOnly = carBetween(hx - 5, hy - 10, hx + 40, hy + 150);
    const r = Math.min(k, 10);
    const boom = k < 22 ? `
      <circle cx="140" cy="380" r="${10 + r * 9}" fill="#ffd34d" opacity="${Math.max(0, 0.9 - k * 0.05)}"/>
      <circle cx="140" cy="380" r="${6 + r * 6}" fill="#ff8a3d" opacity="${Math.max(0, 0.9 - k * 0.05)}"/>` : '';
    const smoke = `<g fill="#6d6d6d" opacity="${Math.min(0.85, k * 0.08)}">
      <circle cx="${130}" cy="${360 - k * 3}" r="${20 + k * 1.2}"/><circle cx="${160}" cy="${340 - k * 3.5}" r="${16 + k}"/><circle cx="${115}" cy="${330 - k * 4}" r="${14 + k * 0.9}"/></g>`;
    const news = k < 8 ? telopOK() : telop('live', 'すっぽ抜けた車両が隣県に落下　変電所が停止し3県で停電', '被害額　¥4,820,316,000 → ¥16,950,000,000');
    frames.push(svg(cityBackground() + boom + smoke + kaijuBody + heldOnly + arm(hx, hy) + head(k < 8 ? 'dizzy' : 'surprised') +
      (k >= 8 ? sfx(760, 230, 'あ', 60, 0) : '') + (k < 10 ? sfx(60, 300, 'ドーン', 40, -6) : '') + foreground() + news));
  }
  return frames;
};

// 3) dam: flip turn breaks the dam, kaiju washed downstream
function damBackground(level, broken, flood) {
  // level: reservoir surface y, broken: 0..1 wall destruction, flood: 0..1 downstream water
  const wallTop = 300;
  const wall = broken < 0.05
    ? `<path d="M820 ${wallTop} L860 ${wallTop} L900 600 L820 600 Z" fill="#c8c6bd" stroke="${INK}" stroke-width="4"/>
       <g stroke="#a9a69b" stroke-width="2">${[340, 380, 420, 460, 500, 540].map(y => `<line x1="822" y1="${y}" x2="${862 + (y - 300) * 0.13}" y2="${y}"/>`).join('')}</g>`
    : `<path d="M820 ${wallTop} L845 ${wallTop} L838 ${wallTop + 80 + 60 * broken} L820 ${wallTop + 120} Z" fill="#c8c6bd" stroke="${INK}" stroke-width="4"/>
       <path d="M820 540 L842 520 L870 545 L900 600 L820 600 Z" fill="#c8c6bd" stroke="${INK}" stroke-width="4"/>`;
  const town = [[930, 590], [990, 600], [1050, 588], [1110, 598], [1160, 592]]
    .map(([x, y], i) => {
      const dx = flood * (180 + i * 20), dy = -flood * 25 * Math.sin(i + flood * 6), r = flood * (30 + i * 12) * (i % 2 ? 1 : -1);
      return `<use href="#house" transform="translate(${x + dx} ${y + dy}) rotate(${r})"/>`;
    }).join('');
  const floodPoly = flood > 0
    ? `<path d="M840 ${level} C 900 ${level + 40} 960 ${560} ${1200} ${560 - flood * 40} L1200 750 L840 750 Z" fill="#4f9fc4" opacity="0.92"/>
       <g fill="#fff" opacity="0.85">${[0, 1, 2, 3, 4, 5].map(i => `<ellipse cx="${880 + i * 55 + (flood * 200 % 55)}" cy="${575 - flood * 30 + (i % 2) * 8}" rx="22" ry="8"/>`).join('')}</g>`
    : `<path d="M900 600 Q 1050 610 1200 600 L1200 615 Q 1050 625 900 615 Z" fill="#6fb3d1"/>`;
  return `
  <rect width="1200" height="750" fill="url(#sky)"/>
  <g fill="#fff" opacity="0.8"><ellipse cx="300" cy="100" rx="90" ry="24"/><ellipse cx="980" cy="80" rx="70" ry="20"/></g>
  <g filter="url(#blurFar)">
    <path d="M0 330 L160 200 L300 300 L430 180 L600 310 L760 210 L900 320 L1050 220 L1200 300 L1200 450 L0 450 Z" fill="#88a78d"/>
  </g>
  <path d="M0 420 L820 420 L820 750 L0 750 Z" fill="#7d9a6e"/>
  <path d="M860 560 L1200 560 L1200 750 L860 750 Z" fill="#a8b48a"/>
  ${town}
  <rect x="0" y="${level}" width="${broken > 0.05 ? 850 : 822}" height="${750 - level}" fill="#4f9fc4"/>
  <g stroke="#bfe6f5" stroke-width="3" opacity="0.8">${[60, 220, 380, 540, 700].map(x => `<line x1="${x}" y1="${level + 18}" x2="${x + 60}" y2="${level + 18}"/>`).join('')}</g>
  ${floodPoly}
  ${wall}`;
}

function kaijuInWater(x, y, s, rot, expr, waterY, clip = true, flipX = false) {
  const id = 'c' + Math.random().toString(36).slice(2, 8);
  const fx = flipX ? -1 : 1;
  const k = `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s * fx} ${s}) translate(-600 -450)">${kaijuBody}${head(expr)}</g>`;
  if (!clip) return k;
  return `<clipPath id="${id}"><rect x="0" y="0" width="1200" height="${waterY + 6}"/></clipPath>
    <g clip-path="url(#${id})">${k}</g>
    <g opacity="0.35"><g transform="translate(${x} ${y}) rotate(${rot}) scale(${s * fx} ${s}) translate(-600 -450)">${kaijuBody}</g></g>`;
}


const kaijuTorsoSwim = kaijuTorso
  .replace(`  <path d="M505 545 C 430 600 360 630 280 612 C 330 600 390 575 470 500 Z" fill="${SKIN}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`, '')
  .replace('<path d="M440 548 Q 412 540 418 572 Z"/><path d="M372 590 Q 350 580 352 605 Z"/>', '');
const swimTail = (w) => `<path d="M520 540 C 500 660 ${545 + w} 760 ${585 + w * 1.6} 860 C ${600 + w} 760 610 650 640 560 Z" fill="${SKIN}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
  <g fill="#e2a64c" stroke="${INK}" stroke-width="4" stroke-linejoin="round"><path d="M${520 + w * 0.3} 640 Q 495 660 ${520 + w * 0.4} 680 Z"/><path d="M${545 + w * 0.8} 730 Q 520 750 ${548 + w * 0.9} 770 Z"/></g>`;
// front crawl seen from the side: body horizontal, face down, arms windmill, breathing every 2 strokes
function swimmer(cx, cy, s, rot, beta, opts = {}) {
  // body in local coords, rotated so head points along rot (90 = to the right, face down)
  const T = `translate(${cx} ${cy}) rotate(${rot}) scale(${s}) translate(-600 -450)`;
  // shoulder position in screen coords
  const a = rot * D2R;
  const lx = 672 - 600, ly = 410 - 450;
  const sx = cx + s * (lx * Math.cos(a) - ly * Math.sin(a)), sy = cy + s * (lx * Math.sin(a) + ly * Math.cos(a));
  const R = 120 * s;
  const handAt = (b) => [sx + R * Math.cos(b * D2R), sy + R * Math.sin(b * D2R)];
  const armPath = (b, col, w) => { const [hx, hy] = handAt(b);
    return `<path d="M${sx} ${sy} L${hx} ${hy}" stroke="${INK}" stroke-width="${w + 8}" stroke-linecap="round"/>
            <path d="M${sx} ${sy} L${hx} ${hy}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>
            <circle cx="${hx}" cy="${hy}" r="${w * 0.75}" fill="${col}" stroke="${INK}" stroke-width="4"/>`; };
  const far = armPath(beta + 180, '#5c8466', 30 * s * 1.6);
  const near = armPath(beta, SKIN, 34 * s * 1.6);
  const breathe = opts.breathe || 0;
  const body = `<g transform="${T}">${swimTail(opts.wag || 0)}${kaijuTorsoSwim}${head(opts.expr || 'serious', -40 * breathe)}</g>`;
  return { far, body, near, hand: handAt(beta) };
}

function waterClip(inner, waterY) {
  const id = 'w' + Math.random().toString(36).slice(2, 8);
  return `<clipPath id="${id}"><rect x="0" y="0" width="1200" height="${waterY + 4}"/></clipPath>
    <g opacity="0.33">${inner}</g><g clip-path="url(#${id})">${inner}</g>`;
}

scenes.dam_fail = () => {
  const frames = [];
  const LV = 420;
  const tOK = () => telop('relay', '怪獣、ダム湖で本格クロール（フォーム重視）', '被害額　¥0（いまのところ）');
  // crawl toward the dam: 3 strokes cycles, breathing on every 2nd stroke
  const SW = 44;
  for (let f = 0; f < SW; f++) {
    const x = 170 + f * 10.5;
    const beta = 180 + f * (360 / 14);              // windmill (clockwise: back -> over -> forward -> pull)
    const strokeIdx = Math.floor(f / 14);
    const ph = (f % 14) / 14;
    const breathe = (strokeIdx % 2 === 1 && ph > 0.15 && ph < 0.6) ? Math.sin((ph - 0.15) / 0.45 * Math.PI) : 0;
    const sw = swimmer(x, LV + 2 + 4 * Math.sin(f * 0.9), 0.5, 90, beta, { breathe, wag: 25 * Math.sin(f * 1.3) });
    const kick = `<g fill="#fff" opacity="0.9">
      <ellipse cx="${x - 175}" cy="${LV - 4 - 8 * Math.abs(Math.sin(f * 1.3))}" rx="${16 + 6 * Math.sin(f * 1.3)}" ry="8"/>
      <ellipse cx="${x - 150}" cy="${LV - 2 - 6 * Math.abs(Math.cos(f * 1.3))}" rx="12" ry="6"/></g>`;
    const [hx, hy] = sw.hand;
    const entry = (hy > LV - 10 && hy < LV + 30 && hx > x) ? `<ellipse cx="${hx}" cy="${LV}" rx="26" ry="9" fill="#fff" opacity="0.95"/>` : '';
    let extra = '';
    if (entry) extra += sfx(hx - 30, LV - 50, 'バシャ', 32, -6);
    if (breathe > 0.6) extra += sfx(x + 40, LV - 90, 'ぷはっ', 34, 0);
    frames.push(svg(damBackground(LV, 0, 0) + waterClip(sw.far + sw.body + sw.near, LV) + kick + entry + extra + tOK()));
  }
  // flip turn: tuck and somersault, feet to the wall
  for (let k = 0; k < 10; k++) {
    const t = k / 9;
    const rot = 90 + 180 * easeInOut(t);
    const x = 640 + 70 * t, y = LV + 22 + 70 * Math.sin(Math.PI * Math.min(1, t * 1.1));
    const sw = swimmer(x, y, 0.5, rot, 200 + k * 10, {});
    const bubbles = `<g fill="#dff3fb" stroke="#9fd0e3" stroke-width="2">${[0, 1, 2].map(i => `<circle cx="${x - 30 + i * 25}" cy="${LV + 10 - i * 8 - k * 2}" r="${5 + i}"/>`).join('')}</g>`;
    frames.push(svg(damBackground(LV, 0, 0) + waterClip(sw.far + sw.body + sw.near, LV) + bubbles +
      (k > 2 ? sfx(520, LV - 70, 'クイックターン', 36, -4) : '') + tOK()));
  }
  // push off: feet kick the wall
  for (let k = 0; k < 6; k++) {
    const sh = k < 4 ? [[12, -5], [-10, 6], [7, -3], [-4, 2]][k] : [0, 0];
    const sw = swimmer(700 - k * 4, LV + 92, 0.5, 270, 330, {});
    frames.push(svg(damBackground(LV, 0, 0) + waterClip(sw.far + sw.body + sw.near, LV) +
      star(822, LV + 95, 60 - k * 5) + sfx(600, 360, 'ドンッ', 60, -6) + tOK(), sh));
  }
  // cracks
  for (let k = 0; k < 10; k++) {
    const cr = `<g stroke="${INK}" stroke-width="3" fill="none">
      <path d="M840 300 L850 360 L835 410 L858 470 L845 ${520 + k * 4}"/>
      ${k > 3 ? '<path d="M850 360 L875 380"/><path d="M835 410 L822 440"/>' : ''}</g>
      ${k > 5 ? `<path d="M862 ${400 + (k - 6) * 5} q 18 10 30 30" stroke="#bfe6f5" stroke-width="6" fill="none"/>` : ''}`;
    const sw = swimmer(640, LV + 30, 0.5, 220 - k * 4, 330, { expr: k > 4 ? 'surprised' : 'serious' });
    frames.push(svg(damBackground(LV, 0, 0) + waterClip(sw.far + sw.body + sw.near, LV) + cr +
      (k > 4 ? sfx(520, 280, 'ピシッ…', 42, -4) : '') + tOK()));
  }
  // burst: washed away (unchanged idea, tumbling)
  for (let k = 0; k < 40; k++) {
    const t = k / 39;
    const lv = LV + 150 * Math.min(1, t * 1.6);
    const flood = Math.min(1, t * 1.4);
    const kx = 760 + 330 * t, ky = 470 + 70 * t - 30 * Math.sin(t * 9);
    const dmg = Math.round(873 * Math.min(1, t * 1.3)) * 100000000;
    const news = k < 10 ? tOK() : telop('live', 'ダム決壊　怪獣ごと下流へ　流域に避難指示', `被害額　¥${dmg.toLocaleString()}`);
    const debris = [0, 1, 2, 3].map(i => `<rect x="${860 + i * 30 + t * 300 * (1 + i * 0.3)}" y="${330 + i * 40 + t * 200}" width="26" height="18" fill="#c8c6bd" stroke="${INK}" stroke-width="3" transform="rotate(${k * 20 + i * 40} ${873 + i * 30 + t * 300} ${339 + i * 40 + t * 200})"/>`).join('');
    frames.push(svg(damBackground(lv, 1, flood) + debris + kaijuInWater(kx, ky, 0.5, k * 22, 'surprised', 0, false) +
      (k < 14 ? sfx(900, 260, 'ドドドド', 48, -8) : sfx(Math.min(kx - 80, 1050), ky - 120, 'あ〜', 50, 0)) + news));
  }
  return frames;
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 600, height: 375 } });
  for (const [name, fn] of Object.entries(scenes)) {
    if (ONLY && ONLY !== name) continue;
    const dir = path.join(OUT, name);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const frames = fn();
    for (let i = 0; i < frames.length; i++) {
      await page.setContent(`<html><body style="margin:0;overflow:hidden">${frames[i]}</body></html>`);
      await page.screenshot({ path: path.join(dir, String(i).padStart(3, '0') + '.png') });
    }
    console.log(name, frames.length);
  }
  await b.close();
})();
