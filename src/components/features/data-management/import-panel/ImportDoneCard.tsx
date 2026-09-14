'use client';

import { useTranslations } from 'next-intl';
import type { ImportConfirmSummary } from '@/types/import-export';

/**
 * Màn hình "đã import xong" tách ra khỏi ImportPanel.tsx (rà soát kiến
 * trúc 09/2026, mục #8) — thuần presentational, không giữ state riêng.
 */
interface ImportDoneCardProps {
  summary: ImportConfirmSummary;
  onImportAnother: () => void;
}

export default function ImportDoneCard({ summary, onImportAnother }: ImportDoneCardProps) {
  const t = useTranslations('importPanel');

  return (
    <div className="dm-import-upload-card">
      <h2>{t('importDone')}</h2>
      <p className="dm-hint">
        {t('createdCount', { count: summary.created })}
        {summary.updated > 0 && <> — {t('updatedCount', { count: summary.updated })}</>}
        {summary.skipped > 0 && <> — {t('skippedCount', { count: summary.skipped })}</>}.
      </p>
      <div className="form-actions">
        <button type="button" className="btn btn-primary" onClick={onImportAnother}>
          {t('importAnotherFile')}
        </button>
      </div>
    </div>
  );
}
