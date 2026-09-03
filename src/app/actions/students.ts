'use server';

import { listUsers } from '@/app/actions/auth';
import type { User } from '@/types/auth';

/**
 * Server Actions for Students
 * Corresponds to Flask blueprint: blueprints/students.py
 *
 * BUG FIX (audit 09/2026 #13): trước đây throw new Error('Not implemented').
 * Đối chiếu bản Flask gốc (students.py::activity_index()) — "Học viên"
 * KHÔNG phải 1 entity/router riêng ở backend, chỉ là GET /auth/users lọc
 * theo role=='user' ở tầng FE (xem listUsers() trong actions/auth.ts).
 * Không cần thêm route mới nào ở backend cho file này.
 */

export interface StudentFilters {
  keyword?: string;
}

/**
 * Lọc role=='user' từ danh sách chung — KHÔNG có endpoint /students
 * riêng ở backend, xem docstring đầu file.
 */
export async function getStudents(filters?: StudentFilters): Promise<User[]> {
  const users = await listUsers();
  let students = users.filter((u) => u.role === 'user');

  if (filters?.keyword) {
    const keyword = filters.keyword.trim().toLowerCase();
    if (keyword) {
      students = students.filter(
        (u) =>
          u.full_name.toLowerCase().includes(keyword) ||
          u.email.toLowerCase().includes(keyword)
      );
    }
  }

  return students;
}

/**
 * Lấy 1 học viên theo id — vẫn gọi listUsers() (không có GET
 * /auth/users/{id} riêng ở backend) rồi tự tìm trong mảng, cùng cách
 * Flask gốc chưa từng có trang chi tiết riêng cho 1 học viên.
 */
export async function getStudentById(id: string): Promise<User | null> {
  const users = await listUsers();
  return users.find((u) => u.ss_user_id === id && u.role === 'user') || null;
}
