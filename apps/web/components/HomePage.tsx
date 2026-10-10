"use client";

import ArrowForward from "@mui/icons-material/ArrowForward";
import FavoriteBorder from "@mui/icons-material/FavoriteBorder";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { NatureBackdrop } from "./NatureBackdrop";
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
