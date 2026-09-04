import Link from "next/link";

export default function Nav() {
  return (
    <nav className="nav">
      <Link href="/">レシート撮影</Link>
      <Link href="/fridge">冷蔵庫の中身</Link>
      <Link href="/budget">家計簿</Link>
      <Link href="/manual">手動入力</Link>
      <Link href="/receipts">履歴</Link>
      <Link href="/help">使い方</Link>
    </nav>
  );
}