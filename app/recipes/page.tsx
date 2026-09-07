"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import Nav from "../components/Nav";

export default function SavedRecipesPage() {
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecipes();
  }, []);

  const fetchRecipes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("recipes")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setRecipes(data);
    setLoading(false);
  };

  const deleteRecipe = async (id: number) => {
    if (!confirm("このレシピを削除しますか？")) return;
    await supabase.from("recipes").delete().eq("id", id);
    fetchRecipes();
  };

  return (
    <main className="page">
      <Nav />
      <h1>保存したレシピ</h1>

      {loading && <p className="status-msg">読み込み中...</p>}
      {recipes.length === 0 && <p className="empty">まだ保存したレシピはありません</p>}

      {recipes.map((recipe) => (
        <div className="recipe-card" key={recipe.id}>
          <div className="recipe-title">{recipe.title}</div>
          <div className="item-qty">使う食材: {recipe.uses}</div>
          <ol className="recipe-steps">
            {recipe.steps.split("\n").map((step: string, j: number) => (
              <li key={j}>{step}</li>
            ))}
          </ol>
          <button className="btn btn-danger" onClick={() => deleteRecipe(recipe.id)} style={{ marginTop: 8 }}>
            削除
          </button>
        </div>
      ))}
    </main>
  );
}