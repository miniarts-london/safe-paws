"use client";

import ArrowForward from "@mui/icons-material/ArrowForward";
import AddIcon from "@mui/icons-material/Add";
import CampaignOutlined from "@mui/icons-material/CampaignOutlined";
import FavoriteBorder from "@mui/icons-material/FavoriteBorder";
import MapOutlined from "@mui/icons-material/MapOutlined";
import PetsOutlined from "@mui/icons-material/PetsOutlined";
import ViewKanbanOutlined from "@mui/icons-material/ViewKanbanOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import type { Theme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { NatureBackdrop } from "./NatureBackdrop";
import { SiteFooter, SiteHeader } from "./../../SiteChrome";

type Props = { signedIn: boolean; staff?: boolean; coordinator?: boolean };

export function HomePage({ signedIn, staff = false, coordinator = false }: Props) {
  // Staff on a phone get shortcuts to their work instead of the donation message.
  const phoneOnly = { display: { xs: "flex", sm: "none" } } as const;
  const notOnStaffPhones = staff ? ({ display: { xs: "none", sm: "flex" } } as const) : {};
  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column", bgcolor: "background.default", position: "relative" }}>
      {/* Floats over the sky, which runs right up to the top of the page. */}
      <SiteHeader signedIn={signedIn} coordinator={coordinator} staffShortcuts={staff} overlay menu={false} />

      <Box
        component="main"
        sx={{
          flex: 1,
          display: "grid",
          placeItems: "center",
          px: { xs: 2, sm: 3 },
          pt: { xs: 14, sm: 18 }, // room for the floating top bar
          position: "relative",
          overflow: "hidden",
          // Room at the bottom for the dunes and palms.
          pb: { xs: 18, sm: 24 },
        }}
      >
        <NatureBackdrop />
        <Stack spacing={3} sx={{ maxWidth: 760, textAlign: "center", alignItems: "center", position: "relative" }}>
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: "2.5rem", sm: "3.5rem", md: "4.25rem" },
              fontWeight: 300,
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              color: "text.primary",
              textWrap: "balance", // even lines, no word left on its own
            }}
          >
            Helping abandoned Dogs of Egypt.
          </Typography>
          {staff && (
            <Stack component="nav" aria-label="Shortcuts" spacing={1.5} sx={{ ...phoneOnly, width: "100%", pt: 1 }}>
              <Shortcut href="/animals" icon={<PetsOutlined />} label="Animals" />
              <Shortcut href="/board" icon={<ViewKanbanOutlined />} label="Rescue board" />
              <Shortcut href="/shelter" icon={<MapOutlined />} label="Shelter layout" />
              {coordinator && <Shortcut href="/social" icon={<CampaignOutlined />} label="Social media post" />}
              <Shortcut href="/board?register=1" icon={<AddIcon />} label="Register a new animal" primary />
            </Stack>
          )}
          <Stack spacing={1.5} sx={{ maxWidth: 640, ...notOnStaffPhones, flexDirection: "column" }}>
            <Typography sx={{ fontSize: { xs: "1.125rem", sm: "1.3rem" }, lineHeight: 1.6, color: "text.secondary" }}>
              Please consider donating to help our dogs. Your donation goes directly towards food, shelter, medication, vet
              visits and many other essentials.
            </Typography>
            <Typography sx={{ fontSize: { xs: "1.125rem", sm: "1.3rem" }, lineHeight: 1.6, color: "text.secondary" }}>
              Your contribution is greatly appreciated and makes a huge difference to our animals’ lives.
            </Typography>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ width: { xs: "100%", sm: "auto" }, pt: 1, ...notOnStaffPhones }}>
            <Button
              component={NextLink}
              href="/donate"
              variant="contained"
              size="large"
              startIcon={<FavoriteBorder />}
              sx={{ px: 4, py: 1.5, fontSize: "1.05rem" }}
            >
              Donate
            </Button>
            <Button
              component={NextLink}
              href="/animals"
              variant="outlined"
              size="large"
              endIcon={<ArrowForward />}
              sx={(t) => ({ px: 4, py: 1.5, fontSize: "1.05rem", ...frosted(t) })}
            >
              Meet our animals
            </Button>
          </Stack>
          <Typography sx={{ ...notOnStaffPhones, justifyContent: "center", color: "text.secondary" }}>
            Coming to visit?&nbsp;
            <Link component={NextLink} href="/shelter" sx={{ fontWeight: 600 }}>
              See who&apos;s where
            </Link>
          </Typography>
        </Stack>
      </Box>

      <SiteFooter />
    </Box>
  );
}

/** See-through white by day and deep plum at night over the sky, like the top bar. */
const frosted = (t: Theme) => ({
  bgcolor: "rgba(255, 255, 255, 0.55)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  // Only where there's a real pointer: on phones a tap would leave it stuck on.
  "@media (hover: hover)": { "&:hover": { bgcolor: "rgba(255, 255, 255, 0.85)" } },
  ...t.applyStyles("dark", {
    bgcolor: "rgba(56, 18, 36, 0.5)",
    "@media (hover: hover)": { "&:hover": { bgcolor: "rgba(56, 18, 36, 0.8)" } },
  }),
});

/** A big, full-width button for the staff shortcuts on phones. */
function Shortcut({ href, icon, label, primary = false }: { href: string; icon: React.ReactNode; label: string; primary?: boolean }) {
  return (
    <Button
      component={NextLink}
      href={href}
      variant={primary ? "contained" : "outlined"}
      size="large"
      startIcon={icon}
      fullWidth
      sx={(t) => ({ py: 1.75, fontSize: "1.1rem", justifyContent: "flex-start", px: 2.5, ...(!primary && frosted(t)) })}
    >
      {label}
    </Button>
  );
}
