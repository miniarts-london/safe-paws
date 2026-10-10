"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import CloseIcon from "@mui/icons-material/Close";
import EditOutlined from "@mui/icons-material/EditOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { animalFacts, NEUTERED_LABEL } from "@safe-paws/shared/format";
import { STAGES, stageLabel, type Animal, type Media, type StageId } from "@safe-paws/shared/protocol";
import { NOTE_MAX, noteSchema, type NoteInput } from "@safe-paws/shared/schemas";
import { useBoard, useCanEdit } from "@safe-paws/shared/store";
import { timeAgo, useNow } from "@safe-paws/shared/time";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useAnimalForm } from "@/lib/formStore";
import { useSend } from "@/lib/useBoardSocket";
import { AnimalAvatar } from "./AnimalCard";
import { OffersAccordion } from "./OffersAccordion";

/** Photos and videos, newest first. Photos open full size in a new tab. */
function Gallery({ media }: { media: Media[] }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 1 }}>
      {[...media].reverse().map((m) =>
        m.kind === "video" ? (
          <Box key={m.id} sx={{ gridColumn: "1 / -1", borderRadius: 2, overflow: "hidden", bgcolor: "#000" }}>
            <video src={m.url} controls playsInline preload="metadata" style={{ width: "100%", maxHeight: 280, display: "block" }} aria-label={m.name} />
          </Box>
        ) : (
          <Box
            key={m.id}
            component="a"
            href={m.url}
            target="_blank"
            rel="noopener"
            sx={{ aspectRatio: "1", borderRadius: 2, overflow: "hidden", display: "block", bgcolor: "background.column" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- auth-gated media can't go through next/image */}
            <img src={m.url} alt={m.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </Box>
        ),
      )}
    </Box>
  );
}

export function AnimalDrawer() {
  const id = useBoard((s) => s.openAnimalId);
  const animal = useBoard((s) => (id ? s.board?.animals[id] : undefined));
  const close = () => useBoard.getState().openAnimal(null);

  return (
    <Drawer
      anchor="right"
      open={!!animal}
      onClose={close}
      slotProps={{ paper: { sx: { width: { xs: "100%", sm: 440 } } } }}
    >
      {/* Keyed by animal, so the update form resets whenever a different animal opens. */}
      {animal && <Panel key={animal.id} animal={animal} onClose={close} />}
    </Drawer>
  );
}

function Panel({ animal, onClose }: { animal: Animal; onClose: () => void }) {
  const users = useBoard((s) => s.users);
  const me = useBoard((s) => s.me);
  const canEdit = useCanEdit();
  const send = useSend();
  const now = useNow();
  const following = me ? animal.followers.includes(me) : false;
  const name = (uid: string) => users.find((u) => u.id === uid)?.name ?? uid;

  const { control, handleSubmit, reset, formState } = useForm<NoteInput>({
    resolver: zodResolver(noteSchema),
    defaultValues: { text: "" },
    mode: "onChange",
  });
  const length = useWatch({ control, name: "text" }).length;

  const post = handleSubmit(({ text }) => {
    if (send({ type: "animal.note", animalId: animal.id, text })) reset();
  });

  return (
    <Stack spacing={2.5} sx={{ p: { xs: 2, sm: 2.5 }, pb: "calc(24px + env(safe-area-inset-bottom, 0px))" }} role="dialog" aria-labelledby="drawer-title">
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        <AnimalAvatar animal={animal} size={52} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography id="drawer-title" variant="h5" component="h2" sx={{ fontWeight: 700 }}>
            {animal.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {animalFacts(animal)} · found in {animal.area}
          </Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="Close">
          <CloseIcon />
        </IconButton>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1, alignItems: "center" }}>
        <Chip
          size="small"
          label={NEUTERED_LABEL[animal.neutered]}
          color={animal.neutered === "yes" ? "mint" : "default"}
          variant={animal.neutered === "unknown" ? "outlined" : "filled"}
        />
        {animal.weightKg === null && <Chip size="small" variant="outlined" label="Not weighed yet" />}
        {canEdit && (
          <Button
            size="small"
            startIcon={<EditOutlined />}
            onClick={() => useAnimalForm.getState().openEdit(animal.id)}
            sx={{ ml: "auto !important" }}
          >
            Edit details
          </Button>
        )}
      </Stack>

      {animal.about && (
        <Typography variant="body2" sx={{ lineHeight: 1.6, whiteSpace: "pre-line" }}>
          {animal.about}
        </Typography>
      )}

      {animal.media.length > 0 && <Gallery media={animal.media} />}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" } }}>
        {canEdit ? (
          <TextField
            select
            id="drawer-stage"
            label="Stage"
            value={animal.stage}
            onChange={(e) => send({ type: "animal.move", animalId: animal.id, toStage: e.target.value as StageId, toIndex: 0 })}
            sx={{ flex: 1 }}
          >
            {STAGES.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.label}
              </MenuItem>
            ))}
          </TextField>
        ) : (
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary" component="p">
              Stage
            </Typography>
            <Typography sx={{ fontWeight: 600 }}>{stageLabel(animal.stage)}</Typography>
          </Box>
        )}
        <Button
          variant={following ? "contained" : "outlined"}
          color={following ? "mint" : "primary"}
          aria-pressed={following}
          onClick={() => send({ type: "animal.follow", animalId: animal.id, follow: !following })}
          sx={{ minHeight: 56, px: 2.5 }}
        >
          {following ? "Following" : "Follow updates"}
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        {animal.followers.length === 0
          ? "Nobody follows this animal yet."
          : `Followed by ${animal.followers.map(name).join(", ")}.`}
        {animal.likes.length > 0 && ` ${animal.likes.length} ${animal.likes.length === 1 ? "like" : "likes"}.`}
      </Typography>

      {/* Offers to adopt or sponsor, for staff to follow up. Members only see their own, on the Animals page. */}
      {canEdit && animal.requests.length > 0 && <OffersAccordion animal={animal} />}

      {canEdit && (
        <Box component="form" noValidate onSubmit={post}>
          <Stack spacing={1}>
            <Controller
              name="text"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  id="drawer-note"
                  label="Post an update"
                  placeholder={`How is ${animal.name} doing? Followers will be notified.`}
                  multiline
                  minRows={3}
                  fullWidth
                  error={!!fieldState.error && length > 0}
                  helperText={length > 0 && fieldState.error ? fieldState.error.message : `${length} / ${NOTE_MAX}`}
                />
              )}
            />
            <Button type="submit" variant="contained" disabled={!formState.isValid} sx={{ alignSelf: "flex-end" }}>
              Post update
            </Button>
          </Stack>
        </Box>
      )}

      <Box>
        <Typography variant="overline" color="text.secondary" component="h3">
          Updates
        </Typography>
        {animal.notes.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No updates yet.
          </Typography>
        ) : (
          <Stack component="ol" spacing={1.5} sx={{ m: 0, p: 0, listStyle: "none" }}>
            {[...animal.notes].reverse().map((n) => (
              <Box component="li" key={n.id} sx={{ pl: 1.5, borderLeft: 2, borderColor: "divider" }}>
                <Typography variant="body2" sx={{ lineHeight: 1.55 }}>
                  {n.text}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {name(n.authorId)} · {timeAgo(n.at, now)}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Box>
    </Stack>
  );
}
