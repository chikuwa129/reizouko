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
    return remaining <= 1
      ? { label: "そろそろ消費", cls: "warn" }
      : { label: "まだ余裕あり", cls: "fresh" };
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

  const renderActions = (item: any) => (
    <div className="actions">
      {item.quantity > 1 ? (
        <button className="btn" onClick={() => decreaseQuantity(item)}>
          1個消費（残り{item.quantity - 1}）
        </button>
      ) : (
        <button className="btn" onClick={() => markStatus(item.id, "完食")}>
          完食
        </button>
      )}
      <button className="btn btn-danger" onClick={() => markStatus(item.id, "廃棄")}>
        廃棄
      </button>
    </div>
  );

  return (
    <main className="page">
      <Nav />
      <h1>冷蔵庫の中身</h1>

      {loading && <p className="status-msg">読み込み中...</p>}

      <h2>保管食材</h2>
      {stored.length === 0 && <p className="empty">登録なし</p>}
      {stored.map((item) => {
        const priority = getPriority(item);
        return (
          <div className="item" key={item.id}>
            <div>
              <div className="item-name">
                {item.name}
                {item.quantity > 1 ? <span className="item-qty"> × {item.quantity}</span> : ""}
              </div>
              <div className={`item-badge ${priority.cls}`}>{priority.label}</div>
            </div>
            {renderActions(item)}
          </div>
        );
      })}

      <h2>即食食材（今日・明日）</h2>
      {immediate.length === 0 && <p className="empty">登録なし</p>}
      {immediate.map((item) => (
        <div className="item" key={item.id}>
          <div className="item-name">
            {item.name}
            {item.quantity > 1 ? <span className="item-qty"> × {item.quantity}</span> : ""}
          </div>
          {renderActions(item)}
        </div>
      ))}
    </main>
  );
}