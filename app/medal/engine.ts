// メダル落とし: ゲームロジック（描画・音とは分離）
// 調整値は TUNING に集約し、コードを触らずに手触りを変えられるようにしている。

export const TUNING = {
  // 盤面（論理座標）
  width: 360,
  height: 600,
  wallL: 18,
  wallR: 342,
  pusherBack: 96, // プッシャー後端（上段デッキの下端）
  pusherMid: 168, // プッシャー前面の中心位置
  pusherAmp: 34, // プッシャーの振れ幅
  pusherSpeed: 1.9, // rad/s
  edgeY: 520, // 落とし口のライン
  payL: 66, // ここから payR までが払い出し口。外側はサイド落ち（没収）
  payR: 294,

  // メダル
  r: 13,
  damping: 0.82, // 慣性の残り具合（1に近いほど滑る）
  solverIters: 6,
  prefillGap: 0.12, // 初期盤面の空き率
  startCredit: 30,

  // 投入
  dropTime: 0.32, // 投入から着地まで（秒）
  gateCheckT: 0.4, // 投入アニメ中、ゲート判定するタイミング（0-1）
  autoFireInterval: 0.16,

  // チャッカー（ゲート）
  gateY: 46,
  gateW: 40,
  gateSpeed: 1.35,
  gateMin: 60,
  gateMax: 300,

  // スロット
  maxStock: 5,
  reelStops: [0.45, 0.65, 0.85], // 各リール停止（秒）
  reachExtra: 0.7, // リーチ時のタメ
  // 抽選確率（チェックイン1回あたり）
  pJackpot: 0.04,
  pBell: 0.12,
  pCherry: 0.22,
  payJackpot: 35,
  payBell: 10,
  payCherry: 3,
  pFakeReach: 0.35, // ハズレ時にリーチ演出が出る割合

  // フィーバー
  feverTime: 9,
  feverPusherMul: 1.7,

  // 救済
  rescueDelay: 2.0,
  rescueAmount: 10,

  // 目標
  goals: [50, 100, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000, 10000],
  goalBonus: 12,
};

export type Symbol = "7" | "BELL" | "CHERRY" | "BAR" | "STAR";
export const SYMBOLS: Symbol[] = ["7", "BELL", "CHERRY", "BAR", "STAR"];

export type MedalState = "drop" | "field" | "fall";

export interface Medal {
  id: number;
  x: number;
  y: number;
  px: number; // 前フレーム位置（Verlet）
  py: number;
  state: MedalState;
  t: number; // 状態内の経過時間
  // drop用
  sx: number;
  checked: boolean;
  // fall用
  paid: boolean;
  tilt: number; // 見た目用の回転
}

export interface Reels {
  spinning: boolean;
  t: number;
  result: Symbol[];
  stopped: number; // 停止したリール数
  reach: boolean;
  duration: number;
}

export type GameEvent =
  | { type: "drop"; x: number }
  | { type: "land"; x: number; y: number }
  | { type: "pay"; x: number; amount: number }
  | { type: "lost"; x: number }
  | { type: "checkin"; x: number }
  | { type: "stockFull" }
  | { type: "reelStop"; index: number; reach: boolean }
  | { type: "reach" }
  | { type: "win"; kind: "jackpot" | "bell" | "cherry"; amount: number }
  | { type: "miss" }
  | { type: "feverEnd" }
  | { type: "goal"; goal: number; next: number | null }
  | { type: "rescue"; amount: number };

export interface Game {
  medals: Medal[];
  nextId: number;
  credit: number;
  totalPaid: number;
  best: number;
  goalIndex: number;
  phase: number;
  pusherY: number;
  pusherV: number;
  gatePhase: number;
  gateX: number;
  stock: number;
  reels: Reels;
  fever: number; // 残り秒
  pendingShower: number;
  showerTimer: number;
  idleZero: number;
  time: number;
  rng: () => number;
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

function newMedal(g: Game, x: number, y: number, state: MedalState): Medal {
  return {
    id: g.nextId++,
    x,
    y,
    px: x,
    py: y,
    state,
    t: 0,
    sx: x,
    checked: false,
    paid: false,
    tilt: g.rng() * Math.PI * 2,
  };
}

export function createGame(opts: { credit?: number; best?: number; goalIndex?: number; seed?: number } = {}): Game {
  const T = TUNING;
  const g: Game = {
    medals: [],
    nextId: 1,
    credit: opts.credit ?? T.startCredit,
    totalPaid: 0,
    best: opts.best ?? 0,
    goalIndex: opts.goalIndex ?? 0,
    phase: 0,
    pusherY: T.pusherMid,
    pusherV: 0,
    gatePhase: 0,
    gateX: (T.gateMin + T.gateMax) / 2,
    stock: 0,
    reels: { spinning: false, t: 0, result: ["7", "BELL", "CHERRY"], stopped: 3, reach: false, duration: 0 },
    fever: 0,
    pendingShower: 0,
    showerTimer: 0,
    idleZero: 0,
    time: 0,
    rng: mulberry32(opts.seed ?? (Date.now() ^ (Math.random() * 1e9))),
  };
  // 開始直後から「あと少しで落ちそう」な盤面にしておく（最初の3分で楽しさを見せる）
  const yMin = T.pusherMid + T.pusherAmp + T.r;
  // 落とし口ギリギリから六方格子で敷き詰め、ところどころ抜く
  const rowH = T.r * 2 * 0.87;
  let row = 0;
  for (let y = T.edgeY - T.r * 0.3; y > yMin; y -= rowH, row++) {
    const off = row % 2 ? T.r : 0;
    for (let x = T.wallL + T.r + off; x <= T.wallR - T.r; x += T.r * 2) {
      if (g.rng() < T.prefillGap) continue;
      const jx = (g.rng() - 0.5) * 2;
      g.medals.push(newMedal(g, x + jx, y, "field"));
    }
  }
  return g;
}

export function canDrop(g: Game) {
  return g.credit > 0;
}

export function dropMedal(g: Game, x: number, ev: GameEvent[]): boolean {
  const T = TUNING;
  if (g.credit <= 0) return false;
  g.credit--;
  const cx = Math.max(T.wallL + T.r, Math.min(T.wallR - T.r, x));
  const m = newMedal(g, cx, 10, "drop");
  g.medals.push(m);
  ev.push({ type: "drop", x: cx });
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
  if (r < T.pJackpot) return { result: ["7", "7", "7"], reach: true };
  if (r < T.pJackpot + T.pBell) return { result: ["BELL", "BELL", "BELL"], reach: true };
  if (r < T.pJackpot + T.pBell + T.pCherry) return { result: ["CHERRY", "CHERRY", "CHERRY"], reach: true };
  // ハズレ。一定割合でリーチ目（惜しい）を見せる
  if (g.rng() < T.pFakeReach) {
    const a = g.rng() < 0.55 ? "7" : pick();
    return { result: [a, a, pick(a)], reach: true };
  }
  const a = pick();
  const b = pick(a);
  return { result: [a, b, pick()], reach: false };
}

function startSpin(g: Game) {
  const T = TUNING;
  const { result, reach } = rollReels(g);
  g.stock--;
  g.reels = {
    spinning: true,
    t: 0,
    result,
    stopped: 0,
    reach,
    duration: T.reelStops[2] + (reach ? T.reachExtra : 0),
  };
}

function reelStopTime(g: Game, i: number) {
  const T = TUNING;
  return i === 2 ? g.reels.duration : T.reelStops[i];
}

function addPayout(g: Game, n: number) {
  g.pendingShower += n;
}

export function step(g: Game, dt: number, ev: GameEvent[]) {
  const T = TUNING;
  g.time += dt;

  // プッシャー
  const speed = T.pusherSpeed * (g.fever > 0 ? T.feverPusherMul : 1);
  g.phase += dt * speed;
  const prevY = g.pusherY;
  g.pusherY = T.pusherMid + Math.sin(g.phase) * T.pusherAmp;
  g.pusherV = g.pusherY - prevY;

  // ゲート
  g.gatePhase += dt * T.gateSpeed;
  g.gateX = T.gateMin + ((Math.sin(g.gatePhase) + 1) / 2) * (T.gateMax - T.gateMin);

  // フィーバー
  if (g.fever > 0) {
    g.fever -= dt;
    if (g.fever <= 0) {
      g.fever = 0;
      ev.push({ type: "feverEnd" });
    }
  }

  // シャワー（当たりの払い出しは盤面に降らせる＝押し出しで一気に崩れる「パッ」）
  if (g.pendingShower > 0) {
    g.showerTimer -= dt;
    while (g.showerTimer <= 0 && g.pendingShower > 0) {
      g.showerTimer += 0.045;
      g.pendingShower--;
      const x = T.wallL + T.r + g.rng() * (T.wallR - T.wallL - 2 * T.r);
      const m = newMedal(g, x, 10, "drop");
      m.checked = true; // シャワーはチャッカー判定しない
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
    while (rl.stopped < 3 && rl.t >= reelStopTime(g, rl.stopped)) {
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
        if (a === "7") {
          g.fever = T.feverTime;
          addPayout(g, T.payJackpot);
          ev.push({ type: "win", kind: "jackpot", amount: T.payJackpot });
        } else if (a === "BELL") {
          addPayout(g, T.payBell);
          ev.push({ type: "win", kind: "bell", amount: T.payBell });
        } else {
          addPayout(g, T.payCherry);
          ev.push({ type: "win", kind: "cherry", amount: T.payCherry });
        }
      } else {
        ev.push({ type: "miss" });
      }
    }
  }

  // メダル更新
  const field: Medal[] = [];
  for (const m of g.medals) {
    m.t += dt;
    if (m.state === "drop") {
      const k = Math.min(1, m.t / T.dropTime);
      // 着地点はプッシャー前面の少し先
      const landY = g.pusherY + T.r + 4;
      m.y = 10 + (landY - 10) * (k * k);
      m.x = m.sx;
      if (!m.checked && k >= T.gateCheckT) {
        m.checked = true;
        if (Math.abs(m.x - g.gateX) < T.gateW / 2) {
          if (g.stock < T.maxStock) {
            g.stock++;
            ev.push({ type: "checkin", x: m.x });
          } else {
            ev.push({ type: "stockFull" });
          }
        }
      }
      if (k >= 1) {
        m.state = "field";
        m.t = 0;
        m.px = m.x;
        m.py = m.y - 1.5; // 少しだけ前に滑る
        ev.push({ type: "land", x: m.x, y: m.y });
      }
    } else if (m.state === "field") {
      // Verlet 積分（慣性＋減衰）
      const vx = (m.x - m.px) * T.damping;
      const vy = (m.y - m.py) * T.damping;
      m.px = m.x;
      m.py = m.y;
      m.x += vx;
      m.y += vy;
      field.push(m);
    } else if (m.state === "fall") {
      m.y += dt * 240;
    }
  }

  // 衝突解決（位置ベース）
  const r2 = 2 * T.r;
  const minFace = () => g.pusherY + T.r;
  const constrain = (m: Medal) => {
    if (m.y < minFace()) m.y = minFace();
    if (m.x < T.wallL + T.r) m.x = T.wallL + T.r;
    if (m.x > T.wallR - T.r) m.x = T.wallR - T.r;
  };
  // 簡易空間ハッシュ
  const cell = r2;
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
            let ddx = b.x - a.x;
            let ddy = b.y - a.y;
            let d2 = ddx * ddx + ddy * ddy;
            if (d2 >= r2 * r2) continue;
            if (d2 < 1e-6) {
              ddx = g.rng() - 0.5;
              ddy = 0.5;
              d2 = ddx * ddx + ddy * ddy;
            }
            const d = Math.sqrt(d2);
            const over = (r2 - d) / d;
            // プッシャーに接しているメダルは動かない（押す側）
            const aPinned = a.y <= minFace() + 0.5;
            const bPinned = b.y <= minFace() + 0.5;
            let wa = 0.5;
            let wb = 0.5;
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
    for (const m of field) constrain(m);
  }

  // 落下判定
  for (const m of field) {
    if (m.y > T.edgeY) {
      m.state = "fall";
      m.t = 0;
      const guard = g.fever > 0;
      if (guard || (m.x >= T.payL && m.x <= T.payR)) {
        m.paid = true;
        g.credit++;
        g.totalPaid++;
        ev.push({ type: "pay", x: m.x, amount: 1 });
      } else {
        ev.push({ type: "lost", x: m.x });
      }
    }
  }
  g.medals = g.medals.filter((m) => !(m.state === "fall" && m.t > 0.35));

  // 目標
  if (g.credit > g.best) g.best = g.credit;
  const goal = T.goals[g.goalIndex];
  if (goal !== undefined && g.credit >= goal) {
    g.goalIndex++;
    addPayout(g, T.goalBonus);
    ev.push({ type: "goal", goal, next: T.goals[g.goalIndex] ?? null });
  }

  // 救済: 手持ち0で盤面が落ち着いたらサービス（詰み状態を作らない）
  const busy = g.reels.spinning || g.stock > 0 || g.pendingShower > 0 || g.medals.some((m) => m.state === "drop");
  if (g.credit === 0 && !busy) {
    g.idleZero += dt;
    if (g.idleZero >= T.rescueDelay) {
      g.idleZero = 0;
      g.credit += T.rescueAmount;
      ev.push({ type: "rescue", amount: T.rescueAmount });
    }
  } else {
    g.idleZero = 0;
  }
}
