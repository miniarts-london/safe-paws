"use client";

import MicNoneOutlined from "@mui/icons-material/MicNoneOutlined";
import Stop from "@mui/icons-material/Stop";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { keyframes } from "@mui/material/styles";
import { useEffect, useRef, useState } from "react";
import { visuallyHidden } from "@/lib/visuallyHidden";

/** Long enough for any update, and small enough to stay well under the 4 MB upload limit. */
const MAX_SECONDS = 180;

// Whether the server has speech to text set up, asked once per page load.
let available: Promise<boolean> | null = null;
export const speechAvailable = () =>
  (available ??= fetch("/api/transcribe")
    .then((r) => (r.ok ? r.json() : { available: false }))
    .then((j: { available?: boolean }) => !!j.available)
    .catch(() => false));

/** The first recording format this browser can make: WebM/Opus (Chrome, Firefox, Android) or MP4 (Safari, iPhone). */
export function recordingType() {
  if (typeof MediaRecorder === "undefined") return null;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

const pulse = keyframes`from { opacity: 1 } to { opacity: 0.25 }`;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * Speak an update instead of typing it: records from the microphone, then ElevenLabs
 * turns it into text (via /api/transcribe), which is handed to `onText` to add to the note.
 * Shows nothing unless speech to text is set up and the browser can record.
 */
export function DictateButton({ onText, disabled = false }: { onText: (text: string) => void; disabled?: boolean }) {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<"idle" | "recording" | "working">("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let live = true;
    if (recordingType() !== null && typeof navigator.mediaDevices?.getUserMedia === "function") void speechAvailable().then((ok) => live && setReady(ok));
    return () => {
      live = false;
      // Leaving mid-recording: let go of the microphone without sending anything.
      if (timer.current) clearInterval(timer.current);
      const r = recorder.current;
      if (r && r.state !== "inactive") {
        r.onstop = null;
        r.stop();
        r.stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const send = async (audio: Blob) => {
    setState("working");
    try {
      const ext = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
      const form = new FormData();
      form.set("audio", new File([audio], `update.${ext}`, { type: audio.type || "audio/webm" }));
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const json = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Couldn't turn that into text. Try again, or type the update.");
      if (!json.text) throw new Error("Didn't catch any words. Try again a little closer to the phone.");
      onText(json.text);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setState("idle");
    }
  };

  const start = async () => {
    setError("");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      const denied = (e as Error).name === "NotAllowedError";
      setError(denied ? "Microphone access is blocked. Allow it for this site in your browser settings, then try again." : "Couldn't find a microphone.");
      return;
    }
    const type = recordingType() || undefined;
    const r = new MediaRecorder(stream, { mimeType: type, audioBitsPerSecond: 32000 });
    const chunks: Blob[] = [];
    r.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
    r.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timer.current) clearInterval(timer.current);
      void send(new Blob(chunks, { type: r.mimeType || type }));
    };
    recorder.current = r;
    r.start(1000);
    setSeconds(0);
    setState("recording");
    timer.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS && r.state === "recording") r.stop();
        return s + 1;
      });
    }, 1000);
  };

  const stop = () => recorder.current?.state === "recording" && recorder.current.stop();

  if (!ready) return null;

  return (
    <Box>
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", minHeight: 40 }}>
        {state === "recording" ? (
          <>
            <Button variant="contained" color="error" startIcon={<Stop />} onClick={stop}>
              Stop
            </Button>
            <Box aria-hidden sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "error.main", animation: `${pulse} 0.8s ease-in-out infinite alternate`, "@media (prefers-reduced-motion: reduce)": { animation: "none" } }} />
            <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>
              Listening… {clock(seconds)}
            </Typography>
          </>
        ) : state === "working" ? (
          <>
            <CircularProgress size={20} aria-hidden />
            <Typography variant="body2" color="text.secondary">
              Writing it down…
            </Typography>
          </>
        ) : (
          <Button variant="outlined" startIcon={<MicNoneOutlined />} onClick={start} disabled={disabled}>
            Speak it
          </Button>
        )}
      </Stack>
      {/* Screen readers hear when recording starts and when the text is in. */}
      <Box role="status" sx={visuallyHidden}>
        {state === "recording" ? "Recording. Press Stop when you've finished." : state === "working" ? "Turning your recording into text." : ""}
      </Box>
      {error && (
        <Typography variant="caption" color="error" role="alert" sx={{ display: "block", mt: 0.75 }}>
          {error}
        </Typography>
      )}
    </Box>
  );
}
