/**
 * Helper hiển thị badge cho trạng thái crawl run — khớp CSS thật, không
 * tự chế class.
 *
 * BUG FIX (audit CSS 09/2026): CrawlTrigger.tsx trước đây dùng
 * `status-chip status-open` / `status-chip status-closed` — 2 class
 * này vốn thuộc domain job (OPEN/CLOSED), tự bịa cho crawl (không khớp
 * bất kỳ selector CSS nào ở đây) NÊN mất màu hoàn toàn (chỉ còn khung/
 * font-size chung của .status-chip).
 *
 * CSS thật cho domain crawl là 1 family HOÀN TOÀN KHÁC: `.badge` (base
 * shape, public/css/12-activity-logs.css) + `.badge-info` / `.badge-success`
 * / `.badge-danger` (public/css/15-crawl.css) — xem CRAWL_STATUS_BADGE
 * (crawler_client/crawl.py, dùng để render _crawl_tab.html gốc):
 *   {"queued": "badge-info", "running": "badge-info",
 *    "done": "badge-success", "error": "badge-danger"}
 *
 * i18n (đợt sau, 09/2026): crawlStatusLabel() giờ nhận `t` — namespace
 * mới `crawlStatus` (key = status value thật 'queued'/'running'/'done'/
 * 'error'). Gọi `useTranslations('crawlStatus')` (Client) hoặc
 * `getTranslations('crawlStatus')` (Server) rồi truyền `t` vào. Class
 * badge (crawlStatusBadgeClass) KHÔNG đổi theo locale — vẫn giữ nguyên,
 * chỉ nhãn hiển thị đổi.
 */

const CRAWL_STATUS_VALUES = ['queued', 'running', 'done', 'error'] as const;

const CRAWL_STATUS_BADGE: Record<string, string> = {
  queued: 'badge-info',
  running: 'badge-info',
  done: 'badge-success',
  error: 'badge-danger',
};

// Fallback cho status lạ ngoài 4 giá trị chuẩn — không đứng 1 mình như
// .status-chip, "badge" luôn cần đi kèm base class (xem badge-danger ở
// jobs/[id]/page.tsx).
const CRAWL_STATUS_BADGE_FALLBACK = 'badge-warning';

export function crawlStatusLabel(
  status: string,
  t: (key: string) => string
): string {
  return (CRAWL_STATUS_VALUES as readonly string[]).includes(status) ? t(status) : status;
}

export function crawlStatusBadgeClass(status: string): string {
  return CRAWL_STATUS_BADGE[status] ?? CRAWL_STATUS_BADGE_FALLBACK;
}
