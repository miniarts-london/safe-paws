import { loadBoard } from "@safe-paws/db";
import { draftPost, TONES, type Tone } from "@/lib/social/claude";
import { jsonError, photoFrom, requestOrigin, requireCoordinator, SocialError } from "@/lib/social/server";

export const maxDuration = 60;

/** Claude drafts a post from the topic, tone, an animal's details and an optional photo. */
export async function POST(req: Request) {
  try {
    await requireCoordinator(req);
    const form = await req.formData();
    const topic = String(form.get("topic") ?? "").trim().slice(0, 2000);
    const toneRaw = String(form.get("tone") ?? "heartfelt");
    const tone: Tone = toneRaw in TONES ? (toneRaw as Tone) : "heartfelt";
    const animalId = String(form.get("animalId") ?? "");
    if (topic.length < 8 && !animalId) throw new SocialError("Tell Claude a little more about what the post should cover, or pick an animal.");

    const animal = animalId ? (await loadBoard()).board.animals[animalId] : undefined;
    if (animalId && !animal) throw new SocialError("That animal isn't on the board any more.");
    const photo = await photoFrom(form);

    const post = await draftPost({
      topic: topic || `A post about ${animal!.name}.`,
      tone,
      animal,
      origin: requestOrigin(req),
      photo: photo?.bytes,
    });
    return Response.json({ post });
  } catch (err) {
    return jsonError(err);
  }
}
