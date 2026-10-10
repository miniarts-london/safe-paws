"use client";

import ContentCopy from "@mui/icons-material/ContentCopy";
import MailOutline from "@mui/icons-material/MailOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { animalFacts } from "@safe-paws/shared/format";
import { stageLabel, type Animal, type AnimalRequest } from "@safe-paws/shared/protocol";
import { useBoard } from "@safe-paws/shared/store";
import { timeAgo, useNow } from "@safe-paws/shared/time";
import NextLink from "next/link";
import { useState } from "react";
import { AnimalAvatar } from "./AnimalCard";

/**
 * What a coordinator sees after clicking an "would like to adopt / sponsor"
 * notification: who offered, how to reach them, and a short summary of the
 * animal. The full profile is one link away.
 */
export function OfferContactDialog() {
  const offer = useBoard((s) => s.openOffer);
  const animal = useBoard((s) => (offer ? s.board?.animals[offer.animalId] : undefined));
  const person = useBoard((s) => (offer ? s.users.find((u) => u.id === offer.userId) : undefined));
  const fullScreen = useMediaQuery((t) => t.breakpoints.down("sm"));
  const close = () => useBoard.getState().showOffer(null);

  const requests = animal && offer ? animal.requests.filter((r) => r.userId === offer.userId) : [];
  const name = person?.name ?? "Someone";
  const email = requests.find((r) => r.email)?.email;
  const wants = [...new Set(requests.map((r) => r.kind))].join(" and ");

  return (
    <Dialog open={!!offer} onClose={close} fullScreen={fullScreen} maxWidth="xs" fullWidth aria-labelledby="offer-contact-title">
      <DialogTitle id="offer-contact-title" sx={{ pb: 1 }}>
        {animal && requests.length > 0 ? `${name} would like to ${wants} ${animal.name}` : "Offer to help"}
      </DialogTitle>

      <DialogContent>
        {!animal || requests.length === 0 ? (
          <Typography color="text.secondary">This offer isn&apos;t on the board any more.</Typography>
        ) : (
          <Stack spacing={2.5}>
            <Contact name={name} title={person?.title} email={email} animalName={animal.name} />
            <Messages requests={requests} />
            <AnimalSummary animal={animal} onOpen={close} />
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={close} color="inherit">
          Close
        </Button>
        {email && animal && (
          <Button variant="contained" startIcon={<MailOutline />} href={mailto(email, animal.name)}>
            Email {name}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

const mailto = (email: string, animalName: string) =>
  `mailto:${email}?subject=${encodeURIComponent(`About ${animalName}`)}`;

const Label = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <Typography id={id} component="h3" variant="overline" color="text.secondary" sx={{ lineHeight: 1.5, display: "block" }}>
    {children}
  </Typography>
);

function Contact({ name, title, email, animalName }: { name: string; title?: string; email?: string; animalName: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!email) return;
    await navigator.clipboard.writeText(email).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box component="section" aria-labelledby="offer-contact-who">
      <Label id="offer-contact-who">Contact</Label>
      <Typography sx={{ fontWeight: 600 }}>{name}</Typography>
      {title && (
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
      )}
      {email ? (
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", mt: 0.5 }}>
          <Link href={mailto(email, animalName)} sx={{ wordBreak: "break-all" }}>
            {email}
          </Link>
          <Tooltip title={copied ? "Copied" : "Copy email"}>
            <IconButton size="small" onClick={copy} aria-label={copied ? "Email copied" : "Copy email"}>
              <ContentCopy fontSize="inherit" />
            </IconButton>
          </Tooltip>
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Their email isn&apos;t available.
        </Typography>
      )}
    </Box>
  );
}

function Messages({ requests }: { requests: AnimalRequest[] }) {
  const now = useNow();
  return (
    <Box component="section" aria-labelledby="offer-contact-message">
      <Label id="offer-contact-message">{requests.length > 1 ? "Their messages" : "Their message"}</Label>
      <Stack spacing={1.5}>
        {requests.map((r) => (
          <Box key={r.kind} sx={{ pl: 1.5, borderLeft: 2, borderColor: "mint.dark" }}>
            <Typography variant="body2" sx={{ lineHeight: 1.6, whiteSpace: "pre-line" }}>
              {r.message || <Box component="span" sx={{ color: "text.secondary" }}>No message.</Box>}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {r.kind === "adopt" ? "Adopt" : "Sponsor"} · {timeAgo(r.at, now)}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

function AnimalSummary({ animal, onOpen }: { animal: Animal; onOpen: () => void }) {
  return (
    <Box component="section" aria-labelledby="offer-contact-animal">
      <Label id="offer-contact-animal">Animal</Label>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: "center", p: 1.5, border: 1, borderColor: "divider", borderRadius: 1 }}
      >
        <AnimalAvatar animal={animal} size={64} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}>
            <Typography sx={{ fontWeight: 700 }}>{animal.name}</Typography>
            <Chip size="small" label={stageLabel(animal.stage)} color={animal.stage === "ready" ? "mint" : "default"} />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {animalFacts(animal)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Found in {animal.area}
          </Typography>
        </Box>
      </Stack>
      <Link component={NextLink} href={`/animals/${animal.id}`} onClick={onOpen} variant="body2" sx={{ display: "inline-block", mt: 1 }}>
        See all of {animal.name}&apos;s details
      </Link>
    </Box>
  );
}
