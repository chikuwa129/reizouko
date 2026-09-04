"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getRemainingDays } from "../lib/expiry";
import Nav from "../components/Nav";

export default function FridgePage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("status", "未消費")
      .order("purchase_date", { ascending: true });
    if (!error && data) setItems(data);
    setLoading(false);
  };

  const stored = items.filter((i) => i.type === "stored");
  const immediate = items.filter((i) => i.type === "immediate");

  const getPriority = (item: any) => {
    const remaining = getRemainingDays(item.purchase_date, item.category);
    return remaining <= 1 ? "⚠️ そろそろヤバい" : "🟢 まだ余裕あり";
  };

  const markStatus = async (id: number, status: string) => {
    await supabase.from("products").update({ status }).eq("id", id);
    fetchItems();
  };

  const decreaseQuantity = async (item: any) => {
  const newQuantity = item.quantity - 1;
  if (newQuantity <= 0) {
    await supabase.from("products").update({ status: "完食" }).eq("id", item.id);
  } else {
    await supabase.from("products").update({ quantity: newQuantity }).eq("id", item.id);
  }
  fetchItems();
};

  return (
    <main style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
      <Nav />
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>冷蔵庫の中身</h1>

      {loading && <p>読み込み中...</p>}

      <h2 style={{ fontSize: 16, marginTop: 24 }}>保管食材</h2>
      {stored.length === 0 && <p style={{ color: "#888" }}>登録なし</p>}
      {stored.map((item) => (
        <div
          key={item.id}
          style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 8 }}
        >
          <div>{item.name}{item.quantity > 1 ? ` × ${item.quantity}` : ""}</div>
          <div style={{ fontSize: 14, color: "#555", marginBottom: 8 }}>{getPriority(item)}</div>
          {item.quantity > 1 ? (
  <button onClick={() => decreaseQuantity(item)} style={{ marginRight: 8 }}>
    1個消費（残り{item.quantity - 1}個）
  </button>
) : (
  <button onClick={() => markStatus(item.id, "完食")} style={{ marginRight: 8 }}>
    完食
  </button>
)}
<button onClick={() => markStatus(item.id, "廃棄")}>廃棄</button>
        </div>
      ))}

      <h2 style={{ fontSize: 16, marginTop: 24 }}>即食食材（今日・明日）</h2>
      {immediate.length === 0 && <p style={{ color: "#888" }}>登録なし</p>}
      {immediate.map((item) => (
        <div
          key={item.id}
          style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 8 }}
        >
          <div>{item.name}{item.quantity > 1 ? ` × ${item.quantity}` : ""}</div>
          {item.quantity > 1 ? (
  <button onClick={() => decreaseQuantity(item)} style={{ marginRight: 8 }}>
    1個消費（残り{item.quantity - 1}個）
  </button>
) : (
  <button onClick={() => markStatus(item.id, "完食")} style={{ marginRight: 8 }}>
    完食
  </button>
)}
<button onClick={() => markStatus(item.id, "廃棄")}>廃棄</button>
        </div>
      ))}
    </main>
  );
}