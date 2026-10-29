import { z } from "zod";
import type { Animal, Role, StageId } from "./protocol";

/**
 * Shelter layouts: a rough plan of each place animals stay, drawn as labelled
 * areas (kennels, rooms, the yard), with each animal placed on it. Staff only.
 *
 * Everything is in percentages of the plan (0–100 across, 0–100 down), so a
 * plan looks the same on any screen. Pure rules only: no database, no React.
 *
 * A layout marked public is also shown, read-only, to members and to visitors
 * who aren't signed in, so they know where to find each animal when they visit.
 *
 * One layout is marked as the main shelter. Staff on duty check in there, so
 * visitors know who to ask. A check-in lasts until they check out or the day
 * ends (Egypt time).
 */

/** The main shelter, where staff check in. Staff choose it; the first layout made starts as main. */
export const mainShelter = <T extends { main: boolean }>(layouts: T[]): T | undefined => layouts.find((l) => l.main);

/** Days end at midnight here, where the rescue is. */
export const SHELTER_TIME_ZONE = "Africa/Cairo";

export const LAYOUT_NAME_MAX = 60;
export const AREA_LABEL_MAX = 40;
export const LAYOUTS_MAX = 20;
export const AREAS_MAX = 60;
/** The smallest area, so it can always be seen and grabbed. */
export const AREA_MIN = 6;

/** Where animals are while the rescue has them: not still on the street, not yet in a home. */
export const SHELTER_STAGES: StageId[] = ["vet", "recovering", "ready"];
export const atShelter = (a: Pick<Animal, "stage">) => SHELTER_STAGES.includes(a.stage);

export type Rect = { x: number; y: number; w: number; h: number };
export type ShelterArea = Rect & { id: string; label: string };
export type Placement = { animalId: string; x: number; y: number };
/** Someone on duty, where they're working today. */
export type StaffSpot = { userId: string; name: string; role: Role; x: number; y: number };
export type ShelterLayout = {
  id: string;
  name: string;
  /** Shown to everyone, visitors included, so they know where to find each animal. */
  public: boolean;
  /** The main shelter: where staff check in. Only one layout is. */
  main: boolean;
  areas: ShelterArea[];
  placements: Placement[];
  staff: StaffSpot[];
};
export type ShelterState = { layouts: ShelterLayout[] };

const round = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));

/** An animal's spot, kept far enough inside the edges that its marker doesn't hang off the plan. */
export function clampPoint(x: number, y: number): { x: number; y: number } {
  return { x: round(clamp(x, 3, 97)), y: round(clamp(y, 4, 96)) };
}

/** At least AREA_MIN each way, and wholly on the plan. */
export function clampArea<T extends Rect>(a: T): T {
  const w = round(clamp(a.w, AREA_MIN, 100));
  const h = round(clamp(a.h, AREA_MIN, 100));
  return { ...a, w, h, x: round(clamp(a.x, 0, 100 - w)), y: round(clamp(a.y, 0, 100 - h)) };
}

/** A rectangle from two corners, in any order (a drag can go up and left). */
export function rectFromCorners(ax: number, ay: number, bx: number, by: number): Rect {
  return { x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay) };
}

export const inside = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/** The area an animal is in. With areas inside areas (a pen in the yard), the smallest one. */
export function areaAt(areas: ShelterArea[], x: number, y: number): ShelterArea | undefined {
  return areas.filter((a) => inside(a, x, y)).sort((a, b) => a.w * a.h - b.w * b.h)[0];
}

/** Room for a marker: nobody else's this close. */
/** Markers are about 84px wide and 70px tall: up to 13% of the narrowest plan (640px) across, and 16% down. */
const isFree = (taken: { x: number; y: number }[], x: number, y: number) => !taken.some((p) => Math.abs(p.x - x) < 10 && Math.abs(p.y - y) < 13);

/**
 * Where to put an animal chosen from a menu rather than dragged: the first free
 * spot in a grid inside the area (below its label), else its middle.
 */
export function spotInArea(area: Rect, taken: { x: number; y: number }[]): { x: number; y: number } {
  for (let y = area.y + 10; y <= area.y + area.h - 8; y += 13) {
    for (let x = area.x + 6; x <= area.x + area.w - 4; x += 10) {
      if (isFree(taken, x, y)) return clampPoint(x, y);
    }
  }
  return clampPoint(area.x + area.w / 2, area.y + area.h / 2);
}

/** A free spot anywhere, for "Put on the plan" with no area. Starts top left. */
export function spotOnPlan(taken: { x: number; y: number }[]): { x: number; y: number } {
  return spotInArea({ x: 0, y: 0, w: 100, h: 100 }, taken);
}

/** Where to put someone who's just checked in: the first free spot, clear of animals and other staff. */
export function checkInSpot(layout: ShelterLayout, userId: string): { x: number; y: number } {
  return spotOnPlan([...layout.placements, ...layout.staff.filter((s) => s.userId !== userId)]);
}

/** "Area 3": the first number not already used by an area called "Area n". */
export function nextAreaLabel(areas: { label: string }[]): string {
  const used = new Set(areas.map((a) => a.label.match(/^Area (\d+)$/)?.[1]).filter(Boolean).map(Number));
  let n = 1;
  while (used.has(n)) n++;
  return `Area ${n}`;
}

/* ---------- changes, as sent to POST /api/shelter ---------- */

const id = z.string().regex(/^[A-Za-z0-9-]{1,80}$/, "Not a valid id.");
const percent = z.number().finite();
const name = z
  .string()
  .trim()
  .min(1, "Give the layout a name.")
  .max(LAYOUT_NAME_MAX, `Keep the name under ${LAYOUT_NAME_MAX} characters.`);
const label = z
  .string()
  .trim()
  .min(1, "Give the area a name.")
  .max(AREA_LABEL_MAX, `Keep the name under ${AREA_LABEL_MAX} characters.`);

export const shelterChangeSchema = z.discriminatedUnion("op", [
  /** `id` comes from the browser (a UUID), so the new layout can show straight away. */
  z.object({ op: z.literal("layout.create"), id, name }),
  z.object({ op: z.literal("layout.rename"), layoutId: id, name }),
  /** Show the layout to everyone (members and visitors), or to staff only. */
  z.object({ op: z.literal("layout.public"), layoutId: id, public: z.boolean() }),
  /** Make this layout the main shelter (and no other). */
  z.object({ op: z.literal("layout.main"), layoutId: id }),
  /** Its areas go with it, and its animals go back to "Not placed". */
  z.object({ op: z.literal("layout.delete"), layoutId: id }),
  /** Adds or updates an area. Moving it moves the animals inside it too. */
  z.object({
    op: z.literal("area.save"),
    layoutId: id,
    area: z.object({ id, label, x: percent, y: percent, w: percent, h: percent }),
  }),
  /** The animals inside stay where they are, just not in an area. */
  z.object({ op: z.literal("area.delete"), layoutId: id, areaId: id }),
  /** Puts an animal on a layout, or moves it (from this layout or another). */
  z.object({ op: z.literal("place"), animalId: id, layoutId: id, x: percent, y: percent }),
  z.object({ op: z.literal("unplace"), animalId: id }),
  /** "I'm here": the person signed in puts themselves on the main shelter, or moves. Never anyone else. */
  z.object({ op: z.literal("checkin"), layoutId: id, x: percent, y: percent }),
  /** "I've left". */
  z.object({ op: z.literal("checkout") }),
]);
export type ShelterChange = z.infer<typeof shelterChangeSchema>;

/**
 * The same change applied in the browser, so the plan updates before the
 * server answers. The server's answer replaces it either way.
 */
export function applyShelterChange(
  state: ShelterState,
  change: ShelterChange,
  /** Who is making the change, for checking in. */
  me?: { id: string; name: string; role: Role },
): ShelterState {
  const withLayout = (layoutId: string, fn: (l: ShelterLayout) => ShelterLayout): ShelterState => ({
    layouts: state.layouts.map((l) => (l.id === layoutId ? fn(l) : l)),
  });
  switch (change.op) {
    case "layout.create":
      return {
        layouts: [
          ...state.layouts,
          // The first layout starts as the main shelter.
          { id: change.id, name: change.name.trim(), public: false, main: !mainShelter(state.layouts), areas: [], placements: [], staff: [] },
        ],
      };
    case "layout.rename":
      return withLayout(change.layoutId, (l) => ({ ...l, name: change.name.trim() }));
    case "layout.main": {
      // Check-ins belong to the main shelter, so they move with it.
      const onDuty = state.layouts.flatMap((l) => l.staff);
      return {
        layouts: state.layouts.map((l) => ({ ...l, main: l.id === change.layoutId, staff: l.id === change.layoutId ? onDuty : [] })),
      };
    }
    case "layout.public":
      return withLayout(change.layoutId, (l) => ({ ...l, public: change.public }));
    case "layout.delete":
      return { layouts: state.layouts.filter((l) => l.id !== change.layoutId) };
    case "area.save": {
      const area = clampArea({ ...change.area, label: change.area.label.trim() });
      return withLayout(change.layoutId, (l) => {
        const before = l.areas.find((a) => a.id === area.id);
        const dx = before ? area.x - before.x : 0;
        const dy = before ? area.y - before.y : 0;
        const moved = before && (dx !== 0 || dy !== 0);
        return {
          ...l,
          areas: before ? l.areas.map((a) => (a.id === area.id ? area : a)) : [...l.areas, area],
          // Whoever is in the area moves with it.
          placements: moved
            ? l.placements.map((p) => (inside(before, p.x, p.y) ? { ...p, ...clampPoint(p.x + dx, p.y + dy) } : p))
            : l.placements,
          staff: moved ? l.staff.map((p) => (inside(before, p.x, p.y) ? { ...p, ...clampPoint(p.x + dx, p.y + dy) } : p)) : l.staff,
        };
      });
    }
    case "area.delete":
      return withLayout(change.layoutId, (l) => ({ ...l, areas: l.areas.filter((a) => a.id !== change.areaId) }));
    case "place": {
      const spot = clampPoint(change.x, change.y);
      return {
        layouts: state.layouts.map((l) => {
          const others = l.placements.filter((p) => p.animalId !== change.animalId);
          return { ...l, placements: l.id === change.layoutId ? [...others, { animalId: change.animalId, ...spot }] : others };
        }),
      };
    }
    case "unplace":
      return { layouts: state.layouts.map((l) => ({ ...l, placements: l.placements.filter((p) => p.animalId !== change.animalId) })) };
    case "checkin": {
      if (!me) return state;
      const spot = clampPoint(change.x, change.y);
      return {
        layouts: state.layouts.map((l) => {
          const others = l.staff.filter((p) => p.userId !== me.id);
          return { ...l, staff: l.id === change.layoutId ? [...others, { userId: me.id, name: me.name, role: me.role, ...spot }] : others };
        }),
      };
    }
    case "checkout":
      return me ? { layouts: state.layouts.map((l) => ({ ...l, staff: l.staff.filter((p) => p.userId !== me.id) })) } : state;
  }
}
