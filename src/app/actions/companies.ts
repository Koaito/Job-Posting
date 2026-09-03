'use server';

import { cookies } from 'next/headers';
import { getApiKey } from '@/lib/api/client';
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
 * Get list of companies with filters and pagination.
 * Matches Flask: blueprints/companies.py::index()
 */
export async function getCompanies(filters?: CompanyFilters): Promise<PaginatedCompanies> {
  try {
    const params = new URLSearchParams();
    if (filters?.keyword) params.append('keyword', filters.keyword);
    if (filters?.province) params.append('province', filters.province);
    if (filters?.has_social !== undefined) params.append('has_social', String(filters.has_social));
    if (filters?.created_by) params.append('created_by', filters.created_by);
    if (filters?.include_inactive) params.append('include_inactive', String(filters.include_inactive));
    params.append('limit', String(filters?.limit || 50));
    params.append('offset', String(filters?.offset || 0));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${API_BASE}/companies?${params}`, {
        headers: { 'X-API-Key': getApiKey() },
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('Failed to fetch companies:', response.status, response.statusText);
        return { items: [], total: 0, limit: filters?.limit || 50, offset: filters?.offset || 0 };
      }
      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error fetching companies:', error);
    return { items: [], total: 0, limit: filters?.limit || 50, offset: filters?.offset || 0 };
  }
}

/**
 * Get single company by ID, kèm danh sách job của công ty đó
 * (CompanyDetailOut.jobs — GET /companies/{id} trả thẳng cả 2).
 * Matches Flask: blueprints/companies.py::detail()
 */
export async function getCompanyById(id: string): Promise<CompanyDetail | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${API_BASE}/companies/${id}`, {
        headers: { 'X-API-Key': getApiKey() },
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status !== 404) {
          console.error('Failed to fetch company:', response.status, response.statusText);
        }
        return null;
      }
      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error fetching company:', error);
    return null;
  }
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
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${API_BASE}/companies`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        return { success: false, error: formatErrorDetail(error.detail) || 'Không thể tạo công ty' };
      }
      const company = await response.json();
      return { success: true, company };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error creating company:', error);
    return { success: false, error: 'Network error' };
  }
}

/** Sửa công ty đã tồn tại — chỉ field có mặt trong body mới bị ghi đè. */
export async function updateCompany(
  id: string,
  data: CompanyUpdatePayload
): Promise<{ success: boolean; company?: CompanyDetail; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${API_BASE}/companies/${id}`, {
        method: 'PATCH',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        return { success: false, error: formatErrorDetail(error.detail) || 'Không thể cập nhật công ty' };
      }
      const company = await response.json();
      return { success: true, company };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error updating company:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Xoá mềm công ty (is_active=false) — note BẮT BUỘC (backend chặn cứng,
 * 422 nếu thiếu — xem CompanyDeleteRequest).
 */
export async function deleteCompany(
  id: string,
  payload: CompanyDeletePayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${API_BASE}/companies/${id}`, {
        method: 'DELETE',
        headers: await getAuthHeaders(),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok && response.status !== 204) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        return { success: false, error: formatErrorDetail(error.detail) || 'Không thể xoá công ty' };
      }
      return { success: true };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error deleting company:', error);
    return { success: false, error: 'Network error' };
  }
}
