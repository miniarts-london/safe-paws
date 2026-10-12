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
- about: the other useful details they mentioned (health, behaviour, who reported them, what's needed), as one or two short plain sentences, without repeating the fields above. Null if nothing else.`;

const TOOL = {
  name: "fill_form",
  description: "The form fields taken from the transcript. Use null for anything not said.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: ["string", "null"] },
      species: { type: ["string", "null"], enum: ["dog", "cat", null] },
      sex: { type: ["string", "null"], enum: ["female", "male", null] },
      age: {
        type: ["object", "null"],
        properties: {
          value: { type: "number" },
          unit: { type: "string", enum: ["weeks", "months", "years"] },
          estimated: { type: "boolean" },
        },
        required: ["value", "unit", "estimated"],
      },
      neutered: { type: ["string", "null"], enum: ["yes", "no", "unknown", null] },
      weightKg: { type: ["number", "null"] },
      area: { type: ["string", "null"] },
      about: { type: ["string", "null"] },
    },
    required: ["name", "species", "sex", "age", "neutered", "weightKg", "area", "about"],
  },
} as const;

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

export const fillConfigured = () => !!socialConfig().anthropic.apiKey;

export async function detailsFromSpeech(transcript: string, areas: string[]): Promise<SpokenDetails> {
  const { apiKey, model } = socialConfig().anthropic;
  if (!apiKey) throw new TranscribeError("Filling in the form needs ANTHROPIC_API_KEY.", 503);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      temperature: 0,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [
        {
          role: "user",
          content: `Known areas: ${areas.slice(0, 200).join(", ")}\n\nWhat they said:\n${transcript}`,
        },
      ],
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { content?: { type: string; input?: unknown }[]; error?: { message?: string } };
  if (!res.ok) throw new TranscribeError(`Couldn't fill in the form: ${json.error?.message ?? res.statusText}`, 502);
  const input = json.content?.find((b) => b.type === "tool_use")?.input;
  const parsed = filled.safeParse(input ?? {});
  if (!parsed.success) throw new TranscribeError("Couldn't make sense of that. Try again, or fill in the form.", 502);
  return parsed.data;
}
