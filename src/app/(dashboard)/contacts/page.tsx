import Link from 'next/link';
import { getContacts } from '@/app/actions/contacts';
import { getCurrentUser } from '@/app/actions/auth';
import { isStaffRole } from '@/lib/auth/roles';

/**
 * Contacts List Page — danh sách liên hệ HR GỘP TẤT CẢ công ty.
 * Corresponds to Flask: templates/contacts.html
 * Backend thật: GET /contacts (api/routers/contacts.py::list_all_contacts)
 * — require_role("ss_team"), dữ liệu nhạy cảm (email/SĐT cá nhân).
 *
 * Trước đây "🚧 đang phát triển (Phase 4)" — actions/contacts.ts giờ
 * đã đủ. Thao tác thêm/sửa/gán/xoá liên hệ nằm ở CompanyContactsManager
 * trên trang chi tiết công ty (cần company_id để gọi đúng route lồng)
 * — trang này CHỈ đọc + tìm kiếm, mỗi hàng link sang company detail để
 * thao tác, giữ đúng phạm vi route thật của backend (GET /contacts
 * không có body sửa liên hệ).
 */

interface SearchParams {
  search?: string;
  contact_status?: string;
  include_inactive?: string;
  page?: string;
}

const CONTACT_STATUS_OPTIONS = [
  { value: 'UNCONTACTED', label: 'Chưa liên hệ' },
  { value: 'EMAIL_SENT', label: 'Đã gửi email' },
  { value: 'RESPONDED', label: 'Đã phản hồi' },
  { value: 'IN_PARTNERSHIP', label: 'Đang hợp tác' },
];

function statusLabel(status: string): string {
  return CONTACT_STATUS_OPTIONS.find((o) => o.value === status)?.label || status;
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const currentUser = await getCurrentUser();
  const isStaff = isStaffRole(currentUser?.role);

  if (!isStaff) {
    return (
      <div className="page-container">
        <div className="page-head">
          <h1>Liên hệ</h1>
        </div>
        <div className="empty-state">
          <p>Trang này chỉ dành cho nhân viên (ss_team/admin).</p>
        </div>
      </div>
    );
  }

  const page = parseInt(sp.page || '1');
  const limit = 50;
  const offset = (page - 1) * limit;

  /**
   * BUG FIX (09/2026): GET /contacts backend không hỗ trợ limit/offset
   * thật (xem actions/contacts.ts::getContacts) — luôn trả về TOÀN BỘ
   * contact khớp filter trong 1 mảng trần. Trước đây code destructure
   * { items, total } từ mảng này → cả 2 thành undefined → contacts.length
   * throw TypeError, sập cả trang. Sửa: gọi getContacts() lấy mảng đầy
   * đủ, rồi tự phân trang phía FE bằng slice theo page/limit.
   */
  const allContacts = await getContacts({
    search: sp.search,
    contact_status: sp.contact_status,
    include_inactive: sp.include_inactive === 'true',
  });

  const total = allContacts.length;
  const contacts = allContacts.slice(offset, offset + limit);

  const totalPages = Math.ceil(total / limit);
  const hasFilters = Boolean(sp.search || sp.contact_status || sp.include_inactive === 'true');
  const qs = (p: number) =>
    `/contacts?page=${p}` +
    (sp.search ? `&search=${sp.search}` : '') +
    (sp.contact_status ? `&contact_status=${sp.contact_status}` : '') +
    (sp.include_inactive === 'true' ? `&include_inactive=true` : '');

  return (
    <div className="page-container">
      <div className="page-head">
        <div>
          <span className="eyebrow">Career Hub / Doanh nghiệp</span>
          <h1>Liên hệ HR</h1>
          <p className="lede">Toàn bộ liên hệ HR đã thu thập, gộp mọi công ty.</p>
        </div>
      </div>

      <div className="filter-bar" style={{ marginBottom: '22px' }}>
        <form method="get" action="/contacts" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input
            type="search"
            name="search"
            placeholder="Tìm theo tên liên hệ..."
            defaultValue={sp.search}
            style={{ flex: '1 1 300px', minWidth: '200px' }}
          />
          <select name="contact_status" defaultValue={sp.contact_status || ''}>
            <option value="">Mọi trạng thái</option>
            {CONTACT_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input type="checkbox" name="include_inactive" value="true" defaultChecked={sp.include_inactive === 'true'} />
            Kèm liên hệ đã xoá
          </label>
          <button type="submit" className="btn">Lọc</button>
          {hasFilters && <Link href="/contacts" className="btn">Xóa lọc</Link>}
        </form>
      </div>

      <p className="result-count">
        {total} liên hệ phù hợp{contacts.length > 0 ? ` — hiển thị ${offset + 1}–${offset + contacts.length}` : ''}
      </p>

      {contacts.length > 0 ? (
        <>
          <div className="contact-table-wrap">
            <table className="contact-table">
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Công ty</th>
                  <th>Chức vụ</th>
                  <th>Email / SĐT</th>
                  <th>Trạng thái</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.contact_id} style={!c.is_active ? { opacity: 0.6 } : undefined}>
                    <td>
                      <strong>{c.contact_name}</strong>
                      {!c.is_active && <span className="muted"> (đã xoá)</span>}
                    </td>
                    <td>
                      <Link href={`/companies/${c.company_id}`}>{c.company_name}</Link>
                    </td>
                    <td className="muted">{c.job_title || '—'}</td>
                    <td className="muted">
                      {c.work_email || '—'}
                      {c.phone_number && <div>{c.phone_number}</div>}
                    </td>
                    <td>
                      <span className="status-chip">{statusLabel(c.contact_status)}</span>
                    </td>
                    <td className="actions-cell">
                      <Link className="btn btn-text" href={`/companies/${c.company_id}`}>
                        Xem tại công ty
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              {page > 1 && (
                <Link href={qs(page - 1)} className="page-btn">← Trang trước</Link>
              )}
              <span className="page-status">Trang {page} / {totalPages}</span>
              {page < totalPages && (
                <Link href={qs(page + 1)} className="page-btn">Trang sau →</Link>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">
          <p>Chưa có liên hệ nào khớp bộ lọc.</p>
          {hasFilters && <Link href="/contacts" className="btn">Xóa bộ lọc</Link>}
        </div>
      )}
    </div>
  );
}
