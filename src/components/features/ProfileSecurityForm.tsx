'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { changePassword } from '@/app/actions/auth';

/**
 * Form đổi mật khẩu tại /profile/security — khớp profile.security()
 * bên Flask gốc. Tái dùng changePassword() đã có sẵn (viết cho trang
 * /change-password bắt buộc lúc must_change_password=true), giờ cũng
 * dùng cho đổi mật khẩu TỰ NGUYỆN từ trang cá nhân — cùng 1 hàm, cùng
 * hợp đồng backend (ChangePasswordRequest tự quyết định có bắt buộc
 * old_password hay không dựa theo must_change_password hiện tại).
 *
 * Đổi mật khẩu thành công -> backend luôn thu hồi hết token của phiên
 * này (xem docstring changePassword()) -> PHẢI điều hướng về /login,
 * không có cách nào "ở lại trang" sau khi đổi thành công.
 */
export default function ProfileSecurityForm({ mustChangePassword }: { mustChangePassword: boolean }) {
  const t = useTranslations('profileSecurityForm');
  const router = useRouter();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError(t('tooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('mismatch'));
      return;
    }
    if (!mustChangePassword && !oldPassword) {
      setError(t('oldPasswordRequired'));
      return;
    }

    setLoading(true);
    try {
      const result = await changePassword(newPassword, oldPassword || undefined);

      if (result.success) {
        router.push('/login');
        router.refresh();
      } else {
        setError(result.error || t('changeFailed'));
      }
    } catch {
      setError(t('genericError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="flash flash-error">{error}</div>}

      <label>
        {t('oldPassword')}{mustChangePassword ? ` ${t('oldPasswordHint')}` : ''}
        <input
          type="password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          placeholder="••••••••"
          disabled={loading}
          autoComplete="current-password"
        />
      </label>

      <label>
        {t('newPassword')}
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder={t('minChars')}
          required
          minLength={8}
          disabled={loading}
          autoComplete="new-password"
        />
      </label>

      <label>
        {t('confirmPassword')}
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder={t('confirmPlaceholder')}
          required
          minLength={8}
          disabled={loading}
          autoComplete="new-password"
        />
      </label>

      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? t('changing') : t('changePassword')}
      </button>
    </form>
  );
}
