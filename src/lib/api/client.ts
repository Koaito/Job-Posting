/**
 * API Client utilities for calling Server Actions
 * All API calls go through Next.js Server Actions (BFF pattern)
 * NEVER expose API keys to browser!
 *
 * REFACTOR (audit 09/2026, "Đánh giá kiến trúc" #2): file này trước đây
 * dài 935 dòng, gộp 3 trách nhiệm không liên quan — HTTP transport
 * (apiFetch/apiFetchRaw, phần còn lại ở đây), auth/token refresh + cookie
 * (tách sang lib/api/auth-tokens.ts), và engine dịch lỗi động — regex
 * parse tiếng Việt → tiếng Anh, ~300 dòng riêng (tách sang
 * lib/api/error-translation.ts). Ba mối quan tâm khác hẳn nhau bị trộn 1
 * chỗ trước đây khó test độc lập và dễ conflict khi nhiều người cùng sửa
 * 1 file — giờ mỗi file chỉ còn đúng 1 trách nhiệm.
 *
 * File này CHỈ còn giữ transport thuần: build request tới FastAPI
 * backend (headers/timeout/auto-refresh-on-401 qua apiFetchRaw()), bọc
 * JSON-friendly (apiFetch()), và helper build query string (buildParams()).
 * KHÔNG có logic mới nào bị đổi trong đợt tách file này so với bản gốc
 * — getApiKey/getApiBase/getAuthHeaders/getAuthHeadersForUpload/
 * refreshAccessToken/setAuthCookies/formatErrorDetail được RE-EXPORT lại
 * từ đây để 11 file app/actions/*.ts đang `import { ... } from
 * '@/lib/api/client'` không phải sửa lại import, dù nguồn thật giờ ở 3
 * file khác nhau.
 */

import { cookies } from 'next/headers';
import { getApiKey, getApiBase } from '@/lib/api/env';
import {
  getAuthHeaders,
  getAuthHeadersForUpload,
  refreshAccessToken,
  setAuthCookies,
} from '@/lib/api/auth-tokens';
import { formatErrorDetail, getGenericErrorMessage, getNetworkErrorMessage } from '@/lib/api/error-translation';

// Re-export để 11 file app/actions/*.ts (+ __tests__/lib/api/client.test.ts)
// đang import từ '@/lib/api/client' tiếp tục hoạt động không cần sửa —
// nguồn thật của các hàm này giờ ở lib/api/env.ts, lib/api/auth-tokens.ts,
// lib/api/error-translation.ts (xem comment ở từng file).
export { getApiKey, getApiBase } from '@/lib/api/env';
export {
  getAuthHeaders,
  getAuthHeadersForUpload,
  refreshAccessToken,
  setAuthCookies,
  type RefreshTokens,
  type RefreshResult,
} from '@/lib/api/auth-tokens';
export { formatErrorDetail } from '@/lib/api/error-translation';

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
 *   - Tự build headers (X-API-Key/Authorization, JSON hoặc multipart) —
 *     qua getAuthHeaders()/getAuthHeadersForUpload() (lib/api/auth-tokens.ts).
 *   - Tự set timeout qua AbortSignal.timeout() (thay AbortController +
 *     setTimeout thủ công — jest.setup.js đã polyfill cho môi trường test).
 *   - Tự thử refresh access_token đúng 1 lần khi gặp 401 với
 *     error_code === "token_expired" (dùng LẠI đúng refreshAccessToken()/
 *     setAuthCookies() từ lib/api/auth-tokens.ts — cùng 1 nguồn logic với
 *     getCurrentUser(), không viết lại lần 2), rồi gọi lại request gốc
 *     với token mới.
 *   - Formatting lỗi dùng chung formatErrorDetail() (lib/api/error-translation.ts,
 *     bản đầy đủ nhất, có xử lý "loc" — trước đây jobs.ts có bản này, 6
 *     file khác dùng bản cũ hơn thiếu tính năng, xem TODO mục 4 trong
 *     plan_nextjs.md).
 */

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

  const url = `${getApiBase()}${path}`;

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
  const { fallbackError, ...fetchOptions } = options;

  let response: Response;
  try {
    response = await apiFetchRaw(path, fetchOptions);
  } catch (error) {
    console.error(`apiFetch network error [${fetchOptions.method || 'GET'} ${path}]:`, error);
    return { success: false, error: await getNetworkErrorMessage(), status: 0 };
  }

  if (response.status === 204) {
    return { success: true, data: undefined as T, status: 204 };
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const detail = (errorBody as { detail?: unknown } | null)?.detail;
    return {
      success: false,
      error: detail != null ? await formatErrorDetail(detail) : fallbackError ?? (await getGenericErrorMessage()),
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
