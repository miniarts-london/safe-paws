/**
 * The board, backed by Postgres.
 *
 * On start-up the whole board is loaded into memory (a rescue has tens or
 * hundreds of animals, not millions), so snapshots for new connections are
 * instant. Every change is written to Postgres in a transaction first, and
 * only applied to memory and broadcast once it has committed. If the write
 * fails, nothing changes and the person sees an error.
 */
import { randomUUID } from "node:crypto";
import {
  approveMember,
  getUser,
  insertAnimal,
  keepMember,
  listMembers,
  insertNote,
  insertNotifications,
  listNotifications,
  loadBoard,
  markNotificationsRead,
  replaceMedia,
  saveColumns,
  setFollower,
  touchAnimal,
  transaction,
  updateAnimalDetails,
} from "@safe-paws/db";
import {
  STAGE_IDS,
  type Animal,
  type AnimalDetailsInput,
  type Board,
  type BoardPatch,
  type Media,
  type NotificationKind,
  type StaffRole,
  type StageId,
  type User,
} from "@safe-paws/shared/protocol";
import type { Outgoing } from "./notify";

let users: User[] = [];
let board: Board = { version: 0, columns: { reported: [], vet: [], recovering: [], ready: [], adopted: [] }, animals: {} };

export async function loadState() {
  ({ users, board } = await loadBoard());
  return { people: users.length, animals: Object.keys(board.animals).length };
}

export const getBoard = () => board;
export const getUsers = () => users;
export const findUser = (id: string) => users.find((u) => u.id === id);

/**
 * The person for a session. People who signed up since the server started
 * aren't in memory yet, so look them up once. `isNew` tells the caller to
 * introduce them to everyone else.
 */
export async function ensureUser(id: string): Promise<{ user: User; isNew: boolean } | null> {
  const known = findUser(id);
  if (known) return { user: known, isNew: false };
  const user = await getUser(id);
  if (!user) return null;
  // Two tabs can connect at once; only add them the first time.
  if (findUser(id)) return { user: findUser(id)!, isNew: false };
  users = [...users, user];
  return { user, isNew: true };
}

const replaceUser = (user: User) => {
  users = users.map((u) => (u.id === user.id ? user : u));
  return user;
};

export const membersList = () => listMembers();

export async function approve(userId: string, role: StaffRole, title: string, reviewerId: string) {
  const user = await approveMember(userId, role, title, reviewerId);
  if (!user) throw new BoardError("They're already staff, or their account no longer exists.");
  return replaceUser(user);
}

export async function keep(userId: string, reviewerId: string) {
  if (!(await keepMember(userId, reviewerId))) throw new BoardError("They're already staff, or their account no longer exists.");
}

export class BoardError extends Error {}

const requireAnimal = (id: string) => {
  const a = board.animals[id];
  if (!a) throw new BoardError("That animal isn't on the board any more.");
  return a;
};

/** Postgres error codes worth explaining to a person rather than logging as a crash. */
function explain(err: unknown): never {
  const code = (err as { code?: string }).code;
  if (code === "23503") throw new BoardError("One of the photos or videos wasn't uploaded properly. Remove it and try again.");
  if (code === "23505") throw new BoardError("That already exists.");
  if (code === "23514") throw new BoardError("Some of those details aren't allowed. Check the form and try again.");
  throw err;
}

export async function moveAnimal(animalId: string, toStage: StageId, toIndex: number, actorId: string) {
  const animal = requireAnimal(animalId);
  if (!STAGE_IDS.includes(toStage)) throw new BoardError("Unknown stage.");

  const from = animal.stage;
  const fromList = board.columns[from].filter((id) => id !== animalId);
  const target = (from === toStage ? fromList : board.columns[toStage]).filter((id) => id !== animalId);
  const index = Math.max(0, Math.min(Number.isFinite(toIndex) ? toIndex : target.length, target.length));
  target.splice(index, 0, animalId);
  const columns: BoardPatch["columns"] = from === toStage ? { [toStage]: target } : { [from]: fromList, [toStage]: target };
  const now = Date.now();

  await transaction(async (tx) => {
    await saveColumns(tx, columns);
    if (from !== toStage) await touchAnimal(tx, animalId, actorId, now);
  });

  Object.assign(board.columns, columns);
  animal.stage = toStage;
  if (from !== toStage) Object.assign(animal, { updatedAt: now, updatedBy: actorId });
  board.version++;
  return { from, animal, patch: { version: board.version, columns, animals: [animal] } satisfies BoardPatch };
}

export async function addNote(animalId: string, text: string, actorId: string) {
  const animal = requireAnimal(animalId);
  const clean = text.trim().slice(0, 1000);
  if (!clean) throw new BoardError("Write something before posting the update.");
  const note = { id: randomUUID(), authorId: actorId, text: clean, at: Date.now() };

  await transaction(async (tx) => {
    await insertNote(tx, animalId, note);
    await touchAnimal(tx, animalId, actorId, note.at);
  });

  animal.notes.push(note);
  Object.assign(animal, { updatedAt: note.at, updatedBy: actorId });
  board.version++;
  return { animal, text: clean, patch: { version: board.version, columns: {}, animals: [animal] } satisfies BoardPatch };
}

/** Turns the form's media ids into full records, keeping who added each and when. */
function resolveMedia(input: AnimalDetailsInput["media"], existing: Media[], actorId: string): Media[] {
  const byId = new Map(existing.map((m) => [m.id, m]));
  return input.map(
    (m) => byId.get(m.id) ?? { id: m.id, kind: m.kind, name: m.name, url: `/api/media/${m.id}`, addedBy: actorId, at: Date.now() },
  );
}

/** A newly found animal starts in Reported, at the top, followed by whoever registered it. */
export async function createAnimal(animalId: string, details: AnimalDetailsInput, actorId: string) {
  if (!/^[a-z0-9-]{8,64}$/.test(animalId)) throw new BoardError("That animal id isn't valid.");
  if (board.animals[animalId]) throw new BoardError("An animal with that id already exists.");
  const now = Date.now();
  const animal: Animal = {
    ...details,
    id: animalId,
    media: resolveMedia(details.media, [], actorId),
    stage: "reported",
    followers: [actorId],
    notes: [],
    updatedAt: now,
    updatedBy: actorId,
  };
  const reported = [animalId, ...board.columns.reported];

  await transaction(async (tx) => {
    await insertAnimal(tx, animal, 0);
    await saveColumns(tx, { reported });
    await setFollower(tx, animalId, actorId, true);
    await replaceMedia(tx, animalId, animal.media);
  }).catch(explain);

  board.animals[animalId] = animal;
  board.columns.reported = reported;
  board.version++;
  return { animal, patch: { version: board.version, columns: { reported }, animals: [animal] } satisfies BoardPatch };
}

export async function updateAnimal(animalId: string, details: AnimalDetailsInput, actorId: string) {
  const animal = requireAnimal(animalId);
  const before = new Set(animal.media.map((m) => m.id));
  const media = resolveMedia(details.media, animal.media, actorId);
  const next: Animal = { ...animal, ...details, media, updatedAt: Date.now(), updatedBy: actorId };

  await transaction(async (tx) => {
    await updateAnimalDetails(tx, next);
    await replaceMedia(tx, animalId, media);
  }).catch(explain);

  Object.assign(animal, next);
  board.version++;
  const added = media.filter((m) => !before.has(m.id));
  return {
    animal,
    addedPhotos: added.filter((m) => m.kind === "photo").length,
    addedVideos: added.filter((m) => m.kind === "video").length,
    patch: { version: board.version, columns: {}, animals: [animal] } satisfies BoardPatch,
  };
}

export async function setFollow(animalId: string, userId: string, follow: boolean) {
  const animal = requireAnimal(animalId);
  await transaction((tx) => setFollower(tx, animalId, userId, follow));
  const others = animal.followers.filter((id) => id !== userId);
  animal.followers = follow ? [...others, userId] : others;
  board.version++;
  return { version: board.version, columns: {}, animals: [animal] } satisfies BoardPatch;
}

/** Saved first, so people who are offline find them when they come back. */
export const createNotifications = (out: Outgoing[], kind: NotificationKind, animalId: string, actorId: string) =>
  insertNotifications(out, kind, animalId, actorId);

export const notificationsFor = (userId: string) => listNotifications(userId, 50);
export const markRead = (userId: string, ids: number[] | "all") => markNotificationsRead(userId, ids);
