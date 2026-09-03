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
