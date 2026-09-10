import { TableSkeleton } from '@/components/ui/skeleton/TableSkeleton';

/**
 * B.2 Polish (mục 6.6, 09/2026). Trang /contacts có nhiều nhánh return
 * tuỳ role (xem page.tsx — "quản lý của tôi" vs danh sách đầy đủ), đều
 * render đúng 1 bảng `.contact-table` cùng 6 cột (Tên, Công ty, Chức
 * danh, Email/SĐT, Trạng thái, cột hành động rỗng) — loading.tsx dùng
 * chung cho MỌI nhánh, không cần biết trước nhánh nào sẽ render.
 */
export default function Loading() {
  return (
    <>
      <div className="page-head">
        <span className="skeleton-bar skeleton-bar--title" style={{ width: '180px' }} />
      </div>
      <TableSkeleton rows={6} columns={6} />
    </>
  );
}
