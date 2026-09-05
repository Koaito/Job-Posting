'use server';

import { apiFetchRaw, buildParams } from '@/lib/api/client';
import type {
  ImportExportEntityType,
  ExportFilters,
  ExportPreviewResult,
  ImportPreviewResult,
  ImportPreviewRow,
  ImportRowResolution,
  ImportConfirmSummary,
  ImportFieldError,
} from '@/types/import-export';

/**
 * Server Actions cho Import/Export (Phase 6.3, 09/2026).
 * Backend thật: Scrap_JD/api/routers/import_export.py — TOÀN BỘ route
 * require_role("ss_team") (ss_team + admin đều gọi được).
 *
 * CẬP NHẬT (đợt 2, sau Phase 6.3 MVP): đã bổ sung đủ 3 route resolve
 * tại chỗ còn thiếu ở đợt 1 — getCompanySuggestions(), verifyField(),
 * resolveCompany() — và confirmImport() giờ NHẬN THẲNG resolutions map
 * do UI tự xây (ImportPanel.tsx quyết định action/level_code/
 * confirm_reactivate cho từng dòng cần xử lý tay), KHÔNG còn tự động
 * skip mọi dòng không sạch như bản MVP trước.
 *
 * DỌN DEAD CODE (rà soát #3, 09/2026 — xem mục 6.10 plan_nextjs.md):
 * getCompanySuggestions() thêm ở đợt 2 nói trên hoá ra không nơi nào
 * gọi — UI resolve công ty dùng thẳng `company_resolution.suggestions`
 * có sẵn từ lúc build preview (getImportPreview()), không cần làm mới
 * riêng lẻ theo từng dòng. Đã xoá hàm này (giữ nguyên verifyField() +
 * resolveCompany(), cả 2 đều có UI gọi thật qua ImportPanel.tsx).
 *
 * REFACTOR (09/2026, "Đánh giá kiến trúc" #1+#2): dùng chung
 * apiFetchRaw() (lib/api/client.ts, KHÔNG dùng apiFetch() cấp cao hơn)
 * thay vì tự lặp AbortController/timeout/header 8 lần trong file này.
 * Dùng bản "Raw" (trả thẳng Response) vì file này có 2 nhu cầu đặc thù
 * mà apiFetch() (JSON-only) không đáp ứng được:
 *   - extractErrorInfo() bên dưới là định dạng lỗi RIÊNG của module này
 *     (kèm fileErrors[] khi validate file thất bại) — khác hẳn
 *     formatErrorDetail() dùng chung cho mọi module khác, vẫn giữ
 *     nguyên vì đây là nhu cầu THẬT của import (hiện lỗi theo từng
 *     dòng/field trong file upload), không phải trùng lặp cần dọn.
 *   - exportEntity() cần đọc BINARY (arrayBuffer), không phải JSON.
 * Vẫn được hưởng auto-refresh access_token khi 401 token_expired (trước
 * đây KHÔNG có, dù đây toàn là các thao tác ghi/xử lý nặng — file lớn,
 * dễ rơi đúng lúc access_token hết hạn giữa chừng) + timeout dùng
 * chung qua apiFetchRaw().
 *
 * LƯU Ý QUAN TRỌNG (đối chiếu import_executor.py thật, KHÔNG suy đoán):
 *   - Dòng "no_conflict" LUÔN được tạo mới bất kể resolutions gửi gì
 *     (Requirement 6.3) — KHÔNG cần gửi entry cho dòng này.
 *   - NGOẠI LỆ: nếu dòng "no_conflict" nhưng needs_level_resolve=true
 *     (Job, level_code trong file không hợp lệ), backend CHỈ kiểm tra
 *     level_code khi resolution.action != "skip" — nếu UI không gửi gì
 *     (action mặc định "skip" phía backend), dòng vẫn được tạo mới
 *     NHƯNG với level_code = NULL, không có bảo vệ nào chặn lại. Vì
 *     vậy buildImportResolutions() bên dưới LUÔN gửi resolution tường
 *     minh (action="create", level_code=<đã chọn>) cho MỌI dòng
 *     needs_level_resolve mà UI đã chọn level — nếu staff chưa chọn,
 *     gửi hẳn {action:"skip"} để CHẶN tạo dòng level rỗng, không để
 *     lọt qua nhánh mặc định nguy hiểm này.
 *   - Dòng "conflict_in_batch" BẮT BUỘC có entry tường minh (trực tiếp
 *     hoặc do lan truyền từ dòng kia) — thiếu là backend raise 422
 *     TRƯỚC KHI ghi gì (rollback sạch), nhưng ImportPanel vẫn tự chặn
 *     nút "Xác nhận" ở FE nếu còn dòng conflict_in_batch chưa chọn, để
 *     staff không mất công gửi rồi bị từ chối.
 *   - Dòng "pending_company_resolution" CHƯA được resolve qua modal
 *     (company_id vẫn null) mà backend không tìm thấy conflict mới với
 *     company tự tạo theo tên trong file → VẪN bị tạo mới dù resolution
 *     gửi action="skip" (xem nhánh `if status == "pending_company_
 *     resolution"` trong import_executor.py — action chỉ có tác dụng
 *     NẾU tái phát hiện conflict, không có tác dụng "skip tuyệt đối"
 *     như các status khác). Do quirk này, ImportPanel CHẶN xác nhận
 *     nếu còn dòng pending_company_resolution chưa resolve qua modal —
 *     KHÔNG cho "bỏ qua" dòng này bằng resolution, staff phải chọn
 *     công ty (hoặc xác nhận tạo mới) qua route resolve-company trước.
 */

/** Timeout dài hơn mức thường (60s) cho các route xử lý nặng phía backend
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
  return buildParams({
    status: filters?.status,
    is_active: filters?.is_active,
    company_id: filters?.company_id,
    date_field: filters?.date_field,
    from_date: filters?.from_date,
    to_date: filters?.to_date,
    limit: filters?.limit,
  });
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
    const response = await apiFetchRaw(`/export/${entityType}/preview?${params}`, {
      cache: 'no-store',
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      const { message } = extractErrorInfo(error.detail);
      return { success: false, error: message || 'Không thể xem trước dữ liệu export' };
    }
    const preview = await response.json();
    return { success: true, preview };
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

    const response = await apiFetchRaw(`/export/${entityType}?${params}`, {
      cache: 'no-store',
      timeoutMs: HEAVY_TIMEOUT_MS,
    });

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

    // Multipart — isUpload:true để apiFetchRaw() dùng getAuthHeadersForUpload()
    // (KHÔNG set sẵn Content-Type: application/json), để fetch() tự sinh
    // boundary đúng, cùng lý do đã ghi trong lib/api/client.ts.
    const response = await apiFetchRaw(`/import/${entityType}/preview`, {
      method: 'POST',
      body: formData,
      isUpload: true,
      timeoutMs: HEAVY_TIMEOUT_MS,
    });

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
    const response = await apiFetchRaw(`/import/${entityType}/preview/${previewId}`, {
      cache: 'no-store',
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

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
  } catch (error) {
    console.error('Error fetching import preview:', error);
    return { success: false, error: 'Network error' };
  }
}

// ------------------------------------------------------------------
// Import — bước 1b: resolve tại chỗ (verify-field / resolve-company)
// ------------------------------------------------------------------

/**
 * Staff sửa 1 ô lỗi trên bảng preview, bấm "Xác nhận" cạnh ô đó —
 * backend re-validate NGAY bằng đúng hàm dùng lúc build preview, lưu
 * thẳng vào preview đã lưu server-side nếu hợp lệ. field_error != null
 * nghĩa là VẪN lỗi (chưa lưu gì, hiện lỗi ngay tại ô) — row trả về khi
 * đó là undefined, component tự giữ nguyên state cũ.
 */
export async function verifyField(
  entityType: ImportExportEntityType,
  previewId: string,
  rowIndex: number,
  fieldName: string,
  value: string
): Promise<{
  success: boolean;
  row?: ImportPreviewRow;
  fieldError?: ImportFieldError | null;
  error?: string;
}> {
  try {
    const response = await apiFetchRaw(
      `/import/${entityType}/preview/${previewId}/rows/${rowIndex}/verify-field`,
      {
        method: 'POST',
        body: { field_name: fieldName, value },
        timeoutMs: DEFAULT_TIMEOUT_MS,
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      const { message } = extractErrorInfo(error.detail);
      return { success: false, error: message || 'Không thể xác nhận ô đã sửa' };
    }
    const data = await response.json();
    return { success: true, row: data.row, fieldError: data.field_error ?? null };
  } catch (error) {
    console.error('Error verifying field:', error);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Staff chọn 1 công ty (hoặc để trống = "Tạo công ty mới" theo tên
 * trong file) cho dòng pending_company_resolution — backend re-check
 * conflict NGAY với company_id thật vừa chọn, trả lại TOÀN BỘ entry
 * dòng đó sau cập nhật (conflict_status có thể đổi sang no_conflict/
 * conflict/conflict_inactive tuỳ kết quả re-check).
 */
export async function resolveCompany(
  entityType: ImportExportEntityType,
  previewId: string,
  rowIndex: number,
  companyId: string | null
): Promise<{ success: boolean; row?: ImportPreviewRow; error?: string }> {
  try {
    const response = await apiFetchRaw(
      `/import/${entityType}/preview/${previewId}/rows/${rowIndex}/resolve-company`,
      {
        method: 'POST',
        body: { company_id: companyId },
        timeoutMs: DEFAULT_TIMEOUT_MS,
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      const { message } = extractErrorInfo(error.detail);
      return { success: false, error: message || 'Không thể gán công ty cho dòng này' };
    }
    const data = await response.json();
    return { success: true, row: data.row };
  } catch (error) {
    console.error('Error resolving company:', error);
    return { success: false, error: 'Network error' };
  }
}

// ------------------------------------------------------------------
// Import — bước 2: confirm — resolutions do UI tự xây theo lựa chọn
// tường minh của staff (xem buildImportResolutions() ở ImportPanel.tsx)
// ------------------------------------------------------------------

export async function confirmImport(
  entityType: ImportExportEntityType,
  previewId: string,
  resolutions: Record<string, ImportRowResolution>,
  note: string
): Promise<{ success: boolean; result?: ImportConfirmSummary; error?: string }> {
  try {
    const response = await apiFetchRaw(`/import/${entityType}/confirm`, {
      method: 'POST',
      body: { preview_id: previewId, note, resolutions },
      timeoutMs: HEAVY_TIMEOUT_MS,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      const { message } = extractErrorInfo(error.detail);
      return { success: false, error: message || 'Không thể xác nhận import' };
    }

    const result = await response.json();
    return { success: true, result };
  } catch (error) {
    console.error('Error confirming import:', error);
    return { success: false, error: 'Network error' };
  }
}
