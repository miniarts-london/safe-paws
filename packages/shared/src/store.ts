"use client";

import { create } from "zustand";
import { isStaff, type Board, type BoardPatch, type Columns, type Member, type Notification, type StageId, type User } from "./protocol";

export type Toast = { key: number; notification: Notification };

type BoardStore = {
  me: string | null;
  users: User[];
  board: Board | null;
  notifications: Notification[];
  /** Coordinators only: everyone who signed up. Empty for everyone else. */
  members: Member[];
  toasts: Toast[];
  /** Animal shown in the side panel. */
  openAnimalId: string | null;
  /** Coordinators: the offer shown after clicking its notification (who, how to reach them, which animal). */
  openOffer: { animalId: string; userId: string } | null;
  error: string | null;

  welcome: (userId: string, users: User[], board: Board, notifications: Notification[]) => void;
  applyPatch: (patch: BoardPatch) => void;
  upsertUser: (user: User) => void;
  setMembers: (members: Member[]) => void;
  /** Local-only column change while a card is being dragged. The server's patch settles it. */
  setColumns: (columns: Columns) => void;
  receive: (n: Notification) => void;
  markRead: (ids: number[] | "all") => void;
  dismissToast: (key: number) => void;
  openAnimal: (id: string | null) => void;
  showOffer: (offer: { animalId: string; userId: string } | null) => void;
  setError: (message: string | null) => void;
};

let toastSeq = 0;

export const useBoard = create<BoardStore>((set, get) => ({
  me: null,
  users: [],
  board: null,
  notifications: [],
  members: [],
  toasts: [],
  openAnimalId: null,
  openOffer: null,
  error: null,

  welcome: (me, users, board, notifications) => set({ me, users, board, notifications, error: null }),

  applyPatch: (patch) => {
    const board = get().board;
    // Patches are versioned; anything older than what we have is already reflected.
    if (!board || patch.version <= board.version) return;
    const animals = { ...board.animals };
    for (const a of patch.animals) animals[a.id] = a;
    const removed = new Set(patch.removed ?? []);
    for (const id of removed) delete animals[id];
    set({
      board: { version: patch.version, columns: { ...board.columns, ...patch.columns }, animals },
      // The server deleted these with the animal; drop them here too, and close its panel if it was open.
      ...(removed.size > 0 && {
        notifications: get().notifications.filter((n) => !removed.has(n.animalId)),
        openAnimalId: removed.has(get().openAnimalId ?? "") ? null : get().openAnimalId,
      }),
    });
  },

  upsertUser: (user) => {
    const users = get().users;
    set({ users: users.some((u) => u.id === user.id) ? users.map((u) => (u.id === user.id ? user : u)) : [...users, user] });
  },

  setMembers: (members) => set({ members }),

  setColumns: (columns) => {
    const board = get().board;
    if (board) set({ board: { ...board, columns } });
  },

  receive: (n) => {
    if (n.userId !== get().me || get().notifications.some((x) => x.id === n.id)) return;
    set({
      notifications: [n, ...get().notifications].slice(0, 50),
      toasts: [...get().toasts, { key: ++toastSeq, notification: n }].slice(-3),
    });
  },

  markRead: (ids) =>
    set({
      notifications: get().notifications.map((n) => (ids === "all" || ids.includes(n.id) ? { ...n, read: true } : n)),
    }),

  dismissToast: (key) => set({ toasts: get().toasts.filter((t) => t.key !== key) }),
  openAnimal: (id) => set({ openAnimalId: id }),
  showOffer: (openOffer) => set({ openOffer }),
  setError: (error) => set({ error }),
}));

/** The signed-in person, or undefined before the first snapshot. */
export const useMe = () => useBoard((s) => s.users.find((u) => u.id === s.me));

/** Staff can change the board; members can look and follow. The server enforces the same rule. */
/** Where a notification leads: an offer to help opens the offer; everything else opens the animal. */
export function openNotification(n: Notification) {
  const s = useBoard.getState();
  if (n.kind === "request") s.showOffer({ animalId: n.animalId, userId: n.actorId });
  else s.openAnimal(n.animalId);
}

export const useIsCoordinator = () => useBoard((s) => s.users.find((u) => u.id === s.me)?.role === "coordinator");
export const useCanEdit = () => useBoard((s) => isStaff(s.users.find((u) => u.id === s.me)?.role));

export const findStage = (columns: Columns, animalId: string): StageId | undefined =>
  (Object.keys(columns) as StageId[]).find((s) => columns[s].includes(animalId));
