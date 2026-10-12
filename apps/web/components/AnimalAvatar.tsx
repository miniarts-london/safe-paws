"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { animalFacts, photos } from "@safe-paws/shared/format";
import type { Animal, User } from "@safe-paws/shared/protocol";
import { useBoard, useCanEdit } from "@safe-paws/shared/store";
import { timeAgo } from "@safe-paws/shared/time";
import { memo } from "react";

export function AnimalAvatar({ animal, size = 40 }: { animal: Animal; size?: number }) {
  const photo = photos(animal).at(-1);
  return (
    <Avatar
      variant="rounded"
      aria-hidden
      src={photo?.url}
      sx={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        fontWeight: 700,
        borderRadius: "12px", // a string, so MUI doesn't multiply it by the theme radius
        color: animal.species === "dog" ? "species.onDog" : "species.onCat",
        bgcolor: animal.species === "dog" ? "species.dog" : "species.cat",
      }}
    >
      {animal.name[0]}
    </Avatar>
  );
}