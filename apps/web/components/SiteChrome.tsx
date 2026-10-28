"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { SITE_CREDIT, SITE_NAME } from "@/lib/site";

/** Header for the public pages: home, and the Animals, Shelter and Donate pages for visitors. */

/** The visitors' menu. `short` is what phones show, in a row of its own under the name. */
const VISITOR_LINKS = [
  { href: "/animals", label: "Meet our animals", short: "Animals" },
  // Visitors want to know where to find everyone when they come; staff call this page Shelter.
  { href: "/shelter", label: "Visit", short: "Visit" },
  { href: "/donate", label: "Donate", short: "Donate" },
];

function VisitorNav({ phone }: { phone: boolean }) {
  const path = usePathname();
  return (
    <Box
      component="nav"
      aria-label="Pages"
      sx={
        phone
          ? { display: { xs: "flex", sm: "none" }, gap: 0.5, px: 1, pb: 0.75, "& > a": { flex: 1 } }
          : { display: { xs: "none", sm: "flex" }, gap: 0.5, ml: 1 }
      }
    >
      {VISITOR_LINKS.map((l) => {
        const here = path === l.href || path.startsWith(`${l.href}/`);
        return (
          <Button
            key={l.href}
            component={NextLink}
            href={l.href}
            color="inherit"
            size="small"
            aria-current={here ? "page" : undefined}
            sx={{
              minWidth: 0,
              px: 1.25,
              whiteSpace: "nowrap",
              fontWeight: 600,
              // The bar's own text colour, faint: works on the light and the dark bar.
              backgroundColor: here ? "color-mix(in srgb, currentColor 14%, transparent)" : undefined,
            }}
          >
            {phone ? l.short : l.label}
          </Button>
        );
      })}
    </Box>
  );
}

/**
 * `overlay`: float over the page (the home page's sky shows through, right to the top).
 * Otherwise it stays at the top as the page scrolls underneath.
 */
export function SiteHeader({
  signedIn,
  coordinator = false,
  staffShortcuts = false,
  overlay = false,
  menu = true,
}: {
  signedIn: boolean;
  /** The page shows its own big buttons for staff on phones, so the bar's links hide there. */
  staffShortcuts?: boolean;
  /** Coordinators also get a link to the Social post page. */
  coordinator?: boolean;
  overlay?: boolean;
  /** Visitors' menu (Animals, Shelter, Donate). The home page has its own buttons instead. */
  menu?: boolean;
}) {
  const visitorMenu = !signedIn && menu;
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
      <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 0.25, sm: 1 }, px: { xs: 2, sm: 3 }, py: 1.5, maxWidth: 1120, mx: "auto" }}>
        <Typography component="p" noWrap sx={{ fontWeight: 700, fontSize: { xs: 16, sm: 20 }, flex: visitorMenu ? { xs: 1, sm: "0 1 auto" } : 1, minWidth: 0 }}>
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
        {visitorMenu && (
          <>
            <VisitorNav phone={false} />
            <Box sx={{ flex: 1, display: { xs: "none", sm: "block" } }} />
          </>
        )}
        {/* A little tighter on phones, to make room for the links. */}
        <Box sx={{ "& .MuiIconButton-root": { p: { xs: 0.75, sm: 1 } } }}>
          <ThemeToggle color="inherit" />
        </Box>
        {signedIn ? (
          <Box sx={{ display: staffShortcuts ? { xs: "none", sm: "contents" } : "contents" }}>
            {coordinator && (
              <Button component={NextLink} href="/social" color="inherit" sx={{ minWidth: 0, px: { xs: 1, sm: 1.5 }, whiteSpace: "nowrap" }}>
                {/* Shorter on phones, so the site name still fits. */}
                <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                  Social post
                </Box>
                <Box component="span" sx={{ display: { sm: "none" } }}>
                  Social
                </Box>
              </Button>
            )}
            <Button component={NextLink} href="/board" variant="outlined" sx={{ ...onPlum, whiteSpace: "nowrap" }}>
              {coordinator ? (
                <>
                  <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                    Open the board
                  </Box>
                  <Box component="span" sx={{ display: { sm: "none" } }}>
                    Board
                  </Box>
                </>
              ) : (
                "Open the board"
              )}
            </Button>
          </Box>
        ) : (
          <>
            {!menu && (
              // The home page, which has no menu row: Visit sits with Sign in and Join.
              <Button component={NextLink} href="/shelter" color="inherit" sx={{ minWidth: 0, px: { xs: 0.75, sm: 1.5 } }}>
                Visit
              </Button>
            )}
            <Button component={NextLink} href="/login" color="inherit" sx={{ minWidth: 0, px: { xs: 0.75, sm: 1.5 } }}>
              Sign in
            </Button>
            {/* Narrower on phones, so the site name still fits beside Visit and Sign in. */}
            <Button component={NextLink} href="/register" variant="outlined" sx={{ ...onPlum, minWidth: 0, px: { xs: 1.5, sm: 2 } }}>
              Join
            </Button>
          </>
        )}
      </Box>
      {visitorMenu && <VisitorNav phone />}
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
