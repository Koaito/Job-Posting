'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import type { User } from '@/types/auth';
import { roleLabel } from '@/lib/auth/roles';
import { toIntlLocale } from '@/i18n/config';

/**
 * Bảng danh sách nhân viên ở `/staff-activity` — lọc client-side theo
 * tên/email, KHÔNG reload trang. Khớp hành vi
 * `templates/staff_activity.html` gốc bên Flask (script thuần, lọc
 * ngay trên bảng đã render sẵn) — số lượng nhân sự team SS luôn nhỏ,
 * không cần round-trip server cho mỗi lần gõ.
 *
 * i18n (Giai đoạn 2, nhóm 5, 09/2026): dịch text riêng của component
 * này qua useTranslations('staffActivityList'). `roleLabel()` (lib/auth/
 * roles.ts) giờ đã dịch theo `t` namespace `roles` (đợt sau).
 * `toLocaleDateString()` giờ dùng `dateLocale` (qua `useLocale()` — bản
 * Client Component của `getLocale()`) theo locale hiện tại (Polish,
 * 09/2026) thay vì hard-code `'vi-VN'`.
 */
export interface StaffActivityListProps {
  staff: User[];
  currentUserId: string;
}

export function StaffActivityList({ staff, currentUserId }: StaffActivityListProps) {
  const t = useTranslations('staffActivityList');
  const tRole = useTranslations('roles');
  const dateLocale = toIntlLocale(useLocale());
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
          placeholder={t('searchPlaceholder')}
          autoComplete="off"
        />
      </div>
      <p className="result-count">
        {t('resultCount', { shown: filtered.length, total: staff.length })}
      </p>

      <div className="contact-table-wrap">
        <table className="contact-table">
          <thead>
            <tr>
              <th>{t('colFullName')}</th>
              <th>{t('colEmail')}</th>
              <th>{t('colRole')}</th>
              <th>{t('colCreatedAt')}</th>
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
                    {isSelf && <span className="you-badge">{t('youBadge')}</span>}
                  </td>
                  <td className="muted">{s.email}</td>
                  <td>
                    <span className="role-chip">{roleLabel(s.role, tRole)}</span>
                  </td>
                  <td className="muted">{new Date(s.created_at).toLocaleDateString(dateLocale)}</td>
                  <td className="actions-cell">
                    {isSelf ? (
                      <Link className="btn btn-text" href="/profile/activity">
                        {t('viewOwnProfile')}
                      </Link>
                    ) : (
                      <Link className="btn btn-text" href={`/staff-activity/${s.ss_user_id}`}>
                        {t('viewActivity')}
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
