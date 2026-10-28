"use client";

import Box from "@mui/material/Box";
import type { Animal } from "@safe-paws/shared/protocol";
import type { ShelterLayout } from "@safe-paws/shared/shelter";
import { SiteFooter, SiteHeader } from "../../SiteChrome";
import { ShelterMap } from "./ShelterMap";

/** The Shelter page for visitors who aren't signed in: the public layouts, read-only, as they were when the page loaded. */
export function PublicShelter({ layouts, animals }: { layouts: ShelterLayout[]; animals: Record<string, Animal> }) {
  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
      <SiteHeader signedIn={false} />
      <Box component="main" sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <ShelterMap layouts={layouts} animals={animals} />
      </Box>
      <SiteFooter />
    </Box>
  );
}
