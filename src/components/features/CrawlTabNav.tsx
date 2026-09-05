'use client';

import { useRouter } from 'next/navigation';

/**
 * Tab nav cho trang /crawl ("Vận hành dữ liệu") — 4 tab, khớp Flask
 * blueprints/crawl.py (crawl/status/maintenance/history).
 *
 * THÊM 09/2026 (rà soát #3, chat139) — trước đây Next.js chỉ có 1/4
 * tab (chỉ nội dung tab "crawl", không có tab nav nào cả).
 *
 * Dùng .tab-bar (public/css/08-dashboard.css, family <button>, KHÁC
 * .tab-nav ở /activity vốn dùng <a>) — đây CHÍNH LÀ family "dashboard.
 * html/crawl.html" mà comment ở activity/page.tsx nhắc tới, chưa từng
 * được dùng tới trước đợt này. Chuyển tab bằng điều hướng query param
 * (`?tab=`) qua router.push() thay vì <Link> thường để khớp đúng
 * selector CSS ".tab-bar button" (Link render ra <a>, sẽ không nhận
 * style hover/active của family này).
 */

const TABS = [
  { key: 'crawl', label: 'Crawl' },
  { key: 'status', label: 'Tình trạng dữ liệu' },
  { key: 'maintenance', label: 'Bảo trì dữ liệu' },
  { key: 'history', label: 'Lịch sử vận hành' },
] as const;

export default function CrawlTabNav({ active }: { active: string }) {
  const router = useRouter();

  return (
    <nav className="tab-bar" style={{ marginBottom: '22px' }}>
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          className={active === t.key ? 'active' : ''}
          onClick={() => router.push(`/crawl?tab=${t.key}`)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
