"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import { SITE_CREDIT, SITE_NAME } from "@/lib/site";

/** Header for the public pages (home, and donate for visitors). The home page has its own Donate button. */
export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  // Everything in the bar takes the bar's text colour.
  const onPlum = { color: "inherit", borderColor: "currentColor" } as const;
  return (
    <Box
      component="header"
      // Warm sand with deep plum text by day (like the desert below); by night a deep plum with soft pink text.
      sx={(t) => ({
        bgcolor: "#f3e5c4",
        color: "#5c1e3c",
        ...t.applyStyles("dark", { bgcolor: "#381224", color: "#ebc8d9" }),
      })}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 0.5, sm: 1 }, px: { xs: 2, sm: 3 }, py: 1.5, maxWidth: 1120, mx: "auto" }}>
        <Typography component="p" noWrap sx={{ fontWeight: 700, fontSize: { xs: 17, sm: 20 }, flex: 1, minWidth: 0 }}>
          <Box
            component={NextLink}
            href="/"
            sx={{
              color: "inherit",
              textDecoration: "none",
              borderRadius: 0.5,
              "&:hover": { textDecoration: "underline", textUnderlineOffset: 4 },
              "&:focus-visible": { outline: 2, outlineColor: "currentColor", outlineOffset: 2 },
            }}
          >
            {SITE_NAME}
          </Box>
        </Typography>
        <ThemeToggle color="inherit" />
        {signedIn ? (
          <Button component={NextLink} href="/board" variant="outlined" sx={onPlum}>
            Open the board
          </Button>
        ) : (
          <>
            <Button component={NextLink} href="/login" color="inherit" sx={{ minWidth: 0, px: { xs: 1, sm: 1.5 } }}>
              Sign in
            </Button>
            <Button component={NextLink} href="/register" variant="outlined" sx={onPlum}>
              Join
            </Button>
          </>
        )}
      </Box>
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
