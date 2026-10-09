import type { Age, AgeUnit, Animal, Board, Columns, StageId, User } from "./protocol";

/** Sample people. Replace with the rescue's real roles once you've spoken to them. */
export const seedUsers: User[] = [
  { id: "mona", name: "Mona", role: "coordinator", title: "Founder and coordinator" },
  { id: "karim", name: "Dr Karim", role: "vet", title: "Volunteer vet, Smouha" },
  { id: "sara", name: "Sara", role: "fosterer", title: "Foster carer, Sporting" },
  { id: "kaori", name: "Kaori", role: "sponsor", title: "Sponsor, London" },
];

/** Demo sign-ins shown on the web and app login screens. Password hashes live only on the server. */
export const DEMO_PASSWORD = "rescue-demo";
export const demoLogins = [
  { userId: "mona", email: "mona@rescue.example" },
  { userId: "karim", email: "karim@rescue.example" },
  { userId: "sara", email: "sara@rescue.example" },
  { userId: "kaori", email: "kaori@rescue.example" },
];

const HOUR = 3_600_000;

type Seed = Omit<Animal, "updatedAt" | "notes" | "media"> & { hoursAgo: number; notes?: [string, string, number][] };

const est = (value: number, unit: AgeUnit): Age => ({ value, unit, estimated: true });

const seeds: Seed[] = [
  { id: "simsim", name: "Simsim", species: "cat", sex: "male", age: est(8, "weeks"), neutered: "no", weightKg: 0.9, area: "Smouha",
    about: "Tiny and very friendly. Eye infection in his left eye.", stage: "reported", followers: [], updatedBy: "mona", hoursAgo: 1,
    notes: [["mona", "Reported by a shop owner near the tram stop. Thin, eye infection, very friendly.", 1]] },
  { id: "sultan", name: "Sultan", species: "dog", sex: "male", age: est(3, "years"), neutered: "unknown", weightKg: null, area: "Miami",
    about: "Large, shy around people but not aggressive. Limping.", stage: "reported", followers: [], updatedBy: "mona", hoursAgo: 5,
    notes: [["mona", "Limping on his back left leg. Feeders have seen him for a week.", 5]] },
  { id: "luna", name: "Luna", species: "dog", sex: "female", age: est(2, "years"), neutered: "no", weightKg: 14.5, area: "Sidi Gaber",
    about: "Gentle, loves a chin scratch. Being treated for mange.", stage: "vet", followers: ["kaori"], updatedBy: "karim", hoursAgo: 3,
    notes: [["mona", "Collected from Sidi Gaber station, skin condition.", 50], ["karim", "Mange treatment started. Bloods are fine. Second dose in 7 days.", 3]] },
  { id: "mishmish", name: "Mishmish", species: "cat", sex: "female", age: est(2, "years"), neutered: "unknown", weightKg: 3.2, area: "Gleem",
    about: "", stage: "vet", followers: [], updatedBy: "karim", hoursAgo: 20 },
  { id: "bobby", name: "Bobby", species: "dog", sex: "male", age: est(4, "years"), neutered: "yes", weightKg: 21, area: "Montaza",
    about: "Calm, good on the lead. Nervous of motorbikes.", stage: "recovering", followers: ["kaori", "sara"], updatedBy: "sara", hoursAgo: 8,
    notes: [["sara", "Eating well, walks on the lead now. Scared of motorbikes.", 8]] },
  { id: "nour", name: "Nour", species: "dog", sex: "female", age: est(6, "months"), neutered: "no", weightKg: 9.8, area: "Raml Station",
    about: "Playful puppy, still learning not to chew everything.", stage: "recovering", followers: ["sara"], updatedBy: "sara", hoursAgo: 30 },
  { id: "zeina", name: "Zeina", species: "dog", sex: "female", age: est(1, "years"), neutered: "yes", weightKg: 16, area: "Agami",
    about: "Good with other dogs, unsure with cats. Loves the beach.", stage: "ready", followers: [], updatedBy: "mona", hoursAgo: 26,
    notes: [["karim", "Spayed, vaccinated, microchipped.", 70], ["mona", "Listed on Instagram. Good with other dogs, unsure with cats.", 26]] },
  { id: "ful", name: "Ful", species: "cat", sex: "male", age: est(3, "years"), neutered: "yes", weightKg: 4.6, area: "Sporting",
    about: "Lap cat. Will follow you from room to room.", stage: "ready", followers: ["kaori"], updatedBy: "mona", hoursAgo: 48 },
  { id: "rocky", name: "Rocky", species: "dog", sex: "male", age: est(5, "years"), neutered: "yes", weightKg: 24, area: "Stanley",
    about: "", stage: "adopted", followers: ["kaori"], updatedBy: "mona", hoursAgo: 120,
    notes: [["mona", "Adopted by a family in Cairo. They sent photos of him on the sofa.", 120]] },
];

export function createSeedBoard(now = Date.now()): Board {
  const columns = { reported: [], vet: [], recovering: [], ready: [], adopted: [] } as Columns;
  const animals: Record<string, Animal> = {};
  for (const { hoursAgo, notes = [], ...a } of seeds) {
    animals[a.id] = {
      ...a,
      media: [],
      updatedAt: now - hoursAgo * HOUR,
      notes: notes.map(([authorId, text, h], i) => ({ id: `${a.id}-seed-${i}`, authorId, text, at: now - h * HOUR })),
    };
    columns[a.stage as StageId].push(a.id);
  }
  return { version: 1, columns, animals };
}
