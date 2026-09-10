import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
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
 *
 * i18n (đợt sau, 09/2026 — rà soát lại nhóm 5): trang này bị BỎ SÓT ở
 * đợt dịch 12 trang dashboard trước (không nằm trong danh sách đã dịch
 * dù nằm chung route group `/messages`). Dịch qua
 * `getTranslations('messagesNewPage')` (Server Component). roleLabel()
 * dùng chung `t` namespace `roles` — cùng đợt refactor với
 * lib/auth/roles.ts.
 */
interface SearchParams {
  q?: string;
}

export default async function NewMessagePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const t = await getTranslations('messagesNewPage');
  const tRole = await getTranslations('roles');
  const { q = '' } = await searchParams;
  const currentUser = await getCurrentUser();
  const isStudent = currentUser?.role === 'user';

  const results = q.trim() ? await searchPeople(q) : [];

  return (
    // BUG FIX (audit CSS 09/2026): bỏ "page-container" ảo.
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">{t('eyebrow')}</span>
          <h1>{t('title')}</h1>
          <p className="lede">
            {isStudent ? t('ledeStudent') : t('ledeStaff')}
          </p>
        </div>
        <Link className="btn btn-ghost" href="/messages">
          {t('backLink')}
        </Link>
      </header>

      <form method="get" action="/messages/new" className="people-search-form">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder={t('searchPlaceholder')}
          autoFocus
          autoComplete="off"
        />
        <button type="submit" className="btn btn-primary">
          {t('searchButton')}
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
                  <span className="role-chip">{roleLabel(person.role, tRole)}</span>
                </div>
                <span className="people-result-cta">{t('messageCta')}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>{t('emptyState', { q })}</p>
          </div>
        )
      )}
    </>
  );
}
