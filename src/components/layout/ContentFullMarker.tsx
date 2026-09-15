/**
 * Tương đương Flask `{% block content_class %}content-full{% endblock %}`
 * (xem base.html) — trang nào cần bỏ giới hạn `max-width: 1800px` của
 * `.content` (root layout.tsx) thì render component này ở bất kỳ đâu
 * trong cây JSX của mình.
 *
 * Cách hoạt động: root layout.tsx cố định `<main className="content">`
 * ở 1 chỗ duy nhất, page.tsx (con) không với lên sửa class của cha được
 * bằng cách thông thường. Thay vào đó dùng CSS `:has()` — miễn marker
 * này còn là hậu duệ (descendant) của `.content` (không cần là con trực
 * tiếp), selector `.content:has(.content-full-marker)` ở
 * public/css/03-layout.css sẽ tự áp dụng `max-width: none` lên `.content`.
 *
 * Không render gì ra UI (ẩn hoàn toàn) — chỉ tồn tại để CSS `:has()`
 * "nhìn thấy".
 */
export function ContentFullMarker() {
  return <span className="content-full-marker" aria-hidden="true" hidden />;
}
