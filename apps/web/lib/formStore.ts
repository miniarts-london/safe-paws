"use client";

import { create } from "zustand";

/** Which register / edit form is open. Lives outside components so the board, drawer and phone layout can all open it. */
type FormState = {
  form: null | { mode: "create" } | { mode: "edit"; animalId: string };
  openCreate: () => void;
  openEdit: (animalId: string) => void;
  close: () => void;
};

export const useAnimalForm = create<FormState>((set) => ({
  form: null,
  openCreate: () => set({ form: { mode: "create" } }),
  openEdit: (animalId) => set({ form: { mode: "edit", animalId } }),
  close: () => set({ form: null }),
}));
