interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Captures the browser's optional install prompt before the guide is opened. */
export class InstallState {
  promptEvent = $state.raw<InstallPrompt | null>(null);
  standalone = $state(false);
  installed = $state(false);
  busy = $state(false);

  start() {
    const display = window.matchMedia("(display-mode: standalone)");
    const update = () => { this.standalone = display.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true; };
    const available = (event: Event) => { event.preventDefault(); this.promptEvent = event as InstallPrompt; };
    const installed = () => { this.installed = true; this.promptEvent = null; };
    update();
    display.addEventListener("change", update);
    window.addEventListener("beforeinstallprompt", available);
    window.addEventListener("appinstalled", installed);
    if ("serviceWorker" in navigator && window.isSecureContext) {
      void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
    }
    return () => {
      display.removeEventListener("change", update);
      window.removeEventListener("beforeinstallprompt", available);
      window.removeEventListener("appinstalled", installed);
    };
  }

  async prompt() {
    const event = this.promptEvent;
    if (!event || this.busy) return;
    this.promptEvent = null;
    this.busy = true;
    try { await event.prompt(); await event.userChoice; } catch { /* Manual instructions remain available. */ }
    finally { this.busy = false; }
  }
}
