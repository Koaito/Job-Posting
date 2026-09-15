import { CardSkeleton } from '@/components/ui/skeleton/CardSkeleton';

/**
 * B.2 Polish (mục 6.6, 09/2026) — hiện NGAY khi chuyển sang /jobs, lúc
 * `page.tsx` (Server Component) đang fetch `getJobs()`. Cố ý KHÔNG gọi
 * `getTranslations()`/bất kỳ hàm async nào ở đây — bản chất của
 * `loading.tsx` là fallback tức thời trong lúc route thật còn đang
 * chạy, gọi thêm async ở đây sẽ triệt tiêu chính mục đích đó.
 *
 * `.skeleton-card-grid` (bên trong `<CardSkeleton>`) dùng flex-wrap +
 * gap 16px — cùng cơ chế với `.job-grid.job-grid-3col` trang /jobs
 * thật (page.tsx dòng ~164), nên không cần bọc thêm class đó ở đây.
 */
export default function Loading() {
  return (
    <>
      <div className="page-head">
        <div>
          <span className="skeleton-bar skeleton-bar--title" style={{ width: '160px' }} />
          <span className="skeleton-bar" style={{ width: '260px', marginTop: '8px' }} />
        </div>
      </div>
      <CardSkeleton count={9} lines={2} />
    </>
  );
}
