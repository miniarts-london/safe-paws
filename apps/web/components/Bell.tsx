"use client";

import NotificationsNoneOutlined from "@mui/icons-material/NotificationsNoneOutlined";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Popover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useBoard } from "@safe-paws/shared/store";
import { useState } from "react";
import { NotificationList, useMarkRead } from "./NotificationList";

export function Bell() {
  const unread = useBoard((s) => s.notifications.filter((n) => !n.read).length);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = !!anchor;
  const close = () => setAnchor(null);
  const markRead = useMarkRead();

  return (
    <>
      <IconButton
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Badge badgeContent={unread} color="primary" max={9}>
          <NotificationsNoneOutlined />
        </Badge>
      </IconButton>
      <Popover
        open={open}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { width: 380, maxWidth: "calc(100vw - 32px)", maxHeight: "70vh", mt: 1 } } }}
      >
        <Stack
          direction="row"
          sx={{ alignItems: "center", justifyContent: "space-between", px: 2, py: 1.25, borderBottom: 1, borderColor: "divider", position: "sticky", top: 0, bgcolor: "background.paper", zIndex: 1 }}
        >
          <Typography variant="h2" component="h2">
            Notifications
          </Typography>
          {unread > 0 && (
            <Button size="small" onClick={() => markRead("all")}>
              Mark all as read
            </Button>
          )}
        </Stack>
        <Box>
          <NotificationList onPick={close} />
        </Box>
      </Popover>
    </>
  );
}
