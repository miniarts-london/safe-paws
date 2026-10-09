import { STAGE_IDS, type Role, type StageId } from "./protocol";

/** Each role opens on the stage where they're most likely needed. */
export const HOME_STAGE: Record<Role, StageId> = {
  coordinator: "reported",
  vet: "vet",
  fosterer: "recovering",
  sponsor: "ready",
  member: "ready",
};

/** Button wording for moving forward into each stage, phrased as the action a volunteer is taking. */
export const NEXT_ACTION: Record<StageId, string> = {
  reported: "Mark as reported",
  vet: "Send to the vet",
  recovering: "Move to recovery",
  ready: "Mark ready for adoption",
  adopted: "Mark as adopted",
};

export const nextStage = (s: StageId): StageId | null => STAGE_IDS[STAGE_IDS.indexOf(s) + 1] ?? null;
