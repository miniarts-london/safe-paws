"use client";

import { createTheme } from "@mui/material/styles";

/**
 * Safe Paws theme: plum for anything you can act on, mint for soft
 * highlights (following, unread, the column a card is over).
 * Light and dark follow the system setting through CSS variables,
 * so there's no flash of the wrong theme on load.
 */

declare module "@mui/material/styles" {
  interface TypeBackground {
    column: string;
  }
  interface Palette {
    mint: Palette["primary"];
    species: { dog: string; cat: string };
  }
  interface PaletteOptions {
    mint?: PaletteOptions["primary"];
    species?: { dog: string; cat: string };
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
        primary: { main: "#6d2a5f", light: "#f3e4ee", dark: "#4f1c44", contrastText: "#ffffff" },
        mint: { main: "#2f9e7d", light: "#dcf3ea", dark: "#1d7059", contrastText: "#0d2b23" },
        secondary: { main: "#2f9e7d", contrastText: "#ffffff" },
        error: { main: "#b42346" },
        background: { default: "#f2f7f5", paper: "#ffffff", column: "#e6efeb" },
        text: { primary: "#1d2422", secondary: "#56635f" },
        divider: "#d4e0db",
        species: { dog: "#3f7f6d", cat: "#8a4a7c" },
      },
    },
    dark: {
      palette: {
        primary: { main: "#e2a8d3", light: "#3b2236", dark: "#f0c8e4", contrastText: "#2a0f24" },
        mint: { main: "#7fdcbd", light: "#173a30", dark: "#a8ecd5", contrastText: "#06231b" },
        secondary: { main: "#7fdcbd", contrastText: "#06231b" },
        error: { main: "#ff8fa8" },
        background: { default: "#111816", paper: "#1a2421", column: "#151e1b" },
        text: { primary: "#e4ece9", secondary: "#9fb0aa" },
        divider: "#2b3833",
        species: { dog: "#7cc4ae", cat: "#d39ac6" },
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
