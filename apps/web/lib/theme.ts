"use client";

import { createTheme } from "@mui/material/styles";

/**
 * Safe Paws theme: plum (#B93B8F) for anything you can act on, mint
 * (#ADEBB3) for soft highlights (following, unread, the column a card is over).
 * Mint is pale, so lines and text that must stand out use mint.dark, a deeper
 * green with enough contrast. In dark mode plum is lightened so it stays readable.
 * Light and dark follow the system setting through CSS variables,
 * so there's no flash of the wrong theme on load.
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
  cssVariables: { colorSchemeSelector: "media" },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#B93B8F", light: "#f7e4f0", dark: "#8f2c6e", contrastText: "#ffffff" },
        mint: { main: "#ADEBB3", light: "#e4f8e6", dark: "#2e7d3a", contrastText: "#12391c" },
        secondary: { main: "#ADEBB3", contrastText: "#12391c" },
        error: { main: "#b42346" },
        background: { default: "#f2f7f5", paper: "#ffffff", column: "#e6efeb" },
        text: { primary: "#1d2422", secondary: "#56635f" },
        divider: "#d4e0db",
        species: { dog: "#ADEBB3", onDog: "#12391c", cat: "#B93B8F", onCat: "#ffffff" },
      },
    },
    dark: {
      palette: {
        primary: { main: "#d589bc", light: "#3d1a33", dark: "#f0c4e1", contrastText: "#2a0f24" },
        mint: { main: "#ADEBB3", light: "#1d3a22", dark: "#d3f5d6", contrastText: "#12391c" },
        secondary: { main: "#ADEBB3", contrastText: "#12391c" },
        error: { main: "#ff8fa8" },
        background: { default: "#111816", paper: "#1a2421", column: "#151e1b" },
        text: { primary: "#e4ece9", secondary: "#9fb0aa" },
        divider: "#2b3833",
        species: { dog: "#ADEBB3", onDog: "#12391c", cat: "#B93B8F", onCat: "#ffffff" },
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
