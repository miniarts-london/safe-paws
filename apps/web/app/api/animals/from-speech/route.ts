import { detailsFromSpeech, fillConfigured } from "@/lib/animalFromSpeech";
import { appCors } from "@/lib/appCors";
import { requireStaff, TranscribeError } from "@/lib/transcribe";

export const maxDuration = 60;

function fail(err: unknown, headers: Record<string, string>) {
  if (err instanceof TranscribeError) return Response.json({ error: err.message }, { status: err.status, headers });
  console.error("from-speech failed", err);
  return Response.json({ error: "Couldn't fill in the form. Try again, or fill it in by hand." }, { status: 500, headers });
}

const METHODS = "GET, POST";
export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: appCors(req, METHODS) });
}

/** Whether Claude is set up to sort spoken details into the form. */
export async function GET(req: Request) {
  const headers = appCors(req, METHODS);
  try {
    await requireStaff(req);
    return Response.json({ available: fillConfigured() }, { headers });
  } catch (err) {
    return fail(err, headers);
  }
}

/** What someone said about a new animal in, the Register form's fields out. Staff only, like registering. */
export async function POST(req: Request) {
  const headers = appCors(req, METHODS);
  try {
    await requireStaff(req);
    const body = (await req.json().catch(() => null)) as { transcript?: unknown; areas?: unknown } | null;
    const transcript = typeof body?.transcript === "string" ? body.transcript.trim().slice(0, 5000) : "";
    if (!transcript) throw new TranscribeError("Nothing to fill in from.");
    const areas = Array.isArray(body?.areas) ? body.areas.filter((a): a is string => typeof a === "string").map((a) => a.slice(0, 60)) : [];
    return Response.json({ details: await detailsFromSpeech(transcript, areas) }, { headers });
  } catch (err) {
    return fail(err, headers);
  }
}
