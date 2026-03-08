import type {
  BalanceSnapshot,
  CoachRecommendation,
  RecoverySnapshot,
  StrengthSnapshot,
  UserProfile,
  Workout,
  WorkoutSet,
} from "./types";
import { buildHistorySummary } from "./history";

export function buildWorkoutRecommendation(args: {
  profile: UserProfile;
  workouts: Workout[];
  sets: WorkoutSet[];
  recovery: RecoverySnapshot;
  balance: BalanceSnapshot;
  strength: StrengthSnapshot[];
}): CoachRecommendation {
  const { profile, workouts, sets, recovery, balance } = args;
  const history = buildHistorySummary(workouts, sets);

  if (workouts.length === 0) {
    return {
      recommendedBodyPart: "full_body",
      recommendedStyle: "reentry",
      reason: "No workout history yet, so a balanced full-body start makes the most sense.",
      confidence: 95,
    };
  }

  if ((history.daysSinceLastWorkout ?? 0) >= 5) {
    return {
      recommendedBodyPart: "full_body",
      recommendedStyle: "reentry",
      reason: "You have had a few days away from training, so a clean re-entry session is the smartest move.",
      confidence: 88,
    };
  }

  if (recovery.readinessScore < 45) {
    return {
      recommendedBodyPart: "upper",
      recommendedStyle: "recovery",
      reason: "Recent training fatigue is elevated, so a controlled upper-focused session fits better than a hard push day.",
      confidence: 85,
    };
  }

  if (balance.undertrainedBodyParts.includes("back")) {
    return {
      recommendedBodyPart: "back",
      recommendedStyle: profile.goal === "strength" ? "strength" : "hypertrophy",
      reason: "Back volume is lagging behind the rest of your week, so pulling work gets priority today.",
      confidence: 90,
    };
  }

  if (balance.undertrainedBodyParts.includes("legs")) {
    return {
      recommendedBodyPart: "legs",
      recommendedStyle: profile.goal === "strength" ? "strength" : "hypertrophy",
      reason: "Lower-body work is behind this week and recovery looks good enough to train it productively.",
      confidence: 87,
    };
  }

  if (balance.pushPullBalance === "push_bias") {
    return {
      recommendedBodyPart: "pull",
      recommendedStyle: "hypertrophy",
      reason: "Your recent training is push-heavy, so a pull-biased day helps rebalance the week.",
      confidence: 82,
    };
  }

  if (profile.goal === "strength") {
    return {
      recommendedBodyPart: "push",
      recommendedStyle: "strength",
      reason: "Recovery looks solid and your overall split is balanced enough to support a harder compound-focused day.",
      confidence: 74,
    };
  }

  return {
    recommendedBodyPart: "upper",
    recommendedStyle: "hypertrophy",
    reason: "Training balance looks fairly stable, so an upper-focused hypertrophy day is a strong default today.",
    confidence: 68,
  };
}