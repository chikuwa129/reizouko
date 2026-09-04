"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import Nav from "../components/Nav";

export default function BudgetPage() {
  const [monthOffset, setMonthOffset] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [wasted, setWasted] = useState(0);
  const [byCategory, setByCategory] = useState<{ category: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummary();
  }, [monthOffset]);

  const getTargetMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  };

  const fetchSummary = async () => {
    setLoading(true);
    const target = getTargetMonth();
    const firstOfMonth = new Date(target.getFullYear(), target.getMonth(), 1).toISOString().split("T")[0];
    const firstOfNextMonth = new Date(target.getFullYear(), target.getMonth() + 1, 1).toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("products")
      .select("price, status, category")
      .gte("purchase_date", firstOfMonth)
      .lt("purchase_date", firstOfNextMonth);

    if (!error && data) {
      const spent = data.reduce((sum, item) => sum + (item.price || 0), 0);
      const wastedSum = data.filter((i) => i.status === "廃棄").reduce((sum, i) => sum + (i.price || 0), 0);
      const categoryMap: Record<string, number> = {};
      data.forEach((item) => {
        const key = item.category || "その他";
        categoryMap[key] = (categoryMap[key] || 0) + (item.price || 0);
      });
      setByCategory(Object.entries(categoryMap).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount));
      setTotalSpent(spent);
      setWasted(wastedSum);
    }
    setLoading(false);
  };

  const target = getTargetMonth();
  const monthLabel = `${target.getFullYear()}年${target.getMonth() + 1}月`;

  return (
    <main className="page">
      <Nav />
      <h1>家計簿</h1>

      <div className="month-nav">
        <button className="btn" onClick={() => setMonthOffset((m) => m - 1)}>← 前月</button>
        <span>{monthLabel}</span>
        <button className="btn" onClick={() => setMonthOffset((m) => m + 1)} disabled={monthOffset >= 0}>翌月 →</button>
      </div>

      {loading && <p className="status-msg">読み込み中...</p>}

      <div className="summary-box">
        <div className="label">{monthLabel}の食費合計</div>
        <div className="value">¥{totalSpent.toLocaleString()}</div>
      </div>
      <div className="summary-box">
        <div className="label">{monthLabel}の食品ロス額（廃棄した金額）</div>
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