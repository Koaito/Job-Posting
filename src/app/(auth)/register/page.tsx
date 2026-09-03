'use client';

import { useState } from 'react';
import Link from 'next/link';
import { register } from '@/app/actions/auth';

/**
 * Trang đăng ký công khai — mới 09/2026.
 *
 * POST /auth/register luôn tạo role='user', KHÔNG trả token — tài
 * khoản phải xác thực email (link gửi tới hộp thư, hết hạn sau 24h)
 * trước khi login được (xem docstring register() ở backend). Vì vậy
 * sau khi đăng ký thành công, trang này CHỈ hiện thông báo "kiểm tra
 * email", KHÔNG tự chuyển tới /dashboard hay /jobs.
 */
export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [track, setTrack] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Xác nhận mật khẩu không khớp.');
      return;
    }

    setLoading(true);
    try {
      const result = await register({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim() || undefined,
        track: track.trim() || undefined,
      });

      if (result.success) {
        setMessage(result.message || 'Đăng ký thành công — kiểm tra email để xác thực tài khoản trước khi đăng nhập.');
      } else {
        setError(result.error || 'Đăng ký thất bại');
      }
    } catch {
      setError('Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  if (message) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card">
          <div className="auth-header">
            <h1>Kiểm tra email của bạn</h1>
          </div>
          <div className="flash flash-success">{message}</div>
          <div className="auth-footer">
            <Link href="/login" className="link-muted">Về trang đăng nhập</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Đăng ký tài khoản</h1>
          <p>Tạo tài khoản học viên để ứng tuyển và lưu job trên MindX Jobs</p>
        </div>

        {error && <div className="flash flash-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="full_name">Họ tên</label>
            <input
              type="text"
              id="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={loading}
              autoComplete="name"
            />
          </div>

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

          <div className="form-group">
            <label htmlFor="phone">Số điện thoại (không bắt buộc)</label>
            <input
              type="tel"
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
              autoComplete="tel"
            />
          </div>

          <div className="form-group">
            <label htmlFor="track">Lớp / track (không bắt buộc)</label>
            <input
              type="text"
              id="track"
              value={track}
              onChange={(e) => setTrack(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Mật khẩu</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tối thiểu 8 ký tự"
              required
              minLength={8}
              disabled={loading}
              autoComplete="new-password"
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Xác nhận mật khẩu</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              disabled={loading}
              autoComplete="new-password"
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Đang đăng ký...' : 'Đăng ký'}
          </button>
        </form>

        <div className="auth-footer">
          <Link href="/login" className="link-muted">Đã có tài khoản? Đăng nhập</Link>
        </div>
      </div>
    </div>
  );
}
