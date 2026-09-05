'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createStaff, updateStaffRole, updateStaffActiveStatus } from '@/app/actions/staff';
import type { User } from '@/types/auth';

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
 */

interface StaffAccountsManagerProps {
  initialStaff: User[];
  currentUserId: string;
  isAdmin: boolean;
}

export function StaffAccountsManager({ initialStaff, currentUserId, isAdmin }: StaffAccountsManagerProps) {
  const router = useRouter();
  const [staff, setStaff] = useState(initialStaff);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createdAccount, setCreatedAccount] = useState<{ email: string; temp_password: string } | null>(null);

  const handleCreate = (formData: FormData) => {
    setError('');
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
        setError(result.error || 'Không thể tạo tài khoản');
      }
    });
  };

  const handleRoleChange = (ssUserId: string, role: string) => {
    setError('');
    startTransition(async () => {
      const result = await updateStaffRole(ssUserId, role);
      if (result.success && result.user) {
        setStaff((prev) => prev.map((s) => (s.ss_user_id === ssUserId ? result.user! : s)));
      } else {
        setError(result.error || 'Không thể đổi vai trò');
      }
    });
  };

  const handleToggleActive = (ssUserId: string, isActive: boolean) => {
    setError('');
    startTransition(async () => {
      const result = await updateStaffActiveStatus(ssUserId, !isActive);
      if (result.success && result.user) {
        setStaff((prev) => prev.map((s) => (s.ss_user_id === ssUserId ? result.user! : s)));
      } else {
        setError(result.error || 'Không thể đổi trạng thái tài khoản');
      }
    });
  };

  return (
    <div>
      {error && <div className="flash flash-error" style={{ marginBottom: '16px' }}>{error}</div>}

      {createdAccount && (
        <div className="flash flash-success" style={{ marginBottom: '16px' }}>
          <strong>Đã tạo tài khoản {createdAccount.email}.</strong> Mật khẩu tạm (chỉ hiện{' '}
          <u>đúng 1 lần</u>, hãy copy ngay và gửi cho người dùng qua kênh riêng — Slack/nói miệng,
          không gửi qua email):{' '}
          <code style={{ userSelect: 'all' }}>{createdAccount.temp_password}</code>{' '}
          <button type="button" className="btn" onClick={() => setCreatedAccount(null)}>
            Đóng
          </button>
        </div>
      )}

      {isAdmin && (
        <div style={{ marginBottom: '22px' }}>
          {!showCreateForm ? (
            <button type="button" className="btn btn-primary" onClick={() => setShowCreateForm(true)}>
              + Thêm tài khoản nhân viên
            </button>
          ) : (
            <form
              action={handleCreate}
              className="card"
              style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label htmlFor="full_name">Họ tên</label>
                <input id="full_name" name="full_name" type="text" required disabled={isPending} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label htmlFor="email">Email</label>
                <input id="email" name="email" type="email" required disabled={isPending} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label htmlFor="role">Vai trò</label>
                <select id="role" name="role" defaultValue="ss_team" disabled={isPending}>
                  <option value="ss_team">ss_team</option>
                  <option value="admin">admin</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending ? 'Đang tạo...' : 'Tạo tài khoản'}
              </button>
              <button type="button" className="btn" onClick={() => setShowCreateForm(false)} disabled={isPending}>
                Huỷ
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
                <th>Họ tên</th>
                <th>Email</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
                <th>Đăng nhập gần nhất</th>
                {isAdmin && <th>Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => {
                const isSelf = s.ss_user_id === currentUserId;
                return (
                  <tr key={s.ss_user_id}>
                    <td>
                      <strong>{s.full_name}</strong>
                      {isSelf && <span className="you-badge">Bạn</span>}
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
                    <td>{s.is_active ? 'Hoạt động' : 'Đã khoá'}</td>
                    <td className="muted">
                      {s.last_login_at ? new Date(s.last_login_at).toLocaleString('vi-VN') : 'Chưa đăng nhập'}
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
                              {s.is_active ? 'Khoá' : 'Mở khoá'}
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
        <div className="empty-state">Không có tài khoản nhân viên nào.</div>
      )}
    </div>
  );
}
