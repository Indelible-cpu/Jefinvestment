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
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateProfile: (name: string, username: string, profilePic?: string) => void;
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

      login: async (username, password) => {
        set({ isLoading: true });
        try {
          const res: any = await api.post('/api/v1/auth/login', { username, password });
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
            },
            isAuthenticated: true,
            isLoading: false,
          });
          return true;
        } catch {
          set({ isLoading: false });
          return false;
        }
      },

      logout: () => set({ user: null, token: null, isAuthenticated: false, users: [] }),

      updateProfile: (name, username, profilePic) => set((state) => ({
        user: state.user ? { ...state.user, name, username, ...(profilePic !== undefined && { profilePic }) } : null,
      })),

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
