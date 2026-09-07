/**
 * Tests for src/lib/api/client.ts::getApiKey()
 *
 * Bug #8 (audit 09/2026): trước đây MỌI Server Action tự khai
 * "const API_KEY = process.env.CRAWLER_API_KEY" rồi dùng "API_KEY!"
 * (non-null assertion) khi build header — nếu thiếu biến môi trường,
 * "!" chỉ ép kiểu cho TypeScript, KHÔNG kiểm tra thật ở runtime: header
 * "X-API-Key" sẽ gửi literal string "undefined" lên backend thay vì
 * báo lỗi rõ ràng. Đối chiếu Flask gốc (backend_auth.py::_headers()):
 * bản gốc LUÔN raise lỗi rõ ràng ngay khi thiếu CRAWLER_API_KEY, trước
 * khi build request. getApiKey() khôi phục đúng hành vi này.
 */

import { formatErrorDetail } from '@/lib/api/client';

// formatErrorDetail() giờ là async (Giai đoạn 3, 09/2026): cần đọc cookie
// "locale" để quyết định có tra bảng dịch error_code hay không (xem
// resolveErrorMessage() trong client.ts). Mock next/headers giống pattern
// dùng chung ở các test action khác (vd src/__tests__/actions/me.test.ts).
const mockCookieGet = jest.fn();
jest.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ get: mockCookieGet }),
}));

describe('getApiKey()', () => {
  const ORIGINAL_ENV = process.env.CRAWLER_API_KEY;

  afterEach(() => {
    // Khôi phục lại giá trị mock chung của jest.setup.js sau mỗi test,
    // tránh rò rỉ sang các test file khác chạy cùng worker.
    process.env.CRAWLER_API_KEY = ORIGINAL_ENV;
    jest.resetModules();
  });

  it('should return the API key when CRAWLER_API_KEY is set', async () => {
    process.env.CRAWLER_API_KEY = 'test-api-key';
    const { getApiKey } = await import('@/lib/api/client');

    expect(getApiKey()).toBe('test-api-key');
  });

  it('should throw a clear error when CRAWLER_API_KEY is missing', async () => {
    delete process.env.CRAWLER_API_KEY;
    jest.resetModules();
    const { getApiKey } = await import('@/lib/api/client');

    // Trước đây (API_KEY!) trường hợp này ÂM THẦM gửi header
    // "X-API-Key: undefined" lên backend — giờ phải throw ngay, không
    // để lọt 1 request thiếu key nào ra ngoài.
    expect(() => getApiKey()).toThrow(/CRAWLER_API_KEY/);
  });

  it('should throw when CRAWLER_API_KEY is an empty string', async () => {
    process.env.CRAWLER_API_KEY = '';
    jest.resetModules();
    const { getApiKey } = await import('@/lib/api/client');

    expect(() => getApiKey()).toThrow(/CRAWLER_API_KEY/);
  });
});

/**
 * Tests for formatErrorDetail() — Giai đoạn 0 (09/2026).
 *
 * Trọng tâm: case object {error_code, message} (5 chỗ ở api/deps.py) —
 * TRƯỚC bug fix, nhánh object chỉ JSON.stringify(detail), nghĩa là user
 * thấy nguyên chuỗi JSON thô (`{"error_code":"token_expired",...}`) thay
 * vì message tiếng Việt. Test dưới đây khoá đúng hành vi MỚI: đọc
 * detail.message khi có, chỉ JSON.stringify khi object không có field
 * message dạng string (shape lạ, chưa từng gặp thật).
 */
describe('formatErrorDetail()', () => {
  beforeEach(() => {
    // Mặc định không có cookie "locale" -> DEFAULT_LOCALE ("vi"), giống
    // hành vi trước khi có Giai đoạn 3 cho mọi test không tự set khác đi.
    mockCookieGet.mockReset();
    mockCookieGet.mockReturnValue(undefined);
  });

  it('trả nguyên văn khi detail là string', async () => {
    expect(await formatErrorDetail('Email hoặc mật khẩu không đúng.')).toBe(
      'Email hoặc mật khẩu không đúng.'
    );
  });

  it('nối các message trong mảng lỗi Pydantic kèm tên field (loc)', async () => {
    const detail = [
      { loc: ['body', 'email'], msg: 'field required', type: 'missing' },
      { loc: ['body', 'password'], msg: 'string too short', type: 'string_too_short' },
    ];
    expect(await formatErrorDetail(detail)).toBe('email: field required; password: string too short');
  });

  it('bỏ "body" khỏi loc, chỉ giữ tên field thật', async () => {
    const detail = [{ loc: ['body', 'phone'], msg: 'invalid format', type: 'value_error' }];
    expect(await formatErrorDetail(detail)).toBe('phone: invalid format');
  });

  it('mảng lỗi không có "loc" vẫn hiện được msg', async () => {
    const detail = [{ msg: 'không hợp lệ', type: 'value_error' }];
    expect(await formatErrorDetail(detail)).toBe('không hợp lệ');
  });

  it('BUG FIX: object {error_code, message} đọc đúng message, KHÔNG hiện JSON thô', async () => {
    const detail = { error_code: 'token_expired', message: 'Phiên đăng nhập đã hết hạn.' };
    // Hành vi CŨ (trước fix): formatErrorDetail(detail) === JSON.stringify(detail)
    // -> user thấy '{"error_code":"token_expired","message":"..."}' trên UI.
    expect(await formatErrorDetail(detail)).toBe('Phiên đăng nhập đã hết hạn.');
    expect(await formatErrorDetail(detail)).not.toContain('error_code');
    expect(await formatErrorDetail(detail)).not.toContain('{');
  });

  it('BUG FIX: mọi error_code khác (session_replaced, session_revoked...) đều đọc message đúng', async () => {
    expect(
      await formatErrorDetail({ error_code: 'session_replaced', message: 'Tài khoản vừa đăng nhập ở nơi khác.' })
    ).toBe('Tài khoản vừa đăng nhập ở nơi khác.');
  });

  it('object không có field "message" dạng string vẫn JSON.stringify (fallback an toàn, giữ nguyên hành vi cũ)', async () => {
    const detail = { error_code: 'weird_shape', extra: 123 };
    expect(await formatErrorDetail(detail)).toBe(JSON.stringify(detail));
  });

  it('trả thông báo mặc định khi detail là null/undefined', async () => {
    expect(await formatErrorDetail(null)).toBe('Có lỗi xảy ra');
    expect(await formatErrorDetail(undefined)).toBe('Có lỗi xảy ra');
  });

  /**
   * Giai đoạn 3 (i18n, 09/2026): tầng dịch error_code. Test dưới đây
   * khoá đúng 3 hành vi cốt lõi theo plan_language_polish.md A.1/A.3.2.
   */
  describe('Giai đoạn 3 — dịch theo error_code khi locale=en', () => {
    it('locale=vi (mặc định) LUÔN dùng message gốc từ backend, không tra bảng dịch', async () => {
      mockCookieGet.mockImplementation((name: string) =>
        name === 'locale' ? { value: 'vi' } : undefined
      );
      const detail = { error_code: 'auth_wrong_credentials', message: 'Email hoặc mật khẩu không đúng.' };
      expect(await formatErrorDetail(detail)).toBe('Email hoặc mật khẩu không đúng.');
    });

    it('locale=en + error_code nằm trong nhóm ưu tiên -> trả bản dịch tiếng Anh', async () => {
      mockCookieGet.mockImplementation((name: string) =>
        name === 'locale' ? { value: 'en' } : undefined
      );
      const detail = { error_code: 'auth_wrong_credentials', message: 'Email hoặc mật khẩu không đúng.' };
      expect(await formatErrorDetail(detail)).toBe('Incorrect email or password.');
    });

    it('locale=en + error_code CHƯA có trong bảng dịch -> fallback về message tiếng Việt gốc, không vỡ UI', async () => {
      mockCookieGet.mockImplementation((name: string) =>
        name === 'locale' ? { value: 'en' } : undefined
      );
      const detail = { error_code: 'contact_still_active', message: 'Liên hệ vẫn đang hoạt động, không thể xoá.' };
      expect(await formatErrorDetail(detail)).toBe('Liên hệ vẫn đang hoạt động, không thể xoá.');
    });
  });
});
