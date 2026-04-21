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
