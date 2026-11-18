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
const kaijuBody = `
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
  <path d="M520 420 Q 490 460 508 490" stroke="${INK}" stroke-width="30" stroke-linecap="round" fill="none"/>
  <path d="M520 420 Q 490 460 508 490" stroke="#628b6d" stroke-width="22" stroke-linecap="round" fill="none"/>`;

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

// ---------- scenes ----------
const scenes = {};

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

scenes.dam_fail = () => {
  const frames = [];
  const LV = 420;
  const tOK = () => telop('relay', '怪獣、ダム湖で水泳トレーニング中', '被害額　¥0（いまのところ）');
  // swim toward the dam
  for (let f = 0; f < 26; f++) {
    const x = 180 + f * 20, bob = 6 * Math.sin(f * 0.9);
    const splash = `<g fill="#fff" opacity="0.9"><ellipse cx="${x - 120}" cy="${LV + 2}" rx="${18 + 6 * Math.sin(f)}" ry="8"/><ellipse cx="${x - 60}" cy="${LV + 4}" rx="14" ry="6"/></g>`;
    frames.push(svg(damBackground(LV, 0, 0) + kaijuInWater(x, LV + 90 + bob, 0.55, 8, 'serious', LV) + splash +
      (f % 8 < 4 ? sfx(x - 200, LV - 40, 'ざぶ', 34, -6) : '') + tOK()));
  }
  // flip turn: kick the wall
  for (let k = 0; k < 6; k++) {
    const sh = k < 4 ? [[12, -5], [-10, 6], [7, -3], [-4, 2]][k] : [0, 0];
    frames.push(svg(damBackground(LV, 0, 0) +
      kaijuInWater(700, LV + 70, 0.55, 80, 'serious', LV, false, true) +
      `<rect x="0" y="${LV}" width="822" height="330" fill="#4f9fc4" opacity="0.55"/>` +
      star(825, 520, 60 - k * 5) + sfx(640, 360, 'ドンッ', 60, -6) + tOK(), sh));
  }
  // cracks
  for (let k = 0; k < 10; k++) {
    const cr = `<g stroke="${INK}" stroke-width="3" fill="none">
      <path d="M840 300 L850 360 L835 410 L858 470 L845 ${520 + k * 4}"/>
      ${k > 3 ? '<path d="M850 360 L875 380"/><path d="M835 410 L822 440"/>' : ''}</g>
      ${k > 5 ? `<path d="M862 ${400 + (k - 6) * 5} q 18 10 30 30" stroke="#bfe6f5" stroke-width="6" fill="none"/>` : ''}`;
    frames.push(svg(damBackground(LV, 0, 0) + kaijuInWater(700, LV + 60, 0.55, 0, k > 4 ? 'surprised' : 'serious', LV) + cr +
      (k > 4 ? sfx(560, 280, 'ピシッ…', 42, -4) : '') + tOK()));
  }
  // burst: washed away
  for (let k = 0; k < 40; k++) {
    const t = k / 39;
    const lv = LV + 150 * Math.min(1, t * 1.6);
    const flood = Math.min(1, t * 1.4);
    const kx = 760 + 330 * t, ky = 470 + 70 * t - 30 * Math.sin(t * 9);
    const news = k < 10 ? tOK() : telop('live', 'ダム決壊　怪獣ごと下流へ　流域に避難指示', `被害額　¥${Math.round(873 * Math.min(1, t * 1.3)) * 100000000 === 0 ? 0 : (Math.round(873 * Math.min(1, t * 1.3)) * 100000000).toLocaleString()}`);
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
