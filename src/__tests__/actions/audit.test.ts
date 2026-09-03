/**
 * Tests for Audit Log Server Actions
 * Matches Flask: blueprints/activity_logs.py pattern
 * Backend thật: api/routers/audit_logs.py — toàn bộ route yêu cầu 'ss_team'.
 */

import { getAuditLogs, updateAuditLogNote } from '@/app/actions/audit';
import { mockAuditLog, mockAuditLogsResponse, mockFetchSuccess, mockFetchError, mockFetchNetworkError } from '../fixtures';

global.fetch = jest.fn();

const mockCookieGet = jest.fn();
jest.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ get: mockCookieGet }),
}));

describe('Audit Log Server Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCookieGet.mockImplementation((name: string) =>
      name === 'access_token' ? { value: 'mock-access-token' } : undefined
    );
  });

  describe('getAuditLogs()', () => {
    it('should GET /audit-logs với view="auto" mặc định', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockAuditLogsResponse));
      await getAuditLogs();
      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('/audit-logs');
      expect(calledUrl).toContain('view=auto');
    });

    it('should gửi đúng view="manual" khi truyền vào', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockAuditLogsResponse));
      await getAuditLogs({ view: 'manual' });
      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('view=manual');
    });

    it('should CHỈ gửi pending_note khi có giá trị (không tự thêm khi undefined)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockAuditLogsResponse));
      await getAuditLogs({ view: 'auto' });
      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).not.toContain('pending_note');
    });

    it('should gửi pending_note=true khi view="manual" lọc log thiếu note', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockAuditLogsResponse));
      await getAuditLogs({ view: 'manual', pending_note: true });
      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('pending_note=true');
    });

    it('should gửi kèm entity_type/company_id/actor_id/action_type khi có', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockAuditLogsResponse));
      await getAuditLogs({
        entity_type: 'JOB',
        company_id: 'company-1',
        actor_id: 'user-1',
        action_type: 'UPDATE_JOB',
      });
      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('entity_type=JOB');
      expect(calledUrl).toContain('company_id=company-1');
      expect(calledUrl).toContain('actor_id=user-1');
      expect(calledUrl).toContain('action_type=UPDATE_JOB');
    });

    it('should trả kết quả rỗng đúng shape khi lỗi (không throw)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchError(403, 'Forbidden'));
      const result = await getAuditLogs({ limit: 20, offset: 10 });
      expect(result).toEqual({ total: 0, limit: 20, offset: 10, items: [] });
    });

    it('should trả kết quả rỗng khi network lỗi', async () => {
      (global.fetch as jest.Mock).mockImplementation(mockFetchNetworkError);
      const result = await getAuditLogs();
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('updateAuditLogNote()', () => {
    it('should PATCH /audit-logs/{logId}/note kèm body {note}', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchSuccess({ ...mockAuditLog, note: 'Đã xác nhận với công ty' })
      );
      const result = await updateAuditLogNote('log-1', 'Đã xác nhận với công ty');

      const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toContain('/audit-logs/log-1/note');
      expect(options.method).toBe('PATCH');
      expect(JSON.parse(options.body)).toEqual({ note: 'Đã xác nhận với công ty' });
      expect(result.success).toBe(true);
      expect(result.log?.note).toBe('Đã xác nhận với công ty');
    });

    it('should trả lỗi 403 cụ thể (không phải actor gốc), KHÔNG bị nuốt thành fallback', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchError(403, 'Chỉ người tạo log mới sửa được note')
      );
      const result = await updateAuditLogNote('log-1', 'note mới');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Chỉ người tạo log mới sửa được note');
    });

    it('should trả lỗi 409 cụ thể (cố xoá note dù note_required=true)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchError(409, 'Log này bắt buộc phải có note')
      );
      const result = await updateAuditLogNote('log-1', '');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Log này bắt buộc phải có note');
    });

    it('should dùng fallback "Không thể cập nhật note" khi backend không trả detail', async () => {
      // BUG FIX regression test: trước đây formatErrorDetail(undefined)
      // luôn trả string truthy nên `|| fallback` không bao giờ chạy —
      // test này đảm bảo bug không quay lại.
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => ({}),
        } as Response)
      );
      const result = await updateAuditLogNote('log-1', 'note mới');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Không thể cập nhật note');
    });

    it('should trả Network error khi fetch throw', async () => {
      (global.fetch as jest.Mock).mockImplementation(mockFetchNetworkError);
      const result = await updateAuditLogNote('log-1', 'note mới');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });
});
