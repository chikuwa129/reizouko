// カテゴリごとの目安の日持ち日数（キーワードが含まれていればマッチ）
const CATEGORY_SHELF_LIFE: Record<string, number> = {
  肉: 3,
  魚: 2,
  惣菜: 1,
  乳製品: 7,
  豆腐: 5,
  納豆: 14,
  調味料: 180,
  飲料: 30,
  野菜: 5,
};

const DEFAULT_SHELF_LIFE = 7;

export function getShelfLifeDays(category: string): number {
  for (const key in CATEGORY_SHELF_LIFE) {
    if (category.includes(key)) return CATEGORY_SHELF_LIFE[key];
  }
  return DEFAULT_SHELF_LIFE;
}

// 購入日とカテゴリから「残り日数」を計算する
export function getRemainingDays(purchaseDate: string, category: string): number {
  const shelfLife = getShelfLifeDays(category);
  const purchase = new Date(purchaseDate);
  const today = new Date();
  const diffDays = Math.floor(
    (today.getTime() - purchase.getTime()) / (1000 * 60 * 60 * 24)
  );
  return shelfLife - diffDays;
}