"use client";

import AddIcon from "@mui/icons-material/Add";
import FavoriteBorderOutlined from "@mui/icons-material/FavoriteBorderOutlined";
import NotificationsNoneOutlined from "@mui/icons-material/NotificationsNoneOutlined";
import ViewKanbanOutlined from "@mui/icons-material/ViewKanbanOutlined";
import Badge from "@mui/material/Badge";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Chip from "@mui/material/Chip";
import Fab from "@mui/material/Fab";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { animalFacts } from "@safe-paws/shared/format";
import { STAGES, stageLabel, type Animal, type StageId } from "@safe-paws/shared/protocol";
import { HOME_STAGE, NEXT_ACTION, nextStage } from "@safe-paws/shared/stages";
import { useBoard, useCanEdit } from "@safe-paws/shared/store";
import { timeAgo, useNow } from "@safe-paws/shared/time";
import { useState, type ReactNode } from "react";
import { useAnimalForm } from "@/lib/formStore";
import { useSend } from "@/lib/useBoardSocket";
import { AnimalAvatar } from "./AnimalCard";
import { NotificationList, useMarkRead } from "./NotificationList";

type Tab = "board" | "following" | "alerts";

/** Height of the bottom navigation, so toasts and content can clear it. */
export const MOBILE_NAV_HEIGHT = 64;

export function MobileBoard() {
  const me = useBoard((s) => s.users.find((u) => u.id === s.me));
  // Sponsors care about their animals more than the pipeline, so they start on Following.
  const [tab, setTab] = useState<Tab>(me?.role === "sponsor" ? "following" : "board");
  const [stage, setStage] = useState<StageId>(me ? HOME_STAGE[me.role] : "reported");
  const unread = useBoard((s) => s.notifications.filter((n) => !n.read).length);
  const canEdit = useCanEdit();

  return (
    <Box sx={{ flex: 1, pb: `calc(${MOBILE_NAV_HEIGHT + 88}px + env(safe-area-inset-bottom, 0px))` }}>
      {tab === "board" && <StageView stage={stage} onStage={setStage} />}
      {tab === "following" && <FollowingView />}
      {tab === "alerts" && <AlertsView />}

      {canEdit && (
        <Fab
          color="primary"
          variant="extended"
          onClick={() => useAnimalForm.getState().openCreate()}
          sx={{ position: "fixed", right: 16, bottom: `calc(${MOBILE_NAV_HEIGHT + 16}px + env(safe-area-inset-bottom, 0px))`, zIndex: "speedDial" }}
        >
          <AddIcon sx={{ mr: 1 }} />
          Register
        </Fab>
      )}

      <Paper
        component="nav"
        aria-label="Sections"
        elevation={0}
        sx={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: "appBar", borderTop: 1, borderColor: "divider", pb: "env(safe-area-inset-bottom, 0px)" }}
      >
        <BottomNavigation showLabels value={tab} onChange={(_, v: Tab) => setTab(v)} sx={{ height: MOBILE_NAV_HEIGHT }}>
          <BottomNavigationAction label="Board" value="board" icon={<ViewKanbanOutlined />} />
          <BottomNavigationAction label="Following" value="following" icon={<FavoriteBorderOutlined />} />
          <BottomNavigationAction
            label="Alerts"
            value="alerts"
            aria-label={unread ? `Alerts, ${unread} unread` : "Alerts"}
            icon={
              <Badge badgeContent={unread} color="primary" max={9}>
                <NotificationsNoneOutlined />
              </Badge>
            }
          />
        </BottomNavigation>
      </Paper>
    </Box>
  );
}

/* ---------- Board: one stage at a time ---------- */

function StageView({ stage, onStage }: { stage: StageId; onStage: (s: StageId) => void }) {
  const columns = useBoard((s) => s.board!.columns);
  const animals = useBoard((s) => s.board!.animals);
  const hint = STAGES.find((s) => s.id === stage)!.hint;
  const ids = columns[stage];

  return (
    <>
      <Box sx={{ position: "sticky", top: 56, zIndex: 2, bgcolor: "background.default", borderBottom: 1, borderColor: "divider" }}>
        <Tabs
          value={stage}
          onChange={(_, v: StageId) => onStage(v)}
          variant="scrollable"
          scrollButtons={false}
          aria-label="Stages"
          sx={{ px: 1 }}
        >
          {STAGES.map((s) => (
            <Tab
              key={s.id}
              value={s.id}
              label={
                <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                  <span>{s.label}</span>
                  <Chip label={columns[s.id].length} size="small" sx={{ height: 18, fontSize: 11 }} />
                </Stack>
              }
            />
          ))}
        </Tabs>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ px: 2, pt: 1.5, pb: 1 }}>
        {hint}
      </Typography>
      <CardList>
        {ids.map((id) => animals[id] && <MobileCard key={id} animal={animals[id]} />)}
        {ids.length === 0 && <EmptyNote>No animals in {stageLabel(stage).toLowerCase()} right now.</EmptyNote>}
      </CardList>
    </>
  );
}

function MobileCard({ animal, showStage = false }: { animal: Animal; showStage?: boolean }) {
  const users = useBoard((s) => s.users);
  const me = useBoard((s) => s.me);
  const canEdit = useCanEdit();
  const send = useSend();
  const now = useNow();
  const next = canEdit ? nextStage(animal.stage) : null;
  const latest = animal.notes.at(-1)?.text ?? (animal.about || undefined);
  const by = users.find((u) => u.id === animal.updatedBy)?.name ?? "someone";
  const following = !!me && animal.followers.includes(me);

  return (
    <Card component="li" sx={{ borderRadius: 3 }}>
      <CardActionArea onClick={() => useBoard.getState().openAnimal(animal.id)} aria-label={`Open ${animal.name}`} sx={{ p: 1.5 }}>
        <Stack spacing={1}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <AnimalAvatar animal={animal} size={44} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 650, fontSize: 16 }}>
                {animal.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {animalFacts(animal)}
              </Typography>
            </Box>
            {showStage ? (
              <Chip label={stageLabel(animal.stage)} size="small" />
            ) : (
              following && <Chip label="Following" size="small" color="mint" />
            )}
          </Stack>
          {latest && (
            <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
              {latest}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            <Box component="strong" sx={{ color: "text.primary", fontWeight: 600 }}>
              {animal.area}
            </Box>{" "}
            · {timeAgo(animal.updatedAt, now)} · {by}
          </Typography>
        </Stack>
      </CardActionArea>
      {next && !showStage && (
        <Box sx={{ px: 1.5, pb: 1.5 }}>
          <Button
            fullWidth
            variant="outlined"
            sx={{ minHeight: 44 }}
            onClick={() => send({ type: "animal.move", animalId: animal.id, toStage: next, toIndex: 0 })}
          >
            {NEXT_ACTION[next]} →
          </Button>
        </Box>
      )}
    </Card>
  );
}

/* ---------- Following and Alerts ---------- */

function FollowingView() {
  const me = useBoard((s) => s.me);
  const animals = useBoard((s) => s.board!.animals);
  const mine = Object.values(animals)
    .filter((a) => me && a.followers.includes(me))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <>
      <Typography variant="h1" component="h2" sx={{ px: 2, pt: 2, pb: 1.5, fontSize: 20 }}>
        Following
      </Typography>
      <CardList>
        {mine.map((a) => (
          <MobileCard key={a.id} animal={a} showStage />
        ))}
        {mine.length === 0 && (
          <EmptyNote>
            You&apos;re not following any animals yet. Open one on the Board and tap Follow updates to hear when it moves
            or someone posts news.
          </EmptyNote>
        )}
      </CardList>
    </>
  );
}

function AlertsView() {
  const unread = useBoard((s) => s.notifications.filter((n) => !n.read).length);
  const markRead = useMarkRead();
  return (
    <>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", px: 2, pt: 2, pb: 1 }}>
        <Typography variant="h1" component="h2" sx={{ fontSize: 20 }}>
          Alerts
        </Typography>
        {unread > 0 && (
          <Button size="small" onClick={() => markRead("all")}>
            Mark all as read
          </Button>
        )}
      </Stack>
      <Box sx={{ px: 1 }}>
        <NotificationList />
      </Box>
    </>
  );
}

function CardList({ children }: { children: ReactNode }) {
  return (
    <Stack component="ul" spacing={1.25} sx={{ m: 0, px: 2, listStyle: "none" }}>
      {children}
    </Stack>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <Box component="li" sx={{ p: 2.5, border: "1.5px dashed", borderColor: "divider", borderRadius: 3, textAlign: "center" }}>
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
        {children}
      </Typography>
    </Box>
  );
}
