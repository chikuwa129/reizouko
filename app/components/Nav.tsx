import Link from "next/link";

export default function Nav() {
  return (
    <nav className="nav">
      <Link href="/">レシート撮影</Link>
      <Link href="/fridge">冷蔵庫の中身</Link>
    </nav>
  );
}