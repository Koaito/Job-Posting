'use client';

import { useState } from 'react';
import { uploadImportFile, confirmImport } from '@/app/actions/import-export';
import type {
  ImportExportEntityType,
  ImportPreviewResult,
  ImportPreviewRow,
  ImportConfirmSummary,
  ImportRowConflictStatus,
} from '@/types/import-export';

/**
 * Import tab — MVP (xem docstring actions/import-export.ts::confirmImport
 * để biết đầy đủ lý do phạm vi): upload -> xem preview/lỗi tổng quan ->
 * confirm CHỈ tạo mới dòng "sạch" (no_conflict, không needs_field_fix,
 * không needs_level_resolve). Dòng còn lại hiển thị rõ lý do + hướng dẫn
 * sửa file gốc rồi upload lại — CHƯA có UI sửa tại chỗ/chọn công ty/xử
 * lý trùng trong file (để dành đợt sau, xem 13-data-management.css đã
 * có sẵn class cho cả phần đó).
 */

const STATUS_LABEL: Record<ImportRowConflictStatus, { text: string; tagClass: string }> = {
  no_conflict: { text: 'Mới', tagClass: 'dm-tag-new' },
  conflict: { text: 'Trùng dữ liệu đã có', tagClass: 'dm-tag-conflict' },
  conflict_inactive: { text: 'Trùng (bản ghi đã ngừng hoạt động)', tagClass: 'dm-tag-inactive' },
  pending_company_resolution: { text: 'Cần chọn công ty', tagClass: 'dm-tag-resolve' },
  conflict_in_batch: { text: 'Trùng với dòng khác trong file', tagClass: 'dm-tag-dup-warn' },
};

/** Vài cột chính hiển thị trên bảng preview cho dễ quét mắt (bảng đầy
 * đủ dữ liệu row.data có thể rất nhiều cột, nhất là Job — export_columns
 * thật có tới 16 cột, không phù hợp hiện hết ở bảng resolve nhanh này). */
const DISPLAY_FIELDS: Record<ImportExportEntityType, string[]> = {
  job: ['job_title', 'company_name', 'level_code', 'deadline'],
  company: ['company_name', 'tax_id', 'industry'],
  contact: ['contact_name', 'company_name', 'work_email'],
};

function isRowClean(row: ImportPreviewRow): boolean {
  return row.conflict_status === 'no_conflict' && !row.needs_field_fix && !row.needs_level_resolve;
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

  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmResult, setConfirmResult] = useState<ImportConfirmSummary | null>(null);

  function resetAll() {
    setFile(null);
    setUploadError(null);
    setFileErrors(undefined);
    setPreview(null);
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

  async function handleConfirm() {
    if (!preview) return;
    if (!note.trim()) {
      setConfirmError('Ghi chú là bắt buộc (dùng cho audit log).');
      return;
    }
    setConfirming(true);
    setConfirmError(null);

    const result = await confirmImport(entityType, preview.preview_id, preview.rows, note.trim());
    setConfirming(false);

    if (result.success && result.result) {
      setConfirmResult(result.result);
    } else {
      setConfirmError(result.error || 'Không thể xác nhận import');
    }
  }

  const cleanCount = preview ? preview.rows.filter(isRowClean).length : 0;
  const flaggedCount = preview ? preview.rows.length - cleanCount : 0;

  return (
    <div>
      {!preview && (
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
      )}

      {preview && !confirmResult && (
        <div>
          <div className="dm-preview-summary">
            <div className="dm-stat">
              <strong>{preview.summary.total_rows}</strong>
              <span>Tổng số dòng</span>
            </div>
            <div className="dm-stat dm-stat-new">
              <strong>{cleanCount}</strong>
              <span>Sẽ tạo mới</span>
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
              {flaggedCount} dòng cần xử lý tay (xem bảng bên dưới) — phiên bản này{' '}
              <strong>sẽ tự bỏ qua</strong> các dòng đó, chỉ tạo mới {cleanCount} dòng sạch. Muốn nhập
              cả những dòng còn lại: sửa trực tiếp trong file gốc rồi upload lại.
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
                  <th>Kết quả</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => {
                  const clean = isRowClean(row);
                  const statusInfo = STATUS_LABEL[row.conflict_status];
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
                            <span className="dm-tag dm-tag-level">Cần chọn level</span>
                          </div>
                        )}
                      </td>
                      {DISPLAY_FIELDS[entityType].map((f) => (
                        <td key={f}>{String(row.data[f] ?? '')}</td>
                      ))}
                      <td>
                        {clean ? (
                          <span style={{ color: '#2E8B57', fontWeight: 500 }}>Sẽ tạo mới</span>
                        ) : (
                          <span className="dm-action-fixed">Bỏ qua — sửa file gốc, upload lại</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div id="dm-confirm-form">
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
                disabled={confirming || cleanCount === 0}
              >
                {confirming ? 'Đang xác nhận…' : `Xác nhận tạo mới ${cleanCount} dòng`}
              </button>
            </div>
            {cleanCount === 0 && (
              <p className="dm-hint-muted">Không có dòng nào sạch để import — sửa file gốc và upload lại.</p>
            )}
          </div>
        </div>
      )}

      {confirmResult && (
        <div className="dm-import-upload-card">
          <h2>Import xong</h2>
          <p className="dm-hint">
            Đã tạo mới <strong>{confirmResult.created}</strong> bản ghi
            {confirmResult.skipped > 0 && <> — bỏ qua {confirmResult.skipped} dòng cần xử lý tay</>}.
          </p>
          <div className="form-actions">
            <button type="button" className="btn btn-primary" onClick={resetAll}>
              Import file khác
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
