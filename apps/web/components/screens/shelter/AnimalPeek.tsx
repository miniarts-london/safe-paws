"use client";

import CloseIcon from "@mui/icons-material/Close";
import OpenInNew from "@mui/icons-material/OpenInNew";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import { useBoard } from "@safe-paws/shared/store";
import NextLink from "next/link";
import { AnimalProfile } from "../board/AnimalDetail";

/**
 * For visitors on the Visit page: an animal's details in a side panel, the same
 * as its public page (photos, facts, adopt or sponsor), so the plan stays in view.
 */
export function AnimalPeek() {
  const id = useBoard((s) => s.openAnimalId);
  const animal = useBoard((s) => (id ? s.board?.animals[id] : undefined));
  const close = () => useBoard.getState().openAnimal(null);
  return (
    <Drawer
      anchor="right"
      open={!!animal}
      onClose={close}
      slotProps={{ paper: { sx: { width: { xs: "100%", sm: 480 }, bgcolor: "background.default" } } }}
    >
      {animal && (
        <Box role="dialog" aria-label={animal.name} sx={{ p: 2 }}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
            <Button component={NextLink} href={`/animals/${animal.id}`} size="small" endIcon={<OpenInNew fontSize="small" />}>
              Full page
            </Button>
            <IconButton onClick={close} aria-label="Close">
              <CloseIcon />
            </IconButton>
          </Stack>
          <AnimalProfile animal={animal} />
        </Box>
      )}
    </Drawer>
  );
}
