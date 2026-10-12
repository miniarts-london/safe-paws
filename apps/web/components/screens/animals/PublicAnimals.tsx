"use client";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { useBoard } from "@safe-paws/shared/store";
import { useEffect } from "react";
import type { PublicSnapshot } from "@/lib/publicBoard";
import { AnimalDetail } from "../board/AnimalDetail";
import { AnimalDirectory } from "../board/AnimalDirectory";
import { SiteFooter, SiteHeader } from "./../../SiteChrome";

/**
 * The Animals pages for visitors who aren't signed in: the same list and
 * profiles, read-only, from a snapshot taken when the page loaded (no live
 * updates). No Follow button; Adopt/Sponsor and Like ask them to join.
 */
export function PublicAnimals({ snapshot, animalId }: { snapshot: PublicSnapshot; animalId?: string }) {
  // Filled in after the page arrives, in the browser only. (The store is shared on the
  // server, so filling it there could leak into someone else's page.)
  useEffect(() => {
    useBoard.setState({ me: null, users: snapshot.users, board: snapshot.board, notifications: [], openAnimalId: null });
  }, [snapshot]);
  const ready = useBoard((s) => s.board === snapshot.board);

  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
      <SiteHeader signedIn={false} />
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {!ready ? (
          <Box sx={{ display: "grid", placeItems: "center", py: 10 }}>
            <CircularProgress size={28} aria-label="Loading the animals" />
          </Box>
        ) : animalId ? (
          <AnimalDetail animalId={animalId} />
        ) : (
          <AnimalDirectory />
        )}
      </Box>
      <SiteFooter />
    </Box>
  );
}
