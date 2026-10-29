"use client";

import CheckCircle from "@mui/icons-material/CheckCircle";
import HowToRegOutlined from "@mui/icons-material/HowToRegOutlined";
import LogoutOutlined from "@mui/icons-material/LogoutOutlined";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Snackbar from "@mui/material/Snackbar";
import Tooltip from "@mui/material/Tooltip";
import type { User } from "@safe-paws/shared/protocol";
import { checkInSpot, mainShelter } from "@safe-paws/shared/shelter";
import { useState } from "react";
import { useShelter } from "@/lib/useShelter";

/**
 * "I'm here" in the top bar, for staff: check in at the main shelter (the
 * layout shown to visitors) from any page, so visitors know who to ask. Once
 * checked in it shows "On duty", with a menu to check out. Staff aren't drawn on
 * the plan; visitors see a list of who's on duty. Hidden until there's a main shelter.
 */
export function OnDutyButton({ me, compact, onShelterPage }: { me: User; compact: boolean; onShelterPage: boolean }) {
  const { state, change, error, clearError } = useShelter(me);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const main = state ? mainShelter(state.layouts) : undefined;
  if (!main) return null;
  const mine = main.staff.find((s) => s.userId === me.id);

  const checkIn = () => {
    clearError();
    change({ op: "checkin", layoutId: main.id, ...checkInSpot(main, me.id) });
    if (!onShelterPage) setNotice(`You're on duty at ${main.name}.`);
  };
  const checkOut = () => {
    setMenu(null);
    clearError();
    change({ op: "checkout" });
    if (!onShelterPage) setNotice("Checked out. Thanks for today!");
  };

  return (
    <>
      {!mine ? (
        compact ? (
          <Tooltip title="I'm here: check in at the shelter" describeChild>
            <IconButton aria-label={`I'm here: check in at ${main.name}`} onClick={checkIn} sx={{ color: "text.secondary" }}>
              <HowToRegOutlined />
            </IconButton>
          </Tooltip>
        ) : (
          <Tooltip title={`Check in at ${main.name}, so visitors know who to ask`} describeChild>
            <Button variant="outlined" size="small" startIcon={<HowToRegOutlined />} onClick={checkIn} sx={{ whiteSpace: "nowrap" }}>
              I&apos;m here
            </Button>
          </Tooltip>
        )
      ) : compact ? (
        <IconButton
          aria-label="On duty. Options"
          aria-haspopup="menu"
          onClick={(e) => setMenu(e.currentTarget)}
          color="primary"
        >
          <CheckCircle />
        </IconButton>
      ) : (
        <Button
          variant="contained"
          size="small"
          startIcon={<CheckCircle />}
          aria-haspopup="menu"
          onClick={(e) => setMenu(e.currentTarget)}
          sx={{ whiteSpace: "nowrap" }}
        >
          On duty
        </Button>
      )}

      <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)}>
        <MenuItem disabled sx={{ opacity: "1 !important" }}>
          <ListItemText
            primary={`On duty at ${main.name}`}
            secondary={main.public ? "Visitors can see you're here" : "Only staff can see this layout"}
          />
        </MenuItem>
        <MenuItem onClick={checkOut}>
          <ListItemIcon>
            <LogoutOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText>I&apos;ve left</ListItemText>
        </MenuItem>
      </Menu>

      {/* The Shelter page shows its own messages; elsewhere, say what happened here. */}
      {!onShelterPage && (
        <Snackbar
          open={!!notice || !!error}
          autoHideDuration={error ? 6000 : 5000}
          onClose={() => {
            setNotice(null);
            clearError();
          }}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
        >
          <Alert
            severity={error ? "error" : "success"}
            variant="filled"
            onClose={() => {
              setNotice(null);
              clearError();
            }}
          >
            {error ?? notice}
          </Alert>
        </Snackbar>
      )}
    </>
  );
}
