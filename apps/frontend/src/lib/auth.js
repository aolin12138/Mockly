const LOGIN_PATH = '/login';

export const clearAuthState = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const redirectToLogin = () => {
  if (typeof window === 'undefined') return;
  if (window.location.pathname !== LOGIN_PATH) {
    window.location.assign(LOGIN_PATH);
  }
};

export const ensureAuthenticated = () => {
  const token = localStorage.getItem('token');
  if (!token) {
    clearAuthState();
    redirectToLogin();
    return null;
  }
  return token;
};

export const authFetch = async (url, options = {}) => {
  const token = ensureAuthenticated();
  if (!token) {
    const error = new Error('Authentication required');
    error.code = 'AUTH_REQUIRED';
    throw error;
  }

  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearAuthState();
    redirectToLogin();
    const error = new Error('Session expired');
    error.code = 'AUTH_EXPIRED';
    throw error;
  }

  return response;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wrap `authFetch` with automatic retries for transient failures.
 *
 * Retries on:
 *   - Network errors (fetch throws `TypeError: Failed to fetch`)
 *   - 5xx server responses
 *
 * Does NOT retry on:
 *   - 4xx client errors (those are actual problems, not transient)
 *   - Auth errors (handled by `authFetch` via redirect)
 *
 * Defaults: 3 attempts, exponential backoff 400ms → 800ms → 1600ms.
 */
export const authFetchWithRetry = async (
  url,
  options = {},
  { retries = 3, baseDelayMs = 400 } = {}
) => {
  let lastError;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await authFetch(url, options);
      if (response.ok) return response;
      // Server error → retry. Client error (4xx) → return as-is, no retry.
      if (response.status >= 500 && attempt < retries - 1) {
        await sleep(baseDelayMs * Math.pow(2, attempt));
        continue;
      }
      return response;
    } catch (error) {
      // Auth failures propagate immediately — user is being redirected.
      if (error?.code === 'AUTH_REQUIRED' || error?.code === 'AUTH_EXPIRED') {
        throw error;
      }
      lastError = error;
      if (attempt < retries - 1) {
        await sleep(baseDelayMs * Math.pow(2, attempt));
        continue;
      }
    }
  }
  throw lastError || new Error('Failed to fetch after retries');
};
