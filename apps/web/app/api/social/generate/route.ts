import { loadBoard } from "@safe-paws/db";
import { draftPost, latestUpdates, TONES, type Tone } from "@/lib/social/claude";
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
    if (topic.length < 8 && !animalId && tone !== "updates") {
      throw new SocialError("Tell Claude a little more about what the post should cover, or pick an animal.");
    }

    const { board } = await loadBoard();
    const animal = animalId ? board.animals[animalId] : undefined;
    if (animalId && !animal) throw new SocialError("That animal isn't on the board any more.");
    // Updates: an animal's own recent updates are in its details; with no animal, the rescue's latest.
    const updates = tone === "updates" && !animal ? latestUpdates(Object.values(board.animals), requestOrigin(req)) : undefined;
    if (tone === "updates" && (animal ? animal.notes.length === 0 : !updates)) {
      throw new SocialError(animal ? `${animal.name} has no updates yet.` : "There are no updates yet.");
    }
    const photo = await photoFrom(form);

    const post = await draftPost({
      topic: topic || (animal ? `A post about ${animal.name}.` : ""),
      tone,
      animal,
      updates,
      origin: requestOrigin(req),
      photo: photo?.bytes,
    });
    return Response.json({ post });
  } catch (err) {
    return jsonError(err);
  }
}
