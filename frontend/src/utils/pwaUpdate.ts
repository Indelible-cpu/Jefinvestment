import { registerSW } from 'virtual:pwa-register';
import { toast } from 'sonner';

let registrationRef: ServiceWorkerRegistration | null = null;
let isUpdating = false;

export function initPWAUpdate() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  // Handle controller changes (new service worker took over)
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    toast.success('System is updating', {
      id: 'pwa-system-update',
      description: 'System has been updated to the latest version.',
      duration: 4000,
    });
    // Brief delay to ensure smooth cache transition then reload
    setTimeout(() => {
      window.location.reload();
    }, 1200);
  });

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      if (isUpdating) return;
      isUpdating = true;
      toast.info('System is updating', {
        id: 'pwa-system-update',
        description: 'New updates are available. Applying latest system version...',
        duration: 6000,
      });
      // Trigger service worker activation
      updateSW(true);
    },
    onOfflineReady() {
      console.log('MsikaFlo is ready to work offline.');
    },
    onRegisteredSW(_swScriptUrl, registration) {
      if (registration) {
        registrationRef = registration;

        // Check for updates every 15 minutes
        setInterval(() => {
          registration.update().catch(() => {});
        }, 15 * 60 * 1000);

        // Check for updates when user returns to the tab
        window.addEventListener('focus', () => {
          registration.update().catch(() => {});
        });

        // Check for updates when device regains internet connection
        window.addEventListener('online', () => {
          registration.update().catch(() => {});
        });

        // Listen for installing updates
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installing') {
                toast.loading('System is updating', {
                  id: 'pwa-system-update',
                  description: 'Downloading latest system updates...',
                });
              } else if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  toast.info('System is updating', {
                    id: 'pwa-system-update',
                    description: 'Applying updates now...',
                    duration: 5000,
                  });
                }
              }
            });
          }
        });
      }
    },
    onRegisterError(error) {
      console.warn('Service worker registration failed:', error);
    },
  });
}

export async function checkForAppUpdates(showToast = false) {
  if (!registrationRef) {
    if (showToast) {
      toast.info('System is up to date', { duration: 3000 });
    }
    return;
  }

  try {
    if (showToast) {
      toast.loading('Checking for updates...', { id: 'manual-update-check' });
    }
    await registrationRef.update();
    if (showToast) {
      toast.dismiss('manual-update-check');
      if (!isUpdating) {
        toast.success('System is up to date', { duration: 3000 });
      }
    }
  } catch (err) {
    if (showToast) {
      toast.dismiss('manual-update-check');
      toast.error('Failed to check for updates');
    }
  }
}
