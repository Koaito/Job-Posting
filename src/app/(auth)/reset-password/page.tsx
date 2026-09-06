'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { resetPassword } from '@/app/actions/auth';

/**
 * Trang đặt lại mật khẩu — mới 09/2026.
 *
 * Link email trỏ về đúng đây: FRONTEND_BASE_URL + "/reset-password?token=..."
 * (xem api/email_service.py::send_password_reset_email — reset_url).
 * Token THÔ nằm trên query string, gửi thẳng lên POST /auth/reset-password,
 * dùng đúng 1 lần, hết hạn sau 1h.
 *
 * BUG FIX phòng ngừa: useSearchParams() bắt buộc phải nằm trong 1
 * <Suspense> boundary khi build static (next build sẽ fail nếu không —
 * xem lỗi thật "useSearchParams() should be wrapped in a suspense
 * boundary" nếu bỏ Suspense ở đây), nên tách phần đọc token ra 1
 * component con, default export chỉ lo bọc Suspense.
 *
 * FIX (đối chiếu templates/reset_password.html + 02-auth.css thật):
 * auth-wrapper/auth-header/form-group/auth-footer không tồn tại trong
 * CSS — đổi lại auth-shell (chỉ 1 lớp ngoài cùng, .auth-card nằm bên
 * trong từng nhánh trạng thái)/eyebrow/lede/label bọc input/auth-foot.
 */
function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const t = useTranslations('auth.resetPassword');
  const tc = useTranslations('auth.common');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="auth-card">
        <span className="eyebrow">{tc('eyebrowAccount')}</span>
        <h1>{t('invalidTitle')}</h1>
        <p className="lede">
          {t('invalidLede')}
        </p>
        <p className="auth-foot">
          <Link href="/forgot-password">{t('requestNewLink')}</Link>
        </p>
      </div>
    );
  }

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
      const result = await resetPassword(token, newPassword);
      if (result.success) {
        setMessage(
          result.message || t('successMessage')
        );
      } else {
        setError(result.error || t('error'));
      }
    } catch {
      setError(tc('genericError'));
    } finally {
      setLoading(false);
    }
  };

  if (message) {
    return (
      <div className="auth-card">
        <span className="eyebrow">{tc('eyebrowAccount')}</span>
        <h1>{t('successTitle')}</h1>
        <div className="flash flash-success">{message}</div>
        <p className="auth-foot">
          <Link href="/login">{tc('backToLoginPage')}</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <span className="eyebrow">{tc('eyebrowAccount')}</span>
      <h1>{t('title')}</h1>
      <p className="lede">{t('lede')}</p>

      {error && <div className="flash flash-error">{error}</div>}

      <form onSubmit={handleSubmit}>
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
            autoFocus
          />
        </label>

        <label>
          {t('confirmPasswordLabel')}
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            disabled={loading}
            autoComplete="new-password"
          />
        </label>

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? t('submitLoading') : t('submit')}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  const t = useTranslations('auth.resetPassword');
  return (
    <div className="auth-shell">
      <Suspense fallback={<div className="auth-card">{t('loading')}</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
