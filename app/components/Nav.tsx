import Link from "next/link";

export default function Nav() {
  return (
    <nav
      style={{
        display: "flex",
        gap: 16,
        marginBottom: 16,
        paddingBottom: 12,
        borderBottom: "1px solid #ddd",
        fontSize: 14,
      }}
    >
      <Link href="/">レシート撮影</Link>
      <Link href="/fridge">冷蔵庫の中身</Link>
    </nav>
  );
}