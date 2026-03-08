export type Goal = "strength" | "hypertrophy" | "fat_loss" | "general";

export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export type EquipmentAccess =
  | "full_gym"
  | "dumbbells_only"
  | "barbell_rack"
  | "machines_only"
  | "bodyweight_only"
  | "minimal_home_gym";

export type BodyPart =
  | "chest"
  | "back"
  | "legs"
  | "shoulders"
  | "arms"
  | "push"
  | "pull"
  | "upper"
  | "lower"
  | "full_body"
  | "unknown";

export type UserProfile = {
  userId: string;
  name?: string | null;
  age?: number | null;
  sex?: string | null;
  height?: string | null;
  bodyweight?: string | null;
  waist?: string | null;
  goal?: Goal | null;
  focus?: string | null;
  experienceLevel?: ExperienceLevel | null;
  equipmentAccess?: EquipmentAccess | null;
};

export type Workout = {
  id: number;
  workoutName: string | null;
  createdAt: string;
  durationSeconds?: number | null;
  dayType?: string | null;
  notes?: string | null;
};

export type WorkoutSet = {
  id: number;
  workoutId: number;
  exerciseName: string | null;
  bodyPart?: string | null;
  setNumber: number | null;
  weight: string | null;
  reps: string | null;
  completed?: boolean | null;
  createdAt: string;
};

export type StrengthSnapshot = {
  liftName: string;
  bestWeight: number;
  bestReps: number;
  estimated1RM: number;
  lastPerformedAt: string | null;
  trend: "up" | "flat" | "down";
};

export type RecoverySnapshot = {
  readinessScore: number; // internal only
  fatigueScore: number; // internal only
  recoveryLabel: "high" | "moderate" | "low";
  reasons: string[];
};

export type BalanceSnapshot = {
  weeklySetsByBodyPart: Record<string, number>;
  undertrainedBodyParts: BodyPart[];
  overtrainedBodyParts: BodyPart[];
  pushPullBalance: "balanced" | "push_bias" | "pull_bias";
  lowerBalance: "balanced" | "quad_bias" | "ham_glute_bias";
};

export type CoachRecommendation = {
  recommendedBodyPart: BodyPart;
  recommendedStyle: "strength" | "hypertrophy" | "recovery" | "reentry";
  reason: string;
  confidence: number;
};

export type InternalCoachSummary = {
  profile: UserProfile;
  strength: StrengthSnapshot[];
  recovery: RecoverySnapshot;
  balance: BalanceSnapshot;
  recommendation: CoachRecommendation;
  momentumScore: number;
  consistencyScore: number;
  highlights: string[];
};

export type UserFacingRecovery = {
  status: "ready_to_push" | "balanced" | "pull_back_a_bit";
  message: string;
};

export type UserFacingCoachSummary = {
  recommendation: CoachRecommendation;
  recovery: UserFacingRecovery;
  highlights: string[];
  momentumLabel: "building" | "steady" | "hot";
  consistencyLabel: "starting" | "solid" | "locked_in";
};

export type PostWorkoutRecap = {
  workoutName: string;
  durationText: string;
  totalSets: number;
  totalReps: number;
  topExercise: string | null;
  bestSet: string | null;
  highlights: string[];
  nextSuggestion: string;
};