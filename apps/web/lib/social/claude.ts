import type { Animal } from "@safe-paws/shared/protocol";
import { formatAge, formatWeight } from "@safe-paws/shared/format";
import { stageLabel } from "@safe-paws/shared/protocol";
import { SITE_NAME } from "@/lib/site";
import { SocialError, socialConfig } from "./server";

/** Drafting with Claude, adapted from linkedin-post-studio for the rescue's own posts. */
const SYSTEM = `You write social media posts (LinkedIn and Facebook) for ${SITE_NAME}, a small rescue for street dogs and cats in Alexandria, Egypt.

Output only the post text. No title, no quotes around it, no preamble.

Rules:
- Write as the rescue ("we"). Warm, honest and specific. Sound like real people, not a brand.
- Short paragraphs with line breaks so it reads well on a phone.
- 500 to 1200 characters unless asked otherwise. Never more than 3000.
- Be kind and hopeful. No guilt-tripping, no graphic detail of injuries.
- Use only the facts given. Don't invent details, numbers, names or outcomes.
- End with one gentle call to action when it fits (adopt, sponsor, donate, share). Use the links given exactly; never make up a link.
- At most 3 hashtags, only at the end.
- No emoji unless asked.
- Avoid cliches like "I'm excited to share", "game-changer", "Let's dive in".
- If a photo is attached, write a post that belongs with it. Don't describe the photo as if the reader can't see it.`;

export const TONES = {
  heartfelt: "Heartfelt and warm",
  story: "Tell it as a short story",
  appeal: "An appeal for help (donations, sponsors or a home), hopeful not desperate",
  "good-news": "Good news and thanks",
} as const;
export type Tone = keyof typeof TONES;

function animalFacts(a: Animal, origin: string) {
  const recent = a.notes.slice(-3).map((n) => `- ${n.text}`).join("\n");
  return [
    `Animal: ${a.name}, ${a.species === "dog" ? "dog" : "cat"}, ${a.sex}, ${formatAge(a.age)}${a.age.estimated ? " (estimated)" : ""}${a.weightKg ? `, ${formatWeight(a.weightKg)}` : ""}.`,
    `Found in: ${a.area}. Now: ${stageLabel(a.stage)}. Neutered: ${a.neutered === "unknown" ? "not sure" : a.neutered}.`,
    a.about && `About: ${a.about}`,
    recent && `Recent updates:\n${recent}`,
    `${a.name}'s page: ${origin}/animals/${a.id}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function draftPost(opts: { topic: string; tone: Tone; animal?: Animal; origin: string; photo?: Buffer }) {
  const { apiKey, model } = socialConfig().anthropic;
  if (!apiKey) throw new SocialError("Add ANTHROPIC_API_KEY to the site's environment variables, then try again.", 503);

  const text = [
    `Tone: ${TONES[opts.tone]}`,
    opts.animal && animalFacts(opts.animal, opts.origin),
    `Donate page: ${opts.origin}/donate`,
    `What the post should be about:\n${opts.topic}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const content = [
    ...(opts.photo ? [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: opts.photo.toString("base64") } }] : []),
    { type: "text", text },
  ];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 1200, system: SYSTEM, messages: [{ role: "user", content }] }),
  });
  const json = (await res.json().catch(() => ({}))) as { content?: { type: string; text?: string }[]; error?: { message?: string } };
  if (!res.ok) throw new SocialError(`Claude couldn't write the post: ${json.error?.message ?? res.statusText}`, 502);
  const post = (json.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  if (!post) throw new SocialError("Claude returned an empty post. Try again.", 502);
  return post.slice(0, 3000);
}
