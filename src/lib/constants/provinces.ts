/**
 * Nguồn sự thật duy nhất cho danh sách tỉnh/thành dùng trong form
 * Job/Company và filter list job/company.
 *
 * REFACTOR (audit 09/2026, "Đánh giá kiến trúc" #1): trước đây
 * PROVINCE_OPTIONS + PROVINCE_LABEL_KEY bị copy-paste y hệt ở 4 nơi
 * (CompanyForm.tsx, JobForm.tsx, jobs/page.tsx, companies/page.tsx) —
 * không có 1 nguồn sự thật, sửa 1 chỗ rất dễ quên 3 chỗ còn lại. Gom về
 * đây, mọi nơi import lại thay vì tự khai riêng.
 *
 * CHỈ có 3 lựa chọn (Hà Nội/Hồ Chí Minh/Đà Nẵng), cố tình KHÔNG lấy lại
 * danh sách 63 tỉnh của Flask gốc (constants.py::CITIES_VN, dùng "TP. Hồ
 * Chí Minh" có tiền tố "TP.") vì province_name là field dùng chung giữa
 * Job và Company — nếu 2 form ghi 2 chuỗi khác nhau cho cùng 1 thành phố
 * thì lọc theo tỉnh sẽ không khớp chéo được. Việc mở rộng đủ 63 tỉnh
 * nên làm 1 lần cho mọi nơi dùng constant này, không phải việc riêng
 * của 1 form/trang.
 *
 * value giữ nguyên tiếng Việt có dấu (khớp province_name backend lưu),
 * PROVINCE_LABEL_KEY chỉ dùng để tra label hiển thị theo locale qua
 * namespace i18n "provinces" (dùng chung giữa CompanyForm/JobForm/
 * jobs/page.tsx/companies/page.tsx).
 */
export const PROVINCE_OPTIONS = ['Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng'] as const;

export type ProvinceOption = (typeof PROVINCE_OPTIONS)[number];

export const PROVINCE_LABEL_KEY: Record<ProvinceOption, 'hanoi' | 'hcm' | 'danang'> = {
  'Hà Nội': 'hanoi',
  'Hồ Chí Minh': 'hcm',
  'Đà Nẵng': 'danang',
};
