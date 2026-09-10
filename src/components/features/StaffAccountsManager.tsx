'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { createStaff, updateStaffRole, updateStaffActiveStatus } from '@/app/actions/staff';
import type { User } from '@/types/auth';
import { toIntlLocale } from '@/i18n/config';
import { useToast } from '@/components/ui/toast/ToastProvider';

/**
 * Quản lý danh sách nhân viên — mới 09/2026 (xem staff/page.tsx).
 *
 * Việc tạo tài khoản (POST /auth/users) trả temp_password ĐÚNG 1 LẦN
 * duy nhất trong response, backend không lưu bản rõ nên không cách nào
 * lấy lại sau (xem docstring UserCreatedOut) — hiển thị NGAY sau khi
 * tạo thành công và giữ nguyên trên màn hình cho tới khi admin tự đóng,
 * không tự ẩn sau vài giây, để tránh admin thao tác chậm bị mất mật
 * khẩu tạm mà không còn cách nào lấy lại ngoài "khoá + tạo tài khoản
 * mới" cho người dùng đó.
 *
 * admin không tự đổi role/khoá CHÍNH MÌNH được (backend chặn cứng 400,
 * xem update_user_role()/update_user_active_status()) — ẩn hẳn 2 nút đó
 * ở hàng của currentUserId thay vì để bấm rồi nhận lỗi.
 *
 * B.1 Polish (09/2026) — tách state lỗi TRƯỚC ĐÂY dùng chung 1 `error`
 * cho cả 2 bản chất khác nhau:
 * - Tạo tài khoản (`handleCreate`) là FORM SUBMIT nhiều field, lỗi cần
 *   ở lại persistent để admin đọc và sửa → giữ `formError` inline, y
 *   như CompanyForm.tsx/JobForm.tsx (KHÔNG đổi sang toast).
 * - Đổi role/khoá tài khoản (`handleRoleChange`/`handleToggleActive`)
 *   là hành động bấm-chọn-xong-liền trên 1 dòng bảng, không có form nào
 *   đang mở để "sửa lại" — khớp đúng use case gốc `showToast()`, đổi
 *   sang `toast.error()`. Xem ghi chú tương tự ở MessagesInbox.tsx.
 */

interface StaffAccountsManagerProps {
  initialStaff: User[];
  currentUserId: string;
  isAdmin: boolean;
}

export function StaffAccountsManager({ initialStaff, currentUserId, isAdmin }: StaffAccountsManagerProps) {
  const t = useTranslations('staffAccountsManager');
  const dateLocale = toIntlLocale(useLocale());
  const router = useRouter();
  const toast = useToast();
  const [staff, setStaff] = useState(initialStaff);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createdAccount, setCreatedAccount] = useState<{ email: string; temp_password: string } | null>(null);

  const handleCreate = (formData: FormData) => {
    setFormError('');
    startTransition(async () => {
      const result = await createStaff({
        full_name: String(formData.get('full_name') || ''),
        email: String(formData.get('email') || ''),
        role: String(formData.get('role') || 'ss_team'),
      });

      if (result.success && result.user) {
        setCreatedAccount({ email: result.user.email, temp_password: result.user.temp_password });
        setShowCreateForm(false);
        setStaff((prev) => [...prev, result.user!]);
        router.refresh();
      } else {
        setFormError(result.error || t('createFailed'));
      }
    });
  };

  const handleRoleChange = (ssUserId: string, role: string) => {
    startTransition(async () => {
      const result = await updateStaffRole(ssUserId, role);
      if (result.success && result.user) {
        setStaff((prev) => prev.map((s) => (s.ss_user_id === ssUserId ? result.user! : s)));
      } else {
        toast.error(result.error || t('roleChangeFailed'));
      }
    });
  };

  const handleToggleActive = (ssUserId: string, isActive: boolean) => {
    startTransition(async () => {
      const result = await updateStaffActiveStatus(ssUserId, !isActive);
      if (result.success && result.user) {
        setStaff((prev) => prev.map((s) => (s.ss_user_id === ssUserId ? result.user! : s)));
      } else {
        toast.error(result.error || t('statusChangeFailed'));
      }
    });
  };

  return (
    <div>
      {formError && <div className="flash flash-error" style={{ marginBottom: '16px' }}>{formError}</div>}

      {createdAccount && (
        <div className="flash flash-success" style={{ marginBottom: '16px' }}>
          <strong>{t('accountCreated', { email: createdAccount.email })}</strong> {t('tempPasswordNotice')}{' '}
          <code style={{ userSelect: 'all' }}>{createdAccount.temp_password}</code>{' '}
          <button type="button" className="btn" onClick={() => setCreatedAccount(null)}>
            {t('close')}
          </button>
        </div>
      )}

      {isAdmin && (
        <div style={{ marginBottom: '22px' }}>
          {!showCreateForm ? (
            <button type="button" className="btn btn-primary" onClick={() => setShowCreateForm(true)}>
              {t('addAccount')}
            </button>
          ) : (
            <form
              action={handleCreate}
              className="card"
              style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label htmlFor="full_name">{t('fullName')}</label>
                <input id="full_name" name="full_name" type="text" required disabled={isPending} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label htmlFor="email">Email</label>
                <input id="email" name="email" type="email" required disabled={isPending} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label htmlFor="role">{t('role')}</label>
                <select id="role" name="role" defaultValue="ss_team" disabled={isPending}>
                  <option value="ss_team">ss_team</option>
                  <option value="admin">admin</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending ? t('creating') : t('createAccount')}
              </button>
              <button type="button" className="btn" onClick={() => setShowCreateForm(false)} disabled={isPending}>
                {t('cancel')}
              </button>
            </form>
          )}
        </div>
      )}

      {staff.length > 0 ? (
        <div className="contact-table-wrap">
          <table className="contact-table">
            <thead>
              <tr>
                <th>{t('colFullName')}</th>
                <th>Email</th>
                <th>{t('colRole')}</th>
                <th>{t('colStatus')}</th>
                <th>{t('colLastLogin')}</th>
                {isAdmin && <th>{t('colActions')}</th>}
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => {
                const isSelf = s.ss_user_id === currentUserId;
                return (
                  <tr key={s.ss_user_id}>
                    <td>
                      <strong>{s.full_name}</strong>
                      {isSelf && <span className="you-badge">{t('you')}</span>}
                    </td>
                    <td className="muted">{s.email}</td>
                    <td>
                      <span className="role-chip">{s.role}</span>
                    </td>
                    {/* BUG FIX (audit CSS 09/2026): "status-chip status-open/
                        status-closed" là class domain job (OPEN/CLOSED),
                        tự bịa cho tài khoản nhân viên nên mất màu hoàn
                        toàn (không khớp CSS nào). Flask gốc
                        (templates/staff_accounts.html dòng 86) hiện
                        trạng thái tài khoản bằng CHỮ THƯỜNG, không hề
                        bọc badge/chip nào — CSS thật chưa có sẵn 1 chip
                        riêng cho domain "tài khoản hoạt động/khoá" này,
                        nên fix đúng là bỏ chip mượn nhầm, không tự chế
                        thêm class mới không có trong style.css. */}
                    <td>{s.is_active ? t('statusActive') : t('statusLocked')}</td>
                    <td className="muted">
                      {/* Polish (09/2026): dateLocale theo locale hiện tại
                          thay vì hard-code 'vi-VN'. */}
                      {s.last_login_at ? new Date(s.last_login_at).toLocaleString(dateLocale) : t('neverLoggedIn')}
                    </td>
                    {isAdmin && (
                      <td>
                        {/* BUG-FIX-friendly: ẩn hẳn thao tác trên chính mình — backend
                            (require_admin routes) chặn cứng 400 nếu admin tự đổi role/khoá
                            chính mình, hiện nút rồi báo lỗi sẽ khó hiểu hơn ẩn thẳng. */}
                        {!isSelf && (
                          <div className="status-inline" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <select
                              value={s.role}
                              disabled={isPending}
                              onChange={(e) => handleRoleChange(s.ss_user_id, e.target.value)}
                            >
                              <option value="user">user</option>
                              <option value="ss_team">ss_team</option>
                              <option value="admin">admin</option>
                            </select>
                            <button
                              type="button"
                              className="btn"
                              disabled={isPending}
                              onClick={() => handleToggleActive(s.ss_user_id, s.is_active)}
                            >
                              {s.is_active ? t('lock') : t('unlock')}
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">{t('empty')}</div>
      )}
    </div>
  );
}
