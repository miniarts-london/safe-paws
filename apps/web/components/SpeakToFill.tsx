"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import type { SpokenDetails } from "@/lib/animalFromSpeech";
import { DictateButton, recordingType, speechAvailable } from "./DictateButton";

// Whether Claude is set up to sort what was said into the fields, asked once per page load.
let fillAvailable: Promise<boolean> | null = null;
const canFill = () =>
  (fillAvailable ??= fetch("/api/animals/from-speech")
    .then((r) => (r.ok ? r.json() : { available: false }))
    .then((j: { available?: boolean }) => !!j.available)
    .catch(() => false));

/**
 * "Say it instead of typing": ElevenLabs writes down what was said, then Claude sorts it
 * into the Register form's fields. Only what was said is filled in; the person checks it
 * all before registering. Without Claude, what was said goes into Notes instead.
 * Shows nothing unless speech to text is set up and the browser can record.
 */
export function SpeakToFill({
  areas,
  onFill,
  onNotes,
}: {
  areas: string[];
  onFill: (details: SpokenDetails) => void;
  /** No Claude: the transcript is added to Notes as it is. */
  onNotes: (text: string) => void;
}) {
  const [show, setShow] = useState(false);
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<{ kind: "success" | "info" | "error"; text: string; said?: string } | null>(null);

  useEffect(() => {
    let live = true;
    if (recordingType() !== null) void speechAvailable().then((ok) => live && setShow(ok));
    return () => {
      live = false;
    };
  }, []);

  const fillFrom = async (said: string) => {
    setResult(null);
    if (!(await canFill())) {
      onNotes(said);
      setResult({ kind: "info", text: "Added what you said to Notes. Fill in the other fields." });
      return;
    }
    setWorking(true);
    try {
      const res = await fetch("/api/animals/from-speech", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transcript: said, areas }),
      });
      const json = (await res.json().catch(() => ({}))) as { details?: SpokenDetails; error?: string };
      if (!res.ok || !json.details) throw new Error(json.error ?? "Couldn't fill in the form. Try again, or fill it in by hand.");
      const got = Object.values(json.details).filter((v) => v !== null).length;
      onFill(json.details);
      setResult(
        got === 0
          ? { kind: "info", text: "Couldn't find any details in that. Try again, saying the name, dog or cat, age and where they were found.", said }
          : { kind: "success", text: "Filled in from what you said. Check everything before registering.", said },
      );
    } catch (e) {
      setResult({ kind: "error", text: (e as Error).message, said });
    } finally {
      setWorking(false);
    }
  };

  if (!show) return null;

  return (
    <Box sx={{ p: 2, borderRadius: 1, bgcolor: "action.hover" }}>
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.25 }}>
        Rather say it?
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Tell me their name, dog or cat, girl or boy, roughly how old, where they were found, whether they&apos;re neutered and anything else, and
        I&apos;ll fill in the form.
      </Typography>
      {working ? (
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", minHeight: 40 }} role="status">
          <CircularProgress size={20} aria-hidden />
          <Typography variant="body2" color="text.secondary">
            Filling in the form…
          </Typography>
        </Stack>
      ) : (
        <DictateButton onText={fillFrom} />
      )}
      {result && (
        <Alert severity={result.kind} onClose={() => setResult(null)} sx={{ mt: 1.5 }}>
          {result.text}
          {result.said && (
            <Typography component="span" variant="body2" sx={{ display: "block", mt: 0.5, color: "text.secondary" }}>
              You said: “{result.said}”
            </Typography>
          )}
        </Alert>
      )}
    </Box>
  );
}
