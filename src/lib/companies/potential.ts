/**
 * partnership_potential display helpers (audit 09/2026 #16)
 *
 * BUG PHÁT HIỆN: public/css/04-job-cards.css chỉ định nghĩa màu cho
 * `.potential-Cao` / `.potential-Trung-bình` / `.potential-Thấp` /
 * `.potential-Chưa-đánh-giá` (nhãn tiếng Việt — style cũ từ thời Flask,
 * xem mindx-jobs/constants.py::PARTNERSHIP_POTENTIAL_MAP). Nhưng giá
 * trị THẬT mà backend FastAPI trả về (CompanyOut.partnership_potential,
 * xem api/schemas/companies.py) lại là tiếng Anh: HIGH | MEDIUM | LOW |
 * UNVERIFIED. Nếu build class trực tiếp bằng `potential-${value}` (kiểu
 * JobForm.tsx đang làm với level_code — chỗ đó AN TOÀN vì level_code
 * backend vốn đã là tiếng Anh khớp sẵn) thì ở đây sẽ ra
 * `.potential-HIGH` — KHÔNG khớp CSS nào cả, chip mất màu, không lỗi gì
 * hiện ra nên rất dễ bỏ sót khi review. Phải tự map lại thủ công.
 *
 * i18n (đợt sau, 09/2026): tách "label hiển thị" (đổi theo locale, qua
 * `t` — namespace mới `partnershipPotential`) khỏi "label suy ra class
 * CSS" (LUÔN cố định tiếng Việt, KHÔNG được đổi theo locale — nếu đổi,
 * `.potential-High` sẽ không khớp CSS thật `.potential-Cao` nữa và chip
 * mất màu y hệt bug gốc mô tả ở trên). `partnershipPotentialClass()`
 * vì vậy giữ nguyên hành vi cũ, không nhận `t`.
 */

export const PARTNERSHIP_POTENTIAL_VALUES = ['UNVERIFIED', 'LOW', 'MEDIUM', 'HIGH'] as const;

/** CHỈ dùng nội bộ để suy tên class CSS — không hiển thị trực tiếp cho người dùng. */
const CSS_CLASS_LABEL_BY_VALUE: Record<string, string> = {
  UNVERIFIED: 'Chưa đánh giá',
  LOW: 'Thấp',
  MEDIUM: 'Trung bình',
  HIGH: 'Cao',
};

export function partnershipPotentialLabel(
  value: string,
  t: (key: string) => string
): string {
  return (PARTNERSHIP_POTENTIAL_VALUES as readonly string[]).includes(value) ? t(value) : value;
}

/** Trả class CSS đúng (`.potential-Cao`, ...) — xem docstring đầu file. */
export function partnershipPotentialClass(value: string): string {
  const label = CSS_CLASS_LABEL_BY_VALUE[value] || 'Chưa đánh giá';
  return `potential-${label.replace(/ /g, '-')}`;
}
