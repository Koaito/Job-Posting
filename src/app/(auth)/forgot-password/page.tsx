'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { forgotPassword } from '@/app/actions/auth';

/**
 * Trang "Quên mật khẩu" — mới 09/2026.
 *
 * POST /auth/forgot-password LUÔN trả message thành công dù email có
 * tồn tại trong hệ thống hay không (chống dò email hàng loạt — xem
 * docstring backend). Vì vậy UI này KHÔNG được diễn giải success=false
 * thành "email không tồn tại" — chỉ dùng cho lỗi mạng/rate-limit thật.
 *
 * FIX (đối chiếu templates/forgot_password.html + 02-auth.css thật):
 * auth-wrapper/auth-header/form-group/auth-footer không tồn tại trong
 * CSS — đổi lại auth-shell/eyebrow/lede/label bọc input/auth-foot.
 */
export default function ForgotPasswordPage() {
  const t = useTranslations('auth.forgotPassword');
  const tc = useTranslations('auth.common');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await forgotPassword(email.trim().toLowerCase());
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

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <span className="eyebrow">{tc('eyebrowAccount')}</span>
        <h1>{t('title')}</h1>
        <p className="lede">
          {t('lede')}
        </p>

        {error && <div className="flash flash-error">{error}</div>}
        {message && <div className="flash flash-success">{message}</div>}

        {!message && (
          <form onSubmit={handleSubmit}>
            <label>
              {tc('emailLabel')}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                required
                disabled={loading}
                autoComplete="email"
                autoFocus
              />
            </label>

            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? t('submitLoading') : t('submit')}
            </button>
          </form>
        )}

        <p className="auth-foot">
          <Link href="/login">{tc('backToLogin')}</Link>
        </p>
      </div>
    </div>
  );
}
