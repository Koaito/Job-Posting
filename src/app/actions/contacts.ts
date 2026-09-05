'use server';

import { apiFetch, buildParams } from '@/lib/api/client';
import type {
  CompanyContact,
  CompanyContactWithCompany,
  ContactFilters,
  ContactCreatePayload,
  ContactUpdatePayload,
  ContactAssignPayload,
  ContactDeletePayload,
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
 *
 * REFACTOR (09/2026, "Đánh giá kiến trúc" #1+#2): dùng chung apiFetch()
 * (lib/api/client.ts) thay vì tự lặp AbortController/timeout/error-parsing
 * — formatErrorDetail() bản riêng ở đây (thiếu xử lý "loc") đã bị xoá,
 * dùng thẳng bản đầy đủ nhất từ lib/api/client.ts. Có auto-refresh
 * access_token khi 401 token_expired cho create/update/assign/delete.
 *
 * BUG FIX (09/2026, đi kèm refactor này): trước đây mọi chỗ gọi
 * formatErrorDetail() theo pattern `formatErrorDetail(error.detail) ||
 * fallback` — vì hàm này luôn trả string truthy, nhánh `|| fallback`
 * không bao giờ chạy được, thông báo lỗi cụ thể theo status code bị nuốt
 * mất. apiFetch() ở lib/api/client.ts đã tự làm đúng việc này (chỉ dùng
 * fallbackError khi `detail == null`), không cần mỗi hàm tự kiểm tra lại.
 */

/**
 * Danh sách contact GỘP TẤT CẢ công ty (kèm company_name) — dùng cho
 * trang "/contacts" tổng hợp. Gọi GET /contacts (KHÔNG lồng company_id
 * trong path — khác mọi hàm CRUD bên dưới).
 *
 * BUG FIX (09/2026): trước đây khai Promise<PaginatedContacts>
 * ({ total, limit, offset, items }) giống getCompanies()/getJobs(),
 * nhưng khác 2 hàm đó, backend GET /contacts (api/routers/contacts.py
 * ::list_all_contacts) KHÔNG có wrapper phân trang — response_model
 * là list[CompanyContactWithCompanyOut] trần, và endpoint không nhận
 * limit/offset (FastAPI âm thầm bỏ qua vì không khai trong signature).
 * page.tsx cũ destructure { items, total } từ 1 mảng → cả hai thành
 * undefined → contacts.length throw TypeError, sập cả trang. Sửa:
 * trả thẳng mảng, để page.tsx tự phân trang phía FE (slice).
 */
export async function getContacts(filters?: ContactFilters): Promise<CompanyContactWithCompany[]> {
  const params = buildParams({
    include_inactive: filters?.include_inactive,
    contact_status: filters?.contact_status,
    company_id: filters?.company_id,
    search: filters?.search,
    created_by: filters?.created_by,
    assigned_ss_user: filters?.assigned_ss_user,
  });

  const result = await apiFetch<CompanyContactWithCompany[]>(`/contacts?${params}`, { cache: 'no-store' });

  if (!result.success) {
    console.error('Failed to fetch contacts:', result.status, result.error);
    return [];
  }
  return result.data;
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
  const params = buildParams({ include_inactive: includeInactive });

  const result = await apiFetch<CompanyContact[]>(`/companies/${companyId}/contacts?${params}`, {
    cache: 'no-store',
  });

  if (!result.success) {
    console.error('Failed to fetch company contacts:', result.status, result.error);
    return [];
  }
  return result.data;
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
  const result = await apiFetch<CompanyContact>(`/companies/${companyId}/contacts`, {
    method: 'POST',
    body: data,
    fallbackError: 'Không thể thêm liên hệ',
  });

  if (!result.success) {
    console.error('Error creating contact:', result.status, result.error);
    return { success: false, error: result.error };
  }
  return { success: true, contact: result.data };
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
  const result = await apiFetch<CompanyContact>(`/companies/${companyId}/contacts/${contactId}`, {
    method: 'PATCH',
    body: data,
    fallbackError: 'Không thể cập nhật liên hệ',
  });

  if (!result.success) {
    console.error('Error updating contact:', result.status, result.error);
    return { success: false, error: result.error };
  }
  return { success: true, contact: result.data };
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
  const result = await apiFetch<CompanyContact>(`/companies/${companyId}/contacts/${contactId}/assign`, {
    method: 'PATCH',
    body: data,
    fallbackError: 'Không thể gán liên hệ',
  });

  if (!result.success) {
    console.error('Error assigning contact:', result.status, result.error);
    return { success: false, error: result.error };
  }
  return { success: true, contact: result.data };
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
  const result = await apiFetch<void>(`/companies/${companyId}/contacts/${contactId}`, {
    method: 'DELETE',
    body: payload,
    fallbackError: 'Không thể xoá liên hệ',
  });

  if (!result.success) {
    console.error('Error deleting contact:', result.status, result.error);
    return { success: false, error: result.error };
  }
  return { success: true };
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
  const result = await apiFetch<void>(`/companies/${companyId}/contacts/${contactId}/hard`, {
    method: 'DELETE',
    fallbackError: 'Không thể xoá vĩnh viễn liên hệ',
  });

  if (!result.success) {
    console.error('Error hard deleting contact:', result.status, result.error);
    return { success: false, error: result.error };
  }
  return { success: true };
}

/** CompanyContactWithCompany re-exported cho page.tsx dùng khi cần type danh sách gộp. */
export type { CompanyContactWithCompany };
