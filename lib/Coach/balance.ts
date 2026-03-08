import type { BalanceSnapshot, BodyPart, WorkoutSet } from "./types";
import { daysBetween, getExerciseBodyPart, isSetCompleted } from "./utils";

const TRACKED_BODY_PARTS: BodyPart[] = ["chest", "back", "legs", "shoulders", "arms"];

export function buildBalanceSnapshot(sets: WorkoutSet[]): BalanceSnapshot {
  const now = new Date();
  const weeklySets = sets.filter((s) => daysBetween(now, new Date(s.createdAt)) <= 7 && isSetCompleted(s));

  const weeklySetsByBodyPart = weeklySets.reduce<Record<string, number>>((acc, set) => {
    const bodyPart = getExerciseBodyPart(set);
    acc[bodyPart] = (acc[bodyPart] ?? 0) + 1;
    return acc;
  }, {});

  const trackedCounts = TRACKED_BODY_PARTS.map((bp) => weeklySetsByBodyPart[bp] ?? 0);
  const average = trackedCounts.length
    ? trackedCounts.reduce((sum, count) => sum + count, 0) / trackedCounts.length
    : 0;

  const undertrainedBodyParts = TRACKED_BODY_PARTS.filter(
    (bp) => (weeklySetsByBodyPart[bp] ?? 0) < Math.max(average - 3, 2)
  );

  const overtrainedBodyParts = TRACKED_BODY_PARTS.filter(
    (bp) => (weeklySetsByBodyPart[bp] ?? 0) > average + 4
  );

  const pushSets =
    (weeklySetsByBodyPart["chest"] ?? 0) +
    (weeklySetsByBodyPart["shoulders"] ?? 0) +
    (weeklySetsByBodyPart["arms"] ?? 0);

  const pullSets = (weeklySetsByBodyPart["back"] ?? 0) + Math.floor((weeklySetsByBodyPart["arms"] ?? 0) / 2);

  let pushPullBalance: "balanced" | "push_bias" | "pull_bias" = "balanced";
  if (pushSets > pullSets + 4) pushPullBalance = "push_bias";
  if (pullSets > pushSets + 4) pushPullBalance = "pull_bias";

  const quadBiasSignals = weeklySets.filter((s) => {
    const name = String(s.exerciseName ?? "").toLowerCase();
    return name.includes("squat") || name.includes("leg extension") || name.includes("leg press");
  }).length;

  const hamGluteSignals = weeklySets.filter((s) => {
    const name = String(s.exerciseName ?? "").toLowerCase();
    return (
      name.includes("rdl") ||
      name.includes("deadlift") ||
      name.includes("hamstring curl") ||
      name.includes("glute")
    );
  }).length;

  let lowerBalance: "balanced" | "quad_bias" | "ham_glute_bias" = "balanced";
  if (quadBiasSignals > hamGluteSignals + 3) lowerBalance = "quad_bias";
  if (hamGluteSignals > quadBiasSignals + 3) lowerBalance = "ham_glute_bias";

  return {
    weeklySetsByBodyPart,
    undertrainedBodyParts,
    overtrainedBodyParts,
    pushPullBalance,
    lowerBalance,
  };
}