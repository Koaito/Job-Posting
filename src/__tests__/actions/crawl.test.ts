/**
 * Tests for Crawl Server Actions
 * Matches Flask: blueprints/crawl.py, crawl_status.py, crawl_history.py,
 * crawl_maintenance.py pattern (dồn hết về api/routers/crawl.py thật)
 */

import {
  getCrawlSources,
  startCrawl,
  startCrawlBatch,
  getCrawlStatus,
  getLatestCrawlRun,
  getCrawlLogs,
  getCrawlHistory,
  getCrawlBatchStatus,
  getCrawlBatchHistory,
} from '@/app/actions/crawl';
import {
  mockCrawlSources,
  mockCrawlAccepted,
  mockCrawlStatus,
  mockCrawlHistoryResponse,
  mockCrawlLogsResponse,
  mockCrawlBatchAccepted,
  mockCrawlBatchStatus,
  mockCrawlBatchHistoryResponse,
  mockFetchSuccess,
  mockFetchError,
  mockFetchNetworkError,
} from '../fixtures';

global.fetch = jest.fn();

const mockCookieGet = jest.fn();
jest.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ get: mockCookieGet }),
}));

describe('Crawl Server Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCookieGet.mockImplementation((name: string) =>
      name === 'access_token' ? { value: 'mock-access-token' } : undefined
    );
  });

  describe('getCrawlSources()', () => {
    it('should GET /sources và trả nguyên shape {source: {category: label}}', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockCrawlSources));
      const result = await getCrawlSources();
      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('/sources');
      expect(result).toEqual(mockCrawlSources);
    });

    it('should CHỈ gửi X-API-Key, KHÔNG cần Authorization (route công khai)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockCrawlSources));
      await getCrawlSources();
      const calledOptions = (global.fetch as jest.Mock).mock.calls[0][1];
      expect(calledOptions.headers).toHaveProperty('X-API-Key');
      expect(calledOptions.headers).not.toHaveProperty('Authorization');
    });

    it('should return {} khi lỗi (không throw)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchError(500, 'Internal Server Error'));
      const result = await getCrawlSources();
      expect(result).toEqual({});
    });
  });

  describe('startCrawl()', () => {
    it('should POST /crawl kèm Authorization (route admin-only)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockCrawlAccepted));
      const result = await startCrawl({ source: 'topcv', category: 'data-analyst' });

      const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toContain('/crawl');
      expect(options.method).toBe('POST');
      expect(options.headers.Authorization).toBe('Bearer mock-access-token');
      expect(result.success).toBe(true);
      expect(result.result?.run_id).toBe('run-1');
    });

    it('should trả lỗi 409 cụ thể (nguồn đang crawl dở), KHÔNG bị nuốt thành "Không thể kích hoạt crawl"', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchError(409, 'Nguồn topcv đang có 1 lượt crawl chưa xong')
      );
      const result = await startCrawl({ source: 'topcv', category: 'data-analyst' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Nguồn topcv đang có 1 lượt crawl chưa xong');
    });

    it('should dùng fallback đúng khi backend không trả detail', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => ({}),
        } as Response)
      );
      const result = await startCrawl({ source: 'topcv', category: 'data-analyst' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Không thể kích hoạt crawl');
    });

    it('should trả Network error khi fetch throw', async () => {
      (global.fetch as jest.Mock).mockImplementation(mockFetchNetworkError);
      const result = await startCrawl({ source: 'topcv', category: 'data-analyst' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('startCrawlBatch()', () => {
    it('should POST /crawl/batch kèm mảng categories', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockCrawlBatchAccepted));
      const result = await startCrawlBatch({
        source: 'topcv',
        categories: ['data-analyst', 'data-engineer'],
      });
      const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toContain('/crawl/batch');
      const body = JSON.parse(options.body);
      expect(body.categories).toEqual(['data-analyst', 'data-engineer']);
      expect(result.success).toBe(true);
      expect(result.result?.batch_id).toBe('batch-1');
    });

    it('should trả lỗi cụ thể khi backend trả detail dạng mảng (422)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 422,
          statusText: 'Unprocessable Entity',
          json: async () => ({ detail: [{ msg: 'categories không được rỗng' }] }),
        } as Response)
      );
      const result = await startCrawlBatch({ source: 'topcv', categories: [] });
      expect(result.error).toBe('categories không được rỗng');
    });
  });

  describe('getCrawlStatus()', () => {
    it('should GET /crawl/{run_id}', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockCrawlStatus));
      const result = await getCrawlStatus('run-1');
      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('/crawl/run-1');
      expect(result?.status).toBe('running');
    });

    it('should trả null khi 404 (run không tồn tại), không log lỗi console', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchError(404, 'Not Found'));
      const result = await getCrawlStatus('run-unknown');
      expect(result).toBeNull();
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should trả null + log lỗi khi 500 (khác 404)', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchError(500, 'Internal Server Error'));
      const result = await getCrawlStatus('run-1');
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('getLatestCrawlRun()', () => {
    it('should GET /crawl/latest-log-run', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockCrawlStatus));
      const result = await getLatestCrawlRun();
      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('/crawl/latest-log-run');
      expect(result?.run_id).toBe('run-1');
    });

    it('should trả null (hợp lệ, không phải lỗi) khi chưa từng crawl', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(null));
      const result = await getLatestCrawlRun();
      expect(result).toBeNull();
    });
  });

  describe('getCrawlLogs()', () => {
    it('should gửi đúng param after_id (mặc định 0)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockCrawlLogsResponse));
      await getCrawlLogs('run-1');
      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('/crawl/run-1/logs');
      expect(calledUrl).toContain('after_id=0');
    });

    it('should truyền after_id tuỳ chỉnh cho lần poll tiếp theo (chỉ tải dòng MỚI)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockCrawlLogsResponse));
      await getCrawlLogs('run-1', 42);
      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('after_id=42');
    });

    it('should trả {last_id: afterId, items: []} khi lỗi (giữ nguyên afterId, không reset về 0)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchError(500, 'Internal Server Error'));
      const result = await getCrawlLogs('run-1', 42);
      expect(result).toEqual({ last_id: 42, items: [] });
    });
  });

  describe('getCrawlHistory()', () => {
    it('should GET /crawl kèm filter source/status/triggered_by', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockCrawlHistoryResponse));
      await getCrawlHistory({ source: 'topcv', status: 'done', triggered_by: 'user-1' });
      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toMatch(/\/crawl\?/);
      expect(calledUrl).toContain('source=topcv');
      expect(calledUrl).toContain('status=done');
      expect(calledUrl).toContain('triggered_by=user-1');
    });

    it('should dùng limit/offset mặc định 50/0 khi không truyền filter', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockCrawlHistoryResponse));
      await getCrawlHistory();
      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('limit=50');
      expect(calledUrl).toContain('offset=0');
    });

    it('should trả rỗng đúng shape khi lỗi (giữ nguyên limit/offset đã truyền)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchError(500, 'Internal Server Error'));
      const result = await getCrawlHistory({ limit: 20, offset: 40 });
      expect(result).toEqual({ total: 0, limit: 20, offset: 40, items: [] });
    });
  });

  describe('getCrawlBatchStatus()', () => {
    it('should GET /crawl/batch/{batch_id}, kèm items (run con)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockCrawlBatchStatus));
      const result = await getCrawlBatchStatus('batch-1');
      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('/crawl/batch/batch-1');
      expect(result?.items).toHaveLength(1);
      expect(result?.completed).toBe(1);
      expect(result?.total).toBe(2);
    });

    it('should trả null khi 404, không log lỗi console (giống getCrawlStatus)', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchError(404, 'Not Found'));
      const result = await getCrawlBatchStatus('batch-unknown');
      expect(result).toBeNull();
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('getCrawlBatchHistory()', () => {
    it('should GET /crawl/batch, đối xứng getCrawlHistory (không có items lồng)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockCrawlBatchHistoryResponse));
      const result = await getCrawlBatchHistory({ source: 'topcv' });
      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toMatch(/\/crawl\/batch\?/);
      expect(calledUrl).toContain('source=topcv');
      expect(result.items[0].batch_id).toBe('batch-1');
    });
  });
});
