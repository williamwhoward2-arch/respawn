import type { BodyPart, WorkoutSet } from "./types";

export function parseNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;

  const cleaned = String(value).replace(/[^\d.]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function estimate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return Math.round(weight * (1 + reps / 30));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function daysBetween(a: Date, b: Date): number {
  const ms = Math.abs(a.getTime() - b.getTime());
  return ms / (1000 * 60 * 60 * 24);
}

export function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return "Not tracked";

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function normalizeBodyPart(value?: string | null): BodyPart {
  const v = String(value ?? "").trim().toLowerCase();

  if (!v) return "unknown";
  if (["chest"].includes(v)) return "chest";
  if (["back", "lats"].includes(v)) return "back";
  if (["legs", "quads", "hamstrings", "glutes", "calves", "lower"].includes(v)) return "legs";
  if (["shoulders", "delts"].includes(v)) return "shoulders";
  if (["arms", "biceps", "triceps", "forearms"].includes(v)) return "arms";
  if (["push"].includes(v)) return "push";
  if (["pull"].includes(v)) return "pull";
  if (["upper"].includes(v)) return "upper";
  if (["lower"].includes(v)) return "lower";
  if (["full_body", "full body"].includes(v)) return "full_body";

  return "unknown";
}

export function getExerciseBodyPart(set: WorkoutSet): BodyPart {
  if (set.bodyPart) return normalizeBodyPart(set.bodyPart);

  const name = String(set.exerciseName ?? "").toLowerCase();

  if (name.includes("bench") || name.includes("fly")) return "chest";

  if (
    name.includes("row") ||
    name.includes("pulldown") ||
    name.includes("pull up") ||
    name.includes("pull-up")
  ) {
    return "back";
  }

  if (
    name.includes("squat") ||
    name.includes("leg press") ||
    name.includes("leg extension") ||
    name.includes("rdl") ||
    name.includes("deadlift") ||
    name.includes("hamstring curl") ||
    name.includes("glute")
  ) {
    return "legs";
  }

  if (
    name.includes("shoulder press") ||
    name.includes("overhead press") ||
    name.includes("lateral raise") ||
    name.includes("rear delt")
  ) {
    return "shoulders";
  }

  if (
    name.includes("curl") ||
    name.includes("tricep") ||
    name.includes("pushdown") ||
    name.includes("skull")
  ) {
    return "arms";
  }

  return "unknown";
}

export function isSetCompleted(set: WorkoutSet): boolean {
  if (typeof set.completed === "boolean") return set.completed;

  const reps = parseNumber(set.reps);
  const weight = parseNumber(set.weight);

  return reps > 0 || weight > 0;
}

export function uniqStrings(values: string[]): string[] {
  return [...new Set(values)];
}