/**
 * Test Fixtures
 * Equivalent to Flask tests/conftest.py
 * Reusable mock data for tests
 */

export const mockJob = {
  id: 'job-1',
  job_title: 'Backend Developer',
  company_id: 'company-1',
  company: 'ACME Corp',
  matching_industry: 'CNTT - Phần mềm',
  level: 'Middle',
  location: 'Hà Nội',
  salary_min: 15000000,
  salary_max: 25000000,
  salary_type: 'RANGE',
  currency: 'VNĐ',
  deadline: '2026-12-31',
  job_status: 'OPEN',
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
};

export const mockJobClosed = {
  ...mockJob,
  id: 'job-2',
  job_title: 'Frontend Developer',
  job_status: 'CLOSED',
};

export const mockJobsResponse = {
  items: [mockJob, mockJobClosed],
  total: 2,
  limit: 50,
  offset: 0,
};

export const mockCompany = {
  id: 'company-1',
  company_name: 'ACME Corp',
  industry: 'Technology',
  city: 'Hà Nội',
};

export const mockUser = {
  id: 'user-1',
  email: 'staff@example.com',
  full_name: 'Staff User',
  role: 'ss_team',
};

export const mockStudentUser = {
  id: 'user-2',
  email: 'student@example.com',
  full_name: 'Student User',
  role: 'user',
};

/**
 * Mock fetch responses
 */
export function mockFetchSuccess(data: any) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => data,
  } as Response);
}

export function mockFetchError(status: number, message: string) {
  return Promise.resolve({
    ok: false,
    status,
    statusText: message,
    json: async () => ({ detail: message }),
  } as Response);
}

export function mockFetchNetworkError() {
  return Promise.reject(new Error('Network error'));
}
