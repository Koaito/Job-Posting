'use client';

import { useState } from 'react';
import Link from 'next/link';
import { forgotPassword } from '@/app/actions/auth';

/**
 * Trang "Quên mật khẩu" — mới 09/2026.
 *
 * POST /auth/forgot-password LUÔN trả message thành công dù email có
 * tồn tại trong hệ thống hay không (chống dò email hàng loạt — xem
 * docstring backend). Vì vậy UI này KHÔNG được diễn giải success=false
 * thành "email không tồn tại" — chỉ dùng cho lỗi mạng/rate-limit thật.
 */
export default function ForgotPasswordPage() {
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
          result.message ||
            'Nếu email này có tài khoản, một email đặt lại mật khẩu đã được gửi tới đó.'
        );
      } else {
        setError(result.error || 'Không thể gửi email đặt lại mật khẩu');
      }
    } catch {
      setError('Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Quên mật khẩu</h1>
          <p>Nhập email đã đăng ký, chúng tôi sẽ gửi link đặt lại mật khẩu (hết hạn sau 1 giờ).</p>
        </div>

        {error && <div className="flash flash-error">{error}</div>}
        {message && <div className="flash flash-success">{message}</div>}

        {!message && (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                required
                disabled={loading}
                autoComplete="email"
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Đang gửi...' : 'Gửi link đặt lại mật khẩu'}
            </button>
          </form>
        )}

        <div className="auth-footer">
          <Link href="/login" className="link-muted">Về trang đăng nhập</Link>
        </div>
      </div>
    </div>
  );
}
