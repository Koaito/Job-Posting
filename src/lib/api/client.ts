/**
 * API Client utilities for calling Server Actions
 * All API calls go through Next.js Server Actions (BFF pattern)
 * NEVER expose API keys to browser!
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public statusText: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Helper to handle server action responses
 */
export async function handleServerAction<T>(
  action: () => Promise<T>
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      error instanceof Error ? error.message : 'Unknown error',
      500,
      'Internal Server Error'
    );
  }
}
