"use client";

import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import type { Notification } from "@safe-paws/shared/protocol";
import { useBoard } from "@safe-paws/shared/store";
import { timeAgo, useNow } from "@safe-paws/shared/time";
import { useSend } from "@/lib/useBoardSocket";
import { visuallyHidden } from "@/lib/visuallyHidden";

/** The list behind the bell on desktop and the Alerts tab on phones. */
export function useMarkRead() {
  const send = useSend();
  return (ids: number[] | "all") => {
    useBoard.getState().markRead(ids); // optimistic; the server echoes to your other tabs
    send({ type: "notifications.read", ids });
  };
}

export function NotificationList({ onPick }: { onPick?: () => void }) {
  const notifications = useBoard((s) => s.notifications);
  const markRead = useMarkRead();
  const now = useNow();

  const open = (n: Notification) => {
    if (!n.read) markRead([n.id]);
    useBoard.getState().openAnimal(n.animalId);
    onPick?.();
  };

  if (notifications.length === 0) {
    return (
      <Typography color="text.secondary" variant="body2" sx={{ p: 2, lineHeight: 1.6 }}>
        Nothing yet. You&apos;ll hear here when an animal you follow, or one that needs you, changes.
      </Typography>
    );
  }

  return (
    <List disablePadding sx={{ p: 0.5 }}>
      {notifications.map((n) => (
        <ListItemButton
          key={n.id}
          onClick={() => open(n)}
          sx={{
            borderRadius: 2,
            mb: 0.5,
            alignItems: "flex-start",
            bgcolor: n.read ? "transparent" : "mint.light",
            "&:hover": { bgcolor: n.read ? "action.hover" : "mint.light" },
          }}
        >
          {!n.read && (
            <Box
              aria-hidden
              sx={{ width: 8, height: 8, borderRadius: 1, mt: 1, mr: 1.25, flex: "none", bgcolor: "primary.main" }}
            />
          )}
          <ListItemText
            primary={n.text}
            secondary={timeAgo(n.at, now)}
            slotProps={{ primary: { variant: "body2", sx: { lineHeight: 1.5 } }, secondary: { variant: "caption" } }}
            sx={{ ml: n.read ? 2.25 : 0, my: 0 }}
          />
          {!n.read && (
            <Box component="span" sx={visuallyHidden}>
              Unread
            </Box>
          )}
        </ListItemButton>
      ))}
    </List>
  );
}
