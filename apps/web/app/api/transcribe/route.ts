import { MAX_AUDIO_BYTES, requireStaff, transcribe, transcribeConfigured, TranscribeError } from "@/lib/transcribe";

export const maxDuration = 60;

function fail(err: unknown) {
  if (err instanceof TranscribeError) return Response.json({ error: err.message }, { status: err.status });
  console.error("transcribe failed", err);
  return Response.json({ error: "Couldn't turn that into text. Try again, or type the update." }, { status: 500 });
}

/** Whether dictation is set up, so the form only shows the microphone when it will work. */
export async function GET(req: Request) {
  try {
    await requireStaff(req);
    return Response.json({ available: transcribeConfigured() });
  } catch (err) {
    return fail(err);
  }
}

/** A recorded update in, its text out. */
export async function POST(req: Request) {
  try {
    await requireStaff(req);
    const audio = (await req.formData()).get("audio");
    if (!(audio instanceof File) || audio.size === 0) throw new TranscribeError("No recording arrived. Try again.");
    if (audio.size > MAX_AUDIO_BYTES) throw new TranscribeError("That recording is too long. Keep it to a few minutes.");
    // MediaRecorder gives audio/webm (Chrome, Firefox) or audio/mp4 (Safari); some browsers label it video/webm.
    if (!/^(audio|video)\//.test(audio.type)) throw new TranscribeError("That isn't a recording.");
    return Response.json({ text: await transcribe(audio) });
  } catch (err) {
    return fail(err);
  }
}
