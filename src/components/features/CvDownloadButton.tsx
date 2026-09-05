'use client';

import { useState } from 'react';
import { getCvSignedUrl } from '@/app/actions/me';

/**
 * Nút "Xem CV" — tách ra thành component dùng chung, mirror logic vốn
 * chỉ có ở JobApplicantsPanel.tsx (trang chi tiết job). GET /me/applications/
 * {id}/cv-url yêu cầu role 'ss_team' trở lên (không phải "self" như tên
 * route gợi ý) — dùng được cho staff xem CV của BẤT KỲ application nào,
 * không riêng gì application của job đang xem.
 *
 * THÊM 09/2026 (rà soát #3, chat139) — trước đây action getCvSignedUrl()
 * chỉ được gọi ở JobApplicantsPanel, KHÔNG được gắn vào bảng "Đã ứng
 * tuyển" ở /students/[id] dù cùng 1 role được phép xem, cùng 1 action
 * đã có sẵn — thiếu sót thuần UI, không phải thiếu backend.
 */

interface CvDownloadButtonProps {
  applicationId: string;
}

export default function CvDownloadButton({ applicationId }: CvDownloadButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const result = await getCvSignedUrl(applicationId);
    setLoading(false);

    if (result.success && result.signedUrl) {
      window.open(result.signedUrl, '_blank', 'noopener,noreferrer');
    }
  }

  return (
    <button type="button" className="btn btn-text" onClick={handleClick} disabled={loading}>
      {loading ? 'Đang tải...' : 'Xem CV'}
    </button>
  );
}
