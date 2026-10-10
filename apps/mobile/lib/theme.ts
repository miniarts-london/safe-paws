import { useColorScheme } from "react-native";

/** Same palette as the web app: plum for actions, mint for soft highlights. */
const light = {
  ground: "#f2f7f5",
  card: "#ffffff",
  ink: "#1d2422",
  ink2: "#56635f",
  rule: "#d4e0db",
  sea: "#B93B8F", // primary: plum
  seaSoft: "#ADEBB3", // soft highlight: mint
  mint: "#1f5e2a", // text on mint, and mint-coloured text
  signal: "#B93B8F",
  // Placeholders before an animal has a photo: mint for dogs, plum for cats.
  dog: "#ADEBB3",
  onDog: "#12391c",
  cat: "#B93B8F",
  onCat: "#ffffff",
  onSea: "#ffffff",
};

const dark: typeof light = {
  ground: "#111816",
  card: "#1a2421",
  ink: "#e4ece9",
  ink2: "#9fb0aa",
  rule: "#2b3833",
  sea: "#d589bc", // plum, lightened to stay readable on dark
  seaSoft: "#1d3a22",
  mint: "#ADEBB3",
  signal: "#d589bc",
  dog: "#ADEBB3",
  onDog: "#12391c",
  cat: "#B93B8F",
  onCat: "#ffffff",
  onSea: "#2a0f24",
};

export type Theme = typeof light;
export const useTheme = (): Theme => (useColorScheme() === "dark" ? dark : light);
