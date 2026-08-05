import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../utils/api';

export interface User {
  id: string;
  name: string;
  username: string;
  role: 'ADMIN' | 'CASHIER' | 'MANAGER';
  branchId?: string | null;
  branchName?: string;
  profilePic?: string;
}

export interface UserAccount extends User {
  isActive?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  users: UserAccount[];
  isLoading: boolean;
  // Actions
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateProfile: (name: string, username: string, profilePic?: string) => Promise<void>;
  loadProfile: () => Promise<void>;
  resetPassword: (userId: string, newPassword: string) => Promise<void>;
  addUser: (user: { username: string; password: string; role: string; branchId?: string }) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  loadUsers: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      users: [],
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const res: any = await api.post('/api/v1/auth/login', { username: email, password });
          const { token, user } = res.data;
          set({
            token,
            user: {
              id: user.id,
              name: user.name || user.username,
              username: user.username,
              role: user.role as 'ADMIN' | 'CASHIER' | 'MANAGER',
              branchId: user.branchId,
              branchName: user.branchName,
              profilePic: user.profilePic || '',
            },
            isAuthenticated: true,
            isLoading: false,
          });
          return true;
        } catch (err) {
          // Local / Offline fallback authentication if backend API is unreachable or fails
          const cleanEmail = email.trim().toLowerCase();
          if (
            (cleanEmail === 'jefinvestmentmw@gmail.com' || cleanEmail === 'admin@jefinvestment.com' || cleanEmail === 'admin') &&
            (password === 'admin1234#' || password === 'Admin@1234')
          ) {
            set({
              token: 'local-admin-token',
              user: {
                id: 'local-admin-id',
                name: 'Admin User',
                username: email,
                role: 'ADMIN',
                branchId: 'main-branch',
                branchName: 'Main Branch',
                profilePic: '',
              },
              isAuthenticated: true,
              isLoading: false,
            });
            return true;
          }

          if (
            (cleanEmail === 'cashier@jefinvestment.com' || cleanEmail === 'cashier') &&
            (password === 'Cashier@1234' || password === 'cashier1234#')
          ) {
            set({
              token: 'local-cashier-token',
              user: {
                id: 'local-cashier-id',
                name: 'Cashier User',
                username: email,
                role: 'CASHIER',
                branchId: 'main-branch',
                branchName: 'Main Branch',
                profilePic: '',
              },
              isAuthenticated: true,
              isLoading: false,
            });
            return true;
          }

          set({ isLoading: false });
          return false;
        }
      },

      logout: () => set({ user: null, token: null, isAuthenticated: false, users: [] }),

      updateProfile: async (name, username, profilePic) => {
        // Save to server first (online-first)
        try {
          await api.put('/api/v1/profile', { name, ...(profilePic !== undefined && { profilePic }) });
        } catch (err) {
          console.warn('Failed to sync profile to server, saving locally only', err);
        }
        // Always update local state
        set((state) => ({
          user: state.user ? { ...state.user, name, username, ...(profilePic !== undefined && { profilePic }) } : null,
        }));
      },

      loadProfile: async () => {
        try {
          const res: any = await api.get('/api/v1/profile');
          if (res.data) {
            set((state) => ({
              user: state.user ? {
                ...state.user,
                ...(res.data.name && { name: res.data.name }),
                ...(res.data.profilePic && { profilePic: res.data.profilePic }),
              } : null,
            }));
          }
        } catch (err) {
          console.warn('Failed to load profile from server', err);
        }
      },

      resetPassword: async (userId, newPassword) => {
        await api.put(`/api/v1/users/${userId}/password`, { password: newPassword });
      },

      addUser: async (userData) => {
        await api.post('/api/v1/users', userData);
        await get().loadUsers();
      },

      deleteUser: async (userId) => {
        await api.delete(`/api/v1/users/${userId}`);
        set((state) => ({ users: state.users.filter((u) => u.id !== userId) }));
      },

      loadUsers: async () => {
        try {
          const res: any = await api.get('/api/v1/users');
          set({ users: res.data });
        } catch {
          // silently fail — user list is non-critical
        }
      },
    }),
    { name: 'jef-auth-storage' }
  )
);
