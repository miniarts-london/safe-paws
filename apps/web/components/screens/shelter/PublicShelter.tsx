"use client";

import Box from "@mui/material/Box";
import type { ShelterLayout } from "@safe-paws/shared/shelter";
import { useBoard } from "@safe-paws/shared/store";
import { useEffect } from "react";
import type { PublicSnapshot } from "@/lib/publicBoard";
import { SiteFooter, SiteHeader } from "../../SiteChrome";
import { AnimalPeek } from "./AnimalPeek";
import { ShelterMap } from "./ShelterMap";

/**
 * The Visit page for visitors who aren't signed in: the public layouts, read-only,
 * as they were when the page loaded. Clicking an animal opens its details in a
 * side panel (the same as its public page).
 */
export function PublicShelter({ layouts, snapshot }: { layouts: ShelterLayout[]; snapshot: PublicSnapshot }) {
  // Filled in after the page arrives, in the browser only, like the public Animals page.
  // (The store is shared on the server, so filling it there could leak into someone else's page.)
  useEffect(() => {
    useBoard.setState({ me: null, users: snapshot.users, board: snapshot.board, notifications: [], openAnimalId: null });
  }, [snapshot]);
  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
      <SiteHeader signedIn={false} />
      <Box component="main" sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <ShelterMap layouts={layouts} animals={snapshot.board.animals} />
      </Box>
      <SiteFooter />
      <AnimalPeek />
    </Box>
  );
}
