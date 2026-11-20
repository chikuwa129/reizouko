// WebAudio による効果音（音源ファイル不要）
// 優先度: ジャックポット > 当たり/目標 > 払い出し > チェックイン > リール > 着地/投入 > 環境音

export type SoundName =
  | "drop"
  | "land"
  | "pay"
  | "lost"
  | "checkin"
  | "reelStop"
  | "reach"
  | "winSmall"
  | "winBig"
  | "jackpot"
  | "feverEnd"
  | "goal"
  | "empty"
  | "special"
  | "buy"
  | "explode"
  | "mult"
  | "over";

export interface Sound {
  resume(): void;
  setEnabled(v: boolean): void;
  play(name: SoundName, arg?: number): void;
}

export function createSound(): Sound {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  const master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  let enabled = true;
  const lastPlayed: Partial<Record<SoundName, number>> = {};

  // 環境音: プッシャーの低いモーター音（無音にしない）
  const hum = ctx.createOscillator();
  hum.type = "sawtooth";
  hum.frequency.value = 48;
  const humF = ctx.createBiquadFilter();
  humF.type = "lowpass";
  humF.frequency.value = 140;
  const humG = ctx.createGain();
  humG.gain.value = 0.025;
  hum.connect(humF).connect(humG).connect(master);
  hum.start();

  function tone(freq: number, dur: number, opts: { type?: OscillatorType; vol?: number; at?: number; slide?: number } = {}) {
    const t0 = ctx.currentTime + (opts.at ?? 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = opts.type ?? "square";
    o.frequency.setValueAtTime(freq, t0);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(freq * opts.slide, t0 + dur);
    const v = opts.vol ?? 0.2;
    // アタック強め・余韻短め
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function noise(dur: number, vol: number, freq: number) {
    const t0 = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(master);
    src.start(t0);
  }

  const throttle = (name: SoundName, ms: number) => {
    const now = performance.now();
    if ((lastPlayed[name] ?? 0) + ms > now) return false;
    lastPlayed[name] = now;
    return true;
  };

  const notes = (seq: number[], step: number, type: OscillatorType, vol: number, dur = 0.12) =>
    seq.forEach((f, i) => tone(f, dur, { type, vol, at: i * step }));

  return {
    resume() {
      if (ctx.state === "suspended") ctx.resume();
    },
    setEnabled(v) {
      enabled = v;
      master.gain.setTargetAtTime(v ? 0.5 : 0, ctx.currentTime, 0.02);
    },
    play(name, arg = 0) {
      if (!enabled) return;
      const rnd = 0.94 + Math.random() * 0.12; // 同じ音の連続で単調にならないように
      switch (name) {
        case "drop":
          if (throttle(name, 50)) tone(1500 * rnd, 0.05, { type: "triangle", vol: 0.08 });
          break;
        case "land":
          if (throttle(name, 50)) {
            tone(2600 * rnd, 0.06, { type: "triangle", vol: 0.07 });
            tone(3900 * rnd, 0.04, { type: "sine", vol: 0.04 });
          }
          break;
        case "pay": {
          if (!throttle(name, 35)) break;
          // 連続するほど音程が上がる
          const up = Math.min(arg, 24);
          const f = 880 * Math.pow(2, up / 24);
          tone(f * rnd, 0.08, { type: "square", vol: 0.09 });
          tone(f * 2 * rnd, 0.06, { type: "triangle", vol: 0.06 });
          break;
        }
        case "lost":
          if (throttle(name, 60)) tone(160, 0.12, { type: "triangle", vol: 0.12, slide: 0.6 });
          break;
        case "checkin":
          notes([1046, 1568], 0.06, "square", 0.14, 0.1);
          break;
        case "reelStop":
          noise(0.05, 0.4, 1800);
          tone(arg === 2 ? 330 : 440, 0.06, { type: "square", vol: 0.1 });
          break;
        case "reach":
          notes([523, 659, 784, 1046], 0.07, "sawtooth", 0.1, 0.1);
          break;
        case "winSmall":
          notes([784, 988, 1175], 0.07, "square", 0.13);
          break;
        case "winBig":
          notes([659, 784, 988, 1319, 1568], 0.07, "square", 0.15, 0.14);
          break;
        case "jackpot":
          noise(0.3, 0.6, 600);
          tone(110, 0.5, { type: "sawtooth", vol: 0.25, slide: 0.5 });
          notes([523, 659, 784, 1046, 784, 1046, 1319, 1568, 2093], 0.09, "square", 0.17, 0.18);
          notes([262, 330, 392, 523], 0.18, "triangle", 0.15, 0.3);
          break;
        case "feverEnd":
          notes([784, 659, 523], 0.09, "triangle", 0.12);
          break;
        case "goal":
          notes([523, 659, 784, 1046, 1319], 0.08, "triangle", 0.16, 0.2);
          break;
        case "special":
          notes([880, 1320], 0.04, "triangle", 0.12, 0.08);
          break;
        case "buy":
          notes([1319, 1760], 0.05, "square", 0.1, 0.08);
          break;
        case "explode":
          noise(0.45, 0.9, 300);
          tone(90, 0.4, { type: "sawtooth", vol: 0.25, slide: 0.4 });
          break;
        case "mult":
          notes([659, 988, 1319, 1976], 0.05, "square", 0.13, 0.12);
          break;
        case "over":
          notes([392, 330, 262, 196], 0.16, "triangle", 0.15, 0.25);
          break;
        case "empty":
          tone(200, 0.08, { type: "square", vol: 0.08 });
          break;
      }
    },
  };
}
