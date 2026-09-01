/**
 * Formatting utilities
 */

import { format, formatDistanceToNow } from 'date-fns';

export function formatDate(date: string | Date, formatString = 'dd/MM/yyyy'): string {
  return format(new Date(date), formatString);
}

export function formatRelativeTime(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}
