'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { User } from '@/types/auth';
import { roleLabel } from '@/lib/auth/roles';

/**
 * Bảng danh sách nhân viên ở `/staff-activity` — lọc client-side theo
 * tên/email, KHÔNG reload trang. Khớp hành vi
 * `templates/staff_activity.html` gốc bên Flask (script thuần, lọc
 * ngay trên bảng đã render sẵn) — số lượng nhân sự team SS luôn nhỏ,
 * không cần round-trip server cho mỗi lần gõ.
 */
export interface StaffActivityListProps {
  staff: User[];
  currentUserId: string;
}

export function StaffActivityList({ staff, currentUserId }: StaffActivityListProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter(
      (s) => s.full_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
    );
  }, [staff, query]);

  return (
    <>
      <div className="filter-bar">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm theo họ tên, email…"
          autoComplete="off"
        />
      </div>
      <p className="result-count">
        Hiển thị {filtered.length} / {staff.length} thành viên
      </p>

      <div className="contact-table-wrap">
        <table className="contact-table">
          <thead>
            <tr>
              <th>Họ tên</th>
              <th>Email</th>
              <th>Vai trò</th>
              <th>Ngày tạo tài khoản</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const isSelf = s.ss_user_id === currentUserId;
              return (
                <tr key={s.ss_user_id}>
                  <td>
                    <strong>{s.full_name}</strong>
                    {isSelf && <span className="you-badge">Bạn</span>}
                  </td>
                  <td className="muted">{s.email}</td>
                  <td>
                    <span className="role-chip">{roleLabel(s.role)}</span>
                  </td>
                  <td className="muted">{new Date(s.created_at).toLocaleDateString('vi-VN')}</td>
                  <td className="actions-cell">
                    {isSelf ? (
                      <Link className="btn btn-text" href="/profile/activity">
                        Xem tại Trang cá nhân →
                      </Link>
                    ) : (
                      <Link className="btn btn-text" href={`/staff-activity/${s.ss_user_id}`}>
                        Xem hoạt động →
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
