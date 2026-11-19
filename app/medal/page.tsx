"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Nav from "../components/Nav";
import { createGame, dropMedal, step, TUNING, type Game, type GameEvent, type Symbol } from "./engine";
import { createSound, type Sound } from "./sound";

const TOP = 100; // スロット帯の高さ
const LW = TUNING.width;
const LH = TOP + TUNING.height;
const STORAGE_KEY = "medal-pusher-v1";

interface Saved {
  credit: number;
  best: number;
  goalIndex: number;
  sound: boolean;
  shake: boolean;
}

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
  reachGlow: number;
}

function loadSaved(): Partial<Saved> {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : {};
  } catch {
    return {};
  }
}

function save(data: Saved) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* 保存できない環境でも遊べる */
  }
}

function makeMedalSprite(scale: number) {
  const r = TUNING.r;
  const size = Math.ceil((r * 2 + 4) * scale);
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const x = c.getContext("2d")!;
  x.scale(scale, scale);
  const cx = r + 2;
  const g = x.createRadialGradient(cx - 4, cx - 5, 1, cx, cx, r);
  g.addColorStop(0, "#fff6c2");
  g.addColorStop(0.45, "#ffd23a");
  g.addColorStop(1, "#c98a00");
  x.fillStyle = g;
  x.beginPath();
  x.arc(cx, cx, r, 0, Math.PI * 2);
  x.fill();
  x.lineWidth = 1.6;
  x.strokeStyle = "#6b4300";
  x.stroke();
  x.beginPath();
  x.arc(cx, cx, r - 3.5, 0, Math.PI * 2);
  x.strokeStyle = "rgba(120,74,0,0.55)";
  x.lineWidth = 1;
  x.stroke();
  // 刻印の★
  x.fillStyle = "rgba(140,88,0,0.6)";
  star(x, cx, cx, 4.8, 2.1);
  x.fill();
  return c;
}

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

export default function MedalPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const fxRef = useRef<Fx>({
    floats: [],
    parts: [],
    banner: null,
    shake: 0,
    flash: 0,
    hitstop: 0,
    gateFlash: 0,
    combo: 0,
    comboTimer: 0,
    reachGlow: 0,
  });
  const soundRef = useRef<Sound | null>(null);
  const aimRef = useRef(TUNING.width / 2);
  const firingRef = useRef(false);
  const fireTimerRef = useRef(0);
  const settingsRef = useRef({ sound: true, shake: true });

  const [credit, setCredit] = useState(0);
  const [goalIndex, setGoalIndex] = useState(0);
  const [best, setBest] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [shakeOn, setShakeOn] = useState(true);
  const [started, setStarted] = useState(false);
  const [bump, setBump] = useState(0);
  const [debug, setDebug] = useState(false);

  const persist = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    save({
      credit: g.credit,
      best: g.best,
      goalIndex: g.goalIndex,
      sound: settingsRef.current.sound,
      shake: settingsRef.current.shake,
    });
  }, []);

  const ensureSound = useCallback(() => {
    if (!soundRef.current) soundRef.current = createSound();
    soundRef.current.resume();
    soundRef.current.setEnabled(settingsRef.current.sound);
  }, []);


  // イベント → 演出・音
  const handleEvents = (ev: GameEvent[]) => {
    const fx = fxRef.current;
    const s = soundRef.current;
    const g = gameRef.current!;
    for (const e of ev) {
      switch (e.type) {
        case "drop":
          s?.play("drop");
          break;
        case "land":
          s?.play("land");
          break;
        case "pay": {
          fx.combo++;
          fx.comboTimer = 0.7;
          s?.play("pay", fx.combo);
          fx.floats.push({ x: e.x, y: TOP + TUNING.edgeY + 26, text: "+1", color: "#ffe14a", t: 0, life: 0.7, size: 16 });
          for (let i = 0; i < 3; i++) {
            fx.parts.push({
              x: e.x,
              y: TOP + TUNING.edgeY + 8,
              vx: (Math.random() - 0.5) * 120,
              vy: -80 - Math.random() * 120,
              t: 0,
              life: 0.45,
              color: "#fff3a0",
              size: 2.5,
              spin: 0,
            });
          }
          if (fx.combo === 8 || fx.combo === 20 || fx.combo === 40) {
            const words: Record<number, string> = { 8: "ドバッ！", 20: "大量！！", 40: "大爆流！！！" };
            fx.floats.push({ x: LW / 2, y: TOP + TUNING.edgeY - 50, text: words[fx.combo], color: "#ffffff", t: 0, life: 1.1, size: 34 });
            fx.shake = Math.max(fx.shake, fx.combo >= 20 ? 6 : 3.5);
          }
          setBump((b) => b + 1);
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
          fx.floats.push({ x: g.gateX, y: TOP + TUNING.gateY - 6, text: "MAX", color: "#bbbbbb", t: 0, life: 0.6, size: 14 });
          break;
        case "reelStop":
          s?.play("reelStop", e.index);
          break;
        case "reach":
          s?.play("reach");
          fx.reachGlow = 1;
          break;
        case "win":
          if (e.kind === "jackpot") {
            s?.play("jackpot");
            fx.hitstop = 0.3;
            fx.flash = 0.6;
            fx.shake = 12;
            fx.banner = { text: "JACKPOT!!", sub: `+${e.amount}枚 ＆ FEVER（サイド落ちなし）`, color: "#ff3355", t: 0, life: 2.4 };
            confetti(fx, 90);
          } else if (e.kind === "bell") {
            s?.play("winBig");
            fx.hitstop = 0.12;
            fx.flash = 0.25;
            fx.shake = 5;
            fx.banner = { text: "BELL!", sub: `+${e.amount}枚`, color: "#ffcf1f", t: 0, life: 1.4 };
          } else {
            s?.play("winSmall");
            fx.shake = 2.5;
            fx.floats.push({ x: LW / 2, y: TOP - 8, text: `チェリー +${e.amount}`, color: "#ff7a8a", t: 0, life: 1.0, size: 18 });
          }
          fx.reachGlow = 0;
          break;
        case "miss":
          fx.reachGlow = 0;
          break;
        case "feverEnd":
          s?.play("feverEnd");
          fx.floats.push({ x: LW / 2, y: TOP + 300, text: "FEVER 終了", color: "#ffffff", t: 0, life: 1.0, size: 22 });
          break;
        case "goal":
          s?.play("goal");
          fx.flash = Math.max(fx.flash, 0.3);
          fx.banner = {
            text: `${e.goal}枚 達成！`,
            sub: e.next ? `ボーナス +${TUNING.goalBonus}枚 ／ 次は ${e.next}枚` : "全目標クリア！おめでとう！",
            color: "#59ff8f",
            t: 0,
            life: 2.2,
          };
          confetti(fx, 50);
          setGoalIndex(g.goalIndex);
          break;
        case "rescue":
          s?.play("goal");
          fx.banner = { text: "サービス！", sub: `+${e.amount}枚 もう一回どうぞ`, color: "#7dfcff", t: 0, life: 1.8 };
          break;
      }
    }
  };

  const fire = () => {
    const g = gameRef.current;
    if (!g) return;
    const ev: GameEvent[] = [];
    if (dropMedal(g, aimRef.current, ev)) {
      handleEvents(ev);
    } else {
      soundRef.current?.play("empty");
    }
    setStarted(true);
  };

  // 初期化 & ゲームループ
  useEffect(() => {
    const saved = loadSaved();
    settingsRef.current = { sound: saved.sound ?? true, shake: saved.shake ?? true };
    const g = createGame({ credit: saved.credit, best: saved.best, goalIndex: saved.goalIndex });
    gameRef.current = g;
    setSoundOn(settingsRef.current.sound);
    setShakeOn(settingsRef.current.shake);
    setCredit(g.credit);
    setGoalIndex(g.goalIndex);
    setBest(g.best);
    setDebug(new URLSearchParams(location.search).has("debug"));

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let dpr = 1;
    let scale = 1;
    let sprite = makeMedalSprite(2);
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      scale = (rect.width * dpr) / LW;
      sprite = makeMedalSprite(scale);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let lastCredit = -1;
    let lastBest = -1;
    let saveTimer = 0;
    const DT = 1 / 60;

    const loop = (now: number) => {
      const frame = Math.min(0.1, (now - last) / 1000);
      last = now;
      const fx = fxRef.current;

      // 長押しで連射
      if (firingRef.current) {
        fireTimerRef.current -= frame;
        if (fireTimerRef.current <= 0) {
          fireTimerRef.current += TUNING.autoFireInterval;
          const ev: GameEvent[] = [];
          if (dropMedal(g, aimRef.current, ev)) handleEvents(ev);
        }
      }

      // ヒットストップ中はシミュレーションを止める
      if (fx.hitstop > 0) {
        fx.hitstop -= frame;
      } else {
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
      }
      updateFx(fx, frame);

      if (g.credit !== lastCredit) {
        lastCredit = g.credit;
        setCredit(g.credit);
      }
      if (g.best !== lastBest) {
        lastBest = g.best;
        setBest(g.best);
      }
      saveTimer += frame;
      if (saveTimer > 2) {
        saveTimer = 0;
        persist();
      }

      render(ctx, g, fx, scale, sprite, aimRef.current, settingsRef.current.shake);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onHide = () => persist();
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);

    // キーボード操作
    const keys = new Set<string>();
    let keyRaf = 0;
    const keyLoop = () => {
      const sp = 4;
      if (keys.has("ArrowLeft") || keys.has("a")) aimRef.current = Math.max(TUNING.wallL, aimRef.current - sp);
      if (keys.has("ArrowRight") || keys.has("d")) aimRef.current = Math.min(TUNING.wallR, aimRef.current + sp);
      keyRaf = requestAnimationFrame(keyLoop);
    };
    keyRaf = requestAnimationFrame(keyLoop);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!firingRef.current) {
          ensureSound();
          fire();
          firingRef.current = true;
          fireTimerRef.current = TUNING.autoFireInterval * 2;
        }
      } else {
        keys.add(e.key);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") firingRef.current = false;
      keys.delete(e.key);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(keyRaf);
      ro.disconnect();
      persist();
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toLogicalX = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return ((e.clientX - rect.left) / rect.width) * LW;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    ensureSound();
    aimRef.current = toLogicalX(e);
    fire();
    firingRef.current = true;
    fireTimerRef.current = TUNING.autoFireInterval * 2;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    aimRef.current = toLogicalX(e);
  };
  const onPointerUp = () => {
    firingRef.current = false;
  };

  const toggleSound = () => {
    const v = !settingsRef.current.sound;
    settingsRef.current.sound = v;
    setSoundOn(v);
    ensureSound();
    persist();
  };
  const toggleShake = () => {
    const v = !settingsRef.current.shake;
    settingsRef.current.shake = v;
    setShakeOn(v);
    persist();
  };

  const goal = TUNING.goals[goalIndex];
  const prevGoal = goalIndex > 0 ? TUNING.goals[goalIndex - 1] : 0;
  const progress = goal ? Math.max(0, Math.min(1, (credit - prevGoal) / (goal - prevGoal))) : 1;

  return (
    <main className="medal-page">
      <Nav />
      <div className="medal-hud">
        <div className="medal-credit">
          <span className="medal-credit-label">手持ち</span>
          <span key={bump} className="medal-credit-num">
            {credit}
          </span>
          <span className="medal-credit-unit">枚</span>
        </div>
        <div className="medal-goal">
          <div className="medal-goal-text">{goal ? `次の目標 ${goal}枚（あと${Math.max(0, goal - credit)}）` : "全目標クリア！"}</div>
          <div className="medal-goal-bar">
            <div className="medal-goal-fill" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="medal-best">最高 {best}枚</div>
        </div>
        <div className="medal-toggles">
          <button className="medal-toggle" onClick={toggleSound} aria-pressed={soundOn}>
            音 {soundOn ? "ON" : "OFF"}
          </button>
          <button className="medal-toggle" onClick={toggleShake} aria-pressed={shakeOn}>
            揺れ {shakeOn ? "ON" : "OFF"}
          </button>
        </div>
      </div>
      <div className="medal-stage">
        <canvas
          ref={canvasRef}
          className="medal-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onContextMenu={(e) => e.preventDefault()}
        />
        {!started && (
          <div className="medal-hint">
            <div className="medal-hint-main">タップでメダル投入</div>
            <div className="medal-hint-sub">長押しで連射／動く「IN」を通すとスロット</div>
          </div>
        )}
      </div>
      {debug && (
        <div className="medal-debug">
          <button
            className="medal-toggle"
            onClick={() => {
              const g = gameRef.current!;
              g.credit += 100;
            }}
          >
            +100
          </button>
          <button
            className="medal-toggle"
            onClick={() => {
              const g = gameRef.current!;
              g.stock = Math.min(TUNING.maxStock, g.stock + 1);
            }}
          >
            スロット+1
          </button>
          <button
            className="medal-toggle"
            onClick={() => {
              const g = gameRef.current!;
              g.credit = 0;
            }}
          >
            0枚にする
          </button>
        </div>
      )}
    </main>
  );
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

function render(
  x: CanvasRenderingContext2D,
  g: Game,
  fx: Fx,
  scale: number,
  sprite: HTMLCanvasElement,
  aim: number,
  shakeOn: boolean,
) {
  const T = TUNING;
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.fillStyle = "#0d0f1a";
  x.fillRect(0, 0, x.canvas.width, x.canvas.height);

  // 揺れ（ランダム・減衰）
  let sx = 0;
  let sy = 0;
  if (shakeOn && fx.shake > 0) {
    sx = (Math.random() - 0.5) * fx.shake * 2;
    sy = (Math.random() - 0.5) * fx.shake;
  }
  x.setTransform(scale, 0, 0, scale, sx * scale, sy * scale);

  drawSlot(x, g, fx);

  x.save();
  x.translate(0, TOP);

  // 上段デッキ
  x.fillStyle = "#1a1f36";
  x.fillRect(0, 0, LW, T.pusherBack);
  // ゲート（チャッカー）
  const gw = T.gateW;
  const gx = g.gateX;
  const lit = fx.gateFlash > 0;
  x.fillStyle = lit ? "#7dfcff" : "#0a3140";
  x.strokeStyle = "#7dfcff";
  x.lineWidth = 2;
  roundRect(x, gx - gw / 2, T.gateY - 12, gw, 24, 6);
  x.fill();
  x.stroke();
  x.fillStyle = lit ? "#002030" : "#7dfcff";
  x.font = "900 13px system-ui, sans-serif";
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText("IN", gx, T.gateY + 1);
  // 狙いマーカー
  const ax = Math.max(T.wallL + T.r, Math.min(T.wallR - T.r, aim));
  x.strokeStyle = "rgba(255,255,255,0.55)";
  x.setLineDash([4, 4]);
  x.beginPath();
  x.moveTo(ax, 4);
  x.lineTo(ax, T.pusherBack);
  x.stroke();
  x.setLineDash([]);
  x.fillStyle = "#ffffff";
  x.beginPath();
  x.moveTo(ax - 7, 2);
  x.lineTo(ax + 7, 2);
  x.lineTo(ax, 12);
  x.closePath();
  x.fill();

  // フィールド（床は明るく、背景は落とす）
  const fieldTop = T.pusherBack;
  const grad = x.createLinearGradient(0, fieldTop, 0, T.edgeY);
  grad.addColorStop(0, "#2f6b52");
  grad.addColorStop(1, "#3d8a68");
  x.fillStyle = grad;
  x.fillRect(T.wallL, fieldTop, T.wallR - T.wallL, T.edgeY - fieldTop);
  // 壁
  x.fillStyle = "#4a4f6a";
  x.fillRect(0, fieldTop, T.wallL, T.edgeY - fieldTop);
  x.fillRect(T.wallR, fieldTop, LW - T.wallR, T.edgeY - fieldTop);

  // 落とし口
  const fever = g.fever > 0;
  x.fillStyle = "#06070d";
  x.fillRect(0, T.edgeY, LW, T.height - T.edgeY);
  // 払い出し口
  x.fillStyle = fever ? "#3a2a00" : "#14321f";
  x.fillRect(fever ? T.wallL : T.payL, T.edgeY + 4, fever ? T.wallR - T.wallL : T.payR - T.payL, 46);
  x.fillStyle = fever ? "#ffd23a" : "#59ff8f";
  x.font = "900 16px system-ui, sans-serif";
  x.fillText(fever ? "FEVER ガード中" : "▼ GET ▼", LW / 2, T.edgeY + 62);
  if (!fever) {
    // サイド落ち（没収）
    x.fillStyle = "#3a0d12";
    x.fillRect(T.wallL, T.edgeY + 4, T.payL - T.wallL, 46);
    x.fillRect(T.payR, T.edgeY + 4, T.wallR - T.payR, 46);
    x.fillStyle = "#ff5a5a";
    x.font = "700 11px system-ui, sans-serif";
    x.fillText("没収", (T.wallL + T.payL) / 2, T.edgeY + 27);
    x.fillText("没収", (T.payR + T.wallR) / 2, T.edgeY + 27);
  }
  // 縁
  x.fillStyle = "#c9cde0";
  x.fillRect(T.wallL, T.edgeY - 2, T.wallR - T.wallL, 3);

  // メダル（盤面）
  const sw = sprite.width / scale;
  for (const m of g.medals) {
    if (m.state !== "field") continue;
    x.drawImage(sprite, m.x - sw / 2, m.y - sw / 2, sw, sw);
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
  // ストライプ（動きを読ませる）
  x.fillStyle = "rgba(255,255,255,0.12)";
  for (let i = 0; i < 9; i++) {
    const yy = fieldTop + ((i * 14 + (py - T.pusherMid)) % 126);
    if (yy < py - 8 && yy > fieldTop - 4) x.fillRect(T.wallL + 6, yy, T.wallR - T.wallL - 12, 3);
  }

  // 落下中・投入中のメダル
  for (const m of g.medals) {
    if (m.state === "fall") {
      const k = m.t / 0.35;
      const s = 1 - k * 0.5;
      x.globalAlpha = 1 - k;
      if (!m.paid) x.filter = "brightness(0.45)";
      x.drawImage(sprite, m.x - (sw * s) / 2, m.y - (sw * s) / 2, sw * s, sw * s);
      x.filter = "none";
      x.globalAlpha = 1;
    } else if (m.state === "drop") {
      const k = Math.min(1, m.t / T.dropTime);
      const s = 1.6 - 0.6 * k; // 手前（上空）から落ちてくる
      x.fillStyle = "rgba(0,0,0,0.3)";
      x.beginPath();
      x.ellipse(m.x + 6 * (1 - k), m.y + 6 * (1 - k), T.r, T.r * 0.8, 0, 0, Math.PI * 2);
      x.fill();
      x.drawImage(sprite, m.x - (sw * s) / 2, m.y - (sw * s) / 2, sw * s, sw * s);
    }
  }

  // パーティクル
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

  // バナー
  if (fx.banner) {
    const b = fx.banner;
    const k = b.t / b.life;
    const sc = k < 0.1 ? 0.3 + (k / 0.1) * 0.9 : k < 0.18 ? 1.2 - ((k - 0.1) / 0.08) * 0.2 : 1;
    const a = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
    x.globalAlpha = a;
    x.fillStyle = "rgba(0,0,0,0.6)";
    x.fillRect(0, TOP + 230, LW, 110);
    x.save();
    x.translate(LW / 2, TOP + 272);
    x.scale(sc, sc);
    x.font = "900 44px system-ui, sans-serif";
    x.lineWidth = 7;
    x.strokeStyle = "#000";
    x.strokeText(b.text, 0, 0);
    x.fillStyle = b.color;
    x.fillText(b.text, 0, 0);
    x.restore();
    x.font = "700 15px system-ui, sans-serif";
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

function drawSlot(x: CanvasRenderingContext2D, g: Game, fx: Fx) {
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
  // 保留ランプ
  x.textAlign = "left";
  x.font = "700 10px system-ui, sans-serif";
  x.fillStyle = "#9aa0bf";
  x.fillText("保留", 10, 22);
  for (let i = 0; i < T.maxStock; i++) {
    x.beginPath();
    x.arc(18, 36 + i * 12, 4.5, 0, Math.PI * 2);
    x.fillStyle = i < g.stock ? "#7dfcff" : "#2a2f48";
    x.fill();
  }
  // フィーバー残り
  if (fever) {
    x.textAlign = "right";
    x.font = "900 14px system-ui, sans-serif";
    x.fillStyle = "#ffd23a";
    x.fillText("FEVER", LW - 10, 30);
    x.font = "900 22px system-ui, sans-serif";
    x.fillText(`${Math.ceil(g.fever)}`, LW - 10, 54);
  }
  if (g.pendingShower > 0) {
    x.textAlign = "right";
    x.font = "700 11px system-ui, sans-serif";
    x.fillStyle = "#ffffff";
    x.fillText(`払出 ${g.pendingShower}`, LW - 10, 80);
  }
  x.textAlign = "center";
  void fx;
}

function roundRect(x: CanvasRenderingContext2D, rx: number, ry: number, w: number, h: number, r: number) {
  x.beginPath();
  x.moveTo(rx + r, ry);
  x.arcTo(rx + w, ry, rx + w, ry + h, r);
  x.arcTo(rx + w, ry + h, rx, ry + h, r);
  x.arcTo(rx, ry + h, rx, ry, r);
  x.arcTo(rx, ry, rx + w, ry, r);
  x.closePath();
}
