"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
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

/** Where updates would be, for visitors: updates are for members, so invite them to join or sign in. */
export function JoinToSeeUpdates({ animal, compact = false }: { animal: Animal; compact?: boolean }) {
  const next = encodeURIComponent(`/animals/${animal.id}`);
  const join = (
    <Link component={NextLink} href={`/register?next=${next}`} sx={{ fontWeight: 600 }}>
      Join for free
    </Link>
  );
  const signIn = (
    <Link component={NextLink} href={`/login?next=${next}`} sx={{ fontWeight: 600 }}>
      sign in
    </Link>
  );
  return (
    <Typography variant={compact ? "body2" : "body1"} color="text.secondary" sx={{ lineHeight: 1.6 }}>
      {compact ? (
        <>
          {join} or {signIn} to read {animal.name}&apos;s updates.
        </>
      ) : (
        <>
          Updates on how {animal.name} is doing are for members.{" "}
          <Box component="span" sx={{ whiteSpace: "nowrap" }}>
            {join}
          </Box>{" "}
          or {signIn} to read them.
        </>
      )}
    </Typography>
  );
}
