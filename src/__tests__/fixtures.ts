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

// BUG FIX (đợt viết test 09/2026): mockCompany trước đây tự bịa field
// (industry/city thẳng, thiếu company_id đúng nghĩa/partnership_potential/
// is_active/created_at/updated_at) — không khớp CompanyOut thật (xem
// types/companies.ts). Không gây lỗi vì companies.ts chưa có test nào
// dùng field này trước đó. Viết lại đúng shape trước khi viết
// companies.test.ts.
export const mockCompany = {
  company_id: 'company-1',
  company_name: 'ACME Corp',
  tax_id: '0123456789',
  website: 'https://acme.example.com',
  industry: 'CNTT - Phần mềm',
  company_size: '50-100',
  address: '123 Đường ABC, Quận 1',
  fanpage_url: null,
  linkedin_url: null,
  partnership_potential: 'HIGH',
  province_name: 'Hồ Chí Minh',
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
  created_by: 'user-1',
  updated_by: null,
  is_active: true,
};

export const mockCompanyDetail = {
  ...mockCompany,
  jobs: [],
};

export const mockCompaniesResponse = {
  items: [mockCompany],
  total: 1,
  limit: 50,
  offset: 0,
};

export const mockContact = {
  contact_id: 'contact-1',
  company_id: 'company-1',
  contact_name: 'Nguyễn Văn HR',
  job_title: 'Talent Acquisition',
  work_email: 'hr@acme.example.com',
  social_link: null,
  phone_number: '0901234567',
  found_source: 'LinkedIn',
  collected_date: '2026-08-01',
  last_contacted_date: null,
  contact_status: 'UNCONTACTED',
  is_active: true,
  assigned_ss_user: null,
  created_by: 'user-1',
  updated_by: null,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
};

export const mockContactWithCompany = {
  ...mockContact,
  company_name: 'ACME Corp',
};

export const mockContactsResponse = {
  items: [mockContactWithCompany],
  total: 1,
  limit: 50,
  offset: 0,
};

// ss_user_id (không phải "id") — khớp schemas/auth.py::UserOut thật.
export const mockUser = {
  ss_user_id: 'user-1',
  email: 'staff@example.com',
  full_name: 'Staff User',
  role: 'ss_team',
};

export const mockChatMessage = {
  id: 1,
  sender_id: 'user-1',
  receiver_id: 'partner-1',
  content: 'Chào bạn',
  created_at: '2026-09-01T08:00:00Z',
  read_at: null,
};

export const mockConversation = {
  partner_id: 'partner-1',
  partner_name: 'Nguyễn Văn A',
  partner_role: 'user',
  last_message_preview: 'Chào bạn',
  last_message_at: '2026-09-01T08:00:00Z',
  unread_count: 2,
  relationship_status: 'accepted',
  relationship_id: 'rel-1',
};

export const mockPendingRequest = {
  relationship_id: 'rel-2',
  student_id: 'partner-2',
  student_name: 'Trần Thị B',
  requested_at: '2026-09-01T09:00:00Z',
};

export const mockPersonSearchResult = {
  id: 'partner-3',
  full_name: 'Lê Văn C',
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

/**
 * Helper linh hoạt hơn mockFetchSuccess/mockFetchError — cần cho các
 * route trả status code KHÔNG chuẩn 200/OK (vd sendMessage() 201 vs
 * 202 CÙNG là thành công nhưng khác shape response, hardDeleteContact()
 * 204 không có body...). Dùng khi 2 helper trên không đủ diễn tả case
 * cần test.
 */
export function mockFetchStatus(status: number, data?: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: `Status ${status}`,
    json: async () => data ?? {},
  } as Response);
}
