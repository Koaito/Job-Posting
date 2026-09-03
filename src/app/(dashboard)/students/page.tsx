import { getStudents } from '@/app/actions/students';

/**
 * Students (Học viên) List Page
 * Corresponds to Flask: templates/student_activity.html
 * Route: /students — chỉ hiện trên Sidebar cho isStaffRole()==true, nhưng
 * TỰ NÓ chưa chặn truy cập trực tiếp (xem ghi chú cuối file) vì đằng nào
 * GET /auth/users ở backend đã chặn cứng role<'ss_team' (403 -> listUsers()
 * trả mảng rỗng, không lộ dữ liệu).
 */

interface SearchParams {
  keyword?: string;
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const students = await getStudents({ keyword: resolvedSearchParams.keyword });

  return (
    <div className="page-container">
      <div className="page-head">
        <div>
          <span className="eyebrow">Career Hub / Quản lý</span>
          <h1>Học viên</h1>
          <p className="lede">Tổng {students.length} học viên đã đăng ký</p>
        </div>
      </div>

      <div className="filter-bar" style={{ marginBottom: '22px' }}>
        <form method="get" action="/students" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input
            type="search"
            name="keyword"
            placeholder="Tìm theo tên hoặc email..."
            defaultValue={resolvedSearchParams.keyword}
            style={{ flex: '1 1 300px', minWidth: '200px' }}
          />
          <button type="submit" className="btn">Lọc</button>
          {resolvedSearchParams.keyword && (
            <a href="/students" className="btn">Xóa bộ lọc</a>
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
                <th>Điện thoại</th>
                <th>Track</th>
                <th>Trạng thái</th>
                <th>Đăng ký lúc</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.ss_user_id}>
                  <td><strong>{student.full_name}</strong></td>
                  <td>{student.email}</td>
                  <td className={student.phone ? '' : 'muted'}>{student.phone || '—'}</td>
                  <td className={student.track ? '' : 'muted'}>{student.track || '—'}</td>
                  <td>
                    <span className={`fit-chip ${student.is_active ? '' : 'muted'}`}>
                      {student.is_active ? 'Đang hoạt động' : 'Đã khoá'}
                    </span>
                  </td>
                  <td className="muted">
                    {new Date(student.created_at).toLocaleDateString('vi-VN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <p>Không tìm thấy học viên nào.</p>
          {resolvedSearchParams.keyword && (
            <a href="/students" className="btn">Xóa bộ lọc</a>
          )}
        </div>
      )}
    </div>
  );
}
