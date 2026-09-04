"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import Nav from "../components/Nav";

export default function BudgetPage() {
  const [totalSpent, setTotalSpent] = useState(0);
  const [wasted, setWasted] = useState(0);
  const [byCategory, setByCategory] = useState<{ category: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    setLoading(true);
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];

    const { data, error } = await supabase
      .from("products")
      .select("price, status, category")
      .gte("purchase_date", firstOfMonth);

    if (!error && data) {
      const spent = data.reduce((sum, item) => sum + (item.price || 0), 0);
      const wastedSum = data
        .filter((item) => item.status === "廃棄")
        .reduce((sum, item) => sum + (item.price || 0), 0);

      const categoryMap: Record<string, number> = {};
      data.forEach((item) => {
        const key = item.category || "その他";
        categoryMap[key] = (categoryMap[key] || 0) + (item.price || 0);
      });
      const categoryList = Object.entries(categoryMap)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount);

      setTotalSpent(spent);
      setWasted(wastedSum);
      setByCategory(categoryList);
    }
    setLoading(false);
  };

  const now = new Date();
  const monthLabel = `${now.getMonth() + 1}月`;

  return (
    <main className="page">
      <Nav />
      <h1>家計簿</h1>

      {loading && <p className="status-msg">読み込み中...</p>}

      <div className="summary-box">
        <div className="label">今月（{monthLabel}）の食費合計</div>
        <div className="value">¥{totalSpent.toLocaleString()}</div>
      </div>

      <div className="summary-box">
        <div className="label">今月の食品ロス額（廃棄した金額）</div>
        <div className="value warn">¥{wasted.toLocaleString()}</div>
      </div>

      <h2>カテゴリ別内訳</h2>
      {byCategory.length === 0 && <p className="empty">データなし</p>}
      {byCategory.map((c) => (
        <div className="item" key={c.category}>
          <div className="item-name">{c.category}</div>
          <div className="item-qty">¥{c.amount.toLocaleString()}</div>
        </div>
      ))}
    </main>
  );
}