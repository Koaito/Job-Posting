'use server';

import { apiFetch } from '@/lib/api/client';
import type {
  Company,
  CompanyDetail,
  CompanyFilters,
  CompanyCreatePayload,
  CompanyUpdatePayload,
  CompanyDeletePayload,
  PaginatedCompanies,
} from '@/types/companies';

/**
 * Server Actions for Companies
 * Corresponds to Flask blueprint: blueprints/companies.py
 * Backend thật: api/routers/companies.py — GET công khai cho mọi role đã
 * đăng nhập, POST/PATCH/DELETE yêu cầu role 'ss_team' trở lên.
 *
 * BUG FIX (audit 09/2026): toàn bộ 5 hàm ở đây trước đây `throw new
 * Error('Not implemented')` — trang /companies gọi thẳng các hàm này
 * (không try/catch) nên sẽ crash trắng trang thay vì hiện lỗi gracefully.
 * Viết lại đầy đủ theo types/companies.ts (đã đúng sẵn, chỉ chưa ai dùng).
 *
 * REFACTOR (09/2026, "Đánh giá kiến trúc" #1+#2): dùng chung apiFetch()
 * (lib/api/client.ts) thay vì tự lặp AbortController/timeout/error-parsing
 * — formatErrorDetail() bản riêng ở đây (thiếu xử lý "loc") đã bị xoá,
 * dùng thẳng bản đầy đủ nhất từ lib/api/client.ts. Có auto-refresh
 * access_token khi 401 token_expired cho createCompany/updateCompany/
 * deleteCompany.
 */

/**
 * Get list of companies with filters and pagination.
 * Matches Flask: blueprints/companies.py::index()
 */
export async function getCompanies(filters?: CompanyFilters): Promise<PaginatedCompanies> {
  const fallback = { items: [], total: 0, limit: filters?.limit || 50, offset: filters?.offset || 0 };

  const params = new URLSearchParams();
  if (filters?.keyword) params.append('keyword', filters.keyword);
  if (filters?.province) params.append('province', filters.province);
  if (filters?.has_social !== undefined) params.append('has_social', String(filters.has_social));
  if (filters?.created_by) params.append('created_by', filters.created_by);
  if (filters?.include_inactive) params.append('include_inactive', String(filters.include_inactive));
  params.append('limit', String(filters?.limit || 50));
  params.append('offset', String(filters?.offset || 0));

  const result = await apiFetch<PaginatedCompanies>(`/companies?${params}`, { auth: false, cache: 'no-store' });

  if (!result.success) {
    console.error('Failed to fetch companies:', result.status, result.error);
    return fallback;
  }
  return result.data;
}

/**
 * Get single company by ID, kèm danh sách job của công ty đó
 * (CompanyDetailOut.jobs — GET /companies/{id} trả thẳng cả 2).
 * Matches Flask: blueprints/companies.py::detail()
 */
export async function getCompanyById(id: string): Promise<CompanyDetail | null> {
  const result = await apiFetch<CompanyDetail>(`/companies/${id}`, { auth: false, cache: 'no-store' });

  if (!result.success) {
    if (result.status !== 404) {
      console.error('Failed to fetch company:', result.status, result.error);
    }
    return null;
  }
  return result.data;
}

/**
 * Tạo công ty mới (thủ công) — yêu cầu role ss_team trở lên.
 * LƯU Ý: nếu tax_id/tên trùng công ty đã có, backend tự "dùng lại" công
 * ty cũ (idempotent) thay vì tạo trùng — vẫn trả success:true kèm công
 * ty đã có sẵn trong trường hợp đó, KHÔNG phải lỗi.
 */
export async function createCompany(
  data: CompanyCreatePayload
): Promise<{ success: boolean; company?: Company; error?: string }> {
  const result = await apiFetch<Company>('/companies', {
    method: 'POST',
    body: data,
    fallbackError: 'Không thể tạo công ty',
  });

  if (!result.success) {
    console.error('Error creating company:', result.status, result.error);
    return { success: false, error: result.error };
  }
  return { success: true, company: result.data };
}

/** Sửa công ty đã tồn tại — chỉ field có mặt trong body mới bị ghi đè. */
export async function updateCompany(
  id: string,
  data: CompanyUpdatePayload
): Promise<{ success: boolean; company?: CompanyDetail; error?: string }> {
  const result = await apiFetch<CompanyDetail>(`/companies/${id}`, {
    method: 'PATCH',
    body: data,
    fallbackError: 'Không thể cập nhật công ty',
  });

  if (!result.success) {
    console.error('Error updating company:', result.status, result.error);
    return { success: false, error: result.error };
  }
  return { success: true, company: result.data };
}

/**
 * Xoá mềm công ty (is_active=false) — note BẮT BUỘC (backend chặn cứng,
 * 422 nếu thiếu — xem CompanyDeleteRequest).
 */
export async function deleteCompany(
  id: string,
  payload: CompanyDeletePayload
): Promise<{ success: boolean; error?: string }> {
  const result = await apiFetch<void>(`/companies/${id}`, {
    method: 'DELETE',
    body: payload,
    fallbackError: 'Không thể xoá công ty',
  });

  if (!result.success) {
    console.error('Error deleting company:', result.status, result.error);
    return { success: false, error: result.error };
  }
  return { success: true };
}
