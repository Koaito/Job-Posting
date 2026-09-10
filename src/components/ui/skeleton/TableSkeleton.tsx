/**
 * B.2 Polish (mục 6.6, 09/2026) — skeleton dùng CHUNG cho mọi route
 * dạng bảng/danh sách (`/companies`, `/contacts`, `/students`...) —
 * đều đã dùng chung class `.contact-table-wrap` / `.contact-table`
 * (xem `05-contact-table.css`), nên skeleton tái dùng ĐÚNG 2 class đó
 * để khớp layout thật (bề rộng cột, padding, border) thay vì tự bịa
 * kích thước riêng — tránh "nhảy layout" (layout shift) lúc dữ liệu
 * thật load xong và thay thế skeleton.
 *
 * Không nhận props `columns` dạng tên cột thật — chỉ cần ĐÚNG SỐ CỘT để
 * vẽ đủ số thanh xám mỗi hàng; route nào dùng vẫn tự quyết định tiêu đề
 * cột thật của nó (không phải việc của skeleton).
 */

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <div className="contact-table-wrap skeleton-wrap" aria-hidden="true">
      <table className="contact-table">
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i}>
                <span className="skeleton-bar skeleton-bar--head" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: columns }).map((_, c) => (
                <td key={c}>
                  <span
                    className="skeleton-bar"
                    // Cột đầu (thường là tên/nhãn chính) dài hơn các cột
                    // còn lại — khớp đúng thị giác thật (tên dài hơn mã
                    // trạng thái/ngày tháng), không phải số ngẫu nhiên.
                    style={{ width: c === 0 ? '70%' : '45%' }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
