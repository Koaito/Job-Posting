import type {
  ImportExportEntityType,
  ImportPreviewRow,
  ImportRowResolution,
  ImportRowConflictStatus,
  ImportCompanySuggestion,
} from '@/types/import-export';

/**
 * Types + hằng số dùng chung cho các mảnh nhỏ tách ra từ ImportPanel.tsx
 * (rà soát kiến trúc 09/2026, mục #8 — ImportPanel gốc 732 dòng, 12
 * useState, 13 hàm xử lý, state phụ thuộc chéo nhau). Gom về 1 file để
 * UploadStep/ImportDoneCard/ImportRowRow/CompanyResolutionModal và
 * ImportPanel (orchestrator) dùng chung đúng 1 định nghĩa, không lặp
 * lại hoặc lệch nhau.
 */

export const STATUS_KEYS: Record<ImportRowConflictStatus, { key: string; tagClass: string }> = {
  no_conflict: { key: 'statusNew', tagClass: 'dm-tag-new' },
  conflict: { key: 'statusConflict', tagClass: 'dm-tag-conflict' },
  conflict_inactive: { key: 'statusConflictInactive', tagClass: 'dm-tag-inactive' },
  pending_company_resolution: { key: 'statusPendingCompany', tagClass: 'dm-tag-resolve' },
  conflict_in_batch: { key: 'statusConflictInBatch', tagClass: 'dm-tag-dup-warn' },
};

export const LEVEL_CODE_VALUES = ['Intern', 'Fresher', 'Junior', 'Middle', 'Senior', 'Lead', 'Manager'];

/** Vài cột chính hiển thị trên bảng preview cho dễ quét mắt (bảng đầy
 * đủ dữ liệu row.data có thể rất nhiều cột, nhất là Job — export_columns
 * thật có tới 16 cột, không phù hợp hiện hết ở bảng resolve nhanh này). */
export const DISPLAY_FIELDS: Record<ImportExportEntityType, string[]> = {
  job: ['job_title', 'company_name', 'level_code', 'deadline'],
  company: ['company_name', 'tax_id', 'industry'],
  contact: ['contact_name', 'company_name', 'work_email'],
};

export function isRowFullyClean(row: ImportPreviewRow): boolean {
  return row.conflict_status === 'no_conflict' && !row.needs_field_fix && !row.needs_level_resolve;
}

export function fieldKey(rowIndex: number, fieldName: string): string {
  return `${rowIndex}:${fieldName}`;
}

/** Trạng thái staff tự chọn cho 1 dòng (chưa gửi lên server) — dùng để
 * dựng resolutions thật lúc confirm. Không lưu field_fixes ở đây vì
 * field fix đã áp NGAY qua verifyField() (server-side), row.data cập
 * nhật trực tiếp, không cần gom lại gửi thêm ở bước confirm. */
export interface RowChoice {
  action?: ImportRowResolution['action'];
  confirmReactivate?: boolean;
  levelCode?: string;
}

export interface FieldFixState {
  draft: string;
  submitting: boolean;
  error: string | null;
}

export interface CompanyModalState {
  rowIndex: number;
  suggestions: ImportCompanySuggestion[];
  loading: boolean;
  error: string | null;
}
