'use server';

/**
 * Server Actions for Crawler
 * Corresponds to Flask blueprints: crawl.py, crawl_status.py, crawl_history.py
 */

const API_BASE = process.env.FASTAPI_URL;
const API_KEY = process.env.CRAWLER_API_KEY;

export async function getCrawlStatus() {
  throw new Error('Not implemented');
}

export async function startCrawl() {
  throw new Error('Not implemented');
}

export async function stopCrawl() {
  throw new Error('Not implemented');
}

export async function getCrawlHistory(page?: number) {
  throw new Error('Not implemented');
}
