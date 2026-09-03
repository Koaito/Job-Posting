/**
 * Tests for Messages Server Actions
 * Matches Flask: blueprints/messages.py pattern
 *
 * Trước đây actions/messages.ts là stub — file test này viết cùng lúc
 * với việc triển khai thật, không phải retrofit sau, nên không có "bug
 * đã sửa" nào để ghi chú như jobs.test.ts. Trọng tâm test: sendMessage()
 * là hàm DUY NHẤT trong file có 2 nhánh thành công khác shape (201 sent
 * / 202 pending) — dễ viết sai nhất, nên test kỹ cả 2 nhánh + các mã
 * lỗi đặc biệt (429/409/403/404) thay vì chỉ test happy path.
 */

import {
  getConversations,
  getPendingRequests,
  getUnreadCount,
  searchPeople,
  getMessageHistory,
  getMessagesSince,
  markMessagesRead,
  sendMessage,
  cancelPendingRequest,
  acceptMessageRequest,
  declineMessageRequest,
  blockStudent,
  unblockRelationship,
} from '@/app/actions/messages';
import {
  mockChatMessage,
  mockConversation,
  mockPendingRequest,
  mockPersonSearchResult,
  mockFetchSuccess,
  mockFetchError,
  mockFetchStatus,
  mockFetchNetworkError,
} from '../fixtures';

global.fetch = jest.fn();

const mockCookieGet = jest.fn();
jest.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ get: mockCookieGet }),
}));

describe('Messages Server Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCookieGet.mockImplementation((name: string) =>
      name === 'access_token' ? { value: 'mock-access-token' } : undefined
    );
  });

  describe('getConversations()', () => {
    it('should fetch conversations with auth header', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess([mockConversation]));

      const result = await getConversations();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/messages/conversations'),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer mock-access-token' }),
        })
      );
      expect(result).toHaveLength(1);
      expect(result[0].partner_id).toBe('partner-1');
    });

    it('should return empty array on backend error', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchError(500, 'Internal Server Error'));
      expect(await getConversations()).toEqual([]);
    });

    it('should return empty array on network error', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchNetworkError());
      expect(await getConversations()).toEqual([]);
    });
  });

  describe('getPendingRequests()', () => {
    it('should fetch pending requests', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess([mockPendingRequest]));
      const result = await getPendingRequests();
      expect(result).toHaveLength(1);
      expect(result[0].student_name).toBe('Trần Thị B');
    });

    it('should return empty array on 403 (student gọi nhầm route staff-only)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchError(403, 'Forbidden'));
      expect(await getPendingRequests()).toEqual([]);
    });
  });

  describe('getUnreadCount()', () => {
    it('should return count from response', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess({ count: 5 }));
      expect(await getUnreadCount()).toBe(5);
    });

    it('should return 0 on error', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchError(500, 'Internal Server Error'));
      expect(await getUnreadCount()).toBe(0);
    });
  });

  describe('searchPeople()', () => {
    it('should NOT call API when query is empty (tránh round-trip thừa)', async () => {
      const result = await searchPeople('   ');
      expect(global.fetch).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should search with trimmed query param', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess([mockPersonSearchResult]));
      const result = await searchPeople('  Lê  ');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('q=L%C3%AA'),
        expect.any(Object)
      );
      expect(result[0].full_name).toBe('Lê Văn C');
    });
  });

  describe('getMessageHistory()', () => {
    it('should reverse backend order (DESC -> ASC) for chat display', async () => {
      const newest = { ...mockChatMessage, id: 2, content: 'Tin mới nhất' };
      const oldest = { ...mockChatMessage, id: 1, content: 'Tin cũ nhất' };
      // Backend trả MỚI NHẤT TRƯỚC (ORDER BY id DESC).
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess([newest, oldest]));

      const result = await getMessageHistory('partner-1');

      // getMessageHistory() phải đảo lại thành CŨ->MỚI để hiển thị
      // đúng chiều đọc trên->dưới trong khung chat.
      expect(result[0].content).toBe('Tin cũ nhất');
      expect(result[1].content).toBe('Tin mới nhất');
    });

    it('should return empty array on error', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchError(500, 'Internal Server Error'));
      expect(await getMessageHistory('partner-1')).toEqual([]);
    });
  });

  describe('getMessagesSince()', () => {
    it('should call /messages/since with after_id, KHÔNG đảo thứ tự (backend đã ASC)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess([mockChatMessage]));
      const result = await getMessagesSince('partner-1', 10);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/messages/since/partner-1?after_id=10'),
        expect.any(Object)
      );
      expect(result).toEqual([mockChatMessage]);
    });

    it('should return empty array on error (polling không được throw)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchError(500, 'Internal Server Error'));
      expect(await getMessagesSince('partner-1', 10)).toEqual([]);
    });
  });

  describe('markMessagesRead()', () => {
    it('should return marked_read count', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess({ marked_read: 3 }));
      expect(await markMessagesRead('partner-1')).toBe(3);
    });

    it('should NUỐT lỗi và trả 0, không được làm hỏng cả trang', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchNetworkError());
      await expect(markMessagesRead('partner-1')).resolves.toBe(0);
    });
  });

  describe('sendMessage()', () => {
    it('should reject empty content trước khi gọi API', async () => {
      const result = await sendMessage('partner-1', '   ');
      expect(global.fetch).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
    });

    it('should reject content > 2000 ký tự trước khi gọi API', async () => {
      const result = await sendMessage('partner-1', 'a'.repeat(2001));
      expect(global.fetch).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
    });

    it('201: tin nhắn thật đã lưu -> status "sent"', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchStatus(201, mockChatMessage));
      const result = await sendMessage('partner-1', 'Chào bạn');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.status).toBe('sent');
        expect(result.message).toEqual(mockChatMessage);
      }
    });

    it('202: học viên vừa tạo/gửi lại request pending -> status "pending", KHÔNG lưu tin', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchStatus(202, { status: 'pending', message: 'Đã gửi yêu cầu nhắn tin.' })
      );
      const result = await sendMessage('partner-1', 'Xin chào');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.status).toBe('pending');
        expect(result.message).toBe('Đã gửi yêu cầu nhắn tin.');
      }
    });

    it('429: dùng thông báo rate-limit tiếng Việt mặc định khi backend không có detail', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchStatus(429));
      const result = await sendMessage('partner-1', 'Xin chào');
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain('quá nhanh');
    });

    it('409: dùng thông báo trạng thái hội thoại vừa đổi', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchStatus(409));
      const result = await sendMessage('partner-1', 'Xin chào');
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain('tải lại trang');
    });

    it('403: không có quyền nhắn tin với người này', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchStatus(403));
      const result = await sendMessage('partner-1', 'Xin chào');
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain('không có quyền');
    });

    it('network error -> success: false', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchNetworkError());
      const result = await sendMessage('partner-1', 'Xin chào');
      expect(result.success).toBe(false);
    });
  });

  describe('cancelPendingRequest()', () => {
    it('should succeed on 200', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess({}));
      const result = await cancelPendingRequest('ss-1');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/messages/cancel/ss-1'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.success).toBe(true);
    });

    it('should return error on 404 (không có request pending nào)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchError(404, 'Not found'));
      const result = await cancelPendingRequest('ss-1');
      expect(result.success).toBe(false);
    });
  });

  describe('acceptMessageRequest() / declineMessageRequest()', () => {
    it('accept: should call đúng route relationships/:id/accept', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess({}));
      const result = await acceptMessageRequest('rel-2');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/messages/relationships/rel-2/accept'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.success).toBe(true);
    });

    it('decline: should call đúng route relationships/:id/decline', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess({}));
      const result = await declineMessageRequest('rel-2');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/messages/relationships/rel-2/decline'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('blockStudent() / unblockRelationship()', () => {
    it('block: should call /messages/block/:studentId (KHÔNG cần relationship_id)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess({}));
      const result = await blockStudent('partner-2');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/messages/block/partner-2'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.success).toBe(true);
    });

    it('unblock: should call /messages/relationships/:id/unblock (CẦN relationship_id)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess({}));
      const result = await unblockRelationship('rel-1');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/messages/relationships/rel-1/unblock'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.success).toBe(true);
    });
  });
});
