"use client";

import AccountCircleOutlined from "@mui/icons-material/AccountCircleOutlined";
import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
import Logout from "@mui/icons-material/Logout";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import ButtonBase from "@mui/material/ButtonBase";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import type { User } from "@safe-paws/shared/protocol";
import { useBoard } from "@safe-paws/shared/store";
import NextLink from "next/link";
import { useState, useTransition } from "react";
import { logout } from "@/app/login/actions";

/**
 * Your name and title in the top bar; click for Profile, Settings for
 * coordinators (where new members are reviewed), and Sign out. Coordinators see
 * how many people are waiting for review as a badge. On phones it's an icon.
 */
export function AccountMenu({ me, compact }: { me: User; compact: boolean }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [signingOut, startSignOut] = useTransition();
  const coordinator = me.role === "coordinator";
  const waiting = useBoard((s) => (coordinator ? s.members.filter((m) => m.reviewedAt === null).length : 0));
  const label = `${me.name}: profile${coordinator ? ", settings" : ""} and sign out${waiting ? `, ${waiting} waiting for review` : ""}`;

  return (
    <>
      {compact ? (
        <IconButton aria-label={label} aria-haspopup="menu" aria-expanded={!!anchor} onClick={(e) => setAnchor(e.currentTarget)} sx={{ color: "text.secondary" }}>
          <Badge badgeContent={waiting} color="primary" max={9}>
            <AccountCircleOutlined />
          </Badge>
        </IconButton>
      ) : (
        <ButtonBase
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={!!anchor}
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={{
            gap: 0.5,
            px: 1,
            py: 0.5,
            borderRadius: 2,
            textAlign: "right",
            "&:hover": { bgcolor: "action.hover" },
            "&:focus-visible": { outline: 2, outlineColor: "primary.main", outlineOffset: 2 },
          }}
        >
          <Box sx={{ lineHeight: 1.2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {me.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              {me.title}
            </Typography>
          </Box>
          <Badge badgeContent={waiting} color="primary" max={9}>
            <KeyboardArrowDown fontSize="small" sx={{ color: "text.secondary" }} />
          </Badge>
        </ButtonBase>
      )}
      <Menu
        anchorEl={anchor}
        open={!!anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {compact && (
          <MenuItem disabled sx={{ opacity: "1 !important" }}>
            <ListItemText primary={me.name} secondary={me.title} />
          </MenuItem>
        )}
        <MenuItem component={NextLink} href="/profile" onClick={() => setAnchor(null)}>
          <ListItemIcon>
            <AccountCircleOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText>Profile</ListItemText>
        </MenuItem>
        {coordinator && (
          <MenuItem component={NextLink} href="/settings" onClick={() => setAnchor(null)}>
            <ListItemIcon>
              <SettingsOutlined fontSize="small" />
            </ListItemIcon>
            <ListItemText secondary={waiting ? `${waiting} waiting for review` : undefined}>Settings</ListItemText>
          </MenuItem>
        )}
        <Divider />
        {/* The server clears the sign-in cookie and goes to the sign-in page. */}
        <MenuItem disabled={signingOut} onClick={() => startSignOut(() => logout())}>
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          <ListItemText>{signingOut ? "Signing out…" : "Sign out"}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
