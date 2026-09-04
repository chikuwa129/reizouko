"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";
import Nav from "../components/Nav";

export default function ManualPage() {
  const today = new Date().toISOString().split("T")[0];

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(today);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    setError(null);

    const { error: insertError } = await supabase.from("products").insert([
      {
        name: name || "手動入力",
        category: category || "その他",
        price: Number(price) || 0,
        type: "non_food",
        quantity: 1,
        purchase_date: date,
        status: "未消費",
        receipt_id: crypto.randomUUID(),
      },
    ]);

    if (insertError) {
      setError("保存に失敗しました: " + insertError.message);
    } else {
      setSaved(true);
      setName("");
      setPrice("");
      setCategory("");
      setDate(today);
    }
  };

  return (
    <main className="page">
      <Nav />
      <h1>手動入力</h1>
      <p className="empty">自販機や飲み会の会費など、レシートのない出費を記録します（冷蔵庫の中身には出てきません）</p>

      <form onSubmit={handleSubmit} className="form">
        <input className="input" placeholder="内容（例: 缶コーヒー）" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" placeholder="金額" type="number" value={price} onChange={(e) => setPrice(e.target.value)} required />
        <input className="input" placeholder="カテゴリ（任意）" value={category} onChange={(e) => setCategory(e.target.value)} />
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <button className="btn" type="submit">記録する</button>
      </form>

      {saved && <p className="status-msg success">記録しました</p>}
      {error && <p className="status-msg error">{error}</p>}
    </main>
  );
}