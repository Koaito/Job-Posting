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
    
    cookieStore.set('access_token', tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    cookieStore.set('refresh_token', tokenData.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

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

export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token')?.value;

    if (!accessToken) {
      return null;
    }

    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-API-Key': API_KEY!,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      // Token expired or invalid, clear cookies
      cookieStore.delete('access_token');
      cookieStore.delete('refresh_token');
      cookieStore.delete('user_data');
      return null;
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
