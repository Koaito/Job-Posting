/**
 * Tests for Dashboard Server Actions
 * Matches Flask: blueprints/dashboard.py pattern
 */

import { getDashboardStats, getRecentActivity } from '@/app/actions/dashboard';
import { mockDashboardStatsResponse, mockAuditLog, mockAuditLogsResponse, mockFetchSuccess, mockFetchError, mockFetchNetworkError } from '../fixtures';

global.fetch = jest.fn();

const mockCookieGet = jest.fn();
jest.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ get: mockCookieGet }),
}));

describe('Dashboard Server Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCookieGet.mockImplementation((name: string) =>
      name === 'access_token' ? { value: 'mock-access-token' } : undefined
    );
  });

  describe('getDashboardStats()', () => {
    it('should GET /stats và map đúng 6 KPI', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockDashboardStatsResponse));
      const result = await getDashboardStats();

      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('/stats');
      expect(result.total_jobs).toBe(120);
      expect(result.total_companies).toBe(40);
      expect(result.total_students).toBe(300);
      expect(result.total_applications).toBe(55);
      expect(result.total_saved_jobs).toBe(70);
    });

    it('should lấy jobs_open từ jobs_by_status.OPEN (enum DB, KHÔNG phải text tiếng Việt)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockDashboardStatsResponse));
      const result = await getDashboardStats();
      expect(result.jobs_open).toBe(90);
    });

    it('should trả jobs_open = 0 nếu backend không có key "OPEN" trong jobs_by_status', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchSuccess({ ...mockDashboardStatsResponse, jobs_by_status: { CLOSED: 30 } })
      );
      const result = await getDashboardStats();
      expect(result.jobs_open).toBe(0);
    });

    it('should trả total_students = null nếu backend chưa trả field này (thay vì 0 gây hiểu nhầm)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchSuccess({ ...mockDashboardStatsResponse, total_students: undefined })
      );
      const result = await getDashboardStats();
      expect(result.total_students).toBeNull();
    });

    it('should trả stats rỗng (không throw) khi lỗi HTTP', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchError(500, 'Internal Server Error'));
      const result = await getDashboardStats();
      expect(result).toEqual({
        total_jobs: 0,
        total_companies: 0,
        jobs_open: 0,
        total_students: null,
        total_applications: 0,
        total_saved_jobs: 0,
      });
    });

    it('should trả stats rỗng khi network lỗi', async () => {
      (global.fetch as jest.Mock).mockImplementation(mockFetchNetworkError);
      const result = await getDashboardStats();
      expect(result.total_jobs).toBe(0);
    });
  });

  describe('getRecentActivity()', () => {
    // BUG FIX regression test: trước đây hàm này luôn throw
    // 'Not implemented' dù GET /audit-logs đã có sẵn (dùng ở /activity)
    // — giờ nối lại qua getAuditLogs({view:'auto'}), test đảm bảo
    // không quay lại hành vi throw cũ.
    it('should KHÔNG throw, gọi getAuditLogs({view:"auto"}) và trả mảng items', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockAuditLogsResponse));

      const result = await getRecentActivity();

      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('/audit-logs');
      expect(calledUrl).toContain('view=auto');
      expect(result).toEqual([mockAuditLog]);
    });

    it('should dùng limit mặc định 8 khi không truyền vào', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockAuditLogsResponse));
      await getRecentActivity();
      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('limit=8');
    });

    it('should truyền đúng limit tuỳ chỉnh', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockAuditLogsResponse));
      await getRecentActivity(3);
      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('limit=3');
    });

    it('should trả mảng rỗng (không throw) khi audit-logs lỗi, vd học viên chưa đủ quyền', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchError(403, 'Forbidden'));
      const result = await getRecentActivity();
      expect(result).toEqual([]);
    });
  });
});
