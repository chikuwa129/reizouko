"use client";

import Link from "next/link";
import { useState } from "react";

export default function Nav() {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <nav className="bottom-nav">
        <Link href="/" className="bottom-nav-item">
          <svg className="bottom-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="7" width="18" height="13" rx="2" />
            <path d="M8 7l2-3h4l2 3" />
            <circle cx="12" cy="13.5" r="3.5" />
          </svg>
          <span>撮影</span>
        </Link>
        <Link href="/fridge" className="bottom-nav-item">
          <svg className="bottom-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="6" y="3" width="12" height="18" rx="2" />
            <line x1="6" y1="10.5" x2="18" y2="10.5" />
          </svg>
          <span>冷蔵庫</span>
        </Link>
        <Link href="/shopping" className="bottom-nav-item">
          <svg className="bottom-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 6h16l-1.5 11a2 2 0 0 1-2 1.7H7.5a2 2 0 0 1-2-1.7L4 6z" />
            <path d="M8 6V5a4 4 0 0 1 8 0v1" />
          </svg>
          <span>買い物</span>
        </Link>
        <button className="bottom-nav-item bottom-nav-more" onClick={() => setMoreOpen(true)}>
          <svg className="bottom-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
          </svg>
          <span>もっと</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="more-overlay" onClick={() => setMoreOpen(false)}>
          <div className="more-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="more-sheet-header">
              <span>メニュー</span>
              <button className="btn" onClick={() => setMoreOpen(false)}>閉じる</button>
            </div>
            <Link href="/budget" className="more-sheet-item" onClick={() => setMoreOpen(false)}>家計簿</Link>
            <Link href="/manual" className="more-sheet-item" onClick={() => setMoreOpen(false)}>手動入力</Link>
            <Link href="/receipts" className="more-sheet-item" onClick={() => setMoreOpen(false)}>履歴</Link>
            <Link href="/recipes" className="more-sheet-item" onClick={() => setMoreOpen(false)}>保存レシピ</Link>
            <Link href="/help" className="more-sheet-item" onClick={() => setMoreOpen(false)}>使い方</Link>
          </div>
        </div>
      )}
    </>
  );
}