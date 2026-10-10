"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import ChatBubbleOutline from "@mui/icons-material/ChatBubbleOutlineOutlined";
import CloseIcon from "@mui/icons-material/Close";
import Favorite from "@mui/icons-material/Favorite";
import FavoriteBorder from "@mui/icons-material/FavoriteBorder";
import PhotoLibraryOutlined from "@mui/icons-material/PhotoLibraryOutlined";
import SearchIcon from "@mui/icons-material/Search";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Link from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { animalFacts, NEUTERED_LABEL, photos } from "@safe-paws/shared/format";
import { STAGE_IDS, STAGES, stageLabel, type Animal, type RequestKind, type StageId } from "@safe-paws/shared/protocol";
import { REQUEST_MESSAGE_MAX, requestSchema, type RequestInput } from "@safe-paws/shared/schemas";
import { useBoard } from "@safe-paws/shared/store";
import { timeAgo, useNow } from "@safe-paws/shared/time";
import NextLink from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { MOBILE_QUERY, useMediaQuery } from "@/lib/useMediaQuery";
import { useSend } from "@/lib/useBoardSocket";

type Species = "all" | "dog" | "cat";

/**
 * Every animal in care, with its details, for everyone signed in. Nothing here
 * changes an animal's record: people can follow, like, and offer to adopt or
 * sponsor, and coordinators are told about offers.
 */
export function AnimalDirectory() {
  const board = useBoard((s) => s.board)!;
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<StageId | "all">("all");
  const [species, setSpecies] = useState<Species>("all");
  const { offer, element: offerFlow } = useOfferFlow();
  // By id, so the popup stays live if someone posts an update while it's open.
  const [reading, setReading] = useState<string | null>(null);

  // Board order: by stage, then as arranged within each column.
  const animals = useMemo(() => {
    const q = query.trim().toLowerCase();
    return STAGE_IDS.flatMap((s) => board.columns[s].map((id) => board.animals[id]))
      .filter(Boolean)
      .filter((a) => stage === "all" || a.stage === stage)
      .filter((a) => species === "all" || a.species === species)
      .filter((a) => !q || a.name.toLowerCase().includes(q) || a.area.toLowerCase().includes(q));
  }, [board, query, stage, species]);

  const total = Object.keys(board.animals).length;

  return (
    <Box component="main" sx={{ px: { xs: 2, sm: 2.5 }, py: 2.5, maxWidth: 1280, width: "100%", mx: "auto" }}>
      <Stack spacing={0.5} sx={{ mb: 2 }}>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 700 }}>
          Animals in our care
        </Typography>
        <Typography color="text.secondary">
          Follow an animal to get its news, or offer to adopt or sponsor and a coordinator will get in touch.
        </Typography>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2.5, alignItems: { sm: "center" } }}>
        <TextField
          id="animal-search"
          size="small"
          placeholder="Search by name or area"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          slotProps={{
            htmlInput: { "aria-label": "Search by name or area" },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
          sx={{ flex: 1, maxWidth: { sm: 320 } }}
        />
        <TextField
          select
          id="animal-stage"
          size="small"
          label="Stage"
          value={stage}
          onChange={(e) => setStage(e.target.value as StageId | "all")}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="all">All stages</MenuItem>
          {STAGES.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.label}
            </MenuItem>
          ))}
        </TextField>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={species}
          onChange={(_, v: Species | null) => v && setSpecies(v)}
          aria-label="Species"
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="dog">Dogs</ToggleButton>
          <ToggleButton value="cat">Cats</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }} aria-live="polite">
        {animals.length === total ? `${total} animals` : `${animals.length} of ${total} animals`}
      </Typography>

      {animals.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 6, textAlign: "center" }}>
          {total === 0 ? "No animals on the board yet." : "No animals match those filters."}
        </Typography>
      ) : (
        <Box
          component="ul"
          sx={{
            listStyle: "none",
            m: 0,
            p: 0,
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" },
            // Each card is as tall as its own details, rather than stretched to the tallest in the row.
            alignItems: "start",
          }}
        >
          {animals.map((a) => (
            <Box component="li" key={a.id} sx={{ display: "flex" }}>
              <AnimalProfile animal={a} onOffer={() => offer(a)} onUpdates={() => setReading(a.id)} />
            </Box>
          ))}
        </Box>
      )}

      <UpdatesDialog animal={reading ? board.animals[reading] ?? null : null} onClose={() => setReading(null)} />
      {offerFlow}
    </Box>
  );
}

const OFFERED: Record<RequestKind, string> = { adopt: "You offered to adopt", sponsor: "You offered to sponsor" };

function AnimalProfile({ animal, onOffer, onUpdates }: { animal: Animal; onOffer: () => void; onUpdates: () => void }) {
  const now = useNow();
  const pics = photos(animal);
  const cover = pics.at(-1);
  const latest = animal.notes.at(-1);
  const headingId = `animal-${animal.id}-name`;

  return (
    <Card
      component="article"
      aria-labelledby={headingId}
      sx={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        "&:hover": { borderColor: "primary.main" },
        "&:focus-within": { borderColor: "primary.main" },
      }}
    >
      {/* A photo gets room to be seen; without one, a slim coloured band keeps the details near the top. */}
      <Box
        sx={{
          position: "relative",
          ...(cover ? { aspectRatio: "16 / 10", maxHeight: 200 } : { height: 72 }),
          bgcolor: animal.species === "dog" ? "species.dog" : "species.cat",
        }}
      >
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- private, signed-in media; next/image can't forward the cookie
          <img
            src={cover.url}
            alt={`Photo of ${animal.name}`}
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <Typography
            aria-hidden
            sx={{ height: "100%", display: "grid", placeItems: "center", fontSize: 36, fontWeight: 700, color: animal.species === "dog" ? "species.onDog" : "species.onCat" }}
          >
            {animal.name[0]}
          </Typography>
        )}
        {pics.length > 1 && (
          <Chip
            size="small"
            icon={<PhotoLibraryOutlined />}
            label={`${pics.length} photos`}
            sx={{ position: "absolute", right: 8, bottom: 8, bgcolor: "rgba(0,0,0,0.6)", color: "#fff", "& .MuiChip-icon": { color: "#fff" } }}
          />
        )}
      </Box>

      <Stack spacing={1.25} sx={{ p: 2, flex: 1 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
          <Typography id={headingId} variant="h6" component="h3" sx={{ fontWeight: 700 }}>
            {/* The link stretches over the whole card, so clicking anywhere opens the animal's page.
                Buttons sit above it (position: relative) and keep working. */}
            <Link
              component={NextLink}
              href={`/animals/${animal.id}`}
              color="inherit"
              underline="hover"
              sx={{ "&::after": { content: '""', position: "absolute", inset: 0 } }}
            >
              {animal.name}
            </Link>
          </Typography>
          <Chip size="small" label={stageLabel(animal.stage)} color={animal.stage === "ready" ? "mint" : "default"} />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {animalFacts(animal)} · found in {animal.area}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
          <Chip
            size="small"
            variant={animal.neutered === "unknown" ? "outlined" : "filled"}
            color={animal.neutered === "yes" ? "mint" : "default"}
            label={NEUTERED_LABEL[animal.neutered]}
          />
          {animal.weightKg === null && <Chip size="small" variant="outlined" label="Not weighed yet" />}
        </Stack>
        {animal.about && (
          <Typography variant="body2" sx={{ lineHeight: 1.6, whiteSpace: "pre-line" }}>
            {animal.about}
          </Typography>
        )}
        {latest ? (
          <Button
            variant="text"
            size="small"
            startIcon={<ChatBubbleOutline fontSize="small" />}
            onClick={onUpdates}
            aria-haspopup="dialog"
            sx={{ alignSelf: "flex-start", ml: -0.75, position: "relative", zIndex: 1 }}
          >
            {animal.notes.length === 1 ? "1 update" : `${animal.notes.length} updates`} · latest {timeAgo(latest.at, now)}
          </Button>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No updates yet.
          </Typography>
        )}
      </Stack>

      <Box sx={{ px: 2, pb: 2, position: "relative", zIndex: 1 }}>
        <AnimalActions animal={animal} onOffer={onOffer} />
      </Box>
    </Card>
  );
}

/** Follow, offer to adopt or sponsor, and like: the same on cards and on an animal's page. */
export function AnimalActions({ animal, onOffer }: { animal: Animal; onOffer: () => void }) {
  const me = useBoard((s) => s.me);
  const send = useSend();
  const following = !!me && animal.followers.includes(me);
  const liked = !!me && animal.likes.includes(me);
  const mine = animal.requests.filter((r) => r.userId === me).map((r) => r.kind);
  // Adopting is for animals ready for a home; sponsoring helps any animal still in care.
  const canAdopt = animal.stage === "ready" && !mine.includes("adopt");
  const canSponsor = animal.stage !== "adopted" && !mine.includes("sponsor");
  const offerLabel = canAdopt && canSponsor ? "Adopt or sponsor" : canAdopt ? "Adopt" : "Sponsor";

  return (
    <Stack spacing={1.25}>
      {mine.length > 0 && (
        <Typography variant="body2" sx={{ color: "mint.dark", fontWeight: 600 }}>
          {mine.map((k) => OFFERED[k]).join(" and ")} {animal.name}. A coordinator will be in touch.
        </Typography>
      )}
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
        <Button
          variant={following ? "contained" : "outlined"}
          color={following ? "mint" : "primary"}
          aria-pressed={following}
          onClick={() => send({ type: "animal.follow", animalId: animal.id, follow: !following })}
        >
          {following ? "Following" : "Follow"}
        </Button>
        {(canAdopt || canSponsor) && (
          <Button variant="contained" onClick={onOffer}>
            {offerLabel}
          </Button>
        )}
        {animal.stage === "adopted" && <Chip label="Has a home" color="mint" />}
        <Stack direction="row" sx={{ alignItems: "center", ml: "auto !important" }}>
          <IconButton
            onClick={() => send({ type: "animal.like", animalId: animal.id, like: !liked })}
            aria-pressed={liked}
            aria-label={`Like ${animal.name}`}
            sx={{ color: liked ? "error.main" : "text.secondary" }}
          >
            {liked ? <Favorite /> : <FavoriteBorder />}
          </IconButton>
          <Typography variant="body2" color="text.secondary" aria-label={`${animal.likes.length} likes`} sx={{ minWidth: 16 }}>
            {animal.likes.length}
          </Typography>
        </Stack>
      </Stack>
    </Stack>
  );
}

/** The offer dialog and its thank-you message, for any page that shows AnimalActions. */
export function useOfferFlow() {
  const [asking, setAsking] = useState<Animal | null>(null);
  const [thanks, setThanks] = useState<string | null>(null);
  const element = (
    <>
      <OfferDialog
        animal={asking}
        onClose={() => setAsking(null)}
        onSent={(text) => {
          setAsking(null);
          setThanks(text);
        }}
      />
      <Snackbar
        open={!!thanks}
        autoHideDuration={7000}
        onClose={() => setThanks(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" variant="filled" onClose={() => setThanks(null)}>
          {thanks}
        </Alert>
      </Snackbar>
    </>
  );
  return { offer: setAsking, element };
}

/** Every update on one animal, newest first. */
function UpdatesDialog({ animal, onClose }: { animal: Animal | null; onClose: () => void }) {
  const users = useBoard((s) => s.users);
  const mobile = useMediaQuery(MOBILE_QUERY);
  const now = useNow();
  if (!animal) return null;
  const name = (uid: string) => users.find((u) => u.id === uid)?.name ?? "someone";

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" fullScreen={mobile} aria-labelledby="updates-title">
      <DialogTitle id="updates-title" sx={{ pr: 7 }}>
        Updates on {animal.name}
        <Typography variant="body2" color="text.secondary">
          {stageLabel(animal.stage)} · {animal.notes.length === 1 ? "1 update" : `${animal.notes.length} updates`}
        </Typography>
      </DialogTitle>
      <IconButton onClick={onClose} aria-label="Close" sx={{ position: "absolute", right: 12, top: 12 }}>
        <CloseIcon />
      </IconButton>
      <DialogContent dividers>
        <Stack component="ol" spacing={2.5} sx={{ listStyle: "none", m: 0, p: 0 }}>
          {[...animal.notes].reverse().map((n) => (
            <Box component="li" key={n.id} sx={{ borderLeft: 2, borderColor: "divider", pl: 1.5 }}>
              <Typography sx={{ lineHeight: 1.6, whiteSpace: "pre-line" }}>{n.text}</Typography>
              <Typography variant="caption" color="text.secondary">
                {name(n.authorId)} · {timeAgo(n.at, now)}
              </Typography>
            </Box>
          ))}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

/** Asks how they'd like to help, with an optional message for the coordinators. */
function OfferDialog({ animal, onClose, onSent }: { animal: Animal | null; onClose: () => void; onSent: (thanks: string) => void }) {
  const me = useBoard((s) => s.me);
  const send = useSend();
  const mine = animal?.requests.filter((r) => r.userId === me).map((r) => r.kind) ?? [];
  const canAdopt = animal?.stage === "ready" && !mine.includes("adopt");
  const canSponsor = animal?.stage !== "adopted" && !mine.includes("sponsor");

  const { control, handleSubmit, reset } = useForm<RequestInput>({
    resolver: zodResolver(requestSchema),
    defaultValues: { kind: "sponsor", message: "" },
  });
  const message = useWatch({ control, name: "message" });

  // Fresh form for each animal, starting on whichever option is available.
  useEffect(() => {
    if (animal) reset({ kind: canAdopt ? "adopt" : "sponsor", message: "" });
  }, [animal, canAdopt, reset]);

  if (!animal) return null;
  const pronoun = animal.sex === "female" ? "her" : "him";

  const submit = handleSubmit(({ kind, message }) => {
    if (send({ type: "animal.request", animalId: animal.id, kind, message })) {
      onSent(`Thank you! The coordinators have been told you'd like to ${kind} ${animal.name}. You're now following ${pronoun} too.`);
    }
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="offer-title">
      <Box component="form" noValidate onSubmit={submit}>
        <DialogTitle id="offer-title">Help {animal.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Controller
              name="kind"
              control={control}
              render={({ field }) => (
                <RadioGroup {...field} aria-label="How would you like to help?">
                  <FormControlLabel
                    value="adopt"
                    disabled={!canAdopt}
                    control={<Radio />}
                    label={`Adopt ${animal.name}`}
                  />
                  {!canAdopt && (
                    <FormHelperText sx={{ mt: -1, ml: 4 }}>
                      {mine.includes("adopt")
                        ? "You've already offered."
                        : `${animal.name} isn't ready for adoption yet.`}
                    </FormHelperText>
                  )}
                  <FormControlLabel
                    value="sponsor"
                    disabled={!canSponsor}
                    control={<Radio />}
                    label={`Sponsor ${pronoun} care (vet bills, food, foster)`}
                  />
                  {!canSponsor && mine.includes("sponsor") && (
                    <FormHelperText sx={{ mt: -1, ml: 4 }}>You&apos;ve already offered.</FormHelperText>
                  )}
                </RadioGroup>
              )}
            />
            <Controller
              name="message"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  id="offer-message"
                  label="Message for the coordinators (optional)"
                  placeholder={`Tell them a little about you and how to reach you.`}
                  multiline
                  minRows={3}
                  fullWidth
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message ?? `${message.length} / ${REQUEST_MESSAGE_MAX}`}
                />
              )}
            />
            <Typography variant="body2" color="text.secondary">
              The coordinators will see your name and message, and get in touch. You&apos;ll also start following{" "}
              {animal.name}.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="contained">
            Send to the coordinators
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
