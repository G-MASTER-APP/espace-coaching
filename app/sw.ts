import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: WorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

// Notifications push (Web Push). Le payload est envoyé par
// lib/push/send.ts (serveur, clé VAPID privée) ; ici on se contente
// d'afficher ce qu'on reçoit et d'ouvrir la bonne page au clic.
// `self` en tant que ServiceWorkerGlobalScope (push/registration/clients)
// n'est pas dans le lib TS de ce projet (pas de lib "webworker" globale,
// pour ne pas polluer le typage du reste de l'app) — même choix que
// lib/jarvis/voice.ts pour les API non couvertes : `any` ciblé plutôt
// qu'une config ambient dédiée.
const sw = self as unknown as {
  addEventListener: (type: string, listener: (event: any) => void) => void;
  registration: { showNotification: (title: string, options: NotificationOptions) => Promise<void> };
  clients: {
    matchAll: (options: { type: string; includeUncontrolled: boolean }) => Promise<{ url: string; focus: () => void }[]>;
    openWindow: (url: string) => Promise<unknown>;
  };
};

sw.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload: { title?: string; body?: string; url?: string };
  try {
    payload = event.data.json();
  } catch {
    payload = { body: event.data.text() };
  }
  event.waitUntil(
    sw.registration.showNotification(payload.title ?? "G-MASTER", {
      body: payload.body,
      icon: "/icon",
      badge: "/icon",
      data: { url: payload.url ?? "/" },
    })
  );
});

sw.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? "/";
  event.waitUntil(
    sw.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(url));
      if (existing) return existing.focus();
      return sw.clients.openWindow(url);
    })
  );
});
