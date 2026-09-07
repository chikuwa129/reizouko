"use client";

import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import Nav from "./components/Nav";

export default function Home() {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    fetchRemaining();
  }, []);

  const fetchRemaining = async () => {
    try {
      const res = await fetch("/api/receipt");
      const data = await res.json();
      if (typeof data.remaining === "number") setRemaining(data.remaining);
    } catch (e) {
      // 取得失敗時は表示しないだけでOK
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      sendToGemini(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const sendToGemini = async (image: string) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setSaved(false);
    try {
      const res = await fetch("/api/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data.items);
        setPurchaseDate(data.purchaseDate ?? null);
        if (typeof data.remaining === "number") setRemaining(data.remaining);
        await saveToSupabase(data.items, data.purchaseDate);
      }
    } catch (e) {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
      fetchRemaining();
    }
  };

  const saveToSupabase = async (items: any[], purchaseDate: string | null) => {
  const date = purchaseDate || new Date().toISOString().split("T")[0];
  const receiptId = crypto.randomUUID();
  const rows = items.map((item) => ({
    name: item.name,
    category: item.category,
    price: item.price,
    type: item.type,
    quantity: item.quantity ?? 1,
    purchase_date: date,
    status: "未消費",
    receipt_id: receiptId,
  }));

  const { error: insertError } = await supabase.from("products").insert(rows);
  if (insertError) {
    console.error(insertError);
    setError("Supabaseへの保存に失敗しました: " + insertError.message);
  } else {
    setSaved(true);
  }
};

  return (
    <main className="page">
      <Nav />
      <h1>レシート撮影</h1>

      {remaining !== null && (
        <p className="quota-text">本日の残り: {remaining} / 20 回</p>
      )}

      <div className="upload">
        <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} />
      </div>

      {preview && <img src={preview} alt="preview" className="preview-img" />}

      {loading && <p className="status-msg">解析中...</p>}
      {error && <p className="status-msg error">{error}</p>}
      {saved && <p className="status-msg success">冷蔵庫に保存しました</p>}
      {saved && <p className="status-msg">読み取った購入日: {result?.purchaseDate ?? "不明"}</p>}

      {result && <pre className="result-json">{JSON.stringify(result, null, 2)}</pre>}
    </main>
  );
}