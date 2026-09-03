'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createStaffAccount,
  updateStaffRole,
  updateStaffActiveStatus,
} from '@/app/actions/staff';
import type { User } from '@/types/auth';

/**
 * Staff Accounts Manager (audit 09/2026 #13)
 * Corresponds to Flask: templates/staff_accounts.html + staff_account_add.html
 *
 * Chỉ render form thêm/đổi role/khoá khi currentUserRole === 'admin' —
 * đúng ràng buộc backend (require_admin trên cả 3 route ghi, xem
 * api/routers/auth_users.py). ss_team xem được bảng (đã lọc ở trang cha)
 * nhưng KHÔNG thấy các nút hành động này.
 */

const ROLE_LABELS: Record<string, string> = {
  user: 'Học viên',
  ss_team: 'Team SS',
  admin: 'Admin',
};

interface StaffAccountsManagerProps {
  staff: User[];
  currentUserId: string;
  isAdmin: boolean;
}

export default function StaffAccountsManager({
  staff,
  currentUserId,
  isAdmin,
}: StaffAccountsManagerProps) {
  const router = useRouter();
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newAccount, setNewAccount] = useState<{ full_name: string; email: string; temp_password: string } | null>(null);

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const result = await createStaffAccount({
      full_name: String(formData.get('full_name') || ''),
      email: String(formData.get('email') || ''),
      role: String(formData.get('role') || 'ss_team'),
    });

    setIsSubmitting(false);

    if (result.success && result.user) {
      // BUG FIX ý tưởng lấy từ bản Flask gốc (session["new_staff_account"]):
      // temp_password CHỈ trả về đúng 1 lần trong response này — phải hiện
      // ngay tại đây, load lại danh sách (GET /auth/users) sau đó sẽ không
      // còn thấy được nữa.
      setNewAccount({
        full_name: result.user.full_name,
        email: result.user.email,
        temp_password: result.user.temp_password,
      });
      setShowAddForm(false);
      router.refresh();
    } else {
      setError(result.error || 'Không thể tạo tài khoản');
    }
  };

  const handleRoleChange = async (id: string, role: string) => {
    setError(null);
    const result = await updateStaffRole(id, role);
    if (result.success) {
      router.refresh();
    } else {
      setError(result.error || 'Không thể đổi role');
    }
  };

  const handleActiveToggle = async (id: string, nextActive: boolean) => {
    setError(null);
    const result = await updateStaffActiveStatus(id, nextActive);
    if (result.success) {
      router.refresh();
    } else {
      setError(result.error || 'Không thể cập nhật trạng thái tài khoản');
    }
  };

  return (
    <div>
      {/* Dùng đúng class CSS thật đang có (public/css/09-misc-toasts.css:
          .flash/.flash-error/.flash-success) — KHÔNG dùng "alert alert-*"
          như JobForm.tsx đang lỡ dùng (class đó không tồn tại ở đâu trong
          public/css/, ô báo lỗi hiện không có style gì, xem audit riêng). */}
      {error && <div className="flash flash-error" style={{ marginBottom: '16px' }}>{error}</div>}

      {newAccount && (
        <div className="flash flash-success" style={{ marginBottom: '16px' }}>
          Đã tạo tài khoản cho <strong>{newAccount.full_name}</strong> ({newAccount.email}).
          Mật khẩu tạm: <code>{newAccount.temp_password}</code> — chỉ hiện được 1 lần, hãy gửi
          ngay cho người dùng.
        </div>
      )}

      {isAdmin && (
        <div style={{ marginBottom: '22px' }}>
          {!showAddForm ? (
            <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
              + Thêm tài khoản
            </button>
          ) : (
            <form onSubmit={handleAdd} className="card form-card" style={{ maxWidth: '480px' }}>
              <h3>Thêm tài khoản nhân viên</h3>
              <div className="form-grid">
                <div className="form-field form-field-full">
                  <label htmlFor="full_name">Họ tên</label>
                  <input type="text" id="full_name" name="full_name" required />
                </div>
                <div className="form-field form-field-full">
                  <label htmlFor="email">Email</label>
                  <input type="email" id="email" name="email" required />
                </div>
                <div className="form-field form-field-full">
                  <label htmlFor="role">Role</label>
                  <select id="role" name="role" defaultValue="ss_team">
                    <option value="ss_team">Team SS</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Đang tạo...' : 'Tạo tài khoản'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddForm(false)}
                  disabled={isSubmitting}
                >
                  Hủy
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="contact-table-wrap">
        <table className="contact-table">
          <thead>
            <tr>
              <th>Họ tên</th>
              <th>Email</th>
              <th>Role</th>
              <th>Trạng thái</th>
              {isAdmin && <th>Hành động</th>}
            </tr>
          </thead>
          <tbody>
            {staff.map((member) => {
              const isSelf = member.ss_user_id === currentUserId;
              return (
                <tr key={member.ss_user_id}>
                  <td><strong>{member.full_name}</strong></td>
                  <td>{member.email}</td>
                  <td>
                    {isAdmin && !isSelf ? (
                      <select
                        defaultValue={member.role}
                        onChange={(e) => handleRoleChange(member.ss_user_id, e.target.value)}
                      >
                        <option value="ss_team">Team SS</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      ROLE_LABELS[member.role] || member.role
                    )}
                  </td>
                  <td>
                    <span className={`fit-chip ${member.is_active ? '' : 'muted'}`}>
                      {member.is_active ? 'Đang hoạt động' : 'Đã khoá'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td>
                      {!isSelf ? (
                        <button
                          className="btn btn-sm"
                          onClick={() => handleActiveToggle(member.ss_user_id, !member.is_active)}
                        >
                          {member.is_active ? 'Khoá' : 'Mở khoá'}
                        </button>
                      ) : (
                        <span className="muted">Chính bạn</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
