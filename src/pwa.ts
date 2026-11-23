import { registerSW } from 'virtual:pwa-register';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let isInstalled = false;
let isIOS = false;

function detectEnvironment() {
  isInstalled =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;

  const ua = window.navigator.userAgent.toLowerCase();
  isIOS = /iphone|ipad|ipod/.test(ua);
}

function updateInstallButton() {
  const btn = document.getElementById('pwaInstallBtn');
  const label = document.getElementById('pwaInstallLabel');
  if (!btn) return;

  if (isInstalled) {
    btn.classList.add('hidden');
    return;
  }

  if (deferredPrompt) {
    if (label) label.textContent = 'Instalar';
    btn.title = 'Instalar AnimeList en tu dispositivo';
    btn.classList.remove('hidden');
    return;
  }

  if (isIOS) {
    if (label) label.textContent = 'Instalar';
    btn.title = 'Cómo instalar AnimeList en iPhone / iPad';
    btn.classList.remove('hidden');
    return;
  }

  btn.classList.add('hidden');
}

function openIOSInstallModal() {
  const modal = document.getElementById('iosInstallModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeIOSInstallModal() {
  const modal = document.getElementById('iosInstallModal');
  if (!modal) return;
  modal.classList.add('hidden');
  const detailModal = document.getElementById('modal');
  const addModal = document.getElementById('addStatusModal');
  const driveModal = document.getElementById('driveConfirmModal');
  if (
    detailModal?.classList.contains('hidden') &&
    addModal?.classList.contains('hidden') &&
    driveModal?.classList.contains('hidden')
  ) {
    document.body.style.overflow = '';
  }
}

function updateOfflineBanner() {
  const banner = document.getElementById('offlineBanner');
  if (!banner) return;
  banner.classList.toggle('hidden', navigator.onLine);
}

function initPWA() {
  detectEnvironment();
  updateInstallButton();
  updateOfflineBanner();

  // Register Service Worker with auto-update so every push updates installed PWAs
  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // Check for updates periodically and whenever the user returns to the app
      setInterval(() => {
        if (navigator.onLine) registration.update().catch(() => {});
      }, 30 * 60 * 1000);

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine) {
          registration.update().catch(() => {});
        }
      });
    },
    onNeedRefresh() {
      updateSW(true);
    },
  });

  // Automatically reload once when a newly pushed Service Worker takes control
  let refreshing = false;
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    updateInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    isInstalled = true;
    deferredPrompt = null;
    updateInstallButton();
  });

  window.addEventListener('online', updateOfflineBanner);
  window.addEventListener('offline', updateOfflineBanner);

  const installBtn = document.getElementById('pwaInstallBtn');
  installBtn?.addEventListener('click', async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        isInstalled = true;
        deferredPrompt = null;
        updateInstallButton();
      }
      return;
    }
    if (isIOS) {
      openIOSInstallModal();
    }
  });

  const iosModal = document.getElementById('iosInstallModal');
  iosModal?.addEventListener('click', (e) => {
    if (e.target === iosModal) closeIOSInstallModal();
  });
  document
    .getElementById('iosInstallCloseBtn')
    ?.addEventListener('click', closeIOSInstallModal);
  document
    .getElementById('iosInstallDoneBtn')
    ?.addEventListener('click', closeIOSInstallModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && iosModal && !iosModal.classList.contains('hidden')) {
      closeIOSInstallModal();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPWA);
} else {
  initPWA();
}
