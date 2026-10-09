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
 * One socket per tab. The browser sends the session cookie with the
 * handshake, so the server knows who this is without the page saying so.
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

    const connect = () => {
      setStatus("connecting");
      const ws = new WebSocket(URL);
      wsRef.current = ws;
      let opened = false;

      ws.onopen = () => {
        opened = true;
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
        const retry = () => {
          if (!disposed) timer = setTimeout(connect, Math.min(8000, 500 * 2 ** attempt++));
        };
        // A handshake refused for a missing or expired cookie never opens, and browsers
        // don't expose the 401. Ask the app whether we're still signed in before retrying.
        if (!opened) {
          fetch("/api/session", { cache: "no-store" })
            .then((r) => (r.status === 401 ? toLogin() : retry()))
            .catch(retry);
          return;
        }
        retry();
      };
    };

    connect();
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
