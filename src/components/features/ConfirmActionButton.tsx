'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/components/ui/toast/ToastProvider';

/**
 * State machine "xác nhận hành động" dùng chung — trước đây cài lặp lại
 * y hệt 3 lần ở DeleteJobButton.tsx, DeleteCompanyButton.tsx,
 * WithdrawApplicationButton.tsx (đây cũng là nơi bug màu bịa
 * #fff3cd/#ffc107/#856404 từng bị nhân bản 3 lần trước khi sửa).
 *
 * Gộp về 1 component parameterize qua props:
 * - requireNote: true  -> textarea bắt buộc (DeleteCompanyButton)
 * - showNote: true, requireNote: false -> textarea tuỳ chọn (WithdrawApplicationButton)
 * - showNote: false (default) -> không có textarea (DeleteJobButton)
 * - onSuccess: cho mỗi nơi tự quyết hành vi sau khi thành công
 *   (router.push(...) hay router.refresh())
 *
 * i18n (Giai đoạn 2, nhóm 5, 09/2026): các prop text đều optional với
 * fallback lấy từ useTranslations('confirmActionButton') (defaultConfirmTitle/
 * defaultNoteLabel/defaultNoteRequiredError/defaultCancelButtonLabel) thay vì
 * default parameter tiếng Việt cứng như trước — 3 caller hiện có
 * (DeleteJobButton/DeleteCompanyButton/WithdrawApplicationButton) đều đã
 * truyền tường minh nên fallback này chỉ có tác dụng cho caller mới sau này
 * lỡ quên truyền.
 *
 * B.1 Polish (09/2026): đổi flash inline sang `toast.error()` — card xác
 * nhận (`showConfirm=true`) vẫn ở nguyên trên màn hình sau khi lỗi (kể
 * cả note bắt buộc bị bỏ trống), user thấy toast + thử lại ngay được,
 * không cần giữ lỗi persistent trong card.
 */

export interface ConfirmActionButtonProps {
  /** Label hiển thị trên nút trigger ban đầu (chưa bấm) */
  triggerLabel: ReactNode;
  /** className của nút trigger */
  triggerClassName?: string;

  /** Tiêu đề trong card xác nhận, mặc định "⚠️ Xác nhận" */
  confirmTitle?: ReactNode;
  /** Nội dung mô tả trong card xác nhận */
  confirmMessage: ReactNode;

  /** Có hiện ô nhập ghi chú/lý do không */
  showNote?: boolean;
  /** Ghi chú có bắt buộc không (chỉ có ý nghĩa khi showNote=true) */
  requireNote?: boolean;
  /** Label cho ô note, mặc định "Lý do" */
  noteLabel?: ReactNode;
  /** Placeholder cho textarea note */
  notePlaceholder?: string;
  /** Thông báo lỗi khi note bắt buộc nhưng để trống */
  noteRequiredError?: string;

  /** Label nút xác nhận lúc bình thường */
  confirmButtonLabel: string;
  /** Label nút xác nhận lúc đang xử lý (loading) */
  confirmButtonLoadingLabel: string;
  /** Label nút huỷ, mặc định "Hủy" */
  cancelButtonLabel?: string;

  /**
   * Hàm thực hiện hành động thật (gọi server action).
   * note sẽ là chuỗi đã trim, hoặc undefined nếu showNote=false
   * hoặc note rỗng và không bắt buộc.
   */
  onConfirm: (note?: string) => Promise<{ success: boolean; error?: string }>;
  /** Gọi khi onConfirm trả success=true — nơi gọi tự quyết định làm gì tiếp (push/refresh) */
  onSuccess: () => void;
  /** Thông báo lỗi mặc định khi result.error không có */
  defaultErrorMessage: string;
}

export default function ConfirmActionButton({
  triggerLabel,
  triggerClassName = 'btn btn-block btn-danger',
  confirmTitle,
  confirmMessage,
  showNote = false,
  requireNote = false,
  noteLabel,
  notePlaceholder,
  noteRequiredError,
  confirmButtonLabel,
  confirmButtonLoadingLabel,
  cancelButtonLabel,
  onConfirm,
  onSuccess,
  defaultErrorMessage,
}: ConfirmActionButtonProps) {
  const t = useTranslations('confirmActionButton');
  const toast = useToast();
  const resolvedConfirmTitle = confirmTitle ?? t('defaultConfirmTitle');
  const resolvedNoteLabel = noteLabel ?? t('defaultNoteLabel');
  const resolvedNoteRequiredError = noteRequiredError ?? t('defaultNoteRequiredError');
  const resolvedCancelButtonLabel = cancelButtonLabel ?? t('defaultCancelButtonLabel');

  const [showConfirm, setShowConfirm] = useState(false);
  const [note, setNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConfirm = async () => {
    const trimmedNote = note.trim();

    if (showNote && requireNote && !trimmedNote) {
      toast.error(resolvedNoteRequiredError);
      return;
    }

    setIsProcessing(true);

    const noteArg = showNote ? (trimmedNote || undefined) : undefined;
    const result = await onConfirm(noteArg);

    if (result.success) {
      onSuccess();
      // Không setIsProcessing(false) ở nhánh success: nơi gọi thường điều
      // hướng đi (push) hoặc refresh, giữ nút ở trạng thái loading cho
      // tới khi unmount/re-render là hành vi cũ của cả 3 component gốc.
    } else {
      toast.error(result.error || defaultErrorMessage);
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    setShowConfirm(false);
  };

  if (!showConfirm) {
    return (
      <button onClick={() => setShowConfirm(true)} className={triggerClassName}>
        {triggerLabel}
      </button>
    );
  }

  return (
    <div className="card" style={{ padding: '16px', backgroundColor: 'var(--accent-soft)', border: '1px solid var(--accent)' }}>
      <h4 style={{ margin: '0 0 8px 0', color: 'var(--accent)' }}>{resolvedConfirmTitle}</h4>
      <p style={{ margin: '0 0 12px 0', fontSize: '14px' }}>{confirmMessage}</p>

      {showNote && (resolvedNoteLabel ? (
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
          {resolvedNoteLabel}
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={notePlaceholder}
            disabled={isProcessing}
            style={{ width: '100%' }}
          />
        </label>
      ) : (
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={notePlaceholder}
          disabled={isProcessing}
          style={{ width: '100%', marginBottom: '12px' }}
        />
      ))}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={handleConfirm} disabled={isProcessing} className="btn btn-danger" style={{ flex: 1 }}>
          {isProcessing ? confirmButtonLoadingLabel : confirmButtonLabel}
        </button>
        <button onClick={handleCancel} disabled={isProcessing} className="btn btn-ghost" style={{ flex: 1 }}>
          {resolvedCancelButtonLabel}
        </button>
      </div>
    </div>
  );
}
