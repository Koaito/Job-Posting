'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
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
} from '@/types/import-export';
import UploadStep from './import-panel/UploadStep';
import ImportDoneCard from './import-panel/ImportDoneCard';
import ImportRowRow from './import-panel/ImportRowRow';
import CompanyResolutionModal from './import-panel/CompanyResolutionModal';
import { fieldKey, isRowFullyClean, DISPLAY_FIELDS } from './import-panel/types';
import type { RowChoice, FieldFixState, CompanyModalState } from './import-panel/types';

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
 *
 * TÁCH NHỎ (rà soát kiến trúc 09/2026, mục #8) — file gốc 732 dòng,
 * 12 useState, 13 hàm xử lý, state phụ thuộc chéo nhau. Đợt này tách
 * theo BƯỚC (UploadStep/ImportDoneCard/ImportRowRow/
 * CompanyResolutionModal — xem thư mục import-panel/), component này
 * giờ chỉ còn đóng vai trò ORCHESTRATOR: điều phối 3 bước (upload ->
 * resolve -> done) + giữ state THẬT SỰ phụ thuộc chéo nhau giữa các
 * dòng (preview, rowChoices, fieldFixes, companyModal — buildResolutions()
 * lúc confirm cần đọc lại TOÀN BỘ state này của mọi dòng cùng lúc, nên
 * KHÔNG tách xuống từng ImportRowRow được). 4 state chỉ có ý nghĩa
 * trong bước upload (file/uploading/uploadError/fileErrors) đã chuyển
 * hẳn thành state cục bộ của UploadStep, không còn ở đây nữa.
 */

interface ImportPanelProps {
  entityType: ImportExportEntityType;
}

export default function ImportPanel({ entityType }: ImportPanelProps) {
  const t = useTranslations('importPanel');

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
    setPreview(null);
    setRowChoices({});
    setFieldFixes({});
    setCompanyModal(null);
    setNote('');
    setConfirmError(null);
    setConfirmResult(null);
  }

  function handleUploaded(uploadedPreview: ImportPreviewResult) {
    setRowChoices({});
    setFieldFixes({});
    setConfirmResult(null);
    setPreview(uploadedPreview);
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
        [key]: { draft, submitting: false, error: result.error || t('cannotConfirm') },
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
      setCompanyModal((prev) => (prev ? { ...prev, error: result.error || t('assignCompanyFailed') } : prev));
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
      setConfirmError(t('noteRequired'));
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
      setConfirmError(result.error || t('confirmFailed'));
    }
  }

  if (!preview) {
    return <UploadStep entityType={entityType} onUploaded={handleUploaded} />;
  }

  if (confirmResult) {
    return <ImportDoneCard summary={confirmResult} onImportAnother={resetAll} />;
  }

  const cleanCount = preview.rows.filter(isRowFullyClean).length;
  const flaggedCount = preview.rows.length - cleanCount;
  const missingBatchRows = missingBatchChoiceRows(preview.rows);
  const pendingCompany = pendingCompanyRows(preview.rows);
  const blockedReasons: string[] = [];
  if (pendingCompany.length > 0) blockedReasons.push(t('blockedPendingCompany', { count: pendingCompany.length }));
  if (missingBatchRows.length > 0) blockedReasons.push(t('blockedMissingBatch', { count: missingBatchRows.length }));
  const confirmBlocked = blockedReasons.length > 0;

  const rawCompanyNameForModal = companyModal
    ? String(preview.rows.find((r) => r.row_index === companyModal.rowIndex)?.data.company_name ?? '')
    : '';

  return (
    <div>
      <div className="dm-preview-summary">
        <div className="dm-stat">
          <strong>{preview.summary.total_rows}</strong>
          <span>{t('totalRows')}</span>
        </div>
        <div className="dm-stat dm-stat-new">
          <strong>{cleanCount}</strong>
          <span>{t('willCreateNow')}</span>
        </div>
        <div className="dm-stat dm-stat-conflict">
          <strong>{preview.summary.conflicts}</strong>
          <span>{t('conflicts')}</span>
        </div>
        <div className="dm-stat dm-stat-inactive">
          <strong>{preview.summary.conflicts_inactive}</strong>
          <span>{t('conflictsInactive')}</span>
        </div>
        <div className="dm-stat dm-stat-resolve">
          <strong>{preview.summary.pending_company_resolution}</strong>
          <span>{t('needsCompany')}</span>
        </div>
        <div className="dm-stat dm-stat-level-resolve">
          <strong>{preview.summary.pending_level_resolution}</strong>
          <span>{t('needsLevel')}</span>
        </div>
        <div className="dm-stat dm-stat-fix">
          <strong>{preview.summary.pending_field_fix}</strong>
          <span>{t('formatErrors')}</span>
        </div>
      </div>

      {flaggedCount > 0 && (
        <p className="dm-hint">
          {t('flaggedRowsHint', { count: flaggedCount })}
          {refreshing && ` ${t('refreshingPreview')}`}
        </p>
      )}

      <div className="dm-table-wrap">
        <table className="dm-preview-table">
          <thead>
            <tr>
              <th>#</th>
              <th>{t('colStatus')}</th>
              {DISPLAY_FIELDS[entityType].map((f) => (
                <th key={f}>{f}</th>
              ))}
              <th>{t('colHandle')}</th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row) => (
              <ImportRowRow
                key={row.row_index}
                row={row}
                entityType={entityType}
                choice={rowChoices[row.row_index]}
                fieldFixes={fieldFixes}
                onFieldDraftChange={setFieldDraft}
                onVerifyField={handleVerifyField}
                onUpdateChoice={updateRowChoice}
                onOpenCompanyModal={openCompanyModal}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div id="dm-confirm-form">
        {confirmBlocked && (
          <p id="dm-confirm-blocked-hint" style={{ display: 'block' }}>
            {t('confirmBlockedHint', { reasons: blockedReasons.join(t('and')) })}
          </p>
        )}

        <label className="dm-note-label">
          {t('importNoteLabel')} <span className="dm-required">*</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder={t('importNotePlaceholder')}
          />
        </label>

        {confirmError && (
          <p style={{ color: '#B23A22', fontSize: '13.5px', marginTop: '10px' }}>{confirmError}</p>
        )}

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={resetAll} disabled={confirming}>
            {t('cancelChooseAnother')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={confirming || confirmBlocked}
          >
            {confirming ? t('confirming') : t('confirmImport')}
          </button>
        </div>
      </div>

      <CompanyResolutionModal
        companyModal={companyModal}
        resolvingCompany={resolvingCompany}
        rawCompanyName={rawCompanyNameForModal}
        onChoose={handleChooseCompany}
        onClose={() => setCompanyModal(null)}
      />
    </div>
  );
}
