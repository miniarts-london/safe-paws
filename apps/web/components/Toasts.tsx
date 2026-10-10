"use client";

import Snackbar from "@mui/material/Snackbar";
import SnackbarContent from "@mui/material/SnackbarContent";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import ButtonBase from "@mui/material/ButtonBase";
import { openNotification, useBoard } from "@safe-paws/shared/store";

/**
 * New notifications pop up one at a time; the next one waits until the
 * current one is dismissed or times out. `bottomOffset` clears the phone
 * layout's bottom bar.
 */
export function Toasts({ bottomOffset = 0 }: { bottomOffset?: number }) {
  const toast = useBoard((s) => s.toasts[0]);
  const dismiss = useBoard((s) => s.dismissToast);
  if (!toast) return null;

  return (
    <Snackbar
      key={toast.key}
      open
      autoHideDuration={6000}
      onClose={(_, reason) => reason !== "clickaway" && dismiss(toast.key)}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      sx={{ bottom: { xs: 16 + bottomOffset, sm: 24 } }}
    >
      <SnackbarContent
        sx={{ maxWidth: 420, flexWrap: "nowrap", alignItems: "flex-start", "& .MuiSnackbarContent-action": { pl: 1, mr: -1 } }}
        message={
          <ButtonBase
            onClick={() => {
              openNotification(toast.notification);
              dismiss(toast.key);
            }}
            sx={{ font: "inherit", textAlign: "left", lineHeight: 1.5 }}
          >
            {toast.notification.text}
          </ButtonBase>
        }
        action={
          <IconButton size="small" color="inherit" aria-label="Dismiss" onClick={() => dismiss(toast.key)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      />
    </Snackbar>
  );
}
