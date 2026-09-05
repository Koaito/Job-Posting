'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteCompany } from '@/app/actions/companies';

/**
 * Delete Company Button — xoá MỀM (is_active=false), note BẮT BUỘC.
 * Corresponds to Flask: templates/company_detail.html (khối <details>
 * "Xoá công ty này").
 *
 * Khác DeleteJobButton.tsx (chỉ cần bấm xác nhận): backend
 * CompanyDeleteRequest.note là field bắt buộc (thiếu -> 422) — nút này
 * PHẢI có ô nhập lý do, không thể chỉ confirm() suông.
 */
interface DeleteCompanyButtonProps {
  companyId: string;
  companyName: string;
}

export default function DeleteCompanyButton({ companyId, companyName }: DeleteCompanyButtonProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [note, setNote] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!note.trim()) {
      setError('Vui lòng nhập lý do xoá.');
      return;
    }

    setIsDeleting(true);
    setError(null);

    const result = await deleteCompany(companyId, { note: note.trim() });

    if (result.success) {
      router.push('/companies?deleted=1');
    } else {
      setError(result.error || 'Không thể xoá công ty');
      setIsDeleting(false);
    }
  };

  if (!showConfirm) {
    return (
      <button onClick={() => setShowConfirm(true)} className="btn btn-block btn-danger">
        🗑️ Xoá công ty
      </button>
    );
  }

  return (
    <div className="card" style={{ padding: '16px', backgroundColor: '#fff3cd', border: '1px solid #ffc107' }}>
      <h4 style={{ margin: '0 0 8px 0', color: '#856404' }}>⚠️ Xác nhận xoá</h4>
      <p style={{ margin: '0 0 12px 0', fontSize: '14px' }}>
        Xoá công ty <strong>&quot;{companyName}&quot;</strong>? Đây là xoá mềm — JD liên quan vẫn
        giữ nguyên, có thể xem lại qua Lịch sử thao tác.
      </p>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Lý do xoá công ty này — bắt buộc..."
        disabled={isDeleting}
        style={{ width: '100%', marginBottom: '12px' }}
      />

      {error && (
        <div className="flash flash-error" style={{ marginBottom: '12px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={handleDelete} disabled={isDeleting} className="btn btn-danger" style={{ flex: 1 }}>
          {isDeleting ? 'Đang xoá...' : 'Xác nhận xoá'}
        </button>
        <button
          onClick={() => { setShowConfirm(false); setError(null); }}
          disabled={isDeleting}
          className="btn btn-ghost"
          style={{ flex: 1 }}
        >
          Hủy
        </button>
      </div>
    </div>
  );
}
