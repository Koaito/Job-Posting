import { TableSkeleton } from '@/components/ui/skeleton/TableSkeleton';

/**
 * B.2 Polish (mục 6.6, 09/2026). columns=6 khớp đúng số cột thật của
 * bảng /students (Họ tên, Email, SĐT, Track, Trạng thái, Đăng nhập gần
 * nhất — xem page.tsx dòng ~65-70).
 */
export default function Loading() {
  return (
    <>
      <div className="page-head">
        <span className="skeleton-bar skeleton-bar--title" style={{ width: '160px' }} />
      </div>
      <TableSkeleton rows={6} columns={6} />
    </>
  );
}
