/**
 * Test Fixtures
 * Equivalent to Flask tests/conftest.py
 * Reusable mock data for tests
 */

// BUG FIX (audit 09/2026): fixtures trước đây dùng field "id"/"company"/
// "level"/"location" — đúng bằng tên field SAI mà production code (actions/
// jobs.ts, JobForm.tsx, jobs/page.tsx...) từng dùng nhầm. Vì test mock
// fetch trả thẳng object này, test luôn xanh dù backend thật (schemas/
// jobs.py::JobOut) trả "job_id"/"company_name"/"level_code"/"province_name".
// Sửa lại đúng theo JobOut thật để test không tiếp tục hợp thức hoá bug.
export const mockJob = {
  job_id: 'job-1',
  job_title: 'Backend Developer',
  company_id: 'company-1',
  company_name: 'ACME Corp',
  matching_industry: 'CNTT - Phần mềm',
  level_code: 'Middle',
  province_name: 'Hà Nội',
  salary_min: 15000000,
  salary_max: 25000000,
  salary_type: 'RANGE',
  currency: 'VNĐ',
  deadline: '2026-12-31',
  job_status: 'OPEN',
  ss_team_notes: null,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
};

export const mockJobClosed = {
  ...mockJob,
  job_id: 'job-2',
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
  company_id: 'company-1',
  company_name: 'ACME Corp',
  industry: 'Technology',
  city: 'Hà Nội',
};

// ss_user_id (không phải "id") — khớp schemas/auth.py::UserOut thật.
export const mockUser = {
  ss_user_id: 'user-1',
  email: 'staff@example.com',
  full_name: 'Staff User',
  role: 'ss_team',
};

export const mockStudentUser = {
  ss_user_id: 'user-2',
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
