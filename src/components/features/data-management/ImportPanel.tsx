'use client';

import { useState } from 'react';
import {
  uploadImportFile,
  confirmImport,
  verifyField,
  resolveCompany,
  getImportPreview,
} from '@/app/actions/import-export';
import type {
  ImportExportEntityType,
  ImportPreviewResult,
  ImportPreviewRow,
  ImportRowResolution,
  ImportConfirmSummary,
  ImportRowConflictStatus,
  ImportCompanySuggestion,
} from '@/types/import-export';

/**
 * Import tab — đợt 2 (sau Phase 6.3 MVP): đủ resolve tại chỗ cho mọi
 * dòng cần xử lý tay, KHÔNG còn bắt staff sửa file gốc rồi upload lại:
 *   - needs_field_fix   -> sửa ngay tại ô (verify-field), re-validate
 *     tức thì, không đợi tới lúc confirm mới biết còn sai.
 *   - pending_company_resolution -> modal chọn công ty gợi ý sẵn
 *     (company_resolution.suggestions) hoặc xác nhận tạo công ty mới.
 *   - conflict / conflict_inactive -> radio Bỏ qua/Ghi đè, riêng
 *     conflict_inactive bắt buộc xác nhận "kích hoạt lại" mới cho Ghi đè.
 *   - conflict_in_batch (trùng ngay trong file) -> action lan truyền
 *     Skip/Create riêng từng dòng, hoặc 1 trong 3 nút gộp cho cả cặp
 *     (Giữ dòng này/Giữ dòng kia/Cả 2 đều đúng).
 *   - needs_level_resolve (chỉ Job) -> dropdown chọn lại level hợp lệ.
 * LƯU Ý quan trọng (đã ghi rõ trong actions/import-export.ts): dòng
 * "pending_company_resolution" KHÔNG có cách "bỏ qua an toàn" bằng
 * resolution — backend vẫn có thể tự tạo record với company mới theo
 * tên trong file nếu staff không resolve qua modal. Vì vậy nút "Xác
 * nhận import" bị khoá cứng nếu còn dòng loại này chưa resolve, không
 * có lựa chọn "bỏ qua" cho riêng case này.
 */

const STATUS_LABEL: Record<ImportRowConflictStatus, { text: string; tagClass: string }> = {
  no_conflict: { text: 'Mới', tagClass: 'dm-tag-new' },
  conflict: { text: 'Trùng dữ liệu đã có', tagClass: 'dm-tag-conflict' },
  conflict_inactive: { text: 'Trùng (bản ghi đã ngừng hoạt động)', tagClass: 'dm-tag-inactive' },
  pending_company_resolution: { text: 'Cần chọn công ty', tagClass: 'dm-tag-resolve' },
  conflict_in_batch: { text: 'Trùng với dòng khác trong file', tagClass: 'dm-tag-dup-warn' },
};

const LEVEL_CODE_VALUES = ['Intern', 'Fresher', 'Junior', 'Middle', 'Senior', 'Lead', 'Manager'];

/** Vài cột chính hiển thị trên bảng preview cho dễ quét mắt (bảng đầy
 * đủ dữ liệu row.data có thể rất nhiều cột, nhất là Job — export_columns
 * thật có tới 16 cột, không phù hợp hiện hết ở bảng resolve nhanh này). */
const DISPLAY_FIELDS: Record<ImportExportEntityType, string[]> = {
  job: ['job_title', 'company_name', 'level_code', 'deadline'],
  company: ['company_name', 'tax_id', 'industry'],
  contact: ['contact_name', 'company_name', 'work_email'],
};

function isRowFullyClean(row: ImportPreviewRow): boolean {
  return row.conflict_status === 'no_conflict' && !row.needs_field_fix && !row.needs_level_resolve;
}

/** Trạng thái staff tự chọn cho 1 dòng (chưa gửi lên server) — dùng để
 * dựng resolutions thật lúc confirm. Không lưu field_fixes ở đây vì
 * field fix đã áp NGAY qua verifyField() (server-side), row.data cập
 * nhật trực tiếp, không cần gom lại gửi thêm ở bước confirm. */
interface RowChoice {
  action?: ImportRowResolution['action'];
  confirmReactivate?: boolean;
  levelCode?: string;
}

interface FieldFixState {
  draft: string;
  submitting: boolean;
  error: string | null;
}

interface CompanyModalState {
  rowIndex: number;
  suggestions: ImportCompanySuggestion[];
  loading: boolean;
  error: string | null;
}

interface ImportPanelProps {
  entityType: ImportExportEntityType;
}

export default function ImportPanel({ entityType }: ImportPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileErrors, setFileErrors] = useState<
    Array<{ row_number: number; field_name: string; rule: string; message: string }> | undefined
  >();

  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [rowChoices, setRowChoices] = useState<Record<number, RowChoice>>({});
  const [fieldFixes, setFieldFixes] = useState<Record<string, FieldFixState>>({});
  const [companyModal, setCompanyModal] = useState<CompanyModalState | null>(null);
  const [resolvingCompany, setResolvingCompany] = useState(false);

  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmResult, setConfirmResult] = useState<ImportConfirmSummary | null>(null);

  function resetAll() {
    setFile(null);
    setUploadError(null);
    setFileErrors(undefined);
    setPreview(null);
    setRowChoices({});
    setFieldFixes({});
    setCompanyModal(null);
    setNote('');
    setConfirmError(null);
    setConfirmResult(null);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setFileErrors(undefined);
    setPreview(null);
    setRowChoices({});
    setFieldFixes({});
    setConfirmResult(null);

    const result = await uploadImportFile(entityType, file);
    setUploading(false);

    if (result.success && result.preview) {
      setPreview(result.preview);
    } else {
      setUploadError(result.error || 'Không thể xử lý file import');
      setFileErrors(result.fileErrors);
    }
  }

  /** Tải lại nguyên preview từ server — dùng sau verify-field, vì 1 lần
   * sửa có thể ảnh hưởng 2 CHIỀU (dòng đang sửa lẫn dòng conflict_in_batch
   * ghép với nó) mà response chỉ trả về đúng 1 dòng — xem docstring
   * FieldVerifyResponse ở backend. */
  async function refreshPreview() {
    if (!preview) return;
    setRefreshing(true);
    const result = await getImportPreview(entityType, preview.preview_id);
    setRefreshing(false);
    if (result.success && result.preview) {
      setPreview(result.preview);
    }
  }

  function updateRowChoice(rowIndex: number, patch: Partial<RowChoice>) {
    setRowChoices((prev) => ({ ...prev, [rowIndex]: { ...prev[rowIndex], ...patch } }));
  }

  function replaceRow(updatedRow: ImportPreviewRow) {
    setPreview((prev) =>
      prev
        ? { ...prev, rows: prev.rows.map((r) => (r.row_index === updatedRow.row_index ? updatedRow : r)) }
        : prev
    );
  }

  // ------------------------------------------------------------------
  // Sửa tại chỗ 1 ô lỗi (needs_field_fix)
  // ------------------------------------------------------------------

  function fieldKey(rowIndex: number, fieldName: string) {
    return `${rowIndex}:${fieldName}`;
  }

  function setFieldDraft(rowIndex: number, fieldName: string, draft: string) {
    const key = fieldKey(rowIndex, fieldName);
    setFieldFixes((prev) => ({
      ...prev,
      [key]: { draft, submitting: prev[key]?.submitting ?? false, error: null },
    }));
  }

  async function handleVerifyField(row: ImportPreviewRow, fieldName: string) {
    if (!preview) return;
    const key = fieldKey(row.row_index, fieldName);
    const draft = fieldFixes[key]?.draft ?? String(row.data[fieldName] ?? '');

    setFieldFixes((prev) => ({ ...prev, [key]: { draft, submitting: true, error: null } }));

    const result = await verifyField(entityType, preview.preview_id, row.row_index, fieldName, draft);

    if (!result.success) {
      setFieldFixes((prev) => ({
        ...prev,
        [key]: { draft, submitting: false, error: result.error || 'Không thể xác nhận' },
      }));
      return;
    }
    if (result.fieldError) {
      setFieldFixes((prev) => ({
        ...prev,
        [key]: { draft, submitting: false, error: result.fieldError!.message },
      }));
      return;
    }
    // Đã lưu thành công — xoá draft cục bộ (row mới đã có giá trị đúng),
    // rồi tải lại NGUYÊN preview để bắt kịp hiệu ứng 2 chiều (dòng kia
    // bị ảnh hưởng nếu vừa phát hiện trùng trong batch).
    setFieldFixes((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    if (result.row) replaceRow(result.row);
    await refreshPreview();
  }

  // ------------------------------------------------------------------
  // Modal chọn công ty (pending_company_resolution)
  // ------------------------------------------------------------------

  function openCompanyModal(row: ImportPreviewRow) {
    setCompanyModal({
      rowIndex: row.row_index,
      suggestions: row.company_resolution?.suggestions ?? [],
      loading: false,
      error: null,
    });
  }

  async function handleChooseCompany(companyId: string | null) {
    if (!preview || !companyModal) return;
    setResolvingCompany(true);
    const result = await resolveCompany(entityType, preview.preview_id, companyModal.rowIndex, companyId);
    setResolvingCompany(false);

    if (!result.success) {
      setCompanyModal((prev) => (prev ? { ...prev, error: result.error || 'Không thể gán công ty' } : prev));
      return;
    }
    if (result.row) replaceRow(result.row);
    setCompanyModal(null);
  }

  // ------------------------------------------------------------------
  // Confirm — dựng resolutions thật từ lựa chọn của staff
  // ------------------------------------------------------------------

  /** Dòng conflict_in_batch còn thiếu lựa chọn (chưa chọn action, và
   * cũng chưa được "điền hộ" bởi action lan truyền của dòng ghép cặp
   * kia — kiểm tra 2 chiều để không chặn nhầm dòng đã được dòng kia lo
   * xong bằng keep_this/keep_other/import_both). */
  function missingBatchChoiceRows(rows: ImportPreviewRow[]): ImportPreviewRow[] {
    const propagating = new Set(['keep_this', 'keep_other', 'import_both']);
    return rows.filter((row) => {
      if (row.conflict_status !== 'conflict_in_batch') return false;
      const own = rowChoices[row.row_index]?.action;
      if (own) return false;
      const otherIndex = row.duplicate_in_batch?.other_row_index;
      if (otherIndex === undefined) return false;
      const otherAction = rowChoices[otherIndex]?.action;
      return !(otherAction && propagating.has(otherAction));
    });
  }

  function pendingCompanyRows(rows: ImportPreviewRow[]): ImportPreviewRow[] {
    return rows.filter((row) => row.conflict_status === 'pending_company_resolution');
  }

  function buildResolutions(rows: ImportPreviewRow[]): Record<string, ImportRowResolution> {
    const resolutions: Record<string, ImportRowResolution> = {};

    for (const row of rows) {
      const choice = rowChoices[row.row_index];

      // Dòng needs_level_resolve (chỉ Job) — KHÔNG bao giờ để lọt qua
      // nhánh mặc định "skip -> vẫn tạo mới với level NULL" của backend
      // (xem ghi chú trong actions/import-export.ts): chỉ "create" khi
      // staff đã chọn level rõ ràng, còn lại LUÔN gửi tường minh "skip".
      if (row.needs_level_resolve) {
        if (choice?.levelCode) {
          resolutions[String(row.row_index)] = { action: 'create', level_code: choice.levelCode };
        } else {
          resolutions[String(row.row_index)] = { action: 'skip' };
        }
        continue;
      }

      if (row.conflict_status === 'no_conflict') continue; // backend tự tạo mới, không cần gửi gì

      if (row.conflict_status === 'conflict_in_batch') {
        const action = choice?.action;
        if (action) resolutions[String(row.row_index)] = { action };
        continue;
      }

      if (row.conflict_status === 'pending_company_resolution') {
        // Đã chặn confirm nếu còn dòng loại này (xem pendingCompanyRows),
        // nên tới đây coi như không còn tồn tại — bỏ qua nếu lọt qua.
        continue;
      }

      // conflict / conflict_inactive
      const action = choice?.action ?? 'skip';
      const resolution: ImportRowResolution = { action };
      if (row.conflict_status === 'conflict_inactive' && action === 'update') {
        resolution.confirm_reactivate = Boolean(choice?.confirmReactivate);
      }
      resolutions[String(row.row_index)] = resolution;
    }

    return resolutions;
  }

  async function handleConfirm() {
    if (!preview) return;
    if (!note.trim()) {
      setConfirmError('Ghi chú là bắt buộc (dùng cho audit log).');
      return;
    }
    setConfirming(true);
    setConfirmError(null);

    const resolutions = buildResolutions(preview.rows);
    const result = await confirmImport(entityType, preview.preview_id, resolutions, note.trim());
    setConfirming(false);

    if (result.success && result.result) {
      setConfirmResult(result.result);
    } else {
      setConfirmError(result.error || 'Không thể xác nhận import');
    }
  }

  if (!preview) {
    return (
      <div>
        <div className="dm-import-upload-card">
          <h2>Upload file để import</h2>
          <p className="dm-hint">
            Chấp nhận CSV/XLSX, tối đa 5000 dòng. Cột phải khớp đúng tên trường trong DB — tải thử 1
            file export cùng entity này ở tab Export để biết đúng định dạng cột.
          </p>

          <label className="dm-file-label">
            Chọn file
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>

          {uploadError && (
            <p style={{ color: '#B23A22', fontSize: '13.5px', marginBottom: '10px' }}>{uploadError}</p>
          )}

          {fileErrors && fileErrors.length > 0 && (
            <ul className="dm-hint-list" style={{ marginBottom: '14px' }}>
              {fileErrors.slice(0, 20).map((err, idx) => (
                <li key={idx}>
                  Dòng {err.row_number}, cột &quot;{err.field_name}&quot;: {err.message}
                </li>
              ))}
              {fileErrors.length > 20 && <li>… và {fileErrors.length - 20} lỗi khác trong file.</li>}
            </ul>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn-primary" onClick={handleUpload} disabled={!file || uploading}>
              {uploading ? 'Đang xử lý…' : 'Tải lên & xem trước'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (confirmResult) {
    return (
      <div className="dm-import-upload-card">
        <h2>Import xong</h2>
        <p className="dm-hint">
          Đã tạo mới <strong>{confirmResult.created}</strong> bản ghi
          {confirmResult.updated > 0 && <> — ghi đè {confirmResult.updated} bản ghi</>}
          {confirmResult.skipped > 0 && <> — bỏ qua {confirmResult.skipped} dòng</>}.
        </p>
        <div className="form-actions">
          <button type="button" className="btn btn-primary" onClick={resetAll}>
            Import file khác
          </button>
        </div>
      </div>
    );
  }

  const cleanCount = preview.rows.filter(isRowFullyClean).length;
  const flaggedCount = preview.rows.length - cleanCount;
  const missingBatchRows = missingBatchChoiceRows(preview.rows);
  const pendingCompany = pendingCompanyRows(preview.rows);
  const blockedReasons: string[] = [];
  if (pendingCompany.length > 0) blockedReasons.push(`${pendingCompany.length} dòng chưa chọn công ty`);
  if (missingBatchRows.length > 0) blockedReasons.push(`${missingBatchRows.length} dòng trùng trong file chưa chọn xử lý`);
  const confirmBlocked = blockedReasons.length > 0;

  return (
    <div>
      <div className="dm-preview-summary">
        <div className="dm-stat">
          <strong>{preview.summary.total_rows}</strong>
          <span>Tổng số dòng</span>
        </div>
        <div className="dm-stat dm-stat-new">
          <strong>{cleanCount}</strong>
          <span>Sẽ tạo mới ngay</span>
        </div>
        <div className="dm-stat dm-stat-conflict">
          <strong>{preview.summary.conflicts}</strong>
          <span>Trùng dữ liệu</span>
        </div>
        <div className="dm-stat dm-stat-inactive">
          <strong>{preview.summary.conflicts_inactive}</strong>
          <span>Trùng (đã ngừng)</span>
        </div>
        <div className="dm-stat dm-stat-resolve">
          <strong>{preview.summary.pending_company_resolution}</strong>
          <span>Cần chọn công ty</span>
        </div>
        <div className="dm-stat dm-stat-level-resolve">
          <strong>{preview.summary.pending_level_resolution}</strong>
          <span>Cần chọn level</span>
        </div>
        <div className="dm-stat dm-stat-fix">
          <strong>{preview.summary.pending_field_fix}</strong>
          <span>Lỗi định dạng</span>
        </div>
      </div>

      {flaggedCount > 0 && (
        <p className="dm-hint">
          {flaggedCount} dòng cần xử lý tay — sửa/chọn ngay tại bảng bên dưới, không cần sửa file gốc.
          {refreshing && ' (đang tải lại preview…)'}
        </p>
      )}

      <div className="dm-table-wrap">
        <table className="dm-preview-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Trạng thái</th>
              {DISPLAY_FIELDS[entityType].map((f) => (
                <th key={f}>{f}</th>
              ))}
              <th>Xử lý</th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row) => {
              const clean = isRowFullyClean(row);
              const statusInfo = STATUS_LABEL[row.conflict_status];
              const choice = rowChoices[row.row_index];

              return (
                <tr key={row.row_index} className={clean ? '' : 'dm-row-flag'}>
                  <td>{row.row_index + 1}</td>
                  <td>
                    <span className={`dm-tag ${statusInfo.tagClass}`}>{statusInfo.text}</span>
                    {row.needs_field_fix && (
                      <div>
                        <span className="dm-tag dm-tag-fix">Lỗi định dạng</span>
                      </div>
                    )}
                    {row.needs_level_resolve && (
                      <div>
                        <span className={`dm-tag ${choice?.levelCode ? 'dm-tag-level-ok' : 'dm-tag-level'}`}>
                          {choice?.levelCode ? `Level: ${choice.levelCode}` : 'Cần chọn level'}
                        </span>
                      </div>
                    )}
                  </td>

                  {DISPLAY_FIELDS[entityType].map((f) => {
                    const fieldError = row.field_errors?.[f];
                    if (!fieldError) {
                      return <td key={f}>{String(row.data[f] ?? '')}</td>;
                    }
                    const key = fieldKey(row.row_index, f);
                    const fixState = fieldFixes[key];
                    const draft = fixState?.draft ?? String(row.data[f] ?? '');
                    return (
                      <td key={f} className="dm-cell-field-fix">
                        <div className="dm-field-fix">
                          <p className="dm-field-error-note">{fieldError.message}</p>
                          <div className="dm-field-fix-row">
                            {fieldError.widget_type === 'enum' && fieldError.options ? (
                              <select
                                className="dm-field-select"
                                value={draft}
                                onChange={(e) => setFieldDraft(row.row_index, f, e.target.value)}
                              >
                                <option value="">— chọn —</option>
                                {fieldError.options.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                className="dm-field-input"
                                type={fieldError.widget_type === 'date' ? 'text' : fieldError.widget_type === 'number' ? 'number' : 'text'}
                                value={draft}
                                placeholder={fieldError.widget_type === 'date' ? 'YYYY-MM-DD' : undefined}
                                onChange={(e) => setFieldDraft(row.row_index, f, e.target.value)}
                              />
                            )}
                            <button
                              type="button"
                              className="dm-btn-verify-field"
                              disabled={fixState?.submitting}
                              onClick={() => handleVerifyField(row, f)}
                            >
                              {fixState?.submitting ? '…' : 'Xác nhận'}
                            </button>
                          </div>
                          {fixState?.error && (
                            <p className="dm-field-verify-note dm-field-verify-error">{fixState.error}</p>
                          )}
                        </div>
                      </td>
                    );
                  })}

                  <td>
                    {clean ? (
                      <span style={{ color: '#2E8B57', fontWeight: 500 }}>Sẽ tạo mới</span>
                    ) : row.conflict_status === 'pending_company_resolution' ? (
                      <div className="dm-resolve-block">
                        <span className="dm-resolve-current dm-resolve-pending">Chưa chọn công ty</span>
                        <span className="dm-resolve-raw">Trong file: {String(row.data.company_name ?? '')}</span>
                        <button type="button" className="btn btn-ghost dm-btn-choose-company" onClick={() => openCompanyModal(row)}>
                          Chọn công ty…
                        </button>
                      </div>
                    ) : row.conflict_status === 'conflict_in_batch' ? (
                      <div className="dm-action-radios">
                        <span className="dm-dup-detail">
                          Trùng với dòng {(row.duplicate_in_batch?.other_row_index ?? -1) + 1} trong file
                          ({Math.round((row.duplicate_in_batch?.match_score ?? 0) * 100)}% khớp:{' '}
                          {row.duplicate_in_batch?.matched_fields.join(', ')})
                        </span>
                        {[
                          ['skip', 'Bỏ qua dòng này'],
                          ['create', 'Vẫn tạo dòng này'],
                          ['keep_this', 'Giữ dòng này, bỏ dòng kia'],
                          ['keep_other', 'Giữ dòng kia, bỏ dòng này'],
                          ['import_both', 'Cả 2 đều đúng — giữ cả 2'],
                        ].map(([value, label]) => (
                          <label key={value} className="dm-radio-opt">
                            <input
                              type="radio"
                              name={`batch-${row.row_index}`}
                              checked={choice?.action === value}
                              onChange={() => updateRowChoice(row.row_index, { action: value as ImportRowResolution['action'] })}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    ) : row.conflict_status === 'conflict' || row.conflict_status === 'conflict_inactive' ? (
                      <div className="dm-action-radios">
                        <label className="dm-radio-opt">
                          <input
                            type="radio"
                            name={`conflict-${row.row_index}`}
                            checked={(choice?.action ?? 'skip') === 'skip'}
                            onChange={() => updateRowChoice(row.row_index, { action: 'skip' })}
                          />
                          Bỏ qua dòng này
                        </label>
                        <label className="dm-radio-opt">
                          <input
                            type="radio"
                            name={`conflict-${row.row_index}`}
                            checked={choice?.action === 'update'}
                            onChange={() => updateRowChoice(row.row_index, { action: 'update' })}
                          />
                          Ghi đè bản ghi đã có
                        </label>
                        {row.conflict_status === 'conflict_inactive' && choice?.action === 'update' && (
                          <div className="dm-inactive-confirm">
                            <span className="dm-inactive-warn">Bản ghi đã ngừng hoạt động — ghi đè sẽ kích hoạt lại.</span>
                            <div className="dm-inactive-btns">
                              <button
                                type="button"
                                className={`btn ${choice?.confirmReactivate ? 'active' : ''}`}
                                onClick={() => updateRowChoice(row.row_index, { confirmReactivate: true })}
                              >
                                Xác nhận kích hoạt lại
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : row.needs_level_resolve ? (
                      <span className="dm-action-fixed">Chọn level ở cột bên trái để tạo mới</span>
                    ) : (
                      <span className="dm-action-fixed">Sửa ô lỗi ở trên để tạo mới</span>
                    )}

                    {row.needs_level_resolve && (
                      <select
                        className="dm-level-select"
                        value={choice?.levelCode ?? ''}
                        onChange={(e) => updateRowChoice(row.row_index, { levelCode: e.target.value || undefined })}
                        style={{ marginTop: '6px' }}
                      >
                        <option value="">— chọn level —</option>
                        {LEVEL_CODE_VALUES.map((lvl) => (
                          <option key={lvl} value={lvl}>
                            {lvl}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div id="dm-confirm-form">
        {confirmBlocked && (
          <p id="dm-confirm-blocked-hint" style={{ display: 'block' }}>
            Chưa thể xác nhận — còn {blockedReasons.join(' và ')}.
          </p>
        )}

        <label className="dm-note-label">
          Ghi chú lần import này <span className="dm-required">*</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Bắt buộc — lưu vào audit log, vd: 'Import job từ đợt crawl tháng 9'"
          />
        </label>

        {confirmError && (
          <p style={{ color: '#B23A22', fontSize: '13.5px', marginTop: '10px' }}>{confirmError}</p>
        )}

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={resetAll} disabled={confirming}>
            Huỷ, chọn file khác
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={confirming || confirmBlocked}
          >
            {confirming ? 'Đang xác nhận…' : 'Xác nhận import'}
          </button>
        </div>
      </div>

      {/* Modal chọn công ty */}
      <div className="dm-modal-overlay" hidden={!companyModal}>
        {companyModal && (
          <div className="dm-modal">
            <div className="dm-modal-head">
              <h3>Chọn công ty</h3>
              <button type="button" className="dm-modal-close" onClick={() => setCompanyModal(null)}>
                ×
              </button>
            </div>
            <div className="dm-modal-body">
              <p className="dm-modal-hint">
                Dòng {companyModal.rowIndex + 1} — công ty trong file:{' '}
                {String(preview.rows.find((r) => r.row_index === companyModal.rowIndex)?.data.company_name ?? '')}
              </p>
              {companyModal.error && <p className="dm-modal-error">{companyModal.error}</p>}
              {companyModal.suggestions.length > 0 ? (
                <ul className="dm-modal-suggestion-list">
                  {companyModal.suggestions.map((s) => (
                    <li key={s.company_id}>
                      <button
                        type="button"
                        className="dm-modal-suggestion"
                        disabled={resolvingCompany}
                        onClick={() => handleChooseCompany(s.company_id)}
                      >
                        <span className="dm-modal-suggestion-name">
                          {s.company_name}
                          {!s.is_active && ' (đã ngừng hoạt động)'}
                        </span>
                        {s.tax_id && <span className="dm-modal-suggestion-tax">MST: {s.tax_id}</span>}
                        <span className="dm-modal-suggestion-score">{Math.round(s.similarity * 100)}%</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="dm-modal-hint">Không tìm thấy công ty nào gần giống trong hệ thống.</p>
              )}
              <button
                type="button"
                className="dm-modal-create-new"
                disabled={resolvingCompany}
                onClick={() => handleChooseCompany(null)}
              >
                {resolvingCompany ? 'Đang xử lý…' : '+ Tạo công ty mới theo tên trong file'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
