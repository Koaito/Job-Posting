'use server';

import { apiFetch, apiFetchRaw, formatErrorDetail } from '@/lib/api/client';
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
 * REFACTOR (09/2026, "Đánh giá kiến trúc" #1+#2): dùng chung apiFetch()/
 * apiFetchRaw() (lib/api/client.ts) thay vì tự lặp AbortController/
 * timeout/error-parsing 7 lần trong file này — formatErrorDetail() bản
 * riêng (thiếu xử lý "loc") đã bị xoá, dùng thẳng bản đầy đủ nhất từ
 * lib/api/client.ts. Có auto-refresh access_token khi 401 token_expired
 * cho mọi thao tác ghi (apply/withdraw/save/unsave).
 */

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
 *
 * Dùng apiFetch() với isUpload:true thay vì apiFetchRaw() thô — body
 * FormData vẫn parse JSON kết quả bình thường như mọi response khác,
 * không cần xử lý đặc biệt gì thêm (khác saveJob() bên dưới, nơi 409
 * PHẢI được đọc riêng trước khi coi là lỗi).
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

  const formData = new FormData();
  formData.append('job_id', jobId);
  if (note) formData.append('note', note);
  formData.append('cv_file', cvFile);

  const result = await apiFetch<JobApplication>('/me/applications', {
    method: 'POST',
    body: formData,
    isUpload: true,
    fallbackError: 'Không thể ứng tuyển job này',
  });

  if (!result.success) {
    console.error('Error applying to job:', result.status, result.error);
    return { success: false, error: result.error };
  }
  return { success: true, application: result.data };
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
  const params = new URLSearchParams();
  if (note) params.append('note', note);
  const query = params.toString() ? `?${params}` : '';

  const result = await apiFetch<void>(`/me/applications/${jobId}${query}`, {
    method: 'DELETE',
    fallbackError: 'Không thể rút hồ sơ',
  });

  if (!result.success) {
    console.error('Error withdrawing application:', result.status, result.error);
    return { success: false, error: result.error };
  }
  return { success: true };
}

/** Danh sách đơn ứng tuyển của CHÍNH học viên đang đăng nhập. */
export async function getMyApplications(): Promise<JobApplication[]> {
  const result = await apiFetch<JobApplication[]>('/me/applications', { cache: 'no-store' });

  if (!result.success) {
    console.error('Failed to fetch my applications:', result.status, result.error);
    return [];
  }
  return result.data;
}

/**
 * Lưu job (bookmark) — body JSON {job_id}. 409 nếu đã lưu rồi (coi là
 * thành công về mặt UX: kết quả cuối cùng "job đã nằm trong danh sách
 * lưu" giống hệt nhau, không cần hiện lỗi khó chịu cho hành động vô hại).
 *
 * Dùng apiFetchRaw() thô (không phải apiFetch()) vì cần tự phân biệt
 * status 409 KHÔNG phải lỗi — apiFetch() sẽ coi mọi !ok là lỗi, không
 * phù hợp ở đây. Vẫn được hưởng auto-refresh + timeout dùng chung.
 */
export async function saveJob(
  jobId: string
): Promise<{ success: boolean; savedJob?: SavedJob; error?: string }> {
  try {
    const response = await apiFetchRaw('/me/saved-jobs', {
      method: 'POST',
      body: { job_id: jobId },
    });

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
  } catch (error) {
    console.error('Error saving job:', error);
    return { success: false, error: 'Network error' };
  }
}

/** Bỏ lưu job. */
export async function unsaveJob(jobId: string): Promise<{ success: boolean; error?: string }> {
  const result = await apiFetch<void>(`/me/saved-jobs/${jobId}`, {
    method: 'DELETE',
    fallbackError: 'Không thể bỏ lưu job này',
  });

  if (!result.success) {
    console.error('Error unsaving job:', result.status, result.error);
    return { success: false, error: result.error };
  }
  return { success: true };
}

/** Danh sách job đã lưu của CHÍNH học viên đang đăng nhập. */
export async function getMySavedJobs(): Promise<SavedJob[]> {
  const result = await apiFetch<SavedJob[]>('/me/saved-jobs', { cache: 'no-store' });

  if (!result.success) {
    console.error('Failed to fetch my saved jobs:', result.status, result.error);
    return [];
  }
  return result.data;
}

/**
 * Lấy signed URL để tải/xem CV — CHỈ dùng ở UI staff (role ss_team+),
 * KHÔNG lộ ở UI học viên (backend require_role("ss_team") ngay tại
 * route này, gọi từ học viên sẽ nhận 403).
 */
export async function getCvSignedUrl(
  applicationId: string
): Promise<{ success: boolean; signedUrl?: string; error?: string }> {
  const result = await apiFetch<{ signed_url: string }>(`/me/applications/${applicationId}/cv-url`, {
    cache: 'no-store',
    fallbackError: 'Không thể lấy link tải CV',
  });

  if (!result.success) {
    console.error('Error fetching CV signed URL:', result.status, result.error);
    return { success: false, error: result.error };
  }
  return { success: true, signedUrl: result.data.signed_url };
}
