"use client";

import AddOutlined from "@mui/icons-material/AddOutlined";
import Home from "@mui/icons-material/Home";
import HomeOutlined from "@mui/icons-material/HomeOutlined";
import AutoAwesomeMosaicOutlined from "@mui/icons-material/AutoAwesomeMosaicOutlined";
import CheckOutlined from "@mui/icons-material/CheckOutlined";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import HighlightAlt from "@mui/icons-material/HighlightAlt";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import RemoveCircleOutlined from "@mui/icons-material/RemoveCircleOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import { stageLabel, type Animal } from "@safe-paws/shared/protocol";
import {
  AREA_LABEL_MAX,
  AREA_MIN,
  LAYOUT_NAME_MAX,
  areaAt,
  atShelter,
  clampArea,
  clampPoint,
  inside,
  nextAreaLabel,
  rectFromCorners,
  checkInSpot,
  spotInArea,
  spotOnPlan,
  type Placement,
  type Rect,
  type ShelterArea,
  type ShelterChange,
} from "@safe-paws/shared/shelter";
import { useBoard, useCanEdit, useMe } from "@safe-paws/shared/store";
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { AnimalAvatar } from "@/components/AnimalAvatar";
import { MOBILE_QUERY, useMediaQuery } from "@/lib/useMediaQuery";
import { useShelter, useShelterStore } from "@/lib/useShelter";
import { MARKER_PHOTO, MarkerKey, ShelterMap, StaffFace, areaFillSx, markerNameSx, markerSx, planSurfaceSx, staffLine } from "./ShelterMap";

/**
 * Shelter layouts: a rough plan of each place animals stay (labelled areas such
 * as kennels, rooms and the yard), with each animal dragged to where it is.
 * Staff only. Everything can also be done without dragging: click an animal to
 * choose its area from a menu, and use the arrow keys to nudge animals and areas.
 */

const SAVED_LAYOUT = "safe-paws.shelter-layout";

/** A starting point: a row of kennels, quarantine, a cat room, a vet room and the yard. */
const EXAMPLE: Omit<ShelterArea, "id">[] = [
  { label: "Kennel 1", x: 2, y: 3, w: 18, h: 32 },
  { label: "Kennel 2", x: 21, y: 3, w: 18, h: 32 },
  { label: "Kennel 3", x: 40, y: 3, w: 18, h: 32 },
  { label: "Quarantine", x: 62, y: 3, w: 36, h: 32 },
  { label: "Cat room", x: 2, y: 40, w: 28, h: 30 },
  { label: "Vet room", x: 32, y: 40, w: 26, h: 30 },
  { label: "Yard", x: 62, y: 40, w: 36, h: 57 },
];

/** Something being dragged right now. Positions are percentages of the plan. */
type Gesture =
  | { kind: "animal"; from: "plan" | "tray"; animalId: string; pointerId: number; startX: number; startY: number; origin: { x: number; y: number }; moved: boolean }
  | { kind: "move" | "resize"; areaId: string; pointerId: number; startX: number; startY: number; origin: ShelterArea; moved: boolean }
  | { kind: "draw"; pointerId: number; startX: number; startY: number; moved: boolean };

/** What the plan shows while something is being dragged, before it's saved. */
type Preview =
  | { kind: "animal"; animalId: string; x: number; y: number; overTray: boolean }
  | { kind: "ghost"; animalId: string; clientX: number; clientY: number }
  | { kind: "area"; area: ShelterArea; origin: ShelterArea }
  | { kind: "draw"; rect: Rect }
  | null;

type MenuFor = { anchor: HTMLElement; animalId: string; placed: boolean } | null;

const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

function readSaved() {
  try {
    return window.localStorage.getItem(SAVED_LAYOUT);
  } catch {
    return null;
  }
}
function save(id: string) {
  try {
    window.localStorage.setItem(SAVED_LAYOUT, id);
  } catch {
    // Private window: it just won't be remembered.
  }
}

const noSelecting = (e: Event) => e.preventDefault();
const byName = (a: Animal, b: Animal) => a.name.localeCompare(b.name, "en-GB");
const percentAt = (rect: DOMRect, clientX: number, clientY: number) => ({
  x: ((clientX - rect.left) / rect.width) * 100,
  y: ((clientY - rect.top) / rect.height) * 100,
});
const within = (el: HTMLElement | null, clientX: number, clientY: number) => {
  const r = el?.getBoundingClientRect();
  return !!r && clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
};

/** Staff arrange the layouts; members see the public ones, read-only. */
export function ShelterPlan() {
  const canEdit = useCanEdit();
  return canEdit ? <ShelterEditor /> : <MemberShelter />;
}

function MemberShelter() {
  const animals = useBoard((s) => s.board?.animals);
  // For members the server sends only the public layouts.
  const { state, error } = useShelter();
  if (error) return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;
  if (!animals || !state) {
    return (
      <Stack spacing={2} sx={{ alignItems: "center", py: 8 }}>
        <CircularProgress size={28} />
      </Stack>
    );
  }
  return <ShelterMap layouts={state.layouts} animals={animals} />;
}

function ShelterEditor() {
  const animals = useBoard((s) => s.board?.animals);
  const me = useMe();
  const { state, change, saving, error, clearError } = useShelter(me);
  const mobile = useMediaQuery(MOBILE_QUERY);

  // The board only renders in the browser (BoardClient), so localStorage is there from the start.
  const [chosenId, setChosenId] = useState<string | null>(readSaved);
  const layouts = state?.layouts ?? [];
  const layout = layouts.find((l) => l.id === chosenId) ?? layouts[0] ?? null;
  const choose = (id: string) => {
    setChosenId(id);
    save(id);
    setSelectedAreaId(null);
    setDrawing(false);
  };

  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  /** The area whose name is being typed, right on the plan. */
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview>(null);
  const [menu, setMenu] = useState<MenuFor>(null);
  const [naming, setNaming] = useState<{ mode: "create" | "rename"; name: string } | null>(null);
  const [deleting, setDeleting] = useState<"layout" | "area" | null>(null);
  const [live, setLive] = useState("");

  const planRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  /** When the last drag ended (the pointer event's timeStamp): a click just after it is part of the drag. */
  const dragEndedAt = useRef(-Infinity);
  /** Pointer moves are drawn once per frame: the latest position wins. */
  const frame = useRef<number | null>(null);
  const lastPoint = useRef<{ clientX: number; clientY: number } | null>(null);

  // Leaving the page mid-drag: let the page select text again.
  useEffect(() => () => document.removeEventListener("selectstart", noSelecting), []);

  // Leave draw mode with Escape.
  useEffect(() => {
    if (!drawing) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setDrawing(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawing]);

  // Until the layouts and the animals have both arrived, nothing can be dragged yet: say so over the plan.
  if (!animals || !state) {
    return <EditorLoading mobile={mobile} error={animals ? error : null} />;
  }

  const here = Object.values(animals).filter(atShelter).sort(byName);
  const placedIds = new Set(layouts.flatMap((l) => l.placements.map((p) => p.animalId)));
  const notPlaced = here.filter((a) => !placedIds.has(a.id));
  const placements = (layout?.placements ?? []).filter((p) => animals[p.animalId] && atShelter(animals[p.animalId]));
  const areas = layout?.areas ?? [];
  const selectedArea = areas.find((a) => a.id === selectedAreaId) ?? null;

  /* ---------- what's on screen, including anything mid-drag ---------- */

  const shownAreas = areas.map((a) => (preview?.kind === "area" && preview.area.id === a.id ? preview.area : a));
  const drawn = preview?.kind === "draw" ? preview.rect : null;
  // Staff check in on the layout of the place they're at, one place at a time.
  const myCheckIn = layout?.staff.find((st) => st.userId === me?.id);
  const checkedInElsewhere = layouts.find((l) => l.id !== layout?.id && l.staff.some((st) => st.userId === me?.id));
  const shownPlacements: Placement[] = placements.map((p) => {
    if (preview?.kind === "animal" && preview.animalId === p.animalId) return { ...p, x: preview.x, y: preview.y };
    // Animals ride along with an area being moved.
    if (preview?.kind === "area" && inside(preview.origin, p.x, p.y)) {
      const dx = preview.area.x - preview.origin.x;
      const dy = preview.area.y - preview.origin.y;
      return { ...p, ...clampPoint(p.x + dx, p.y + dy) };
    }
    return p;
  });

  /* ---------- changes ---------- */

  const send = (c: ShelterChange, debounceKey?: string) => {
    clearError();
    change(c, debounceKey);
  };

  const placeAt = (animal: Animal, spot: { x: number; y: number }) => {
    if (!layout) return;
    send({ op: "place", animalId: animal.id, layoutId: layout.id, ...spot });
    const area = areaAt(areas, spot.x, spot.y);
    setLive(`${animal.name} placed${area ? ` in ${area.label}` : " on the plan"}.`);
  };
  const putIn = (animal: Animal, area: ShelterArea | null) => {
    const taken = placements.filter((p) => p.animalId !== animal.id);
    placeAt(animal, area ? spotInArea(area, taken) : spotOnPlan(taken));
  };
  const takeOff = (animal: Animal) => {
    send({ op: "unplace", animalId: animal.id });
    setLive(`${animal.name} taken off the plan.`);
  };
  // Staff aren't drawn on the plan; they're listed under On duty today.
  const checkIn = () => {
    if (!layout || !me) return;
    send({ op: "checkin", layoutId: layout.id, ...checkInSpot(layout, me.id) });
    setLive("You're on duty. Thanks!");
  };
  const checkOut = () => {
    send({ op: "checkout" });
    setLive("Checked out. Thanks for today!");
  };
  const saveArea = (area: ShelterArea, debounceKey?: string) => {
    if (layout) send({ op: "area.save", layoutId: layout.id, area }, debounceKey);
  };
  const addArea = (rect: Rect) => {
    if (!layout) return;
    const area = clampArea({ id: crypto.randomUUID(), label: nextAreaLabel(areas), ...rect });
    saveArea(area);
    setSelectedAreaId(area.id);
    setEditingAreaId(area.id);
    setLive(`${area.label} added. Type its name.`);
  };
  /** A new area in the first empty corner of the plan, for people who can't drag. */
  const addAreaWithoutDrawing = () => {
    const size = { w: 20, h: 26 };
    for (let y = 3; y <= 100 - size.h; y += 6) {
      for (let x = 2; x <= 100 - size.w; x += 4) {
        const r = { x, y, ...size };
        const overlaps = areas.some((a) => a.x < r.x + r.w && r.x < a.x + a.w && a.y < r.y + r.h && r.y < a.y + a.h);
        if (!overlaps) return addArea(r);
      }
    }
    addArea({ x: 40, y: 37, ...size });
  };
  const startExample = (id: string) => {
    for (const a of EXAMPLE) send({ op: "area.save", layoutId: id, area: { id: crypto.randomUUID(), ...a } });
  };

  /* ---------- dragging ---------- */

  function begin(e: PointerEvent<HTMLElement>, g: Gesture) {
    if (e.button !== 0) return;
    stopFrame();
    dragEndedAt.current = -Infinity;
    gesture.current = g;
    // Dragging across the page would otherwise select text on the way, and the browser can
    // then try to drag that text, which leaves the next drag stuck until it gives up.
    window.getSelection()?.removeAllRanges();
    document.addEventListener("selectstart", noSelecting);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Already captured.
    }
  }

  /** What the plan should show for gesture `g` with the pointer at (clientX, clientY). */
  function previewFor(g: Gesture, rect: DOMRect, clientX: number, clientY: number): NonNullable<Preview> {
    const dx = ((clientX - g.startX) / rect.width) * 100;
    const dy = ((clientY - g.startY) / rect.height) * 100;
    if (g.kind === "animal") {
      if (g.from === "tray") return { kind: "ghost", animalId: g.animalId, clientX, clientY };
      return { kind: "animal", animalId: g.animalId, ...clampPoint(g.origin.x + dx, g.origin.y + dy), overTray: within(trayRef.current, clientX, clientY) };
    }
    if (g.kind === "move") return { kind: "area", origin: g.origin, area: clampArea({ ...g.origin, x: g.origin.x + dx, y: g.origin.y + dy }) };
    if (g.kind === "resize") return { kind: "area", origin: g.origin, area: clampArea({ ...g.origin, w: g.origin.w + dx, h: g.origin.h + dy }) };
    const start = percentAt(rect, g.startX, g.startY);
    const end = percentAt(rect, clientX, clientY);
    const r = rectFromCorners(start.x, start.y, end.x, end.y);
    return { kind: "draw", rect: { x: Math.max(0, r.x), y: Math.max(0, r.y), w: Math.min(r.w, 100 - Math.max(0, r.x)), h: Math.min(r.h, 100 - Math.max(0, r.y)) } };
  }

  function stopFrame() {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    lastPoint.current = null;
    document.removeEventListener("selectstart", noSelecting);
  }

  function onMove(e: PointerEvent<HTMLElement>) {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    if (!g.moved && Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < 5) return;
    g.moved = true;
    // Trackpads send moves faster than the screen redraws. Drawing each one made the plan
    // fall behind the pointer and feel stuck, so only the latest one per frame is drawn.
    lastPoint.current = { clientX: e.clientX, clientY: e.clientY };
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const point = lastPoint.current;
      const current = gesture.current;
      const rect = planRef.current?.getBoundingClientRect();
      if (!point || !current || !rect) return;
      setPreview(previewFor(current, rect, point.clientX, point.clientY));
    });
  }

  function onUp(e: PointerEvent<HTMLElement>) {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    gesture.current = null;
    stopFrame();
    setPreview(null);
    if (!g.moved) return;
    // The click that follows a drag (on the same element) isn't a click. Some browsers send it
    // a moment later, so ignore clicks for a short while; the next press clears this (begin).
    dragEndedAt.current = e.timeStamp;
    const rect = planRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Worked out from where the pointer let go, not from the last frame drawn.
    const shown = previewFor(g, rect, e.clientX, e.clientY);
    if (g.kind === "animal") {
      const animal = animals![g.animalId];
      if (!animal) return;
      if (g.from === "plan") {
        if (within(trayRef.current, e.clientX, e.clientY)) return takeOff(animal);
        // Let go just past the edge of the plan (easy near the top): it stays at the edge,
        // where it was shown, rather than jumping back to where it started.
        if (shown.kind === "animal") placeAt(animal, { x: shown.x, y: shown.y });
      } else if (within(planRef.current, e.clientX, e.clientY)) {
        const at = percentAt(rect, e.clientX, e.clientY);
        placeAt(animal, clampPoint(at.x, at.y));
      }
    } else if ((g.kind === "move" || g.kind === "resize") && shown.kind === "area") {
      saveArea(shown.area);
      setLive(`${shown.area.label} ${g.kind === "move" ? "moved" : "resized"}.`);
    } else if (g.kind === "draw" && shown.kind === "draw") {
      // A click, or a scribble too small to be a room, isn't an area.
      if (shown.rect.w >= AREA_MIN / 2 && shown.rect.h >= AREA_MIN / 2) addArea(shown.rect);
    }
  }

  function onCancel(e: PointerEvent<HTMLElement>) {
    const g = gesture.current;
    if (g && g.pointerId !== e.pointerId) return;
    gesture.current = null;
    stopFrame();
    setPreview(null);
  }

  /** A click that ends a drag isn't a click. */
  const clicked = (fn: () => void) => (e: { timeStamp: number }) => {
    if (e.timeStamp - dragEndedAt.current < 400) {
      dragEndedAt.current = -Infinity;
      return;
    }
    fn();
  };

  // Losing the pointer without letting go (the browser took it over, say) ends the drag
  // rather than leaving the animal stuck to a pointer that has gone.
  const handlers = { onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onCancel, onLostPointerCapture: onCancel };

  function nudgeAnimal(e: KeyboardEvent, p: Placement) {
    const step = ARROWS[e.key];
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      return takeOff(animals![p.animalId]);
    }
    if (!step || !layout) return;
    e.preventDefault();
    const by = e.shiftKey ? 5 : 1;
    const spot = clampPoint(p.x + step[0] * by, p.y + step[1] * by);
    send({ op: "place", animalId: p.animalId, layoutId: layout.id, ...spot }, `animal:${p.animalId}`);
  }

  function nudgeArea(e: KeyboardEvent, area: ShelterArea, resize: boolean) {
    const step = ARROWS[e.key];
    if (!step) return;
    e.preventDefault();
    const by = e.shiftKey ? 5 : 1;
    const next = resize
      ? clampArea({ ...area, w: area.w + step[0] * by, h: area.h + step[1] * by })
      : clampArea({ ...area, x: area.x + step[0] * by, y: area.y + step[1] * by });
    saveArea(next, `area:${area.id}`);
  }

  /* ---------- pieces ---------- */

  const menuAnimal = menu ? animals[menu.animalId] : undefined;
  const menuPlacement = menu ? placements.find((p) => p.animalId === menu.animalId) : undefined;
  const menuArea = menuPlacement ? areaAt(areas, menuPlacement.x, menuPlacement.y) : undefined;
  const sortedAreas = [...areas].sort((a, b) => a.label.localeCompare(b.label, "en-GB", { numeric: true }));
  const countIn = (area: ShelterArea) => shownPlacements.filter((p) => areaAt(shownAreas, p.x, p.y)?.id === area.id).length;

  const layoutList = (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Typography component="h2" variant="overline" color="text.secondary" sx={{ px: 1 }}>
        Layouts
      </Typography>
      <Stack component="ul" spacing={0.5} sx={{ listStyle: "none", m: 0, p: 0, mb: 1 }}>
        {layouts.map((l) => {
          const n = l.placements.filter((p) => animals[p.animalId] && atShelter(animals[p.animalId])).length;
          return (
            <li key={l.id}>
              <Button
                fullWidth
                color="inherit"
                aria-current={l.id === layout?.id ? "true" : undefined}
                onClick={() => choose(l.id)}
                sx={{
                  justifyContent: "space-between",
                  textAlign: "left",
                  bgcolor: l.id === layout?.id ? "action.selected" : undefined,
                  color: l.id === layout?.id ? "primary.main" : "text.primary",
                }}
              >
                <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
                  {l.main && <HomeOutlined sx={{ fontSize: 16, flexShrink: 0 }} titleAccess="Main shelter" />}
                  <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {l.name}
                  </Box>
                </Box>
                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1, flexShrink: 0 }}>
                  {n} {n === 1 ? "animal" : "animals"}
                  {l.public ? " · public" : ""}
                </Typography>
              </Button>
            </li>
          );
        })}
      </Stack>
      <Button size="small" variant="outlined" startIcon={<AddOutlined />} onClick={() => setNaming({ mode: "create", name: "" })}>
        New layout
      </Button>
    </Paper>
  );

  const tray = (
    <Paper
      ref={trayRef}
      variant="outlined"
      sx={{
        p: 1.5,
        borderStyle: preview?.kind === "animal" && preview.overTray ? "dashed" : "solid",
        borderColor: preview?.kind === "animal" && preview.overTray ? "primary.main" : "divider",
        bgcolor: preview?.kind === "animal" && preview.overTray ? "action.hover" : "background.paper",
      }}
    >
      <Typography component="h2" variant="overline" color="text.secondary" sx={{ px: 1 }}>
        Not placed{notPlaced.length > 0 ? ` (${notPlaced.length})` : ""}
      </Typography>
      {preview?.kind === "animal" && preview.overTray ? (
        <Typography variant="body2" color="primary" sx={{ px: 1, py: 2 }}>
          Drop here to take {animals[preview.animalId]?.name} off the plan.
        </Typography>
      ) : notPlaced.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 1, pb: 0.5 }}>
          {here.length === 0 ? "No animals are at the vet, recovering or ready for adoption right now." : "Every animal at the shelter is on a plan."}
        </Typography>
      ) : (
        <>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ px: 1, mb: 1 }}>
            {layout ? (mobile ? "Tap an animal to choose where it is." : "Drag an animal onto the plan, or click it to choose an area.") : "Create a layout first."}
          </Typography>
          <Stack component="ul" spacing={0.5} sx={{ listStyle: "none", m: 0, p: 0 }}>
            {notPlaced.map((a) => (
              <li key={a.id}>
                <Button
                  fullWidth
                  color="inherit"
                  disabled={!layout}
                  aria-haspopup="menu"
                  onPointerDown={(e) => layout && begin(e, { kind: "animal", from: "tray", animalId: a.id, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, origin: { x: 0, y: 0 }, moved: false })}
                  {...handlers}
                  onClick={(e) => {
                    const anchor = e.currentTarget;
                    clicked(() => setMenu({ anchor, animalId: a.id, placed: false }))(e);
                  }}
                  sx={{ justifyContent: "flex-start", gap: 1.25, py: 0.75, touchAction: "pan-y", cursor: layout ? "grab" : undefined, opacity: preview?.kind === "ghost" && preview.animalId === a.id ? 0.4 : 1 }}
                >
                  <AnimalAvatar animal={a} size={32} />
                  <Box component="span" sx={{ textAlign: "left", minWidth: 0 }}>
                    <Box component="span" sx={{ display: "block", fontWeight: 600 }}>
                      {a.name}
                    </Box>
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      {stageLabel(a.stage)}
                    </Typography>
                  </Box>
                </Button>
              </li>
            ))}
          </Stack>
        </>
      )}
    </Paper>
  );

  const others = (layout?.staff ?? []).filter((st) => st.userId !== me?.id);
  // Who's on duty at this place. On the main shelter it's the same check-in as "I'll be here" in the top bar.
  const duty = layout && (
    <Paper variant="outlined" component="section" aria-labelledby="on-duty-title" sx={{ p: 1.5 }}>
      <Typography id="on-duty-title" component="h2" variant="overline" color="text.secondary" sx={{ px: 1 }}>
        On duty today
      </Typography>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ px: 1, mt: -0.5, mb: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
        {layout.main && <HomeOutlined sx={{ fontSize: 14 }} aria-hidden />} At {layout.name}
        {layout.main && !/main shelter/i.test(layout.name) ? " (main shelter)" : ""}
      </Typography>
      <Box sx={{ px: 1, pb: 0.5 }}>
        {!myCheckIn ? (
          <>
            {others.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                No one is on duty today.
              </Typography>
            )}
            {checkedInElsewhere && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                You&apos;re on duty at {checkedInElsewhere.name}. Pressing this moves you here.
              </Typography>
            )}
            <Button variant="contained" size="small" onClick={() => checkIn()}>
              I&apos;ll be here
            </Button>
          </>
        ) : (
          <>
            <Typography variant="body2" sx={{ mb: 1 }}>
              You&apos;re on duty here today.{layout.public ? " Visitors can see you're here." : ""}
            </Typography>
            <Button variant="outlined" size="small" color="inherit" onClick={checkOut}>
              I&apos;ve left
            </Button>
          </>
        )}
        {others.length > 0 && (
          <Stack component="ul" spacing={0.75} sx={{ listStyle: "none", m: 0, p: 0, mt: 1.5 }}>
            {others.map((spot) => (
              <Box component="li" key={spot.userId} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <StaffFace name={spot.name} size={26} />
                <Typography variant="body2">{staffLine(spot)}</Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Box>
    </Paper>
  );

  const toolbar = layout && (
    <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}>
      {/* Phones: the name on its own line, the buttons under it. */}
      <Stack direction="row" sx={{ alignItems: "center", flex: 1, minWidth: 0, flexBasis: { xs: "100%", sm: "auto" } }}>
        <Typography variant="h1" component="h2" noWrap sx={{ fontSize: { xs: "1.25rem", sm: "1.4rem" } }}>
          {layout.name}
        </Typography>
        <Tooltip title="Rename the layout">
          <IconButton aria-label={`Rename ${layout.name}`} onClick={() => setNaming({ mode: "rename", name: layout.name })}>
            <EditOutlined fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete the layout">
          <IconButton aria-label={`Delete ${layout.name}`} onClick={() => setDeleting("layout")}>
            <DeleteOutlined fontSize="small" />
          </IconButton>
        </Tooltip>
        {/* The main shelter: the layout the top bar's "I'll be here" checks in at. Only one is. */}
        {layout.main ? (
          <Tooltip title="Main shelter: the I'll be here button at the top checks in here">
            <Box
              role="img"
              tabIndex={0}
              aria-label="Main shelter: the I'll be here button at the top checks in here"
              sx={{ display: "inline-flex", p: 1, color: "primary.main", borderRadius: "50%", "&:focus-visible": { outline: 2, outlineColor: "primary.main" } }}
            >
              <Home fontSize="small" />
            </Box>
          </Tooltip>
        ) : (
          <Tooltip title="Make this the main shelter">
            <IconButton
              aria-label={`Make ${layout.name} the main shelter`}
              onClick={() => {
                send({ op: "layout.main", layoutId: layout.id });
                setLive(`${layout.name} is now the main shelter. The I'll be here button at the top checks in here.`);
              }}
            >
              <HomeOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
      <Typography variant="caption" color="text.secondary" role="status" sx={{ minWidth: 56 }}>
        {saving ? "Saving…" : ""}
      </Typography>
      <Button
        variant={drawing ? "contained" : "outlined"}
        aria-pressed={drawing}
        startIcon={<HighlightAlt />}
        onClick={() => {
          setDrawing((d) => !d);
          setSelectedAreaId(null);
        }}
      >
        {drawing ? "Done drawing" : "Draw an area"}
      </Button>
      {/* One way at a time: while drawing, finish (Done drawing) before adding an area another way. */}
      <Button variant="outlined" startIcon={<AddOutlined />} onClick={addAreaWithoutDrawing} disabled={drawing}>
        Add area
      </Button>
      <Box sx={{ flexBasis: "100%", display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 1.5, rowGap: 0.5 }}>
        <FormControlLabel
          control={
            <Switch
              checked={layout.public}
              onChange={(e) => {
                send({ op: "layout.public", layoutId: layout.id, public: e.target.checked });
                setLive(e.target.checked ? `${layout.name} is now shown to visitors.` : `${layout.name} is now for staff only.`);
              }}
            />
          }
          label="Show to visitors"
        />
        <Typography variant="body2" color="text.secondary">
          {layout.public
            ? "Members and visitors who aren't signed in can see this layout on the Visit page, so they know where to find each animal."
            : layout.main
              ? "Only staff can see this layout, so visitors can't see who's on duty either. Turn this on for the main shelter."
              : "Only staff can see this layout. Leave foster homes private."}
        </Typography>
      </Box>
    </Stack>
  );

  const plan = layout && (
    <Box sx={{ overflowX: "auto", pb: 1, mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 } }}>
      <Box
        ref={planRef}
        role="region"
        aria-label={`Plan of ${layout.name}`}
        aria-describedby="shelter-plan-help"
        onPointerDown={(e) => {
          // Clicking empty ground puts the area away.
          if (e.target === e.currentTarget) setSelectedAreaId(null);
        }}
        sx={(t) => ({ ...planSurfaceSx(t), userSelect: "none" })}
      >
        {/* Big areas first, so a small one inside a big one (a pen in the yard) stays on top. */}
        {[...shownAreas]
          .sort((a, b) => b.w * b.h - a.w * a.h)
          .map((a) => (
            <AreaBox
              key={a.id}
              area={a}
              count={countIn(a)}
              selected={a.id === selectedAreaId}
              moving={preview?.kind === "area" && preview.area.id === a.id}
              onGrab={(e) => {
                // Selecting happens on click, not here: the area's panel appearing above the plan
                // would shift the plan under the pointer mid-drag.
                const origin = areas.find((x) => x.id === a.id)!;
                begin(e, { kind: "move", areaId: a.id, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, origin, moved: false });
              }}
              onResize={(e) => {
                const origin = areas.find((x) => x.id === a.id)!;
                begin(e, { kind: "resize", areaId: a.id, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, origin, moved: false });
              }}
              onSelect={clicked(() => {
                setSelectedAreaId(a.id);
                setDrawing(false);
              })}
              editing={editingAreaId === a.id}
              onEdit={() => {
                setSelectedAreaId(a.id);
                setEditingAreaId(a.id);
              }}
              onRename={(label) => {
                setEditingAreaId(null);
                const saved = areas.find((x) => x.id === a.id);
                if (saved && label !== saved.label) {
                  saveArea({ ...saved, label });
                  setLive(`Renamed to ${label}.`);
                }
              }}
              onCancelEdit={() => setEditingAreaId(null)}
              onDelete={() => {
                setSelectedAreaId(a.id);
                setDeleting("area");
              }}
              onKeyMove={(e) => nudgeArea(e, areas.find((x) => x.id === a.id)!, false)}
              onKeyResize={(e) => nudgeArea(e, areas.find((x) => x.id === a.id)!, true)}
              handlers={handlers}
            />
          ))}

        {shownPlacements.map((p) => {
          const a = animals[p.animalId];
          const dragging = preview?.kind === "animal" && preview.animalId === p.animalId;
          const area = areaAt(areas, p.x, p.y);
          return (
            <Box
              key={p.animalId}
              component="button"
              type="button"
              aria-haspopup="menu"
              aria-label={`${a.name}, ${a.sex}, ${stageLabel(a.stage)}, ${area ? `in ${area.label}` : "not in an area"}`}
              aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Delete"
              onPointerDown={(e: PointerEvent<HTMLElement>) =>
                begin(e, { kind: "animal", from: "plan", animalId: p.animalId, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, origin: { x: p.x, y: p.y }, moved: false })
              }
              {...handlers}
              onClick={(e: MouseEvent<HTMLElement>) => {
                const anchor = e.currentTarget;
                clicked(() => setMenu({ anchor, animalId: p.animalId, placed: true }))(e);
              }}
              onKeyDown={(e: KeyboardEvent) => nudgeAnimal(e, p)}
              sx={{
                ...markerSx,
                left: `${p.x}%`,
                top: `${p.y}%`,
                zIndex: dragging ? 4 : 3,
                cursor: dragging ? "grabbing" : "grab",
                touchAction: "none",
                opacity: dragging && preview.overTray ? 0.5 : 1,
              }}
            >
              <AnimalAvatar animal={a} size={MARKER_PHOTO} />
              <Box
                component="span"
                sx={markerNameSx(a.sex, dragging)}
              >
                {a.name}
              </Box>
            </Box>
          );
        })}

        {drawn && (
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              left: `${drawn.x}%`,
              top: `${drawn.y}%`,
              width: `${drawn.w}%`,
              height: `${drawn.h}%`,
              border: 2,
              borderStyle: "dashed",
              borderColor: "primary.main",
              borderRadius: 1.5,
              bgcolor: "action.hover",
              zIndex: 6,
            }}
          />
        )}

        {/* Draw mode: a layer over everything, so dragging anywhere draws instead of moving things. */}
        {drawing && (
          <Box
            aria-hidden
            onPointerDown={(e: PointerEvent<HTMLElement>) =>
              begin(e, { kind: "draw", pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false })
            }
            {...handlers}
            sx={{ position: "absolute", inset: 0, zIndex: 5, cursor: "crosshair", touchAction: "none" }}
          />
        )}

        {areas.length === 0 && placements.length === 0 && !drawn && (
          <Stack spacing={1.5} sx={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", p: 3, textAlign: "center", pointerEvents: "none", zIndex: 6 }}>
            <Typography color="text.secondary" sx={{ maxWidth: 420 }}>
              {drawing
                ? "Drag on the plan to draw an area. Press Done drawing (or Esc) when you've finished."
                : "Sketch the place: press Draw an area, then drag out the kennels, rooms and the yard. It only needs to be rough."}
            </Typography>
            {!drawing && (
              <Button variant="outlined" startIcon={<AutoAwesomeMosaicOutlined />} sx={{ pointerEvents: "auto" }} onClick={() => startExample(layout.id)}>
                Start from an example
              </Button>
            )}
          </Stack>
        )}
      </Box>
      <MarkerKey />
      <Typography id="shelter-plan-help" variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
        {drawing
          ? "Drag on the plan to draw each area. Press Esc to stop."
          : mobile
            ? "Scroll sideways to see the whole plan. Drag animals and areas to move them, or tap an animal to choose its area or open its details."
            : "Drag animals and areas to move them; drag an area's corner to resize it. With the keyboard, use the arrow keys (Shift for bigger steps). Click an animal to choose its area or open its details."}
      </Typography>
    </Box>
  );

  return (
    <Box
      // Without this, grabbing an animal's photo can start the browser's own image drag,
      // which swallows the gesture and leaves the page stuck until it finishes.
      onDragStart={(e) => e.preventDefault()}
      sx={{ px: { xs: 2, sm: 2.5 }, py: 2, flex: 1, "& img": { WebkitUserDrag: "none", userSelect: "none" } }}
    >
      <p role="status" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
        {live}
      </p>
      {error && (
        <Alert severity="error" onClose={clearError} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {layouts.length === 0 ? (
        <Paper variant="outlined" sx={{ p: { xs: 3, sm: 5 }, maxWidth: 640, mx: "auto", textAlign: "center" }}>
          <Typography variant="h1" component="h2" sx={{ mb: 1 }}>
            Shelter layouts
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Draw a rough plan of each place the animals stay (the shelter, a foster home) and drag each animal to where it is, so
            everyone knows who&apos;s in which kennel.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: "center" }}>
            <Button
              variant="contained"
              startIcon={<AutoAwesomeMosaicOutlined />}
              onClick={() => {
                const id = crypto.randomUUID();
                send({ op: "layout.create", id, name: "Main shelter" });
                startExample(id);
                choose(id);
              }}
            >
              Start from an example
            </Button>
            <Button variant="outlined" startIcon={<AddOutlined />} onClick={() => setNaming({ mode: "create", name: "Main shelter" })}>
              Start with a blank plan
            </Button>
          </Stack>
        </Paper>
      ) : mobile ? (
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <TextField select size="small" label="Layout" value={layout?.id ?? ""} onChange={(e) => choose(e.target.value)} sx={{ flex: 1 }}>
              {layouts.map((l) => (
                <MenuItem key={l.id} value={l.id}>
                  {l.name}
                </MenuItem>
              ))}
            </TextField>
            <Button variant="outlined" startIcon={<AddOutlined />} onClick={() => setNaming({ mode: "create", name: "" })}>
              New
            </Button>
          </Stack>
          {toolbar}
          {plan}
          {duty}
          {tray}
        </Stack>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: "260px minmax(0, 1fr)", gap: 2.5, alignItems: "start" }}>
          <Stack spacing={2} sx={{ position: "sticky", top: 80 }}>
            {layoutList}
            {duty}
            {tray}
          </Stack>
          <Stack spacing={1.5}>
            {toolbar}
              {plan}
          </Stack>
        </Box>
      )}

      {/* While dragging from the list: the animal follows the pointer. */}
      {preview?.kind === "ghost" && animals[preview.animalId] && (
        <Paper
          aria-hidden
          elevation={8}
          sx={{ position: "fixed", left: preview.clientX, top: preview.clientY, transform: "translate(-50%, -50%)", zIndex: "tooltip", pointerEvents: "none", p: 0.75, display: "flex", alignItems: "center", gap: 1, borderRadius: 2 }}
        >
          <AnimalAvatar animal={animals[preview.animalId]} size={28} />
          <Typography variant="body2" sx={{ fontWeight: 600, pr: 0.5 }}>
            {animals[preview.animalId].name}
          </Typography>
        </Paper>
      )}

      {/* Closes at once: while a menu fades out, its invisible backdrop still covers the plan,
          so grabbing an animal straight after closing it did nothing (and selected text). */}
      <Menu anchorEl={menu?.anchor} open={!!menu && !!menuAnimal} onClose={() => setMenu(null)} transitionDuration={{ enter: 150, exit: 0 }}>
        {menuAnimal && [
          <MenuItem
            key="open"
            onClick={() => {
              useBoard.getState().openAnimal(menuAnimal.id);
              setMenu(null);
            }}
          >
            <ListItemIcon>
              <InfoOutlined fontSize="small" />
            </ListItemIcon>
            <ListItemText>Open {menuAnimal.name}&apos;s details</ListItemText>
          </MenuItem>,
          <Divider key="d1" />,
          <ListSubheader key="sub" sx={{ lineHeight: "32px" }}>
            {menu?.placed ? "Move to" : "Put in"}
          </ListSubheader>,
          ...sortedAreas.map((a) => (
            <MenuItem
              key={a.id}
              selected={menuArea?.id === a.id}
              onClick={() => {
                if (menuArea?.id !== a.id) putIn(menuAnimal, a);
                setMenu(null);
              }}
            >
              <ListItemIcon>{menuArea?.id === a.id ? <CheckOutlined fontSize="small" /> : null}</ListItemIcon>
              <ListItemText>{a.label}</ListItemText>
            </MenuItem>
          )),
          !menu?.placed && (
            <MenuItem
              key="plan"
              onClick={() => {
                putIn(menuAnimal, null);
                setMenu(null);
              }}
            >
              <ListItemIcon />
              <ListItemText>{areas.length > 0 ? "On the plan, not in an area" : "On the plan"}</ListItemText>
            </MenuItem>
          ),
          menu?.placed && <Divider key="d2" />,
          menu?.placed && (
            <MenuItem
              key="off"
              onClick={() => {
                takeOff(menuAnimal);
                setMenu(null);
              }}
            >
              <ListItemIcon>
                <RemoveCircleOutlined fontSize="small" />
              </ListItemIcon>
              <ListItemText>Take off the plan</ListItemText>
            </MenuItem>
          ),
        ]}
      </Menu>

      <NameDialog
        open={!!naming}
        title={naming?.mode === "rename" ? "Rename the layout" : "New layout"}
        initial={naming?.name ?? ""}
        submitLabel={naming?.mode === "rename" ? "Save" : "Create"}
        onClose={() => setNaming(null)}
        onSubmit={(name) => {
          if (naming?.mode === "rename" && layout) send({ op: "layout.rename", layoutId: layout.id, name });
          else {
            const id = crypto.randomUUID();
            send({ op: "layout.create", id, name });
            choose(id);
          }
          setNaming(null);
        }}
      />

      <Dialog open={!!deleting} onClose={() => setDeleting(null)}>
        <DialogTitle>{deleting === "layout" ? `Delete ${layout?.name}?` : `Delete ${selectedArea?.label}?`}</DialogTitle>
        <DialogContent>
          <Typography>
            {deleting === "layout"
              ? "Its areas are deleted, and its animals go back to Not placed. The animals themselves aren't changed."
              : "The animals in it stay where they are on the plan, just not in an area."}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              if (deleting === "layout" && layout) {
                send({ op: "layout.delete", layoutId: layout.id });
                setLive(`${layout.name} deleted.`);
              } else if (deleting === "area" && layout && selectedArea) {
                send({ op: "area.delete", layoutId: layout.id, areaId: selectedArea.id });
                setSelectedAreaId(null);
                setLive(`${selectedArea.label} deleted.`);
              }
              setDeleting(null);
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/** One area on the plan: its name (grab it to move the area) and, once selected, a corner to resize it. */
function AreaBox({
  area,
  count,
  selected,
  moving,
  editing,
  onGrab,
  onResize,
  onSelect,
  onEdit,
  onRename,
  onCancelEdit,
  onDelete,
  onKeyMove,
  onKeyResize,
  handlers,
}: {
  area: ShelterArea;
  count: number;
  selected: boolean;
  moving: boolean;
  editing: boolean;
  onGrab: (e: PointerEvent<HTMLElement>) => void;
  onResize: (e: PointerEvent<HTMLElement>) => void;
  onSelect: (e: MouseEvent) => void;
  onEdit: () => void;
  onRename: (label: string) => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onKeyMove: (e: KeyboardEvent) => void;
  onKeyResize: (e: KeyboardEvent) => void;
  handlers: Record<string, (e: PointerEvent<HTMLElement>) => void>;
}) {
  return (
    <Box
      sx={(t) => ({
        position: "absolute",
        left: `${area.x}%`,
        top: `${area.y}%`,
        width: `${area.w}%`,
        height: `${area.h}%`,
        zIndex: selected ? 2 : 1,
        ...areaFillSx(t, selected),
        boxShadow: moving ? 4 : "none",
        pointerEvents: "none",
      })}
    >
      {editing ? (
        <AreaNameInput area={area} onDone={onRename} onCancel={onCancelEdit} />
      ) : (
        <Box sx={{ position: "absolute", left: 0, top: 0, maxWidth: "100%", display: "flex", alignItems: "flex-start" }}>
          <Box
            component="button"
            type="button"
            aria-pressed={selected}
            aria-label={`${area.label}, ${count} ${count === 1 ? "animal" : "animals"}. Arrow keys move it.`}
            aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
            onPointerDown={onGrab}
            {...handlers}
            onClick={onSelect}
            onDoubleClick={onEdit}
            onKeyDown={onKeyMove}
            sx={{
              pointerEvents: "auto",
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              px: 1,
              py: 0.25,
              border: 0,
              borderBottomRightRadius: 8,
              borderTopLeftRadius: 6,
              bgcolor: selected ? "primary.main" : "rgba(60, 116, 47, 0.14)",
              color: selected ? "primary.contrastText" : "text.primary",
              font: "inherit",
              fontSize: 13,
              fontWeight: 650,
              cursor: moving ? "grabbing" : "grab",
              touchAction: "none",
              whiteSpace: "nowrap",
              overflow: "hidden",
              "&:focus-visible": { outline: 2, outlineColor: "primary.main", outlineOffset: 2 },
            }}
          >
            <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
              {area.label}
            </Box>
            {count > 0 && (
              <Box component="span" aria-hidden sx={{ opacity: 0.75, fontWeight: 500 }}>
                {count}
              </Box>
            )}
          </Box>
          {/* Once selected: rename (or double-click the name) and delete, right here on the plan. */}
          {selected && (
            <Stack direction="row" sx={{ pointerEvents: "auto", ml: 0.25, bgcolor: "background.paper", borderRadius: 1, boxShadow: 1 }}>
              <Tooltip title="Rename">
                <IconButton size="small" aria-label={`Rename ${area.label}`} onClick={onEdit} sx={{ p: 0.25 }}>
                  <EditOutlined sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton size="small" aria-label={`Delete ${area.label}`} onClick={onDelete} sx={{ p: 0.25 }}>
                  <DeleteOutlined sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          )}
        </Box>
      )}
      {selected && (
        <Box
          component="button"
          type="button"
          aria-label={`Resize ${area.label}. Arrow keys make it bigger or smaller.`}
          aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
          onPointerDown={onResize}
          {...handlers}
          onKeyDown={onKeyResize}
          sx={{
            pointerEvents: "auto",
            position: "absolute",
            right: -10,
            bottom: -10,
            width: 22,
            height: 22,
            p: 0,
            borderRadius: "50%",
            border: 2,
            borderColor: "background.paper",
            bgcolor: "primary.main",
            cursor: "nwse-resize",
            touchAction: "none",
            // A bigger target for fingers than what's drawn.
            "&::before": { content: '""', position: "absolute", inset: -10 },
            "&:focus-visible": { outline: 2, outlineColor: "primary.main", outlineOffset: 2 },
          }}
        />
      )}
    </Box>
  );
}

/** Typing an area's name on the plan: Enter or clicking away saves, Esc puts the old name back. */
function AreaNameInput({ area, onDone, onCancel }: { area: ShelterArea; onDone: (label: string) => void; onCancel: () => void }) {
  const [label, setLabel] = useState(area.label);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = () => {
    const trimmed = label.trim();
    if (trimmed) onDone(trimmed);
    else onCancel();
  };
  return (
    <Box
      component="input"
      ref={ref}
      aria-label="Area name"
      value={label}
      maxLength={AREA_LABEL_MAX}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLabel(e.target.value)}
      onBlur={finish}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === "Enter") {
          e.preventDefault();
          finish();
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
      onPointerDown={(e: PointerEvent) => e.stopPropagation()}
      sx={{
        pointerEvents: "auto",
        position: "absolute",
        left: 0,
        top: 0,
        width: "min(100%, 180px)",
        px: 1,
        py: 0.25,
        border: 2,
        borderColor: "primary.main",
        borderRadius: 1,
        bgcolor: "background.paper",
        color: "text.primary",
        font: "inherit",
        fontSize: 13,
        fontWeight: 650,
        outline: "none",
      }}
    />
  );
}

function NameDialog({
  open,
  title,
  initial,
  submitLabel,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initial: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initial);
  const [shownFor, setShownFor] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  // Each time it opens, start from the name it was given.
  const key = open ? `${title}:${initial}` : null;
  if (key !== shownFor) {
    setShownFor(key);
    setName(initial);
    setTried(false);
  }
  const trimmed = name.trim();
  const problem: ReactNode = !trimmed ? "Give the layout a name." : null;
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setTried(true);
          if (!problem) onSubmit(trimmed);
        }}
      >
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Name"
            placeholder="Main shelter, Sara's foster home…"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, LAYOUT_NAME_MAX))}
            error={tried && !!problem}
            helperText={tried ? problem : undefined}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">
            {submitLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

/**
 * The Shelter page before it can be used: the same shape as the editor, with
 * the plan greyed out under a message, so nobody tries to drag before it works.
 */
function EditorLoading({ mobile, error }: { mobile: boolean; error: string | null }) {
  const plan = (
    <Box sx={{ overflowX: "auto", pb: 1, mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 } }}>
      <Box sx={(t) => planSurfaceSx(t)}>
        <Stack
          role={error ? "alert" : "status"}
          spacing={1.5}
          sx={(t) => ({
            position: "absolute",
            inset: 0,
            alignItems: "center",
            justifyContent: "center",
            p: 3,
            textAlign: "center",
            bgcolor: "rgba(255, 255, 255, 0.55)",
            ...(error ? null : { cursor: "progress" }),
            ...t.applyStyles("dark", { bgcolor: "rgba(0, 0, 0, 0.3)" }),
          })}
        >
          {error ? (
            <>
              <Typography sx={{ maxWidth: 420 }}>Couldn&apos;t load the layout. {error}</Typography>
              <Button variant="outlined" onClick={() => void useShelterStore.getState().load()}>
                Try again
              </Button>
            </>
          ) : (
            <>
              <CircularProgress size={32} aria-hidden />
              <Typography sx={{ fontWeight: 600 }}>Getting the layout ready…</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
                You can drag animals and areas as soon as it&apos;s loaded.
              </Typography>
            </>
          )}
        </Stack>
      </Box>
    </Box>
  );
  const toolbar = <Skeleton variant="text" width={220} sx={{ fontSize: "1.6rem" }} />;
  const panel = (lines: number) => (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Skeleton variant="text" width={90} />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} variant="text" width={`${85 - i * 12}%`} />
      ))}
    </Paper>
  );
  return (
    <Box sx={{ px: { xs: 2, sm: 2.5 }, py: 2, flex: 1 }} aria-busy={!error}>
      {mobile ? (
        <Stack spacing={2}>
          <Skeleton variant="rounded" height={40} />
          {toolbar}
          {plan}
        </Stack>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: "260px minmax(0, 1fr)", gap: 2.5, alignItems: "start" }}>
          <Stack spacing={2}>
            {panel(2)}
            {panel(3)}
            {panel(3)}
          </Stack>
          <Stack spacing={1.5}>
            {toolbar}
            {plan}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
