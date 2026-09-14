/**
 * REFACTOR (audit 09/2026, "Đánh giá kiến trúc" #2): tách khỏi
 * lib/api/client.ts — client.ts trước đây là "god file" (935 dòng) gộp 3
 * trách nhiệm không liên quan: (1) HTTP transport thuần (apiFetch/
 * apiFetchRaw), (2) auth/token refresh + cookie (mọi thứ trong file
 * này), (3) engine dịch lỗi động (lib/api/error-translation.ts). Ba mối
 * quan tâm khác hẳn nhau bị trộn 1 chỗ, khó test độc lập và dễ conflict
 * khi nhiều người cùng sửa 1 file. File này chỉ còn giữ đúng phần auth
 * token: build headers (JSON + upload), refresh access_token, ghi cookie
 * session.
 *
 * client.ts (transport) import lại getAuthHeaders/getAuthHeadersForUpload/
 * refreshAccessToken/setAuthCookies từ đây để dùng trong apiFetchRaw() —
 * KHÔNG có logic mới nào bị đổi trong đợt tách file này, chỉ di chuyển
 * nguyên vẹn.
 */

import { cookies } from 'next/headers';
import { getApiKey, getApiBase } from '@/lib/api/env';

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
    response = await fetch(`${getApiBase()}/auth/refresh`, {
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
 * trong apiFetchRaw() (lib/api/client.ts). Chuyển từ actions/auth.ts về
 * đây (09/2026) cùng lý do với refreshAccessToken().
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
