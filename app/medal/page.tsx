"use client";

import { useEffect, useRef } from "react";
import Nav from "../components/Nav";
import { mountMedalGame } from "./client";

export default function MedalPage() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => mountMedalGame(ref.current!, { bottomPad: "calc(72px + env(safe-area-inset-bottom))" }), []);
  return (
    <main className="medal-page">
      <Nav />
      <div ref={ref} />
    </main>
  );
}
