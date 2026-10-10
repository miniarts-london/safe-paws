"use client";

import { create } from "zustand";

/** Which register / edit form is open. Lives outside components so the board, drawer and phone layout can all open it. */
type FormState = {
  form: null | { mode: "create" } | { mode: "edit"; animalId: string };
  openCreate: () => void;
  openEdit: (animalId: string) => void;
  close: () => void;
  /** Confirmation once the board has the change, e.g. "Max is on the board, at the top of Reported." */
  notice: string | null;
  setNotice: (message: string | null) => void;
};

export const useAnimalForm = create<FormState>((set) => ({
  form: null,
  openCreate: () => set({ form: { mode: "create" } }),
  openEdit: (animalId) => set({ form: { mode: "edit", animalId } }),
  close: () => set({ form: null }),
  notice: null,
  setNotice: (notice) => set({ notice }),
}));
