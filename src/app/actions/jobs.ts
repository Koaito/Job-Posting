'use server';

import { cookies } from 'next/headers';

/**
 * Server Actions for Jobs
 * Corresponds to Flask blueprint: blueprints/jobs.py
 */

const API_BASE = process.env.FASTAPI_URL;
const API_KEY = process.env.CRAWLER_API_KEY;

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
    'X-API-Key': API_KEY!,
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  return headers;
}

interface JobFilters {
  company_id?: string;
  status?: string;
  matching_industry?: string;
  level_id?: number;
  province_id?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

interface Job {
  // BUG FIX: backend (schemas/jobs.py::JobOut) trả về "job_id", KHÔNG
  // PHẢI "id" — field "id" không tồn tại trong response thật, khiến
  // job.id luôn undefined ở mọi trang dùng interface này trước đây.
  job_id: string;
  job_title: string;
  company_id: string;
  company_name?: string; // BUG FIX: backend trả "company_name", không phải "company"
  matching_industry?: string;
  level_code?: string; // BUG FIX: backend trả "level_code", không phải "level"
  province_name?: string; // BUG FIX: backend trả "province_name", không phải "location"
  salary_min?: number;
  salary_max?: number;
  salary_type?: string;
  currency?: string;
  deadline?: string;
  job_status: string;
  ss_team_notes?: string;
  created_at: string;
  updated_at: string;
}

interface JobsResponse {
  items: Job[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Get list of jobs with filters and pagination
 * Matches Flask: blueprints/jobs.py::index()
 */
export async function getJobs(filters?: JobFilters): Promise<JobsResponse> {
  try {
    // Build query params
    const params = new URLSearchParams();
    if (filters?.company_id) params.append('company_id', filters.company_id);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.matching_industry) params.append('matching_industry', filters.matching_industry);
    if (filters?.level_id) params.append('level_id', filters.level_id.toString());
    if (filters?.province_id) params.append('province_id', filters.province_id.toString());
    if (filters?.search) params.append('search', filters.search);
    params.append('limit', (filters?.limit || 50).toString());
    params.append('offset', (filters?.offset || 0).toString());

    // Create AbortController for timeout (compatible with Node.js test env)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${API_BASE}/jobs?${params}`, {
        headers: { 'X-API-Key': API_KEY! },
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
 */
export async function getJobById(id: string): Promise<Job | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${API_BASE}/jobs/${id}`, {
        headers: { 'X-API-Key': API_KEY! },
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
export async function createJob(data: any): Promise<{ success: boolean; job?: Job; error?: string }> {
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
        return { success: false, error: error.detail || 'Failed to create job' };
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

export async function updateJob(id: string, data: any): Promise<{ success: boolean; job?: Job; error?: string }> {
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
        return { success: false, error: error.detail || 'Failed to update job' };
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
        return { success: false, error: error.detail || 'Failed to delete job' };
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
