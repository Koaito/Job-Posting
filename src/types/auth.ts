/**
 * Authentication types
 */

export interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'staff' | 'student';
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}
