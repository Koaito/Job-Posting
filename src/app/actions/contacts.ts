'use server';

import { cookies } from 'next/headers';
import { getApiKey } from '@/lib/api/client';
import type {
  CompanyContact,
  CompanyContactWithCompany,
  ContactFilters,
  ContactCreatePayload,
  ContactUpdatePayload,
  ContactAssignPayload,
  ContactDeletePayload,
  PaginatedContacts,
} from '@/types/contacts';

/**
 * Server Actions for Contacts (HR contact)
 * Corresponds to Flask blueprint: blueprints/contacts.py
 * Backend thật: api/routers/contacts.py — TOÀN BỘ route yêu cầu role
 * 'ss_team' trở lên (email/SĐT cá nhân, dữ liệu nhạy cảm, khác /jobs
 * và /companies vốn GET công khai cho mọi role đã đăng nhập).
 *
 * LƯU Ý ROUTE: backend có 2 router riêng biệt, KHÔNG phải 1:
 *   - GET /contacts (all_contacts_router, KHÔNG có company_id trong
 *     path) — danh sách GỘP mọi công ty, kèm company_name.
 *   - /companies/{company_id}/contacts/* (router lồng company) — GET
 *     theo 1 công ty, POST/PATCH/PATCH assign/DELETE/DELETE hard.
 * Trước đây file này là stub `throw new Error('Not implemented')` với
 * shape sai hoàn toàn (id: number, không có company_id) — viết lại
 * đúng theo types/contacts.ts (đã đúng sẵn, chỉ chưa ai dùng).
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
 * Danh sách contact GỘP TẤT CẢ công ty (kèm company_name) — dùng cho
 * trang "/contacts" tổng hợp. Gọi GET /contacts (KHÔNG lồng company_id
 * trong path — khác mọi hàm CRUD bên dưới).
 */
export async function getContacts(filters?: ContactFilters): Promise<PaginatedContacts> {
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;

  try {
    const params = new URLSearchParams();
    if (filters?.include_inactive) params.append('include_inactive', String(filters.include_inactive));
    if (filters?.contact_status) params.append('contact_status', filters.contact_status);
    if (filters?.company_id) params.append('company_id', filters.company_id);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.created_by) params.append('created_by', filters.created_by);
    if (filters?.assigned_ss_user) params.append('assigned_ss_user', filters.assigned_ss_user);
    params.append('limit', String(limit));
    params.append('offset', String(offset));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${API_BASE}/contacts?${params}`, {
        headers: await getAuthHeaders(),
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('Failed to fetch contacts:', response.status, response.statusText);
        return { total: 0, limit, offset, items: [] };
      }
      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return { total: 0, limit, offset, items: [] };
  }
}

/**
 * Danh sách contact của 1 công ty cụ thể — dùng cho tab "Liên hệ" ở
 * trang chi tiết công ty. Backend KHÔNG có GET /contacts/{contact_id}
 * đơn lẻ — chỉ có list theo company, xem CompanyContactOut (không có
 * company_name vì đã biết company_id sẵn từ path).
 */
export async function getContactsByCompany(
  companyId: string,
  includeInactive?: boolean
): Promise<CompanyContact[]> {
  try {
    const params = new URLSearchParams();
    if (includeInactive) params.append('include_inactive', String(includeInactive));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${API_BASE}/companies/${companyId}/contacts?${params}`, {
        headers: await getAuthHeaders(),
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('Failed to fetch company contacts:', response.status, response.statusText);
        return [];
      }
      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error fetching company contacts:', error);
    return [];
  }
}

/**
 * Thêm liên hệ HR cho 1 công ty. Chỉ contact_name bắt buộc — note ở
 * đây TUỲ CHỌN (khác update/assign/delete bên dưới, xem
 * CompanyContactCreate: CREATE_CONTACT không nằm trong nhóm chặn cứng
 * note, dù vẫn tính là log thủ công).
 */
export async function createContact(
  companyId: string,
  data: ContactCreatePayload
): Promise<{ success: boolean; contact?: CompanyContact; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${API_BASE}/companies/${companyId}/contacts`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        return { success: false, error: formatErrorDetail(error.detail) || 'Không thể thêm liên hệ' };
      }
      const contact = await response.json();
      return { success: true, contact };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error creating contact:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Sửa liên hệ HR. note BẮT BUỘC ở backend NẾU có field nào thực sự đổi
 * giá trị (422 nếu thiếu — xem CompanyContactUpdate) — FE không tự
 * validate trước, để backend là nguồn sự thật duy nhất (backend tự so
 * sánh giá trị cũ/mới, FE không biết trước điều đó).
 */
export async function updateContact(
  companyId: string,
  contactId: string,
  data: ContactUpdatePayload
): Promise<{ success: boolean; contact?: CompanyContact; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${API_BASE}/companies/${companyId}/contacts/${contactId}`, {
        method: 'PATCH',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        return { success: false, error: formatErrorDetail(error.detail) || 'Không thể cập nhật liên hệ' };
      }
      const contact = await response.json();
      return { success: true, contact };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error updating contact:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Gán/đổi/bỏ gán người phụ trách (assigned_ss_user) — route RIÊNG khỏi
 * updateContact() (xem docstring ContactAssignUpdate backend: pattern
 * "field != None mới ghi đè" của PATCH thường không phân biệt được
 * "không gửi field" với "cố ý set NULL để bỏ gán"). assigned_ss_user
 * LUÔN có mặt trong body (null hợp lệ = bỏ gán). note BẮT BUỘC nếu
 * người phụ trách thực sự đổi.
 */
export async function assignContact(
  companyId: string,
  contactId: string,
  data: ContactAssignPayload
): Promise<{ success: boolean; contact?: CompanyContact; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${API_BASE}/companies/${companyId}/contacts/${contactId}/assign`, {
        method: 'PATCH',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        return { success: false, error: formatErrorDetail(error.detail) || 'Không thể gán liên hệ' };
      }
      const contact = await response.json();
      return { success: true, contact };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error assigning contact:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Xoá MỀM (is_active=false), giữ lịch sử — note BẮT BUỘC (422 ngay từ
 * Pydantic nếu thiếu, không chạm DB). Gọi lại nhiều lần trên contact
 * đã ẩn vẫn trả 204, không lỗi.
 */
export async function deleteContact(
  companyId: string,
  contactId: string,
  payload: ContactDeletePayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${API_BASE}/companies/${companyId}/contacts/${contactId}`, {
        method: 'DELETE',
        headers: await getAuthHeaders(),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok && response.status !== 204) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        return { success: false, error: formatErrorDetail(error.detail) || 'Không thể xoá liên hệ' };
      }
      return { success: true };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error deleting contact:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Xoá THẬT, không thể khôi phục — chỉ dùng làm bước 2 SAU KHI contact
 * đã soft-delete (backend trả 409 nếu is_active vẫn true, ép đi đúng
 * luồng 2 bước). 409 nếu contact còn job_contact_links (không xoá được
 * do còn ràng buộc lịch sử với job cụ thể).
 */
export async function hardDeleteContact(
  companyId: string,
  contactId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${API_BASE}/companies/${companyId}/contacts/${contactId}/hard`, {
        method: 'DELETE',
        headers: await getAuthHeaders(),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok && response.status !== 204) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        return { success: false, error: formatErrorDetail(error.detail) || 'Không thể xoá vĩnh viễn liên hệ' };
      }
      return { success: true };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error hard deleting contact:', error);
    return { success: false, error: 'Network error' };
  }
}

/** CompanyContactWithCompany re-exported cho page.tsx dùng khi cần type danh sách gộp. */
export type { CompanyContactWithCompany };
