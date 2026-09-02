/**
 * Tests for Auth Server Actions
 *
 * Trước đây KHÔNG có file test nào cho actions/auth.ts (commit
 * c94828b tự ghi rõ "logic cũ getCurrentUser() chưa có test riêng") —
 * đây là nguyên nhân chính khiến bug #1 (session_replaced bị hiểu nhầm
 * là token hết hạn, tự refresh bằng token đã bị revoke -> backend coi
 * là bị đánh cắp -> thu hồi toàn bộ token) và bug #3 (must_change_password
 * bị bỏ qua hoàn toàn) không bị phát hiện qua CI dù `next build`/`tsc`/
 * jest cũ đều xanh.
 *
 * Test dưới đây mock trực tiếp response thật của backend (kể cả
 * error_code trong body 401, đúng theo api/deps.py::get_current_user
 * và api/routers/auth_session.py) thay vì chỉ mock ok/not-ok chung
 * chung, để không lặp lại kiểu test "xanh nhưng không phản ánh đúng
 * hợp đồng API thật" như bộ test jobs cũ đã từng mắc.
 */

import { login, logout, getCurrentUser, changePassword } from '@/app/actions/auth';
import { mockUser, mockStudentUser, mockFetchNetworkError } from '../fixtures';

global.fetch = jest.fn();

const mockCookieGet = jest.fn();
const mockCookieSet = jest.fn();
const mockCookieDelete = jest.fn();

jest.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: mockCookieGet,
      set: mockCookieSet,
      delete: mockCookieDelete,
    }),
}));

/** Response 401 với error_code trong detail, đúng format thật của
 * api/deps.py::get_current_user (HTTPException(detail={"error_code":
 * ..., "message": ...})). */
function mock401(errorCode: 'token_expired' | 'session_replaced' | 'session_revoked' | 'missing_auth_header') {
  return Promise.resolve({
    ok: false,
    status: 401,
    statusText: 'Unauthorized',
    json: async () => ({
      detail: {
        error_code: errorCode,
        message: `mock ${errorCode}`,
      },
    }),
  } as Response);
}

function mockJsonSuccess(data: unknown, status = 200) {
  return Promise.resolve({
    ok: true,
    status,
    json: async () => data,
  } as Response);
}

describe('Auth Server Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login()', () => {
    it('should set access_token + refresh_token cookies and return user on success', async () => {
      (global.fetch as jest.Mock)
        .mockImplementationOnce(() =>
          mockJsonSuccess({
            access_token: 'access-1',
            refresh_token: 'refresh-1',
            token_type: 'bearer',
            must_change_password: false,
          })
        )
        .mockImplementationOnce(() => mockJsonSuccess(mockUser));

      const result = await login('staff@example.com', 'password123');

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);

      const cookieCalls = mockCookieSet.mock.calls.map((c) => c[0]);
      expect(cookieCalls).toEqual(expect.arrayContaining(['access_token', 'refresh_token', 'user_data']));

      const accessCall = mockCookieSet.mock.calls.find((c) => c[0] === 'access_token');
      expect(accessCall[1]).toBe('access-1');
      const refreshCall = mockCookieSet.mock.calls.find((c) => c[0] === 'refresh_token');
      expect(refreshCall[1]).toBe('refresh-1');
    });

    it('should return error on wrong credentials (401)', async () => {
      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          json: async () => ({ detail: 'Email hoặc mật khẩu không đúng.' }),
        } as Response)
      );

      const result = await login('staff@example.com', 'wrong');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockCookieSet).not.toHaveBeenCalled();
    });

    it('should return error on network failure', async () => {
      (global.fetch as jest.Mock).mockImplementationOnce(() => mockFetchNetworkError());

      const result = await login('staff@example.com', 'password123');

      expect(result.success).toBe(false);
    });
  });

  describe('logout()', () => {
    it('should call /auth/logout with refresh_token and clear cookies', async () => {
      mockCookieGet.mockImplementation((name: string) =>
        name === 'refresh_token' ? { value: 'refresh-1' } : undefined
      );
      (global.fetch as jest.Mock).mockImplementationOnce(() => mockJsonSuccess(null, 204));

      const result = await logout();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/logout'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(mockCookieDelete).toHaveBeenCalledWith('access_token');
      expect(mockCookieDelete).toHaveBeenCalledWith('refresh_token');
      expect(mockCookieDelete).toHaveBeenCalledWith('user_data');
      expect(result.success).toBe(true);
    });

    it('should still clear cookies even if backend call fails', async () => {
      mockCookieGet.mockImplementation((name: string) =>
        name === 'refresh_token' ? { value: 'refresh-1' } : undefined
      );
      (global.fetch as jest.Mock).mockImplementationOnce(() => mockFetchNetworkError());

      const result = await logout();

      expect(mockCookieDelete).toHaveBeenCalledWith('access_token');
      expect(result.success).toBe(true);
    });
  });

  describe('getCurrentUser() — happy path', () => {
    it('should return user data when access_token is valid', async () => {
      mockCookieGet.mockImplementation((name: string) =>
        name === 'access_token' ? { value: 'valid-access-token' } : undefined
      );
      (global.fetch as jest.Mock).mockImplementationOnce(() => mockJsonSuccess(mockUser));

      const result = await getCurrentUser();

      expect(result).toEqual(mockUser);
      // Không được đụng tới /auth/refresh khi request đầu tiên đã ok.
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should return null when there is no access_token cookie', async () => {
      mockCookieGet.mockImplementation(() => undefined);

      const result = await getCurrentUser();

      expect(result).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentUser() — auto-refresh (bug #1 fix)', () => {
    it('should refresh once and retry /auth/me when error_code is "token_expired"', async () => {
      mockCookieGet.mockImplementation((name: string) => {
        if (name === 'access_token') return { value: 'expired-access-token' };
        if (name === 'refresh_token') return { value: 'valid-refresh-token' };
        return undefined;
      });

      (global.fetch as jest.Mock)
        .mockImplementationOnce(() => mock401('token_expired')) // GET /auth/me #1
        .mockImplementationOnce(() =>
          mockJsonSuccess({
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            token_type: 'bearer',
          })
        ) // POST /auth/refresh
        .mockImplementationOnce(() => mockJsonSuccess(mockUser)); // GET /auth/me #2

      const result = await getCurrentUser();

      expect(result).toEqual(mockUser);
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(global.fetch).toHaveBeenNthCalledWith(2, expect.stringContaining('/auth/refresh'), expect.any(Object));

      // PHẢI ghi đè CẢ 2 cookie (access + refresh) — refresh_token cũng
      // bị rotate ở backend, quên ghi đè refresh_token sẽ làm lần hết
      // hạn kế tiếp gửi token đã bị thu hồi.
      const accessCall = mockCookieSet.mock.calls.find((c) => c[0] === 'access_token');
      expect(accessCall[1]).toBe('new-access-token');
      const refreshCall = mockCookieSet.mock.calls.find((c) => c[0] === 'refresh_token');
      expect(refreshCall[1]).toBe('new-refresh-token');
    });

    it('should clear cookies WITHOUT calling /auth/refresh when error_code is "session_replaced"', async () => {
      // Đây là test bao phủ trực tiếp bug #1: user đăng nhập ở thiết bị
      // khác -> single-session (auth_session.py::login()) revoke hết
      // refresh_token cũ -> access token thiết bị này bị từ chối với
      // error_code "session_replaced" (api/deps.py). Nếu code vẫn cố
      // gọi /auth/refresh bằng refresh_token đã bị revoke, backend sẽ
      // hiểu nhầm là token bị đánh cắp và thu hồi TOÀN BỘ token của
      // user — kể cả phiên vừa đăng nhập hợp lệ ở thiết bị khác.
      mockCookieGet.mockImplementation((name: string) => {
        if (name === 'access_token') return { value: 'replaced-access-token' };
        if (name === 'refresh_token') return { value: 'revoked-refresh-token' };
        return undefined;
      });

      (global.fetch as jest.Mock).mockImplementationOnce(() => mock401('session_replaced'));

      const result = await getCurrentUser();

      expect(result).toBeNull();
      // Chỉ đúng 1 lần gọi /auth/me — KHÔNG được gọi /auth/refresh.
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('/auth/refresh'),
        expect.any(Object)
      );
      expect(mockCookieDelete).toHaveBeenCalledWith('access_token');
      expect(mockCookieDelete).toHaveBeenCalledWith('refresh_token');
      expect(mockCookieDelete).toHaveBeenCalledWith('user_data');
    });

    it('should clear cookies WITHOUT calling /auth/refresh when error_code is "session_revoked"', async () => {
      mockCookieGet.mockImplementation((name: string) => {
        if (name === 'access_token') return { value: 'revoked-access-token' };
        if (name === 'refresh_token') return { value: 'some-refresh-token' };
        return undefined;
      });

      (global.fetch as jest.Mock).mockImplementationOnce(() => mock401('session_revoked'));

      const result = await getCurrentUser();

      expect(result).toBeNull();
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(mockCookieDelete).toHaveBeenCalledWith('access_token');
    });

    it('should clear cookies when refresh_token is missing even if error_code is token_expired', async () => {
      mockCookieGet.mockImplementation((name: string) =>
        name === 'access_token' ? { value: 'expired-access-token' } : undefined
      );

      (global.fetch as jest.Mock).mockImplementationOnce(() => mock401('token_expired'));

      const result = await getCurrentUser();

      expect(result).toBeNull();
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(mockCookieDelete).toHaveBeenCalledWith('access_token');
    });

    it('should clear cookies when /auth/refresh itself returns 401 (refresh_token also expired)', async () => {
      mockCookieGet.mockImplementation((name: string) => {
        if (name === 'access_token') return { value: 'expired-access-token' };
        if (name === 'refresh_token') return { value: 'expired-refresh-token' };
        return undefined;
      });

      (global.fetch as jest.Mock)
        .mockImplementationOnce(() => mock401('token_expired')) // GET /auth/me
        .mockImplementationOnce(() =>
          Promise.resolve({ ok: false, status: 401, json: async () => ({ detail: 'Refresh token đã hết hạn.' }) } as Response)
        ); // POST /auth/refresh fails

      const result = await getCurrentUser();

      expect(result).toBeNull();
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(mockCookieDelete).toHaveBeenCalledWith('access_token');
      expect(mockCookieDelete).toHaveBeenCalledWith('refresh_token');
    });

    it('should clear cookies if /auth/me still fails after a successful refresh', async () => {
      mockCookieGet.mockImplementation((name: string) => {
        if (name === 'access_token') return { value: 'expired-access-token' };
        if (name === 'refresh_token') return { value: 'valid-refresh-token' };
        return undefined;
      });

      (global.fetch as jest.Mock)
        .mockImplementationOnce(() => mock401('token_expired')) // GET /auth/me #1
        .mockImplementationOnce(() =>
          mockJsonSuccess({ access_token: 'new-access', refresh_token: 'new-refresh', token_type: 'bearer' })
        ) // POST /auth/refresh ok
        .mockImplementationOnce(() => mock401('session_revoked')); // GET /auth/me #2 vẫn fail

      const result = await getCurrentUser();

      expect(result).toBeNull();
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(mockCookieDelete).toHaveBeenCalledWith('access_token');
    });

    it('should return null and not throw on network error', async () => {
      mockCookieGet.mockImplementation((name: string) =>
        name === 'access_token' ? { value: 'some-token' } : undefined
      );
      (global.fetch as jest.Mock).mockImplementationOnce(() => mockFetchNetworkError());

      const result = await getCurrentUser();

      expect(result).toBeNull();
    });
  });

  describe('getCurrentUser() — must_change_password propagation (bug #3)', () => {
    it('should pass through must_change_password=true from /auth/me untouched', async () => {
      mockCookieGet.mockImplementation((name: string) =>
        name === 'access_token' ? { value: 'valid-access-token' } : undefined
      );
      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        mockJsonSuccess({ ...mockStudentUser, is_active: true, must_change_password: true })
      );

      const result = await getCurrentUser();

      // getCurrentUser() không tự xử lý redirect (việc đó thuộc về
      // (dashboard)/layout.tsx) nhưng PHẢI trả nguyên field này ra —
      // trước đây field có khai trong interface nhưng không nơi nào
      // dùng, nên việc trả đúng giá trị là điều kiện cần để layout xử lý.
      expect(result?.must_change_password).toBe(true);
    });
  });

  describe('changePassword() (bug #3)', () => {
    it('should call POST /auth/change-password with Authorization header and clear cookies on success', async () => {
      mockCookieGet.mockImplementation((name: string) =>
        name === 'access_token' ? { value: 'valid-access-token' } : undefined
      );
      (global.fetch as jest.Mock).mockImplementationOnce(() => mockJsonSuccess(mockStudentUser));

      const result = await changePassword('newStrongPass123');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/change-password'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer valid-access-token',
          }),
        })
      );
      expect(result.success).toBe(true);
      // Backend thu hồi hết token của phiên khi đổi mật khẩu thành công
      // (auth_session.py::change_password()) — FE phải xoá cookie theo,
      // không được giữ lại access_token cũ tưởng vẫn còn dùng được.
      expect(mockCookieDelete).toHaveBeenCalledWith('access_token');
      expect(mockCookieDelete).toHaveBeenCalledWith('refresh_token');
    });

    it('should omit old_password when not provided (must_change_password=true case)', async () => {
      mockCookieGet.mockImplementation((name: string) =>
        name === 'access_token' ? { value: 'valid-access-token' } : undefined
      );
      (global.fetch as jest.Mock).mockImplementationOnce(() => mockJsonSuccess(mockStudentUser));

      await changePassword('newStrongPass123');

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.old_password).toBeUndefined();
      expect(body.new_password).toBe('newStrongPass123');
    });

    it('should return error without calling API when no access_token cookie exists', async () => {
      mockCookieGet.mockImplementation(() => undefined);

      const result = await changePassword('newStrongPass123');

      expect(result.success).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return backend error message on 401 (wrong old_password)', async () => {
      mockCookieGet.mockImplementation((name: string) =>
        name === 'access_token' ? { value: 'valid-access-token' } : undefined
      );
      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          json: async () => ({ detail: 'Mật khẩu cũ không đúng.' }),
        } as Response)
      );

      const result = await changePassword('newStrongPass123', 'wrong-old-password');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Mật khẩu cũ không đúng.');
      expect(mockCookieDelete).not.toHaveBeenCalled();
    });

    it('should return error on network failure', async () => {
      mockCookieGet.mockImplementation((name: string) =>
        name === 'access_token' ? { value: 'valid-access-token' } : undefined
      );
      (global.fetch as jest.Mock).mockImplementationOnce(() => mockFetchNetworkError());

      const result = await changePassword('newStrongPass123');

      expect(result.success).toBe(false);
    });
  });
});
