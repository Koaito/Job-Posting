/**
 * Tests for Jobs Server Actions
 * Matches Flask: tests/test_jobs.py pattern
 *
 * BUG FIX (audit 09/2026): bộ test cũ mock cứng đúng cái bug — assert
 * headers CHỈ có X-API-Key (không Authorization) và coi đó là hành vi
 * đúng, trong khi backend thật (require_role("ss_team") ở POST/PATCH
 * /jobs) luôn trả 401 nếu thiếu Authorization: Bearer. Test xanh nhưng
 * backend thật fail — đây chính là lý do bug JWT không bị phát hiện sớm.
 * Đã sửa lại để test PHẢN ÁNH ĐÚNG hợp đồng API thật, không hợp thức hoá
 * hành vi sai nữa.
 */

import { getJobs, getJobById, createJob, updateJob, deleteJob } from '@/app/actions/jobs';
import { mockJob, mockJobClosed, mockJobsResponse, mockFetchSuccess, mockFetchError, mockFetchNetworkError } from '../fixtures';

// Mock global fetch
global.fetch = jest.fn();

// Mock next/headers cookies() — actions/jobs.ts giờ đọc cookie
// "access_token" để gắn Authorization: Bearer cho các route ghi dữ liệu
// (POST/PATCH /jobs), giống pattern actions/auth.ts đã dùng đúng.
const mockCookieGet = jest.fn();
jest.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ get: mockCookieGet }),
}));

describe('Jobs Server Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mặc định: có access_token hợp lệ trong cookie (case phổ biến nhất
    // — người dùng đã đăng nhập). Test riêng case thiếu token ở dưới.
    mockCookieGet.mockImplementation((name: string) =>
      name === 'access_token' ? { value: 'mock-access-token' } : undefined
    );
  });

  describe('getJobs()', () => {
    it('should fetch jobs with default filters', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockJobsResponse));

      const result = await getJobs();

      // GET /jobs là route public (chỉ cần X-API-Key, theo routers/jobs.py)
      // — KHÔNG cần Authorization, giữ nguyên đúng như code thật.
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/jobs?limit=50&offset=0'),
        expect.objectContaining({
          headers: { 'X-API-Key': 'test-api-key' },
        })
      );
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should fetch jobs with filters', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockJobsResponse));

      await getJobs({
        status: 'OPEN',
        search: 'Backend',
        company_id: 'company-1',
        limit: 20,
        offset: 0,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('status=OPEN'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=Backend'),
        expect.any(Object)
      );
    });

    it('should return empty array on backend error', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchError(500, 'Internal Server Error'));

      const result = await getJobs();

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should return empty array on network error', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchNetworkError());

      const result = await getJobs();

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should handle timeout with AbortSignal', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockJobsResponse));

      await getJobs();

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[1].signal).toBeDefined();
    });
  });

  describe('getJobById()', () => {
    it('should fetch job by id', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockJob));

      const result = await getJobById('job-1');

      // GET /jobs/{id} cũng public — chỉ X-API-Key.
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/jobs/job-1'),
        expect.objectContaining({
          headers: { 'X-API-Key': 'test-api-key' },
        })
      );
      expect(result).toEqual(mockJob);
      // BUG FIX: kiểm tra rõ ràng field thật là job_id, không phải id —
      // để lần sau ai đổi lại field sai, test sẽ đỏ ngay.
      expect(result?.job_id).toBe('job-1');
    });

    it('should return null on 404', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchError(404, 'Not Found'));

      const result = await getJobById('does-not-exist');

      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchNetworkError());

      const result = await getJobById('job-1');

      expect(result).toBeNull();
    });
  });

  describe('createJob()', () => {
    // Payload đúng theo schemas/jobs.py::JobCreate (extra="forbid") —
    // KHÔNG có job_status/ss_team_notes/level_id/province_id, dùng
    // level_code/province_name dạng chuỗi.
    const newJobData = {
      job_title: 'New Job',
      company_id: 'company-1',
      salary_min: 10000000,
      salary_max: 20000000,
      level_code: 'Middle',
      province_name: 'Hà Nội',
    };

    it('should create job successfully', async () => {
      const createdJob = { ...mockJob, job_id: 'new-job-id' };
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(createdJob));

      const result = await createJob(newJobData);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/jobs'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'X-API-Key': 'test-api-key',
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-access-token',
          },
          body: JSON.stringify(newJobData),
        })
      );
      expect(result.success).toBe(true);
      expect(result.job).toEqual(createdJob);
    });

    // BUG FIX: đây chính là test bao phủ trực tiếp bug #1 đã tìm được —
    // trước đây KHÔNG có test nào assert Authorization tồn tại, nên bug
    // thiếu header lọt qua hoàn toàn.
    it('should send Authorization: Bearer header using access_token cookie', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockJob));

      await createJob(newJobData);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[1].headers['Authorization']).toBe('Bearer mock-access-token');
      expect(mockCookieGet).toHaveBeenCalledWith('access_token');
    });

    it('should omit Authorization header when access_token cookie is missing', async () => {
      mockCookieGet.mockImplementation(() => undefined);
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchError(401, 'missing_auth_header'));

      await createJob(newJobData);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[1].headers['Authorization']).toBeUndefined();
    });

    it('should return error on validation failure', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchError(422, 'Validation error')
      );

      const result = await createJob(newJobData);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return error on network failure', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchNetworkError());

      const result = await createJob(newJobData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should send API key in header', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockJob));

      await createJob(newJobData);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[1].headers['X-API-Key']).toBe('test-api-key');
    });
  });

  describe('updateJob()', () => {
    // JobUpdate CÓ job_status/ss_team_notes (khác JobCreate) — dùng
    // level_code/province_name giống create, không dùng level_id/province_id.
    const updateData = {
      job_title: 'Updated Job Title',
      salary_min: 15000000,
      job_status: 'OPEN',
    };

    it('should update job successfully', async () => {
      const updatedJob = { ...mockJob, job_title: 'Updated Job Title' };
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(updatedJob));

      const result = await updateJob('job-1', updateData);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/jobs/job-1'),
        expect.objectContaining({
          method: 'PATCH',
          headers: {
            'X-API-Key': 'test-api-key',
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-access-token',
          },
          body: JSON.stringify(updateData),
        })
      );
      expect(result.success).toBe(true);
      expect(result.job?.job_title).toBe('Updated Job Title');
    });

    it('should send Authorization: Bearer header on update', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockJob));

      await updateJob('job-1', updateData);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[1].headers['Authorization']).toBe('Bearer mock-access-token');
    });

    it('should return error on update failure', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchError(404, 'Job not found')
      );

      const result = await updateJob('invalid-id', updateData);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('deleteJob()', () => {
    it('should soft delete job (set status to CLOSED)', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockJobClosed));

      const result = await deleteJob('job-1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/jobs/job-1'),
        expect.objectContaining({
          method: 'PATCH',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-access-token',
          }),
          body: JSON.stringify({ job_status: 'CLOSED' }),
        })
      );
      expect(result.success).toBe(true);
    });

    it('should send Authorization: Bearer header on delete', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockJobClosed));

      await deleteJob('job-1');

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[1].headers['Authorization']).toBe('Bearer mock-access-token');
    });

    it('should return error on delete failure', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchError(404, 'Job not found')
      );

      const result = await deleteJob('invalid-id');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
