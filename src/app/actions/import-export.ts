'use server';

import { getAuthHeaders, getAuthHeadersForUpload } from '@/lib/api/client';
import type {
  ImportExportEntityType,
  ExportFilters,
  ExportPreviewResult,
  ImportPreviewResult,
  ImportPreviewRow,
  ImportConfirmSummary,
} from '@/types/import-export';

/**
 * Server Actions cho Import/Export (Phase 6.3, 09/2026).
 * Backend thật: Scrap_JD/api/routers/import_export.py — TOÀN BỘ route
 * require_role("ss_team") (ss_team + admin đều gọi được).
 *
 * SCOPE ĐỢT NÀY (MVP — xem types/import-export.ts để biết đầy đủ lý do):
 *   - Export: đủ 2 route (preview + tải file), có filter.
 *   - Import: upload -> preview -> confirm. confirmImport() tự sinh
 *     resolution "skip" cho MỌI dòng KHÔNG PHẢI no_conflict thuần tuý
 *     (còn conflict/cần resolve field/company/level) — CHƯA có UI sửa
 *     tại chỗ (verify-field/resolve-company/action lan truyền batch),
 *     những route đó CHƯA được gọi ở file này, để dành cho đợt sau.
 */

const API_BASE = process.env.FASTAPI_URL;

/** Timeout dài hơn mức thường (30s) cho các route xử lý nặng phía backend
 * (parse tới 5000 dòng + nhiều query DB đối chiếu công ty/job trùng —
 * xem docstring import_preview() ở router). */
const HEAVY_TIMEOUT_MS = 60000;
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Lỗi 422 ở đây có 2 dạng khác nhau tuỳ route:
 *  - Pydantic validate lỗi body (list of {msg,...}) — giống mọi action khác.
 *  - import_preview() tự raise detail={"message","errors":[...]} khi file
 *    có dòng không hợp lệ (validate_dataframe reject cả file) — dạng này
 *    cần giữ lại "errors" để hiện chi tiết từng dòng, không chỉ 1 câu chung.
 */
function extractErrorInfo(detail: unknown): {
  message: string;
  fileErrors?: Array<{ row_number: number; field_name: string; rule: string; message: string }>;
} {
  if (typeof detail === 'string') return { message: detail };
  if (Array.isArray(detail)) {
    return {
      message: detail
        .map((item) =>
          item && typeof item === 'object' && 'msg' in item
            ? String((item as { msg: unknown }).msg)
            : String(item)
        )
        .join('; '),
    };
  }
  if (detail && typeof detail === 'object' && 'message' in detail) {
    const d = detail as { message: unknown; errors?: unknown };
    return {
      message: String(d.message),
      fileErrors: Array.isArray(d.errors)
        ? (d.errors as Array<{ row_number: number; field_name: string; rule: string; message: string }>)
        : undefined,
    };
  }
  return { message: 'Có lỗi xảy ra' };
}

/** Gom query param filter export — dùng chung cho preview lẫn tải file,
 * khớp đúng _export_filter_params ở router (tránh lệch tên/param 2 nơi). */
function buildExportQueryParams(filters?: ExportFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.is_active !== undefined) params.append('is_active', String(filters.is_active));
  if (filters?.company_id) params.append('company_id', filters.company_id);
  if (filters?.date_field) params.append('date_field', filters.date_field);
  if (filters?.from_date) params.append('from_date', filters.from_date);
  if (filters?.to_date) params.append('to_date', filters.to_date);
  if (filters?.limit !== undefined) params.append('limit', String(filters.limit));
  return params;
}

// ------------------------------------------------------------------
// Export
// ------------------------------------------------------------------

/**
 * Xem trước số dòng sẽ xuất (đã áp filter) + mẫu tối đa 20 dòng, KHÔNG
 * sinh file — staff xem hình dạng dữ liệu trước khi bấm "Tải file".
 */
export async function getExportPreview(
  entityType: ImportExportEntityType,
  filters?: ExportFilters
): Promise<{ success: boolean; preview?: ExportPreviewResult; error?: string }> {
  try {
    const params = buildExportQueryParams(filters);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_BASE}/export/${entityType}/preview?${params}`, {
        headers: await getAuthHeaders(),
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        const { message } = extractErrorInfo(error.detail);
        return { success: false, error: message || 'Không thể xem trước dữ liệu export' };
      }
      const preview = await response.json();
      return { success: true, preview };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error fetching export preview:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Tải file export thật (csv|xlsx). Trả về nội dung dạng base64 thay vì
 * stream trực tiếp — giữ đúng "BFF qua Server Actions" đã dùng xuyên
 * suốt codebase (không thêm Route Handler riêng chỉ cho 1 việc này).
 * Component gọi hàm này ở client tự decode base64 -> Blob -> trigger
 * tải file bằng URL.createObjectURL (file export tối đa vài nghìn dòng,
 * base64 hoá không đáng ngại về kích thước).
 */
export async function exportEntity(
  entityType: ImportExportEntityType,
  format: 'csv' | 'xlsx',
  filters?: ExportFilters
): Promise<{
  success: boolean;
  filename?: string;
  contentType?: string;
  base64?: string;
  error?: string;
}> {
  try {
    const params = buildExportQueryParams(filters);
    params.append('format', format);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEAVY_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_BASE}/export/${entityType}?${params}`, {
        headers: await getAuthHeaders(),
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        const { message } = extractErrorInfo(error.detail);
        return { success: false, error: message || 'Không thể tải file export' };
      }

      const contentType = response.headers.get('content-type') || undefined;
      const disposition = response.headers.get('content-disposition') || '';
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch?.[1] || `${entityType}_export.${format}`;

      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');

      return { success: true, filename, contentType, base64 };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error exporting entity:', error);
    return { success: false, error: 'Network error' };
  }
}

// ------------------------------------------------------------------
// Import — bước 1: upload + xem preview
// ------------------------------------------------------------------

/**
 * Upload CSV/XLSX -> backend parse + validate + build preview (company
 * resolution, phát hiện trùng...) -> trả preview_id + rows + summary.
 * Rate limit backend: 20/hour theo user — 429 xử lý riêng, thông báo rõ
 * ràng thay vì rơi vào nhánh lỗi chung.
 */
export async function uploadImportFile(
  entityType: ImportExportEntityType,
  file: File
): Promise<{
  success: boolean;
  preview?: ImportPreviewResult;
  error?: string;
  fileErrors?: Array<{ row_number: number; field_name: string; rule: string; message: string }>;
}> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEAVY_TIMEOUT_MS);

    try {
      // Multipart — KHÔNG dùng getAuthHeaders() (set sẵn Content-Type:
      // application/json), phải để fetch() tự sinh boundary đúng, cùng lý
      // do đã ghi trong lib/api/client.ts::getAuthHeadersForUpload().
      const response = await fetch(`${API_BASE}/import/${entityType}/preview`, {
        method: 'POST',
        headers: await getAuthHeadersForUpload(),
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.status === 429) {
        return {
          success: false,
          error: 'Đã upload quá nhiều lần (giới hạn 20 lần/giờ) — vui lòng thử lại sau.',
        };
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        const { message, fileErrors } = extractErrorInfo(error.detail);
        return {
          success: false,
          error: message || 'Không thể xử lý file import',
          fileErrors,
        };
      }

      const preview = await response.json();
      return { success: true, preview };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error uploading import file:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Tải lại 1 preview đã lưu theo preview_id (vd sau khi reload trang).
 * Preview hết hạn sau 1 giờ (PREVIEW_TTL) — 410 báo rõ để staff biết cần
 * upload lại, khác 404 (preview không tồn tại/không thuộc về mình).
 */
export async function getImportPreview(
  entityType: ImportExportEntityType,
  previewId: string
): Promise<{ success: boolean; preview?: ImportPreviewResult; error?: string; expired?: boolean }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_BASE}/import/${entityType}/preview/${previewId}`, {
        headers: await getAuthHeaders(),
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.status === 410) {
        return { success: false, error: 'Preview đã hết hạn (quá 1 giờ) — vui lòng upload lại file.', expired: true };
      }
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        const { message } = extractErrorInfo(error.detail);
        return { success: false, error: message || 'Không tìm thấy preview này' };
      }

      const preview = await response.json();
      return { success: true, preview };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error fetching import preview:', error);
    return { success: false, error: 'Network error' };
  }
}

// ------------------------------------------------------------------
// Import — bước 2: confirm (MVP: auto-skip mọi dòng cần xử lý tay)
// ------------------------------------------------------------------

/**
 * MVP — CHƯA có UI sửa tại chỗ, nên với mọi dòng không phải "sạch hoàn
 * toàn" (no_conflict, không needs_field_fix, không needs_level_resolve),
 * tự gửi resolution {action:"skip"} tường minh:
 *   - An toàn cho conflict/conflict_inactive/pending_company_resolution/
 *     needs_field_fix/needs_level_resolve (Requirement 5.6: backend vốn
 *     đã mặc định Skip cho conflict thường nếu thiếu resolution, gửi
 *     tường minh ở đây cho NHẤT QUÁN, dễ đọc log, và đúng luôn cho các
 *     case backend KHÔNG tự mặc định).
 *   - BẮT BUỘC cho conflict_in_batch — backend raise lỗi 422 nếu thiếu
 *     resolution tường minh cho dòng này (xem import_executor.py), nên
 *     phải luôn gửi, không được bỏ sót.
 * Dòng no_conflict thuần tuý KHÔNG gửi gì — backend tự tạo mới
 * (Requirement 6.3), đúng luồng "confirm các dòng OK" đã chọn.
 */
function buildSkipResolutionsForUnresolvedRows(
  rows: ImportPreviewRow[]
): Record<string, { action: 'skip' }> {
  const resolutions: Record<string, { action: 'skip' }> = {};
  for (const row of rows) {
    const isClean =
      row.conflict_status === 'no_conflict' && !row.needs_field_fix && !row.needs_level_resolve;
    if (!isClean) {
      resolutions[String(row.row_index)] = { action: 'skip' };
    }
  }
  return resolutions;
}

export async function confirmImport(
  entityType: ImportExportEntityType,
  previewId: string,
  rows: ImportPreviewRow[],
  note: string
): Promise<{ success: boolean; result?: ImportConfirmSummary; error?: string }> {
  try {
    const resolutions = buildSkipResolutionsForUnresolvedRows(rows);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEAVY_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_BASE}/import/${entityType}/confirm`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ preview_id: previewId, note, resolutions }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        const { message } = extractErrorInfo(error.detail);
        return { success: false, error: message || 'Không thể xác nhận import' };
      }

      const result = await response.json();
      return { success: true, result };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('Error confirming import:', error);
    return { success: false, error: 'Network error' };
  }
}
