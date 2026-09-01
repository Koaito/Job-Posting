/**
 * Tests for Jobs Server Actions
 * Matches Flask: tests/test_jobs.py pattern
 */

import { getJobs, getJobById, createJob, updateJob, deleteJob } from '@/app/actions/jobs';
import { mockJob, mockJobClosed, mockJobsResponse, mockFetchSuccess, mockFetchError, mockFetchNetworkError } from '../fixtures';

// Mock global fetch
global.fetch = jest.fn();

describe('Jobs Server Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getJobs()', () => {
    it('should fetch jobs with default filters', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockJobsResponse));

      const result = await getJobs();

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

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/jobs/job-1'),
        expect.objectContaining({
          headers: { 'X-API-Key': 'test-api-key' },
        })
      );
      expect(result).toEqual(mockJob);
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
    const newJobData = {
      job_title: 'New Job',
      company_id: 'company-1',
      salary_min: 10000000,
      salary_max: 20000000,
      job_status: 'OPEN',
    };

    it('should create job successfully', async () => {
      const createdJob = { ...mockJob, id: 'new-job-id' };
      (global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(createdJob));

      const result = await createJob(newJobData);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/jobs'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'X-API-Key': 'test-api-key',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newJobData),
        })
      );
      expect(result.success).toBe(true);
      expect(result.job).toEqual(createdJob);
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
    const updateData = {
      job_title: 'Updated Job Title',
      salary_min: 15000000,
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
          },
          body: JSON.stringify(updateData),
        })
      );
      expect(result.success).toBe(true);
      expect(result.job?.job_title).toBe('Updated Job Title');
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
          body: JSON.stringify({ job_status: 'CLOSED' }),
        })
      );
      expect(result.success).toBe(true);
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
