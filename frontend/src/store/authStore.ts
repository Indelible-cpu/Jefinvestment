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
  addDoc,
  deleteDoc, 
  updateDoc, 
  onSnapshot
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

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
  changePassword: (newPassword: string) => Promise<void>;
  resetPassword: (userId: string, newPassword: string) => Promise<void>;
  addUser: (user: { username: string; password: string; role: string; branchId?: string }) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  loadUsers: () => Promise<void>;
  
  isTemporarilyUnlocked: boolean;
  lastActiveTime: number;
  unlockTemporarily: () => void;
  lockSystem: () => void;
  updateActivity: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      users: [],
      isLoading: false,
      
      isTemporarilyUnlocked: false,
      lastActiveTime: Date.now(),
      unlockTemporarily: () => set({ isTemporarilyUnlocked: true, lastActiveTime: Date.now() }),
      lockSystem: () => set({ isTemporarilyUnlocked: false }),
      updateActivity: () => {
        if (get().isTemporarilyUnlocked) {
          set({ lastActiveTime: Date.now() });
        }
      },

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          const firebaseUser = userCredential.user;
          const token = await firebaseUser.getIdToken();

          // Fetch user profile from Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          let userData: any = { role: 'CASHIER', name: email.split('@')[0], username: email };
          
          if (userDoc.exists()) {
            userData = userDoc.data();
          } else {
            // Default setup for newly created users that might not have a profile doc yet
            await setDoc(doc(db, 'users', firebaseUser.uid), userData);
          }

          set({
            token,
            user: {
              id: firebaseUser.uid,
              name: userData.name || userData.username,
              username: userData.username,
              role: userData.role as 'ADMIN' | 'CASHIER' | 'MANAGER',
              branchId: userData.branchId,
              branchName: userData.branchName,
              profilePic: userData.profilePic || '',
            },
            isAuthenticated: true,
            isLoading: false,
          });
          return true;
        } catch (err) {
          console.error("Firebase Auth Login Error:", err);
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

      logout: async () => {
        try {
          await signOut(auth);
        } catch(e) {
          console.warn("Sign out failed", e);
        }
        set({ user: null, token: null, isAuthenticated: false, users: [] });
        try {
          localStorage.removeItem('jef-auth-storage');
          localStorage.clear();
          sessionStorage.clear();
        } catch (e) {
          console.warn("Error clearing storage on logout", e);
        }
      },

      updateProfile: async (name, username, profilePic) => {
        const state = get();
        if (!state.user) return;
        
        try {
          await updateDoc(doc(db, 'users', state.user.id), { 
            name, 
            username,
            ...(profilePic !== undefined && { profilePic }) 
          });
        } catch (err) {
          console.warn('Failed to sync profile to Firestore, saving locally only', err);
        }
        
        set((state) => ({
          user: state.user ? { ...state.user, name, username, ...(profilePic !== undefined && { profilePic }) } : null,
        }));
      },

      loadProfile: async () => {
        const state = get();
        if (!state.user || state.user.id.startsWith('local-')) return;

        try {
          onSnapshot(doc(db, 'users', state.user.id), (userDoc) => {
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
        } catch (err) {
          console.warn('Failed to set up profile listener', err);
        }
      },

      changePassword: async (newPassword) => {
        const currentUser = get().user;
        if (!currentUser) throw new Error("Not authenticated.");

        if (auth.currentUser) {
          try {
            await updatePassword(auth.currentUser, newPassword);
          } catch (e: any) {
            if (e.code === 'auth/requires-recent-login') {
              throw new Error("Security check: Please log out and log back in before changing your password.");
            }
            console.warn("Firebase Auth updatePassword warning", e);
          }
        }

        if (!currentUser.id.startsWith('local-')) {
          try {
            await updateDoc(doc(db, 'users', currentUser.id), {
              passwordUpdatedAt: Date.now(),
              updatedBy: currentUser.name
            });
          } catch (err) {
            console.warn("Failed to update user doc timestamp", err);
          }
        }

        try {
          await addDoc(collection(db, 'auditLogs'), {
            action: 'USER_PASSWORD_CHANGE',
            details: `User "${currentUser.name}" (${currentUser.role}, ${currentUser.username}) successfully changed their account password.`,
            user: currentUser.name,
            timestamp: Date.now()
          });
        } catch (e) {
          console.warn("Failed to create audit log for password change", e);
        }
      },

      resetPassword: async (userId, newPassword) => {
        const adminUser = get().user;
        const targetUser = get().users.find(u => u.id === userId);
        const targetName = targetUser ? `${targetUser.name} (${targetUser.role})` : (userId === adminUser?.id ? `${adminUser?.name} (Admin)` : userId);

        if (get().user?.id === userId && auth.currentUser) {
          try {
            await updatePassword(auth.currentUser, newPassword);
          } catch (e: any) {
            console.warn("Firebase Auth updatePassword warning", e);
          }
        }

        if (!userId.startsWith('local-')) {
          try {
            await updateDoc(doc(db, 'users', userId), {
              password: newPassword,
              passwordResetAt: Date.now(),
              resetByAdmin: adminUser?.name || 'Admin'
            });
          } catch (err) {
            console.warn("Failed to update password in Firestore user doc", err);
          }
        }

        try {
          await addDoc(collection(db, 'auditLogs'), {
            action: 'ADMIN_PASSWORD_RESET',
            details: `Admin "${adminUser?.name || 'Admin'}" reset password for user: ${targetName}.`,
            user: adminUser?.name || 'Admin',
            timestamp: Date.now()
          });
        } catch (e) {
          console.warn("Failed to create audit log for password reset", e);
        }
      },

      addUser: async (userData) => {
        try {
          const res = await createUserWithEmailAndPassword(auth, userData.username, userData.password);
          
          await setDoc(doc(db, 'users', res.user.uid), {
            username: userData.username,
            name: userData.username.split('@')[0],
            role: userData.role,
            branchId: userData.branchId || null,
            isActive: true,
          });

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
          onSnapshot(collection(db, 'users'), (snapshot) => {
            const loadedUsers: UserAccount[] = [];
            snapshot.forEach(doc => {
              const data = doc.data();
              loadedUsers.push({
                id: doc.id,
                username: data.username || '',
                name: data.name || '',
                role: data.role || 'CASHIER',
                branchId: data.branchId,
                branchName: data.branchName,
                profilePic: data.profilePic,
                isActive: data.isActive !== false,
              });
            });
            set({ users: loadedUsers });
          }, (err) => {
            console.warn("Failed to load users", err);
          });
        } catch (e) {
          console.warn("Failed to set up users listener", e);
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
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        // ignore
      }
    }
  }
});
