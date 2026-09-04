"use client";

import { useState } from "react";
import { supabase } from "./lib/supabase";

export default function Home() {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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
        await saveToSupabase(data.items);
      }
    } catch (e) {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const rows = items.map((item) => ({
  name: item.name,
  category: item.category,
  price: item.price,
  type: item.type,
  quantity: item.quantity ?? 1,
  purchase_date: today,
  status: "未消費",
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
    <main style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
      <Nav />
      import Nav from "./components/Nav"; // app直下の page.tsx の場合
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>レシート読み取りテスト</h1>
      <a href="/fridge" style={{ display: "block", marginBottom: 16 }}>冷蔵庫の中身を見る →</a>

      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        style={{ marginBottom: 16 }}
      />

      {preview && (
        <img
          src={preview}
          alt="preview"
          style={{ width: "100%", marginBottom: 16, borderRadius: 8 }}
        />
      )}

      {loading && <p>解析中...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      {saved && <p style={{ color: "green" }}>冷蔵庫に保存しました！</p>}

      {result && (
        <pre
          style={{
            background: "#f4f4f4",
            padding: 12,
            borderRadius: 8,
            whiteSpace: "pre-wrap",
            fontSize: 14,
          }}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </main>
  );
}