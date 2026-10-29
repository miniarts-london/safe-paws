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
import NextLink from "next/link";
import { useBoard } from "@safe-paws/shared/store";
import { useEffect, useRef, useState } from "react";
import { MOBILE_QUERY, useMediaQuery } from "@/lib/useMediaQuery";
import { SendContext, useBoardSocket, type Connection } from "@/lib/useBoardSocket";
import { useAnimalForm } from "@/lib/formStore";
import { SITE_NAME } from "@/lib/site";
import { AnimalDetail } from "./AnimalDetail";
import { AnimalDirectory } from "./AnimalDirectory";
import { AnimalDrawer } from "./AnimalDrawer";
import { AnimalFormDialog } from "./AnimalForm";
import { Bell } from "./../../Bell";
import { AccountMenu } from "./../../AccountMenu";
import { ProfilePage, SettingsPage } from "../account/AccountPages";
import { OfferContactDialog } from "./../../OfferContactDialog";
import { Board } from "./Board";
import { DonateContent } from "./../donate/DonatePage";
import { SocialStudio } from "../social/SocialStudio";
import { ShelterPlan } from "../shelter/ShelterPlan";
import { OnDutyButton } from "../shelter/OnDutyButton";
import { MOBILE_NAV_HEIGHT, MobileBoard } from "./MobileBoard";
import { ThemeToggle } from "./../../ThemeToggle";
import { Toasts } from "./../../Toasts";

const CONNECTION: Record<Connection, { label: string; color: "mint" | "default" | "error" }> = {
  open: { label: "Live", color: "mint" },
  connecting: { label: "Connecting…", color: "default" },
  closed: { label: "Offline", color: "error" },
};

export type View = "board" | "animals" | "animal" | "shelter" | "donate" | "social" | "profile" | "settings";

/** The menu. `short` is what phones show, in the menu's own row under the name. */
const VIEWS: { id: View; label: string; short: string; href: string }[] = [
  { id: "animals", label: "Meet our animals", short: "Animals", href: "/animals" },
  { id: "board", label: "Rescue board", short: "Board", href: "/board" },
  // Staff arrange it; everyone else sees the layouts staff made public.
  { id: "shelter", label: "Shelter", short: "Shelter", href: "/shelter" },
  { id: "donate", label: "Donate", short: "Donate", href: "/donate" },
  // Coordinators only.
  { id: "social", label: "Social post", short: "Social", href: "/social" },
];

export default function BoardApp({
  initialMe,
  view = "board",
  animalId,
  email = "",
}: {
  initialMe: User;
  view?: View;
  /** For view "animal": which animal's page. */
  animalId?: string;
  /** For view "profile": your email. */
  email?: string;
}) {
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
  // An animal's page belongs to the Animals section.
  const section: View = view === "animal" ? "animals" : view;
  // Straight after signing up (?welcome=1). Read once, then tidy the address bar.
  const [welcome] = useState(() => new URLSearchParams(window.location.search).has("welcome"));
  useEffect(() => {
    if (welcome) window.history.replaceState(null, "", window.location.pathname);
  }, [welcome]);
  // From the home page's "Register a new animal" shortcut (?register=1): open the form straight away.
  const [register] = useState(() => new URLSearchParams(window.location.search).has("register"));
  useEffect(() => {
    if (!register) return;
    window.history.replaceState(null, "", window.location.pathname);
    if (canEdit) useAnimalForm.getState().openCreate();
  }, [register, canEdit]);

  const nav = (
    <Stack
      component="nav"
      aria-label="Pages"
      direction="row"
      spacing={0.5}
      sx={mobile ? { height: 44, px: 1, pb: 0.75, alignItems: "center", "& > a": { flex: 1 } } : undefined}
    >
      {VIEWS.filter((v) => v.id !== "social" || me.role === "coordinator").map((v) => (
        <Button
          key={v.id}
          component={NextLink}
          href={v.href}
          size="small"
          aria-current={view === v.id ? "page" : undefined}
          color={section === v.id ? "primary" : "inherit"}
          sx={{
            minWidth: 0,
            px: 1.25,
            whiteSpace: "nowrap",
            fontWeight: 600,
            color: section === v.id ? undefined : "text.secondary",
            bgcolor: section === v.id ? "action.selected" : undefined,
          }}
        >
          {mobile ? v.short : v.label}
        </Button>
      ))}
    </Stack>
  );

  return (
    <SendContext.Provider value={send}>
      <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
        <AppBar position="sticky" sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}>
          <Toolbar sx={{ gap: { xs: 1, sm: 1.5 }, minHeight: { xs: 56 }, px: { xs: 2, sm: 2.5 } }}>
            <Stack direction="row" spacing={{ xs: 0.75, sm: 1.25 }} sx={{ alignItems: "baseline", flex: 1, minWidth: 0 }}>
              <Typography variant="h6" component="h1" noWrap sx={{ fontWeight: 700, fontSize: { xs: "1.125rem", sm: "1.25rem" } }}>
                <Box component={NextLink} href="/" sx={{ color: "inherit", textDecoration: "none", borderRadius: 0.5, "&:hover": { color: "primary.main" }, "&:focus-visible": { outline: 2, outlineColor: "primary.main", outlineOffset: 2 } }}>
                  {SITE_NAME}
                </Box>
              </Typography>
              {!mobile && nav}
            </Stack>
            {!mobile && canEdit && view === "board" && (
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
            {/* Staff: "I'm here" at the main shelter, next to their name. */}
            {canEdit && <OnDutyButton me={me} compact={mobile} onShelterPage={view === "shelter"} />}
            {/* Name and title: a menu with Profile, and Settings for coordinators. */}
            <AccountMenu me={me} compact={mobile} />
            <ThemeToggle />
            {!mobile && <Bell />}
          </Toolbar>
          {mobile && nav}
        </AppBar>

        {!canEdit && (view === "board" || view === "animals" || view === "animal" || view === "social") && (
          <Alert severity="info" sx={{ mx: { xs: 2, sm: 2.5 }, mt: 1.5 }}>
            {welcome ? <strong>Welcome, {me.name}! </strong> : null}
            You can see every animal and follow the ones you care about. If you volunteer with the rescue, a coordinator
            can give you access to update the board.
          </Alert>
        )}

        {canEdit && !mobile && view === "board" && (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2.5, pt: 1.5 }}>
            Signed in as <strong>{me.name}</strong>. Sign in as someone else in a private window to see changes and
            notifications arrive live.
          </Typography>
        )}

        {view === "donate" ? (
          // Doesn't need the board, so it shows straight away.
          <DonateContent />
        ) : board ? (
          view === "social" ? (
            <SocialStudio />
          ) : view === "profile" ? (
            <ProfilePage me={me} email={email} />
          ) : view === "settings" ? (
            <SettingsPage />
          ) : view === "shelter" ? (
            <ShelterPlan />
          ) : view === "animals" ? (
            <AnimalDirectory />
          ) : view === "animal" && animalId ? (
            <AnimalDetail animalId={animalId} />
          ) : mobile ? (
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
        <OfferContactDialog />
        <Toasts bottomOffset={mobile && view === "board" ? MOBILE_NAV_HEIGHT : 0} />
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
