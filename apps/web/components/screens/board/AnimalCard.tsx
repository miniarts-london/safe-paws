"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { animalFacts } from "@safe-paws/shared/format";
import type { Animal, User } from "@safe-paws/shared/protocol";
import { useBoard, useCanEdit } from "@safe-paws/shared/store";
import { timeAgo } from "@safe-paws/shared/time";
import { memo } from "react";
import { AnimalAvatar } from "../../AnimalAvatar";

type Props = { animal: Animal; users: User[]; me: string | null; now: number };

/** What a card shows. Used by the sortable card and by the drag overlay. */
export const CardBody = memo(function CardBody({ animal, users, me, now }: Props) {
  const openAnimal = useBoard((s) => s.openAnimal);
  const latest = animal.notes.at(-1)?.text ?? (animal.about || undefined);
  const by = users.find((u) => u.id === animal.updatedBy)?.name ?? "someone";
  const following = me ? animal.followers.includes(me) : false;

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
        <AnimalAvatar animal={animal} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 650 }}>{animal.name}</Typography>
          <Typography variant="caption" color="text.secondary">
            {animalFacts(animal)}
          </Typography>
        </Box>
      </Stack>
      {latest && (
        <Typography
          variant="body2"
          sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.45 }}
        >
          {latest}
        </Typography>
      )}
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          {animal.area}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {timeAgo(animal.updatedAt, now)} · {by}
        </Typography>
        {following && <Chip label="Following" size="small" color="mint" sx={{ ml: "auto !important", height: 22 }} />}
      </Stack>
      {/* Two panels: the animal's details, or its updates (and the form to post one). */}
      <Stack direction="row" spacing={1}>
        <PanelButton label="Details" aria-label={`Open ${animal.name}`} onOpen={() => openAnimal(animal.id, "details")} />
        <PanelButton
          label={`Updates (${animal.notes.length})`}
          aria-label={`${animal.name}'s updates`}
          onOpen={() => openAnimal(animal.id, "updates")}
        />
      </Stack>
    </Stack>
  );
});

/** A small card button that opens a panel without starting a drag. */
function PanelButton({ label, onOpen, ...rest }: { label: string; onOpen: () => void; "aria-label": string }) {
  return (
    <Button
      size="small"
      variant="outlined"
      color="inherit"
      aria-label={rest["aria-label"]}
      sx={{ minWidth: 0, px: 1, flex: 1, color: "text.secondary", borderColor: "divider" }}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      {label}
    </Button>
  );
}

export function AnimalCard(props: Props) {
  const { animal } = props;
  const openAnimal = useBoard((s) => s.openAnimal);
  const canEdit = useCanEdit();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: animal.id, disabled: !canEdit });

  return (
    <Card
      ref={setNodeRef}
      component="li"
      // Only staff can drag. For members the drag attributes would mark the card as
      // disabled to screen readers; the Details button opens it instead.
      {...(canEdit ? { ...attributes, ...listeners } : {})}
      aria-label={canEdit ? `${animal.name}, ${animal.species}. Press space to pick up and move between stages.` : undefined}
      onClick={() => openAnimal(animal.id)}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      sx={{
        p: 1.5,
        cursor: canEdit ? "grab" : "pointer",
        userSelect: "none",
        touchAction: "manipulation",
        opacity: isDragging ? 0.35 : 1,
        "&:hover": { borderColor: "primary.main" },
        "&:focus-visible": { outline: 2, outlineColor: "primary.main", outlineOffset: 2 },
      }}
    >
      <CardBody {...props} />
    </Card>
  );
}
