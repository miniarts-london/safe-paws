"use client";

import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlined from "@mui/icons-material/LightModeOutlined";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { useColorScheme } from "@mui/material/styles";

/**
 * Light / dark switch. Starts from the device's setting; once someone picks,
 * their choice is remembered on this device (MUI keeps it in localStorage).
 */
export function ThemeToggle({ color = "text.secondary" }: { color?: string }) {
  const { mode, systemMode, setMode } = useColorScheme();
  const current = mode === "system" ? systemMode : mode;
  // Unknown until the browser says (not during server rendering): keep the space so nothing jumps.
  if (!current) return <IconButton aria-hidden tabIndex={-1} sx={{ visibility: "hidden" }}><DarkModeOutlined /></IconButton>;
  const next = current === "dark" ? "light" : "dark";
  const label = `Switch to ${next} mode`;
  return (
    <Tooltip title={label}>
      <IconButton aria-label={label} onClick={() => setMode(next)} sx={{ color }}>
        {current === "dark" ? <LightModeOutlined /> : <DarkModeOutlined />}
      </IconButton>
    </Tooltip>
  );
}
