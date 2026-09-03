/**
 * Tests for Staff Server Actions
 * Matches Flask: blueprints/staff.py pattern
 *
 * staff.ts KHÔNG tự gọi fetch — chỉ lọc lại listUsers() và uỷ quyền
 * cho createUser/updateUserRole/updateUserActiveStatus (actions/auth.ts),
 * nên test mock trực tiếp global.fetch giống các test khác, đảm bảo
 * đúng URL/method/body được auth.ts dựng ra.
 */

import { getStaff, getStaffById, createStaff, updateStaffRole, updateStaffActiveStatus } from '@/app/actions/staff';
import { mockUser, mockStaffUser, mockAdminUser, mockStudentUser, mockUserCreated, mockFetchSuccess, mockFetchError } from '../fixtures';

global.fetch = jest.fn();

const mockCookieGet = jest.fn();
jest.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ get: mockCookieGet }),
}));

const allUsers = [mockUser, mockStaffUser, mockAdminUser, mockStudentUser];

describe('Staff Server Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCookieGet.mockImplementation((name: string) =>
      name === 'access_token' ? { value: 'mock-access-token' } : undefined
    );
  });

  describe('getStaff()', () => {
    it('should chỉ trả user có role !== "user" (loại học viên)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(allUsers));
      const result = await getStaff();
      expect(result).toHaveLength(3);
      expect(result.every((u) => u.role !== 'user')).toBe(true);
      expect(result.find((u) => u.ss_user_id === mockStudentUser.ss_user_id)).toBeUndefined();
    });

    it('should lọc theo keyword (tên hoặc email, không phân biệt hoa thường)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(allUsers));
      const result = await getStaff({ keyword: 'ADMIN' });
      expect(result).toHaveLength(1);
      expect(result[0].ss_user_id).toBe(mockAdminUser.ss_user_id);
    });

    it('should trả toàn bộ staff khi keyword chỉ có khoảng trắng', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(allUsers));
      const result = await getStaff({ keyword: '   ' });
      expect(result).toHaveLength(3);
    });

    it('should trả [] khi listUsers() lỗi (không có access_token)', async () => {
      mockCookieGet.mockImplementation(() => undefined);
      const result = await getStaff();
      expect(result).toEqual([]);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('getStaffById()', () => {
    it('should tìm đúng 1 staff theo id', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(allUsers));
      const result = await getStaffById(mockStaffUser.ss_user_id);
      expect(result?.email).toBe(mockStaffUser.email);
    });

    it('should trả null nếu id thuộc về học viên (role="user")', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(allUsers));
      const result = await getStaffById(mockStudentUser.ss_user_id);
      expect(result).toBeNull();
    });

    it('should trả null nếu không tìm thấy id', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(allUsers));
      const result = await getStaffById('không-tồn-tại');
      expect(result).toBeNull();
    });
  });

  describe('createStaff()', () => {
    it('should POST /auth/users (uỷ quyền createUser, admin-only ở backend)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockUserCreated));
      const result = await createStaff({ full_name: 'New Staff', email: 'new@example.com', role: 'ss_team' });

      const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toContain('/auth/users');
      expect(options.method).toBe('POST');
      expect(result.success).toBe(true);
      expect(result.user?.temp_password).toBe('Temp1234!');
    });

    it('should trả lỗi 403 cụ thể khi người gọi không phải admin', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchError(403, 'Chỉ admin mới tạo được tài khoản nhân viên')
      );
      const result = await createStaff({ full_name: 'New Staff', email: 'new@example.com', role: 'ss_team' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Chỉ admin mới tạo được tài khoản nhân viên');
    });

    it('should dùng fallback đúng khi backend không trả detail (regression test cho bug formatUserErrorDetail)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({ ok: false, status: 500, statusText: 'Internal Server Error', json: async () => ({}) } as Response)
      );
      const result = await createStaff({ full_name: 'New Staff', email: 'new@example.com', role: 'ss_team' });
      expect(result.error).toBe('Không thể tạo tài khoản');
    });
  });

  describe('updateStaffRole()', () => {
    it('should PATCH /auth/users/{id}/role kèm body {role}', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess({ ...mockStaffUser, role: 'admin' }));
      const result = await updateStaffRole(mockStaffUser.ss_user_id, 'admin');

      const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toContain(`/auth/users/${mockStaffUser.ss_user_id}/role`);
      expect(options.method).toBe('PATCH');
      expect(JSON.parse(options.body)).toEqual({ role: 'admin' });
      expect(result.success).toBe(true);
      expect(result.user?.role).toBe('admin');
    });

    it('should trả lỗi khi cố tự đổi role của chính mình (backend chặn)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchError(400, 'Không thể tự đổi vai trò của chính mình')
      );
      const result = await updateStaffRole(mockStaffUser.ss_user_id, 'user');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Không thể tự đổi vai trò của chính mình');
    });
  });

  describe('updateStaffActiveStatus()', () => {
    it('should PATCH /auth/users/{id}/active-status kèm body {is_active}', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess({ ...mockStaffUser, is_active: false }));
      const result = await updateStaffActiveStatus(mockStaffUser.ss_user_id, false);

      const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toContain(`/auth/users/${mockStaffUser.ss_user_id}/active-status`);
      expect(JSON.parse(options.body)).toEqual({ is_active: false });
      expect(result.success).toBe(true);
    });

    it('should trả Chưa đăng nhập khi thiếu access_token, KHÔNG gọi fetch', async () => {
      mockCookieGet.mockImplementation(() => undefined);
      const result = await updateStaffActiveStatus(mockStaffUser.ss_user_id, false);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Chưa đăng nhập.');
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
