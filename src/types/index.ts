/**
 * Central export for all types
 */

// BUG FIX (audit 09/2026): types/auth.ts đã bị xóa — dead code, không ai
// import, và sai hoàn toàn so với backend thật (id:number/name/role enum
// tự bịa, trong khi UserOut thật dùng ss_user_id:string/full_name/role
// tự do). Nếu cần type User sau này, viết lại đúng theo
// schemas/auth.py::UserOut, đừng khôi phục lại bản cũ.
export * from './jobs';
export * from './companies';
export * from './contacts';
export * from './messages';
export * from './crawl';
export * from './dashboard';
