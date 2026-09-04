'use client';

import { useState } from 'react';
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
      setError(result.error || 'Không thể xem trước dữ liệu export');
    }
  }

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    const result = await exportEntity(entityType, format, buildFilters());
    setDownloading(false);

    if (!result.success || !result.base64 || !result.filename) {
      setError(result.error || 'Không thể tải file export');
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
      <h2>Xem trước & tải file export</h2>
      <p className="dm-hint">
        Chọn điều kiện lọc rồi bấm &quot;Xem trước&quot; để biết sẽ xuất bao nhiêu dòng, hoặc bấm
        thẳng &quot;Tải file&quot; nếu đã chắc chắn (không lọc gì = lấy toàn bộ).
      </p>

      <div className="dm-export-filters">
        <div className="form-grid">
          {hasStatusFilter(entityType) && (
            <label className="span-1">
              Trạng thái
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Tất cả</option>
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
              Còn hoạt động
              <select
                value={isActive}
                onChange={(e) => setIsActive(e.target.value as 'any' | 'true' | 'false')}
              >
                <option value="any">Cả 2</option>
                <option value="true">Đang hoạt động</option>
                <option value="false">Đã ngừng</option>
              </select>
            </label>
          )}

          {hasCompanyIdFilter(entityType) && (
            <label className="span-2">
              Company ID (UUID, tuỳ chọn)
              <input
                type="text"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                placeholder="dán company_id nếu chỉ muốn xuất theo 1 công ty"
              />
            </label>
          )}

          <label className="span-1">
            Lọc theo ngày
            <select
              value={dateField}
              onChange={(e) => setDateField(e.target.value as 'created_at' | 'updated_at')}
            >
              <option value="created_at">Ngày tạo</option>
              <option value="updated_at">Ngày cập nhật</option>
            </select>
          </label>

          <label className="span-1">
            Từ ngày
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </label>

          <label className="span-1">
            Đến ngày
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </label>

          <label className="span-1">
            Chỉ lấy N dòng mới nhất
            <input
              type="number"
              min={1}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder="để trống = không giới hạn"
            />
          </label>

          <label className="span-1">
            Định dạng file
            <select value={format} onChange={(e) => setFormat(e.target.value as 'csv' | 'xlsx')}>
              <option value="csv">CSV</option>
              <option value="xlsx">XLSX</option>
            </select>
          </label>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={handlePreview} disabled={loadingPreview}>
            {loadingPreview ? 'Đang xem trước…' : 'Xem trước'}
          </button>
        </div>
      </div>

      {error && <p style={{ color: '#B23A22', fontSize: '13.5px', marginBottom: '14px' }}>{error}</p>}

      {preview && (
        <div id="dm-export-preview-area">
          <div className="dm-preview-summary">
            <div className="dm-stat">
              <strong>{preview.total_matching}</strong>
              <span>Khớp filter</span>
            </div>
            <div className="dm-stat dm-stat-new">
              <strong>{preview.will_export}</strong>
              <span>Sẽ có trong file</span>
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
          <p className="dm-hint-muted">Mẫu tối đa 20 dòng đầu (theo ngày tạo mới nhất).</p>
        </div>
      )}

      <div className="dm-export-actions">
        <button type="button" className="btn btn-primary" onClick={handleDownload} disabled={downloading}>
          {downloading ? 'Đang tải…' : `Tải file (.${format})`}
        </button>
      </div>
    </div>
  );
}
