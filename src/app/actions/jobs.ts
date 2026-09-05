'use server';

import { apiFetch } from '@/lib/api/client';
// BUG FIX (audit 09/2026 #11 — dọn "type debt"): file này trước đây tự
// khai lại 1 interface Job RIÊNG, thiếu hẳn work_type/salary_period/
// source_url/source_name so với JobOut thật, và job_status khai bắt buộc
// (Optional[str] thật ở backend) — trong khi types/jobs.ts đã có sẵn 1
// bản ĐÚNG, đầy đủ, khớp JobOut/JobDetailOut/JobCreate/JobUpdate nhưng
// KHÔNG được import ở đâu cả (dead code, 2 nguồn sự thật cho cùng 1
// entity). Sửa: dùng chung types/jobs.ts, xoá hẳn interface Job/JobFilters
// tự khai ở đây — không còn 2 nguồn sự thật nữa.
import type { JobDetail, JobFilters, JobCreatePayload, JobUpdatePayload, PaginatedJobs } from '@/types/jobs';
import type { JobApplicant, JobSaver } from '@/types/auth';

/**
 * Server Actions for Jobs
 * Corresponds to Flask blueprint: blueprints/jobs.py
 *
 * REFACTOR (09/2026, "Đánh giá kiến trúc" #1+#2): mọi hàm ở đây trước đây
 * tự lặp lại y hệt khối AbortController + setTimeout(30000) + try/finally
 * clearTimeout + parse lỗi (formatErrorDetail() cũng tự khai riêng ở đây,
 * bản ĐẦY ĐỦ NHẤT trong 7 bản — đã chuyển thẳng lên lib/api/client.ts để
 * mọi module khác dùng lại đúng bản này, xem TODO mục 4 trong
 * plan_nextjs.md). Giờ dùng chung apiFetch() (lib/api/client.ts) — kèm
 * auto-refresh access_token khi 401 token_expired cho createJob/updateJob/
 * deleteJob (trước đây CHỈ getCurrentUser() có auto-refresh).
 */

/**
 * Các route ghi dữ liệu (POST/PATCH /jobs) yêu cầu require_role("ss_team")
 * ở backend (api/deps.py::get_current_user dùng HTTPBearer) — PHẢI gắn
 * Authorization: Bearer <access_token> song song X-API-Key, giống pattern
 * đã dùng đúng ở actions/auth.ts. Thiếu header này sẽ luôn nhận
 * 401 missing_auth_header dù X-API-Key hợp lệ.
 */
/**
 * BUG FIX (audit 09/2026): field trước đây (matching_industry/level_id/
 * province_id/search/company_id) KHÔNG khớp query param thật của
 * GET /jobs (api/routers/jobs.py::list_jobs) — backend chỉ đọc
 * industry/level/province/keyword/status/work_type/created_by/
 * include_content. Param lạ trên query string GET không gây lỗi (FastAPI
 * chỉ bỏ qua), nên bug này im lặng: ô "Tìm theo tên job" trước đây gửi
 * "search=..." nhưng backend chờ "keyword=...", lọc luôn bị bỏ qua dù
 * giao diện không báo lỗi gì. company_id không tồn tại trong list_jobs()
 * — bỏ hẳn khỏi filter (không lọc job theo công ty ở list, chỉ có ở
 * data-health).
 *
 * (interface JobFilters/Job/JobsResponse tự khai ở đây trước đây đã bị
 * xoá — dùng chung JobFilters/Job/PaginatedJobs từ '@/types/jobs', xem
 * BUG FIX ở đầu file.)
 */

/**
 * Get list of jobs with filters and pagination
 * Matches Flask: blueprints/jobs.py::index()
 * GET /jobs là route public (chỉ cần X-API-Key, theo routers/jobs.py) —
 * KHÔNG cần Authorization, dùng apiFetch(..., { auth: false }).
 */
export async function getJobs(filters?: JobFilters): Promise<PaginatedJobs> {
  const fallback = { items: [], total: 0, limit: filters?.limit || 50, offset: filters?.offset || 0 };

  // Build query params — PHẢI đúng tên param thật của GET /jobs, xem
  // ghi chú ở đầu file.
  const params = new URLSearchParams();
  if (filters?.industry) params.append('industry', filters.industry);
  if (filters?.province) params.append('province', filters.province);
  if (filters?.level) params.append('level', filters.level);
  if (filters?.work_type) params.append('work_type', filters.work_type);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.keyword) params.append('keyword', filters.keyword);
  if (filters?.created_by) params.append('created_by', filters.created_by);
  params.append('limit', (filters?.limit || 50).toString());
  params.append('offset', (filters?.offset || 0).toString());

  const result = await apiFetch<PaginatedJobs>(`/jobs?${params}`, { auth: false, cache: 'no-store' });

  if (!result.success) {
    console.error('Failed to fetch jobs:', result.status, result.error);
    return fallback;
  }
  return result.data;
}

/**
 * Get single job by ID
 * Matches Flask: blueprints/jobs.py::detail()
 * Backend response_model = JobDetailOut (thêm ss_team_notes so với JobOut).
 */
export async function getJobById(id: string): Promise<JobDetail | null> {
  const result = await apiFetch<JobDetail>(`/jobs/${id}`, { auth: false, cache: 'no-store' });

  if (!result.success) {
    console.error('Failed to fetch job:', result.status, result.error);
    return null;
  }
  return result.data;
}

/**
 * Create new job
 * Matches Flask: blueprints/jobs.py::create()
 */
export async function createJob(data: JobCreatePayload): Promise<{ success: boolean; job?: JobDetail; error?: string }> {
  const result = await apiFetch<JobDetail>('/jobs', {
    method: 'POST',
    body: data,
    fallbackError: 'Failed to create job',
  });

  if (!result.success) {
    console.error('Failed to create job:', result.status, result.error);
    return { success: false, error: result.error };
  }
  return { success: true, job: result.data };
}

export async function updateJob(id: string, data: JobUpdatePayload): Promise<{ success: boolean; job?: JobDetail; error?: string }> {
  const result = await apiFetch<JobDetail>(`/jobs/${id}`, {
    method: 'PATCH',
    body: data,
    fallbackError: 'Failed to update job',
  });

  if (!result.success) {
    console.error('Failed to update job:', result.status, result.error);
    return { success: false, error: result.error };
  }
  return { success: true, job: result.data };
}

/**
 * Delete job (soft delete by setting status to CLOSED)
 * Matches Flask: blueprints/jobs.py::delete()
 */
export async function deleteJob(id: string): Promise<{ success: boolean; error?: string }> {
  const result = await apiFetch<JobDetail>(`/jobs/${id}`, {
    method: 'PATCH',
    body: { job_status: 'CLOSED' },
    fallbackError: 'Failed to delete job',
  });

  if (!result.success) {
    console.error('Failed to delete job:', result.status, result.error);
    return { success: false, error: result.error };
  }
  return { success: true };
}

/**
 * Ai đã ứng tuyển job này — CHỈ staff (role ss_team+, backend
 * require_role("ss_team")). Khác GET /me/applications (học viên chỉ
 * thấy đơn của chính mình): route này trả full_name/email/phone người
 * ứng tuyển. Thêm 09/2026 (Phase 3.6).
 */
export async function getJobApplicants(jobId: string): Promise<JobApplicant[]> {
  const result = await apiFetch<JobApplicant[]>(`/jobs/${jobId}/applications`, { cache: 'no-store' });

  if (!result.success) {
    console.error('Failed to fetch job applicants:', result.status, result.error);
    return [];
  }
  return result.data;
}

/**
 * Ai đã lưu job này — CHỈ staff (role ss_team+). Mirror getJobApplicants()
 * ở trên nhưng cho chiều "lưu" thay vì "ứng tuyển". Thêm 09/2026 (Phase 3.6).
 */
export async function getJobSavers(jobId: string): Promise<JobSaver[]> {
  const result = await apiFetch<JobSaver[]>(`/jobs/${jobId}/saved-jobs`, { cache: 'no-store' });

  if (!result.success) {
    console.error('Failed to fetch job savers:', result.status, result.error);
    return [];
  }
  return result.data;
}
