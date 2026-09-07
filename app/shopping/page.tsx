"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import Nav from "../components/Nav";

export default function ShoppingPage() {
  const [memo, setMemo] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState("");

  useEffect(() => {
    fetchMemo();
  }, []);

  const fetchMemo = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("shopping_memo")
      .select("*")
      .order("created_at", { ascending: true });
    if (!error && data) setMemo(data);
    setLoading(false);
  };

  const deleteItem = async (id: number) => {
    await supabase.from("shopping_memo").delete().eq("id", id);
    fetchMemo();
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    await supabase.from("shopping_memo").insert({ name: newItem.trim() });
    setNewItem("");
    fetchMemo();
  };

  return (
    <main className="page">
      <Nav />
      <h1>買い物メモ</h1>
      <p className="empty">
        レシートを撮影すると、買ったものと一致するメモは自動で消えます
      </p>

      <form onSubmit={addItem} className="form">
        <input
          className="input"
          placeholder="追加する食材名"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
        />
        <button className="btn" type="submit">追加</button>
      </form>

      {loading && <p className="status-msg">読み込み中...</p>}
      {memo.length === 0 && <p className="empty">メモはありません</p>}

      {memo.map((m) => (
        <div className="item" key={m.id}>
          <div className="item-name">{m.name}</div>
          <button className="btn btn-danger" onClick={() => deleteItem(m.id)}>
            削除
          </button>
        </div>
      ))}
    </main>
  );
}