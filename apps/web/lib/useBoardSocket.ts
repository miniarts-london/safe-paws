"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  CLOSE_SESSION_ENDED,
  DEFAULT_BOARD_PORT,
  type BoardClientMessage,
  type BoardServerMessage,
} from "@safe-paws/shared/protocol";
import { useBoard } from "@safe-paws/shared/store";

export type Connection = "connecting" | "open" | "closed";

const URL = process.env.NEXT_PUBLIC_BOARD_WS_URL ?? `ws://localhost:${DEFAULT_BOARD_PORT}`;

/**
 * One socket per tab. The page fetches its sign-in token from the website
 * and hands it to the board server in the handshake, because the board
 * server may be on another domain that never sees the website's cookie.
 * Every (re)connect gets a full snapshot back, so a dropped connection
 * never leaves a stale board or a missing notification behind.
 */
export function useBoardSocket() {
  const [status, setStatus] = useState<Connection>("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const router = useRouter();

  useEffect(() => {
    const toLogin = () => router.replace("/login");
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const retryLater = () => {
      if (!disposed) timer = setTimeout(connect, Math.min(8000, 500 * 2 ** attempt++));
    };

    const connect = async () => {
      setStatus("connecting");
      let token: string;
      try {
        const res = await fetch("/api/session/socket-token", { cache: "no-store" });
        if (res.status === 401) return toLogin();
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        token = ((await res.json()) as { token: string }).token;
      } catch {
        setStatus("closed");
        return retryLater();
      }
      if (disposed) return;
      const ws = new WebSocket(URL, ["safe-paws-web", `bearer.${token}`]);
      wsRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        setStatus("open");
      };

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data) as BoardServerMessage;
        const s = useBoard.getState();
        switch (msg.type) {
          case "welcome":
            s.welcome(msg.userId, msg.users, msg.board, msg.notifications);
            break;
          case "board.patch":
            s.applyPatch(msg.patch);
            break;
          case "notification":
            s.receive(msg.notification);
            break;
          case "notifications.read":
            s.markRead(msg.ids);
            break;
          case "user.upsert":
            s.upsertUser(msg.user);
            break;
          case "members":
            s.setMembers(msg.members);
            break;
          case "error":
            s.setError(msg.message);
            break;
        }
      };

      ws.onclose = (e) => {
        if (wsRef.current === ws) wsRef.current = null;
        if (disposed) return;
        // Session ended mid-connection: go and sign in again rather than retrying forever.
        if (e.code === CLOSE_SESSION_ENDED) {
          toLogin();
          return;
        }
        setStatus("closed");
        // A refused handshake never opens, and browsers don't expose the 401. The next
        // attempt fetches a fresh token first, which sends us to sign in if we've been signed out.
        retryLater();
      };
    };

    void connect();
    return () => {
      disposed = true;
      clearTimeout(timer);
      wsRef.current?.close();
    };
  }, [router]);

  const send = useCallback((msg: BoardClientMessage) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      useBoard.getState().setError("You're offline. Your change wasn't saved; try again when reconnected.");
      return false;
    }
    ws.send(JSON.stringify(msg));
    return true;
  }, []);

  return { status, send };
}

type Send = (msg: BoardClientMessage) => boolean;
export const SendContext = createContext<Send>(() => false);
export const useSend = () => useContext(SendContext);
