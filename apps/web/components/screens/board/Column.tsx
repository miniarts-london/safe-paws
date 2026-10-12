"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { Animal, STAGES, User } from "@safe-paws/shared/protocol";
import { AnimalCard } from "./AnimalCard";

type Stage = (typeof STAGES)[number];
type Props = { stage: Stage; ids: string[]; animals: Record<string, Animal>; users: User[]; me: string | null; now: number };

export function Column({ stage, ids, animals, users, me, now }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <Paper
      component="section"
      aria-labelledby={`col-${stage.id}`}
      elevation={0}
      sx={{
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        borderRadius: 3,
        border: 1,
        borderColor: isOver ? "mint.dark" : "transparent",
        bgcolor: isOver ? "mint.light" : "background.column",
        transition: "background-color .15s, border-color .15s",
      }}
    >
      <Box sx={{ px: 1.5, pt: 1.5, pb: 0.75 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography id={`col-${stage.id}`} variant="subtitle2" component="h2" sx={{ fontWeight: 650 }}>
            {stage.label}
          </Typography>
          <Chip label={ids.length} size="small" sx={{ height: 20, bgcolor: "background.paper", fontSize: 11 }} />
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {stage.hint}
        </Typography>
      </Box>
      <SortableContext id={stage.id} items={ids} strategy={verticalListSortingStrategy}>
        <Stack ref={setNodeRef} component="ul" spacing={1} sx={{ flex: 1, minHeight: 120, m: 0, p: 1, listStyle: "none" }}>
          {ids.map((id) => animals[id] && <AnimalCard key={id} animal={animals[id]} users={users} me={me} now={now} />)}
          {ids.length === 0 && (
            <Box
              component="li"
              sx={{ display: "grid", placeItems: "center", minHeight: 80, border: "1.5px dashed", borderColor: "divider", borderRadius: 2.5 }}
            >
              <Typography variant="body2" color="text.secondary">
                Drop an animal here
              </Typography>
            </Box>
          )}
        </Stack>
      </SortableContext>
    </Paper>
  );
}
