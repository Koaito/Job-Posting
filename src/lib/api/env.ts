/**
 * REFACTOR (audit 09/2026, "Đánh giá kiến trúc" #2): tách khỏi
 * lib/api/client.ts — client.ts trước đây là "god file" (935 dòng) gộp 3
 * trách nhiệm không liên quan (HTTP transport / auth token / dịch lỗi
 * động). File này chỉ giữ đúng 2 hàm đọc + validate biến môi trường,
 * dùng chung cho cả lib/api/client.ts (transport) LẪN
 * lib/api/auth-tokens.ts (refreshAccessToken() cần gọi thẳng
 * `${getApiBase()}/auth/refresh`) — tách riêng ra module nhỏ này để 2
 * file kia import lẫn nhau mà không tạo circular import.
 */

/**
 * BUG FIX (audit 09/2026 #8): "process.env.CRAWLER_API_KEY!" (non-null
 * assertion) lặp lại ở 11 chỗ rải rác trong actions/auth.ts,
 * dashboard.ts, jobs.ts — nếu thiếu biến môi trường CRAWLER_API_KEY,
 * "!" chỉ ép kiểu cho TypeScript, KHÔNG kiểm tra thật ở runtime: header
 * "X-API-Key" sẽ gửi literal string "undefined" lên backend thay vì
 * báo lỗi rõ ràng, khiến backend trả 401/403 khó hiểu (không phải do
 * sai auth token, mà do thiếu hẳn API key) — rất khó debug từ phía FE.
 *
 * Đối chiếu Flask gốc (backend_auth.py::_headers()): bản gốc LUÔN
 * check "if not CRAWLER_API_KEY" TRƯỚC khi build headers, raise
 * BackendAuthError("Server chưa cấu hình CRAWLER_API_KEY...") rõ ràng
 * ngay tại thời điểm đó — KHÔNG bao giờ để lọt giá trị rỗng/undefined
 * vào request thật. Hàm dưới đây khôi phục đúng hành vi này, gom logic
 * check về 1 chỗ dùng chung thay vì lặp lại "!" ở 11 nơi.
 *
 * CHỦ Ý check ở RUNTIME (bên trong hàm, gọi mỗi lần cần build headers)
 * chứ KHÔNG check ngay lúc import module — "next build" cũng import
 * các Server Action module để phân tích route ngay cả khi build server
 * chưa set biến môi trường thật (giá trị thật thường chỉ có ở
 * deploy/runtime environment, vd Vercel/Render dashboard) — check lúc
 * import sẽ làm "next build" crash oan dù chưa có request nào thực sự
 * cần gọi backend.
 */
export function getApiKey(): string {
  const apiKey = process.env.CRAWLER_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Server chưa cấu hình CRAWLER_API_KEY (biến môi trường) nên không thể gọi backend.'
    );
  }

  return apiKey;
}

/**
 * REFACTOR (09/2026, "Đánh giá kiến trúc" #2): "process.env.FASTAPI_URL"
 * (không check) từng bị khai riêng ở 3 chỗ khác nhau — client.ts, đây,
 * VÀ actions/dashboard.ts — mỗi nơi tự đặt tên biến API_BASE, KHÔNG có
 * bước validate như getApiKey() ở trên. Thiếu biến môi trường FASTAPI_URL
 * không hề báo lỗi rõ ràng ngay: `${API_BASE}/auth/login` âm thầm build
 * ra URL `undefined/auth/login`, fetch() vẫn chạy (ném lỗi mạng khó hiểu
 * dạng "Failed to parse URL" hoặc DNS lookup fail cho host "undefined")
 * thay vì báo thẳng "thiếu FASTAPI_URL" — đúng loại bug mà getApiKey()
 * từng được viết ra để tránh, nhưng chưa áp dụng nhất quán cho biến môi
 * trường quan trọng không kém này.
 *
 * Cùng nguyên tắc CHỦ Ý check ở RUNTIME (gọi bên trong hàm, không phải
 * hằng số cấp module) như getApiKey() — "next build" cũng import các
 * Server Action module để phân tích route ngay cả khi build server chưa
 * set biến môi trường thật, check ở thời điểm import sẽ làm "next build"
 * crash oan.
 */
export function getApiBase(): string {
  const apiBase = process.env.FASTAPI_URL;

  if (!apiBase) {
    throw new Error(
      'Server chưa cấu hình FASTAPI_URL (biến môi trường) nên không thể gọi backend.'
    );
  }

  return apiBase;
}
