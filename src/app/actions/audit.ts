'use server';

import { apiFetch } from '@/lib/api/client';
import type { AuditLog, AuditLogFilters, PaginatedAuditLogs } from '@/types/audit';

/**
 * Server Actions for Audit Logs
 * Backend thật: api/routers/audit_logs.py — TOÀN BỘ route yêu cầu role
 * 'ss_team' trở lên (dữ liệu nội bộ team, giống /companies/{id}/contacts).
 *
 * REFACTOR (09/2026, "Đánh giá kiến trúc" #1+#2): dùng chung apiFetch()
 * (lib/api/client.ts) thay vì tự lặp AbortController/timeout/error-parsing
 * — formatErrorDetail() bản riêng (thiếu xử lý "loc") đã bị xoá, dùng
 * thẳng bản đầy đủ nhất từ lib/api/client.ts. Có auto-refresh
 * access_token khi 401 token_expired cho updateAuditLogNote.
 */

/**
 * Danh sách audit log — có 2 "chế độ xem" trên CÙNG 1 bảng dữ liệu qua
 * param view (KHÔNG phải 2 nguồn dữ liệu tách biệt, xem docstring
 * list_audit_logs() backend):
 *   - 'auto' (mặc định): TẤT CẢ thao tác, không có note.
 *   - 'manual': chỉ tập con hành động nhạy cảm (sửa/xoá JD, sửa/xoá
 *     company, mọi thao tác HR contact), kèm cột note.
 * pending_note chỉ có ý nghĩa khi view='manual' (backend tự bỏ qua nếu
 * view='auto', xem router — không cần FE tự lọc lại).
 */
export async function getAuditLogs(filters?: AuditLogFilters): Promise<PaginatedAuditLogs> {
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;

  const params = new URLSearchParams();
  params.append('view', filters?.view || 'auto');
  if (filters?.entity_type) params.append('entity_type', filters.entity_type);
  if (filters?.company_id) params.append('company_id', filters.company_id);
  if (filters?.actor_id) params.append('actor_id', filters.actor_id);
  if (filters?.action_type) params.append('action_type', filters.action_type);
  if (filters?.pending_note !== undefined) {
    params.append('pending_note', String(filters.pending_note));
  }
  params.append('limit', String(limit));
  params.append('offset', String(offset));

  const result = await apiFetch<PaginatedAuditLogs>(`/audit-logs?${params}`, { cache: 'no-store' });

  if (!result.success) {
    console.error('Failed to fetch audit logs:', result.status, result.error);
    return { total: 0, limit, offset, items: [] };
  }
  return result.data;
}

/**
 * Sửa note của 1 log đã tồn tại. QUYỀN kiểm ở backend: CHỈ actor_id GỐC
 * của log mới sửa được (403 nếu người khác gọi, kể cả admin) — 409 nếu
 * cố set về rỗng cho log note_required=true. FE không tự chặn 2
 * trường hợp này, để backend trả lỗi rõ ràng qua formatErrorDetail().
 */
export async function updateAuditLogNote(
  logId: string,
  note: string
): Promise<{ success: boolean; log?: AuditLog; error?: string }> {
  const result = await apiFetch<AuditLog>(`/audit-logs/${logId}/note`, {
    method: 'PATCH',
    body: { note },
    fallbackError: 'Không thể cập nhật note',
  });

  if (!result.success) {
    console.error('Error updating audit log note:', result.status, result.error);
    return { success: false, error: result.error };
  }
  return { success: true, log: result.data };
}
