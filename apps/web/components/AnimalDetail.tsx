"use client";

import ArrowBack from "@mui/icons-material/ArrowBack";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { formatAge, formatWeight } from "@safe-paws/shared/format";
import { isStaff, stageLabel, STAGES, type Animal, type Media } from "@safe-paws/shared/protocol";
import { useBoard, useMe } from "@safe-paws/shared/store";
import { timeAgo, useNow } from "@safe-paws/shared/time";
import NextLink from "next/link";
import { AnimalActions, useOfferFlow } from "./AnimalDirectory";
import { DetailAccordion, OffersAccordion } from "./OffersAccordion";

/**
 * One animal's page: everything about it, read-only, for everyone signed in.
 * Live like the rest of the app, so a new photo or update appears as it's posted.
 */
export function AnimalDetail({ animalId }: { animalId: string }) {
  const animal = useBoard((s) => s.board?.animals[animalId]);
  const { offer, element: offerFlow } = useOfferFlow();

  return (
    <Box component="main" sx={{ px: { xs: 2, sm: 2.5 }, py: 2.5, maxWidth: 1040, width: "100%", mx: "auto" }}>
      <Button component={NextLink} href="/animals" startIcon={<ArrowBack />} sx={{ mb: 1.5, ml: -1 }}>
        All animals
      </Button>
      {animal ? (
        <Profile animal={animal} onOffer={() => offer(animal)} />
      ) : (
        <Typography color="text.secondary" sx={{ py: 6 }}>
          That animal isn&apos;t on the board any more.
        </Typography>
      )}
      {offerFlow}
    </Box>
  );
}

const NEUTERED_ANSWER: Record<Animal["neutered"], string> = { yes: "Yes", no: "No", unknown: "Not sure" };

function Profile({ animal, onOffer }: { animal: Animal; onOffer: () => void }) {
  const users = useBoard((s) => s.users);
  const me = useMe();
  const now = useNow();
  const name = (uid: string) => users.find((u) => u.id === uid)?.name ?? "someone";
  const stageIndex = STAGES.findIndex((s) => s.id === animal.stage);
  const followers = animal.followers.length;
  const likes = animal.likes.length;

  const facts: [string, string][] = [
    ["Species", animal.species === "dog" ? "Dog" : "Cat"],
    ["Sex", animal.sex === "female" ? "Female" : "Male"],
    ["Age", `${formatAge(animal.age)}${animal.age.estimated ? " (estimate)" : ""}`],
    ["Weight", formatWeight(animal.weightKg) ?? "Not weighed yet"],
    ["Neutered", NEUTERED_ANSWER[animal.neutered]],
    ["Found in", animal.area],
  ];

  return (
    <Stack spacing={3}>
      <Card sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
            <Typography variant="h4" component="h2" sx={{ fontWeight: 700 }}>
              {animal.name}
            </Typography>
            <Chip label={stageLabel(animal.stage)} color={animal.stage === "ready" || animal.stage === "adopted" ? "mint" : "default"} />
          </Stack>

          {/* Where the animal is on its way from street to home. Phones show just the bar; the chip above names the stage. */}
          <Box component="ol" aria-label="Progress" sx={{ display: "flex", gap: 0.5, listStyle: "none", m: 0, p: 0 }}>
            {STAGES.map((s, i) => (
              <Box
                component="li"
                key={s.id}
                aria-current={i === stageIndex ? "step" : undefined}
                sx={{ flex: 1, minWidth: 0 }}
              >
                <Box sx={{ height: 6, borderRadius: 3, bgcolor: i <= stageIndex ? "mint.dark" : "divider" }} />
                <Typography
                  variant="caption"
                  noWrap
                  sx={{ display: { xs: "none", sm: "block" }, mt: 0.5, color: i === stageIndex ? "text.primary" : "text.secondary", fontWeight: i === stageIndex ? 600 : 400 }}
                >
                  {s.label}
                </Typography>
              </Box>
            ))}
          </Box>

          <Box
            component="dl"
            sx={{
              m: 0,
              display: "grid",
              gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))" },
              gap: 2,
            }}
          >
            {facts.map(([label, value]) => (
              <Box key={label}>
                <Typography component="dt" variant="caption" color="text.secondary">
                  {label}
                </Typography>
                <Typography component="dd" sx={{ m: 0, fontWeight: 600 }}>
                  {value}
                </Typography>
              </Box>
            ))}
          </Box>

          {animal.about && <Typography sx={{ lineHeight: 1.7, whiteSpace: "pre-line" }}>{animal.about}</Typography>}

          <Typography variant="body2" color="text.secondary">
            {followers === 0 ? "Nobody follows yet" : followers === 1 ? "1 person follows" : `${followers} people follow`} ·{" "}
            {likes === 1 ? "1 like" : `${likes} likes`} · last changed {timeAgo(animal.updatedAt, now)} by {name(animal.updatedBy)}
          </Typography>

          <AnimalActions animal={animal} onOffer={onOffer} />
        </Stack>
      </Card>

      {animal.media.length > 0 && (
        <Section title={`Photos and videos (${animal.media.length})`}>
          <Gallery media={animal.media} animalName={animal.name} />
        </Section>
      )}

      {/* Offers carry people's own messages; the server only sends everyone's to staff. */}
      {isStaff(me?.role) && animal.requests.length > 0 && <OffersAccordion animal={animal} defaultExpanded size="section" />}

      <DetailAccordion id={`updates-${animal.id}`} title="Updates" count={animal.notes.length} defaultExpanded size="section">
        {animal.notes.length === 0 ? (
          <Typography color="text.secondary">No updates yet.</Typography>
        ) : (
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
        )}
      </DetailAccordion>
    </Stack>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = `section-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <Card component="section" aria-labelledby={id} sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography id={id} variant="h6" component="h3" sx={{ fontWeight: 700, mb: 1.5 }}>
        {title}
      </Typography>
      {children}
    </Card>
  );
}

/** Photos open full size in a new tab; videos play in place. Tiles are at most 200px tall. */
function Gallery({ media, animalName }: { media: Media[]; animalName: string }) {
  return (
    <Box
      component="ul"
      sx={{
        listStyle: "none",
        m: 0,
        p: 0,
        display: "grid",
        gap: 1.5,
        gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))" },
      }}
    >
      {media.map((m, i) => (
        <Box component="li" key={m.id} sx={{ borderRadius: 2, overflow: "hidden", bgcolor: "action.hover" }}>
          {m.kind === "video" ? (
            <video
              src={m.url}
              controls
              playsInline
              preload="metadata"
              aria-label={`Video of ${animalName}: ${m.name}`}
              style={{ width: "100%", height: 200, display: "block", objectFit: "cover", background: "#000" }}
            />
          ) : (
            <a href={m.url} target="_blank" rel="noopener" aria-label={`Photo ${i + 1} of ${animalName}, open full size`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- private, signed-in media; next/image can't forward the cookie */}
              <img
                src={m.url}
                alt=""
                loading="lazy"
                style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }}
              />
            </a>
          )}
        </Box>
      ))}
    </Box>
  );
}
