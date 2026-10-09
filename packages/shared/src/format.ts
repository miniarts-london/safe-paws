import type { Age, Animal, Neutered } from "./protocol";

/** "~2 years", "8 weeks", "1 month". */
export function formatAge({ value, unit, estimated }: Age) {
  const singular = value === 1 ? unit.slice(0, -1) : unit;
  return `${estimated ? "~" : ""}${value} ${singular}`;
}

export function formatWeight(kg: number | null) {
  return kg === null ? null : `${Number.isInteger(kg) ? kg : kg.toFixed(1)} kg`;
}

export const NEUTERED_LABEL: Record<Neutered, string> = {
  yes: "Neutered",
  no: "Not neutered",
  unknown: "Neutered: not sure",
};

/** One line under an animal's name: "Dog · female · ~2 years · 14 kg". */
export function animalFacts(a: Animal) {
  return [a.species === "dog" ? "Dog" : "Cat", a.sex, formatAge(a.age), formatWeight(a.weightKg)].filter(Boolean).join(" · ");
}

export const photos = (a: Animal) => a.media.filter((m) => m.kind === "photo");
