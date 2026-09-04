/**
 * Tests for `my_stuff` Server Actions (apply/withdraw/save/unsave jobs)
 * Matches Flask: blueprints/my_stuff.py pattern
 * Backend thật: api/routers/me.py
 */

import {
  applyToJob,
  withdrawApplication,
  getMyApplications,
  saveJob,
  unsaveJob,
  getMySavedJobs,
  getCvSignedUrl,
} from '@/app/actions/me';
import {
  mockApplication,
  mockSavedJob,
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

// jsdom không có File#size ghi được trực tiếp qua constructor với nội
// dung lớn theo cách gọn — dùng helper tạo File giả với size tuỳ ý bằng
// Object.defineProperty, giống pattern test upload phổ biến.
function makeFile(name: string, sizeBytes: number): File {
  const file = new File(['x'], name, { type: 'application/pdf' });
  Object.defineProperty(file, 'size', { value: sizeBytes });
  return file;
}

describe('me.ts Server Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCookieGet.mockImplementation((name: string) =>
      name === 'access_token' ? { value: 'mock-access-token' } : undefined
    );
  });

  describe('applyToJob()', () => {
    it('should từ chối file không phải .pdf mà KHÔNG gọi fetch', async () => {
      const file = makeFile('cv.docx', 1000);
      const result = await applyToJob('job-1', file);

      expect(result.success).toBe(false);
      expect(result.error).toContain('.pdf');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should từ chối file >5MB mà KHÔNG gọi fetch', async () => {
      const file = makeFile('cv.pdf', 6 * 1024 * 1024);
      const result = await applyToJob('job-1', file);

      expect(result.success).toBe(false);
      expect(result.error).toContain('5MB');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should POST multipart/form-data (KHÔNG tự set Content-Type)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchStatus(201, mockApplication));
      const file = makeFile('cv.pdf', 1000);

      const result = await applyToJob('job-1', file, 'note của tôi');

      expect(result.success).toBe(true);
      const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toContain('/me/applications');
      expect(options.body).toBeInstanceOf(FormData);
      // Content-Type KHÔNG được set thủ công — để browser/Next.js tự
      // sinh header kèm boundary đúng cho multipart.
      expect(options.headers['Content-Type']).toBeUndefined();
      expect(options.headers['X-API-Key']).toBeDefined();
      expect(options.headers['Authorization']).toBe('Bearer mock-access-token');
    });

    it('should trả lỗi rõ ràng khi backend 400 (job không OPEN)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchError(400, "Job đang ở trạng thái 'CLOSED', không thể ứng tuyển.")
      );
      const file = makeFile('cv.pdf', 1000);

      const result = await applyToJob('job-1', file);

      expect(result.success).toBe(false);
      expect(result.error).toContain('CLOSED');
    });

    it('should trả lỗi rõ ràng khi backend 409 (đã ứng tuyển rồi)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchError(409, 'Bạn đã ứng tuyển job này rồi.')
      );
      const file = makeFile('cv.pdf', 1000);

      const result = await applyToJob('job-1', file);

      expect(result.success).toBe(false);
      expect(result.error).toContain('đã ứng tuyển');
    });

    it('should xử lý network error gracefully', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchNetworkError());
      const file = makeFile('cv.pdf', 1000);

      const result = await applyToJob('job-1', file);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('withdrawApplication()', () => {
    it('should DELETE /me/applications/{job_id}', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchStatus(204));

      const result = await withdrawApplication('job-1');

      expect(result.success).toBe(true);
      const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toContain('/me/applications/job-1');
      expect(options.method).toBe('DELETE');
      expect(url).not.toContain('note=');
    });

    it('should gửi note qua query param khi có', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchStatus(204));

      await withdrawApplication('job-1', 'Đổi ý');

      const [url] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toContain('note=');
    });

    it('should trả lỗi rõ ràng khi 404 (chưa ứng tuyển job này)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchError(404, 'Bạn chưa ứng tuyển job này.')
      );

      const result = await withdrawApplication('job-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('chưa ứng tuyển');
    });
  });

  describe('getMyApplications()', () => {
    it('should GET /me/applications và trả mảng trần', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess([mockApplication]));

      const result = await getMyApplications();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/me/applications'),
        expect.any(Object)
      );
      expect(result).toHaveLength(1);
      expect(result[0].job_title).toBe('Backend Developer');
    });

    it('should return empty array on error', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchError(500, 'Internal Server Error'));
      expect(await getMyApplications()).toEqual([]);
    });
  });

  describe('saveJob()', () => {
    it('should POST body {job_id}', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchStatus(201, mockSavedJob));

      const result = await saveJob('job-1');

      expect(result.success).toBe(true);
      const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toContain('/me/saved-jobs');
      expect(JSON.parse(options.body)).toEqual({ job_id: 'job-1' });
    });

    it('should coi 409 (đã lưu rồi) là THÀNH CÔNG về mặt UX', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchError(409, 'Job này đã được lưu rồi')
      );

      const result = await saveJob('job-1');

      expect(result.success).toBe(true);
    });

    it('should trả lỗi khi backend 404 (job không tồn tại)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchError(404, 'Không tìm thấy job')
      );

      const result = await saveJob('job-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Không tìm thấy job');
    });
  });

  describe('unsaveJob()', () => {
    it('should DELETE /me/saved-jobs/{job_id}', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchStatus(204));

      const result = await unsaveJob('job-1');

      expect(result.success).toBe(true);
      const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toContain('/me/saved-jobs/job-1');
      expect(options.method).toBe('DELETE');
    });
  });

  describe('getMySavedJobs()', () => {
    it('should GET /me/saved-jobs và trả mảng trần', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess([mockSavedJob]));

      const result = await getMySavedJobs();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/me/saved-jobs'),
        expect.any(Object)
      );
      expect(result).toHaveLength(1);
    });

    it('should return empty array on network error', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchNetworkError());
      expect(await getMySavedJobs()).toEqual([]);
    });
  });

  describe('getCvSignedUrl()', () => {
    it('should GET /me/applications/{id}/cv-url và trả signed_url', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchSuccess({ signed_url: 'https://storage.example.com/signed?token=abc' })
      );

      const result = await getCvSignedUrl('app-1');

      expect(result.success).toBe(true);
      expect(result.signedUrl).toBe('https://storage.example.com/signed?token=abc');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/me/applications/app-1/cv-url'),
        expect.any(Object)
      );
    });

    it('should trả lỗi khi 403 (không phải staff)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchError(403, 'Không đủ quyền')
      );

      const result = await getCvSignedUrl('app-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Không đủ quyền');
    });
  });
});
