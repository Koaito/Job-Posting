import { CardSkeleton } from '@/components/ui/skeleton/CardSkeleton';

/**
 * B.2 Polish (mục 6.6, 09/2026). /data-management là panel Export/
 * Import (không phải bảng/card-grid) — dùng skeleton dạng card 1 khối
 * lớn (giả lập panel filter/preview đang tải), khác số lượng với
 * /crawl vì đây chỉ 1 panel tại 1 thời điểm (không phải nhiều nguồn
 * crawl song song).
 */
export default function Loading() {
  return (
    <>
      <div className="page-head">
        <div>
          <span className="skeleton-bar skeleton-bar--title" style={{ width: '180px' }} />
          <span className="skeleton-bar" style={{ width: '340px', marginTop: '8px' }} />
        </div>
      </div>
      <CardSkeleton count={1} lines={4} />
    </>
  );
}
