"use client";

import AddIcon from "@mui/icons-material/Add";
import Alert from "@mui/material/Alert";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { isStaff, ROLE_LABELS, type User } from "@safe-paws/shared/protocol";
import { useBoard } from "@safe-paws/shared/store";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/login/actions";
import { MOBILE_QUERY, useMediaQuery } from "@/lib/useMediaQuery";
import { SendContext, useBoardSocket, type Connection } from "@/lib/useBoardSocket";
import { useAnimalForm } from "@/lib/formStore";
import { AnimalDrawer } from "./AnimalDrawer";
import { AnimalFormDialog } from "./AnimalForm";
import { Bell } from "./Bell";
import { MembersButton } from "./MembersDialog";
import { Board } from "./Board";
import { MOBILE_NAV_HEIGHT, MobileBoard } from "./MobileBoard";
import { Toasts } from "./Toasts";

const CONNECTION: Record<Connection, { label: string; color: "mint" | "default" | "error" }> = {
  open: { label: "Live", color: "mint" },
  connecting: { label: "Connecting…", color: "default" },
  closed: { label: "Offline", color: "error" },
};

export default function BoardApp({ initialMe }: { initialMe: User }) {
  const { status, send } = useBoardSocket();
  const board = useBoard((s) => s.board);
  const users = useBoard((s) => s.users);
  const error = useBoard((s) => s.error);
  // The page already knows who is signed in, so the header renders before the socket connects.
  // After that the live copy wins, so a coordinator's approval shows up straight away.
  const me = users.find((u) => u.id === initialMe.id) ?? initialMe;
  const canEdit = isStaff(me.role);
  const mobile = useMediaQuery(MOBILE_QUERY);
  const conn = CONNECTION[status];
  const promoted = usePromotion(me);
  // Straight after signing up (?welcome=1). Read once, then tidy the address bar.
  const [welcome] = useState(() => new URLSearchParams(window.location.search).has("welcome"));
  useEffect(() => {
    if (welcome) window.history.replaceState(null, "", "/board");
  }, [welcome]);

  return (
    <SendContext.Provider value={send}>
      <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
        <AppBar position="sticky" sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}>
          <Toolbar sx={{ gap: 1.5, minHeight: { xs: 56 }, px: { xs: 2, sm: 2.5 } }}>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: "baseline", flex: 1, minWidth: 0 }}>
              <Typography variant="h6" component="h1" noWrap sx={{ fontWeight: 700 }}>
                Safe Paws
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap sx={{ display: { xs: "none", md: "block" } }}>
                Rescue board · Alexandria · sample data
              </Typography>
            </Stack>
            {!mobile && canEdit && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => useAnimalForm.getState().openCreate()}>
                Register an animal
              </Button>
            )}
            <Chip
              size="small"
              variant={status === "open" ? "filled" : "outlined"}
              color={conn.color}
              label={conn.label}
              sx={{ display: { xs: "none", sm: "inline-flex" } }}
            />
            {me.role === "coordinator" && <MembersButton />}
            {me && (
              <Box sx={{ textAlign: "right", lineHeight: 1.2 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {me.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
                  {me.title}
                </Typography>
              </Box>
            )}
            <form action={logout}>
              <Button type="submit" variant="outlined" color="inherit" size="small" sx={{ borderColor: "divider", color: "text.secondary" }}>
                Sign out
              </Button>
            </form>
            {!mobile && <Bell />}
          </Toolbar>
        </AppBar>

        {!canEdit && (
          <Alert severity="info" sx={{ mx: { xs: 2, sm: 2.5 }, mt: 1.5 }}>
            {welcome ? <strong>Welcome, {me.name}! </strong> : null}
            You can see every animal and follow the ones you care about. If you volunteer with the rescue, a coordinator
            can give you access to update the board.
          </Alert>
        )}

        {canEdit && !mobile && (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2.5, pt: 1.5 }}>
            Signed in as <strong>{me.name}</strong>. Sign in as someone else in a private window to see changes and
            notifications arrive live.
          </Typography>
        )}

        {board ? (
          mobile ? (
            <MobileBoard />
          ) : (
            <Board />
          )
        ) : (
          <Stack spacing={2} sx={{ alignItems: "center", py: 8 }}>
            {status === "closed" ? (
              <Alert severity="warning">
                {process.env.NODE_ENV === "development"
                  ? "Can't reach the board server. Start it with npm run dev."
                  : "Can't reach the board server. Trying again…"}
              </Alert>
            ) : (
              <>
                <CircularProgress size={28} />
                <Typography color="text.secondary">Loading the board…</Typography>
              </>
            )}
          </Stack>
        )}

        <Snackbar
          open={!!error}
          autoHideDuration={5000}
          onClose={() => useBoard.getState().setError(null)}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
        >
          <Alert severity="error" variant="filled" onClose={() => useBoard.getState().setError(null)}>
            {error}
          </Alert>
        </Snackbar>
        <Snackbar
          open={!!promoted}
          autoHideDuration={8000}
          onClose={() => promoted?.dismiss()}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
        >
          <Alert severity="success" variant="filled" onClose={() => promoted?.dismiss()}>
            You&apos;re now staff ({promoted?.role}). You can register animals, move them and post updates.
          </Alert>
        </Snackbar>
        <AnimalDrawer />
        <AnimalFormDialog />
        <Toasts bottomOffset={mobile ? MOBILE_NAV_HEIGHT : 0} />
      </Box>
    </SendContext.Provider>
  );
}

/** Shows a one-off message when a coordinator makes you staff while you're on the board. */
function usePromotion(me: User) {
  const was = useRef(me.role);
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    if (!isStaff(was.current) && isStaff(me.role)) setRole(ROLE_LABELS[me.role].toLowerCase());
    was.current = me.role;
  }, [me.role]);
  return role ? { role, dismiss: () => setRole(null) } : null;
}
