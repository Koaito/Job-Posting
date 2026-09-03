/**
 * Audit log types — bám đúng api/schemas/audit_logs.py (GET /audit-logs).
 * Dùng cho trang /activity (mới, trước đây chỉ có link trong Sidebar,
 * không có page.tsx — xem audit 09/2026 mục "4 route trắng").
 */

export interface AuditLogChange {
  old: unknown;
  new: unknown;
}

/** Khớp AuditLogOut. */
export interface AuditLog {
  log_id: string;
  actor_id?: string | null;
  actor_name?: string | null;
  action_type: string;
  entity_type: string; // JOB | COMPANY | CONTACT | APPLICATION
  entity_id: string;
  entity_label?: string | null;
  company_id?: string | null;
  company_name?: string | null;
  changes?: Record<string, AuditLogChange> | null;
  is_manual_log: boolean;
  note_required: boolean;
  note?: string | null;
  note_updated_by?: string | null;
  note_updated_at?: string | null;
  created_at: string;
}

/** Khớp query param thật của GET /audit-logs. */
export interface AuditLogFilters {
  view?: 'auto' | 'manual';
  entity_type?: string;
  company_id?: string;
  actor_id?: string;
  action_type?: string;
  pending_note?: boolean;
  limit?: number;
  offset?: number;
}

export interface PaginatedAuditLogs {
  total: number;
  limit: number;
  offset: number;
  items: AuditLog[];
}
