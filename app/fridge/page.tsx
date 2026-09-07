"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getRemainingDays } from "../lib/expiry";
import Nav from "../components/Nav";

export default function FridgePage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [recipeError, setRecipeError] = useState<string | null>(null);

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
    const remainingText =
      remaining < 0 ? `期限切れの可能性（${Math.abs(remaining)}日超過）` : `あと${remaining}日`;
    return remaining <= 1
      ? { label: `そろそろ消費（${remainingText}）`, cls: "warn", isUrgent: true }
      : { label: `まだ余裕あり（${remainingText}）`, cls: "fresh", isUrgent: false };
  };

  const urgentItems = stored.filter((item) => getPriority(item).isUrgent);
  const otherItems = items.filter(
    (item) => item.type !== "non_food" && !urgentItems.includes(item)
  );

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

  const suggestRecipes = async () => {
    setRecipeLoading(true);
    setRecipeError(null);
    setRecipes([]);
    try {
      const res = await fetch("/api/recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urgentItems: urgentItems.map((i) => i.name),
          otherItems: otherItems.map((i) => i.name),
        }),
      });
      const data = await res.json();
      if (data.error) {
        setRecipeError(data.error);
      } else {
        setRecipes(data.recipes);
      }
    } catch (e) {
      setRecipeError("通信エラーが発生しました");
    } finally {
      setRecipeLoading(false);
    }
  };

  const saveRecipe = async (recipe: any) => {
    try {
      await fetch("/api/recipe/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: recipe.title,
          uses: recipe.uses,
          steps: recipe.steps,
        }),
      });
      alert("レシピを保存しました");
    } catch (e) {
      alert("保存に失敗しました");
    }
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

      <h2>使い切りレシピ</h2>
      {urgentItems.length === 0 ? (
        <p className="empty">今のところ、そろそろ消費が必要な食材はありません</p>
      ) : (
        <>
          <p className="empty">
            対象: {urgentItems.map((i) => i.name).join("、")}
          </p>
          <button className="btn" onClick={suggestRecipes} disabled={recipeLoading}>
            {recipeLoading ? "提案中..." : "使い切りレシピを提案"}
          </button>
        </>
      )}

      {recipeError && <p className="status-msg error">{recipeError}</p>}

      {recipes.map((recipe, i) => (
        <div className="recipe-card" key={i}>
          <div className="recipe-title">{recipe.title}</div>
          <div className="item-qty">使う食材: {recipe.uses.join("、")}</div>
          {recipe.missing && recipe.missing.length > 0 && (
            <div className="item-qty" style={{ color: "var(--warn)" }}>
              買い足しが必要: {recipe.missing.join("、")}
            </div>
          )}
          <ol className="recipe-steps">
            {recipe.steps.map((step: string, j: number) => (
              <li key={j}>{step}</li>
            ))}
          </ol>
          <button className="btn" onClick={() => saveRecipe(recipe)} style={{ marginTop: 8 }}>
            レシピを保存
          </button>
        </div>
      ))}
    </main>
  );
}