import { CardSkeleton } from '@/components/ui/skeleton/CardSkeleton';

/**
 * B.2 Polish (mục 6.6, 09/2026). /crawl có 4 tab (crawl/status/
 * maintenance/history), mỗi tab layout khác nhau (nguồn crawl dạng
 * card, bảng lịch sử, panel bảo trì...) — loading.tsx không biết trước
 * tab nào đang mở (searchParams chỉ đọc được trong page.tsx thật), nên
 * dùng skeleton dạng card chung chung (3 khối) thay vì cố đoán đúng
 * hình dạng từng tab — tốt hơn màn hình trắng, không cần khớp pixel.
 */
export default function Loading() {
  return (
    <>
      <div className="page-head">
        <div>
          <span className="skeleton-bar skeleton-bar--title" style={{ width: '140px' }} />
          <span className="skeleton-bar" style={{ width: '320px', marginTop: '8px' }} />
        </div>
      </div>
      <CardSkeleton count={3} lines={3} />
    </>
  );
}
