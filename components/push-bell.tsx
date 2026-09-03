"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

import { getPushSubscriptionState, isPushSupported, subscribeToPush, unsubscribeFromPush } from "@/lib/push/subscribe";

export function PushBell() {
  const [state, setState] = useState<"unsupported" | "denied" | "subscribed" | "unsubscribed" | "loading">("loading");

  useEffect(() => {
    if (!isPushSupported()) {
      setState("unsupported");
      return;
    }
    void getPushSubscriptionState().then(setState);
  }, []);

  async function toggle() {
    if (state === "subscribed") {
      await unsubscribeFromPush();
      setState("unsubscribed");
      return;
    }
    const result = await subscribeToPush();
    setState(result.ok ? "subscribed" : "denied");
  }

  if (state === "unsupported" || state === "loading") return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={state === "subscribed" ? "Désactiver les notifications" : "Activer les notifications"}
      title={
        state === "subscribed"
          ? "Notifications activées"
          : state === "denied"
            ? "Notifications bloquées par le navigateur"
            : "Activer les notifications"
      }
      className="text-muted-foreground hover:text-foreground"
    >
      {state === "subscribed" ? <Bell className="size-4 text-primary" /> : <BellOff className="size-4" />}
    </button>
  );
}
