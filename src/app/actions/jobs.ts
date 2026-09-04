'use server';

import { cookies } from 'next/headers';
import { getApiKey } from '@/lib/api/client';
// BUG FIX (audit 09/2026 #11 — dọn "type debt"): file này trước đây tự
// khai lại 1 interface Job RIÊNG, thiếu hẳn work_type/salary_period/
// source_url/source_name so với JobOut thật, và job_status khai bắt buộc
// (Optional[str] thật ở backend) — trong khi types/jobs.ts đã có sẵn 1
// bản ĐÚNG, đầy đủ, khớp JobOut/JobDetailOut/JobCreate/JobUpdate nhưng
// KHÔNG được import ở đâu cả (dead code, 2 nguồn sự thật cho cùng 1
// entity). Sửa: dùng chung types/jobs.ts, xoá hẳn interface Job/JobFilters
// tự khai ở đây — không còn 2 nguồn sự thật nữa.
import type { JobDetail, JobFilters, JobCreatePayload, JobUpdatePayload, PaginatedJobs } from '@/types/jobs';

/**
 * Server Actions for Jobs
 * Corresponds to Flask blueprint: blueprints/jobs.py
 */

const API_BASE = process.env.FASTAPI_URL;

/**
 * BUG FIX (audit 09/2026): lỗi 422 do Pydantic tự validate (vd
 * extra="forbid" reject field lạ, min_length=1 fail...) trả về
 * detail dạng ARRAY of objects ([{loc, msg, type}, ...]), KHÁC với lỗi
 * tự raise thủ công trong router (detail: string đơn giản). Trước đây
 * error.detail được gán thẳng vào field "error" (kiểu string) rồi
 * JobForm.tsx setError() + render — React tự gọi String(array) khi hiện
 * ra, cho ra "[object Object],[object Object]" khó hiểu. Chuẩn hoá về
 * 1 chuỗi dễ đọc NGAY TẠI ĐÂY, dùng chung cho createJob/updateJob, để
 * mọi nơi gọi 2 hàm này (hiện tại + sau này) đều nhận được error dạng
 * string sẵn sàng hiển thị, không cần tự xử lý lại.
 */
function formatErrorDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === 'object' && 'msg' in item) {
          const loc = 'loc' in item && Array.isArray((item as { loc?: unknown[] }).loc)
            ? (item as { loc: unknown[] }).loc.filter((p) => p !== 'body').join('.')
            : '';
          const msg = String((item as { msg: unknown }).msg);
          return loc ? `${loc}: ${msg}` : msg;
        }
        return typeof item === 'string' ? item : JSON.stringify(item);
      })
      .join('; ');
  }
  if (detail && typeof detail === 'object') return JSON.stringify(detail);
  return 'Có lỗi xảy ra';
}

/**
 * Các route ghi dữ liệu (POST/PATCH /jobs) yêu cầu require_role("ss_team")
 * ở backend (api/deps.py::get_current_user dùng HTTPBearer) — PHẢI gắn
 * Authorization: Bearer <access_token> song song X-API-Key, giống pattern
 * đã dùng đúng ở actions/auth.ts. Thiếu header này sẽ luôn nhận
 * 401 missing_auth_header dù X-API-Key hợp lệ.
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  const headers: Record<string, string> = {
    'X-API-Key': getApiKey(),
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  return headers;
}

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
 */
export async function getJobs(filters?: JobFilters): Promise<PaginatedJobs> {
  try {
    // Build query params — PHẢI đúng tên param thật của GET /jobs, xem
    // ghi chú ở interface JobFilters phía trên.
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

    // Create AbortController for timeout (compatible with Node.js test env)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${API_BASE}/jobs?${params}`, {
        headers: { 'X-API-Key': getApiKey() },
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('Failed to fetch jobs:', response.status, response.statusText);
        return { items: [], total: 0, limit: filters?.limit || 50, offset: filters?.offset || 0 };
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return { items: [], total: 0, limit: filters?.limit || 50, offset: filters?.offset || 0 };
  }
}

/**
 * Get single job by ID
 * Matches Flask: blueprints/jobs.py::detail()
 * Backend response_model = JobDetailOut (thêm ss_team_notes so với JobOut).
 */
export async function getJobById(id: string): Promise<JobDetail | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${API_BASE}/jobs/${id}`, {
        headers: { 'X-API-Key': getApiKey() },
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('Failed to fetch job:', response.status, response.statusText);
        return null;
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error fetching job:', error);
    return null;
  }
}

/**
 * Create new job
 * Matches Flask: blueprints/jobs.py::create()
 */
export async function createJob(data: JobCreatePayload): Promise<{ success: boolean; job?: JobDetail; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${API_BASE}/jobs`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        console.error('Failed to create job:', response.status, error);
        // BUG FIX (audit 09/2026): dùng formatErrorDetail() thay vì gán
        // thẳng error.detail (có thể là array) — xem docstring hàm này.
        return {
          success: false,
          error: error.detail != null ? formatErrorDetail(error.detail) : 'Failed to create job',
        };
      }

      const job = await response.json();
      return { success: true, job };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error creating job:', error);
    return { success: false, error: 'Network error' };
  }
}

export async function updateJob(id: string, data: JobUpdatePayload): Promise<{ success: boolean; job?: JobDetail; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${API_BASE}/jobs/${id}`, {
        method: 'PATCH',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        console.error('Failed to update job:', response.status, error);
        return {
          success: false,
          error: error.detail != null ? formatErrorDetail(error.detail) : 'Failed to update job',
        };
      }

      const job = await response.json();
      return { success: true, job };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error updating job:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Delete job (soft delete by setting status to CLOSED)
 * Matches Flask: blueprints/jobs.py::delete()
 */
export async function deleteJob(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      // Soft delete: PATCH status to CLOSED
      const response = await fetch(`${API_BASE}/jobs/${id}`, {
        method: 'PATCH',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ job_status: 'CLOSED' }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        console.error('Failed to delete job:', response.status, error);
        // BUG FIX (audit 09/2026): deleteJob() là hàm DUY NHẤT trong file
        // còn gán thẳng error.detail (bỏ sót khi thêm formatErrorDetail()
        // cho createJob/updateJob đợt trước) — cùng lỗi "[object Object],
        // [object Object]" nếu route PATCH job_status trả 422 dạng mảng.
        return {
          success: false,
          error: error.detail != null ? formatErrorDetail(error.detail) : 'Failed to delete job',
        };
      }

      return { success: true };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error deleting job:', error);
    return { success: false, error: 'Network error' };
  }
}
