'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { getExportPreview, exportEntity } from '@/app/actions/import-export';
import type {
  ImportExportEntityType,
  ExportFilters,
  ExportPreviewResult,
} from '@/types/import-export';

/**
 * Export tab — filter (khác nhau theo entity, khớp _build_export_filters
 * ở router) -> "Xem trước" (GET .../export/{entity}/preview) -> "Tải
 * file" (GET .../export/{entity}, decode base64 client-side -> Blob).
 */

const STATUS_OPTIONS: Record<string, { value: string; label: string }[]> = {
  job: [
    { value: 'OPEN', label: 'OPEN' },
    { value: 'CLOSED', label: 'CLOSED' },
  ],
  contact: [
    { value: 'UNCONTACTED', label: 'UNCONTACTED' },
    { value: 'EMAIL_SENT', label: 'EMAIL_SENT' },
    { value: 'RESPONDED', label: 'RESPONDED' },
    { value: 'IN_PARTNERSHIP', label: 'IN_PARTNERSHIP' },
  ],
};

/** company: filter is_active thay vì status. job KHÔNG có is_active
 * (backend 400 nếu gửi) — company KHÔNG có company_id (export theo
 * chính nó) — khớp đúng _build_export_filters(). */
function hasStatusFilter(entityType: ImportExportEntityType): boolean {
  return entityType === 'job' || entityType === 'contact';
}
function hasIsActiveFilter(entityType: ImportExportEntityType): boolean {
  return entityType === 'company' || entityType === 'contact';
}
function hasCompanyIdFilter(entityType: ImportExportEntityType): boolean {
  return entityType === 'job' || entityType === 'contact';
}

function decodeBase64ToBlob(base64: string, contentType?: string): Blob {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  return new Blob([new Uint8Array(byteNumbers)], { type: contentType || 'application/octet-stream' });
}

interface ExportPanelProps {
  entityType: ImportExportEntityType;
}

export default function ExportPanel({ entityType }: ExportPanelProps) {
  const t = useTranslations('exportPanel');
  const [status, setStatus] = useState('');
  const [isActive, setIsActive] = useState<'any' | 'true' | 'false'>('any');
  const [companyId, setCompanyId] = useState('');
  const [dateField, setDateField] = useState<'created_at' | 'updated_at'>('created_at');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [limit, setLimit] = useState('');
  const [format, setFormat] = useState<'csv' | 'xlsx'>('csv');

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [preview, setPreview] = useState<ExportPreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function buildFilters(): ExportFilters {
    const filters: ExportFilters = { date_field: dateField };
    if (status) filters.status = status;
    if (isActive !== 'any') filters.is_active = isActive === 'true';
    if (companyId.trim()) filters.company_id = companyId.trim();
    if (fromDate) filters.from_date = fromDate;
    if (toDate) filters.to_date = toDate;
    if (limit) filters.limit = parseInt(limit, 10);
    return filters;
  }

  async function handlePreview() {
    setLoadingPreview(true);
    setError(null);
    const result = await getExportPreview(entityType, buildFilters());
    setLoadingPreview(false);
    if (result.success && result.preview) {
      setPreview(result.preview);
    } else {
      setPreview(null);
      setError(result.error || t('previewFailed'));
    }
  }

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    const result = await exportEntity(entityType, format, buildFilters());
    setDownloading(false);

    if (!result.success || !result.base64 || !result.filename) {
      setError(result.error || t('downloadFailed'));
      return;
    }

    const blob = decodeBase64ToBlob(result.base64, result.contentType);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="dm-export-card">
      <h2>{t('title')}</h2>
      <p className="dm-hint">
        {t('hint')}
      </p>

      <div className="dm-export-filters">
        <div className="form-grid">
          {hasStatusFilter(entityType) && (
            <label className="span-1">
              {t('status')}
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">{t('allStatuses')}</option>
                {(STATUS_OPTIONS[entityType] || []).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {hasIsActiveFilter(entityType) && (
            <label className="span-1">
              {t('isActive')}
              <select
                value={isActive}
                onChange={(e) => setIsActive(e.target.value as 'any' | 'true' | 'false')}
              >
                <option value="any">{t('both')}</option>
                <option value="true">{t('active')}</option>
                <option value="false">{t('inactive')}</option>
              </select>
            </label>
          )}

          {hasCompanyIdFilter(entityType) && (
            <label className="span-2">
              {t('companyIdLabel')}
              <input
                type="text"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                placeholder={t('companyIdPlaceholder')}
              />
            </label>
          )}

          <label className="span-1">
            {t('dateField')}
            <select
              value={dateField}
              onChange={(e) => setDateField(e.target.value as 'created_at' | 'updated_at')}
            >
              <option value="created_at">{t('createdAt')}</option>
              <option value="updated_at">{t('updatedAt')}</option>
            </select>
          </label>

          <label className="span-1">
            {t('fromDate')}
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </label>

          <label className="span-1">
            {t('toDate')}
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </label>

          <label className="span-1">
            {t('limitLabel')}
            <input
              type="number"
              min={1}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder={t('limitPlaceholder')}
            />
          </label>

          <label className="span-1">
            {t('formatLabel')}
            <select value={format} onChange={(e) => setFormat(e.target.value as 'csv' | 'xlsx')}>
              <option value="csv">CSV</option>
              <option value="xlsx">XLSX</option>
            </select>
          </label>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={handlePreview} disabled={loadingPreview}>
            {loadingPreview ? t('previewing') : t('preview')}
          </button>
        </div>
      </div>

      {error && <p style={{ color: '#B23A22', fontSize: '13.5px', marginBottom: '14px' }}>{error}</p>}

      {preview && (
        <div id="dm-export-preview-area">
          <div className="dm-preview-summary">
            <div className="dm-stat">
              <strong>{preview.total_matching}</strong>
              <span>{t('matchingFilter')}</span>
            </div>
            <div className="dm-stat dm-stat-new">
              <strong>{preview.will_export}</strong>
              <span>{t('willExport')}</span>
            </div>
          </div>

          {preview.sample_rows.length > 0 && (
            <div className="dm-table-wrap">
              <table className="dm-preview-table">
                <thead>
                  <tr>
                    {preview.columns.map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.sample_rows.map((row, idx) => (
                    <tr key={idx}>
                      {preview.columns.map((col) => (
                        <td key={col}>{String(row[col] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="dm-hint-muted">{t('sampleHint')}</p>
        </div>
      )}

      <div className="dm-export-actions">
        <button type="button" className="btn btn-primary" onClick={handleDownload} disabled={downloading}>
          {downloading ? t('downloading') : t('downloadFile', { format })}
        </button>
      </div>
    </div>
  );
}
