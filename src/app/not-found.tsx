import { getTranslations } from 'next-intl/server';
import { ErrorStateView } from '@/components/ui/error-boundary/ErrorStateView';

/**
 * Next.js gọi file này bất cứ khi nào `notFound()` được gọi ở 1
 * page/segment nào đó (jobs/[id], companies/[id], students/[id],
 * staff-activity/[userId]...) hoặc khi không route nào khớp URL.
 *
 * TRƯỚC ĐỢT NÀY: file này không tồn tại -> Next.js tự render trang 404
 * MẶC ĐỊNH của framework (không style, không sidebar) — hoàn toàn khác
 * Flask, nơi mọi lỗi 404 đều qua `@app.errorhandler(404)` ->
 * `templates/error.html` (tone="muted", xem app.py), vẫn `extends
 * base.html` nên giữ nguyên sidebar/nav.
 *
 * File này render bên trong `src/app/layout.tsx` (root layout bọc mọi
 * route) nên tự động có sidebar giống Flask, không cần làm gì thêm.
 */
export default async function NotFound() {
  const t = await getTranslations('notFound');

  return (
    <ErrorStateView
      eyebrow={t('eyebrow')}
      code="404"
      tone="muted"
      chipLabel={t('chipLabel')}
      title={t('title')}
      message={t('message')}
      primaryHref="/jobs"
      primaryLabel={t('primaryLabel')}
      backLabel={t('backLabel')}
    />
  );
}
