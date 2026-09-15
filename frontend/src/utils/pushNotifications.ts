import { getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, getFirebaseMessaging } from '../lib/firebase';

const LOCAL_FCM_TOKEN_KEY = 'msikaflo_fcm_token';

export interface NotificationPreferences {
  notifyCashierSales: boolean;
  notifyOnlineOrders: boolean;
  notifyCreditPayments: boolean;
  notifyLowStock: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  notifyCashierSales: true,
  notifyOnlineOrders: true,
  notifyCreditPayments: true,
  notifyLowStock: true,
};

/**
 * Checks whether the current browser/device supports Web Push and Notifications
 */
export function isPushNotificationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'Notification' in window &&
    'PushManager' in window
  );
}

/**
 * Returns current browser notification permission state
 */
export function getPushPermissionState(): NotificationPermission | 'unsupported' {
  if (!isPushNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Requests browser push notification permission, registers the FCM service worker,
 * gets the device FCM token, and saves it to Firestore for the user.
 */
export async function requestPushPermission(
  userId: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  if (!isPushNotificationSupported()) {
    return {
      success: false,
      error: 'Push notifications are not supported on this browser or device.',
    };
  }

  if (Notification.permission === 'denied') {
    return {
      success: false,
      error:
        'Notification permission was previously blocked. Please enable notifications in your browser or phone site settings.',
    };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        success: false,
        error: 'Notification permission was not granted.',
      };
    }

    // Register / obtain the dedicated FCM service worker
    const registration = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js',
      { scope: '/' }
    );

    await navigator.serviceWorker.ready;

    const messaging = await getFirebaseMessaging();
    if (!messaging) {
      return {
        success: false,
        error: 'Firebase Cloud Messaging is unavailable.',
      };
    }

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY?.trim() || undefined;

    const token = await getToken(messaging, {
      serviceWorkerRegistration: registration,
      vapidKey: vapidKey || undefined,
    });

    if (!token) {
      return {
        success: false,
        error: 'Unable to generate device push token from Firebase.',
      };
    }

    // Store in localStorage for quick reference & cleanup on logout
    localStorage.setItem(LOCAL_FCM_TOKEN_KEY, token);

    // Save token to Firestore user document
    if (userId && !userId.startsWith('local-')) {
      try {
        await updateDoc(doc(db, 'users', userId), {
          fcmTokens: arrayUnion(token),
          lastTokenUpdate: Date.now(),
        });
      } catch (dbErr) {
        console.warn('Could not persist FCM token to user document:', dbErr);
      }
    }

    return { success: true, token };
  } catch (err: any) {
    console.error('Failed to request push notification permission:', err);
    return {
      success: false,
      error: err?.message || 'An error occurred while enabling notifications.',
    };
  }
}

/**
 * Removes the current device FCM token on logout
 */
export async function removePushToken(userId: string): Promise<void> {
  const token = localStorage.getItem(LOCAL_FCM_TOKEN_KEY);
  if (!token || !userId || userId.startsWith('local-')) return;

  try {
    await updateDoc(doc(db, 'users', userId), {
      fcmTokens: arrayRemove(token),
    });
  } catch (err) {
    console.warn('Could not remove FCM token from Firestore:', err);
  } finally {
    localStorage.removeItem(LOCAL_FCM_TOKEN_KEY);
  }
}

/**
 * Returns saved notification preferences or sensible defaults
 */
export function getUserNotificationPrefs(user: any): NotificationPreferences {
  if (!user || !user.notificationPrefs) {
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }
  return {
    notifyCashierSales: user.notificationPrefs.notifyCashierSales ?? true,
    notifyOnlineOrders: user.notificationPrefs.notifyOnlineOrders ?? true,
    notifyCreditPayments: user.notificationPrefs.notifyCreditPayments ?? true,
    notifyLowStock: user.notificationPrefs.notifyLowStock ?? true,
  };
}

/**
 * Saves notification preferences for a user in Firestore
 */
export async function updateUserNotificationPrefs(
  userId: string,
  prefs: Partial<NotificationPreferences>
): Promise<void> {
  if (!userId || userId.startsWith('local-')) return;

  await updateDoc(doc(db, 'users', userId), {
    notificationPrefs: prefs,
  });
}

/**
 * Listens for FCM notifications received while the app is in the foreground
 */
export function initForegroundNotificationListener(
  onNotification: (payload: any) => void
): () => void {
  let unsubscribe: (() => void) | null = null;

  getFirebaseMessaging().then((messaging) => {
    if (!messaging) return;
    try {
      unsubscribe = onMessage(messaging, (payload) => {
        console.log('[FCM-Foreground] Received message:', payload);
        onNotification(payload);
      });
    } catch (e) {
      console.warn('Failed to attach FCM foreground listener:', e);
    }
  });

  return () => {
    if (unsubscribe) unsubscribe();
  };
}

export interface SaleNotificationPayload {
  type: 'SALE' | 'ONLINE_ORDER' | 'SERVING_DUE';
  saleId?: string;
  invoiceNumber?: string;
  orderNumber?: string;
  cashierName?: string;
  cashierUid?: string;
  amount: number;
  paymentMethod?: string;
  currency?: string;
  itemCount?: number;
}

/**
 * Sends a push notification to authorized users via the backend /api/notify endpoint.
 * Wrapped in strict error handling so a notification delivery issue will NEVER
 * throw or interfere with sales processing.
 */
export async function dispatchSalePushNotification(
  payload: SaleNotificationPayload
): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    let token: string | null = null;
    try {
      const rawAuth = localStorage.getItem('jef-auth-storage');
      if (rawAuth) {
        token = JSON.parse(rawAuth)?.state?.token || null;
      }
    } catch {
      // ignore
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    await fetch('/api/notify', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    }).catch((err) => {
      console.warn('Push notification dispatch network notice:', err);
    });
  } catch (err) {
    console.warn('Push notification dispatch skipped or failed:', err);
  }
}
