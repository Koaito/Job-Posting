'use server';

import { cookies } from 'next/headers';
import { getApiKey } from '@/lib/api/client';
import type { AuditLog, AuditLogFilters, PaginatedAuditLogs } from '@/types/audit';

/**
 * Server Actions for Audit Logs
 * Backend thật: api/routers/audit_logs.py — TOÀN BỘ route yêu cầu role
 * 'ss_team' trở lên (dữ liệu nội bộ team, giống /companies/{id}/contacts).
 *
 * Mới 09/2026 — trước đây trang /activity chỉ có link trong Sidebar,
 * KHÔNG có page.tsx (404 thật). types/audit.ts đã đúng sẵn từ đợt
 * trước, chưa ai dùng — cùng pattern "dead type file" đã gặp nhiều lần.
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

  try {
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${API_BASE}/audit-logs?${params}`, {
        headers: await getAuthHeaders(),
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('Failed to fetch audit logs:', response.status, response.statusText);
        return { total: 0, limit, offset, items: [] };
      }
      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return { total: 0, limit, offset, items: [] };
  }
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
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${API_BASE}/audit-logs/${logId}/note`, {
        method: 'PATCH',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ note }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        // BUG FIX (giống bug đã sửa ở actions/messages.ts::sendMessage):
        // formatErrorDetail() luôn trả string truthy nên `|| fallback`
        // không bao giờ chạy. Check error.detail != null trước.
        return {
          success: false,
          error: error.detail != null ? formatErrorDetail(error.detail) : 'Không thể cập nhật note',
        };
      }
      const log = await response.json();
      return { success: true, log };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error updating audit log note:', error);
    return { success: false, error: 'Network error' };
  }
}
