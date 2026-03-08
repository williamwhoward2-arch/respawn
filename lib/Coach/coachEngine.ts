import type {
  InternalCoachSummary,
  RecoverySnapshot,
  UserFacingCoachSummary,
  UserFacingRecovery,
  UserProfile,
  Workout,
  WorkoutSet,
} from "./types";
import { buildBalanceSnapshot } from "./balance";
import { buildHistorySummary } from "./history";
import { buildRecoverySnapshot } from "./recovery";
import { buildStrengthSnapshots } from "./strength";
import { buildWorkoutRecommendation } from "./workoutRecommendation";

function calculateMomentumScore(workouts: Workout[], strengthTrendUpCount: number): number {
  let score = 40;

  const last14 = workouts.filter((w) => {
    const days = (Date.now() - new Date(w.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return days <= 14;
  }).length;

  score += Math.min(last14 * 6, 30);
  score += Math.min(strengthTrendUpCount * 5, 20);

  return Math.max(0, Math.min(score, 100));
}

function calculateConsistencyScore(workouts: Workout[]): number {
  const last30 = workouts.filter((w) => {
    const days = (Date.now() - new Date(w.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return days <= 30;
  }).length;

  const score = Math.min(last30 * 4, 100);
  return Math.max(0, Math.min(score, 100));
}

function buildCoachHighlights(args: {
  recovery: RecoverySnapshot;
  recommendationReason: string;
  strengthUpCount: number;
  historySummary: ReturnType<typeof buildHistorySummary>;
}): string[] {
  const highlights: string[] = [];

  highlights.push(args.recommendationReason);

  if (args.strengthUpCount >= 2) {
    highlights.push("Multiple lifts are trending in the right direction.");
  }

  if (args.historySummary.workoutsLast7Days >= 4) {
    highlights.push("Your consistency this week is building real momentum.");
  }

  if ((args.historySummary.daysSinceLastWorkout ?? 0) >= 4) {
    highlights.push("You should be fresh enough to train with intent today.");
  }

  return highlights.slice(0, 3);
}

export function toUserFacingRecovery(recovery: RecoverySnapshot): UserFacingRecovery {
  if (recovery.readinessScore >= 75) {
    return {
      status: "ready_to_push",
      message: "You’re in a strong spot to push training today.",
    };
  }

  if (recovery.readinessScore >= 50) {
    return {
      status: "balanced",
      message: "You’re good to train today, but smart volume will beat unnecessary fatigue.",
    };
  }

  return {
    status: "pull_back_a_bit",
    message: "You’ve built up some fatigue lately, so today should stay efficient and controlled.",
  };
}

function toMomentumLabel(score: number): "building" | "steady" | "hot" {
  if (score >= 75) return "hot";
  if (score >= 50) return "steady";
  return "building";
}

function toConsistencyLabel(score: number): "starting" | "solid" | "locked_in" {
  if (score >= 75) return "locked_in";
  if (score >= 45) return "solid";
  return "starting";
}

export function buildCoachSummary(input: {
  profile: UserProfile;
  workouts: Workout[];
  sets: WorkoutSet[];
}): InternalCoachSummary {
  const strength = buildStrengthSnapshots(input.sets);
  const recovery = buildRecoverySnapshot(input.workouts, input.sets);
  const balance = buildBalanceSnapshot(input.sets);
  const historySummary = buildHistorySummary(input.workouts, input.sets);

  const recommendation = buildWorkoutRecommendation({
    profile: input.profile,
    workouts: input.workouts,
    sets: input.sets,
    recovery,
    balance,
    strength,
  });

  const strengthUpCount = strength.filter((s) => s.trend === "up").length;
  const momentumScore = calculateMomentumScore(input.workouts, strengthUpCount);
  const consistencyScore = calculateConsistencyScore(input.workouts);

  const highlights = buildCoachHighlights({
    recovery,
    recommendationReason: recommendation.reason,
    strengthUpCount,
    historySummary,
  });

  return {
    profile: input.profile,
    strength,
    recovery,
    balance,
    recommendation,
    momentumScore,
    consistencyScore,
    highlights,
  };
}

export function toUserFacingCoachSummary(summary: InternalCoachSummary): UserFacingCoachSummary {
  return {
    recommendation: summary.recommendation,
    recovery: toUserFacingRecovery(summary.recovery),
    highlights: summary.highlights,
    momentumLabel: toMomentumLabel(summary.momentumScore),
    consistencyLabel: toConsistencyLabel(summary.consistencyScore),
  };
}