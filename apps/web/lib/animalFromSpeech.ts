import { z } from "zod";
import { socialConfig } from "@/lib/social/server";
import { TranscribeError } from "@/lib/transcribe";

/**
 * Turning what someone said ("female dog, about a year old, found near Sidi Gaber,
 * not neutered…") into the Register an animal form's fields, with Claude.
 * Only what was actually said is filled in; anything else comes back null and stays
 * blank in the form, which the person checks before saving.
 */
const SYSTEM = `You fill in a rescue's "register an animal" form from what a volunteer said out loud.
The transcript comes from speech recognition, so expect small mistakes, and English, Arabic or a mix.

Rules:
- Use only what the person said. If something wasn't said, return null for it. Never guess.
- species: "dog" or "cat" (a puppy is a dog, a kitten is a cat).
- sex: "female" or "male" ("she", "girl", "bitch", "queen" mean female; "he", "boy", "tom" mean male).
- age: a number and a unit (weeks, months or years). "estimated" is true unless they clearly know it ("about", "maybe", "looks like" = estimated). Puppies and kittens with no age given: null.
- neutered: "yes", "no", or "unknown" only if they said they don't know; null if not mentioned.
- weightKg: kilograms. Convert pounds or grams. Null if not said.
- area: where they were found, as a short place name. If it matches one of the known areas (even misheard or misspelled), use that exact spelling.
- name: the name they gave. Null if none.
- about: the other useful details they mentioned (health, behaviour, who reported them, what's needed), as one or two short plain sentences, without repeating the fields above. Null if nothing else.

Reply with only a JSON object, no other text, with exactly these keys:
{"name": string|null, "species": "dog"|"cat"|null, "sex": "female"|"male"|null,
 "age": {"value": number, "unit": "weeks"|"months"|"years", "estimated": boolean}|null,
 "neutered": "yes"|"no"|"unknown"|null, "weightKg": number|null, "area": string|null, "about": string|null}`;

// What comes back is checked field by field: anything malformed is dropped, not trusted.
const field = <T extends z.ZodType>(t: T) => t.nullable().catch(null);
const filled = z.object({
  name: field(z.string().trim().min(1).max(40)),
  species: field(z.enum(["dog", "cat"])),
  sex: field(z.enum(["female", "male"])),
  age: field(
    z.object({
      value: z.number().positive().max(104),
      unit: z.enum(["weeks", "months", "years"]),
      estimated: z.boolean(),
    }),
  ),
  neutered: field(z.enum(["yes", "no", "unknown"])),
  weightKg: field(z.number().positive().max(120)),
  area: field(z.string().trim().min(1).max(60)),
  about: field(z.string().trim().min(1).max(2000)),
});
export type SpokenDetails = z.infer<typeof filled>;

/** The JSON object in the reply, even if it came wrapped in a code fence or a sentence. */
function firstJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return {};
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return {};
  }
}

export const fillConfigured = () => !!socialConfig().anthropic.apiKey;

export async function detailsFromSpeech(transcript: string, areas: string[]): Promise<SpokenDetails> {
  const { apiKey, model } = socialConfig().anthropic;
  if (!apiKey) throw new TranscribeError("Filling in the form needs ANTHROPIC_API_KEY.", 503);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    // Plain JSON in the reply rather than a forced tool call: some models (those that think
    // first) refuse tool_choice "tool". The answer is checked field by field below either way.
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Known areas: ${areas.slice(0, 200).join(", ")}\n\nWhat they said:\n${transcript}`,
        },
      ],
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { content?: { type: string; text?: string }[]; error?: { message?: string } };
  if (!res.ok) throw new TranscribeError(`Couldn't fill in the form: ${json.error?.message ?? res.statusText}`, 502);
  const text = (json.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n");
  const parsed = filled.safeParse(firstJsonObject(text));
  if (!parsed.success) throw new TranscribeError("Couldn't make sense of that. Try again, or fill in the form.", 502);
  return parsed.data;
}
