'use client';

import { useState } from 'react';
import { forgotPassword } from '@/app/actions/auth';

/**
 * Trang xin link đặt lại mật khẩu (audit 09/2026 #15) — trước đây link
 * "Quên mật khẩu?" ở /login trỏ tới route KHÔNG tồn tại (404), dù backend
 * (POST /auth/forgot-password) đã có sẵn đầy đủ.
 *
 * Backend LUÔN trả cùng 1 message dù email có tồn tại hay không (chống
 * dò email hàng loạt) — form này vì vậy CHỈ hiện 1 màn hình "đã gửi"
 * chung, không có nhánh "email không tồn tại" nào để hiển thị riêng,
 * đúng nguyên tắc bảo mật của backend chứ không phải thiếu sót.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await forgotPassword(email.trim().toLowerCase());

      if (result.success) {
        setSent(
          result.message ||
            'Nếu email này có tài khoản, một email đặt lại mật khẩu đã được gửi tới đó.'
        );
      } else {
        setError(result.error || 'Không thể gửi yêu cầu. Vui lòng thử lại.');
      }
    } catch {
      setError('Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card">
          <div className="auth-header">
            <h1>Kiểm tra email của bạn</h1>
            <p>{sent}</p>
          </div>
          <div className="auth-footer">
            <a href="/login" className="link-muted">Quay lại đăng nhập</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Quên mật khẩu?</h1>
          <p>Nhập email đã đăng ký, chúng tôi sẽ gửi link đặt lại mật khẩu.</p>
        </div>

        {error && <div className="flash flash-error">{error}</div>}

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

        <div className="auth-footer">
          <a href="/login" className="link-muted">Quay lại đăng nhập</a>
        </div>
      </div>
    </div>
  );
}
