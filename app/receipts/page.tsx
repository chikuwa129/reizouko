"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import Nav from "../components/Nav";

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchReceipts();
  }, []);

  const fetchReceipts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("purchase_date", { ascending: false });

    if (!error && data) {
      const grouped: Record<string, any> = {};
      data.forEach((item) => {
        const key = item.receipt_id || `no-id-${item.id}`;
        if (!grouped[key]) {
          grouped[key] = { receipt_id: item.receipt_id, purchase_date: item.purchase_date, items: [], total: 0 };
        }
        grouped[key].items.push(item);
        grouped[key].total += item.price || 0;
      });
      setReceipts(Object.values(grouped));
    }
    setLoading(false);
  };

  const deleteReceipt = async (receiptId: string | null) => {
    if (!confirm("このレシートの内容を全部削除しますか？")) return;
    if (receiptId) {
      await supabase.from("products").delete().eq("receipt_id", receiptId);
    }
    fetchReceipts();
  };

  const toggleOpen = (key: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <main className="page">
      <Nav />
      <h1>読み込み履歴</h1>
      {loading && <p className="status-msg">読み込み中...</p>}
      {receipts.length === 0 && <p className="empty">履歴なし</p>}
      {receipts.map((r) => {
        const key = r.receipt_id || `no-id-${r.items[0].id}`;
        const isOpen = openIds.has(key);
        return (
          <div key={key} className="receipt-group">
            <div className="item" onClick={() => toggleOpen(key)} style={{ cursor: "pointer" }}>
              <div>
                <div className="item-name">
                  {isOpen ? "▾" : "▸"} {r.purchase_date}（{r.items.length}件）
                </div>
                <div className="item-qty">¥{r.total.toLocaleString()}</div>
              </div>
              <button
                className="btn btn-danger"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteReceipt(r.receipt_id);
                }}
              >
                削除
              </button>
            </div>

            {isOpen && (
              <div className="receipt-detail">
                {r.items.map((item: any) => (
                  <div className="receipt-detail-row" key={item.id}>
                    <span>
                      {item.name}
                      {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                    </span>
                    <span>¥{(item.price || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </main>
  );
}