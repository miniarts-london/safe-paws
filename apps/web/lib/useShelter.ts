"use client";

import type { Role } from "@safe-paws/shared/protocol";
import { applyShelterChange, type ShelterChange, type ShelterState } from "@safe-paws/shared/shelter";
import { useEffect } from "react";
import { create } from "zustand";

const OFFLINE = "Couldn't reach the site. Check your connection and try again.";

/**
 * The shelter layouts, from /api/shelter, shared by everything on the page that
 * shows them (the Shelter page, and the "I'm here" button in the top bar), so
 * they always agree.
 *
 * Changes show straight away and are saved one at a time, in order; the
 * server's answer to the last one then replaces the local copy, so the plan
 * always settles on what's saved. Other people's changes arrive when the tab
 * comes back into view, and every 20 seconds while it's open.
 *
 * `debounceKey`: for nudges with the arrow keys. The plan moves on every press,
 * but only the last position is sent, once the keys have been still for a moment.
 */

type Me = { id: string; name: string; role: Role };

type ShelterStore = {
  state: ShelterState | null;
  error: string | null;
  saving: boolean;
  /** Who's signed in, for checking in (set by the page). */
  me: Me | null;
  setMe: (me: Me | null) => void;
  load: () => Promise<void>;
  change: (c: ShelterChange, debounceKey?: string) => void;
  clearError: () => void;
};

let queue: Promise<void> = Promise.resolve();
/** Changes made here that the server hasn't answered yet, including ones still waiting to be sent. */
let unsaved = 0;
let failed = false;
const waiting = new Map<string, { change: ShelterChange; timer: ReturnType<typeof setTimeout> }>();

export const useShelterStore = create<ShelterStore>((set, get) => {
  const send = (change: ShelterChange) => {
    set({ saving: true });
    queue = queue.then(async () => {
      try {
        const res = await fetch("/api/shelter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(change),
          // A request that never answers would hold up every change after it.
          signal: AbortSignal.timeout(20_000),
        });
        const body = await res.json().catch(() => ({ error: OFFLINE }));
        if (!res.ok) {
          failed = true;
          set({ error: body.error ?? OFFLINE });
        } else if (unsaved === 1 && !failed) {
          // The last change: the server's copy now includes everything.
          set({ state: body as ShelterState });
        }
      } catch {
        failed = true;
        set({ error: OFFLINE });
      } finally {
        unsaved -= 1;
        if (unsaved === 0) {
          set({ saving: false });
          if (failed) {
            // Something wasn't saved: show what is.
            failed = false;
            await get().load();
          }
        }
      }
    });
  };

  return {
    state: null,
    error: null,
    saving: false,
    me: null,
    setMe: (me) => set({ me }),
    clearError: () => set({ error: null }),

    load: async () => {
      // A copy fetched now would undo changes that are still on their way.
      if (unsaved > 0) return;
      try {
        const res = await fetch("/api/shelter", { cache: "no-store", signal: AbortSignal.timeout(20_000) });
        const body = await res.json().catch(() => ({ error: OFFLINE }));
        if (unsaved > 0) return;
        if (!res.ok) set({ error: body.error ?? OFFLINE });
        else set({ state: body as ShelterState });
      } catch {
        if (!get().state) set({ error: OFFLINE });
      }
    },

    change: (c, debounceKey) => {
      const current = get().state;
      if (!current) return;
      set({ state: applyShelterChange(current, c, get().me ?? undefined) });
      if (!debounceKey) {
        unsaved += 1;
        send(c);
        return;
      }
      const before = waiting.get(debounceKey);
      if (before) clearTimeout(before.timer);
      else unsaved += 1;
      const timer = setTimeout(() => {
        waiting.delete(debounceKey);
        send(c);
      }, 400);
      waiting.set(debounceKey, { change: c, timer });
    },
  };
});

/** How many components are showing the layouts, so only one set of refresh timers runs. */
let watchers = 0;
let stopWatching: (() => void) | null = null;

function watch() {
  watchers += 1;
  if (watchers === 1) {
    const { load } = useShelterStore.getState();
    void Promise.resolve().then(load);
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = setInterval(refresh, 20_000);
    stopWatching = () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      clearInterval(timer);
      // Leaving: send anything still waiting.
      for (const { change, timer: t } of waiting.values()) {
        clearTimeout(t);
        void fetch("/api/shelter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(change), keepalive: true });
      }
      waiting.clear();
    };
  }
  return () => {
    watchers -= 1;
    if (watchers === 0) {
      stopWatching?.();
      stopWatching = null;
    }
  };
}

export function useShelter(me?: Me) {
  useEffect(watch, []);
  const setMe = useShelterStore((s) => s.setMe);
  const id = me?.id;
  const name = me?.name;
  const role = me?.role;
  useEffect(() => {
    if (id && name && role) setMe({ id, name, role });
  }, [id, name, role, setMe]);
  const state = useShelterStore((s) => s.state);
  const error = useShelterStore((s) => s.error);
  const saving = useShelterStore((s) => s.saving);
  const change = useShelterStore((s) => s.change);
  const clearError = useShelterStore((s) => s.clearError);
  return { state, change, saving, error, clearError };
}
