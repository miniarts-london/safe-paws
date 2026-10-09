/**
 * Who hears about a change, and what each of them is told.
 *
 * Pure functions: given an event and the people involved, return one
 * message per recipient. The person who made the change never gets one.
 * When someone qualifies twice (they follow the animal AND their role
 * cares about the new stage), they get the single most useful message.
 */
import { formatAge } from "@safe-paws/shared/format";
import { stageLabel, type Animal, type Role, type StageId, type User } from "@safe-paws/shared/protocol";

export type Outgoing = { userId: string; text: string };

/** Which role needs to act when an animal arrives in a stage. */
const STAGE_OWNER: Partial<Record<StageId, Role>> = {
  vet: "vet",
  recovering: "fosterer",
  ready: "coordinator",
};

function roleMessage(role: Role, animal: Animal, actor: User): string | null {
  const a = animal.name;
  switch (`${role}:${animal.stage}`) {
    case "vet:vet":
      return `${actor.name} is bringing ${a} in for a check (${animal.species}, ${formatAge(animal.age)}, from ${animal.area}).`;
    case "fosterer:recovering":
      return `${a} needs a foster or sanctuary place to recover. Can you take ${pronoun(animal)}?`;
    case "coordinator:ready":
      return `${a} is ready for an adoption listing.`;
    default:
      return null;
  }
}

function followerMessage(user: User, animal: Animal, actor: User, from: StageId): string {
  const a = animal.name;
  if (user.role === "sponsor") {
    switch (animal.stage) {
      case "adopted":
        return `Good news: ${a}, who you sponsor, has been adopted.`;
      case "ready":
        return `${a}, who you sponsor, has finished treatment and is ready for adoption.`;
      case "vet":
        return `${a}, who you sponsor, has gone to the vet. ${actor.name} will post an update.`;
      default:
        return `${a}, who you sponsor, moved from ${stageLabel(from)} to ${stageLabel(animal.stage)}.`;
    }
  }
  return `${actor.name} moved ${a} from ${stageLabel(from)} to ${stageLabel(animal.stage)}.`;
}

export function notifyMove(animal: Animal, from: StageId, actor: User, users: User[]): Outgoing[] {
  if (from === animal.stage) return []; // reordering within a column isn't news
  const owner = STAGE_OWNER[animal.stage];
  const out: Outgoing[] = [];
  for (const user of users) {
    if (user.id === actor.id) continue;
    const role = user.role === owner ? roleMessage(user.role, animal, actor) : null;
    const follows = animal.followers.includes(user.id);
    if (role) out.push({ userId: user.id, text: role });
    else if (follows) out.push({ userId: user.id, text: followerMessage(user, animal, actor, from) });
  }
  return out;
}

export function notifyNote(animal: Animal, text: string, actor: User, users: User[]): Outgoing[] {
  const snippet = text.length > 90 ? text.slice(0, 87) + "…" : text;
  const out: Outgoing[] = [];
  for (const user of users) {
    if (user.id === actor.id) continue;
    const follows = animal.followers.includes(user.id);
    // Coordinators see every update so nothing falls through the cracks.
    if (!follows && user.role !== "coordinator") continue;
    const who = user.role === "sponsor" && follows ? `${animal.name}, who you sponsor` : animal.name;
    out.push({ userId: user.id, text: `${actor.name} posted an update on ${who}: “${snippet}”` });
  }
  return out;
}

/** A new animal: coordinators always hear, and the vet does when it may need a check. */
export function notifyCreate(animal: Animal, actor: User, users: User[]): Outgoing[] {
  const what = `${animal.species === "dog" ? "a dog" : "a cat"}, ${animal.name}`;
  return users
    .filter((u) => u.id !== actor.id && (u.role === "coordinator" || u.role === "vet"))
    .map((u) => ({
      userId: u.id,
      text:
        u.role === "vet"
          ? `${actor.name} registered ${what}, found in ${animal.area}. It may need a check soon.`
          : `${actor.name} registered ${what}, found in ${animal.area}.`,
    }));
}

/**
 * Edited details. New photos or videos are the news followers care about
 * (sponsors especially); a corrected weight or typo isn't worth a ping.
 */
export function notifyUpdate(animal: Animal, actor: User, users: User[], addedPhotos: number, addedVideos: number): Outgoing[] {
  if (addedPhotos + addedVideos === 0) return [];
  const parts = [
    addedPhotos && `${addedPhotos} new photo${addedPhotos > 1 ? "s" : ""}`,
    addedVideos && `${addedVideos} new video${addedVideos > 1 ? "s" : ""}`,
  ].filter(Boolean);
  return users
    .filter((u) => u.id !== actor.id && animal.followers.includes(u.id))
    .map((u) => ({
      userId: u.id,
      text: `${actor.name} added ${parts.join(" and ")} of ${u.role === "sponsor" ? `${animal.name}, who you sponsor` : animal.name}.`,
    }));
}

function pronoun(animal: Animal) {
  return animal.sex === "female" ? "her" : "him";
}
