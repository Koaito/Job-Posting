/**
 * Crawler types
 */

export interface CrawlStatus {
  is_running: boolean;
  current_source?: string;
  jobs_found: number;
  started_at?: string;
  estimated_completion?: string;
}

export interface CrawlHistory {
  id: number;
  source: string;
  jobs_found: number;
  status: 'success' | 'failed' | 'running';
  started_at: string;
  completed_at?: string;
  error_message?: string;
}

export interface CrawlHistoryResponse {
  items: CrawlHistory[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}
