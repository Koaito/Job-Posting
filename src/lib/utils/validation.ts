/**
 * Validation utilities and Zod schemas
 */

import { z } from 'zod';

// Common validation rules
export const emailSchema = z.string().email('Email không hợp lệ');
export const phoneSchema = z.string().regex(/^[0-9]{10}$/, 'Số điện thoại phải có 10 chữ số');
export const urlSchema = z.string().url('URL không hợp lệ').optional().or(z.literal(''));

// Auth schemas
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
});

// Job schemas
export const jobSchema = z.object({
  title: z.string().min(1, 'Tiêu đề không được để trống'),
  company_id: z.number().positive('Vui lòng chọn công ty'),
  description: z.string().optional(),
  requirements: z.string().optional(),
  location: z.string().optional(),
  salary: z.string().optional(),
  employment_type: z.enum(['full-time', 'part-time', 'contract', 'internship']).optional(),
});

// Company schemas
export const companySchema = z.object({
  name: z.string().min(1, 'Tên công ty không được để trống'),
  website: urlSchema,
  industry: z.string().optional(),
  size: z.string().optional(),
  description: z.string().optional(),
});

// Contact schemas
export const contactSchema = z.object({
  name: z.string().min(1, 'Tên không được để trống'),
  email: emailSchema.optional().or(z.literal('')),
  phone: z.string().optional(),
  position: z.string().optional(),
  company_id: z.number().optional(),
});
