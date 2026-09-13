import axios from 'axios';

// Normalize the production API base URL so requests include the /api prefix.
//
// VITE_API_URL points at the backend origin (e.g. https://finpilot-ai-one.vercel.app),
// while the backend mounts all routes under /api. Append it exactly once,
// no matter whether the configured URL already ends with /api or a trailing slash.
const configuredApiUrl = import.meta.env.VITE_API_URL;

function normalizeApiBaseUrl(raw) {
  if (!raw) return '/api';
  const trimmed = String(raw).trim().replace(/\/+$/, '').replace(/\/api+$/i, '');
  return trimmed ? `${trimmed}/api` : '/api';
}

const api = axios.create({
  baseURL: normalizeApiBaseUrl(configuredApiUrl),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    // The API uses httpOnly cookies for auth. Mutating requests must prove
    // they come from our own client (CSRF protection) via this custom header.
    'X-Requested-With': 'XMLHttpRequest',
  },
});

// Response interceptor — the access token is an httpOnly cookie that can
// expire. On a 401 caused by an expired token we transparently refresh via
// the httpOnly refresh cookie, then retry the original request.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const code = error.response?.data?.error?.code;

    // Login/register/refresh failures are credential failures, not expired
    // sessions — pass them through so the UI can show the real error.
    const isAuthAttempt =
      typeof originalRequest?.url === 'string' &&
      (originalRequest.url.includes('/auth/login') ||
        originalRequest.url.includes('/auth/register') ||
        originalRequest.url.includes('/auth/refresh-token'));

    if (status === 401 && code === 'TOKEN_EXPIRED' && !originalRequest._retry && !isAuthAttempt) {
      originalRequest._retry = true;

      try {
        await api.post('/auth/refresh-token');
        return api(originalRequest);
      } catch (refreshError) {
        // Only invalidate the session when the refresh token itself is
        // rejected. Network/server outages must not destroy a valid session.
        const refreshStatus = refreshError.response?.status;
        if (refreshStatus === 401 || refreshStatus === 403) {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;