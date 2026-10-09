import { useColorScheme } from "react-native";

/** Same palette as the web app: plum for actions, mint for soft highlights. */
const light = {
  ground: "#f2f7f5",
  card: "#ffffff",
  ink: "#1d2422",
  ink2: "#56635f",
  rule: "#d4e0db",
  sea: "#6d2a5f", // primary: plum
  seaSoft: "#dcf3ea", // soft highlight: mint
  mint: "#1d7059",
  signal: "#6d2a5f",
  dog: "#3f7f6d",
  cat: "#8a4a7c",
  onSea: "#ffffff",
};

const dark: typeof light = {
  ground: "#111816",
  card: "#1a2421",
  ink: "#e4ece9",
  ink2: "#9fb0aa",
  rule: "#2b3833",
  sea: "#e2a8d3",
  seaSoft: "#173a30",
  mint: "#7fdcbd",
  signal: "#e2a8d3",
  dog: "#7cc4ae",
  cat: "#d39ac6",
  onSea: "#2a0f24",
};

export type Theme = typeof light;
export const useTheme = (): Theme => (useColorScheme() === "dark" ? dark : light);
