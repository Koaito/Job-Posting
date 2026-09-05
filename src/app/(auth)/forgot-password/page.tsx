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
 *
 * FIX (đối chiếu templates/forgot_password.html + 02-auth.css thật):
 * auth-wrapper/auth-header/form-group/auth-footer không tồn tại trong
 * CSS — đổi lại auth-shell/eyebrow/lede/label bọc input/auth-foot.
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
    <div className="auth-shell">
      <div className="auth-card">
        <span className="eyebrow">Career Hub / Tài khoản</span>
        <h1>Quên mật khẩu</h1>
        <p className="lede">
          Nhập email đã đăng ký, chúng tôi sẽ gửi link đặt lại mật khẩu (hết hạn sau 1 giờ).
        </p>

        {error && <div className="flash flash-error">{error}</div>}
        {message && <div className="flash flash-success">{message}</div>}

        {!message && (
          <form onSubmit={handleSubmit}>
            <label>
              Email
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
              {loading ? 'Đang gửi...' : 'Gửi link đặt lại mật khẩu'}
            </button>
          </form>
        )}

        <p className="auth-foot">
          <Link href="/login">Quay lại đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}
