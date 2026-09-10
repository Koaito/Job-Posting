import { TableSkeleton } from '@/components/ui/skeleton/TableSkeleton';

/**
 * B.2 Polish (mục 6.6, 09/2026). columns=6 khớp đúng số cột thật của
 * bảng /companies (Tên công ty, Ngành, Tỉnh/thành, Quy mô, Website, cột
 * hành động rỗng — xem page.tsx dòng ~100-106).
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
      <TableSkeleton rows={6} columns={6} />
    </>
  );
}
