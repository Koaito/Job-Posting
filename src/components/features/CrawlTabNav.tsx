'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

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
 *
 * i18n (Giai đoạn 2, nhóm 5, 09/2026): nhãn tab dịch qua
 * useTranslations('crawlTabNav'), key tab (dùng cho query param) giữ
 * nguyên không đổi.
 */

const TAB_KEYS = ['crawl', 'status', 'maintenance', 'history'] as const;

export default function CrawlTabNav({ active }: { active: string }) {
  const router = useRouter();
  const t = useTranslations('crawlTabNav');

  return (
    <nav className="tab-bar" style={{ marginBottom: '22px' }}>
      {TAB_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          className={active === key ? 'active' : ''}
          onClick={() => router.push(`/crawl?tab=${key}`)}
        >
          {t(key)}
        </button>
      ))}
    </nav>
  );
}
