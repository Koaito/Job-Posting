import { getStudents } from '@/app/actions/students';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

/**
 * Students List Page (Học viên)
 * Corresponds to Flask: blueprints/students.py (templates/students/index.html)
 * Route: /students
 *
 * Mới 09/2026 — trước đây thư mục students/ hoàn toàn rỗng, menu Sidebar
 * có link nhưng bấm vào ra 404 thật (xem CHANGES_09-2026.md). Dữ liệu lấy
 * qua getStudents() (actions/students.ts, mới thêm cùng đợt) — lọc
 * role==='user' từ GET /auth/users, KHÔNG có endpoint backend riêng.
 */

interface SearchParams {
  search?: string;
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const t = await getTranslations('studentsPage');
  const resolvedSearchParams = await searchParams;
  const students = await getStudents({ keyword: resolvedSearchParams.search });

  return (
    // BUG FIX (audit CSS 09/2026): bỏ div "page-container" bọc ngoài —
    // class ảo, main.content (root layout.tsx) đã lo container rồi
    // (giống fix ở jobs/page.tsx, companies/page.tsx).
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">{t('eyebrow')}</span>
          <h1>{t('title')}</h1>
          <p className="lede">{t('lede', { count: students.length })}</p>
        </div>
      </div>

      <div className="filter-bar" style={{ marginBottom: '22px' }}>
        <form method="get" action="/students" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input
            type="search"
            name="search"
            placeholder={t('searchPlaceholder')}
            defaultValue={resolvedSearchParams.search}
            style={{ flex: '1 1 300px', minWidth: '200px' }}
          />
          <button type="submit" className="btn">{t('filterButton')}</button>
          {resolvedSearchParams.search && (
            <Link href="/students" className="btn">{t('clearFilters')}</Link>
          )}
        </form>
      </div>

      {students.length > 0 ? (
        <div className="contact-table-wrap">
          <table className="contact-table">
            <thead>
              <tr>
                <th>{t('colName')}</th>
                <th>{t('colEmail')}</th>
                <th>{t('colPhone')}</th>
                <th>{t('colTrack')}</th>
                <th>{t('colStatus')}</th>
                <th>{t('colLastLogin')}</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.ss_user_id}>
                  <td>
                    <Link href={`/students/${s.ss_user_id}`}>
                      <strong>{s.full_name}</strong>
                    </Link>
                  </td>
                  <td className="muted">{s.email}</td>
                  <td className="muted">{s.phone || '—'}</td>
                  <td className="muted">{s.track || '—'}</td>
                  {/* BUG FIX (audit CSS 09/2026): cùng bug với
                      StaffAccountsManager.tsx — "status-chip status-open/
                      status-closed" là class domain job, mượn sai nên
                      mất màu. Flask gốc hiện trạng thái tài khoản bằng
                      chữ thường, không chip (xem staff_accounts.html) —
                      chưa có class CSS riêng cho domain này nên bỏ chip
                      mượn nhầm thay vì tự chế class mới. */}
                  <td>{s.is_active ? t('statusActive') : t('statusLocked')}</td>
                  <td className="muted">
                    {/* CỐ Ý CHƯA dịch: toLocaleString('vi-VN') — thuộc
                        phạm vi Polish, không xử lý ở đợt Language này. */}
                    {s.last_login_at ? new Date(s.last_login_at).toLocaleString('vi-VN') : t('neverLoggedIn')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">{t('empty')}</div>
      )}
    </>
  );
}
