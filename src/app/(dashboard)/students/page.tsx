import { getStudents } from '@/app/actions/students';
import Link from 'next/link';

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
  const resolvedSearchParams = await searchParams;
  const students = await getStudents({ keyword: resolvedSearchParams.search });

  return (
    <div className="page-container">
      <div className="page-head">
        <div>
          <span className="eyebrow">Career Hub / Quản lý</span>
          <h1>Học viên</h1>
          <p className="lede">Tổng {students.length} tài khoản học viên</p>
        </div>
      </div>

      <div className="filter-bar" style={{ marginBottom: '22px' }}>
        <form method="get" action="/students" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input
            type="search"
            name="search"
            placeholder="Tìm theo tên hoặc email..."
            defaultValue={resolvedSearchParams.search}
            style={{ flex: '1 1 300px', minWidth: '200px' }}
          />
          <button type="submit" className="btn">Lọc</button>
          {resolvedSearchParams.search && (
            <Link href="/students" className="btn">Xóa bộ lọc</Link>
          )}
        </form>
      </div>

      {students.length > 0 ? (
        <div className="contact-table-wrap">
          <table className="contact-table">
            <thead>
              <tr>
                <th>Họ tên</th>
                <th>Email</th>
                <th>SĐT</th>
                <th>Lớp (track)</th>
                <th>Trạng thái</th>
                <th>Đăng nhập gần nhất</th>
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
                  <td>
                    {s.is_active ? (
                      <span className="status-chip status-open">Hoạt động</span>
                    ) : (
                      <span className="status-chip status-closed">Đã khoá</span>
                    )}
                  </td>
                  <td className="muted">
                    {s.last_login_at ? new Date(s.last_login_at).toLocaleString('vi-VN') : 'Chưa đăng nhập'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">Không tìm thấy học viên nào.</div>
      )}
    </div>
  );
}
