'use server';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getApiKey } from '@/lib/api/client';
import type { User, UserCreatePayload, UserCreated, JobApplication, SavedJob } from '@/types/auth';

/**
 * Server Actions for Authentication
 * Corresponds to Flask blueprint: blueprints/auth.py
 */

const API_BASE = process.env.FASTAPI_URL;

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

/**
 * Khớp AccessTokenOut (schemas/auth.py) — response của POST /auth/refresh.
 * LƯU Ý: refresh_token cũng bị đổi mới (xoay vòng/rotation) — token cũ bị
 * thu hồi ngay, KHÔNG dùng lại được (auth_session.py::refresh(), nếu gửi
 * lại token cũ sau khi đã xoay vòng sẽ bị coi là dấu hiệu bị đánh cắp và
 * thu hồi TOÀN BỘ token của user). Vì vậy phải ghi đè cả 2 cookie mỗi lần
 * refresh, không phải chỉ access_token.
 */
interface RefreshResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

/**
 * Ghi cookie access_token + refresh_token — dùng chung cho login() và
 * auto-refresh trong getCurrentUser(), tránh lặp lại options cookie ở 2
 * chỗ (dễ lệch nhau nếu sửa 1 chỗ quên chỗ kia).
 */
async function setAuthCookies(accessToken: string, refreshToken: string) {
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

// BUG FIX (audit 09/2026): interface cũ bịa ra "id: number" và
// "is_staff: boolean" — 2 field này KHÔNG tồn tại trong response thật
// của GET/PATCH /auth/me (schemas/auth.py::UserOut chỉ có "ss_user_id",
// "role", không có "is_staff"). Vì TypeScript chỉ ép kiểu lên JSON.parse
// (không validate runtime), "is_staff" luôn là undefined ở mọi nơi dùng
// nó trước đây — khiến staff/admin bị đối xử như student sau khi login.
interface UserResponse {
  ss_user_id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  must_change_password: boolean;
}

// Lưu ý: helper isStaffRole() được đặt ở lib/auth/roles.ts (KHÔNG khai ở
// đây) — file này có "use server" ở đầu, Next.js chỉ cho phép export hàm
// async từ file "use server" (build sẽ lỗi nếu export thêm hàm sync).

/**
 * BUG FIX (audit 09/2026 #5): cookie "user_data" (httpOnly: false, đọc
 * được từ client-side JS — xem comment gốc "Allow client-side access")
 * trước đây CHỈ được ghi ở login(), không hề được cập nhật lại trong
 * nhánh auto-refresh của getCurrentUser() (bug #1/#3 thêm 09/2026) —
 * nếu full_name/email/role của user đổi trong lúc phiên đang chạy
 * (admin sửa role, user tự đổi full_name...), cookie này sẽ lệch với
 * dữ liệu thật cho tới lần login() kế tiếp. Hiện KHÔNG có nơi nào trong
 * FE đọc cookie này (chỉ set/delete) nên chưa gây bug hiển thị thật,
 * nhưng vì đã được thiết kế httpOnly:false có chủ đích (cho phép đọc
 * client-side sau này), giữ nó LUÔN đồng bộ đúng — không xoá bỏ tính
 * năng — thay vì để trở thành 1 nguồn dữ liệu cũ tiềm ẩn nếu sau này có
 * chỗ nào bắt đầu đọc nó. Helper dùng chung cho login() và nhánh
 * auto-refresh trong getCurrentUser(), tránh lặp lại object shape ở 2
 * chỗ (dễ lệch nhau nếu sửa 1 chỗ quên chỗ kia — cùng lý do
 * setAuthCookies() tồn tại).
 */
async function setUserDataCookie(userData: UserResponse) {
  const cookieStore = await cookies();

  cookieStore.set('user_data', JSON.stringify({
    ss_user_id: userData.ss_user_id,
    email: userData.email,
    full_name: userData.full_name,
    role: userData.role,
  }), {
    httpOnly: false, // Allow client-side access
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
}

export async function login(email: string, password: string) {
  try {
    // Step 1: Call FastAPI /auth/login endpoint
    const tokenResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': getApiKey(),
      },
      body: JSON.stringify({ email, password }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json().catch(() => ({ detail: 'Login failed' }));
      return {
        success: false,
        error: error.detail || 'Email hoặc mật khẩu không đúng',
      };
    }

    const tokenData: LoginResponse = await tokenResponse.json();

    // Step 2: Get user info
    const userResponse = await fetch(`${API_BASE}/auth/me`, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'X-API-Key': getApiKey(),
      },
    });

    if (!userResponse.ok) {
      return {
        success: false,
        error: 'Không thể lấy thông tin người dùng',
      };
    }

    const userData: UserResponse = await userResponse.json();

    // Step 3: Set HTTP-only cookies
    await setAuthCookies(tokenData.access_token, tokenData.refresh_token);

    // BUG FIX (audit 09/2026, dùng đúng field thật ss_user_id, bỏ
    // "is_staff" không tồn tại ở backend) + (audit 09/2026 #5, dùng
    // chung helper setUserDataCookie() với getCurrentUser() để không
    // lặp lại object shape ở 2 chỗ — xem giải thích đầy đủ ở khai báo
    // hàm setUserDataCookie()).
    await setUserDataCookie(userData);

    return {
      success: true,
      user: userData,
    };
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      error: 'Đã xảy ra lỗi khi đăng nhập. Vui lòng thử lại.',
    };
  }
}

export async function logout() {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('refresh_token')?.value;

    // Call FastAPI logout endpoint if refresh token exists
    // BUG FIX: path đúng là "/auth/logout" (auth_session.py, prefix
    // "/auth") — trước đây gọi "/logout" (404, lỗi bị .catch() nuốt im
    // lặng) khiến refresh_token KHÔNG BAO GIỜ bị thu hồi ở server khi
    // người dùng bấm "Đăng xuất".
    if (refreshToken) {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: {
          'X-API-Key': getApiKey(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }).catch(() => {
        // Ignore errors, still clear cookies
      });
    }

    // Clear all auth cookies
    cookieStore.delete('access_token');
    cookieStore.delete('refresh_token');
    cookieStore.delete('user_data');

    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return { success: false };
  }
}

/**
 * BUG FIX (audit 09/2026 #4): trước đây refreshAccessToken() trả null
 * cho CẢ 2 trường hợp hoàn toàn khác nhau — (a) backend ĐÃ trả lời rõ
 * ràng "refresh_token không hợp lệ/hết hạn/bị thu hồi" (response.ok
 * false, đây là thất bại THẬT, nên xoá cookie coi như hết phiên) và
 * (b) lỗi mạng/timeout/backend tạm thời không phản hồi được (catch),
 * tức là KHÔNG HỀ biết refresh_token còn hợp lệ hay không. Gộp chung
 * 2 case này khiến 1 lần mất mạng/backend down thoáng qua cũng xoá
 * sạch cookie — người dùng bị đăng xuất oan dù cả access_token lẫn
 * refresh_token đều còn hạn dùng thật, chỉ vì kết nối chập chờn.
 *
 * Đổi kết quả trả về thành discriminated union rõ ràng để nơi gọi
 * (getCurrentUser()) tự quyết định đúng hành vi cho từng trường hợp:
 * - { ok: true, tokens } — refresh thành công.
 * - { ok: false, reason: 'invalid' } — backend xác nhận rõ ràng
 *   refresh_token không dùng được nữa -> xoá cookie, đăng xuất thật sự.
 * - { ok: false, reason: 'network_error' } — không xác định được, có
 *   thể refresh_token vẫn còn hợp lệ -> KHÔNG xoá cookie, coi như phiên
 *   này tạm thời không lấy được, thử lại ở request kế tiếp.
 */
type RefreshResult =
  | { ok: true; tokens: RefreshResponse }
  | { ok: false; reason: 'invalid' | 'network_error' };

/**
 * Đổi refresh_token lấy 1 cặp token mới — POST /auth/refresh (30/minute
 * rate limit theo IP, xem auth_session.py::refresh()). KHÔNG throw —
 * luôn trả RefreshResult, gọi nơi dùng tự xử lý theo "reason".
 */
async function refreshAccessToken(refreshToken: string): Promise<RefreshResult> {
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
      // BUG FIX (audit 09/2026 #4): bản Flask gốc (backend_auth.py,
      // REQUEST_TIMEOUT = 20) luôn set timeout tường minh cho MỌI request
      // tới backend — comment gốc: "Render free tier có thể 'ngủ', lần
      // gọi đầu có thể chậm". fetch() mặc định KHÔNG timeout, có thể treo
      // vô thời hạn nếu backend đang cold-start hoặc mất kết nối nửa
      // chừng — dùng cùng convention 30s đã có ở getDashboardStats()
      // (actions/dashboard.ts) cho nhất quán.
      signal: AbortSignal.timeout(30000),
    });
  } catch (error) {
    // fetch() throw = lỗi mạng/timeout/DNS/kết nối bị từ chối — backend
    // CHƯA HỀ trả lời gì, không có cơ sở nào để coi refresh_token là
    // không hợp lệ.
    console.error('Refresh access token network error:', error);
    return { ok: false, reason: 'network_error' };
  }

  if (!response.ok) {
    // Backend ĐÃ trả lời rõ ràng (401 refresh_token invalid/expired/
    // revoked, 429 rate limit, 5xx lỗi server...) — với 401 đây là thất
    // bại thật của refresh_token. Với 429/5xx nghiêm ngặt thì cũng
    // không phải "refresh_token sai", nhưng backend rate-limit 30/minute
    // vốn đã đủ rộng cho use case thật (xem docstring auth_session.py::
    // refresh()), và 5xx tạm thời hiếm khi trùng đúng lúc access_token
    // hết hạn — chấp nhận coi mọi !ok non-network-error là 'invalid' để
    // giữ logic đơn giản, không phân loại quá chi tiết từng status code.
    return { ok: false, reason: 'invalid' };
  }

  try {
    const tokens: RefreshResponse = await response.json();
    return { ok: true, tokens };
  } catch (error) {
    // response.ok nhưng body không phải JSON hợp lệ — coi như lỗi mạng/
    // dữ liệu bất thường, KHÔNG phải refresh_token sai (backend đã nói
    // "ok" ở status code).
    console.error('Refresh access token: invalid JSON response', error);
    return { ok: false, reason: 'network_error' };
  }
}

/**
 * BUG FIX (audit 09/2026 #2, race condition): (dashboard)/layout.tsx và
 * dashboard/page.tsx CÙNG gọi getCurrentUser() song song trong 1 request
 * (qua Promise.all ở page.tsx) — mọi trang khác trong (dashboard)/ cũng
 * gọi lại 1 lần nữa qua layout cha. Vì backend rotate CẢ access_token
 * lẫn refresh_token mỗi lần gọi /auth/refresh (auth_session.py::refresh()),
 * nếu access_token vừa hết hạn đúng lúc có ≥2 lệnh gọi song song trong
 * CÙNG 1 request, cả 2 đều đọc cùng 1 refresh_token cũ từ cookie và cùng
 * gọi /auth/refresh — request đến sau gửi refresh_token ĐÃ BỊ THU HỒI
 * bởi request đến trước, rơi đúng vào nhánh "token bị đánh cắp" ở
 * backend (cùng cơ chế đã sửa ở bug #1), tự làm hỏng chính phiên vừa
 * refresh xong.
 *
 * React cache() dedupe các lệnh gọi hàm không tham số trong CÙNG 1
 * request/render pass (tự reset ở request tiếp theo, không rò rỉ chéo
 * user/request khác) — layout.tsx và page.tsx gọi getCurrentUser() bao
 * nhiêu lần trong 1 request cũng chỉ thực sự chạy network 1 lần, 2 nơi
 * gọi dùng chung đúng 1 promise/kết quả. Đây là cách Next.js khuyến
 * nghị để dedupe fetch trong 1 request (KHÔNG giải quyết race giữa 2
 * request HTTP tách biệt thật sự, ví dụ 2 tab khác nhau — trường hợp đó
 * đã được xử lý an toàn ở bug #1: request thua sẽ nhận session_replaced/
 * session_revoked và bị đăng xuất đúng thiết bị đó, không kéo theo thu
 * hồi toàn bộ token của user).
 */
export const getCurrentUser = cache(async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token')?.value;

    if (!accessToken) {
      return null;
    }

    let response = await fetch(`${API_BASE}/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-API-Key': getApiKey(),
      },
      cache: 'no-store',
      // BUG FIX (audit 09/2026 #4): xem giải thích đầy đủ ở
      // refreshAccessToken() — Flask gốc (backend_auth.py) luôn có
      // REQUEST_TIMEOUT tường minh cho mọi request tới backend.
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      // BUG FIX (audit 09/2026, Sprint gốc #3): access_token hết hạn sau
      // 30 phút (ACCESS_TOKEN_EXPIRE_MINUTES, api/security.py) — trước
      // đây cứ 401 là xoá cookie + đá về /login ngay, dù cookie
      // access_token còn sống tới 7 ngày và refresh_token còn tới 30
      // ngày. Bản Flask cũ (app.py::load_user) tự refresh êm bằng
      // refresh_token trước khi chịu thua — làm lại đúng pattern đó ở
      // đây: thử đổi refresh_token lấy access_token mới rồi gọi lại
      // /auth/me đúng 1 lần, chỉ đá về /login nếu refresh cũng fail
      // (refresh_token cũng hết hạn/bị thu hồi — vd sau khi logout ở
      // thiết bị khác).
      //
      // BUG FIX (audit 09/2026 #2): KHÔNG được refresh mù quáng với MỌI
      // lỗi 401 — backend (api/deps.py::get_current_user) phân biệt rõ
      // 3 loại lỗi qua "error_code" trong body: "token_expired" (đúng
      // trường hợp nên refresh), "session_replaced" (tài khoản vừa đăng
      // nhập ở nơi khác — single-session, xem
      // sql/migration_add_single_session.sql) và "session_revoked"/
      // "missing_auth_header". Với "session_replaced"/"session_revoked",
      // refresh_token đang cầm trên thiết bị NÀY chắc chắn đã bị backend
      // thu hồi từ lúc phiên mới được tạo (login()/refresh() luôn revoke
      // hết token cũ). Nếu vẫn cố gọi /auth/refresh bằng token đã revoke,
      // auth_session.py::refresh() sẽ hiểu nhầm đây là dấu hiệu token bị
      // ĐÁNH CẮP và thu hồi TOÀN BỘ token của user — kể cả phiên vừa
      // đăng nhập hợp lệ ở thiết bị/tab khác. Vì vậy chỉ thử refresh khi
      // error_code CHÍNH XÁC là "token_expired"; mọi error_code khác coi
      // như phiên đã chết thật, xoá cookie ngay, không refresh.
      const errorBody = await response.json().catch(() => null);
      const errorCode = errorBody?.detail?.error_code;
      const shouldTryRefresh = errorCode === 'token_expired';

      const refreshToken = shouldTryRefresh ? cookieStore.get('refresh_token')?.value : undefined;

      if (!refreshToken) {
        // Không đủ điều kiện thử refresh (error_code khác token_expired,
        // hoặc không có refresh_token cookie) — phiên coi như chết thật.
        cookieStore.delete('access_token');
        cookieStore.delete('refresh_token');
        cookieStore.delete('user_data');
        return null;
      }

      const refreshResult = await refreshAccessToken(refreshToken);

      if (!refreshResult.ok) {
        // BUG FIX (audit 09/2026 #4): CHỈ xoá cookie khi backend đã xác
        // nhận rõ ràng refresh_token không hợp lệ ("invalid"). Với lỗi
        // mạng/timeout ("network_error") — không có cơ sở nào để kết
        // luận refresh_token đã hỏng, chỉ là KHÔNG XÁC ĐỊNH ĐƯỢC ngay
        // lúc này — giữ nguyên cookie để lần render/request kế tiếp còn
        // cơ hội thử lại, tránh đăng xuất oan chỉ vì mất mạng thoáng qua.
        if (refreshResult.reason === 'invalid') {
          cookieStore.delete('access_token');
          cookieStore.delete('refresh_token');
          cookieStore.delete('user_data');
        }
        return null;
      }

      const newTokens = refreshResult.tokens;

      // refresh_token cũng bị xoay vòng (rotation) — PHẢI ghi đè cả 2
      // cookie, không chỉ access_token, nếu không lần hết hạn kế tiếp
      // sẽ gửi refresh_token đã bị thu hồi -> bị coi là token bị đánh
      // cắp -> backend tự thu hồi toàn bộ token, buộc đăng nhập lại.
      await setAuthCookies(newTokens.access_token, newTokens.refresh_token);

      response = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          Authorization: `Bearer ${newTokens.access_token}`,
          'X-API-Key': getApiKey(),
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        cookieStore.delete('access_token');
        cookieStore.delete('refresh_token');
        cookieStore.delete('user_data');
        return null;
      }
    }

    const userData: UserResponse = await response.json();

    // BUG FIX (audit 09/2026 #5): trước đây cookie "user_data" chỉ được
    // ghi ở login(), không hề cập nhật lại sau auto-refresh — nếu
    // full_name/email/role đổi trong lúc phiên đang chạy (admin sửa
    // role, user tự đổi full_name qua PATCH /auth/me...), cookie này
    // lệch với dữ liệu thật cho tới lần login() kế tiếp. Ghi lại mỗi
    // lần getCurrentUser() lấy được dữ liệu mới nhất, không chỉ lúc
    // login(), để cookie luôn phản ánh đúng — xem setUserDataCookie().
    await setUserDataCookie(userData);

    return userData;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
});

/**
 * Server Action to check if user is authenticated
 * Used by middleware and protected pages
 */
export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return !!cookieStore.get('access_token')?.value;
}

/**
 * BUG FIX (audit 09/2026 #3): backend trả "must_change_password" ở cả
 * TokenPairOut (POST /auth/login) lẫn UserOut (GET /auth/me) — cờ này
 * báo tài khoản đang dùng mật khẩu TẠM do admin cấp (POST /auth/users)
 * hoặc vừa bị admin reset, và PHẢI đổi trước khi dùng tiếp (xem
 * schemas/auth.py::UserOut, auth_session.py::change_password()). Trước
 * đây FE khai field này trong interface nhưng không đọc/redirect ở bất
 * kỳ đâu — người dùng mật khẩu tạm dùng app bình thường vô thời hạn,
 * không hề bị nhắc đổi mật khẩu. Hàm này gọi POST /auth/change-password
 * — cho /change-password (xem app/(auth)/change-password/page.tsx) và
 * (dashboard)/layout.tsx (chặn truy cập nếu must_change_password=true).
 *
 * Theo đúng hợp đồng backend (ChangePasswordRequest): old_password chỉ
 * BẮT BUỘC khi must_change_password hiện tại là false — khi đang
 * must_change_password=true (trường hợp chính hàm này phục vụ), người
 * dùng chỉ có mật khẩu tạm admin đưa, không có "mật khẩu cũ của riêng
 * họ" theo đúng nghĩa nên được phép bỏ qua old_password.
 *
 * Đổi mật khẩu thành công -> backend thu hồi TOÀN BỘ refresh token +
 * clear active_session_id (kể cả của chính request này, xem
 * change_password() trong auth_session.py) -> access_token hiện tại
 * hết hiệu lực ngay từ request kế tiếp. Vì vậy hàm này luôn xoá cookie
 * và để người gọi tự điều hướng về /login, KHÔNG cố giữ phiên cũ.
 */
export async function changePassword(newPassword: string, oldPassword?: string) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token')?.value;

    if (!accessToken) {
      return { success: false, error: 'Chưa đăng nhập.' };
    }

    const response = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-API-Key': getApiKey(),
      },
      body: JSON.stringify({
        old_password: oldPassword || undefined,
        new_password: newPassword,
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Đổi mật khẩu thất bại' }));
      const message = typeof error.detail === 'string' ? error.detail : error.detail?.message;
      return {
        success: false,
        error: message || 'Đổi mật khẩu thất bại',
      };
    }

    // Backend đã thu hồi hết token của phiên này — xoá cookie ngay,
    // buộc đăng nhập lại bằng mật khẩu mới (đúng hành vi bảo mật chuẩn
    // sau khi đổi mật khẩu, xem docstring change_password()).
    cookieStore.delete('access_token');
    cookieStore.delete('refresh_token');
    cookieStore.delete('user_data');

    return { success: true };
  } catch (error) {
    console.error('Change password error:', error);
    return { success: false, error: 'Đã xảy ra lỗi. Vui lòng thử lại.' };
  }
}

// ------------------------------------------------------------------
// Quản lý tài khoản người khác (api/routers/auth_users.py) — thêm
// 09/2026 để mở khoá actions/students.ts + actions/staff.ts, vốn chỉ
// throw new Error('Not implemented'). Đối chiếu Flask gốc
// (mindx-jobs/blueprints/students.py, staff.py): CẢ HAI không có
// entity/router backend riêng, chỉ cùng gọi GET /auth/users rồi lọc
// role ở tầng FE (students: role==='user', staff: role!=='user') —
// nên các hàm dùng chung này đặt ở auth.ts (đúng domain thật của
// endpoint /auth/users), KHÔNG đặt ở students.ts/staff.ts.
// ------------------------------------------------------------------

function formatUserErrorDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) =>
        item && typeof item === 'object' && 'msg' in item
          ? String((item as { msg: unknown }).msg)
          : String(item)
      )
      .join('; ');
  }
  return 'Có lỗi xảy ra';
}

/**
 * GET /auth/users — yêu cầu role ss_team trở lên (backend tự chặn 403
 * nếu gọi bằng token role='user', route này KHÔNG kiểm tra role phía
 * FE — dựa hoàn toàn vào backend, giống mọi action khác trong app).
 * Trả TOÀN BỘ user mọi role trong 1 lần gọi — không có filter server-
 * side (list_users() không nhận query param nào) nên students.ts/
 * staff.ts tự lọc lại theo role ở tầng gọi hàm này.
 */
export async function listUsers(): Promise<User[]> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token')?.value;
    if (!accessToken) return [];

    const response = await fetch(`${API_BASE}/auth/users`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-API-Key': getApiKey(),
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      console.error('Failed to list users:', response.status, response.statusText);
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error('Error listing users:', error);
    return [];
  }
}

/**
 * POST /auth/users — admin-only (backend trả 403 nếu gọi bằng role
 * khác). temp_password chỉ xuất hiện ĐÚNG 1 LẦN trong response này —
 * nơi gọi phải tự hiển thị cho admin copy lại ngay, không có cách nào
 * lấy lại sau (xem docstring UserCreatedOut).
 */
export async function createUser(
  data: UserCreatePayload
): Promise<{ success: boolean; user?: UserCreated; error?: string }> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token')?.value;
    if (!accessToken) return { success: false, error: 'Chưa đăng nhập.' };

    const response = await fetch(`${API_BASE}/auth/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-API-Key': getApiKey(),
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      return { success: false, error: formatUserErrorDetail(error.detail) || 'Không thể tạo tài khoản' };
    }
    const user = await response.json();
    return { success: true, user };
  } catch (error) {
    console.error('Error creating user:', error);
    return { success: false, error: 'Network error' };
  }
}

/** PATCH /auth/users/{id}/role — admin-only. Backend tự chặn admin tự đổi role chính mình (400). */
export async function updateUserRole(
  ssUserId: string,
  role: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token')?.value;
    if (!accessToken) return { success: false, error: 'Chưa đăng nhập.' };

    const response = await fetch(`${API_BASE}/auth/users/${ssUserId}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-API-Key': getApiKey(),
      },
      body: JSON.stringify({ role }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      return { success: false, error: formatUserErrorDetail(error.detail) || 'Không thể đổi vai trò' };
    }
    const user = await response.json();
    return { success: true, user };
  } catch (error) {
    console.error('Error updating user role:', error);
    return { success: false, error: 'Network error' };
  }
}

/** PATCH /auth/users/{id}/active-status — admin-only. Backend tự chặn admin tự khoá chính mình (400). */
export async function updateUserActiveStatus(
  ssUserId: string,
  isActive: boolean
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token')?.value;
    if (!accessToken) return { success: false, error: 'Chưa đăng nhập.' };

    const response = await fetch(`${API_BASE}/auth/users/${ssUserId}/active-status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-API-Key': getApiKey(),
      },
      body: JSON.stringify({ is_active: isActive }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      return { success: false, error: formatUserErrorDetail(error.detail) || 'Không thể đổi trạng thái tài khoản' };
    }
    const user = await response.json();
    return { success: true, user };
  } catch (error) {
    console.error('Error updating user active status:', error);
    return { success: false, error: 'Network error' };
  }
}

/** GET /auth/users/{id}/applications — ss_team trở lên. */
export async function getUserApplications(ssUserId: string): Promise<JobApplication[]> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token')?.value;
    if (!accessToken) return [];

    const response = await fetch(`${API_BASE}/auth/users/${ssUserId}/applications`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'X-API-Key': getApiKey() },
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error('Error fetching user applications:', error);
    return [];
  }
}

/** GET /auth/users/{id}/saved-jobs — ss_team trở lên. */
export async function getUserSavedJobs(ssUserId: string): Promise<SavedJob[]> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token')?.value;
    if (!accessToken) return [];

    const response = await fetch(`${API_BASE}/auth/users/${ssUserId}/saved-jobs`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'X-API-Key': getApiKey() },
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error('Error fetching user saved jobs:', error);
    return [];
  }
}

// ------------------------------------------------------------------
// Đăng ký công khai / quên mật khẩu (api/routers/auth_registration.py,
// public_router — KHÔNG cần JWT). Thêm 09/2026 để mở khoá 4 trang
// /register, /forgot-password, /reset-password, /verify-email — trước
// đây /login có sẵn <a href="/register">, <a href="/forgot-password">
// trỏ tới trang KHÔNG TỒN TẠI (404 thật) dù backend đã có đủ 3 route
// POST /auth/register, POST /auth/forgot-password, POST
// /auth/reset-password từ trước — chỉ thiếu phía FE.
// ------------------------------------------------------------------

/**
 * POST /auth/register — luôn tạo role='user', KHÔNG trả token (phải
 * xác thực email qua link gửi tới hộp thư trước khi login được, xem
 * docstring register() ở backend). 409 nếu email đã có tài khoản.
 */
export async function register(data: {
  full_name: string;
  email: string;
  password: string;
  phone?: string;
  track?: string;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': getApiKey() },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      return { success: false, error: formatUserErrorDetail(error.detail) || 'Đăng ký thất bại' };
    }
    const body = await response.json();
    return { success: true, message: body.message };
  } catch (error) {
    console.error('Register error:', error);
    return { success: false, error: 'Đã xảy ra lỗi. Vui lòng thử lại.' };
  }
}

/**
 * POST /auth/forgot-password — LUÔN trả message thành công dù email có
 * tồn tại hay không (chống dò email hàng loạt — xem docstring backend).
 * Vì vậy nơi gọi KHÔNG nên coi success:false là "email không tồn tại",
 * chỉ dùng cho lỗi mạng/rate-limit thật sự.
 */
export async function forgotPassword(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': getApiKey() },
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      return { success: false, error: formatUserErrorDetail(error.detail) || 'Không thể gửi email đặt lại mật khẩu' };
    }
    const body = await response.json();
    return { success: true, message: body.message };
  } catch (error) {
    console.error('Forgot password error:', error);
    return { success: false, error: 'Đã xảy ra lỗi. Vui lòng thử lại.' };
  }
}

/**
 * POST /auth/reset-password — token THÔ lấy từ query string link email
 * (?token=...). Token dùng đúng 1 lần, hết hạn sau 1h (xem
 * PASSWORD_RESET_EXPIRE_HOURS ở backend).
 */
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': getApiKey() },
      body: JSON.stringify({ token, new_password: newPassword }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      return { success: false, error: formatUserErrorDetail(error.detail) || 'Đặt lại mật khẩu thất bại' };
    }
    const body = await response.json();
    return { success: true, message: body.message };
  } catch (error) {
    console.error('Reset password error:', error);
    return { success: false, error: 'Đã xảy ra lỗi. Vui lòng thử lại.' };
  }
}
