/**
 * Rescue board wire protocol, shared by server/board and the /board page.
 *
 * The server owns the board. Clients send intents (move, note, follow);
 * the server applies them, broadcasts a versioned patch to everyone, and
 * sends each affected person their own notification.
 */

export const STAGES = [
  { id: "reported", label: "Reported", hint: "Seen on the street, not yet collected" },
  { id: "vet", label: "At the vet", hint: "Being checked or treated" },
  { id: "recovering", label: "Recovering", hint: "In foster or at the sanctuary" },
  { id: "ready", label: "Ready for adoption", hint: "Vaccinated, neutered, listed" },
  { id: "adopted", label: "Adopted", hint: "In a home" },
] as const;

export type StageId = (typeof STAGES)[number]["id"];
export const STAGE_IDS = STAGES.map((s) => s.id) as StageId[];
export const stageLabel = (id: StageId) => STAGES.find((s) => s.id === id)!.label;

/** Staff can change the board. */
export const STAFF_ROLES = ["coordinator", "vet", "fosterer", "sponsor"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
/** Anyone can sign up as a member and see the board; a coordinator makes them staff. */
export type Role = StaffRole | "member";

export const isStaff = (role: Role | undefined): role is StaffRole => !!role && role !== "member";

export const ROLE_LABELS: Record<Role, string> = {
  coordinator: "Coordinator",
  vet: "Vet",
  fosterer: "Fosterer",
  sponsor: "Sponsor",
  member: "Member",
};

export type User = {
  id: string;
  name: string;
  role: Role;
  /** How the person describes their part, shown under their name. */
  title: string;
};

export type Note = { id: string; authorId: string; text: string; at: number };

export type AgeUnit = "weeks" | "months" | "years";
export type Age = { value: number; unit: AgeUnit; /** Most street animals' ages are a vet's guess. */ estimated: boolean };

export type Neutered = "yes" | "no" | "unknown";

/** A photo or video, stored by the web app and served from `url` to signed-in people only. */
export type Media = {
  id: string;
  kind: "photo" | "video";
  url: string;
  name: string;
  addedBy: string;
  at: number;
};

/** Everything the register / edit form sets. */
export type AnimalDetails = {
  name: string;
  species: "dog" | "cat";
  sex: "female" | "male";
  age: Age;
  neutered: Neutered;
  /** Kilograms. Null until someone has weighed them. */
  weightKg: number | null;
  /** Neighbourhood of Alexandria where the animal was found. */
  area: string;
  /** Standing description: temperament, health, needs. Dated news goes in `notes`. */
  about: string;
  media: Media[];
};

export type Animal = AnimalDetails & {
  id: string;
  stage: StageId;
  /** People who asked to hear about this animal (sponsors, fosterers, anyone). */
  followers: string[];
  notes: Note[];
  updatedAt: number;
  updatedBy: string;
};

/** What a coordinator sees about people who signed up. Emails go to coordinators only. */
export type Member = User & {
  email: string;
  joinedAt: number;
  /** Set once a coordinator has made them staff or chosen to keep them as a member. */
  reviewedAt: number | null;
};

export type Columns = Record<StageId, string[]>;

export type Board = { version: number; columns: Columns; animals: Record<string, Animal> };

export type NotificationKind = "moved" | "note" | "registered" | "details";

export type Notification = {
  id: number;
  userId: string;
  kind: NotificationKind;
  animalId: string;
  actorId: string;
  text: string;
  at: number;
  read: boolean;
};

/* ---------- client → server ---------- */

/** Who you are comes from the signed session cookie on connect, never from a message. */
export type BoardClientMessage =
  | { type: "animal.move"; animalId: string; toStage: StageId; toIndex: number }
  | { type: "animal.note"; animalId: string; text: string }
  | { type: "animal.follow"; animalId: string; follow: boolean }
  /** `animalId` comes from the client (a UUID), so the form can open the new animal straight away. */
  | { type: "animal.create"; animalId: string; details: AnimalDetailsInput }
  | { type: "animal.update"; animalId: string; details: AnimalDetailsInput }
  | { type: "notifications.read"; ids: number[] | "all" }
  /** Coordinators only: make a member staff, with the role and title they'll have. */
  | { type: "member.approve"; userId: string; role: StaffRole; title: string }
  /** Coordinators only: keep them as a member and take them off the "new" list. */
  | { type: "member.keep"; userId: string }
  /** Mobile only: where to send push notifications while the app is closed. */
  | { type: "push.register"; token: string }
  | { type: "push.unregister"; token: string };

/** What the form sends: media as uploaded ids; the server fills in who added them and when. */
export type AnimalDetailsInput = Omit<AnimalDetails, "media"> & {
  media: { id: string; kind: Media["kind"]; name: string }[];
};

/* ---------- server → client ---------- */

export type BoardPatch = {
  version: number;
  columns: Partial<Columns>;
  animals: Animal[];
};

export type BoardServerMessage =
  /** Full state for this person. Sent on every connect, including reconnects, so nothing is missed. */
  | { type: "welcome"; userId: string; users: User[]; board: Board; notifications: Notification[] }
  | { type: "board.patch"; patch: BoardPatch }
  | { type: "notification"; notification: Notification }
  /** Keeps the bell in sync across this person's other tabs and devices. */
  | { type: "notifications.read"; ids: number[] | "all" }
  /** Someone joined, or someone's role changed (including your own). */
  | { type: "user.upsert"; user: User }
  /** Coordinators only: everyone who signed up, newest first. */
  | { type: "members"; members: Member[] }
  | { type: "error"; message: string };

export const DEFAULT_BOARD_PORT = 8788;

/** Close codes the client acts on. 4000–4999 are free for applications to use. */
export const CLOSE_SESSION_ENDED = 4401;
