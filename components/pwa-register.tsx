"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .then(async () => {
          if ("caches" in window) {
            const cacheKeys = await window.caches.keys();
            await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
          }
        });

      return;
    }

    void navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    }).then((registration) => {
      const activateWaitingWorker = () => {
        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
      };

      void registration.update();
      activateWaitingWorker();

      registration.addEventListener("updatefound", () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;

        installingWorker.addEventListener("statechange", () => {
          if (installingWorker.state === "installed") {
            activateWaitingWorker();
          }
        });
      });
    });
  }, []);

  return null;
}
