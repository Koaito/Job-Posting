'use server';

import { listUsers, getUserApplications, getUserSavedJobs } from './auth';
import type { User, JobApplication, SavedJob } from '@/types/auth';

/**
 * Server Actions for Students (Học viên)
 * Corresponds to Flask blueprint: blueprints/students.py
 *
 * BUG FIX (audit 09/2026): trước đây throw new Error('Not implemented')
 * cho cả 2 hàm. Đối chiếu Flask gốc (mindx-jobs/blueprints/students.py)
 * xác nhận KHÔNG có entity/router "student" riêng ở backend — Flask cũ
 * cũng chỉ gọi chung GET /auth/users rồi tự lọc role==='user'. Vì vậy
 * KHÔNG cần thêm route backend mới, chỉ cần lớp filter mỏng gọi lại
 * listUsers() (đã có sẵn ở actions/auth.ts, đợt sửa này mới thêm).
 */

export interface StudentFilters {
  keyword?: string;
}

/** role==='user' = "học viên" trong toàn bộ hệ thống này. */
export async function getStudents(filters?: StudentFilters): Promise<User[]> {
  const users = await listUsers();
  const students = users.filter((u) => u.role === 'user');

  if (!filters?.keyword) return students;

  const kw = filters.keyword.trim().toLowerCase();
  if (!kw) return students;

  return students.filter(
    (s) => s.full_name.toLowerCase().includes(kw) || s.email.toLowerCase().includes(kw)
  );
}

/**
 * KHÔNG có GET /auth/users/{id} đơn lẻ ở backend — chỉ có GET
 * /auth/users (danh sách) + GET /auth/users/{id}/applications + GET
 * /auth/users/{id}/saved-jobs. Lấy thông tin cơ bản bằng cách lọc lại
 * từ listUsers(), 2 hàm còn lại gọi thẳng endpoint theo id.
 */
export async function getStudentById(
  id: string
): Promise<{ student: User; applications: JobApplication[]; savedJobs: SavedJob[] } | null> {
  const [users, applications, savedJobs] = await Promise.all([
    listUsers(),
    getUserApplications(id),
    getUserSavedJobs(id),
  ]);

  const student = users.find((u) => u.ss_user_id === id && u.role === 'user');
  if (!student) return null;

  return { student, applications, savedJobs };
}
