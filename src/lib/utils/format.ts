/**
 * Formatting utilities
 */

import { format } from 'date-fns';

export function formatDate(date: string | Date, formatString = 'dd/MM/yyyy'): string {
  return format(new Date(date), formatString);
}
