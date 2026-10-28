"use client";

import SearchIcon from "@mui/icons-material/Search";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import InputAdornment from "@mui/material/InputAdornment";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import type { Theme } from "@mui/material/styles";
import type { SystemStyleObject } from "@mui/system";
import { ROLE_LABELS, type Animal } from "@safe-paws/shared/protocol";
import { areaAt, type ShelterLayout, type StaffSpot } from "@safe-paws/shared/shelter";
import NextLink from "next/link";
import { useState } from "react";
import { AnimalAvatar } from "@/components/AnimalAvatar";

/**
 * The read-only plan for members and visitors: where to find each animal when
 * they come to the shelter. Shows only the layouts staff made public, with a
 * search, and a "who's where" list (easier than the plan on a phone).
 * Each animal links to its page.
 */

/** The plan's ground: a soft grid, the same on the editor. */
export const planSurfaceSx = (t: Theme): SystemStyleObject<Theme> => ({
  position: "relative",
  minWidth: 640,
  aspectRatio: "3 / 2",
  borderRadius: 2,
  border: 1,
  borderColor: "divider",
  bgcolor: "background.column",
  backgroundImage:
    "linear-gradient(rgba(29, 36, 34, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(29, 36, 34, 0.05) 1px, transparent 1px)",
  backgroundSize: "24px 24px",
  overflow: "hidden",
  ...t.applyStyles("dark", {
    backgroundImage:
      "linear-gradient(rgba(228, 236, 233, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(228, 236, 233, 0.05) 1px, transparent 1px)",
  }),
});

/** An area's box: pale mint. */
export const areaFillSx = (t: Theme, selected = false): SystemStyleObject<Theme> => ({
  border: 2,
  borderColor: selected ? "primary.main" : "rgba(60, 116, 47, 0.45)",
  borderRadius: 1.5,
  bgcolor: "rgba(182, 220, 173, 0.28)",
  ...t.applyStyles("dark", {
    borderColor: selected ? "primary.main" : "rgba(182, 220, 173, 0.35)",
    bgcolor: "rgba(182, 220, 173, 0.08)",
  }),
});

/** The name tab in an area's top-left corner. */
export const areaTagSx = (selected = false) =>
  ({
    position: "absolute",
    left: 0,
    top: 0,
    maxWidth: "100%",
    display: "flex",
    alignItems: "center",
    gap: 0.75,
    px: 1,
    py: 0.25,
    borderBottomRightRadius: 8,
    borderTopLeftRadius: 6,
    bgcolor: selected ? "primary.main" : "rgba(60, 116, 47, 0.14)",
    color: selected ? "primary.contrastText" : "text.primary",
    fontSize: 13,
    fontWeight: 650,
    whiteSpace: "nowrap",
    overflow: "hidden",
  }) as const;

/** An animal on the plan: photo (or initial) with the name under it. */
export const markerSx = {
  position: "absolute",
  transform: "translate(-50%, -50%)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 0.25,
  width: 84,
  p: 0.5,
  border: 1,
  borderColor: "divider",
  borderRadius: 2,
  bgcolor: "background.paper",
  color: "text.primary",
  font: "inherit",
  textDecoration: "none",
  "&:focus-visible": { outline: 2, outlineColor: "primary.main", outlineOffset: 2 },
} as const;

export const markerNameSx = {
  fontSize: 12,
  fontWeight: 600,
  lineHeight: 1.2,
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

/** Staff on the plan: a round badge (animals have square photos), in plum. */
export function StaffFace({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name
    .replace(/^Dr\.? /, "")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <Avatar aria-hidden sx={{ width: size, height: size, fontSize: size * 0.4, fontWeight: 700, bgcolor: "primary.main", color: "primary.contrastText" }}>
      {initials}
    </Avatar>
  );
}

/** "Dr Karim, Vet": their name and what they do. */
export const staffLine = (s: StaffSpot) => `${s.name}, ${ROLE_LABELS[s.role]}`;

const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label, "en-GB", { numeric: true });

export function ShelterMap({ layouts, animals }: { layouts: ShelterLayout[]; animals: Record<string, Animal> }) {
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const layout = layouts.find((l) => l.id === chosenId) ?? layouts[0];

  if (!layout) {
    return (
      <Box sx={{ px: { xs: 2, sm: 2.5 }, py: 4, maxWidth: 640, mx: "auto" }}>
        <Typography variant="h1" sx={{ mb: 1 }}>
          Visiting the shelter
        </Typography>
        <Typography color="text.secondary">
          The shelter&apos;s layout isn&apos;t up yet. In the meantime you can{" "}
          <Link component={NextLink} href="/animals">
            meet our animals
          </Link>
          .
        </Typography>
      </Box>
    );
  }

  const placed = layout.placements.filter((p) => animals[p.animalId]);
  const q = query.trim().toLowerCase();
  const matches = (a: Animal) => !q || a.name.toLowerCase().includes(q);
  const groups = [...layout.areas].sort(byLabel).map((area) => ({
    key: area.id,
    label: area.label,
    animals: placed.filter((p) => areaAt(layout.areas, p.x, p.y)?.id === area.id).map((p) => animals[p.animalId]),
  }));
  const elsewhere = placed.filter((p) => !areaAt(layout.areas, p.x, p.y)).map((p) => animals[p.animalId]);
  if (elsewhere.length) groups.push({ key: "elsewhere", label: "Elsewhere", animals: elsewhere });
  const shown = groups
    .map((g) => ({ ...g, animals: g.animals.filter(matches).sort((a, b) => a.name.localeCompare(b.name, "en-GB")) }))
    // Empty areas are on the plan; the list is just who's where.
    .filter((g) => g.animals.length > 0);
  const found = shown.reduce((n, g) => n + g.animals.length, 0);
  const onDuty = [...layout.staff].sort((a, b) => a.name.localeCompare(b.name, "en-GB"));

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, py: 2, flex: 1, maxWidth: 1120, width: "100%", mx: "auto" }}>
      <Typography variant="h1" sx={{ mb: 0.5 }}>
        Who&apos;s where
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Coming to visit? Here&apos;s where to find each animal, and who&apos;s on duty to help.
      </Typography>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2, alignItems: { sm: "center" } }}>
        {layouts.length > 1 && (
          <ToggleButtonGroup
            exclusive
            size="small"
            value={layout.id}
            onChange={(_, id: string | null) => id && setChosenId(id)}
            aria-label="Place"
            sx={{ flexWrap: "wrap" }}
          >
            {layouts.map((l) => (
              <ToggleButton key={l.id} value={l.id} sx={{ px: 1.5 }}>
                {l.name}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        )}
        <TextField
          size="small"
          type="search"
          label="Find an animal"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
          sx={{ width: { xs: "100%", sm: 280 } }}
        />
        <Typography variant="body2" color="text.secondary" role="status">
          {q ? (found === 0 ? `No one called "${query.trim()}" here.` : `${found} found`) : ""}
        </Typography>
      </Stack>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 300px" }, gap: 2.5, alignItems: "start" }}>
        {/* The plan. On phones it scrolls sideways; the list below says the same in words. */}
        <Box sx={{ overflowX: "auto", pb: 1, mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 } }}>
          {/* Hidden from screen readers: the list says the same, and links to each animal. */}
          <Box aria-hidden sx={(t) => planSurfaceSx(t)}>
            {[...layout.areas]
              .sort((a, b) => b.w * b.h - a.w * a.h)
              .map((a) => (
                <Box
                  key={a.id}
                  sx={(t) => ({ position: "absolute", left: `${a.x}%`, top: `${a.y}%`, width: `${a.w}%`, height: `${a.h}%`, ...areaFillSx(t) })}
                >
                  <Box sx={areaTagSx()}>
                    <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                      {a.label}
                    </Box>
                  </Box>
                </Box>
              ))}
            {placed.map((p) => {
              const a = animals[p.animalId];
              const hit = q && matches(a);
              return (
                <Box
                  key={p.animalId}
                  component={NextLink}
                  href={`/animals/${a.id}`}
                  tabIndex={-1}
                  sx={{
                    ...markerSx,
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                    zIndex: hit ? 4 : 3,
                    opacity: q && !hit ? 0.3 : 1,
                    borderColor: hit ? "primary.main" : "divider",
                    borderWidth: hit ? 2 : 1,
                    boxShadow: hit ? 6 : 1,
                  }}
                >
                  <AnimalAvatar animal={a} size={32} />
                  <Box component="span" sx={markerNameSx}>
                    {a.name}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>

        <Paper variant="outlined" component="section" aria-label={`Who's in each area of ${layout.name}`} sx={{ p: 2 }}>
          <Box sx={{ mb: 2, pb: 2, borderBottom: 1, borderColor: "divider" }}>
            <Typography component="h2" variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
              Staff here today
            </Typography>
            {onDuty.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No one has checked in yet.
              </Typography>
            ) : (
              <Stack component="ul" spacing={0.75} sx={{ listStyle: "none", m: 0, p: 0 }}>
                {onDuty.map((st) => (
                  <Box component="li" key={st.userId} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <StaffFace name={st.name} size={28} />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {staffLine(st)}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
          {shown.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {placed.length === 0 ? "No animals are on this layout yet." : "No one by that name here."}
            </Typography>
          ) : (
            <Stack spacing={2}>
              {shown.map((g) => (
                <Box key={g.key}>
                  <Typography component="h2" variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    {g.label}
                  </Typography>
                  <Stack component="ul" spacing={0.5} sx={{ listStyle: "none", m: 0, p: 0 }}>
                    {g.animals.map((a) => (
                      <li key={a.id}>
                        <Link
                          component={NextLink}
                          href={`/animals/${a.id}`}
                          underline="hover"
                          sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.primary", fontWeight: 600 }}
                        >
                          <AnimalAvatar animal={a} size={28} />
                          {a.name}
                        </Link>
                      </li>
                    ))}
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
