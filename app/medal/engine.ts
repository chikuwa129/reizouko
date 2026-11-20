// メダル落とし: ゲームロジック（描画・音とは分離）
// ローグライク構成: ラウンドごとの目標スコア → ショップで強化 → 次のラウンド
// 調整値は TUNING に集約し、コードを触らずに手触りを変えられるようにしている。

export const TUNING = {
  // 盤面（論理座標）
  width: 360,
  height: 600,
  wallL: 18,
  wallR: 342,
  pusherBack: 96,
  pusherMid: 168,
  pusherAmp: 34,
  pusherSpeed: 1.9, // rad/s
  edgeY: 520,

  // メダル
  r: 13,
  damping: 0.82,
  solverIters: 6,
  prefillGap: 0.12,
  minField: 110, // ラウンド開始時、盤面がこれより少なければ補充

  // 投入
  dropTime: 0.32,
  autoFireInterval: 0.16,

  // チャッカー（ゲート）
  gateY: 82,
  // 釘（投入口とINのあいだ）。メダルはここで弾かれて軌道が変わる
  pinRows: [28, 44, 60],
  pinGap: 40,
  pinR: 3,
  pinNail: 2, // 命釘の締め具合（大きいほどINが狭い）
  deckR: 9, // 釘エリアでのメダルの当たり判定（転がっている想定で小さめ）
  deckGravity: 900,
  pinBounce: 0.45,
  pinJitter: 120, // 弾かれたときの横方向のばらつき（px/秒）
  launchThrow: 0.25, // 投入口の移動速度がメダルに乗る割合
  gateW: 40,
  gateSpeed: 55, // px/秒
  gateMin: 70,
  gateMax: 290,
  // 投入口（左右に往復。INは中央に固定）
  launchSpeed: 150, // px/秒（等速で往復するのでタイミングを読みやすい）
  launchMin: 34,
  launchMax: 326,

  // スロット
  maxStock: 10,
  reelStops: [0.45, 0.65, 0.85],
  reachExtra: 0.7,
  pJackpot: 0.012,
  pBell: 0.08,
  pCherry: 0.1,
  payJackpot: 20,
  payBell: 4,
  payCherry: 2,
  pFakeReach: 0.35,
  feverTime: 8, // FEVER中は得点2倍＆プッシャー高速
  feverPusherMul: 1.7,

  // ラウンド
  rounds: 12, // ここまでクリアで制覇（以降はエンドレス）
  targets: [20, 40, 70, 120, 200, 340, 580, 1000, 1700, 2900, 5000, 8500],
  endlessGrowth: 1.6,
  handPerRound: 70,
  overflowMax: 30, // 目標超過ボーナス（目標の10%ごとに1チケット）の上限
  clearBonus: 6, // クリア時のチケット（+ラウンド数、+残りメダル÷2）
  settleDelay: 2.5, // 手持ち0で盤面が落ち着くまでの猶予
  buyMedals: 10, // チケットで買えるメダル枚数
  caseSize: 4,
  caseMax: 7,

  // 特殊コイン
  bombFuse: 1.8,
  bombRadius: 115,
  bombPower: 20,
  magnetPull: 0.006,
  bigScale: 1.55,
  leadMass: 6,
  curseTarget: 0.25, // 呪いコインが盤面にある間、目標+25%
  rustPenalty: 8,
};

export type Symbol = "7" | "BELL" | "CHERRY" | "BAR" | "STAR";
export const SYMBOLS: Symbol[] = ["7", "BELL", "CHERRY", "BAR", "STAR"];

export type SpecialKind = "gold" | "mult" | "bomb" | "split" | "chance" | "big" | "magnet";
export type BadKind = "curse" | "rust" | "lead";
export type CoinKind = "normal" | SpecialKind | BadKind;

export const SPECIAL_KINDS: SpecialKind[] = ["gold", "mult", "bomb", "split", "chance", "big", "magnet"];

export const COIN_INFO: Record<CoinKind, { name: string; desc: string; pts: number; price: number }> = {
  normal: { name: "メダル", desc: "1点", pts: 1, price: 0 },
  gold: { name: "金貨", desc: "GETで10点", pts: 10, price: 7 },
  mult: { name: "倍率コイン", desc: "GETでこのラウンドの倍率+1", pts: 1, price: 14 },
  bomb: { name: "爆弾コイン", desc: "着地して少しすると大爆発。周りのメダルをGET口へ吹き飛ばす", pts: 0, price: 10 },
  split: { name: "分裂コイン", desc: "GETでメダル6枚が降ってくる", pts: 1, price: 9 },
  chance: { name: "チャンスコイン", desc: "GETでスロット2回", pts: 1, price: 8 },
  big: { name: "巨大コイン", desc: "大きくて重く、押す力が強い。GETで5点", pts: 5, price: 9 },
  magnet: { name: "磁石コイン", desc: "盤面にある間、メダルが中央に寄る", pts: 1, price: 10 },
  curse: { name: "呪いコイン", desc: "盤面にある間、目標スコア+25%", pts: 0, price: 0 },
  rust: { name: "サビコイン", desc: `GETすると-${8}点`, pts: 0, price: 0 },
  lead: { name: "鉛コイン", desc: "とても重く、押し出しをせき止める", pts: 0, price: 0 },
};

export const isBad = (k: CoinKind): k is BadKind => k === "curse" || k === "rust" || k === "lead";

export type MedalState = "drop" | "field" | "fall";

export interface Medal {
  id: number;
  kind: CoinKind;
  r: number;
  x: number;
  y: number;
  px: number;
  py: number;
  state: MedalState;
  t: number;
  sx: number;
  checked: boolean;
  pin: boolean; // 釘エリアを物理で落下中
  vx: number;
  vy: number;
  y0: number; // 着地までの演出用
  dur: number;
  paid: boolean;
  tilt: number;
}

export interface Reels {
  spinning: boolean;
  t: number;
  result: Symbol[];
  stopped: number;
  reach: boolean;
  duration: number;
}

// 台改造パーツ（ラン中ずっと有効）
export interface Part {
  id: string;
  name: string;
  desc: string;
  price: number;
  max: number; // 重ねがけ上限
}

export const PARTS: Part[] = [
  { id: "polish", name: "メダル研磨", desc: "通常メダルの点数+1", price: 12, max: 3 },
  { id: "center", name: "センターポケット", desc: "GET口の中央でGETすると点数2倍", price: 14, max: 1 },
  { id: "combo", name: "連鎖カウンター", desc: "続けて10枚GETするごとに倍率+0.5（そのラウンド）", price: 16, max: 1 },
  { id: "slotlink", name: "スロット連動", desc: "スロットが当たるたびに倍率+0.5（そのラウンド）", price: 12, max: 2 },
  { id: "fever", name: "FEVER延長", desc: "FEVERの時間+4秒", price: 10, max: 3 },
  { id: "pusher", name: "ロングプッシャー", desc: "プッシャーの押し出しが深くなる", price: 10, max: 3 },
  { id: "gate", name: "ワイドゲート", desc: "INの命釘が開いて入りやすくなる", price: 8, max: 3 },
  { id: "lucky", name: "ラッキー7", desc: "スロットの777が出やすくなる", price: 12, max: 2 },
  { id: "bag", name: "チケット袋", desc: "GETしたメダル5枚ごとにチケット+1", price: 10, max: 2 },
  { id: "spare", name: "予備メダル", desc: "毎ラウンドの手持ち+10枚", price: 8, max: 3 },
  { id: "double", name: "ダブル投入", desc: "20%で1枚分の投入で2枚落ちる", price: 14, max: 2 },
  { id: "case", name: "ケース拡張", desc: "特殊コインを持てる数+1", price: 8, max: 3 },
];

export type Offer = { type: "coin"; kind: SpecialKind; price: number; sold: boolean } | { type: "part"; id: string; price: number; sold: boolean };

export type Mode = "play" | "shop" | "fail" | "over";

export type GameEvent =
  | { type: "drop"; x: number; kind: CoinKind }
  | { type: "land"; x: number; y: number }
  | { type: "pay"; x: number; kind: CoinKind; pts: number; center: boolean }
  | { type: "lost"; x: number; kind: CoinKind }
  | { type: "checkin"; x: number }
  | { type: "stockFull" }
  | { type: "reelStop"; index: number; reach: boolean }
  | { type: "reach" }
  | { type: "win"; kind: "jackpot" | "bell" | "cherry"; amount: number }
  | { type: "miss" }
  | { type: "feverEnd" }
  | { type: "explode"; x: number; y: number }
  | { type: "mult"; mult: number; x: number }
  | { type: "badGone"; kind: BadKind }
  | { type: "roundClear"; round: number; tickets: number; leftover: number; over: number }
  | { type: "fail" }
  | { type: "gameOver"; round: number }
  | { type: "allClear" }
  | { type: "clearHold" }
  | { type: "pin"; x: number };

export interface Game {
  medals: Medal[];
  nextId: number;
  mode: Mode;
  // ラン
  round: number;
  score: number;
  hand: number;
  tickets: number;
  mult: number;
  coinCase: SpecialKind[];
  used: boolean[];
  queue: number[]; // このラウンドに出すコインの順番（-1=通常、0以上=コインケースの番号）
  parts: Record<string, number>;
  offers: Offer[];
  rerollCost: number;
  best: number;
  comboRun: number;
  clearHold: boolean; // 目標達成済みだが、FEVER・払い出し中なので続行中
  bagCount: number;
  // 台
  phase: number;
  pusherY: number;
  gateX: number; // INの位置（左右に往復）
  gateDir: number;
  launchX: number; // 投入口の位置
  launchDir: number;
  stock: number;
  reels: Reels;
  fever: number;
  showerQueue: CoinKind[];
  showerTimer: number;
  idle: number;
  time: number;
  rng: () => number;
}

export interface SaveData {
  round: number;
  tickets: number;
  coinCase: SpecialKind[];
  parts: Record<string, number>;
  best: number;
  mode: "shop" | "play";
  offers?: Offer[];
  rerollCost?: number;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const part = (g: Game, id: string) => g.parts[id] ?? 0;
export const gateWide = (g: Game) => part(g, "gate") * 3;

export function baseTarget(round: number) {
  const T = TUNING;
  if (round <= T.targets.length) return T.targets[round - 1];
  return Math.round(T.targets[T.targets.length - 1] * Math.pow(T.endlessGrowth, round - T.targets.length));
}

export function target(g: Game) {
  const curses = g.medals.filter((m) => m.kind === "curse" && m.state !== "fall").length;
  return Math.round(baseTarget(g.round) * (1 + TUNING.curseTarget * curses));
}

// GET口（没収ゾーンはなし。落ちたメダルはすべてGET）
export function payRange() {
  return { l: TUNING.wallL, r: TUNING.wallR };
}

export function caseSize(g: Game) {
  return Math.min(TUNING.caseMax, TUNING.caseSize + part(g, "case"));
}

export function handPerRound(g: Game) {
  return TUNING.handPerRound + part(g, "spare") * 10;
}

export function buyMedalsPrice(g: Game) {
  return 6 + g.round * 2;
}

let pinCache: { x: number; y: number }[] | null = null;
// 釘（固定）＋ INと一緒に動く左右の命釘
// gateX: INの位置 / wide: ワイドゲートによる命釘の開き（片側px）
export function pins(gateX: number, wide = 0) {
  const T = TUNING;
  if (!pinCache) {
    const out: { x: number; y: number }[] = [];
    T.pinRows.forEach((y, row) => {
      const off = row % 2 ? T.pinGap / 2 : 0;
      for (let x = T.width / 2 - T.pinGap * 4 + off; x <= T.wallR - 10; x += T.pinGap) {
        if (x < T.wallL + 10) continue;
        out.push({ x, y });
      }
    });
    pinCache = out;
  }
  const half = T.gateW / 2 - T.pinNail + wide;
  return [...pinCache, { x: gateX - half, y: T.gateY - 10 }, { x: gateX + half, y: T.gateY - 10 }];
}

function radiusOf(kind: CoinKind) {
  return kind === "big" || kind === "lead" ? TUNING.r * TUNING.bigScale : TUNING.r;
}

function massOf(kind: CoinKind) {
  return kind === "lead" ? TUNING.leadMass : kind === "big" ? 3 : 1;
}

function newMedal(g: Game, x: number, y: number, state: MedalState, kind: CoinKind = "normal"): Medal {
  return { id: g.nextId++, kind, r: radiusOf(kind), x, y, px: x, py: y, state, t: 0, sx: x, checked: false, pin: false, vx: 0, vy: 0, y0: y, dur: TUNING.dropTime, paid: false, tilt: g.rng() * Math.PI * 2 };
}

function fillField(g: Game) {
  const T = TUNING;
  const yMin = T.pusherMid + T.pusherAmp + T.r;
  const rowH = T.r * 2 * 0.87;
  let row = 0;
  for (let y = T.edgeY - T.r * 0.3; y > yMin; y -= rowH, row++) {
    const off = row % 2 ? T.r : 0;
    for (let x = T.wallL + T.r + off; x <= T.wallR - T.r; x += T.r * 2) {
      if (g.rng() < T.prefillGap) continue;
      const nx = x + (g.rng() - 0.5) * 2;
      if (g.medals.some((m) => m.state === "field" && (m.x - nx) ** 2 + (m.y - y) ** 2 < ((m.r + T.r) * 0.9) ** 2)) continue;
      g.medals.push(newMedal(g, nx, y, "field"));
    }
  }
}

export function createGame(opts: { save?: Partial<SaveData>; seed?: number } = {}): Game {
  const T = TUNING;
  const s = opts.save ?? {};
  const g: Game = {
    medals: [],
    nextId: 1,
    mode: "play",
    round: s.round ?? 1,
    score: 0,
    hand: 0,
    tickets: s.tickets ?? 5,
    mult: 1,
    coinCase: [...(s.coinCase ?? [])],
    used: [],
    queue: [],
    parts: { ...(s.parts ?? {}) },
    offers: s.offers ?? [],
    rerollCost: s.rerollCost ?? 2,
    best: s.best ?? 0,
    comboRun: 0,
    clearHold: false,
    bagCount: 0,
    phase: 0,
    pusherY: T.pusherMid,
    gateX: T.width / 2,
    gateDir: -1,
    launchX: T.width / 2,
    launchDir: 1,
    stock: 0,
    reels: { spinning: false, t: 0, result: ["7", "BELL", "CHERRY"], stopped: 3, reach: false, duration: 0 },
    fever: 0,
    showerQueue: [],
    showerTimer: 0,
    idle: 0,
    time: 0,
    rng: mulberry32(opts.seed ?? (Date.now() ^ (Math.random() * 1e9))),
  };
  fillField(g);
  if (s.mode === "shop") {
    g.mode = "shop";
    if (!g.offers.length) rollOffers(g);
  } else {
    startRound(g);
  }
  return g;
}

export function toSave(g: Game): SaveData {
  // ラウンド途中で閉じた場合は、そのラウンドの最初からやり直し
  return {
    round: g.round,
    tickets: g.tickets,
    coinCase: g.coinCase,
    parts: g.parts,
    best: g.best,
    mode: g.mode === "shop" ? "shop" : "play",
    offers: g.mode === "shop" ? g.offers : undefined,
    rerollCost: g.rerollCost,
  };
}

export function newRun(g: Game) {
  const best = g.best;
  const fresh = createGame({ save: { best } });
  Object.assign(g, fresh);
}

function startRound(g: Game) {
  const T = TUNING;
  g.mode = "play";
  g.score = 0;
  g.mult = 1;
  // 手持ちのメダルに特殊コインをランダムに混ぜる（終盤に偏りすぎないよう前85%の範囲に）
  const q: number[] = Array(handPerRound(g)).fill(-1);
  g.coinCase.forEach((_, i) => {
    const pos = 1 + Math.floor(g.rng() * Math.max(1, q.length * 0.85));
    q.splice(pos, 0, i);
  });
  g.queue = q;
  g.hand = q.length;
  g.used = g.coinCase.map(() => false);
  g.comboRun = 0;
  g.clearHold = false;
  g.bagCount = 0;
  g.idle = 0;
  g.stock = 0;
  g.fever = 0;
  g.showerQueue = [];
  // 前のラウンドの落下中・投入中は片付ける
  g.medals = g.medals.filter((m) => m.state === "field");
  if (g.medals.length < T.minField) fillField(g);
  // お邪魔コイン（ラウンド3から）
  const nBad = g.round >= 9 ? 3 : g.round >= 6 ? 2 : g.round >= 3 ? 1 : 0;
  const kinds: BadKind[] = ["curse", "rust", "lead"];
  for (let i = 0; i < nBad; i++) {
    const kind = kinds[Math.floor(g.rng() * kinds.length)];
    const x = T.wallL + 40 + g.rng() * (T.wallR - T.wallL - 80);
    const y = T.pusherMid + T.pusherAmp + 40 + g.rng() * 140;
    const m = newMedal(g, x, y, "field", kind);
    g.medals.push(m);
  }
}

export function nextRound(g: Game) {
  if (g.mode !== "shop") return;
  g.round++;
  g.offers = [];
  startRound(g);
}

// ショップ
export function rollOffers(g: Game) {
  const coins: Offer[] = [];
  const pool = [...SPECIAL_KINDS];
  for (let i = 0; i < 3; i++) {
    const k = pool.splice(Math.floor(g.rng() * pool.length), 1)[0]; // 同じコインは並べない
    coins.push({ type: "coin", kind: k, price: COIN_INFO[k].price, sold: false });
  }
  const avail = PARTS.filter((p) => part(g, p.id) < p.max && !(p.id === "case" && caseSize(g) >= TUNING.caseMax));
  const parts: Offer[] = [];
  for (let i = 0; i < 2 && avail.length; i++) {
    const idx = Math.floor(g.rng() * avail.length);
    const p = avail.splice(idx, 1)[0];
    parts.push({ type: "part", id: p.id, price: p.price + part(g, p.id) * 6, sold: false });
  }
  g.offers = [...coins, ...parts];
}

export function canBuy(g: Game, i: number) {
  const o = g.offers[i];
  if (!o || o.sold || g.tickets < o.price) return false;
  if (o.type === "coin" && g.coinCase.length >= caseSize(g)) return false;
  return true;
}

export function buy(g: Game, i: number) {
  if (!canBuy(g, i)) return false;
  const o = g.offers[i];
  g.tickets -= o.price;
  o.sold = true;
  if (o.type === "coin") g.coinCase.push(o.kind);
  else g.parts[o.id] = part(g, o.id) + 1;
  return true;
}

export function sellCoin(g: Game, i: number) {
  if (g.mode !== "shop" || !g.coinCase[i]) return;
  g.tickets += Math.floor(COIN_INFO[g.coinCase[i]].price / 2);
  g.coinCase.splice(i, 1);
}

export function reroll(g: Game) {
  if (g.tickets < g.rerollCost) return false;
  g.tickets -= g.rerollCost;
  g.rerollCost += 1;
  rollOffers(g);
  return true;
}

// 手持ちが尽きたとき
export function buyMedals(g: Game) {
  if (g.mode !== "fail" || g.tickets < buyMedalsPrice(g)) return false;
  g.tickets -= buyMedalsPrice(g);
  for (let i = 0; i < TUNING.buyMedals; i++) g.queue.push(-1);
  g.hand = g.queue.length;
  g.mode = "play";
  g.idle = 0;
  return true;
}

export function giveUp(g: Game, ev: GameEvent[]) {
  g.mode = "over";
  ev.push({ type: "gameOver", round: g.round });
}

// 次に出るコイン
export function nextKind(g: Game): CoinKind | null {
  if (!g.queue.length) return null;
  const q = g.queue[0];
  return q < 0 ? "normal" : g.coinCase[q];
}

export function dropMedal(g: Game, x: number, ev: GameEvent[]): boolean {
  const T = TUNING;
  if (g.mode !== "play" || !g.queue.length) return false;
  const q = g.queue.shift()!;
  g.hand = g.queue.length;
  let kinds: CoinKind[];
  if (q >= 0) {
    kinds = [g.coinCase[q]];
    g.used[q] = true;
  } else {
    kinds = g.rng() < part(g, "double") * 0.2 ? ["normal", "normal"] : ["normal"];
  }
  kinds.forEach((kind, i) => {
    const r = radiusOf(kind);
    const cx = Math.max(T.wallL + r, Math.min(T.wallR - r, x + (i ? (g.rng() < 0.5 ? -1 : 1) * T.r * 2 : 0)));
    const m = newMedal(g, cx, 16, "drop", kind);
    m.pin = true;
    m.vx = g.launchDir * T.launchSpeed * T.launchThrow + (i ? (g.rng() - 0.5) * 60 : 0);
    m.vy = 60 - i * 40;
    g.medals.push(m);
    ev.push({ type: "drop", x: cx, kind });
  });
  return true;
}

function rollReels(g: Game): { result: Symbol[]; reach: boolean } {
  const T = TUNING;
  const r = g.rng();
  const pick = (exclude?: Symbol) => {
    let s: Symbol;
    do s = SYMBOLS[Math.floor(g.rng() * SYMBOLS.length)];
    while (s === exclude);
    return s;
  };
  const pj = T.pJackpot + part(g, "lucky") * 0.01;
  if (r < pj) return { result: ["7", "7", "7"], reach: true };
  if (r < pj + T.pBell) return { result: ["BELL", "BELL", "BELL"], reach: true };
  if (r < pj + T.pBell + T.pCherry) return { result: ["CHERRY", "CHERRY", "CHERRY"], reach: true };
  if (g.rng() < T.pFakeReach) {
    const a = g.rng() < 0.55 ? "7" : pick();
    return { result: [a, a, pick(a)], reach: true };
  }
  const a = pick();
  const b = pick(a);
  return { result: [a, b, pick()], reach: false };
}

function startSpin(g: Game) {
  const { result, reach } = rollReels(g);
  g.stock--;
  g.reels = { spinning: true, t: 0, result, stopped: 0, reach, duration: TUNING.reelStops[2] + (reach ? TUNING.reachExtra : 0) };
}

function addShower(g: Game, n: number, kind: CoinKind = "normal") {
  for (let i = 0; i < n; i++) g.showerQueue.push(kind);
}

function addMult(g: Game, n: number, x: number, ev: GameEvent[]) {
  g.mult = Math.round((g.mult + n) * 10) / 10;
  ev.push({ type: "mult", mult: g.mult, x });
}

export function step(g: Game, dt: number, ev: GameEvent[]) {
  const T = TUNING;
  if (g.mode !== "play") return;
  g.time += dt;

  // プッシャー
  g.phase += dt * T.pusherSpeed * (g.fever > 0 ? T.feverPusherMul : 1);
  g.pusherY = T.pusherMid + Math.sin(g.phase) * (T.pusherAmp + part(g, "pusher") * 7);

  // ゲート
  // INの往復（投入口とは別の速さ）
  g.gateX += g.gateDir * T.gateSpeed * dt;
  if (g.gateX > T.gateMax) {
    g.gateX = T.gateMax;
    g.gateDir = -1;
  } else if (g.gateX < T.gateMin) {
    g.gateX = T.gateMin;
    g.gateDir = 1;
  }
  // 投入口の往復
  g.launchX += g.launchDir * T.launchSpeed * dt;
  if (g.launchX > T.launchMax) {
    g.launchX = T.launchMax;
    g.launchDir = -1;
  } else if (g.launchX < T.launchMin) {
    g.launchX = T.launchMin;
    g.launchDir = 1;
  }

  if (g.fever > 0) {
    g.fever -= dt;
    if (g.fever <= 0) {
      g.fever = 0;
      ev.push({ type: "feverEnd" });
    }
  }

  // シャワー
  if (g.showerQueue.length > 0) {
    g.showerTimer -= dt;
    while (g.showerTimer <= 0 && g.showerQueue.length > 0) {
      g.showerTimer += 0.045;
      const kind = g.showerQueue.shift()!;
      const r = radiusOf(kind);
      const x = T.wallL + r + g.rng() * (T.wallR - T.wallL - 2 * r);
      const m = newMedal(g, x, 10, "drop", kind);
      m.checked = true;
      g.medals.push(m);
    }
  } else {
    g.showerTimer = 0;
  }

  // スロット
  const rl = g.reels;
  if (!rl.spinning && g.stock > 0) startSpin(g);
  if (rl.spinning) {
    rl.t += dt;
    while (rl.stopped < 3 && rl.t >= (rl.stopped === 2 ? rl.duration : T.reelStops[rl.stopped])) {
      const idx = rl.stopped;
      rl.stopped++;
      const reachNow = idx === 1 && rl.result[0] === rl.result[1];
      ev.push({ type: "reelStop", index: idx, reach: reachNow });
      if (reachNow) ev.push({ type: "reach" });
    }
    if (rl.stopped >= 3) {
      rl.spinning = false;
      const [a, b, c] = rl.result;
      if (a === b && b === c) {
        let kind: "jackpot" | "bell" | "cherry";
        let n: number;
        if (a === "7") {
          g.fever = T.feverTime + part(g, "fever") * 4;
          kind = "jackpot";
          n = T.payJackpot;
        } else if (a === "BELL") {
          kind = "bell";
          n = T.payBell;
        } else {
          kind = "cherry";
          n = T.payCherry;
        }
        addShower(g, n);
        ev.push({ type: "win", kind, amount: n });
        if (part(g, "slotlink")) addMult(g, 0.5 * part(g, "slotlink"), T.width / 2, ev);
      } else {
        ev.push({ type: "miss" });
      }
    }
  }

  // メダル更新
  const live: Medal[] = [];
  let magnets = 0;
  for (const m of g.medals) {
    m.t += dt;
    if (m.state === "drop") {
      if (m.pin) {
        // 釘エリア: 重力で転がり落ち、釘に当たるとランダムに弾かれる
        m.vy += T.deckGravity * dt;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        const rr = T.deckR + T.pinR;
        for (const p of pins(g.gateX, gateWide(g))) {
          const dx = m.x - p.x;
          const dy = m.y - p.y;
          const d2 = dx * dx + dy * dy;
          if (d2 >= rr * rr || d2 < 1e-6) continue;
          const d = Math.sqrt(d2);
          const nx = dx / d;
          const ny = dy / d;
          m.x = p.x + nx * rr;
          m.y = p.y + ny * rr;
          const vn = m.vx * nx + m.vy * ny;
          if (vn < 0) {
            m.vx -= (1 + T.pinBounce) * vn * nx;
            m.vy -= (1 + T.pinBounce) * vn * ny;
            m.vx += (g.rng() - 0.5) * 2 * T.pinJitter;
            ev.push({ type: "pin", x: m.x });
          }
        }
        if (m.x < T.wallL + T.deckR) {
          m.x = T.wallL + T.deckR;
          m.vx = Math.abs(m.vx) * 0.5;
        } else if (m.x > T.wallR - T.deckR) {
          m.x = T.wallR - T.deckR;
          m.vx = -Math.abs(m.vx) * 0.5;
        }
        if (m.y < T.gateY) continue;
        // INの高さに到達
        m.pin = false;
        m.checked = true;
        // INを通過したら保留+1。メダルはそのまま盤面へ落ちる
        if (Math.abs(m.x - g.gateX) < T.gateW / 2 + gateWide(g)) {
          if (g.stock < T.maxStock) {
            g.stock++;
            ev.push({ type: "checkin", x: m.x });
          } else ev.push({ type: "stockFull" });
        }
        m.x = Math.max(T.wallL + m.r, Math.min(T.wallR - m.r, m.x));
        m.sx = m.x;
        m.y0 = m.y;
        m.dur = 0.12;
        m.t = 0;
      }
      // 盤面への着地（演出）
      const k = Math.max(0, Math.min(1, m.t / m.dur));
      const landY = g.pusherY + m.r + 4;
      m.y = m.y0 + (landY - m.y0) * (k * k);
      m.x = m.sx;
      if (k >= 1) {
        m.state = "field";
        m.t = 0;
        m.px = m.x;
        m.py = m.y - 1.5;
        ev.push({ type: "land", x: m.x, y: m.y });
      }
    } else if (m.state === "field") {
      const vx = (m.x - m.px) * T.damping;
      const vy = (m.y - m.py) * T.damping;
      m.px = m.x;
      m.py = m.y;
      m.x += vx;
      m.y += vy;
      live.push(m);
      if (m.kind === "magnet") magnets++;
    } else {
      m.y += dt * 240;
    }
  }

  if (magnets > 0) {
    const pull = T.magnetPull * Math.min(3, magnets);
    const cx = T.width / 2;
    for (const m of live) if (m.kind !== "magnet") m.x += (cx - m.x) * pull;
  }

  // 爆弾
  for (const b of live) {
    if (b.kind !== "bomb" || b.t < T.bombFuse || b.state !== "field") continue;
    b.state = "fall";
    b.t = 0;
    b.y = -999;
    ev.push({ type: "explode", x: b.x, y: b.py });
    for (const m of live) {
      if (m === b || m.state !== "field") continue;
      const dx = m.x - b.x;
      const dy = m.y - b.py;
      const d = Math.hypot(dx, dy);
      if (d > T.bombRadius || d < 0.01) continue;
      const f = ((1 - d / T.bombRadius) * T.bombPower) / Math.sqrt(massOf(m.kind));
      // 横へ散らしつつ、主にGET口（前方）へ吹き飛ばす
      m.px = m.x - (dx / d) * f * 0.55;
      m.py = m.y - ((dy / d) * 0.35 + 0.95) * f;
    }
  }

  // 衝突解決（位置ベース）
  const field = live.filter((m) => m.state === "field");
  const face = g.pusherY;
  const cell = T.r * 2 * T.bigScale;
  for (let it = 0; it < T.solverIters; it++) {
    const grid = new Map<number, Medal[]>();
    for (const m of field) {
      const key = Math.floor(m.x / cell) * 1000 + Math.floor(m.y / cell);
      const arr = grid.get(key);
      if (arr) arr.push(m);
      else grid.set(key, [m]);
    }
    for (const a of field) {
      const cx = Math.floor(a.x / cell);
      const cy = Math.floor(a.y / cell);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const arr = grid.get((cx + dx) * 1000 + (cy + dy));
          if (!arr) continue;
          for (const b of arr) {
            if (b.id <= a.id) continue;
            const rr = a.r + b.r;
            let ddx = b.x - a.x;
            let ddy = b.y - a.y;
            let d2 = ddx * ddx + ddy * ddy;
            if (d2 >= rr * rr) continue;
            if (d2 < 1e-6) {
              ddx = g.rng() - 0.5;
              ddy = 0.5;
              d2 = ddx * ddx + ddy * ddy;
            }
            const d = Math.sqrt(d2);
            const over = (rr - d) / d;
            const aPinned = a.y <= face + a.r + 0.5;
            const bPinned = b.y <= face + b.r + 0.5;
            const ma = massOf(a.kind);
            const mb = massOf(b.kind);
            let wa = mb / (ma + mb);
            let wb = ma / (ma + mb);
            if (aPinned && !bPinned) {
              wa = 0;
              wb = 1;
            } else if (bPinned && !aPinned) {
              wa = 1;
              wb = 0;
            }
            a.x -= ddx * over * wa;
            a.y -= ddy * over * wa;
            b.x += ddx * over * wb;
            b.y += ddy * over * wb;
          }
        }
      }
    }
    for (const m of field) {
      if (m.y < face + m.r) m.y = face + m.r;
      if (m.x < T.wallL + m.r) m.x = T.wallL + m.r;
      if (m.x > T.wallR - m.r) m.x = T.wallR - m.r;
    }
  }

  // 落下判定
  const pr = payRange();
  const cw = (pr.r - pr.l) / 6;
  const feverMul = g.fever > 0 ? 2 : 1;
  for (const m of field) {
    if (m.y <= T.edgeY) continue;
    m.state = "fall";
    m.t = 0;
    if (isBad(m.kind)) {
      // お邪魔コインは落ちると消える。サビだけ減点
      m.paid = true;
      if (m.kind === "rust") {
        g.score = Math.max(0, g.score - T.rustPenalty);
        ev.push({ type: "pay", x: m.x, kind: m.kind, pts: -T.rustPenalty, center: false });
      }
      ev.push({ type: "badGone", kind: m.kind });
      continue;
    }
    m.paid = true;
    const center = part(g, "center") > 0 && Math.abs(m.x - T.width / 2) < cw;
    let base = COIN_INFO[m.kind].pts;
    if (m.kind === "normal") base += part(g, "polish");
    const pts = Math.round(base * g.mult * (center ? 2 : 1) * feverMul);
    g.score += pts;
    ev.push({ type: "pay", x: m.x, kind: m.kind, pts, center });
    if (part(g, "bag")) {
      g.bagCount++;
      if (g.bagCount >= 5) {
        g.bagCount = 0;
        g.tickets += part(g, "bag");
      }
    }
    if (m.kind === "mult") addMult(g, 1, m.x, ev);
    if (m.kind === "split") addShower(g, 6);
    if (m.kind === "chance") g.stock = Math.min(T.maxStock, g.stock + 2);
    g.comboRun++;
    if (part(g, "combo") && g.comboRun % 10 === 0) addMult(g, 0.5, m.x, ev);
  }
  g.medals = g.medals.filter((m) => !(m.state === "fall" && m.t > 0.35));

  // ラウンドクリア → ショップ
  // FEVER中・払い出し中・スロット保留中は目標を超えても続行（出し切ってからクリア）
  const tg = target(g);
  if (g.score >= tg) {
    const flowing = g.fever > 0 || g.showerQueue.length > 0 || g.reels.spinning || g.stock > 0;
    if (flowing) {
      if (!g.clearHold) {
        g.clearHold = true;
        ev.push({ type: "clearHold" });
      }
      return;
    }
    const leftover = g.queue.filter((q) => q < 0).length;
    // 目標を超えた分はボーナスチケットに
    const over = Math.min(T.overflowMax, Math.floor((g.score - tg) / Math.max(1, tg * 0.1)));
    const tickets = T.clearBonus + g.round + Math.floor(leftover / 2) + over;
    g.tickets += tickets;
    if (g.round > g.best) g.best = g.round;
    g.mode = "shop";
    g.rerollCost = 2;
    rollOffers(g);
    ev.push({ type: "roundClear", round: g.round, tickets, leftover, over });
    if (g.round === T.rounds) ev.push({ type: "allClear" });
    return;
  }

  // 手持ち0で盤面が落ち着いたら → チケットで補充 or 終了
  const busy =
    g.reels.spinning ||
    g.stock > 0 ||
    g.showerQueue.length > 0 ||
    g.medals.some((m) => m.state === "drop" || m.kind === "bomb" || m.state === "fall");
  if (g.hand === 0 && !busy) {
    g.idle += dt;
    if (g.idle >= T.settleDelay) {
      g.idle = 0;
      if (g.tickets >= buyMedalsPrice(g)) {
        g.mode = "fail";
        ev.push({ type: "fail" });
      } else {
        g.mode = "over";
        ev.push({ type: "gameOver", round: g.round });
      }
    }
  } else {
    g.idle = 0;
  }
}
