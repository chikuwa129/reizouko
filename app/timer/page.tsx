"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Nav from "../components/Nav";

const DURATION_MS = 4.5 * 60 * 1000; // 4分30秒

type Status = "idle" | "running" | "paused" | "ringing";

function format(ms: number) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

type WakeLockSentinelLike = { release: () => Promise<void> };

export default function TimerPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [remaining, setRemaining] = useState(DURATION_MS);
  const [rounds, setRounds] = useState(0);

  // 終了予定時刻（Date.now() 基準）。バックグラウンドで setInterval が遅れてもずれない
  const endAtRef = useRef<number | null>(null);
  const remainingRef = useRef(DURATION_MS);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const alarmTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);

  // ---- 音 ----
  // iOS ではユーザー操作の中で AudioContext を作成/再開しないと鳴らないため、ボタン押下時に呼ぶ
  const unlockAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      audioCtxRef.current = new Ctx();
    }
    if (audioCtxRef.current.state === "suspended") {
      void audioCtxRef.current.resume();
    }
  }, []);

  const beep = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    // ピピピッ と3回
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.18;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 1760;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.13);
    }
  }, []);

  const vibrate = useCallback(() => {
    if ("vibrate" in navigator) navigator.vibrate([300, 150, 300, 150, 300]);
  }, []);

  const stopAlarm = useCallback(() => {
    if (alarmTimerRef.current) {
      clearInterval(alarmTimerRef.current);
      alarmTimerRef.current = null;
    }
    if ("vibrate" in navigator) navigator.vibrate(0);
  }, []);

  const startAlarm = useCallback(() => {
    stopAlarm();
    beep();
    vibrate();
    // ボタンを押すまで鳴り続ける
    alarmTimerRef.current = setInterval(() => {
      beep();
      vibrate();
    }, 1500);
  }, [beep, vibrate, stopAlarm]);

  // ---- 画面スリープ防止（対応ブラウザのみ） ----
  const acquireWakeLock = useCallback(async () => {
    try {
      const wl = (navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinelLike> } }).wakeLock;
      if (wl && !wakeLockRef.current) {
        wakeLockRef.current = await wl.request("screen");
      }
    } catch {
      // 非対応・拒否時は何もしない
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }, []);

  // ---- 操作 ----
  const start = useCallback(() => {
    unlockAudio();
    stopAlarm();
    endAtRef.current = Date.now() + DURATION_MS;
    remainingRef.current = DURATION_MS;
    setRemaining(DURATION_MS);
    setStatus("running");
    void acquireWakeLock();
  }, [unlockAudio, stopAlarm, acquireWakeLock]);

  const pause = useCallback(() => {
    if (endAtRef.current) {
      remainingRef.current = Math.max(0, endAtRef.current - Date.now());
      setRemaining(remainingRef.current);
    }
    endAtRef.current = null;
    setStatus("paused");
  }, []);

  // アラーム中の「停止」: 音だけ止めて 4:30 で待機（回数は残す）
  const silence = useCallback(() => {
    stopAlarm();
    remainingRef.current = DURATION_MS;
    setRemaining(DURATION_MS);
    setStatus("paused");
  }, [stopAlarm]);

  const resume = useCallback(() => {
    unlockAudio();
    endAtRef.current = Date.now() + remainingRef.current;
    setStatus("running");
    void acquireWakeLock();
  }, [unlockAudio, acquireWakeLock]);

  const reset = useCallback(() => {
    stopAlarm();
    endAtRef.current = null;
    remainingRef.current = DURATION_MS;
    setRemaining(DURATION_MS);
    setRounds(0);
    setStatus("idle");
    releaseWakeLock();
  }, [stopAlarm, releaseWakeLock]);

  // ---- カウントダウン ----
  useEffect(() => {
    if (status !== "running") return;
    const tick = () => {
      if (!endAtRef.current) return;
      const left = endAtRef.current - Date.now();
      if (left <= 0) {
        endAtRef.current = null;
        remainingRef.current = 0;
        setRemaining(0);
        setRounds((r) => r + 1);
        setStatus("ringing");
        startAlarm();
      } else {
        remainingRef.current = left;
        setRemaining(left);
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [status, startAlarm]);

  // タブ復帰時に Wake Lock を取り直す（タブを離れると自動解除されるため）
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && (status === "running" || status === "ringing")) {
        wakeLockRef.current = null;
        void acquireWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [status, acquireWakeLock]);

  // ページを離れたら後片付け
  useEffect(() => {
    return () => {
      stopAlarm();
      releaseWakeLock();
      void audioCtxRef.current?.close();
    };
  }, [stopAlarm, releaseWakeLock]);

  const progress = 1 - remaining / DURATION_MS;

  return (
    <main className="page">
      <Nav />
      <h1>4分半タイマー</h1>

      <div className={`timer-face${status === "ringing" ? " ringing" : ""}`}>
        <div className="timer-status">
          {status === "idle" && "待機中"}
          {status === "running" && "計測中"}
          {status === "paused" && "一時停止中"}
          {status === "ringing" && "時間です！"}
        </div>
        <div className="timer-digits">{format(remaining)}</div>
        <div className="timer-bar">
          <div className="timer-bar-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="timer-rounds">{rounds > 0 ? `${rounds} 回目が終了` : " "}</div>
      </div>

      <button
        className={`timer-main-btn${status === "ringing" ? " ringing" : ""}`}
        onClick={status === "paused" ? resume : start}
      >
        {status === "idle" && "スタート"}
        {status === "running" && "最初から測り直す"}
        {status === "paused" && "再開"}
        {status === "ringing" && "次の4分半をスタート"}
      </button>

      <div className="timer-sub-btns">
        <button
          className="btn"
          onClick={status === "ringing" ? silence : pause}
          disabled={status !== "running" && status !== "ringing"}
        >
          停止
        </button>
        <button className="btn btn-danger" onClick={reset} disabled={status === "idle"}>
          完全停止
        </button>
      </div>

      <p className="help-text timer-note">
        ・時間になると、ボタンを押すまで音とバイブが鳴り続けます。<br />
        ・「停止」は一時停止（「再開」で続きから）。アラーム中は音を止めて待機します。<br />
        ・「完全停止」で 4:30 に戻り、回数もリセットします。<br />
        ・iPhone はブラウザの制限でバイブしません。画面を消すと鳴らないことがあるので、計測中は画面をつけたままにしてください（対応端末では自動でスリープを防ぎます）。
      </p>
    </main>
  );
}
