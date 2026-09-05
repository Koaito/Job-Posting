/**
 * API Client utilities for calling Server Actions
 * All API calls go through Next.js Server Actions (BFF pattern)
 * NEVER expose API keys to browser!
 */

import { cookies } from 'next/headers';

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
 * REFACTOR (09/2026): gom về 1 chỗ dùng chung — trước đây hàm này bị
 * copy-paste y hệt ở 7 file khác nhau trong app/actions/ (audit.ts,
 * companies.ts, contacts.ts, crawl.ts, jobs.ts, me.ts, messages.ts).
 * Mỗi module mới (import-export, staff-activity...) trước đây sẽ phải
 * copy thêm 1 lần nữa — nay chỉ cần import từ đây.
 *
 * Trả về headers chuẩn cho request JSON: X-API-Key + Content-Type +
 * Authorization (nếu có access_token trong cookie).
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  const headers: Record<string, string> = {
    'X-API-Key': getApiKey(),
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  return headers;
}

/**
 * Biến thể cho request multipart/form-data (upload file, vd POST
 * /me/applications) — KHÔNG set Content-Type thủ công. fetch() tự sinh
 * header "Content-Type: multipart/form-data; boundary=..." đúng khi body
 * là FormData — set thủ công "multipart/form-data" (thiếu boundary) sẽ
 * khiến backend không parse được form, luôn trả 422.
 *
 * Trước đây chỉ có ở actions/me.ts (getAuthHeadersForUpload), nay dùng
 * chung được cho mọi module có upload (vd Import/Export CSV sắp tới).
 */
export async function getAuthHeadersForUpload(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  const headers: Record<string, string> = {
    'X-API-Key': getApiKey(),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  return headers;
}

/**
 * REFACTOR (09/2026, "Đánh giá kiến trúc" #1+#2): trước đây KHÔNG có lớp
 * "fetch tới backend" dùng chung — mỗi Server Action (12 file) tự lặp lại
 * y hệt khối AbortController + setTimeout(30000) + try/finally clearTimeout
 * + check response.ok + parse lỗi + console.error + catch network error
 * (49 lần trên 8 file: audit.ts, companies.ts, contacts.ts, crawl.ts,
 * import-export.ts, jobs.ts, me.ts, messages.ts). Đồng thời CHỈ
 * getCurrentUser() (actions/auth.ts) có auto-refresh token khi 401 — mọi
 * action ghi dữ liệu khác (createJob, createCompany, sendMessage...) fail
 * thẳng 401 nếu access_token hết hạn giữa lúc thao tác, dù refresh_token
 * vẫn còn hợp lệ.
 *
 * apiFetchRaw()/apiFetch() dưới đây gộp cả 2 việc về 1 chỗ:
 *   - Tự build headers (X-API-Key/Authorization, JSON hoặc multipart).
 *   - Tự set timeout qua AbortSignal.timeout() (thay AbortController +
 *     setTimeout thủ công — jest.setup.js đã polyfill cho môi trường test).
 *   - Tự thử refresh access_token đúng 1 lần khi gặp 401 với
 *     error_code === "token_expired" (dùng LẠI đúng refreshAccessToken()/
 *     setAuthCookies() bên dưới — cùng 1 nguồn logic với getCurrentUser(),
 *     không viết lại lần 2), rồi gọi lại request gốc với token mới.
 *   - Formatting lỗi dùng chung formatErrorDetail() (bản đầy đủ nhất, có
 *     xử lý "loc" — trước đây jobs.ts có bản này, 6 file khác dùng bản cũ
 *     hơn thiếu tính năng, xem TODO mục 4 trong plan_nextjs.md).
 */

const API_BASE = process.env.FASTAPI_URL;

/**
 * Chuẩn hoá "detail" lỗi từ FastAPI về 1 chuỗi dễ đọc — 2 dạng thật có thể
 * gặp: string đơn giản (raise thủ công trong router) hoặc mảng object
 * {loc, msg, type} (Pydantic tự validate, extra="forbid"/min_length...).
 * Bản đầy đủ nhất trong 7 bản từng bị khai trùng lặp — có xử lý "loc" để
 * biết lỗi thuộc field nào (trước đây chỉ jobs.ts có, 6 file khác thiếu).
 */
export function formatErrorDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === 'object' && 'msg' in item) {
          const loc =
            'loc' in item && Array.isArray((item as { loc?: unknown[] }).loc)
              ? (item as { loc: unknown[] }).loc.filter((p) => p !== 'body').join('.')
              : '';
          const msg = String((item as { msg: unknown }).msg);
          return loc ? `${loc}: ${msg}` : msg;
        }
        return typeof item === 'string' ? item : JSON.stringify(item);
      })
      .join('; ');
  }
  if (detail && typeof detail === 'object') return JSON.stringify(detail);
  return 'Có lỗi xảy ra';
}

/**
 * Khớp AccessTokenOut (schemas/auth.py) — response của POST /auth/refresh.
 * LƯU Ý: refresh_token cũng bị đổi mới (rotation) mỗi lần refresh — token
 * cũ bị thu hồi ngay, không dùng lại được.
 */
export interface RefreshTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

/**
 * Kết quả refresh — discriminated union để nơi gọi tự quyết định đúng
 * hành vi cho từng trường hợp (chuyển từ actions/auth.ts về đây để
 * apiFetchRaw() dùng lại được đúng 1 nguồn logic, không viết lại lần 2):
 * - { ok: true, tokens } — refresh thành công.
 * - { ok: false, reason: 'invalid' } — backend xác nhận refresh_token
 *   không dùng được nữa -> nơi gọi nên xoá cookie, coi như hết phiên.
 * - { ok: false, reason: 'network_error' } — không xác định được, có thể
 *   refresh_token vẫn hợp lệ -> KHÔNG xoá cookie, thử lại request kế tiếp.
 */
export type RefreshResult =
  | { ok: true; tokens: RefreshTokens }
  | { ok: false; reason: 'invalid' | 'network_error' };

/**
 * Đổi refresh_token lấy 1 cặp token mới — POST /auth/refresh. KHÔNG throw,
 * luôn trả RefreshResult. Chuyển từ actions/auth.ts::refreshAccessToken()
 * về đây (09/2026) để apiFetchRaw() (dùng cho MỌI action ghi dữ liệu) và
 * getCurrentUser() (actions/auth.ts) dùng chung đúng 1 bản, thay vì để
 * getCurrentUser() là nơi DUY NHẤT biết refresh — xem "Đánh giá kiến
 * trúc" #2 trong plan_nextjs.md.
 */
export async function refreshAccessToken(refreshToken: string): Promise<RefreshResult> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': getApiKey(),
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    });
  } catch (error) {
    console.error('Refresh access token network error:', error);
    return { ok: false, reason: 'network_error' };
  }

  if (!response.ok) {
    // Backend đã trả lời rõ ràng (401 invalid/expired/revoked, 429, 5xx...)
    // — coi mọi !ok non-network-error là 'invalid' để giữ logic đơn giản,
    // giống nguyên bản ở actions/auth.ts.
    return { ok: false, reason: 'invalid' };
  }

  try {
    const tokens: RefreshTokens = await response.json();
    return { ok: true, tokens };
  } catch (error) {
    console.error('Refresh access token: invalid JSON response', error);
    return { ok: false, reason: 'network_error' };
  }
}

/**
 * Ghi cookie access_token + refresh_token — dùng chung cho login(),
 * auto-refresh trong getCurrentUser() (actions/auth.ts), VÀ auto-refresh
 * trong apiFetchRaw() bên dưới (mọi action ghi dữ liệu khác). Chuyển từ
 * actions/auth.ts về đây (09/2026) cùng lý do với refreshAccessToken().
 */
export async function setAuthCookies(accessToken: string, refreshToken: string) {
  const cookieStore = await cookies();

  cookieStore.set('access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });

  cookieStore.set('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });
}

export interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** JSON-serializable (auto JSON.stringify) hoặc FormData khi isUpload=true. */
  body?: unknown;
  /**
   * true (mặc định): gắn Authorization: Bearer (nếu có access_token) +
   * X-API-Key qua getAuthHeaders(), và BẬT auto-refresh khi 401
   * token_expired. false: CHỈ gắn X-API-Key (route public, không cần JWT
   * — vd GET /jobs, GET /sources).
   */
  auth?: boolean;
  /** true: dùng getAuthHeadersForUpload() (không set Content-Type thủ
   * công) + body là FormData, không JSON.stringify. */
  isUpload?: boolean;
  cache?: RequestCache;
  /** Mặc định 30000ms. Một số route poll nhanh (crawl status/logs) dùng
   * 15000ms — xem actions/crawl.ts. */
  timeoutMs?: number;
}

/**
 * Lớp fetch-tới-backend dùng chung — trả thẳng Response (đã qua auto-
 * refresh-on-401 nếu auth=true), để action nào có nhu cầu đọc response
 * đặc biệt (binary/arrayBuffer ở import-export.ts, phân biệt 201 vs 202
 * ở messages.ts::sendMessage) tự xử lý tiếp phần thân response, KHÔNG
 * phải tự viết lại timeout/header/refresh.
 *
 * LƯU Ý: nếu fetch() throw (lỗi mạng/DNS/timeout), hàm này THROW LUÔN
 * (không tự catch) — nơi gọi (apiFetch() bên dưới, hoặc action tự viết
 * try/catch riêng) chịu trách nhiệm bắt lỗi này, giữ đúng convention
 * try/catch đã có sẵn khắp actions/*.ts.
 */
export async function apiFetchRaw(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const { method = 'GET', body, auth = true, isUpload = false, cache, timeoutMs = 30000 } = options;

  const url = `${API_BASE}${path}`;

  const buildHeaders = (): Promise<Record<string, string>> => {
    if (!auth) return Promise.resolve({ 'X-API-Key': getApiKey() });
    return isUpload ? getAuthHeadersForUpload() : getAuthHeaders();
  };

  const serializedBody: BodyInit | undefined =
    body === undefined
      ? undefined
      : isUpload || typeof body === 'string'
        ? (body as BodyInit)
        : JSON.stringify(body);

  const doFetch = async (): Promise<Response> =>
    fetch(url, {
      method,
      headers: await buildHeaders(),
      ...(serializedBody !== undefined ? { body: serializedBody } : {}),
      ...(cache ? { cache } : {}),
      signal: AbortSignal.timeout(timeoutMs),
    });

  const response = await doFetch();

  // Auto-refresh: CHỈ khi route cần auth (đính Authorization) và backend
  // trả đúng 401 (api/deps.py::get_current_user luôn kèm error_code trong
  // detail — xem giải thích đầy đủ ở actions/auth.ts::getCurrentUser()).
  // Cùng lý do đã áp dụng ở getCurrentUser(): CHỈ refresh khi error_code
  // CHÍNH XÁC là "token_expired" — "session_replaced"/"session_revoked"
  // nghĩa là refresh_token trên thiết bị này đã bị thu hồi từ trước, cố
  // refresh sẽ bị backend hiểu nhầm là token bị đánh cắp.
  if (auth && response.status === 401) {
    // Đọc body 1 LẦN DUY NHẤT ở đây (không dùng response.clone() — môi
    // trường test (jest mock Response đơn giản trong __tests__/fixtures.ts)
    // không có method này, chỉ Response thật ở runtime Next.js mới có).
    // Nếu không refresh được, "dựng lại" 1 Response tối thiểu (ok/status/
    // statusText/json) từ đúng body đã đọc để trả cho nơi gọi — tránh lỗi
    // "body already used" khi nơi gọi tự đọc response.json() lần nữa.
    const errorBody = await response.json().catch(() => null);
    const errorCode = (errorBody as { detail?: { error_code?: string } } | null)?.detail?.error_code;

    if (errorCode === 'token_expired') {
      const cookieStore = await cookies();
      const refreshToken = cookieStore.get('refresh_token')?.value;

      if (refreshToken) {
        const refreshResult = await refreshAccessToken(refreshToken);

        if (refreshResult.ok) {
          await setAuthCookies(refreshResult.tokens.access_token, refreshResult.tokens.refresh_token);
          // Gọi lại request gốc với token mới — trả THẲNG response mới,
          // không cần dựng lại gì (body chưa bị ai đọc).
          return doFetch();
        }

        if (refreshResult.reason === 'invalid') {
          cookieStore.delete('access_token');
          cookieStore.delete('refresh_token');
          cookieStore.delete('user_data');
        }
        // reason === 'network_error': KHÔNG xoá cookie (có thể refresh_token
        // vẫn hợp lệ, chỉ là không xác định được ngay lúc này) — rơi xuống
        // trả lại response 401 gốc bên dưới, để action hiện lỗi/thử lại.
      }
    }

    return {
      ok: false,
      status: response.status,
      statusText: response.statusText,
      json: async () => errorBody,
    } as Response;
  }

  return response;
}

export type ApiResult<T> =
  | { success: true; data: T; status: number }
  | { success: false; error: string; status: number };

/**
 * Bản bọc JSON-friendly của apiFetchRaw() — dùng cho phần lớn action
 * (GET danh sách/chi tiết, POST/PATCH/DELETE trả JSON hoặc 204 rỗng).
 * Action nào cần xử lý response đặc biệt (binary, nhiều status code
 * thành công khác nhau...) dùng thẳng apiFetchRaw().
 *
 * KHÔNG throw — mọi lỗi (network, timeout, backend trả !ok) đều gói vào
 * ApiResult<T>.success = false, đúng convention try/catch trả về
 * { success: false, error } đã dùng khắp actions/*.ts.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions & { fallbackError?: string } = {}
): Promise<ApiResult<T>> {
  const { fallbackError = 'Có lỗi xảy ra', ...fetchOptions } = options;

  let response: Response;
  try {
    response = await apiFetchRaw(path, fetchOptions);
  } catch (error) {
    console.error(`apiFetch network error [${fetchOptions.method || 'GET'} ${path}]:`, error);
    return { success: false, error: 'Network error', status: 0 };
  }

  if (response.status === 204) {
    return { success: true, data: undefined as T, status: 204 };
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const detail = (errorBody as { detail?: unknown } | null)?.detail;
    return {
      success: false,
      error: detail != null ? formatErrorDetail(detail) : fallbackError,
      status: response.status,
    };
  }

  try {
    const data = (await response.json()) as T;
    return { success: true, data, status: response.status };
  } catch {
    return { success: true, data: undefined as T, status: response.status };
  }
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

/**
 * REFACTOR (09/2026, "Đánh giá kiến trúc" #5, ưu tiên thấp): 9 hàm list
 * (getJobs, getCompanies, getContacts, getContactsByCompany, getAuditLogs,
 * getCrawlHistory, getCrawlBatchHistory, getExportPreview/exportEntity)
 * trước đây tự viết `new URLSearchParams()` rồi chuỗi
 * `if (filters?.x) params.append('x', ...)` thủ công cho từng field —
 * đúng chỗ đã xảy ra bug thật (GET /jobs gửi "search" nhưng backend chờ
 * "keyword", lọc bị bỏ qua trong im lặng vì query lạ không bị FastAPI từ
 * chối). buildParams() KHÔNG giảm được rủi ro sai *tên* param (dev vẫn
 * phải tự đối chiếu đúng tên query thật của backend), nhưng giảm rủi ro
 * quên/thừa dòng `if` khi filter object có nhiều field — mỗi hàm list
 * giờ chỉ cần khai 1 object literal.
 *
 * QUY TẮC bỏ qua field (gộp đúng 2 kiểu check khác nhau đã tồn tại rải
 * rác trước đây về CHUNG 1 quy tắc):
 *   - `undefined`/`null`/chuỗi rỗng `''` -> BỎ QUA (không lọc theo field
 *     này) — khớp đúng hành vi các `if (filters?.x)` cũ dùng cho field
 *     string (keyword, province, search...).
 *   - `false` (boolean) -> VẪN GỬI (`"...=false"`) — khớp đúng hành vi
 *     các chỗ cũ tự check `!== undefined` riêng cho field boolean
 *     (has_social, include_inactive, pending_note...), vì `false` là 1
 *     giá trị lọc CÓ CHỦ Ý, khác hẳn "không truyền field này".
 *   - Số `0` -> VẪN GỬI (khác `''`) — an toàn cho field số có thể hợp lệ
 *     bằng 0 sau này (hiện `limit`/`offset` luôn được set giá trị mặc
 *     định trước khi truyền vào, không đi qua nhánh "bỏ qua" này).
 *
 * LƯU Ý THỨ TỰ: `Object.entries()` giữ đúng thứ tự khai báo trong
 * object literal truyền vào — gọi nơi dùng vẫn chủ động kiểm soát được
 * thứ tự param trên query string y hệt trước đây (1 vài test cũ so
 * khớp cả chuỗi URL, vd `/jobs?limit=50&offset=0`) bằng cách đặt
 * `limit`/`offset` ở cuối object literal.
 */
export function buildParams(
  filters: Record<string, string | number | boolean | undefined | null>
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;
    params.append(key, String(value));
  }
  return params;
}

