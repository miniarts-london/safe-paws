import { getUser } from "@safe-paws/db";
import { isStaff } from "@safe-paws/shared/protocol";
import { sessionFrom } from "@/lib/media";

/**
 * Speech to text for update notes, with ElevenLabs Scribe.
 * The key stays on the server: the browser sends its recording here and gets text back.
 * Turned on by ELEVENLABS_API_KEY; without it the microphone button doesn't show.
 */
export const transcribeConfigured = () => !!process.env.ELEVENLABS_API_KEY;

/** Recordings come through this server, so they must fit Vercel's 4.5 MB request limit (minutes of speech). */
export const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

export class TranscribeError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/** Only staff write updates, so only staff can dictate them. */
export async function requireStaff(req: Request) {
  const session = sessionFrom(req);
  if (!session) throw new TranscribeError("Sign in first.", 401);
  const user = await getUser(session.uid);
  if (!isStaff(user?.role)) throw new TranscribeError("Only staff can post updates.", 403);
}

export async function transcribe(audio: File): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new TranscribeError("Speech to text isn't set up. Add ELEVENLABS_API_KEY to the site's environment variables.", 503);
  const model = process.env.ELEVENLABS_STT_MODEL || "scribe_v2";

  const form = new FormData();
  form.set("model_id", model);
  form.set("file", audio, audio.name || "note.webm");
  form.set("tag_audio_events", "false"); // no "(dog barking)" in the note
  form.set("timestamps_granularity", "none"); // just the text
  if (model.startsWith("scribe_v2")) form.set("no_verbatim", "true"); // drops "um", "er" and false starts
  // No language: Scribe detects it, so English, Arabic or a mix all work.

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
  });
  const json = (await res.json().catch(() => ({}))) as { text?: string; detail?: { message?: string } | string };
  if (!res.ok) {
    const detail = typeof json.detail === "string" ? json.detail : json.detail?.message;
    // ElevenLabs says why (e.g. a deleted key, or one without the Speech to Text permission): pass that on.
    if (res.status === 401 || res.status === 403) {
      throw new TranscribeError(`ElevenLabs refused the key${detail ? `: ${detail}` : "."} Check ELEVENLABS_API_KEY, then restart the site.`, 502);
    }
    if (res.status === 429) throw new TranscribeError("ElevenLabs is busy or the plan's limit is reached. Try again later, or type the update.", 502);
    throw new TranscribeError(`Couldn't turn that into text${detail ? `: ${detail}` : "."}`, 502);
  }
  return (json.text ?? "").trim();
}
