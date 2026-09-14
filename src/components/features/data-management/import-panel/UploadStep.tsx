'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { uploadImportFile } from '@/app/actions/import-export';
import type {
  ImportExportEntityType,
  ImportPreviewResult,
  ImportFileRejectedError,
} from '@/types/import-export';

/**
 * Bước 1 (upload file) tách ra khỏi ImportPanel.tsx (rà soát kiến trúc
 * 09/2026, mục #8) — 4 state (file/uploading/uploadError/fileErrors) +
 * 1 hàm xử lý (handleUpload) chỉ có ý nghĩa TRONG bước này, ImportPanel
 * (orchestrator) không cần biết gì về chúng sau khi upload xong, nên
 * đưa hẳn ra làm state cục bộ của component này thay vì để chung với
 * state của bước resolve/confirm (preview, rowChoices, fieldFixes...).
 */
interface UploadStepProps {
  entityType: ImportExportEntityType;
  onUploaded: (preview: ImportPreviewResult) => void;
}

export default function UploadStep({ entityType, onUploaded }: UploadStepProps) {
  const t = useTranslations('importPanel');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileErrors, setFileErrors] = useState<ImportFileRejectedError['errors'] | undefined>();

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setFileErrors(undefined);

    const result = await uploadImportFile(entityType, file);
    setUploading(false);

    if (result.success && result.preview) {
      onUploaded(result.preview);
    } else {
      setUploadError(result.error || t('uploadFailed'));
      setFileErrors(result.fileErrors);
    }
  }

  return (
    <div>
      <div className="dm-import-upload-card">
        <h2>{t('uploadTitle')}</h2>
        <p className="dm-hint">
          {t('uploadHint')}
        </p>

        <label className="dm-file-label">
          {t('chooseFile')}
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
                {t('fileErrorLine', { row: err.row_number, field: err.field_name, message: err.message })}
              </li>
            ))}
            {fileErrors.length > 20 && <li>{t('andMoreErrors', { count: fileErrors.length - 20 })}</li>}
          </ul>
        )}

        <div className="form-actions">
          <button type="button" className="btn btn-primary" onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? t('processing') : t('uploadAndPreview')}
          </button>
        </div>
      </div>
    </div>
  );
}
