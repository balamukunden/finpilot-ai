import { create } from 'zustand';
import api from '../lib/axios';

const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    set({ user: data.data.user, isAuthenticated: true, isLoading: false });
    return data;
  },

  register: async (name, email, password, confirmPassword) => {
    const { data } = await api.post('/auth/register', { name, email, password, confirmPassword });
    set({ user: data.data.user, isAuthenticated: true, isLoading: false });
    return data;
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  checkAuth: async () => {
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.data.user, isAuthenticated: true, isLoading: false });
    } catch {
      // A 401/403 means the session is invalid or expired. The httpOnly
      // cookies are managed by the browser, so a transient outage here simply
      // shows the signed-out UI; a later reload can re-authenticate.
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));

export default useAuthStore;