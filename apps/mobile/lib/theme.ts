import { useColorScheme } from "react-native";

/** Same palette as the web app: plum for actions, mint for soft highlights. */
const light = {
  ground: "#f2f7f5",
  card: "#ffffff",
  ink: "#1d2422",
  ink2: "#56635f",
  rule: "#d4e0db",
  sea: "#B93B77", // primary: plum
  seaSoft: "#B6DCAD", // soft highlight: mint
  mint: "#193612", // text on mint, and mint-coloured text
  signal: "#B93B77",
  // Placeholders before an animal has a photo: mint for dogs, plum for cats.
  dog: "#B6DCAD",
  onDog: "#193612",
  cat: "#B93B77",
  onCat: "#ffffff",
  onSea: "#ffffff",
  // The rescue's name in the header (deep plum, as on the website), and the "live" dot.
  headerInk: "#5c1e3c",
  mintDot: "#3c742f",
};

const dark: typeof light = {
  ground: "#111816",
  card: "#1a2421",
  ink: "#e4ece9",
  ink2: "#9fb0aa",
  rule: "#2b3833",
  sea: "#d589ad", // plum, lightened to stay readable on dark
  seaSoft: "#223b1c",
  mint: "#B6DCAD",
  signal: "#d589ad",
  dog: "#B6DCAD",
  onDog: "#193612",
  cat: "#B93B77",
  onCat: "#ffffff",
  onSea: "#2a0f1c",
  headerInk: "#ebc8d9",
  mintDot: "#B6DCAD",
};

export type Theme = typeof light;
export const useTheme = (): Theme => (useColorScheme() === "dark" ? dark : light);
