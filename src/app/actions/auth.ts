'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * Server Actions for Authentication
 * Corresponds to Flask blueprint: blueprints/auth.py
 */

const API_BASE = process.env.FASTAPI_URL;
const API_KEY = process.env.CRAWLER_API_KEY;

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

export async function login(email: string, password: string) {
  try {
    // Step 1: Call FastAPI /auth/login endpoint
    const tokenResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY!,
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
        'X-API-Key': API_KEY!,
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
    const cookieStore = await cookies();
    await setAuthCookies(tokenData.access_token, tokenData.refresh_token);

    // Store user data for client-side access (non-sensitive info only)
    // BUG FIX: dùng đúng field thật (ss_user_id), bỏ "is_staff" (không
    // tồn tại ở backend) — nơi cần biết staff/admin hay không phải tự
    // tính từ "role" bằng isStaffRole() (lib/auth/roles.ts).
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
          'X-API-Key': API_KEY!,
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
 * Đổi refresh_token lấy 1 cặp token mới — POST /auth/refresh (30/minute
 * rate limit theo IP, xem auth_session.py::refresh()). Trả null nếu
 * refresh_token không hợp lệ/đã hết hạn/đã bị thu hồi — gọi nơi dùng tự
 * xử lý (xoá cookie, coi như chưa đăng nhập), KHÔNG throw.
 */
async function refreshAccessToken(refreshToken: string): Promise<RefreshResponse | null> {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY!,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Refresh access token error:', error);
    return null;
  }
}

export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token')?.value;

    if (!accessToken) {
      return null;
    }

    let response = await fetch(`${API_BASE}/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-API-Key': API_KEY!,
      },
      cache: 'no-store',
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
      const newTokens = refreshToken ? await refreshAccessToken(refreshToken) : null;

      if (!newTokens) {
        cookieStore.delete('access_token');
        cookieStore.delete('refresh_token');
        cookieStore.delete('user_data');
        return null;
      }

      // refresh_token cũng bị xoay vòng (rotation) — PHẢI ghi đè cả 2
      // cookie, không chỉ access_token, nếu không lần hết hạn kế tiếp
      // sẽ gửi refresh_token đã bị thu hồi -> bị coi là token bị đánh
      // cắp -> backend tự thu hồi toàn bộ token, buộc đăng nhập lại.
      await setAuthCookies(newTokens.access_token, newTokens.refresh_token);

      response = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          Authorization: `Bearer ${newTokens.access_token}`,
          'X-API-Key': API_KEY!,
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        cookieStore.delete('access_token');
        cookieStore.delete('refresh_token');
        cookieStore.delete('user_data');
        return null;
      }
    }

    const userData: UserResponse = await response.json();
    return userData;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}

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
        'X-API-Key': API_KEY!,
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
