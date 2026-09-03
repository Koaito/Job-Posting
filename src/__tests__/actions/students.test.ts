/**
 * Tests for Students Server Actions
 * Matches Flask: blueprints/students.py pattern (KHÔNG có entity/router
 * "student" riêng ở backend — chỉ lọc role='user' từ GET /auth/users).
 */

import { getStudents, getStudentById } from '@/app/actions/students';
import {
  mockUser,
  mockStaffUser,
  mockAdminUser,
  mockStudentUser,
  mockJobApplication,
  mockSavedJob,
  mockFetchSuccess,
} from '../fixtures';

global.fetch = jest.fn();

const mockCookieGet = jest.fn();
jest.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ get: mockCookieGet }),
}));

const allUsers = [mockUser, mockStaffUser, mockAdminUser, mockStudentUser];

describe('Students Server Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCookieGet.mockImplementation((name: string) =>
      name === 'access_token' ? { value: 'mock-access-token' } : undefined
    );
  });

  describe('getStudents()', () => {
    it('should chỉ trả user có role === "user" (loại staff/admin)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(allUsers));
      const result = await getStudents();
      expect(result).toHaveLength(1);
      expect(result[0].ss_user_id).toBe(mockStudentUser.ss_user_id);
    });

    it('should lọc theo keyword (tên hoặc email)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(allUsers));
      const result = await getStudents({ keyword: 'student@example.com' });
      expect(result).toHaveLength(1);

      const noMatch = await getStudents({ keyword: 'không-tồn-tại' });
      expect(noMatch).toHaveLength(0);
    });
  });

  describe('getStudentById()', () => {
    it('should gọi song song listUsers + applications + saved-jobs, gộp kết quả', async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/applications')) return mockFetchSuccess([mockJobApplication]);
        if (url.includes('/saved-jobs')) return mockFetchSuccess([mockSavedJob]);
        return mockFetchSuccess(allUsers);
      });

      const result = await getStudentById(mockStudentUser.ss_user_id);

      expect(result?.student.ss_user_id).toBe(mockStudentUser.ss_user_id);
      expect(result?.applications).toHaveLength(1);
      expect(result?.applications[0].job_title).toBe('Backend Developer');
      expect(result?.savedJobs).toHaveLength(1);
      expect(result?.savedJobs[0].saved_job_id).toBe('saved-1');

      // Đúng 3 lời gọi: listUsers, applications, saved-jobs
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should trả null nếu id thuộc về staff/admin (không phải role="user")', async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/applications')) return mockFetchSuccess([]);
        if (url.includes('/saved-jobs')) return mockFetchSuccess([]);
        return mockFetchSuccess(allUsers);
      });

      const result = await getStudentById(mockAdminUser.ss_user_id);
      expect(result).toBeNull();
    });

    it('should trả null nếu id không tồn tại trong listUsers', async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/applications')) return mockFetchSuccess([]);
        if (url.includes('/saved-jobs')) return mockFetchSuccess([]);
        return mockFetchSuccess(allUsers);
      });

      const result = await getStudentById('không-tồn-tại');
      expect(result).toBeNull();
    });

    it('should vẫn trả student kèm mảng rỗng nếu applications/saved-jobs lỗi (không throw cả hàm)', async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/applications')) return Promise.reject(new Error('Network error'));
        if (url.includes('/saved-jobs')) return Promise.reject(new Error('Network error'));
        return mockFetchSuccess(allUsers);
      });

      const result = await getStudentById(mockStudentUser.ss_user_id);
      expect(result?.student.ss_user_id).toBe(mockStudentUser.ss_user_id);
      expect(result?.applications).toEqual([]);
      expect(result?.savedJobs).toEqual([]);
    });
  });
});
