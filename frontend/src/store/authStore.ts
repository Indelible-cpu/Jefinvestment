import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  createUserWithEmailAndPassword,
  updatePassword,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection,
  deleteDoc,
  updateDoc,
  onSnapshot
} from 'firebase/firestore';
import { auth, db, secondaryAuth } from '../lib/firebase';

// ─── Offline Credential Cache ──────────────────────────────────────────────────
// We store a SHA-256 hash of the password alongside the user profile so that
// real users can re-authenticate when the device is offline.
const OFFLINE_CACHE_KEY = 'jef-offline-credential-cache';

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'jef-salt-2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function saveOfflineCache(email: string, passwordHash: string, user: any) {
  try {
    const cache = JSON.parse(localStorage.getItem(OFFLINE_CACHE_KEY) || '{}');
    cache[email.trim().toLowerCase()] = { passwordHash, user, savedAt: Date.now() };
    localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(cache));
  } catch { /* ignore */ }
}

async function checkOfflineCache(email: string, password: string): Promise<any | null> {
  try {
    const cache = JSON.parse(localStorage.getItem(OFFLINE_CACHE_KEY) || '{}');
    const entry = cache[email.trim().toLowerCase()];
    if (!entry) return null;
    const hash = await hashPassword(password);
    if (hash === entry.passwordHash) return entry.user;
  } catch { /* ignore */ }
  return null;
}

// Global registry of all active Firestore listeners — unsubscribed on logout
const activeListeners: Array<() => void> = [];
export function registerListener(unsub: () => void) {
  activeListeners.push(unsub);
}
export function unsubscribeAllListeners() {
  while (activeListeners.length > 0) {
    const unsub = activeListeners.pop();
    if (unsub) unsub();
  }
}

export interface User {
  id: string;
  name: string;
  email?: string;
  role: 'ADMIN' | 'CASHIER' | 'MANAGER';
  branchId?: string | null;
  branchName?: string;
  profilePic?: string;
  lastActiveAt?: number;
  requiresPasswordChange?: boolean;
}

export interface UserAccount extends User {
  isActive?: boolean;
}

export interface LoginResult {
  success: boolean;
  error?: string;
  isNetworkError?: boolean;
}

export interface PasswordChangeRequest {
  id: string;
  userId: string;
  userName: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedAt: number;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  users: UserAccount[];
  isLoading: boolean;
  // Actions
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  updateProfile: (name: string, profilePic?: string) => Promise<void>;
  loadProfile: () => Promise<void>;
  resetPassword: (userId: string, newPassword: string) => Promise<void>;
  addUser: (user: { name: string; email: string; password: string; role: string; branchId?: string }) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  loadUsers: () => Promise<void>;
  
  isTemporarilyUnlocked: boolean;
  lastActiveTime: number;
  unlockTemporarily: () => void;
  lockSystem: () => void;
  updateActivity: () => void;

  passwordRequests: PasswordChangeRequest[];
  loadPasswordRequests: () => Promise<void>;
  submitPasswordRequest: (userId: string, userName: string, reason: string) => Promise<string>;
  approvePasswordRequest: (requestId: string) => Promise<void>;
  rejectPasswordRequest: (requestId: string) => Promise<void>;
  clearPasswordChangeFlag: (userId: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      users: [],
      passwordRequests: [],
      isLoading: false,

      isTemporarilyUnlocked: false,
      lastActiveTime: Date.now(),
      
      unlockTemporarily: () => {
        set({ isTemporarilyUnlocked: true, lastActiveTime: Date.now() });
      },
      lockSystem: () => {
        set({ isTemporarilyUnlocked: false });
      },
      updateActivity: () => {
        const state = get();
        const now = Date.now();
        // Sync online presence to Firestore at most once per minute
        if (state.user && !state.user.id.startsWith('local-') && (now - state.lastActiveTime > 30000)) {
          updateDoc(doc(db, 'users', state.user.id), { lastActiveAt: now }).catch(() => {});
        }
        set({ lastActiveTime: now });
      },

      login: async (email, password) => {
        set({ isLoading: true });
        
        const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

        // Check local offline fallback authentication if offline or network is down
        const cleanEmail = email.trim().toLowerCase();
        const isAdminLocal = 
          (cleanEmail === 'jefinvestmentmw@gmail.com' || cleanEmail === 'admin@jefinvestment.com' || cleanEmail === 'admin') &&
          (password === 'admin1234#' || password === 'Admin@1234');
        const isCashierLocal = 
          (cleanEmail === 'cashier@jefinvestment.com' || cleanEmail === 'cashier') &&
          (password === 'Cashier@1234' || password === 'cashier1234#');

        const performOfflineLogin = async () => {
          const cachedUser = await checkOfflineCache(email, password);
          if (cachedUser) {
            set({ token: 'offline-cached-token', user: cachedUser, isAuthenticated: true, isLoading: false });
            return { success: true };
          }
          if (isAdminLocal) {
            set({ token: 'local-admin-token', user: { id: 'local-admin-id', name: 'Admin User', role: 'ADMIN', branchId: 'main-branch', branchName: 'Main Branch', profilePic: '' }, isAuthenticated: true, isLoading: false });
            return { success: true };
          }
          if (isCashierLocal) {
            set({ token: 'local-cashier-token', user: { id: 'local-cashier-id', name: 'Cashier User', role: 'CASHIER', branchId: 'main-branch', branchName: 'Main Branch', profilePic: '' }, isAuthenticated: true, isLoading: false });
            return { success: true };
          }
          return null;
        };

        if (isOffline) {
          const offlineResult = await performOfflineLogin();
          if (offlineResult) return offlineResult;
          set({ isLoading: false });
          return { success: false, error: 'No internet connection. Your credentials were not recognised offline.', isNetworkError: true };
        }

        try {
          const trimmedEmail = email.trim();
          let userCredential;
          
          try {
            userCredential = await Promise.race([
              signInWithEmailAndPassword(auth, trimmedEmail, password),
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error('NETWORK_TIMEOUT')), 5000))
            ]);
          } catch (raceErr: any) {
            if (raceErr.message === 'NETWORK_TIMEOUT' || raceErr.code?.includes('network')) {
              const offlineResult = await performOfflineLogin();
              if (offlineResult) return offlineResult;
            }
            throw raceErr;
          }

          const firebaseUser = userCredential.user;
          const token = await firebaseUser.getIdToken();

          // Fetch user profile from Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          let userData: any = { role: 'CASHIER', name: email.split('@')[0] };
          
          if (userDoc.exists()) {
            userData = userDoc.data();
          } else {
            // Default setup for newly created users that might not have a profile doc yet
            await setDoc(doc(db, 'users', firebaseUser.uid), userData);
          }

          const userObj = {
            id: firebaseUser.uid,
            name: userData.name || email.split('@')[0],
            email: userData.email || email,
            role: userData.role as 'ADMIN' | 'CASHIER' | 'MANAGER',
            branchId: userData.branchId,
            branchName: userData.branchName,
            profilePic: userData.profilePic || '',
            requiresPasswordChange: userData.requiresPasswordChange || false,
          };

          // Cache credentials securely for offline re-login
          const pwHash = await hashPassword(password);
          saveOfflineCache(email, pwHash, userObj);

          // Write online presence immediately on login, and ensure email is saved for legacy accounts
          updateDoc(doc(db, 'users', firebaseUser.uid), { 
            lastActiveAt: Date.now(),
            email: trimmedEmail 
          }).catch(() => {});

          set({
            token,
            user: userObj,
            isAuthenticated: true,
            isLoading: false,
          });
          return { success: true };
        } catch (err: any) {
          console.error("Firebase Auth Login Error:", err);
          
          // Local / Offline fallback authentication if backend API is unreachable or fails
          if (isAdminLocal) {
            set({
              token: 'local-admin-token',
              user: {
                id: 'local-admin-id',
                name: 'Admin User',
                role: 'ADMIN',
                branchId: 'main-branch',
                branchName: 'Main Branch',
                profilePic: '',
              },
              isAuthenticated: true,
              isLoading: false,
            });
            return { success: true };
          }

          if (isCashierLocal) {
            set({
              token: 'local-cashier-token',
              user: {
                id: 'local-cashier-id',
                name: 'Cashier User',
                role: 'CASHIER',
                branchId: 'main-branch',
                branchName: 'Main Branch',
                profilePic: '',
              },
              isAuthenticated: true,
              isLoading: false,
            });
            return { success: true };
          }

          set({ isLoading: false });

          const errCode = err?.code || '';
          const errMsg = (err?.message || '').toLowerCase();

          const isNetworkErr = 
            errCode === 'auth/network-request-failed' ||
            errCode === 'auth/timeout' ||
            errCode === 'auth/unavailable' ||
            errMsg.includes('network') ||
            errMsg.includes('offline') ||
            errMsg.includes('failed to fetch') ||
            errMsg.includes('connection') ||
            (typeof navigator !== 'undefined' && !navigator.onLine);

          if (isNetworkErr) {
            return {
              success: false,
              error: 'Poor or unstable network connection. Please check your internet connection and try again.',
              isNetworkError: true
            };
          }

          return {
            success: false,
            error: 'Invalid username or password. Please check your credentials.',
            isNetworkError: false
          };
        }
      },

      logout: async () => {
        // Kill all active Firestore listeners BEFORE signing out
        // to prevent "Missing or insufficient permissions" errors
        unsubscribeAllListeners();
        try {
          await signOut(auth);
        } catch(e) {
          console.warn("Sign out failed", e);
        }
        set({ user: null, token: null, isAuthenticated: false, users: [] });
        try {
          localStorage.removeItem('jef-auth-storage');
        } catch (e) {
          console.warn("Error clearing storage on logout", e);
        }
      },

      updateProfile: async (name, profilePic) => {
        const state = get();
        if (!state.user) return;
        
        try {
          await updateDoc(doc(db, 'users', state.user.id), { 
            name, 
            ...(profilePic !== undefined && { profilePic }) 
          });
        } catch (err) {
          console.warn('Failed to sync profile to Firestore, saving locally only', err);
        }
        
        set((state) => ({
          user: state.user ? { ...state.user, name, ...(profilePic !== undefined && { profilePic }) } : null,
        }));
      },

      loadProfile: async () => {
        const state = get();
        if (!state.user || state.user.id.startsWith('local-')) return;

        try {
          const unsubProfile = onSnapshot(doc(db, 'users', state.user.id), (userDoc) => {
            if (userDoc.exists()) {
              const data = userDoc.data();
              set((state) => ({
                user: state.user ? {
                  ...state.user,
                  ...(data.name && { name: data.name }),
                  ...(data.profilePic && { profilePic: data.profilePic }),
                } : null,
              }));
            }
          }, (err) => {
            console.warn('Failed to load profile from Firestore', err);
          });
          registerListener(unsubProfile);
        } catch (err) {
          console.warn('Failed to set up profile listener', err);
        }
      },

      resetPassword: async (userId, newPassword) => {
        // This is tricky because Firebase client SDK only allows updating the CURRENT user's password.
        if (get().user?.id === userId && auth.currentUser) {
          await updatePassword(auth.currentUser, newPassword);
        } else {
          throw new Error("Firebase Security: Cannot change another user's password directly. Please delete the account and recreate it with the EXACT same Name (this will preserve all their sales history).");
        }
      },

      addUser: async (userData) => {
        try {
          const trimmedEmail = userData.email.trim();
          const res = await createUserWithEmailAndPassword(secondaryAuth, trimmedEmail, userData.password);
          
          await setDoc(doc(db, 'users', res.user.uid), {
            name: userData.name,
            email: trimmedEmail,
            role: userData.role,
            branchId: userData.branchId || null,
            isActive: true,
            requiresPasswordChange: true, // Force password change on first login
          });

          // Sign out the secondary app immediately so it doesn't leave lingering sessions
          await signOut(secondaryAuth);

          await get().loadUsers();
        } catch (error) {
          console.error("Failed to add user:", error);
          throw error;
        }
      },

      deleteUser: async (userId) => {
        try {
          await deleteDoc(doc(db, 'users', userId));
          set((state) => ({ users: state.users.filter((u) => u.id !== userId) }));
        } catch(e) {
          console.error("Failed to delete user", e);
        }
      },

      loadUsers: async () => {
        try {
          const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
            const loadedUsers: UserAccount[] = [];
            snapshot.forEach(doc => {
              const data = doc.data();
              loadedUsers.push({
                id: doc.id,
                name: data.name || '',
                email: data.email || data.username || '',
                role: data.role || 'CASHIER',
                branchId: data.branchId || null,
                isActive: data.isActive !== false,
                lastActiveAt: data.lastActiveAt || 0,
                requiresPasswordChange: data.requiresPasswordChange,
              });
            });
            set({ users: loadedUsers });
          }, (err) => {
            console.warn("Failed to load users", err);
          });
          registerListener(unsubUsers);
        } catch (e) {
          console.warn("Failed to set up users listener", e);
        }
      },

      loadPasswordRequests: async () => {
        try {
          const unsub = onSnapshot(collection(db, 'passwordRequests'), (snapshot) => {
            const reqs: PasswordChangeRequest[] = [];
            snapshot.forEach(doc => {
              const data = doc.data();
              reqs.push({
                id: doc.id,
                userId: data.userId,
                userName: data.userName,
                reason: data.reason,
                status: data.status,
                requestedAt: data.requestedAt,
              });
            });
            // Sort newest first
            reqs.sort((a, b) => b.requestedAt - a.requestedAt);
            set({ passwordRequests: reqs });
          }, (err) => {
            console.warn("Failed to load password requests", err);
          });
          registerListener(unsub);
        } catch (e) {
          console.warn("Failed to set up password requests listener", e);
        }
      },

      submitPasswordRequest: async (userId, userName, reason) => {
        const reqRef = doc(collection(db, 'passwordRequests'));
        await setDoc(reqRef, {
          userId,
          userName,
          reason,
          status: 'PENDING',
          requestedAt: Date.now()
        });
        return reqRef.id;
      },

      approvePasswordRequest: async (requestId) => {
        await updateDoc(doc(db, 'passwordRequests', requestId), { status: 'APPROVED' });
      },

      rejectPasswordRequest: async (requestId) => {
        await updateDoc(doc(db, 'passwordRequests', requestId), { status: 'REJECTED' });
      },

      clearPasswordChangeFlag: async (userId) => {
        await updateDoc(doc(db, 'users', userId), { requiresPasswordChange: false });
        const state = get();
        if (state.user && state.user.id === userId) {
          set({ user: { ...state.user, requiresPasswordChange: false } });
        }
      },
    }),
    { name: 'jef-auth-storage' }
  )
);

// Listen to Firebase Auth state changes: wipe storage completely when signed out
onAuthStateChanged(auth, (firebaseUser) => {
  if (!firebaseUser) {
    const state = useAuthStore.getState();
    if (state.user && !state.user.id.startsWith('local-')) {
      useAuthStore.setState({ user: null, token: null, isAuthenticated: false, users: [] });
      try {
        localStorage.removeItem('jef-auth-storage');
      } catch (e) {
        // ignore
      }
    }
  }
});
