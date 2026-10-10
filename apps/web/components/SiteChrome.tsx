"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { SITE_CREDIT, SITE_NAME } from "@/lib/site";

/** Header for the public pages (home, donate). */
export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <Box
      component="header"
      sx={{ display: "flex", alignItems: "center", gap: 1, px: { xs: 2, sm: 3 }, py: 2, maxWidth: 1120, width: "100%", mx: "auto" }}
    >
      <Typography component="p" sx={{ fontWeight: 700, fontSize: 20, flex: 1 }}>
        <Box
          component={NextLink}
          href="/"
          sx={{
            color: "inherit",
            textDecoration: "none",
            borderRadius: 0.5,
            "&:hover": { color: "primary.main" },
            "&:focus-visible": { outline: 2, outlineColor: "primary.main", outlineOffset: 2 },
          }}
        >
          {SITE_NAME}
        </Box>
      </Typography>
      {signedIn ? (
        <Button component={NextLink} href="/board" variant="outlined">
          Open the board
        </Button>
      ) : (
        <>
          <Button component={NextLink} href="/login" color="inherit">
            Sign in
          </Button>
          <Button component={NextLink} href="/register" variant="outlined">
            Join
          </Button>
        </>
      )}
    </Box>
  );
}

export function SiteFooter() {
  return (
    <Box component="footer" sx={{ textAlign: "center", py: 3, px: 2, color: "text.secondary" }}>
      <Typography variant="body2">{SITE_CREDIT}</Typography>
    </Box>
  );
}
