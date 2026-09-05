import Link from 'next/link';
import { searchPeople } from '@/app/actions/messages';
import { getCurrentUser } from '@/app/actions/auth';
import { roleLabel } from '@/lib/auth/roles';

/**
 * Trang tìm người để bắt đầu hội thoại mới
 * Corresponds to Flask: blueprints/messages.py::new_message() (templates/messages_new.html)
 * Route: /messages/new
 *
 * Form GET thường (không cần client component) — backend tự lọc kết
 * quả theo role người tìm, không lọc lại ở tầng FE (tránh 2 nơi cùng
 * chứa 1 luật nghiệp vụ dễ lệch nhau, giống comment gốc bên Flask).
 */
interface SearchParams {
  q?: string;
}

export default async function NewMessagePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q = '' } = await searchParams;
  const currentUser = await getCurrentUser();
  const isStudent = currentUser?.role === 'user';

  const results = q.trim() ? await searchPeople(q) : [];

  return (
    // BUG FIX (audit CSS 09/2026): bỏ "page-container" ảo.
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">Career Hub / Nhắn tin</span>
          <h1>Nhắn tin mới</h1>
          <p className="lede">
            {isStudent
              ? 'Tìm 1 SS/admin để gửi yêu cầu nhắn tin. Bạn cần được SS chấp nhận trước khi nhắn tiếp.'
              : 'Tìm học viên hoặc SS/admin khác để bắt đầu hội thoại.'}
          </p>
        </div>
        <Link className="btn btn-ghost" href="/messages">
          ← Quay lại tin nhắn
        </Link>
      </header>

      <form method="get" action="/messages/new" className="people-search-form">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Nhập tên..."
          autoFocus
          autoComplete="off"
        />
        <button type="submit" className="btn btn-primary">
          Tìm
        </button>
      </form>

      {q.trim() && (
        results.length > 0 ? (
          <div className="people-result-list">
            {results.map((person) => (
              <Link
                key={person.id}
                className="people-result-row"
                href={`/messages/${person.id}?name=${encodeURIComponent(
                  person.full_name
                )}&role=${encodeURIComponent(person.role)}`}
              >
                <div className="conversation-avatar">{person.full_name?.[0]?.toUpperCase() || '?'}</div>
                <div className="conversation-main">
                  <strong>{person.full_name}</strong>
                  <span className="role-chip">{roleLabel(person.role)}</span>
                </div>
                <span className="people-result-cta">Nhắn tin →</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>Không tìm thấy ai khớp với &quot;{q}&quot;.</p>
          </div>
        )
      )}
    </>
  );
}
