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
 *
 * FIX (đối chiếu templates/register.html + 02-auth.css thật, 09/2026):
 * y hệt login — auth-wrapper/auth-header/form-group/auth-footer đều
 * không tồn tại trong CSS. Đổi lại auth-shell/eyebrow/lede/label bọc
 * input trực tiếp/auth-foot, và xếp lại đúng thứ tự + gộp 2 cột
 * (password|confirm, phone|track) như bản gốc.
 *
 * LƯU Ý: trường "track" (định hướng ngành) ở bản gốc là <select> lấy
 * danh sách industries từ server-side view function truyền vào — ở đây
 * CHƯA có nguồn dữ liệu industries nào được fetch, nên tạm giữ dạng
 * text input tự do (KHÔNG phải lỗi CSS, mà là thiếu 1 phần dữ liệu/
 * chức năng so với bản gốc — cần bổ sung sau nếu muốn khớp 100%).
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
        setMessage(
          result.message ||
            'Đăng ký thành công — kiểm tra email để xác thực tài khoản trước khi đăng nhập.'
        );
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
      <div className="auth-shell">
        <div className="auth-card">
          <span className="eyebrow">Career Hub / Học viên</span>
          <h1>Kiểm tra email của bạn</h1>
          <div className="flash flash-success">{message}</div>
          <p className="auth-foot">
            <Link href="/login">Về trang đăng nhập</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <span className="eyebrow">Career Hub / Học viên</span>
        <h1>Đăng ký tài khoản</h1>
        <p className="lede">
          Tạo tài khoản để lưu job yêu thích và theo dõi cơ hội việc làm phù hợp với bạn.
        </p>

        {error && <div className="flash flash-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label>
            Họ và tên *
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={loading}
              autoComplete="name"
            />
          </label>

          <label>
            Email *
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              required
              disabled={loading}
              autoComplete="email"
            />
          </label>

          <div className="two-col">
            <label>
              Mật khẩu * (tối thiểu 8 ký tự)
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                disabled={loading}
                autoComplete="new-password"
              />
            </label>

            <label>
              Nhập lại mật khẩu *
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
          </div>

          <div className="two-col">
            <label>
              Số điện thoại
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
                autoComplete="tel"
              />
            </label>

            <label>
              Định hướng ngành
              <input
                type="text"
                value={track}
                onChange={(e) => setTrack(e.target.value)}
                disabled={loading}
              />
            </label>
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Đang đăng ký...' : 'Tạo tài khoản'}
          </button>
        </form>

        <p className="auth-foot">
          Đã có tài khoản? <Link href="/login">Đăng nhập</Link>
        </p>
        <div className="demo-hint">
          Sau khi đăng ký, kiểm tra email để bấm link xác thực trước khi đăng nhập được.
        </div>
      </div>
    </div>
  );
}
