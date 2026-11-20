// メダル落とし: 画面（Canvas描画・入力・HUD・ショップ）
// React に依存しない。アプリのページとスタンドアロン版の両方から mountMedalGame を呼ぶ。

import {
  buy,
  buyMedals,
  buyMedalsPrice,
  canBuy,
  caseSize,
  COIN_INFO,
  createGame,
  dropMedal,
  giveUp,
  handPerRound,
  isBad,
  newRun,
  gateWide,
  pins,
  nextKind,
  nextRound,
  part,
  PARTS,
  payRange,
  reroll,
  sellCoin,
  step,
  target,
  toSave,
  TUNING,
  type CoinKind,
  type Game,
  type GameEvent,
  type SaveData,
  type Symbol,
} from "./engine";
import { createSound, type Sound } from "./sound";

const TOP = 100; // スロット帯の高さ
const LW = TUNING.width;
const LH = TOP + TUNING.height;

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  t: number;
  life: number;
  size: number;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  life: number;
  color: string;
  size: number;
  spin: number;
}
interface Banner {
  text: string;
  sub: string;
  color: string;
  t: number;
  life: number;
}
interface Fx {
  floats: FloatText[];
  parts: Particle[];
  banner: Banner | null;
  shake: number;
  flash: number;
  hitstop: number;
  gateFlash: number;
  combo: number;
  comboTimer: number;
}

const CSS = `
.mg-root{--mg-bg:#0d0f1a;--mg-panel:#1a1f36;--mg-line:#4a4f6a;--mg-fg:#fff;--mg-muted:#9aa0bf;--mg-gold:#ffd23a;--mg-green:#59ff8f;--mg-cyan:#7dfcff;--mg-red:#ff5a6e;
  background:var(--mg-bg);color:var(--mg-fg);font-family:system-ui,"Hiragino Sans","Noto Sans JP",sans-serif;display:flex;flex-direction:column;align-items:center;gap:6px;
  touch-action:manipulation;user-select:none;-webkit-user-select:none;color-scheme:dark;box-sizing:border-box;width:100%}
.mg-root *{box-sizing:border-box}
.mg-hud{width:100%;max-width:480px;display:grid;grid-template-columns:auto 1fr auto;gap:4px 10px;align-items:center}
.mg-round{font-weight:900;font-size:13px;letter-spacing:.04em;color:var(--mg-cyan);white-space:nowrap}
.mg-score{min-width:0}
.mg-score-text{font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}
.mg-bar{height:8px;background:#2a2f48;border-radius:4px;overflow:hidden;margin-top:3px}
.mg-fill{height:100%;width:0;background:linear-gradient(90deg,var(--mg-green),var(--mg-gold));transition:width .15s}
.mg-mult{font-weight:900;font-size:20px;color:#ff7ad9;font-variant-numeric:tabular-nums;white-space:nowrap}
.mg-mult.bump,.mg-num.bump{animation:mg-bump .2s ease-out}
.mg-stats{display:flex;gap:12px;align-items:baseline;grid-column:1/3}
.mg-stat{display:flex;align-items:baseline;gap:3px;font-size:11px;color:var(--mg-muted)}
.mg-num{font-size:22px;font-weight:900;color:var(--mg-gold);font-variant-numeric:tabular-nums;display:inline-block}
.mg-num.tk{color:var(--mg-cyan)}
.mg-toggles{display:flex;gap:4px;justify-content:flex-end}
@keyframes mg-bump{from{transform:scale(1.3)}to{transform:scale(1)}}
.mg-btn{background:var(--mg-panel);color:var(--mg-fg);border:1px solid var(--mg-line);border-radius:6px;font:inherit;font-size:11px;padding:4px 8px;cursor:pointer;white-space:nowrap}
.mg-btn[aria-pressed="false"]{color:var(--mg-muted)}
.mg-btn:focus-visible,.mg-slot:focus-visible,.mg-card:focus-visible{outline:2px solid var(--mg-gold);outline-offset:2px}
.mg-btn:disabled{opacity:.4;cursor:default}
.mg-btn.primary{background:var(--mg-gold);color:#1a1300;border-color:var(--mg-gold);font-weight:900;font-size:15px;padding:10px 16px}
.mg-stage{position:relative;width:100%}
.mg-canvas{display:block;width:100%;max-width:100%;aspect-ratio:360/700;border-radius:10px;touch-action:none;cursor:pointer}
.mg-tray{width:100%;max-width:480px;display:flex;gap:6px;align-items:center;min-height:52px}
.mg-tray-label{font-size:10px;color:var(--mg-muted);line-height:1.3;text-align:center;flex:0 0 auto}
.mg-slots{display:flex;gap:6px;flex:1;overflow-x:auto}
.mg-slot{flex:0 0 auto;width:52px;height:52px;border-radius:10px;border:1px solid var(--mg-line);background:var(--mg-panel);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;cursor:pointer;color:var(--mg-fg);font:inherit;font-size:9px;padding:2px}
.mg-slot img{width:30px;height:30px}
.mg-slot.info{cursor:default}
.mg-slot.used{opacity:.3;cursor:default}
.mg-slot.empty{border-style:dashed;opacity:.35;cursor:default}
.mg-hint{position:absolute;left:0;right:0;top:44%;text-align:center;pointer-events:none;animation:mg-pulse 1.2s ease-in-out infinite alternate}
.mg-hint .a{font-size:22px;font-weight:900;text-shadow:0 2px 0 #000,0 0 8px #000}
.mg-hint .b{font-size:12px;font-weight:700;margin-top:4px;text-shadow:0 1px 0 #000,0 0 6px #000;line-height:1.6}
@keyframes mg-pulse{from{opacity:.65}to{opacity:1}}
.mg-overlay{position:absolute;inset:0;background:rgba(8,10,20,.93);border-radius:10px;display:flex;flex-direction:column;gap:8px;padding:12px 10px 14px;overflow-y:auto;animation:mg-in .25s ease-out}
@keyframes mg-in{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:none}}
.mg-ov-title{font-size:22px;font-weight:900;text-align:center;color:var(--mg-gold);text-wrap:balance}
.mg-ov-sub{font-size:12px;text-align:center;color:var(--mg-muted);line-height:1.6}
.mg-ov-tk{font-size:15px;font-weight:900;text-align:center;color:var(--mg-cyan)}
.mg-sec{font-size:11px;font-weight:700;color:var(--mg-muted);letter-spacing:.08em;margin-top:2px}
.mg-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.mg-card{background:var(--mg-panel);border:1px solid var(--mg-line);border-radius:10px;padding:6px 4px;display:flex;flex-direction:column;align-items:center;gap:3px;text-align:center;color:var(--mg-fg);font:inherit;cursor:pointer;min-width:0}
.mg-card img{width:28px;height:28px}
.mg-card .ic{width:28px;height:28px;border-radius:8px;background:#2c3355;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;color:var(--mg-cyan)}
.mg-card .n{font-size:12px;font-weight:900}
.mg-card .d{font-size:10px;color:var(--mg-muted);line-height:1.4}
.mg-card .p{font-size:12px;font-weight:900;color:var(--mg-cyan);margin-top:auto}
.mg-card.part{border-color:#3b5a7a}
.mg-card:disabled{opacity:.4;cursor:default}
.mg-card.sold{opacity:.25}
.mg-row{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
.mg-chip{font-size:10px;background:#20263f;border:1px solid var(--mg-line);border-radius:999px;padding:2px 8px;color:var(--mg-fg)}
.mg-case{display:flex;gap:6px;flex-wrap:wrap}
.mg-case .mg-slot{cursor:pointer}
.mg-actions{display:flex;flex-direction:column;gap:6px;margin-top:auto;position:sticky;bottom:-14px;margin-bottom:-14px;padding:8px 0 14px;background:linear-gradient(transparent,rgba(8,10,20,.97) 18%)}
.mg-tray-empty{font-size:11px;color:var(--mg-muted)}
@media (prefers-reduced-motion:reduce){.mg-hint,.mg-overlay,.mg-num.bump,.mg-mult.bump{animation:none}}
`;

function injectCss() {
  if (document.getElementById("mg-style")) return;
  const s = document.createElement("style");
  s.id = "mg-style";
  s.textContent = CSS;
  document.head.appendChild(s);
}

// ---------- コインの絵 ----------

const COIN_LOOK: Record<CoinKind, { c0: string; c1: string; c2: string; rim: string; mark: string; label?: string; labelColor?: string }> = {
  normal: { c0: "#ffffff", c1: "#d3d9e2", c2: "#7f8a99", rim: "#3f4754", mark: "rgba(70,80,96,.55)" },
  gold: { c0: "#fff6c2", c1: "#ffd23a", c2: "#b87d00", rim: "#5e3d00", mark: "", label: "10", labelColor: "#6b4300" },
  mult: { c0: "#ffd6f3", c1: "#ff5fcf", c2: "#a3127c", rim: "#4a0638", mark: "", label: "×", labelColor: "#ffffff" },
  bomb: { c0: "#7a7f8c", c1: "#3a3e48", c2: "#16181d", rim: "#ff4d4d", mark: "", label: "!", labelColor: "#ff6060" },
  split: { c0: "#d8ffe4", c1: "#4fe08a", c2: "#14834a", rim: "#08391f", mark: "", label: "+6", labelColor: "#0b3d22" },
  chance: { c0: "#dcfbff", c1: "#4fd4ff", c2: "#1477b0", rim: "#06324d", mark: "", label: "?", labelColor: "#06324d" },
  big: { c0: "#ffe8d0", c1: "#e09a5a", c2: "#8a4d1c", rim: "#3d1f06", mark: "", label: "5", labelColor: "#3d1f06" },
  magnet: { c0: "#ffdada", c1: "#ff6b6b", c2: "#a11d1d", rim: "#3d0606", mark: "", label: "磁", labelColor: "#ffffff" },
  curse: { c0: "#9b7bb8", c1: "#4a2a66", c2: "#1d0d2b", rim: "#c48bff", mark: "", label: "呪", labelColor: "#e6c8ff" },
  rust: { c0: "#e0a27a", c1: "#a5552a", c2: "#5a2a10", rim: "#2d1306", mark: "", label: "錆", labelColor: "#2d1306" },
  lead: { c0: "#8d929b", c1: "#555a63", c2: "#2b2e33", rim: "#15171a", mark: "", label: "鉛", labelColor: "#d8dce3" },
};

function star(x: CanvasRenderingContext2D, cx: number, cy: number, R: number, r: number) {
  x.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r : R;
    const px = cx + Math.cos(a) * rr;
    const py = cy + Math.sin(a) * rr;
    if (i) x.lineTo(px, py);
    else x.moveTo(px, py);
  }
  x.closePath();
}

function drawCoin(x: CanvasRenderingContext2D, kind: CoinKind, cx: number, cy: number, r: number) {
  const L = COIN_LOOK[kind];
  const g = x.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.08, cx, cy, r);
  g.addColorStop(0, L.c0);
  g.addColorStop(0.5, L.c1);
  g.addColorStop(1, L.c2);
  x.fillStyle = g;
  x.beginPath();
  x.arc(cx, cy, r, 0, Math.PI * 2);
  x.fill();
  // ギザ（リーデッドエッジ）
  x.strokeStyle = "rgba(40,48,60,.35)";
  x.lineWidth = Math.max(0.6, r * 0.05);
  const n = Math.round(r * 3);
  x.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    x.moveTo(cx + Math.cos(a) * (r - r * 0.16), cy + Math.sin(a) * (r - r * 0.16));
    x.lineTo(cx + Math.cos(a) * (r - 0.5), cy + Math.sin(a) * (r - 0.5));
  }
  x.stroke();
  x.lineWidth = Math.max(1, r * 0.12);
  x.strokeStyle = L.rim;
  x.beginPath();
  x.arc(cx, cy, r - x.lineWidth / 2, 0, Math.PI * 2);
  x.stroke();
  // 内側の段
  x.lineWidth = Math.max(0.6, r * 0.06);
  x.strokeStyle = "rgba(60,70,85,.45)";
  x.beginPath();
  x.arc(cx, cy, r * 0.7, 0, Math.PI * 2);
  x.stroke();
  x.strokeStyle = "rgba(255,255,255,.55)";
  x.beginPath();
  x.arc(cx, cy, r * 0.7 + x.lineWidth, Math.PI * 1.05, Math.PI * 1.6);
  x.stroke();
  if (L.label) {
    x.font = `900 ${r * (L.label.length > 1 && /\d/.test(L.label) ? 0.8 : 0.95)}px system-ui, sans-serif`;
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillStyle = L.labelColor ?? "#000";
    x.fillText(L.label, cx, cy + r * 0.05);
  } else {
    // 刻印（打ち出しの星）
    x.fillStyle = "rgba(255,255,255,.7)";
    star(x, cx - r * 0.04, cy - r * 0.04, r * 0.4, r * 0.17);
    x.fill();
    x.fillStyle = L.mark;
    star(x, cx + r * 0.03, cy + r * 0.03, r * 0.4, r * 0.17);
    x.fill();
  }
}

type SpriteSet = Map<CoinKind, HTMLCanvasElement>;

function makeSprites(scale: number): SpriteSet {
  const out: SpriteSet = new Map();
  for (const kind of Object.keys(COIN_LOOK) as CoinKind[]) {
    const r = kind === "big" || kind === "lead" ? TUNING.r * TUNING.bigScale : TUNING.r;
    const size = Math.ceil((r * 2 + 4) * scale);
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const x = c.getContext("2d")!;
    x.scale(scale, scale);
    drawCoin(x, kind, r + 2, r + 2, r);
    out.set(kind, c);
  }
  return out;
}

const iconCache = new Map<CoinKind, string>();
function coinIcon(kind: CoinKind) {
  let u = iconCache.get(kind);
  if (!u) {
    const c = document.createElement("canvas");
    c.width = 72;
    c.height = 72;
    drawCoin(c.getContext("2d")!, kind, 36, 36, 32);
    u = c.toDataURL();
    iconCache.set(kind, u);
  }
  return u;
}

// ---------- スロットの絵柄 ----------

function drawSymbol(x: CanvasRenderingContext2D, s: Symbol, cx: number, cy: number) {
  x.save();
  x.textAlign = "center";
  x.textBaseline = "middle";
  switch (s) {
    case "7":
      x.font = "900 40px system-ui, sans-serif";
      x.lineWidth = 5;
      x.strokeStyle = "#3a0000";
      x.strokeText("7", cx, cy + 2);
      x.fillStyle = "#ff2b2b";
      x.fillText("7", cx, cy + 2);
      break;
    case "BAR":
      x.fillStyle = "#151515";
      x.fillRect(cx - 24, cy - 11, 48, 22);
      x.fillStyle = "#fff";
      x.font = "900 15px system-ui, sans-serif";
      x.fillText("BAR", cx, cy + 1);
      break;
    case "BELL":
      x.fillStyle = "#ffcf1f";
      x.strokeStyle = "#5a3d00";
      x.lineWidth = 2.5;
      x.beginPath();
      x.moveTo(cx - 17, cy + 11);
      x.quadraticCurveTo(cx - 13, cy + 4, cx - 12, cy - 4);
      x.quadraticCurveTo(cx - 10, cy - 17, cx, cy - 17);
      x.quadraticCurveTo(cx + 10, cy - 17, cx + 12, cy - 4);
      x.quadraticCurveTo(cx + 13, cy + 4, cx + 17, cy + 11);
      x.closePath();
      x.fill();
      x.stroke();
      x.beginPath();
      x.arc(cx, cy + 14, 4, 0, Math.PI * 2);
      x.fill();
      x.stroke();
      break;
    case "CHERRY":
      x.strokeStyle = "#1e7a1e";
      x.lineWidth = 3;
      x.beginPath();
      x.moveTo(cx - 8, cy + 6);
      x.quadraticCurveTo(cx - 2, cy - 10, cx + 8, cy - 16);
      x.moveTo(cx + 9, cy + 4);
      x.quadraticCurveTo(cx + 8, cy - 8, cx + 8, cy - 16);
      x.stroke();
      for (const [dx, dy] of [
        [-9, 9],
        [9, 7],
      ]) {
        x.fillStyle = "#e0102a";
        x.strokeStyle = "#4a0008";
        x.lineWidth = 2;
        x.beginPath();
        x.arc(cx + dx, cy + dy, 8, 0, Math.PI * 2);
        x.fill();
        x.stroke();
      }
      break;
    case "STAR":
      x.fillStyle = "#3fb6ff";
      x.strokeStyle = "#062d4a";
      x.lineWidth = 2.5;
      star(x, cx, cy, 18, 8);
      x.fill();
      x.stroke();
      break;
  }
  x.restore();
}

const REEL_STRIP: Symbol[] = ["7", "CHERRY", "BAR", "BELL", "STAR", "CHERRY", "BELL", "BAR"];

function roundRect(x: CanvasRenderingContext2D, rx: number, ry: number, w: number, h: number, r: number) {
  x.beginPath();
  x.moveTo(rx + r, ry);
  x.arcTo(rx + w, ry, rx + w, ry + h, r);
  x.arcTo(rx + w, ry + h, rx, ry + h, r);
  x.arcTo(rx, ry + h, rx, ry, r);
  x.arcTo(rx, ry, rx + w, ry, r);
  x.closePath();
}

// ---------- 本体 ----------

export interface MountOptions {
  storageKey?: string;
  bottomPad?: string; // 下部固定ナビの分
}

export function mountMedalGame(root: HTMLElement, opts: MountOptions = {}): () => void {
  injectCss();
  const KEY = opts.storageKey ?? "medal-rogue-v1";
  const SETTINGS_KEY = KEY + "-settings";

  const load = <T,>(k: string): Partial<T> => {
    try {
      const s = localStorage.getItem(k);
      return s ? JSON.parse(s) : {};
    } catch {
      return {};
    }
  };
  const store = (k: string, v: unknown) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* 保存できない環境でも遊べる */
    }
  };

  const settings = { sound: true, shake: true, ...load<{ sound: boolean; shake: boolean }>(SETTINGS_KEY) };
  const g: Game = createGame({ save: load<SaveData>(KEY) });

  // DOM
  root.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "mg-root";
  if (opts.bottomPad) wrap.style.paddingBottom = opts.bottomPad;
  wrap.innerHTML = `
    <div class="mg-hud">
      <div class="mg-round" data-r="round">ROUND 1</div>
      <div class="mg-score"><div class="mg-score-text" data-r="scoreText"></div><div class="mg-bar"><div class="mg-fill" data-r="fill"></div></div></div>
      <div class="mg-mult" data-r="mult">×1</div>
      <div class="mg-stats">
        <span class="mg-stat">手持ち<span class="mg-num" data-r="hand">0</span>枚</span>
        <span class="mg-stat">チケット<span class="mg-num tk" data-r="tickets">0</span></span>
      </div>
      <div class="mg-toggles">
        <button class="mg-btn" type="button" data-r="soundBtn"></button>
        <button class="mg-btn" type="button" data-r="shakeBtn"></button>
      </div>
    </div>
    <div class="mg-stage" data-r="stage">
      <canvas class="mg-canvas" data-r="canvas" aria-label="メダル落としの盤面。タップした位置にメダルを投入"></canvas>
      <div class="mg-hint" data-r="hint"><div class="a">タップでメダル投入</div><div class="b">投入口もINも左右に動く。釘で弾かれてどこに落ちるかは運次第<br>INを通るとスロット抽選（メダルはそのまま盤面へ）<br>目標スコアでラウンドクリア</div></div>
    </div>
    <div class="mg-tray"><span class="mg-tray-label">特殊<br>コイン</span><div class="mg-slots" data-r="slots"></div></div>
  `;
  root.appendChild(wrap);
  const R = <T extends HTMLElement = HTMLElement>(n: string) => wrap.querySelector(`[data-r="${n}"]`) as T;
  const el = {
    round: R("round"),
    scoreText: R("scoreText"),
    fill: R("fill"),
    mult: R("mult"),
    hand: R("hand"),
    tickets: R("tickets"),
    soundBtn: R<HTMLButtonElement>("soundBtn"),
    shakeBtn: R<HTMLButtonElement>("shakeBtn"),
    stage: R("stage"),
    canvas: R<HTMLCanvasElement>("canvas"),
    hint: R("hint"),
    slots: R("slots"),
  };
  // 盤面が画面に収まるよう幅を制限（HUD・トレイ・ナビ分を引く）
  el.stage.style.maxWidth = `min(480px, calc((100dvh - ${opts.bottomPad ? 250 : 180}px) * 360 / 700))`;

  const fx: Fx = { floats: [], parts: [], banner: null, shake: 0, flash: 0, hitstop: 0, gateFlash: 0, combo: 0, comboTimer: 0 };
  let sound: Sound | null = null;
  let firing = false;
  let fireTimer = 0;
  let overlay: HTMLElement | null = null;
  let overlayMode = "";
  let inputLockUntil = 0;

  const persist = () => {
    store(KEY, toSave(g));
    store(SETTINGS_KEY, settings);
  };
  const ensureSound = () => {
    try {
      if (!sound) sound = createSound();
      sound.resume();
      sound.setEnabled(settings.sound);
    } catch {
      /* 音が使えない環境でも遊べる */
    }
  };
  const updateToggles = () => {
    el.soundBtn.textContent = `音 ${settings.sound ? "ON" : "OFF"}`;
    el.soundBtn.setAttribute("aria-pressed", String(settings.sound));
    el.shakeBtn.textContent = `揺れ ${settings.shake ? "ON" : "OFF"}`;
    el.shakeBtn.setAttribute("aria-pressed", String(settings.shake));
  };
  const bump = (e: HTMLElement) => {
    e.classList.remove("bump");
    void e.offsetWidth;
    e.classList.add("bump");
  };

  // HUD（値が変わった時だけ書き換え）
  const last = { round: -1, score: -1, target: -1, mult: -1, hand: -1, tickets: -1, slots: "" };
  const updateHud = () => {
    const tg = target(g);
    if (g.round !== last.round) {
      last.round = g.round;
      el.round.textContent = g.round <= TUNING.rounds ? `ROUND ${g.round}/${TUNING.rounds}` : `ENDLESS ${g.round}`;
    }
    if (g.score !== last.score || tg !== last.target) {
      last.score = g.score;
      last.target = tg;
      el.scoreText.textContent = g.score >= tg ? `スコア ${g.score} / ${tg}　達成！` : `スコア ${g.score} / ${tg}`;
      el.fill.style.width = `${Math.min(1, g.score / tg) * 100}%`;
    }
    if (g.mult !== last.mult) {
      if (last.mult >= 0 && g.mult > last.mult) bump(el.mult);
      last.mult = g.mult;
      el.mult.textContent = `×${g.mult}`;
    }
    if (g.hand !== last.hand) {
      last.hand = g.hand;
      el.hand.textContent = String(g.hand);
    }
    if (g.tickets !== last.tickets) {
      if (last.tickets >= 0 && g.tickets > last.tickets) bump(el.tickets);
      last.tickets = g.tickets;
      el.tickets.textContent = String(g.tickets);
    }
    const sig = `${g.coinCase.join(",")}|${g.used.join(",")}|${caseSize(g)}|${g.mode}`;
    if (sig !== last.slots) {
      last.slots = sig;
      renderSlots();
    }
  };

  const renderSlots = () => {
    el.slots.innerHTML = "";
    if (!g.coinCase.length) {
      el.slots.innerHTML = `<span class="mg-tray-empty">ショップで買った特殊コインは、毎ラウンドの手持ちメダルにランダムで混ざります</span>`;
      return;
    }
    const size = caseSize(g);
    for (let i = 0; i < size; i++) {
      const kind = g.coinCase[i];
      const b = document.createElement("div");
      b.className = "mg-slot info";
      if (!kind) {
        b.classList.add("empty");
        b.setAttribute("aria-label", "空きスロット");
      } else {
        const used = g.mode === "play" && g.used[i];
        if (used) b.classList.add("used");
        b.innerHTML = `<img alt="" src="${coinIcon(kind)}"><span>${COIN_INFO[kind].name.replace("コイン", "")}</span>`;
        b.title = `${COIN_INFO[kind].name}: ${COIN_INFO[kind].desc}`;
        b.setAttribute("aria-label", `${COIN_INFO[kind].name}${used ? "（このラウンドは出た）" : "（まだ出ていない）"}`);
      }
      el.slots.appendChild(b);
    }
  };

  // ---------- オーバーレイ（ショップ・メダル切れ・終了） ----------
  const closeOverlay = () => {
    overlay?.remove();
    overlay = null;
    overlayMode = "";
  };
  const openOverlay = (mode: string, build: (o: HTMLElement) => void) => {
    const fresh = overlayMode !== mode;
    closeOverlay();
    firing = false;
    if (fresh) inputLockUntil = performance.now() + 450; // 連打の誤タップ防止（開いた直後だけ）
    overlay = document.createElement("div");
    overlay.className = "mg-overlay";
    overlayMode = mode;
    build(overlay);
    el.stage.appendChild(overlay);
  };
  const guarded = (fn: () => void) => () => {
    if (performance.now() < inputLockUntil) return;
    fn();
  };

  let clearInfo = { tickets: 0, leftover: 0, over: 0 };
  const showShop = () =>
    openOverlay("shop", (o) => {
      const next = g.round + 1;
      const badNext = next >= 9 ? 3 : next >= 6 ? 2 : next >= 3 ? 1 : 0;
      o.innerHTML = `
        <div class="mg-ov-title">ROUND ${g.round} クリア！</div>
        <div class="mg-ov-sub">クリア報酬 +${clearInfo.tickets}チケット（残りメダル${clearInfo.leftover}枚分${clearInfo.over ? `・目標超過ボーナス${clearInfo.over}` : ""}を含む）</div>
        <div class="mg-ov-tk">所持チケット ${g.tickets}</div>
        <div class="mg-sec">ショップ</div>
        <div class="mg-cards" data-r="offers"></div>
        <div class="mg-row"><button class="mg-btn" type="button" data-r="reroll">品ぞろえ更新（${g.rerollCost}チケット）</button></div>
        <div class="mg-sec">コインケース ${g.coinCase.length}/${caseSize(g)}　毎ラウンド手持ちにランダムで混ざる（タップで半額売却）</div>
        <div class="mg-case" data-r="case"></div>
        <div class="mg-sec">台の改造</div>
        <div class="mg-row" data-r="parts"></div>
        <div class="mg-actions">
          <div class="mg-ov-sub">次: ROUND ${next}　目標 ${baseTargetOf(next)}点　手持ち${handPerRound(g)}枚${badNext ? `<br>お邪魔コインが${badNext}枚出現。押し出して消そう` : ""}</div>
          <button class="mg-btn primary" type="button" data-r="next">次のラウンドへ</button>
        </div>`;
      const q = (n: string) => o.querySelector(`[data-r="${n}"]`) as HTMLElement;
      g.offers.forEach((of, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = `mg-card${of.type === "part" ? " part" : ""}${of.sold ? " sold" : ""}`;
        if (of.type === "coin") {
          const info = COIN_INFO[of.kind];
          b.innerHTML = `<img alt="" src="${coinIcon(of.kind)}"><span class="n">${info.name}</span><span class="d">${info.desc}</span><span class="p">${of.sold ? "購入済み" : `${of.price}チケット`}</span>`;
        } else {
          const p = PARTS.find((x) => x.id === of.id)!;
          const lv = part(g, p.id);
          b.innerHTML = `<span class="ic">⚙</span><span class="n">${p.name}${p.max > 1 ? ` Lv${lv + (of.sold ? 0 : 1)}` : ""}</span><span class="d">${p.desc}</span><span class="p">${of.sold ? "購入済み" : `${of.price}チケット`}</span>`;
        }
        b.disabled = !canBuy(g, i);
        if (!of.sold && of.type === "coin" && g.coinCase.length >= caseSize(g)) b.title = "コインケースがいっぱいです。売却すると空きます";
        b.addEventListener(
          "click",
          guarded(() => {
            if (buy(g, i)) {
              sound?.play("buy");
              persist();
              showShop();
            }
          }),
        );
        q("offers").appendChild(b);
      });
      const rr = q("reroll") as HTMLButtonElement;
      rr.disabled = g.tickets < g.rerollCost;
      rr.addEventListener(
        "click",
        guarded(() => {
          if (reroll(g)) {
            sound?.play("reelStop");
            persist();
            showShop();
          }
        }),
      );
      if (!g.coinCase.length) q("case").innerHTML = `<span class="mg-ov-sub">まだありません。ショップで買うと次のラウンドから使えます</span>`;
      g.coinCase.forEach((k, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "mg-slot";
        b.innerHTML = `<img alt="" src="${coinIcon(k)}"><span>+${Math.floor(COIN_INFO[k].price / 2)}</span>`;
        b.setAttribute("aria-label", `${COIN_INFO[k].name}を${Math.floor(COIN_INFO[k].price / 2)}チケットで売る`);
        b.addEventListener(
          "click",
          guarded(() => {
            sellCoin(g, i);
            persist();
            showShop();
          }),
        );
        q("case").appendChild(b);
      });
      const owned = PARTS.filter((p) => part(g, p.id) > 0);
      q("parts").innerHTML = owned.length
        ? owned.map((p) => `<span class="mg-chip" title="${p.desc}">${p.name}${p.max > 1 ? ` Lv${part(g, p.id)}` : ""}</span>`).join("")
        : `<span class="mg-ov-sub">なし</span>`;
      q("next").addEventListener(
        "click",
        guarded(() => {
          nextRound(g);
          closeOverlay();
          persist();
          roundBanner();
        }),
      );
    });

  const baseTargetOf = (round: number) => {
    const T = TUNING;
    return round <= T.targets.length ? T.targets[round - 1] : Math.round(T.targets[T.targets.length - 1] * Math.pow(T.endlessGrowth, round - T.targets.length));
  };

  const showFail = () =>
    openOverlay("fail", (o) => {
      const price = buyMedalsPrice(g);
      o.innerHTML = `
        <div class="mg-ov-title" style="color:var(--mg-red)">メダル切れ</div>
        <div class="mg-ov-sub">スコア ${g.score} / ${target(g)}　あと${Math.max(0, target(g) - g.score)}点</div>
        <div class="mg-ov-tk">所持チケット ${g.tickets}</div>
        <div class="mg-actions">
          <button class="mg-btn primary" type="button" data-r="buy">${price}チケットでメダル${TUNING.buyMedals}枚を補充</button>
          <button class="mg-btn" type="button" data-r="quit">あきらめる</button>
        </div>`;
      (o.querySelector('[data-r="buy"]') as HTMLButtonElement).addEventListener(
        "click",
        guarded(() => {
          if (buyMedals(g)) {
            sound?.play("buy");
            closeOverlay();
          }
        }),
      );
      (o.querySelector('[data-r="quit"]') as HTMLButtonElement).addEventListener(
        "click",
        guarded(() => {
          const ev: GameEvent[] = [];
          giveUp(g, ev);
          handleEvents(ev);
        }),
      );
    });

  const showOver = () =>
    openOverlay("over", (o) => {
      const reached = g.round;
      o.innerHTML = `
        <div class="mg-ov-title" style="color:var(--mg-red)">GAME OVER</div>
        <div class="mg-ov-sub">ROUND ${reached} で力尽きた<br>スコア ${g.score} / ${target(g)}</div>
        <div class="mg-ov-tk">最高記録 ROUND ${Math.max(g.best, 0)} クリア</div>
        <div class="mg-sec">今回の構成</div>
        <div class="mg-row">${g.coinCase.map((k) => `<img alt="${COIN_INFO[k].name}" title="${COIN_INFO[k].name}" src="${coinIcon(k)}" width="28" height="28">`).join("") || '<span class="mg-ov-sub">特殊コインなし</span>'}</div>
        <div class="mg-row">${PARTS.filter((p) => part(g, p.id) > 0)
          .map((p) => `<span class="mg-chip">${p.name}${p.max > 1 ? ` Lv${part(g, p.id)}` : ""}</span>`)
          .join("")}</div>
        <div class="mg-actions"><button class="mg-btn primary" type="button" data-r="again">もう一度</button></div>`;
      (o.querySelector('[data-r="again"]') as HTMLButtonElement).addEventListener(
        "click",
        guarded(() => {
          newRun(g);
          closeOverlay();
          persist();
          roundBanner();
        }),
      );
    });

  const roundBanner = () => {
    fx.banner = {
      text: `ROUND ${g.round}`,
      sub: `目標 ${target(g)}点　手持ち ${g.hand}枚`,
      color: "#7dfcff",
      t: 0,
      life: 1.6,
    };
    const bad = g.medals.filter((m) => isBad(m.kind));
    bad.forEach((m) => fx.floats.push({ x: m.x, y: TOP + m.y - 20, text: COIN_INFO[m.kind].name, color: "#d7a6ff", t: 0, life: 2.2, size: 13 }));
  };

  // ---------- イベント → 演出・音 ----------
  const handleEvents = (ev: GameEvent[]) => {
    const s = sound;
    for (const e of ev) {
      switch (e.type) {
        case "drop":
          s?.play(e.kind === "normal" ? "drop" : "special");
          break;
        case "land":
          s?.play("land");
          break;
        case "pin":
          s?.play("pin");
          break;
        case "pay": {
          if (e.pts < 0) {
            s?.play("lost");
            fx.floats.push({ x: e.x, y: TOP + TUNING.edgeY + 26, text: `${e.pts}`, color: "#ff5a6e", t: 0, life: 1, size: 20 });
            break;
          }
          fx.combo++;
          fx.comboTimer = 0.7;
          s?.play(e.kind === "normal" ? "pay" : "winSmall", fx.combo);
          const special = e.kind !== "normal";
          fx.floats.push({
            x: e.x,
            y: TOP + TUNING.edgeY + 26,
            text: `+${e.pts}${e.center ? "!" : ""}`,
            color: special ? "#ff9cf0" : e.center ? "#7dfcff" : "#ffe14a",
            t: 0,
            life: 0.75,
            size: special ? 22 : 16,
          });
          for (let i = 0; i < (special ? 10 : 3); i++) {
            fx.parts.push({ x: e.x, y: TOP + TUNING.edgeY + 8, vx: (Math.random() - 0.5) * 140, vy: -80 - Math.random() * 140, t: 0, life: 0.5, color: special ? "#ff9cf0" : "#f2f6ff", size: 2.5, spin: 0 });
          }
          if (fx.combo === 8 || fx.combo === 20 || fx.combo === 40) {
            const words: Record<number, string> = { 8: "ドバッ！", 20: "大量！！", 40: "大爆流！！！" };
            fx.floats.push({ x: LW / 2, y: TOP + TUNING.edgeY - 50, text: words[fx.combo], color: "#ffffff", t: 0, life: 1.1, size: 34 });
            fx.shake = Math.max(fx.shake, fx.combo >= 20 ? 6 : 3.5);
          }
          break;
        }
        case "lost":
          s?.play("lost");
          fx.floats.push({ x: e.x, y: TOP + TUNING.edgeY + 26, text: "×", color: "#ff5a5a", t: 0, life: 0.6, size: 18 });
          break;
        case "checkin":
          s?.play("checkin");
          fx.gateFlash = 0.35;
          fx.hitstop = Math.max(fx.hitstop, 0.05);
          fx.floats.push({ x: e.x, y: TOP + TUNING.gateY - 6, text: "IN!", color: "#7dfcff", t: 0, life: 0.7, size: 20 });
          break;
        case "stockFull":
          s?.play("empty");
          fx.floats.push({ x: g.gateX, y: TOP + TUNING.gateY - 6, text: "保留満タン", color: "#ff8a8a", t: 0, life: 0.8, size: 14 });
          break;
        case "reelStop":
          s?.play("reelStop", e.index);
          break;
        case "reach":
          s?.play("reach");
          break;
        case "win":
          if (e.kind === "jackpot") {
            s?.play("jackpot");
            fx.hitstop = 0.3;
            fx.flash = 0.6;
            fx.shake = 12;
            fx.banner = { text: "JACKPOT!!", sub: `メダル${e.amount}枚 ＆ FEVER（没収なし）`, color: "#ff3355", t: 0, life: 2.2 };
            confetti(fx, 90);
          } else if (e.kind === "bell") {
            s?.play("winBig");
            fx.hitstop = 0.12;
            fx.flash = 0.25;
            fx.shake = 5;
            fx.banner = { text: "BELL!", sub: `メダル${e.amount}枚`, color: "#ffcf1f", t: 0, life: 1.3 };
          } else {
            s?.play("winSmall");
            fx.shake = 2.5;
            fx.floats.push({ x: LW / 2, y: TOP - 8, text: `チェリー メダル${e.amount}枚`, color: "#ff7a8a", t: 0, life: 1.0, size: 16 });
          }
          break;
        case "explode":
          s?.play("explode");
          fx.hitstop = Math.max(fx.hitstop, 0.08);
          fx.shake = Math.max(fx.shake, 9);
          fx.flash = Math.max(fx.flash, 0.15);
          for (let i = 0; i < 40; i++) {
            const a = Math.random() * Math.PI * 2;
            const v = 80 + Math.random() * 260;
            fx.parts.push({ x: e.x, y: TOP + e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, t: 0, life: 0.5 + Math.random() * 0.3, color: i % 3 ? "#ff9b2b" : i % 2 ? "#ffe14a" : "#2a2a2a", size: 3 + Math.random() * 4, spin: 6 });
          }
          fx.floats.push({ x: e.x, y: TOP + e.y, text: "ドカン！", color: "#ff9b2b", t: 0, life: 0.8, size: 26 });
          break;
        case "mult":
          s?.play("mult");
          fx.hitstop = Math.max(fx.hitstop, 0.06);
          fx.floats.push({ x: LW / 2, y: TOP + TUNING.edgeY - 90, text: `倍率 ×${e.mult}`, color: "#ff7ad9", t: 0, life: 1.1, size: 30 });
          break;
        case "badGone":
          s?.play("checkin");
          fx.floats.push({ x: LW / 2, y: TOP + TUNING.edgeY - 20, text: `${COIN_INFO[e.kind].name} 撃退！`, color: "#d7a6ff", t: 0, life: 1.1, size: 20 });
          break;
        case "feverEnd":
          s?.play("feverEnd");
          fx.floats.push({ x: LW / 2, y: TOP + 300, text: "FEVER 終了", color: "#ffffff", t: 0, life: 1.0, size: 22 });
          break;
        case "roundClear":
          s?.play("goal");
          fx.hitstop = 0.25;
          fx.flash = 0.35;
          confetti(fx, 60);
          clearInfo = { tickets: e.tickets, leftover: e.leftover, over: e.over };
          fx.banner = { text: "CLEAR!", sub: `ROUND ${e.round}`, color: "#59ff8f", t: 0, life: 1.0 };
          persist();
          pendingOverlay = { mode: "shop", at: performance.now() + 900 };
          break;
        case "clearHold":
          s?.play("goal");
          fx.banner = { text: "ノルマ達成！", sub: "払い出し終了までボーナスタイム。超えた分はチケットに", color: "#59ff8f", t: 0, life: 1.8 };
          break;
        case "allClear":
          s?.play("jackpot");
          confetti(fx, 120);
          fx.banner = { text: "全ラウンド制覇！", sub: "ここからはエンドレス。どこまで行ける？", color: "#ffd23a", t: 0, life: 2.4 };
          if (pendingOverlay) pendingOverlay.at = performance.now() + 2200;
          break;
        case "fail":
          s?.play("feverEnd");
          showFail();
          break;
        case "gameOver":
          s?.play("over");
          store(KEY, { best: g.best }); // ランは終了。最高記録だけ残す
          showOver();
          break;
      }
    }
  };
  let pendingOverlay: { mode: string; at: number } | null = null;
  let lastNext: CoinKind | null = null;

  const fire = () => {
    if (g.mode !== "play") return;
    const ev: GameEvent[] = [];
    if (dropMedal(g, g.launchX, ev)) handleEvents(ev);
    else sound?.play("empty");
    el.hint.hidden = true;
  };

  // ---------- キャンバス ----------
  const ctx = el.canvas.getContext("2d")!;
  let scale = 1;
  let sprites = makeSprites(2);
  const resize = () => {
    const rect = el.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    el.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    el.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    scale = (rect.width * dpr) / LW || 1;
    sprites = makeSprites(scale);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(el.canvas);

  // ---------- 入力 ----------
  const onDown = (e: PointerEvent) => {
    e.preventDefault();
    if (performance.now() < inputLockUntil || overlay) return;
    try {
      el.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    ensureSound();
    fire();
    firing = true;
    fireTimer = TUNING.autoFireInterval * 2;
  };
  const onUp = () => (firing = false);
  const noMenu = (e: Event) => e.preventDefault();
  el.canvas.addEventListener("pointerdown", onDown);
  el.canvas.addEventListener("pointerup", onUp);
  el.canvas.addEventListener("pointercancel", onUp);
  el.canvas.addEventListener("contextmenu", noMenu);

  const keys = new Set<string>();
  const onKeyDown = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key === " " || e.key === "Enter") {
      if (tag === "BUTTON" || overlay) return;
      e.preventDefault();
      if (!firing) {
        ensureSound();
        fire();
        firing = true;
        fireTimer = TUNING.autoFireInterval * 2;
      }
    } else keys.add(e.key);
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter") firing = false;
    keys.delete(e.key);
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  el.soundBtn.addEventListener("click", () => {
    settings.sound = !settings.sound;
    ensureSound();
    updateToggles();
    persist();
  });
  el.shakeBtn.addEventListener("click", () => {
    settings.shake = !settings.shake;
    updateToggles();
    persist();
  });
  updateToggles();

  const onHide = () => persist();
  window.addEventListener("pagehide", onHide);
  document.addEventListener("visibilitychange", onHide);

  // 前回ショップで閉じていたらショップから
  if (g.mode === "shop") {
    clearInfo = { tickets: 0, leftover: 0, over: 0 };
    showShop();
    el.hint.hidden = true;
  } else if (g.round > 1) {
    roundBanner();
    el.hint.hidden = true;
  }

  // ---------- ループ ----------
  let raf = 0;
  let prev = performance.now();
  let acc = 0;
  let saveTimer = 0;
  const DT = 1 / 60;
  const loop = (now: number) => {
    const frame = Math.min(0.1, (now - prev) / 1000);
    prev = now;
    if (firing && g.mode === "play") {
      fireTimer -= frame;
      if (fireTimer <= 0) {
        fireTimer += TUNING.autoFireInterval;
        const ev: GameEvent[] = [];
        if (dropMedal(g, g.launchX, ev)) handleEvents(ev);
      }
    }
    if (fx.hitstop > 0) fx.hitstop -= frame;
    else {
      acc += frame;
      let n = 0;
      while (acc >= DT && n < 6) {
        const ev: GameEvent[] = [];
        step(g, DT, ev);
        handleEvents(ev);
        acc -= DT;
        n++;
        if (fx.hitstop > 0) {
          acc = 0;
          break;
        }
      }
      if (g.mode !== "play") acc = 0;
    }
    if (pendingOverlay && now >= pendingOverlay.at && overlayMode === "") {
      pendingOverlay = null;
      showShop();
    }
    // 次が特殊コインになったら知らせる（狙って落とせるように）
    const nk = g.mode === "play" ? nextKind(g) : null;
    if (nk !== lastNext) {
      if (nk && nk !== "normal") {
        sound?.play("special");
        fx.floats.push({ x: LW / 2, y: TOP + 70, text: `次は${COIN_INFO[nk].name}！`, color: "#ffd23a", t: 0, life: 1.2, size: 18 });
      }
      lastNext = nk;
    }
    updateFx(fx, frame);
    updateHud();
    saveTimer += frame;
    if (saveTimer > 3) {
      saveTimer = 0;
      if (g.mode !== "over") persist();
    }
    render(ctx, g, fx, scale, sprites, settings.shake);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    if (g.mode !== "over") persist();
    window.removeEventListener("pagehide", onHide);
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    root.innerHTML = "";
  };
}

function confetti(fx: Fx, n: number) {
  const colors = ["#ff3355", "#ffd23a", "#3fb6ff", "#59ff8f", "#ffffff", "#c06bff"];
  for (let i = 0; i < n; i++) {
    fx.parts.push({
      x: LW / 2 + (Math.random() - 0.5) * 80,
      y: TOP + 220,
      vx: (Math.random() - 0.5) * 520,
      vy: -200 - Math.random() * 380,
      t: 0,
      life: 1.6 + Math.random() * 0.8,
      color: colors[i % colors.length],
      size: 3 + Math.random() * 3,
      spin: Math.random() * 10,
    });
  }
}

function updateFx(fx: Fx, dt: number) {
  for (const f of fx.floats) f.t += dt;
  fx.floats = fx.floats.filter((f) => f.t < f.life);
  for (const p of fx.parts) {
    p.t += dt;
    p.vy += 600 * dt;
    p.vx *= 0.985;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  fx.parts = fx.parts.filter((p) => p.t < p.life);
  if (fx.banner) {
    fx.banner.t += dt;
    if (fx.banner.t > fx.banner.life) fx.banner = null;
  }
  fx.shake = Math.max(0, fx.shake - dt * 22);
  fx.flash = Math.max(0, fx.flash - dt);
  fx.gateFlash = Math.max(0, fx.gateFlash - dt);
  fx.comboTimer -= dt;
  if (fx.comboTimer <= 0) fx.combo = 0;
}

function render(x: CanvasRenderingContext2D, g: Game, fx: Fx, scale: number, sprites: SpriteSet, shakeOn: boolean) {
  const T = TUNING;
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.fillStyle = "#0d0f1a";
  x.fillRect(0, 0, x.canvas.width, x.canvas.height);

  let sx = 0;
  let sy = 0;
  if (shakeOn && fx.shake > 0) {
    sx = (Math.random() - 0.5) * fx.shake * 2;
    sy = (Math.random() - 0.5) * fx.shake;
  }
  x.setTransform(scale, 0, 0, scale, sx * scale, sy * scale);

  drawSlot(x, g);

  x.save();
  x.translate(0, TOP);

  // 上段デッキ
  x.fillStyle = "#1a1f36";
  x.fillRect(0, 0, LW, T.pusherBack);
  const gw = T.gateW + gateWide(g) * 2;
  const gx = g.gateX;
  const lit = fx.gateFlash > 0;
  const full = g.stock >= T.maxStock;
  x.fillStyle = lit ? "#7dfcff" : full ? "#40121a" : "#0a3140";
  x.strokeStyle = full ? "#ff5a6e" : "#7dfcff";
  x.lineWidth = 2;
  roundRect(x, gx - gw / 2, T.gateY - 6, gw, 14, 4);
  x.fill();
  x.stroke();
  x.fillStyle = lit ? "#002030" : full ? "#ff5a6e" : "#7dfcff";
  x.font = "900 13px system-ui, sans-serif";
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.font = "900 11px system-ui, sans-serif";
  x.fillText(full ? "MAX" : "IN", gx, T.gateY + 1);
  // 釘
  for (const p of pins(g.gateX, gateWide(g))) {
    x.beginPath();
    x.arc(p.x, p.y, T.pinR + 0.5, 0, Math.PI * 2);
    x.fillStyle = "#e3e7f5";
    x.fill();
    x.lineWidth = 1;
    x.strokeStyle = "#3c425e";
    x.stroke();
  }
  // 狙いマーカー（次が特殊コインなら、それを見せて狙わせる）
  const nk = nextKind(g);
  const armedKind = nk && nk !== "normal" ? nk : null;
  const ax = g.launchX;
  // レール
  x.fillStyle = "#2c3352";
  x.fillRect(T.launchMin - 16, 2, T.launchMax - T.launchMin + 32, 6);
  x.strokeStyle = armedKind ? "rgba(255,210,58,.8)" : "rgba(255,255,255,0.45)";
  x.setLineDash([4, 4]);
  x.beginPath();
  x.moveTo(ax, 18);
  x.lineTo(ax, T.pusherBack);
  x.stroke();
  x.setLineDash([]);
  // 投入口（ノズル）
  const ng = x.createLinearGradient(0, 0, 0, 18);
  ng.addColorStop(0, "#e8ebf7");
  ng.addColorStop(1, "#7d84a3");
  x.fillStyle = ng;
  roundRect(x, ax - 16, 0, 32, 16, 4);
  x.fill();
  x.fillStyle = "#1a1f36";
  x.fillRect(ax - 9, 12, 18, 4);
  if (armedKind) {
    const sp = sprites.get(armedKind)!;
    const w = (sp.width / scale) * (1.15 + 0.08 * Math.sin(g.time * 10));
    x.fillStyle = "rgba(255,210,58,.25)";
    x.beginPath();
    x.arc(ax, 30, w * 0.62, 0, Math.PI * 2);
    x.fill();
    x.drawImage(sp, ax - w / 2, 30 - w / 2, w, w);
    x.font = "900 10px system-ui, sans-serif";
    x.fillStyle = "#ffd23a";
    x.fillText("NEXT", ax + (ax > LW - 60 ? -30 : 30), 30);
  }

  // フィールド（床は明るく、背景は落とす）
  const fieldTop = T.pusherBack;
  const grad = x.createLinearGradient(0, fieldTop, 0, T.edgeY);
  grad.addColorStop(0, "#26304f");
  grad.addColorStop(1, "#34416b");
  x.fillStyle = grad;
  x.fillRect(T.wallL, fieldTop, T.wallR - T.wallL, T.edgeY - fieldTop);
  x.fillStyle = "#4a4f6a";
  x.fillRect(0, fieldTop, T.wallL, T.edgeY - fieldTop);
  x.fillRect(T.wallR, fieldTop, LW - T.wallR, T.edgeY - fieldTop);

  // 落とし口
  const fever = g.fever > 0;
  const pr = payRange(g);
  x.fillStyle = "#06070d";
  x.fillRect(0, T.edgeY, LW, T.height - T.edgeY);
  x.fillStyle = fever ? "#3a2a00" : "#14321f";
  x.fillRect(fever ? T.wallL : pr.l, T.edgeY + 4, fever ? T.wallR - T.wallL : pr.r - pr.l, 46);
  if (part(g, "center") && !fever) {
    const cw = (pr.r - pr.l) / 6;
    x.fillStyle = "#13434d";
    x.fillRect(LW / 2 - cw, T.edgeY + 4, cw * 2, 46);
    x.fillStyle = "#7dfcff";
    x.font = "700 10px system-ui, sans-serif";
    x.fillText("×2", LW / 2, T.edgeY + 40);
  }
  x.fillStyle = fever ? "#ffd23a" : "#59ff8f";
  x.font = "900 16px system-ui, sans-serif";
  x.fillText(fever ? "FEVER 没収なし" : "▼ GET ▼", LW / 2, T.edgeY + 62);
  if (!fever) {
    x.fillStyle = "#3a0d12";
    x.fillRect(T.wallL, T.edgeY + 4, pr.l - T.wallL, 46);
    x.fillRect(pr.r, T.edgeY + 4, T.wallR - pr.r, 46);
    x.fillStyle = "#ff5a5a";
    x.font = "700 11px system-ui, sans-serif";
    if (pr.l - T.wallL > 22) {
      x.fillText("没収", (T.wallL + pr.l) / 2, T.edgeY + 27);
      x.fillText("没収", (pr.r + T.wallR) / 2, T.edgeY + 27);
    }
  }
  x.fillStyle = "#c9cde0";
  x.fillRect(T.wallL, T.edgeY - 2, T.wallR - T.wallL, 3);

  // メダル（盤面）
  const draw = (kind: CoinKind, cx: number, cy: number, s = 1) => {
    const sp = sprites.get(kind)!;
    const w = (sp.width / scale) * s;
    x.drawImage(sp, cx - w / 2, cy - w / 2, w, w);
  };
  for (const m of g.medals) {
    if (m.state !== "field") continue;
    draw(m.kind, m.x, m.y);
    if (m.kind === "bomb") {
      // 導火線の残り
      const k = Math.min(1, m.t / T.bombFuse);
      const blink = k > 0.6 && Math.floor(m.t * (k > 0.85 ? 16 : 8)) % 2 === 0;
      x.strokeStyle = blink ? "#ffffff" : "#ff4d4d";
      x.lineWidth = 2.5;
      x.beginPath();
      x.arc(m.x, m.y, m.r + 3, -Math.PI / 2, -Math.PI / 2 + (1 - k) * Math.PI * 2);
      x.stroke();
    } else if (isBad(m.kind)) {
      x.strokeStyle = `rgba(200,140,255,${0.4 + 0.3 * Math.sin(g.time * 5)})`;
      x.lineWidth = 2;
      x.beginPath();
      x.arc(m.x, m.y, m.r + 3, 0, Math.PI * 2);
      x.stroke();
    }
  }

  // プッシャー
  const py = g.pusherY;
  const pg = x.createLinearGradient(0, fieldTop - 20, 0, py);
  pg.addColorStop(0, "#5b6180");
  pg.addColorStop(1, "#b9bed6");
  x.fillStyle = pg;
  x.fillRect(T.wallL, fieldTop - 6, T.wallR - T.wallL, py - fieldTop + 6);
  x.fillStyle = fever ? "#ffd23a" : "#e8ebf7";
  x.fillRect(T.wallL, py - 5, T.wallR - T.wallL, 5);
  x.fillStyle = "rgba(0,0,0,0.35)";
  x.fillRect(T.wallL, py, T.wallR - T.wallL, 4);
  x.fillStyle = "rgba(255,255,255,0.12)";
  for (let i = 0; i < 9; i++) {
    const yy = fieldTop + ((i * 14 + (py - T.pusherMid)) % 126);
    if (yy < py - 8 && yy > fieldTop - 4) x.fillRect(T.wallL + 6, yy, T.wallR - T.wallL - 12, 3);
  }

  // 落下中・投入中
  for (const m of g.medals) {
    if (m.state === "fall") {
      if (m.y < -100) continue;
      const k = m.t / 0.35;
      x.globalAlpha = Math.max(0, 1 - k);
      if (!m.paid) x.filter = "brightness(0.45)";
      draw(m.kind, m.x, m.y, 1 - k * 0.5);
      x.filter = "none";
      x.globalAlpha = 1;
    } else if (m.state === "drop") {
      const deck = T.deckR / T.r; // 釘エリアでは当たり判定に合わせて小さく描く
      if (m.pin) {
        draw(m.kind, m.x, m.y, deck);
        continue;
      }
      const k = Math.max(0, Math.min(1, m.t / m.dur));
      if (m.y0 > 20) {
        draw(m.kind, m.x, m.y, deck + (1 - deck) * k);
        continue;
      }
      x.fillStyle = "rgba(0,0,0,0.3)";
      x.beginPath();
      x.ellipse(m.x + 6 * (1 - k), m.y + 6 * (1 - k), m.r, m.r * 0.8, 0, 0, Math.PI * 2);
      x.fill();
      draw(m.kind, m.x, m.y, 1.6 - 0.6 * k);
    }
  }

  for (const p of fx.parts) {
    x.globalAlpha = Math.max(0, 1 - p.t / p.life);
    x.fillStyle = p.color;
    x.save();
    x.translate(p.x, p.y - TOP);
    x.rotate(p.spin * p.t);
    x.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    x.restore();
  }
  x.globalAlpha = 1;
  x.restore();

  // 浮き文字（暗い縁取りで明暗どちらの背景でも読める）
  x.textAlign = "center";
  x.textBaseline = "middle";
  for (const f of fx.floats) {
    const k = f.t / f.life;
    const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.6 : 1.2 - Math.min(0.2, (k - 0.15) * 0.4);
    x.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    x.font = `900 ${f.size * pop}px system-ui, sans-serif`;
    x.lineWidth = 4;
    x.strokeStyle = "#000";
    x.strokeText(f.text, f.x, f.y - k * 30);
    x.fillStyle = f.color;
    x.fillText(f.text, f.x, f.y - k * 30);
  }
  x.globalAlpha = 1;

  if (fx.banner) {
    const b = fx.banner;
    const k = b.t / b.life;
    const sc = k < 0.1 ? 0.3 + (k / 0.1) * 0.9 : k < 0.18 ? 1.2 - ((k - 0.1) / 0.08) * 0.2 : 1;
    x.globalAlpha = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
    x.fillStyle = "rgba(0,0,0,0.6)";
    x.fillRect(0, TOP + 230, LW, 110);
    x.save();
    x.translate(LW / 2, TOP + 272);
    x.scale(sc, sc);
    x.font = "900 40px system-ui, sans-serif";
    x.lineWidth = 7;
    x.strokeStyle = "#000";
    x.strokeText(b.text, 0, 0);
    x.fillStyle = b.color;
    x.fillText(b.text, 0, 0);
    x.restore();
    x.font = "700 14px system-ui, sans-serif";
    x.fillStyle = "#fff";
    x.fillText(b.sub, LW / 2, TOP + 318);
    x.globalAlpha = 1;
  }

  // フラッシュ（明→暗を交互に）
  if (fx.flash > 0) {
    const on = Math.floor(fx.flash * 30) % 2 === 0;
    x.fillStyle = on ? `rgba(255,255,255,${Math.min(0.55, fx.flash)})` : `rgba(0,0,0,${Math.min(0.35, fx.flash)})`;
    x.fillRect(-20, -20, LW + 40, LH + 40);
  }
}

function drawSlot(x: CanvasRenderingContext2D, g: Game) {
  const T = TUNING;
  const rl = g.reels;
  const fever = g.fever > 0;
  x.fillStyle = fever ? `hsl(${(g.time * 200) % 360} 70% 22%)` : "#14182b";
  x.fillRect(0, 0, LW, TOP);
  const reach = rl.spinning && rl.reach && rl.stopped >= 2;
  const rw = 66;
  const rh = 66;
  const gap = 8;
  const x0 = LW / 2 - (rw * 3 + gap * 2) / 2;
  const y0 = 10;
  for (let i = 0; i < 3; i++) {
    const rx = x0 + i * (rw + gap);
    x.fillStyle = "#f4f1e6";
    roundRect(x, rx, y0, rw, rh, 8);
    x.fill();
    const spinning = rl.spinning && i >= rl.stopped;
    x.save();
    roundRect(x, rx, y0, rw, rh, 8);
    x.clip();
    if (spinning) {
      const speed = i === 2 && reach ? 9 : 18;
      const pos = rl.t * speed + i * 3;
      const idx = Math.floor(pos);
      const frac = pos - idx;
      for (let k = -1; k <= 1; k++) {
        const s = REEL_STRIP[(((idx + k) % REEL_STRIP.length) + REEL_STRIP.length) % REEL_STRIP.length];
        drawSymbol(x, s, rx + rw / 2, y0 + rh / 2 + (frac - k) * rh);
      }
      x.fillStyle = "rgba(255,255,255,0.25)";
      x.fillRect(rx, y0, rw, rh);
    } else {
      drawSymbol(x, rl.result[i], rx + rw / 2, y0 + rh / 2);
    }
    x.restore();
    x.lineWidth = 3;
    x.strokeStyle = reach && i === 2 ? (Math.floor(g.time * 12) % 2 ? "#ff2b2b" : "#ffd23a") : "#6b6f88";
    roundRect(x, rx, y0, rw, rh, 8);
    x.stroke();
  }
  if (reach) {
    x.font = "900 16px system-ui, sans-serif";
    x.textAlign = "center";
    x.fillStyle = Math.floor(g.time * 8) % 2 ? "#ff2b2b" : "#ffffff";
    x.fillText("リーチ!", LW / 2, y0 + rh + 13);
  }
  x.textAlign = "left";
  x.font = "700 10px system-ui, sans-serif";
  x.fillStyle = "#9aa0bf";
  x.fillText("保留", 10, 22);
  for (let i = 0; i < T.maxStock; i++) {
    x.beginPath();
    x.arc(14 + Math.floor(i / 5) * 13, 36 + (i % 5) * 12, 4.5, 0, Math.PI * 2);
    x.fillStyle = i < g.stock ? "#7dfcff" : "#2a2f48";
    x.fill();
  }
  if (fever) {
    x.textAlign = "right";
    x.font = "900 14px system-ui, sans-serif";
    x.fillStyle = "#ffd23a";
    x.fillText("FEVER", LW - 10, 30);
    x.font = "900 22px system-ui, sans-serif";
    x.fillText(`${Math.ceil(g.fever)}`, LW - 10, 54);
  }
  if (g.showerQueue.length > 0) {
    x.textAlign = "right";
    x.font = "700 11px system-ui, sans-serif";
    x.fillStyle = "#ffffff";
    x.fillText(`払出 ${g.showerQueue.length}`, LW - 10, 80);
  }
  x.textAlign = "center";
}
