/**
 * API Client utilities for calling Server Actions
 * All API calls go through Next.js Server Actions (BFF pattern)
 * NEVER expose API keys to browser!
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

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public statusText: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Helper to handle server action responses
 */
export async function handleServerAction<T>(
  action: () => Promise<T>
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      error instanceof Error ? error.message : 'Unknown error',
      500,
      'Internal Server Error'
    );
  }
}
