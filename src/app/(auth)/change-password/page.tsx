'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { changePassword } from '@/app/actions/auth';

/**
 * Trang đổi mật khẩu bắt buộc — (audit 09/2026, bug #3).
 *
 * Chủ yếu phục vụ user must_change_password=true (mật khẩu tạm do
 * admin cấp, xem (dashboard)/layout.tsx redirect vào đây) — nhưng cũng
 * dùng được cho đổi mật khẩu tự nguyện bình thường (route KHÔNG tự biết
 * must_change_password hiện tại của user, backend tự quyết định có bắt
 * buộc old_password hay không, xem ChangePasswordRequest/
 * change_password() trong auth_session.py). Vì vậy luôn hiển thị ô mật
 * khẩu cũ — bỏ trống nếu không có (trường hợp mật khẩu tạm), backend
 * tự bỏ qua validate old_password nếu must_change_password đang true.
 *
 * Nằm trong route group (auth)/ (KHÔNG phải (dashboard)/) để tránh
 * redirect loop: (dashboard)/layout.tsx redirect vào đây khi
 * must_change_password=true, nên trang này không được nằm trong cùng
 * route group đó.
 *
 * LƯU Ý: bản Flask gốc KHÔNG có trang auth-shell riêng cho route này —
 * /change-password bên đó chỉ redirect sang profile.security (form đổi
 * mật khẩu nằm trong trang cá nhân, xem 08/2026 note ở blueprints/
 * auth.py). Trang Next.js này là 1 route THẬT SỰ mới (không có trong
 * Flask) để tránh redirect loop nêu trên — vẫn giữ nguyên, chỉ sửa lại
 * đúng class CSS theo đúng bộ .auth-shell/.auth-card đã dùng chung cho
 * mọi trang auth khác (auth-wrapper/auth-header/form-group cũ không
 * tồn tại trong bất kỳ file CSS nào).
 */
export default function ChangePasswordPage() {
  const router = useRouter();
  const t = useTranslations('auth.changePassword');
  const tc = useTranslations('auth.common');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError(tc('passwordMinLength'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(tc('passwordMismatch'));
      return;
    }

    setLoading(true);

    try {
      const result = await changePassword(newPassword, oldPassword || undefined);

      if (result.success) {
        // Backend đã thu hồi toàn bộ token của phiên này khi đổi mật
        // khẩu thành công (xem docstring changePassword() ở actions/
        // auth.ts) — bắt buộc đăng nhập lại bằng mật khẩu mới.
        router.push('/login');
        router.refresh();
      } else {
        setError(result.error || t('error'));
      }
    } catch {
      setError(tc('genericError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <span className="eyebrow">{tc('eyebrowAccount')}</span>
        <h1>{t('title')}</h1>
        <p className="lede">
          {t('lede')}
        </p>

        {error && <div className="flash flash-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label>
            {t('oldPasswordLabel')}
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
            {t('newPasswordLabel')}
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('newPasswordPlaceholder')}
              required
              minLength={8}
              disabled={loading}
              autoComplete="new-password"
            />
          </label>

          <label>
            {t('confirmPasswordLabel')}
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('confirmPasswordPlaceholder')}
              required
              minLength={8}
              disabled={loading}
              autoComplete="new-password"
            />
          </label>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? t('submitLoading') : t('submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
