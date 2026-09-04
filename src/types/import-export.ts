/**
 * Import/Export types — bám đúng Scrap_JD/api/schemas/import_export.py
 * (request/response) + cấu trúc JSONB preview_data mô tả ở đầu
 * Scrap_JD/api/services/preview_manager.py (KHÔNG có schema riêng phía
 * backend cho "1 row trong preview" — router khai response_model chỉ ở
 * mức ImportUploadResponse.rows: list[dict], nên type ImportPreviewRow
 * dưới đây là nguồn duy nhất phía FE, phải giữ khớp tay nếu backend đổi).
 *
 * Phase 6.3 (09/2026) — trước đây module này hoàn toàn chưa có ở
 * Next.js dù backend đã có sẵn 100% (xem rà soát tổng thể trong chat).
 *
 * SCOPE ĐỢT NÀY (MVP, theo lựa chọn của người dùng khi được hỏi mức độ):
 * upload -> xem preview/lỗi tổng quan -> confirm CÁC DÒNG "no_conflict"
 * (backend tự tạo mới, không cần gửi resolution). Dòng nào cần xử lý
 * tay (conflict/conflict_inactive/pending_company_resolution/
 * conflict_in_batch/needs_field_fix/needs_level_resolve) bị gửi
 * resolution "skip" tường minh (bắt buộc với conflict_in_batch, an toàn
 * cho các case còn lại) — KHÔNG có UI sửa tại chỗ, staff sửa file gốc
 * và upload lại. Type bên dưới vẫn khai đủ field thật (kể cả phần chưa
 * dùng ở MVP: field_errors, duplicate_match, duplicate_in_batch,
 * company_resolution.suggestions...) để phần build sau (resolve chi
 * tiết từng ô) không phải định nghĩa lại từ đầu.
 */

export type ImportExportEntityType = 'job' | 'company' | 'contact';

// ------------------------------------------------------------------
// Export — GET /export/{entity_type}/preview, GET /export/{entity_type}
// ------------------------------------------------------------------

/** Khớp _export_filter_params ở router — mọi field optional. */
export interface ExportFilters {
  status?: string; // job: job_status (OPEN/CLOSED). contact: contact_status.
  is_active?: boolean; // company/contact — job KHÔNG có field này (backend 400 nếu gửi).
  company_id?: string; // job/contact — company KHÔNG có field này (backend 400 nếu gửi).
  date_field?: 'created_at' | 'updated_at'; // mặc định 'created_at' phía backend nếu bỏ trống.
  from_date?: string; // YYYY-MM-DD, inclusive.
  to_date?: string; // YYYY-MM-DD, inclusive.
  limit?: number; // N dòng mới nhất, áp SAU các filter khác.
}

/** Khớp ExportPreviewResponse. */
export interface ExportPreviewResult {
  entity_type: ImportExportEntityType;
  total_matching: number;
  will_export: number;
  columns: string[];
  sample_rows: Record<string, unknown>[];
}

// ------------------------------------------------------------------
// Import — bước 1: upload + xem preview
// ------------------------------------------------------------------

/** Khớp preview_manager.py::build_preview() -> preview_data.summary. */
export interface ImportPreviewSummary {
  total_rows: number;
  new_records: number;
  conflicts: number;
  conflicts_inactive: number;
  pending_company_resolution: number;
  conflicts_in_batch: number;
  pending_level_resolution: number;
  pending_field_fix: number;
  id_field: string; // "job_id" | "company_id" | "contact_id"
}

export type ImportRowConflictStatus =
  | 'no_conflict'
  | 'conflict'
  | 'conflict_inactive'
  | 'pending_company_resolution'
  | 'conflict_in_batch';

/** {'rule','message','raw_value','widget_type','options'} — 1 field lỗi mềm (không chặn cả file). */
export interface ImportFieldError {
  rule:
    | 'required'
    | 'type_date'
    | 'type_number'
    | 'type_email'
    | 'business_rule_enum'
    | 'business_rule_non_negative'
    | 'business_rule_salary_range';
  message: string;
  raw_value: string | null;
  widget_type: 'enum' | 'date' | 'number' | 'email' | 'text';
  options?: string[] | null;
}

export interface ImportDuplicateMatch {
  match_score: number;
  matched_fields: string[];
}

export interface ImportBatchDuplicateMatch extends ImportDuplicateMatch {
  other_row_index: number;
}

export interface ImportCompanySuggestion {
  company_id: string;
  company_name: string;
  tax_id: string | null;
  is_active: boolean;
  similarity: number;
}

/** Chỉ có ở entity job/contact (company tự resolve theo chính nó). */
export interface ImportCompanyResolution {
  status: 'resolved' | 'needs_resolution';
  company_id: string | null;
  company_is_active: boolean | null;
  suggestions: ImportCompanySuggestion[];
}

/** 1 phần tử trong ImportUploadResponse.rows — xem docstring đầu file. */
export interface ImportPreviewRow {
  row_index: number;
  data: Record<string, unknown>;
  conflict_status: ImportRowConflictStatus;
  existing_record: Record<string, unknown> | null;
  duplicate_match: ImportDuplicateMatch | null;
  duplicate_in_batch: ImportBatchDuplicateMatch | null;
  company_resolution?: ImportCompanyResolution; // undefined cho entity company
  needs_field_fix: boolean;
  field_errors: Record<string, ImportFieldError>;
  // Chỉ Job — level_code trong file không khớp LEVEL_CODE_VALUES dù đã
  // chuẩn hoá hoa/thường (không nằm trong docstring JSONB gốc nhưng có
  // thật trong response — xem entity_specs.py::strict_enum_fields +
  // preview_manager.py build_preview()).
  needs_level_resolve?: boolean;
}

/** Khớp ImportUploadResponse — POST .../preview và GET .../preview/{id}. */
export interface ImportPreviewResult {
  preview_id: string;
  entity_type: ImportExportEntityType;
  summary: ImportPreviewSummary;
  rows: ImportPreviewRow[];
}

/** Khớp detail 422 trả về từ POST /import/{entity_type}/preview khi
 * validate_dataframe() reject cả file (lỗi cấu trúc, không phải lỗi
 * từng dòng dạng field_errors) — xem file_parser/validation_engine. */
export interface ImportFileRejectedError {
  message: string;
  errors: Array<{
    row_number: number;
    field_name: string;
    rule: string;
    message: string;
  }>;
}

// ------------------------------------------------------------------
// Import — bước 2: confirm
// ------------------------------------------------------------------

/**
 * Khớp RowResolution — MVP chỉ dùng action 'skip' (auto-generate, xem
 * actions/import-export.ts::buildAutoResolutions), nhưng khai đủ field
 * để module resolve chi tiết sau này dùng thẳng type này, không cần
 * định nghĩa lại.
 */
export interface ImportRowResolution {
  action:
    | 'skip'
    | 'create'
    | 'update'
    | 'keep_this' // chỉ hợp lệ cho dòng conflict_in_batch
    | 'keep_other'
    | 'import_both';
  company_id?: string | null;
  confirm_reactivate?: boolean;
  level_code?: string;
  field_fixes?: Record<string, string>;
}

/** Khớp ImportConfirmRequest. */
export interface ImportConfirmPayload {
  preview_id: string;
  note: string; // bắt buộc, min_length=1 (audit log)
  resolutions: Record<string, ImportRowResolution>; // key = row_index dạng string
}

/** Khớp ImportConfirmResult. */
export interface ImportConfirmSummary {
  created: number;
  updated: number;
  skipped: number;
}
