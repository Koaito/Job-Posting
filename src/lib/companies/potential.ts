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
 */

export const PARTNERSHIP_POTENTIAL_OPTIONS = [
  { value: 'UNVERIFIED', label: 'Chưa đánh giá' },
  { value: 'LOW', label: 'Thấp' },
  { value: 'MEDIUM', label: 'Trung bình' },
  { value: 'HIGH', label: 'Cao' },
] as const;

const LABEL_BY_VALUE: Record<string, string> = Object.fromEntries(
  PARTNERSHIP_POTENTIAL_OPTIONS.map((o) => [o.value, o.label])
);

export function partnershipPotentialLabel(value: string): string {
  return LABEL_BY_VALUE[value] || value;
}

/** Trả class CSS đúng (`.potential-Cao`, ...) — xem docstring đầu file. */
export function partnershipPotentialClass(value: string): string {
  const label = LABEL_BY_VALUE[value] || 'Chưa đánh giá';
  return `potential-${label.replace(/ /g, '-')}`;
}
