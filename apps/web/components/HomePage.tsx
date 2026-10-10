"use client";

import ArrowForward from "@mui/icons-material/ArrowForward";
import FavoriteBorder from "@mui/icons-material/FavoriteBorder";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { SiteFooter, SiteHeader } from "./SiteChrome";

type Props = { signedIn: boolean };

export function HomePage({ signedIn }: Props) {
  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
      <SiteHeader signedIn={signedIn} />

      <Box
        component="main"
        sx={{
          flex: 1,
          display: "grid",
          placeItems: "center",
          px: { xs: 2, sm: 3 },
          py: { xs: 6, sm: 10 },
          position: "relative",
          overflow: "hidden",
          // A soft mint wash behind the words, in both light and dark.
          backgroundImage: (t) =>
            `radial-gradient(60rem 30rem at 50% 0%, ${t.vars ? t.vars.palette.mint.light : t.palette.mint.light}, transparent 70%)`,
        }}
      >
        <PawTrail />
        <Stack spacing={3} sx={{ maxWidth: 760, textAlign: "center", alignItems: "center", position: "relative" }}>
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: "2.5rem", sm: "3.5rem", md: "4rem" },
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: "-0.02em",
              color: "primary.main", // plum (lighter plum in dark mode)
            }}
          >
            Helping abandoned Dogs of Egypt.
          </Typography>
          <Stack spacing={1.5} sx={{ maxWidth: 640 }}>
            <Typography sx={{ fontSize: { xs: "1.125rem", sm: "1.3rem" }, lineHeight: 1.6, color: "text.secondary" }}>
              Please consider donating to help our dogs. Your donation goes directly towards food, shelter, medication, vet
              visits and many other essentials.
            </Typography>
            <Typography sx={{ fontSize: { xs: "1.125rem", sm: "1.3rem" }, lineHeight: 1.6, color: "text.secondary" }}>
              Your contribution is greatly appreciated and makes a huge difference to our animals’ lives.
            </Typography>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ width: { xs: "100%", sm: "auto" }, pt: 1 }}>
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
              sx={{ px: 4, py: 1.5, fontSize: "1.05rem", bgcolor: "background.paper" }}
            >
              Meet our animals
            </Button>
          </Stack>
        </Stack>
      </Box>

      <SiteFooter />
    </Box>
  );
}

/** A faint trail of paw prints across the background. Decorative only. */
function PawTrail() {
  const prints = [
    { x: 6, y: 78, r: -20 },
    { x: 13, y: 64, r: -10 },
    { x: 20, y: 74, r: -25 },
    { x: 80, y: 22, r: 20 },
    { x: 87, y: 12, r: 30 },
    { x: 92, y: 26, r: 15 },
  ];
  return (
    <Box aria-hidden sx={{ position: "absolute", inset: 0, pointerEvents: "none", color: "primary.main", opacity: 0.08 }}>
      {prints.map((p, i) => (
        <Box
          key={i}
          component="svg"
          viewBox="0 0 24 24"
          sx={{
            position: "absolute",
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: { xs: 36, sm: 56 },
            transform: `rotate(${p.r}deg)`,
            display: { xs: i % 2 ? "none" : "block", sm: "block" },
          }}
        >
          <g fill="currentColor">
            <ellipse cx="12" cy="16" rx="5" ry="4.2" />
            <ellipse cx="5.5" cy="10" rx="2.2" ry="2.8" />
            <ellipse cx="9.5" cy="5.5" rx="2.2" ry="2.8" />
            <ellipse cx="14.5" cy="5.5" rx="2.2" ry="2.8" />
            <ellipse cx="18.5" cy="10" rx="2.2" ry="2.8" />
          </g>
        </Box>
      ))}
    </Box>
  );
}
