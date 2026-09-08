import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getContacts } from '@/app/actions/contacts';
import { getEmailTemplates, getPlaceholderHelp } from '@/app/actions/email-templates';
import { getCurrentUser } from '@/app/actions/auth';
import { isStaffRole } from '@/lib/auth/roles';
import EmailTemplateManager from '@/components/features/EmailTemplateManager';

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
 *
 * THÊM 09/2026 (rà soát #3, chat139) — thêm tab thứ 2 "Quản lý mẫu
 * email" (?tab=quan-ly), khớp templates/contacts.html Flask gốc (2 tab:
 * danh-sach + quan-ly, dùng chung 1 <nav class="tab-nav"> với /activity).
 * Trước đợt này Next.js chỉ có mỗi tab "danh-sach", module mẫu email
 * hoàn toàn chưa có (0 action, 0 UI) dù CSS đã chuẩn bị sẵn.
 */

interface SearchParams {
  tab?: string;
  search?: string;
  contact_status?: string;
  include_inactive?: string;
  page?: string;
}

const CONTACT_STATUS_VALUES = ['UNCONTACTED', 'EMAIL_SENT', 'RESPONDED', 'IN_PARTNERSHIP'] as const;

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const currentUser = await getCurrentUser();
  const isStaff = isStaffRole(currentUser?.role);
  const t = await getTranslations('contacts');
  const tStatus = await getTranslations('contactStatus');
  const statusLabel = (status: string): string => {
    // tStatus() throws nếu key không tồn tại trong messages/*.json — chỉ
    // gọi khi chắc chắn status nằm trong CONTACT_STATUS_VALUES, fallback
    // về giá trị thô nếu backend trả status lạ chưa từng gặp.
    return (CONTACT_STATUS_VALUES as readonly string[]).includes(status)
      ? tStatus(status as (typeof CONTACT_STATUS_VALUES)[number])
      : status;
  };

  if (!isStaff) {
    return (
      // BUG FIX (audit CSS 09/2026): bỏ "page-container" ảo — main.content
      // (root layout.tsx) đã lo container rồi.
      <>
        <div className="page-head">
          <h1>{t('title')}</h1>
        </div>
        <div className="empty-state">
          <p>{t('staffOnly')}</p>
        </div>
      </>
    );
  }

  const tab = sp.tab === 'quan-ly' ? 'quan-ly' : 'danh-sach';

  const tabNav = (
    <nav className="tab-nav" style={{ marginBottom: '22px' }}>
      <Link href="/contacts?tab=danh-sach" className={tab !== 'quan-ly' ? 'active' : ''}>
        {t('tabList')}
      </Link>
      <Link href="/contacts?tab=quan-ly" className={tab === 'quan-ly' ? 'active' : ''}>
        {t('tabManage')}
      </Link>
    </nav>
  );

  if (tab === 'quan-ly') {
    const [templates, placeholderHelp] = await Promise.all([getEmailTemplates(), getPlaceholderHelp()]);
    return (
      <>
        <div className="page-head">
          <div>
            <span className="eyebrow">{t('eyebrow')}</span>
            <h1>{t('manageTitle')}</h1>
          </div>
        </div>
        {tabNav}
        <EmailTemplateManager initialTemplates={templates} placeholderHelp={placeholderHelp} />
      </>
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
    // BUG FIX (audit CSS 09/2026): bỏ "page-container" ảo — main.content
    // (root layout.tsx) đã lo container rồi.
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">{t('eyebrow')}</span>
          <h1>{t('listTitle')}</h1>
          <p className="lede">{t('listSubtitle')}</p>
        </div>
      </div>

      {tabNav}

      <div className="filter-bar" style={{ marginBottom: '22px' }}>
        <form method="get" action="/contacts" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input
            type="search"
            name="search"
            placeholder={t('searchPlaceholder')}
            defaultValue={sp.search}
            style={{ flex: '1 1 300px', minWidth: '200px' }}
          />
          <select name="contact_status" defaultValue={sp.contact_status || ''}>
            <option value="">{t('allStatuses')}</option>
            {CONTACT_STATUS_VALUES.map((value) => (
              <option key={value} value={value}>{tStatus(value)}</option>
            ))}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input type="checkbox" name="include_inactive" value="true" defaultChecked={sp.include_inactive === 'true'} />
            {t('includeInactive')}
          </label>
          <button type="submit" className="btn">{t('filterBtn')}</button>
          {hasFilters && <Link href="/contacts" className="btn">{t('clearFilter')}</Link>}
        </form>
      </div>

      <p className="result-count">
        {contacts.length > 0
          ? t('resultCountShowing', { total, from: offset + 1, to: offset + contacts.length })
          : t('resultCount', { total })}
      </p>

      {contacts.length > 0 ? (
        <>
          <div className="contact-table-wrap">
            <table className="contact-table">
              <thead>
                <tr>
                  <th>{t('colName')}</th>
                  <th>{t('colCompany')}</th>
                  <th>{t('colJobTitle')}</th>
                  <th>{t('colEmailPhone')}</th>
                  <th>{t('colStatus')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.contact_id} style={!c.is_active ? { opacity: 0.6 } : undefined}>
                    <td>
                      <strong>{c.contact_name}</strong>
                      {!c.is_active && <span className="muted">{t('deletedSuffix')}</span>}
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
                      {/* BUG FIX (audit CSS 09/2026): "status-chip" không
                          có màu cho contact_status — CSS thật không hề
                          định nghĩa domain này dạng chip màu, Flask gốc
                          (_contact_status_cell.html) hiện trạng thái bằng
                          chữ thường trong 1 <summary class="btn btn-text">
                          (mở dropdown đổi trạng thái), không phải badge
                          màu. Bỏ .status-chip mượn nhầm, không tự chế
                          class mới không tồn tại trong style.css. */}
                      {statusLabel(c.contact_status)}
                    </td>
                    <td className="actions-cell">
                      <Link className="btn btn-text" href={`/companies/${c.company_id}`}>
                        {t('viewAtCompany')}
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
                <Link href={qs(page - 1)} className="page-btn">{t('prevPage')}</Link>
              )}
              <span className="page-status">{t('pageStatus', { page, totalPages })}</span>
              {page < totalPages && (
                <Link href={qs(page + 1)} className="page-btn">{t('nextPage')}</Link>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">
          <p>{t('emptyFiltered')}</p>
          {hasFilters && <Link href="/contacts" className="btn">{t('clearFilters')}</Link>}
        </div>
      )}
    </>
  );
}
