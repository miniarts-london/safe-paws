"use client";

import { createTheme } from "@mui/material/styles";

/**
 * Safe Paws theme: plum (#B93B77) for anything you can act on, mint
 * (#B6DCAD) for soft highlights (following, unread, the column a card is over).
 * Mint is pale, so lines and text that must stand out use mint.dark, a deeper
 * green with enough contrast. In dark mode plum is lightened so it stays readable.
 * Light and dark start from the device's setting, and people can switch
 * (ThemeToggle). A small script in the layout applies the right one before
 * the page draws, so there's no flash of the wrong theme.
 */

/** Placeholder colours when an animal has no photo yet, with the colour of the initial on top. */
type Species = { dog: string; onDog: string; cat: string; onCat: string };

declare module "@mui/material/styles" {
  interface TypeBackground {
    column: string;
  }
  interface Palette {
    mint: Palette["primary"];
    species: Species;
  }
  interface PaletteOptions {
    mint?: PaletteOptions["primary"];
    species?: Species;
  }
}

declare module "@mui/material/Chip" {
  interface ChipPropsColorOverrides {
    mint: true;
  }
}
declare module "@mui/material/Button" {
  interface ButtonPropsColorOverrides {
    mint: true;
  }
}

export const theme = createTheme({
  // A class on <html> rather than a media query, so people can switch (see ThemeToggle).
  cssVariables: { colorSchemeSelector: "class" },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#B93B77", light: "#f5e4ec", dark: "#902e5d", contrastText: "#ffffff" },
        mint: { main: "#B6DCAD", light: "#e2f1de", dark: "#3c742f", contrastText: "#193612" },
        secondary: { main: "#B6DCAD", contrastText: "#193612" },
        error: { main: "#b42346" },
        background: { default: "#f2f7f5", paper: "#ffffff", column: "#e6efeb" },
        text: { primary: "#1d2422", secondary: "#56635f" },
        divider: "#d4e0db",
        species: { dog: "#B6DCAD", onDog: "#193612", cat: "#B93B77", onCat: "#ffffff" },
      },
    },
    dark: {
      palette: {
        primary: { main: "#d589ad", light: "#381224", dark: "#ebc8d9", contrastText: "#2a0f1c" },
        mint: { main: "#B6DCAD", light: "#223b1c", dark: "#d7ecd2", contrastText: "#193612" },
        secondary: { main: "#B6DCAD", contrastText: "#193612" },
        error: { main: "#ff8fa8" },
        background: { default: "#111816", paper: "#1a2421", column: "#151e1b" },
        text: { primary: "#e4ece9", secondary: "#9fb0aa" },
        divider: "#2b3833",
        species: { dog: "#B6DCAD", onDog: "#193612", cat: "#B93B77", onCat: "#ffffff" },
      },
    },
  },
  shape: { borderRadius: 10 },
  typography: {
    // The fallback inside var() keeps the stack valid if the font variable is ever missing.
    fontFamily: "var(--font-geist-sans, system-ui), system-ui, -apple-system, 'Segoe UI', sans-serif",
    button: { textTransform: "none", fontWeight: 600 },
    h1: { fontSize: "1.6rem", fontWeight: 700, letterSpacing: "-0.01em" },
    h2: { fontSize: "1.05rem", fontWeight: 650 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiCard: { defaultProps: { variant: "outlined" } },
    MuiChip: { styleOverrides: { root: { fontWeight: 550 } } },
    MuiAppBar: { defaultProps: { elevation: 0, color: "inherit" } },
  },
});
