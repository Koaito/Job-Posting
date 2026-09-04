'use server';

import { cookies } from 'next/headers';
import { getApiKey } from '@/lib/api/client';
import type { JobApplication, SavedJob } from '@/types/auth';

/**
 * Server Actions cho module `my_stuff` — học viên (role 'user') tự ứng
 * tuyển/rút hồ sơ/lưu/bỏ lưu job.
 *
 * Corresponds to Flask blueprint: blueprints/my_stuff.py
 * Backend thật: api/routers/me.py — TOÀN BỘ route dùng require_role("user")
 * (bậc thấp nhất, nghĩa là MỌI role kể cả staff/admin gọi được, không
 * riêng học viên). ss_user_id luôn lấy từ JWT phía backend, không route
 * nào nhận qua path/body — 1 người chỉ thao tác được trên đơn/bookmark
 * của chính mình.
 *
 * Thêm 09/2026 (Phase 3.6) — trước đây module này hoàn toàn chưa tồn tại
 * ở Next.js, dù đây là tính năng lõi nhất còn thiếu phía học viên (xem
 * ARCHITECTURE_ANALYSIS.md, ghi chú rà soát 09/2026).
 */

const API_BASE = process.env.FASTAPI_URL;

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
 * Headers cho request multipart/form-data (POST /me/applications) —
 * KHÔNG set Content-Type thủ công. fetch() tự sinh header
 * "Content-Type: multipart/form-data; boundary=..." đúng khi body là
 * FormData — set thủ công "multipart/form-data" (thiếu boundary) sẽ
 * khiến backend không parse được form, luôn trả 422.
 */
async function getAuthHeadersForUpload(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  const headers: Record<string, string> = {
    'X-API-Key': getApiKey(),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  return headers;
}

/**
 * Lỗi 422 (Pydantic validate) trả detail dạng ARRAY of objects, khác lỗi
 * raise thủ công trong router (detail: string). Chuẩn hoá về 1 chuỗi dễ
 * đọc — cùng pattern với actions/jobs.ts, actions/contacts.ts.
 */
function formatErrorDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) =>
        item && typeof item === 'object' && 'msg' in item
          ? String((item as { msg: unknown }).msg)
          : String(item)
      )
      .join('; ');
  }
  return 'Có lỗi xảy ra';
}

/**
 * Ứng tuyển 1 job — multipart/form-data: job_id, note (tuỳ chọn), cv_file
 * (bắt buộc, chỉ nhận .pdf, tối đa 5MB). Validate định dạng/kích thước
 * file NGAY TẠI ĐÂY trước khi gửi lên backend cho UX nhanh (khỏi chờ
 * roundtrip network với file lớn), nhưng đây chỉ là optimization — lỗi
 * 400 (job không OPEN)/409 (đã ứng tuyển rồi) vẫn PHẢI đọc từ response
 * backend thật, không đoán trước ở FE.
 *
 * Rate limit backend: 15/phút theo user (không riêng gì FE cần biết,
 * nhưng nếu bấm liên tục sẽ nhận 429 — không xử lý riêng ở đây, rơi vào
 * nhánh lỗi chung bên dưới).
 */
export async function applyToJob(
  jobId: string,
  cvFile: File,
  note?: string
): Promise<{ success: boolean; application?: JobApplication; error?: string }> {
  if (!cvFile.name.toLowerCase().endsWith('.pdf')) {
    return { success: false, error: 'Chỉ chấp nhận file CV định dạng .pdf.' };
  }
  if (cvFile.size > 5 * 1024 * 1024) {
    return { success: false, error: 'Dung lượng file CV tối đa là 5MB.' };
  }

  try {
    const formData = new FormData();
    formData.append('job_id', jobId);
    if (note) formData.append('note', note);
    formData.append('cv_file', cvFile);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${API_BASE}/me/applications`, {
        method: 'POST',
        headers: await getAuthHeadersForUpload(),
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        return {
          success: false,
          error: error.detail != null ? formatErrorDetail(error.detail) : 'Không thể ứng tuyển job này',
        };
      }
      const application = await response.json();
      return { success: true, application };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error applying to job:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Rút hồ sơ (huỷ ứng tuyển) — note qua query param, tuỳ chọn, chỉ lưu
 * vào audit_logs (record job_applications bị xoá thật ngay trong
 * request này). Rút xong có thể ứng tuyển lại job đó.
 */
export async function withdrawApplication(
  jobId: string,
  note?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const params = new URLSearchParams();
    if (note) params.append('note', note);
    const query = params.toString() ? `?${params}` : '';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${API_BASE}/me/applications/${jobId}${query}`, {
        method: 'DELETE',
        headers: await getAuthHeaders(),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok && response.status !== 204) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        return {
          success: false,
          error: error.detail != null ? formatErrorDetail(error.detail) : 'Không thể rút hồ sơ',
        };
      }
      return { success: true };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error withdrawing application:', error);
    return { success: false, error: 'Network error' };
  }
}

/** Danh sách đơn ứng tuyển của CHÍNH học viên đang đăng nhập. */
export async function getMyApplications(): Promise<JobApplication[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${API_BASE}/me/applications`, {
        headers: await getAuthHeaders(),
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('Failed to fetch my applications:', response.status, response.statusText);
        return [];
      }
      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error fetching my applications:', error);
    return [];
  }
}

/**
 * Lưu job (bookmark) — body JSON {job_id}. 409 nếu đã lưu rồi (coi là
 * thành công về mặt UX: kết quả cuối cùng "job đã nằm trong danh sách
 * lưu" giống hệt nhau, không cần hiện lỗi khó chịu cho hành động vô hại).
 */
export async function saveJob(
  jobId: string
): Promise<{ success: boolean; savedJob?: SavedJob; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${API_BASE}/me/saved-jobs`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ job_id: jobId }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.status === 409) {
        return { success: true };
      }
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        return {
          success: false,
          error: error.detail != null ? formatErrorDetail(error.detail) : 'Không thể lưu job này',
        };
      }
      const savedJob = await response.json();
      return { success: true, savedJob };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error saving job:', error);
    return { success: false, error: 'Network error' };
  }
}

/** Bỏ lưu job. */
export async function unsaveJob(jobId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${API_BASE}/me/saved-jobs/${jobId}`, {
        method: 'DELETE',
        headers: await getAuthHeaders(),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok && response.status !== 204) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        return {
          success: false,
          error: error.detail != null ? formatErrorDetail(error.detail) : 'Không thể bỏ lưu job này',
        };
      }
      return { success: true };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error unsaving job:', error);
    return { success: false, error: 'Network error' };
  }
}

/** Danh sách job đã lưu của CHÍNH học viên đang đăng nhập. */
export async function getMySavedJobs(): Promise<SavedJob[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${API_BASE}/me/saved-jobs`, {
        headers: await getAuthHeaders(),
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('Failed to fetch my saved jobs:', response.status, response.statusText);
        return [];
      }
      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error fetching my saved jobs:', error);
    return [];
  }
}

/**
 * Lấy signed URL để tải/xem CV — CHỈ dùng ở UI staff (role ss_team+),
 * KHÔNG lộ ở UI học viên (backend require_role("ss_team") ngay tại
 * route này, gọi từ học viên sẽ nhận 403).
 */
export async function getCvSignedUrl(
  applicationId: string
): Promise<{ success: boolean; signedUrl?: string; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${API_BASE}/me/applications/${applicationId}/cv-url`, {
        headers: await getAuthHeaders(),
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        return {
          success: false,
          error: error.detail != null ? formatErrorDetail(error.detail) : 'Không thể lấy link tải CV',
        };
      }
      const data = await response.json();
      return { success: true, signedUrl: data.signed_url };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error fetching CV signed URL:', error);
    return { success: false, error: 'Network error' };
  }
}
