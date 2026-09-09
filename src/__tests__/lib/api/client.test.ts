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
      const detail = { error_code: 'crawl_still_active', message: 'Crawl vẫn đang chạy, không thể xoá.' };
      expect(await formatErrorDetail(detail)).toBe('Crawl vẫn đang chạy, không thể xoá.');
    });

    it('locale=en + error_code nhóm not_found tĩnh (đợt 2, job/company/contact) -> trả bản dịch', async () => {
      mockCookieGet.mockImplementation((name: string) =>
        name === 'locale' ? { value: 'en' } : undefined
      );
      expect(
        await formatErrorDetail({ error_code: 'job_job_not_found', message: 'Không tìm thấy job' })
      ).toBe('Job not found');
      expect(
        await formatErrorDetail({ error_code: 'company_company_not_found', message: 'Không tìm thấy công ty' })
      ).toBe('Company not found');
    });

    it('locale=en + error_code nhóm *_invalid_uuid (đợt "template biến số" 1/2) -> bóc field/value, dịch động', async () => {
      mockCookieGet.mockImplementation((name: string) =>
        name === 'locale' ? { value: 'en' } : undefined
      );
      expect(
        await formatErrorDetail({
          error_code: 'job_job_id_invalid_uuid',
          message: "job_id 'xyz' không đúng định dạng UUID.",
        })
      ).toBe("job_id: 'xyz' is not a valid UUID.");
      // Khác error_code, khác field/value trong message -> vẫn dịch đúng
      // (1 handler chung xử lý được cả họ 21 error_code *_invalid_uuid).
      expect(
        await formatErrorDetail({
          error_code: 'audit_log_actor_id_invalid_uuid',
          message: "actor_id 'không-phải-uuid' không đúng định dạng UUID.",
        })
      ).toBe("actor_id: 'không-phải-uuid' is not a valid UUID.");
    });

    it('locale=en + error_code *_invalid_uuid nhưng message KHÔNG khớp pattern kỳ vọng -> fallback an toàn về vi gốc', async () => {
      mockCookieGet.mockImplementation((name: string) =>
        name === 'locale' ? { value: 'en' } : undefined
      );
      // Mô phỏng đúng trường hợp cá biệt JOB_COMPANY_ID_INVALID_UUID
      // (api/routers/jobs.py) — message dài hơn các anh em cùng họ vì
      // có thêm câu hướng dẫn phía sau, không khớp regex neo cuối chuỗi
      // -> PHẢI fallback về message gốc, không được hiện lỗi/undefined.
      const detail = {
        error_code: 'job_company_id_invalid_uuid',
        message:
          "company_id 'xyz' không đúng định dạng UUID — kiểm tra lại đã thay đúng company_id THẬT lấy từ response của POST /companies chưa.",
      };
      expect(await formatErrorDetail(detail)).toBe(detail.message);
    });

    it('locale=en + nhóm "X không hợp lệ — có sẵn: [list]" (đợt "template biến số" 2/2, batch 1) -> dịch động + prettify list', async () => {
      mockCookieGet.mockImplementation((name: string) =>
        name === 'locale' ? { value: 'en' } : undefined
      );
      expect(
        await formatErrorDetail({
          error_code: 'audit_log_action_type_invalid',
          message: "action_type 'FOO' không hợp lệ — có sẵn: ['CREATE', 'UPDATE', 'DELETE']",
        })
      ).toBe("action_type: 'FOO' is not valid — available: CREATE, UPDATE, DELETE");
      expect(
        await formatErrorDetail({
          error_code: 'contact_contact_status_invalid',
          message: "contact_status 'bad' không hợp lệ — có sẵn: ['NEW', 'CONTACTED']",
        })
      ).toBe("contact_status: 'bad' is not valid — available: NEW, CONTACTED");
    });

    it('locale=en + nhóm "X không tồn tại. Có sẵn: [list]" (1 hoặc 2 giá trị) -> dịch động', async () => {
      mockCookieGet.mockImplementation((name: string) =>
        name === 'locale' ? { value: 'en' } : undefined
      );
      expect(
        await formatErrorDetail({
          error_code: 'crawl_not_found',
          message: "Source 'linkedin' không tồn tại. Có sẵn: ['topcv', 'vietnamworks']",
        })
      ).toBe("Source: 'linkedin' not found. Available: topcv, vietnamworks");
      expect(
        await formatErrorDetail({
          error_code: 'crawl_not_found_2',
          message: "Category 'foo' không tồn tại cho source 'topcv'. Có sẵn: ['data-analyst']",
        })
      ).toBe("Category 'foo' not found for source 'topcv'. Available: data-analyst");
    });

    it('locale=en + nhóm "field \'value\' + hậu tố cố định riêng" (5 error_code, 1 biến mỗi mã) -> dịch động', async () => {
      mockCookieGet.mockImplementation((name: string) =>
        name === 'locale' ? { value: 'en' } : undefined
      );
      expect(
        await formatErrorDetail({
          error_code: 'import_entity_type_invalid',
          message: "entity_type 'foo' không hợp lệ — chỉ nhận job/company/contact.",
        })
      ).toBe("entity_type: 'foo' is invalid — only job/company/contact are accepted.");
      expect(
        await formatErrorDetail({
          error_code: 'job_company_not_found',
          message: "company_id 'xyz' không tồn tại — tạo công ty trước bằng POST /companies.",
        })
      ).toBe("company_id: 'xyz' does not exist — create the company first via POST /companies.");
      expect(
        await formatErrorDetail({
          error_code: 'profile_job_trang_thai_ung_tuyen',
          message: "Job đang ở trạng thái 'CLOSED', không thể ứng tuyển.",
        })
      ).toBe("This job is in status 'CLOSED' and can't be applied to.");
    });

    it('locale=en + đợt "template biến số" phần 2/2 batch 2 (11 mã cuối, nhiều biến/số lượng) -> dịch động', async () => {
      mockCookieGet.mockImplementation((name: string) =>
        name === 'locale' ? { value: 'en' } : undefined
      );
      expect(
        await formatErrorDetail({
          error_code: 'auth_locked_2',
          message: 'Sai mật khẩu quá 5 lần liên tiếp — tài khoản bị khoá tạm 15 phút.',
        })
      ).toBe('Wrong password too many times in a row (5x) — account temporarily locked for 15 minutes.');
      expect(
        await formatErrorDetail({
          error_code: 'crawl_not_found_3',
          message: "Category ['foo', 'bar'] không tồn tại cho source 'topcv'. Có sẵn: ['data-analyst']",
        })
      ).toBe("Category foo, bar not found for source 'topcv'. Available: data-analyst");
      expect(
        await formatErrorDetail({
          error_code: 'import_row_index_preview',
          message: 'row_index 42 không có trong preview này.',
        })
      ).toBe('row_index 42 is not in this preview.');
      expect(
        await formatErrorDetail({
          error_code: 'import_status_invalid',
          message: "status 'bad' không hợp lệ cho 'job' — chỉ nhận ['OPEN', 'CLOSED'].",
        })
      ).toBe("status: 'bad' is not valid for 'job' — only OPEN, CLOSED accepted.");
      expect(
        await formatErrorDetail({
          error_code: 'maintenance_run_ids_muc_after_ids',
          message: 'run_ids (3 mục) và after_ids (2 mục) phải có CÙNG SỐ LƯỢNG, khớp theo thứ tự.',
        })
      ).toBe('run_ids (3 items) and after_ids (2 items) must have the SAME LENGTH, matched by order.');
      expect(
        await formatErrorDetail({
          error_code: 'message_ban_qua_nhieu_yeu_cau',
          message: 'Bạn đang có quá nhiều yêu cầu nhắn tin đang chờ xử lý (tối đa 3 cùng lúc). Vui lòng đợi SS phản hồi trước khi gửi yêu cầu mới.',
        })
      ).toBe('You have too many pending message requests (max 3 at a time). Please wait for the SS to respond before sending a new request.');
      expect(
        await formatErrorDetail({
          error_code: 'message_yeu_cau_truoc_choi_vui',
          message: 'Yêu cầu trước đã bị từ chối — vui lòng thử lại sau 7 ngày kể từ lúc bị từ chối.',
        })
      ).toBe('Your previous request was declined — please try again 7 days after it was declined.');
    });

    it('locale=en + error_code có message = str(exc) (không có khuôn cố định) -> KHÔNG có handler, luôn fallback về vi gốc', async () => {
      mockCookieGet.mockImplementation((name: string) =>
        name === 'locale' ? { value: 'en' } : undefined
      );
      // 4 mã cố ý không dịch: import_field_verify_failed,
      // import_resolve_company_failed, import_row_resolution_failed,
      // profile_cv_upload_failed — message là str(exc) tuỳ ý, không có
      // pattern để bóc. Test 1 mã đại diện.
      const detail = {
        error_code: 'profile_cv_upload_failed',
        message: 'Lỗi kết nối Supabase Storage: timeout sau 30s.',
      };
      expect(await formatErrorDetail(detail)).toBe(detail.message);
    });
  });
});
