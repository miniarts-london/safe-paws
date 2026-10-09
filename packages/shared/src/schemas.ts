import { z } from "zod";

/**
 * Form rules, shared by the browser (React Hook Form) and the servers
 * (login action, token endpoint, board server), so every side checks
 * exactly the same things.
 */
export const loginSchema = z.object({
  email: z.string().trim().min(1, "Enter your email.").pipe(z.email("That doesn't look like an email address.")),
  password: z.string().min(1, "Enter your password."),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const PASSWORD_MIN = 10;
export const TITLE_MAX = 60;

const title = z.string().trim().max(TITLE_MAX, `Keep this under ${TITLE_MAX} characters.`);

/** The sign-up form. Everyone joins as a member (view only) until a coordinator makes them staff. */
export const registerSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(60, "Keep your name under 60 characters."),
  email: z.string().trim().min(1, "Enter your email.").pipe(z.email("That doesn't look like an email address.")),
  password: z
    .string()
    .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
    .max(200, "That password is too long."),
  /** Optional: how they'd like to help, shown under their name and to the coordinator who reviews them. */
  title,
});
export type RegisterInput = z.infer<typeof registerSchema>;

/** A coordinator making a member staff. */
export const approveSchema = z.object({
  userId: z.string().min(1).max(64),
  role: z.enum(["coordinator", "vet", "fosterer", "sponsor"], { error: "Choose a role." }),
  title: title.min(1, "Say what they do, e.g. \"Foster carer, Smouha\"."),
});
export type ApproveInput = z.infer<typeof approveSchema>;

export const NOTE_MAX = 1000;
export const noteSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Write something before posting.")
    .max(NOTE_MAX, `Keep it under ${NOTE_MAX} characters.`),
});
export type NoteInput = z.infer<typeof noteSchema>;

/* ---------- animal register / edit ---------- */

export const MEDIA_MAX = 12;
export const ABOUT_MAX = 2000;

const AGE_LIMIT = { weeks: 104, months: 48, years: 30 } as const;

export const animalDetailsSchema = z
  .object({
    name: z.string().trim().min(1, "Give them a name.").max(40, "Keep the name under 40 characters."),
    species: z.enum(["dog", "cat"], { error: "Choose dog or cat." }),
    sex: z.enum(["female", "male"], { error: "Choose female or male." }),
    age: z.object({
      value: z
        .number({ error: "Enter their age." })
        .positive("Age must be more than 0.")
        .max(104, "That age looks too high."),
      unit: z.enum(["weeks", "months", "years"]),
      estimated: z.boolean(),
    }),
    neutered: z.enum(["yes", "no", "unknown"]),
    weightKg: z
      .number({ error: "Enter a weight in kilograms, or leave it blank." })
      .positive("Weight must be more than 0.")
      .max(120, "That weight looks too high for a cat or dog.")
      .nullable(),
    area: z.string().trim().min(1, "Say where they were found.").max(60, "Keep this under 60 characters."),
    about: z.string().trim().max(ABOUT_MAX, `Keep this under ${ABOUT_MAX} characters.`),
    media: z
      .array(
        z.object({
          id: z.string().regex(/^[a-z0-9-]{8,64}$/, "Unknown upload."),
          kind: z.enum(["photo", "video"]),
          name: z.string().max(200),
        }),
      )
      .max(MEDIA_MAX, `Up to ${MEDIA_MAX} photos and videos.`),
  })
  .refine((d) => d.age.value <= AGE_LIMIT[d.age.unit], { path: ["age", "value"], message: "That age looks too high." });

export type AnimalDetailsForm = z.infer<typeof animalDetailsSchema>;

/* ---------- uploads ---------- */

/** Allowlist: no SVG (it can carry script) and nothing the browser would execute. */
export const UPLOAD_TYPES: Record<string, "photo" | "video"> = {
  "image/jpeg": "photo",
  "image/png": "photo",
  "image/webp": "photo",
  "image/heic": "photo",
  "image/heif": "photo",
  "video/mp4": "video",
  "video/quicktime": "video",
  "video/webm": "video",
};
export const UPLOAD_MAX_BYTES = { photo: 15 * 1024 * 1024, video: 100 * 1024 * 1024 };
