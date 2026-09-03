"use client";

import { useState } from "react";

export default function Home() {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

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
      }
    } catch (e) {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>レシート読み取りテスト</h1>

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