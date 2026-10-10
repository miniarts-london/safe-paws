"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import { SITE_CREDIT, SITE_NAME } from "@/lib/site";

/** Header for the public pages (home, and donate for visitors). The home page has its own Donate button. */
/**
 * `overlay`: float over the page (the home page's sky shows through, right to the top).
 * Otherwise it stays at the top as the page scrolls underneath.
 */
export function SiteHeader({ signedIn, overlay = false }: { signedIn: boolean; overlay?: boolean }) {
  // Everything in the bar takes the bar's text colour.
  const onPlum = { color: "inherit", borderColor: "currentColor" } as const;
  return (
    <Box
      component="header"
      // Frosted glass: see-through white with deep plum text by day; see-through deep plum with soft pink text at night.
      sx={(t) => ({
        position: overlay ? "absolute" : "sticky",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        // More see-through over the home page sky; a little more solid where content scrolls underneath.
        bgcolor: overlay ? "rgba(255, 255, 255, 0.55)" : "rgba(255, 255, 255, 0.8)",
        backdropFilter: "blur(12px) saturate(1.3)",
        WebkitBackdropFilter: "blur(12px) saturate(1.3)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.6)",
        color: "#5c1e3c",
        ...t.applyStyles("dark", {
          bgcolor: overlay ? "rgba(56, 18, 36, 0.55)" : "rgba(56, 18, 36, 0.85)",
          borderBottomColor: "rgba(235, 200, 217, 0.12)",
          color: "#ebc8d9",
        }),
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
