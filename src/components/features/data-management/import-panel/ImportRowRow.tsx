'use client';

import { useTranslations } from 'next-intl';
import type { ImportExportEntityType, ImportPreviewRow, ImportRowResolution } from '@/types/import-export';
import { DISPLAY_FIELDS, STATUS_KEYS, LEVEL_CODE_VALUES, fieldKey, isRowFullyClean } from './types';
import type { RowChoice, FieldFixState } from './types';

/**
 * 1 dòng (<tr>) của bảng resolve tách ra khỏi ImportPanel.tsx (rà soát
 * kiến trúc 09/2026, mục #8) — gộp cả phần sửa field lỗi tại chỗ
 * (needs_field_fix) lẫn phần chọn hành động xử lý dòng (company
 * resolve / batch conflict radio / conflict radio / level select),
 * đúng phần chiếm nhiều dòng markup nhất trong file gốc.
 *
 * KHÔNG giữ state riêng — mọi state (rowChoices, fieldFixes) vẫn do
 * ImportPanel (orchestrator) quản lý, vì buildResolutions() lúc confirm
 * cần đọc lại TOÀN BỘ rowChoices của mọi dòng cùng lúc.
 */
interface ImportRowRowProps {
  row: ImportPreviewRow;
  entityType: ImportExportEntityType;
  choice: RowChoice | undefined;
  fieldFixes: Record<string, FieldFixState>;
  onFieldDraftChange: (rowIndex: number, fieldName: string, draft: string) => void;
  onVerifyField: (row: ImportPreviewRow, fieldName: string) => void;
  onUpdateChoice: (rowIndex: number, patch: Partial<RowChoice>) => void;
  onOpenCompanyModal: (row: ImportPreviewRow) => void;
}

export default function ImportRowRow({
  row,
  entityType,
  choice,
  fieldFixes,
  onFieldDraftChange,
  onVerifyField,
  onUpdateChoice,
  onOpenCompanyModal,
}: ImportRowRowProps) {
  const t = useTranslations('importPanel');
  const clean = isRowFullyClean(row);
  const statusInfo = STATUS_KEYS[row.conflict_status];

  return (
    <tr className={clean ? '' : 'dm-row-flag'}>
      <td>{row.row_index + 1}</td>
      <td>
        <span className={`dm-tag ${statusInfo.tagClass}`}>{t(statusInfo.key)}</span>
        {row.needs_field_fix && (
          <div>
            <span className="dm-tag dm-tag-fix">{t('formatErrors')}</span>
          </div>
        )}
        {row.needs_level_resolve && (
          <div>
            <span className={`dm-tag ${choice?.levelCode ? 'dm-tag-level-ok' : 'dm-tag-level'}`}>
              {choice?.levelCode ? t('levelChosen', { level: choice.levelCode }) : t('needsLevel')}
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
                    onChange={(e) => onFieldDraftChange(row.row_index, f, e.target.value)}
                  >
                    <option value="">{t('chooseEllipsis')}</option>
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
                    onChange={(e) => onFieldDraftChange(row.row_index, f, e.target.value)}
                  />
                )}
                <button
                  type="button"
                  className="dm-btn-verify-field"
                  disabled={fixState?.submitting}
                  onClick={() => onVerifyField(row, f)}
                >
                  {fixState?.submitting ? '…' : t('confirm')}
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
          <span style={{ color: '#2E8B57', fontWeight: 500 }}>{t('willCreate')}</span>
        ) : row.conflict_status === 'pending_company_resolution' ? (
          <div className="dm-resolve-block">
            <span className="dm-resolve-current dm-resolve-pending">{t('companyNotChosen')}</span>
            <span className="dm-resolve-raw">{t('inFile')}: {String(row.data.company_name ?? '')}</span>
            <button type="button" className="btn btn-ghost dm-btn-choose-company" onClick={() => onOpenCompanyModal(row)}>
              {t('chooseCompanyEllipsis')}
            </button>
          </div>
        ) : row.conflict_status === 'conflict_in_batch' ? (
          <div className="dm-action-radios">
            <span className="dm-dup-detail">
              {t('duplicateWithRow', {
                row: (row.duplicate_in_batch?.other_row_index ?? -1) + 1,
                percent: Math.round((row.duplicate_in_batch?.match_score ?? 0) * 100),
                fields: row.duplicate_in_batch?.matched_fields.join(', ') ?? '',
              })}
            </span>
            {(
              [
                ['skip', t('skipRow')],
                ['create', t('stillCreateRow')],
                ['keep_this', t('keepThisRow')],
                ['keep_other', t('keepOtherRow')],
                ['import_both', t('bothCorrect')],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="dm-radio-opt">
                <input
                  type="radio"
                  name={`batch-${row.row_index}`}
                  checked={choice?.action === value}
                  onChange={() => onUpdateChoice(row.row_index, { action: value as ImportRowResolution['action'] })}
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
                onChange={() => onUpdateChoice(row.row_index, { action: 'skip' })}
              />
              {t('skipRow')}
            </label>
            <label className="dm-radio-opt">
              <input
                type="radio"
                name={`conflict-${row.row_index}`}
                checked={choice?.action === 'update'}
                onChange={() => onUpdateChoice(row.row_index, { action: 'update' })}
              />
              {t('overwriteExisting')}
            </label>
            {row.conflict_status === 'conflict_inactive' && choice?.action === 'update' && (
              <div className="dm-inactive-confirm">
                <span className="dm-inactive-warn">{t('inactiveWarning')}</span>
                <div className="dm-inactive-btns">
                  <button
                    type="button"
                    className={`btn ${choice?.confirmReactivate ? 'active' : ''}`}
                    onClick={() => onUpdateChoice(row.row_index, { confirmReactivate: true })}
                  >
                    {t('confirmReactivate')}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : row.needs_level_resolve ? (
          <span className="dm-action-fixed">{t('chooseLevelHint')}</span>
        ) : (
          <span className="dm-action-fixed">{t('fixErrorHint')}</span>
        )}

        {row.needs_level_resolve && (
          <select
            className="dm-level-select"
            value={choice?.levelCode ?? ''}
            onChange={(e) => onUpdateChoice(row.row_index, { levelCode: e.target.value || undefined })}
            style={{ marginTop: '6px' }}
          >
            <option value="">{t('chooseLevelOption')}</option>
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
}
