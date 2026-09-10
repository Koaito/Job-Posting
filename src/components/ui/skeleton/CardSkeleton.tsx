/**
 * B.2 Polish (mục 6.6, 09/2026) — skeleton dùng CHUNG cho route dạng
 * thẻ (`/jobs` — `.ticket` trong `.job-grid`, xem `04-job-cards.css`)
 * và route dạng panel không phải bảng (`/crawl`, `/data-management` —
 * chưa có 1 class "card" chuẩn hoá riêng, nên dùng `.card` sẵn có ở
 * `07-forms.css`, đã dùng lại nhiều nơi khác trong app cho khối nội
 * dung bo góc + border, không tự bịa class mới).
 *
 * `lines` = số thanh xám mô phỏng nội dung bên trong 1 thẻ (không tính
 * dòng tiêu đề, luôn có riêng) — mặc định 2 vì phần lớn card/ticket
 * hiện có đều có dạng "tiêu đề + 2 dòng mô tả ngắn".
 */

interface CardSkeletonProps {
  count?: number;
  lines?: number;
}

export function CardSkeleton({ count = 6, lines = 2 }: CardSkeletonProps) {
  return (
    <div className="skeleton-card-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className="card skeleton-card" key={i}>
          <span className="skeleton-bar skeleton-bar--title" />
          {Array.from({ length: lines }).map((_, l) => (
            <span
              key={l}
              className="skeleton-bar"
              style={{ width: l === lines - 1 ? '55%' : '85%' }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
