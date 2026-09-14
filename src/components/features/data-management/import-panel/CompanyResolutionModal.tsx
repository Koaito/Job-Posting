'use client';

import { useTranslations } from 'next-intl';
import type { CompanyModalState } from './types';

/**
 * Modal chọn công ty (pending_company_resolution) tách ra khỏi
 * ImportPanel.tsx (rà soát kiến trúc 09/2026, mục #8) — không giữ state
 * riêng, mọi state (companyModal, resolvingCompany) vẫn do ImportPanel
 * (orchestrator) quản lý vì handleChooseCompany() cần gọi lại
 * replaceRow()/refreshPreview() ở parent sau khi resolve xong.
 */
interface CompanyResolutionModalProps {
  companyModal: CompanyModalState | null;
  resolvingCompany: boolean;
  /** company_name gốc trong file của dòng đang mở modal (để hiển thị đối chiếu). */
  rawCompanyName: string;
  onChoose: (companyId: string | null) => void;
  onClose: () => void;
}

export default function CompanyResolutionModal({
  companyModal,
  resolvingCompany,
  rawCompanyName,
  onChoose,
  onClose,
}: CompanyResolutionModalProps) {
  const t = useTranslations('importPanel');

  return (
    <div className="dm-modal-overlay" hidden={!companyModal}>
      {companyModal && (
        <div className="dm-modal">
          <div className="dm-modal-head">
            <h3>{t('chooseCompanyTitle')}</h3>
            <button type="button" className="dm-modal-close" onClick={onClose}>
              ×
            </button>
          </div>
          <div className="dm-modal-body">
            <p className="dm-modal-hint">
              {t('modalRowLabel', { row: companyModal.rowIndex + 1 })} {rawCompanyName}
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
                      onClick={() => onChoose(s.company_id)}
                    >
                      <span className="dm-modal-suggestion-name">
                        {s.company_name}
                        {!s.is_active && ` ${t('inactiveSuffix')}`}
                      </span>
                      {s.tax_id && <span className="dm-modal-suggestion-tax">{t('taxIdShort')}: {s.tax_id}</span>}
                      <span className="dm-modal-suggestion-score">{Math.round(s.similarity * 100)}%</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dm-modal-hint">{t('noSimilarCompany')}</p>
            )}
            <button
              type="button"
              className="dm-modal-create-new"
              disabled={resolvingCompany}
              onClick={() => onChoose(null)}
            >
              {resolvingCompany ? t('processing') : t('createNewCompany')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
