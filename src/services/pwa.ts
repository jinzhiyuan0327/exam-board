export type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
let deferred: InstallPromptEvent | null = null;
export function registerPwa(): void {
  if ('serviceWorker' in navigator) window.addEventListener('load', () => { void navigator.serviceWorker.register('/service-worker.js'); });
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferred = event as InstallPromptEvent; window.dispatchEvent(new Event('pwa:available')); });
}
export function canInstallPwa(): boolean { return !!deferred && !window.matchMedia('(display-mode: standalone)').matches; }
export async function promptInstallPwa(): Promise<boolean> { if (!deferred) return false; const e = deferred; await e.prompt(); const choice = await e.userChoice; if (choice.outcome === 'accepted') deferred = null; return choice.outcome === 'accepted'; }
export function isStandalonePwa(): boolean { return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true; }
