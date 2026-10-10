"use client";

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import type { Animal } from "@safe-paws/shared/protocol";
import NextLink from "next/link";

/**
 * For visitors who aren't signed in: offering to adopt or sponsor (or liking)
 * needs an account, so the coordinators know who to get back to. Joining or
 * signing in brings them straight back to this animal.
 */
export function JoinDialog({ animal, onClose }: { animal: Animal | null; onClose: () => void }) {
  if (!animal) return null;
  const next = encodeURIComponent(`/animals/${animal.id}`);
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="join-title" aria-describedby="join-text">
      <DialogTitle id="join-title">Help {animal.name}</DialogTitle>
      <DialogContent>
        <Typography id="join-text" sx={{ lineHeight: 1.6 }}>
          Create a free account to offer to adopt or sponsor {animal.name}. The coordinators will get in touch, and
          you&apos;ll hear how {animal.sex === "female" ? "she's" : "he's"} doing.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexWrap: "wrap", gap: 1 }}>
        <Button component={NextLink} href={`/login?next=${next}`} color="inherit">
          I have an account
        </Button>
        <Button component={NextLink} href={`/register?next=${next}`} variant="contained">
          Create an account
        </Button>
      </DialogActions>
    </Dialog>
  );
}
