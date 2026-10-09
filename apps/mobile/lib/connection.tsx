import { CLOSE_SESSION_ENDED, type BoardClientMessage, type BoardServerMessage } from "@safe-paws/shared/protocol";
import { useBoard } from "@safe-paws/shared/store";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { useAuth } from "./auth";
import { BOARD_WS_URL } from "./config";
import { registerForPush } from "./push";

export type ConnectionStatus = "connecting" | "open" | "closed";

type Connection = {
  status: ConnectionStatus;
  send: (msg: BoardClientMessage) => boolean;
  /** Stops push to this phone, then signs out. */
  signOut: () => Promise<void>;
};

const ConnectionContext = createContext<Connection | null>(null);

/**
 * The live board connection, open while someone is signed in. The token goes
 * as a WebSocket subprotocol (`bearer.<token>`); the server checks it before
 * accepting, exactly as it checks the web app's cookie.
 */
export function ConnectionProvider({ children }: { children: ReactNode }) {
  const { state, signOut: clearAuth } = useAuth();
  const token = state.status === "signedIn" ? state.session.token : null;
  const expiresAt = state.status === "signedIn" ? state.session.expiresAt : 0;
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const pushToken = useRef<string | null>(null);
  const reconnectNow = useRef<() => void>(() => {});

  const send = useCallback((msg: BoardClientMessage) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      useBoard.getState().setError("You're offline. Your change wasn't saved; try again when reconnected.");
      return false;
    }
    ws.send(JSON.stringify(msg));
    return true;
  }, []);

  useEffect(() => {
    if (!token) return;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let registeredPush = false;

    const connect = () => {
      clearTimeout(timer);
      setStatus("connecting");
      const ws = new WebSocket(BOARD_WS_URL, ["safe-paws", `bearer.${token}`]);
      wsRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        setStatus("open");
      };

      ws.onmessage = (e) => {
        const msg = JSON.parse(String(e.data)) as BoardServerMessage;
        const s = useBoard.getState();
        switch (msg.type) {
          case "welcome":
            s.welcome(msg.userId, msg.users, msg.board, msg.notifications);
            if (!registeredPush) {
              registeredPush = true;
              registerForPush().then((t) => {
                pushToken.current = t;
                if (t) send({ type: "push.register", token: t });
              });
            }
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
        // Session over, or the token has run out: back to the sign-in screen.
        if (e.code === CLOSE_SESSION_ENDED || Date.now() >= expiresAt) {
          void clearAuth();
          return;
        }
        setStatus("closed");
        timer = setTimeout(connect, Math.min(8000, 500 * 2 ** attempt++));
      };
    };

    reconnectNow.current = () => {
      if (!wsRef.current && !disposed) {
        attempt = 0;
        connect();
      }
    };

    connect();

    // Phones suspend sockets in the background. Coming back to the app reconnects straight away
    // instead of waiting out the backoff, and the welcome snapshot catches up on anything missed.
    const sub = AppState.addEventListener("change", (s) => s === "active" && reconnectNow.current());

    return () => {
      disposed = true;
      clearTimeout(timer);
      sub.remove();
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [token, expiresAt, clearAuth, send]);

  const signOut = useCallback(async () => {
    if (pushToken.current) send({ type: "push.unregister", token: pushToken.current });
    pushToken.current = null;
    await clearAuth();
  }, [send, clearAuth]);

  const value = useMemo(() => ({ status, send, signOut }), [status, send, signOut]);
  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

export function useConnection() {
  const ctx = useContext(ConnectionContext);
  if (!ctx) throw new Error("useConnection must be used inside ConnectionProvider");
  return ctx;
}
