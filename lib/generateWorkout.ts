import {
  exerciseLibrary,
  type Goal,
  type BodyPart,
  type GeneratorFocus,
  type ExperienceLevel,
  type EquipmentAccess,
  type Exercise,
  type ExerciseCategory,
  type MuscleEmphasis,
  type WorkoutStyle,
  type VolumeTier,
  type GeneratedWorkoutStyle,
  type EquipmentFit,
  type LiftRole,
} from "./workoutGeneratorData";

export type GeneratedSet = {
  set_number: number;
  weight: string;
  reps: string;
  completed?: boolean;
};

export type GeneratedExercise = {
  id: string;
  exercise_name: string;
  body_part: string;
  sets: GeneratedSet[];
  coachingNote?: string;
  reason?: string;
  restSeconds?: number;
  targetWeight?: number | null;
  repRange?: string;
  category?: ExerciseCategory;
  notes?: string | null;
};

export type GeneratedWorkout = {
  workout_name: string;
  body_part: string;
  estimated_duration: number;
  coachNote?: string;
  intensityLabel?: "easy" | "moderate" | "hard";
  progressionAdvice?: string[];
  totalWorkingSets?: number;
  workoutStyle?: GeneratedWorkoutStyle;
  emphasis?: MuscleEmphasis | "";
  exercises: GeneratedExercise[];
};

type GenerateWorkoutInput = {
  bodyPart: BodyPart;
  goal: Goal;
  duration?: number;
  experienceLevel: ExperienceLevel;
  equipmentAccess: EquipmentAccess;
  style?: WorkoutStyle;
  volumeTier?: VolumeTier;
  emphasis?: MuscleEmphasis | "";
  variationIndex?: number;
};

type WorkoutIdentity =
  | "Chest Strength Session"
  | "Upper Chest Focus"
  | "Chest Volume Session"
  | "Back Density Session"
  | "Lat Focus Pull Day"
  | "Balanced Pull Session"
  | "Quad Focus Lower"
  | "Glute + Hamstring Session"
  | "Balanced Lower Session"
  | "Unilateral Lower Session"
  | "Shoulder Focus Session"
  | "Shoulders + Arms Session"
  | "Arm Focus Session"
  | "Push Training Session"
  | "Pull Training Session"
  | "Full Body Performance"
  | "Full Body Training Session";

type SessionSlot =
  | "anchor"
  | "primary"
  | "secondary"
  | "secondary_alt"
  | "unilateral"
  | "lat_iso"
  | "quad_iso"
  | "ham_iso"
  | "glute_iso"
  | "side_delt_iso"
  | "rear_delt_iso"
  | "biceps_iso"
  | "triceps_iso"
  | "calves"
  | "core"
  | "finisher";

type SessionPlanSlot = {
  slot: SessionSlot;
  sets: number;
  optional?: boolean;
};

type SessionPlan = {
  identity: WorkoutIdentity;
  focuses: GeneratorFocus[];
  slots: SessionPlanSlot[];
  unilateralTarget: 0 | 1 | 2;
  summary: string;
};

const STYLE_LABELS: Record<WorkoutStyle, GeneratedWorkoutStyle> = {
  balanced: "Balanced Training",
  bodybuilding: "Muscle Focus",
  high_volume: "High Volume",
  old_school_mass: "Heavy Volume",
  intensity: "High Intensity",
  pump: "Short Rest Burn",
  strength_size: "Strength + Size",
};

const EXPERIENCE_RANK: Record<ExperienceLevel, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

function toTitleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function rotateArray<T>(items: T[], offset: number): T[] {
  if (!items.length) return items;
  const normalizedOffset = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(normalizedOffset), ...items.slice(0, normalizedOffset)];
}

function buildSets(setCount: number, reps: string): GeneratedSet[] {
  return Array.from({ length: setCount }, (_, index) => ({
    set_number: index + 1,
    weight: "",
    reps,
    completed: false,
  }));
}

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function getEquipmentFitScore(
  exercise: Exercise,
  equipmentAccess: EquipmentAccess
): number {
  const fit = exercise.equipmentFit?.[equipmentAccess] as EquipmentFit | undefined;

  if (fit === "best") return 6;
  if (fit === "good") return 3;
  if (fit === "backup") return 1;

  if (exercise.equipmentAccess.includes(equipmentAccess)) return 2;
  return 0;
}

function isExerciseValidForUser(
  exercise: Exercise,
  equipmentAccess: EquipmentAccess,
  experienceLevel: ExperienceLevel
) {
  const equipmentOk =
    exercise.equipmentAccess.includes(equipmentAccess) ||
    getEquipmentFitScore(exercise, equipmentAccess) > 0;

  const levelOk = exercise.levels.some(
    (level) => EXPERIENCE_RANK[level] <= EXPERIENCE_RANK[experienceLevel]
  );

  return equipmentOk && levelOk;
}

function getDisplayBodyPart(exercise: Exercise, requestedBodyPart: BodyPart): string {
  if (requestedBodyPart === "push") {
    if (exercise.primaryMuscle === "chest") return "chest";
    if (exercise.primaryMuscle === "triceps") return "arms";
    return "shoulders";
  }

  if (requestedBodyPart === "pull") {
    if (["biceps", "forearms"].includes(exercise.primaryMuscle)) return "arms";
    return "back";
  }

  if (requestedBodyPart === "full_body") {
    if (["quads", "glutes", "hamstrings", "calves"].includes(exercise.primaryMuscle)) {
      return "legs";
    }
    if (exercise.primaryMuscle === "chest") return "chest";
    if (
      ["back", "lats", "upper_back", "lower_back", "rear_delts"].includes(
        exercise.primaryMuscle
      )
    ) {
      return "back";
    }
    if (["biceps", "triceps", "forearms"].includes(exercise.primaryMuscle)) {
      return "arms";
    }
    if (exercise.primaryMuscle === "core") return "core";
    return "shoulders";
  }

  return requestedBodyPart;
}

function getIntensityLabel(
  duration: number,
  goal: Goal,
  volumeTier: VolumeTier
): "easy" | "moderate" | "hard" {
  if (volumeTier === "brutal") return "hard";
  if (goal === "strength" && duration >= 45) return "hard";
  if (duration >= 60 || volumeTier === "high") return "hard";
  if (duration <= 30 && volumeTier === "moderate") return "easy";
  return "moderate";
}

function pickRepRange(goal: Goal, style: WorkoutStyle, exercise: Exercise) {
  if (goal === "strength") {
    if (exercise.category === "main" || exercise.liftRole === "anchor") return "4-6";
    if (exercise.category === "accessory") return "6-8";
    return "8-12";
  }

  if (style === "pump") {
    if (exercise.category === "main") return "8-10";
    if (exercise.category === "accessory") return "10-15";
    return "12-20";
  }

  if (style === "high_volume") {
    if (exercise.category === "main") return "6-10";
    if (exercise.category === "accessory") return "8-12";
    return "12-20";
  }

  if (style === "bodybuilding") {
    if (exercise.category === "main") return "6-8";
    if (exercise.category === "accessory") return "8-12";
    return "10-15";
  }

  if (style === "strength_size") {
    if (exercise.category === "main") return "5-8";
    if (exercise.category === "accessory") return "8-10";
    return "10-15";
  }

  if (goal === "fat_loss") {
    if (exercise.category === "main") return "8-10";
    if (exercise.category === "accessory") return "10-12";
    return "12-15";
  }

  if (goal === "general") {
    if (exercise.category === "main") return "6-10";
    if (exercise.category === "accessory") return "8-12";
    return "10-15";
  }

  if (exercise.category === "main") return "6-8";
  if (exercise.category === "accessory") return "8-12";
  return "10-15";
}

function getRestSeconds(goal: Goal, style: WorkoutStyle, exercise: Exercise) {
  if (goal === "strength") {
    if (exercise.category === "main" || exercise.liftRole === "anchor") {
      if (
        ["squat", "hinge", "horizontal_press", "vertical_press"].includes(
          exercise.movementPattern
        )
      ) {
        return 240;
      }
      return 180;
    }
    if (exercise.category === "accessory") return 105;
    return 75;
  }

  if (style === "strength_size") {
    if (exercise.category === "main") return 150;
    if (exercise.category === "accessory") return 90;
    return 60;
  }

  if (style === "old_school_mass") {
    if (exercise.category === "main") return 135;
    if (exercise.category === "accessory") return 90;
    return 60;
  }

  if (style === "bodybuilding") {
    if (exercise.category === "main") return 120;
    if (exercise.category === "accessory") return 75;
    return 60;
  }

  if (style === "high_volume") {
    if (exercise.category === "main") return 105;
    if (exercise.category === "accessory") return 75;
    return 45;
  }

  if (style === "pump") {
    if (exercise.category === "main") return 75;
    if (exercise.category === "accessory") return 60;
    return 45;
  }

  if (style === "intensity") {
    if (exercise.category === "main") return 120;
    if (exercise.category === "accessory") return 75;
    return 60;
  }

  if (exercise.category === "main") return 105;
  if (exercise.category === "accessory") return 75;
  return 60;
}

function inferLiftRole(exercise: Exercise): LiftRole {
  if (exercise.liftRole) return exercise.liftRole;
  if (exercise.isPrimaryCompound && exercise.category === "main") return "anchor";
  if (exercise.category === "main") return "primary";
  if (exercise.category === "accessory") return "accessory";
  return "isolation";
}

function matchesAnyFocus(exercise: Exercise, focuses: GeneratorFocus[]) {
  if (exercise.sessionFocuses?.length) {
    return focuses.some((focus) => exercise.sessionFocuses?.includes(focus));
  }

  return focuses.some((focus) => {
    if (focus === "chest" || focus === "chest_shoulders" || focus === "chest_triceps") {
      return ["chest", "front_delts", "triceps"].includes(exercise.primaryMuscle);
    }
    if (focus === "back" || focus === "back_biceps" || focus === "back_rear_delts") {
      return ["back", "lats", "upper_back", "lower_back", "rear_delts", "biceps"].includes(
        exercise.primaryMuscle
      );
    }
    if (focus === "legs" || focus === "lower" || focus === "quads_glutes") {
      return ["quads", "glutes", "hamstrings", "calves"].includes(exercise.primaryMuscle);
    }
    if (focus === "glutes_hamstrings") {
      return ["glutes", "hamstrings"].includes(exercise.primaryMuscle);
    }
    if (focus === "quads_calves") {
      return ["quads", "calves"].includes(exercise.primaryMuscle);
    }
    if (focus === "shoulders" || focus === "shoulders_arms") {
      return ["shoulders", "front_delts", "side_delts", "rear_delts", "biceps", "triceps"].includes(
        exercise.primaryMuscle
      );
    }
    if (focus === "arms") {
      return ["biceps", "triceps", "forearms"].includes(exercise.primaryMuscle);
    }
    if (focus === "push") {
      return ["chest", "shoulders", "front_delts", "side_delts", "triceps"].includes(
        exercise.primaryMuscle
      );
    }
    if (focus === "pull" || focus === "upper") {
      return [
        "back",
        "lats",
        "upper_back",
        "rear_delts",
        "biceps",
        "shoulders",
        "chest",
        "triceps",
      ].includes(exercise.primaryMuscle);
    }
    if (focus === "full_body") return true;
    if (focus === "unilateral_lower") {
      return (
        exercise.laterality === "unilateral" &&
        ["quads", "glutes", "hamstrings"].includes(exercise.primaryMuscle)
      );
    }
    return false;
  });
}

function getCandidatePool(
  bodyPart: BodyPart,
  equipmentAccess: EquipmentAccess,
  experienceLevel: ExperienceLevel
) {
  const pool = exerciseLibrary.filter(
    (exercise) => isExerciseValidForUser(exercise, equipmentAccess, experienceLevel)
  );

  if (bodyPart === "full_body") return pool;

  if (bodyPart === "push") {
    return pool.filter((exercise) =>
      ["chest", "shoulders", "front_delts", "side_delts", "triceps"].includes(
        exercise.primaryMuscle
      )
    );
  }

  if (bodyPart === "pull") {
    return pool.filter((exercise) =>
      ["back", "lats", "upper_back", "lower_back", "rear_delts", "biceps", "forearms"].includes(
        exercise.primaryMuscle
      )
    );
  }

  if (bodyPart === "legs") {
    return pool.filter((exercise) =>
      ["quads", "glutes", "hamstrings", "calves"].includes(exercise.primaryMuscle)
    );
  }

  if (bodyPart === "shoulders") {
    return pool.filter((exercise) =>
      ["shoulders", "front_delts", "side_delts", "rear_delts", "triceps", "biceps"].includes(
        exercise.primaryMuscle
      )
    );
  }

  if (bodyPart === "arms") {
    return pool.filter((exercise) =>
      ["biceps", "triceps", "forearms", "side_delts"].includes(exercise.primaryMuscle)
    );
  }

  if (bodyPart === "chest") {
    return pool.filter((exercise) =>
      ["chest", "front_delts", "triceps", "side_delts"].includes(exercise.primaryMuscle)
    );
  }

  if (bodyPart === "back") {
    return pool.filter((exercise) =>
      ["back", "lats", "upper_back", "rear_delts", "biceps"].includes(exercise.primaryMuscle)
    );
  }

  return pool;
}

function chooseIdentity(params: {
  bodyPart: BodyPart;
  goal: Goal;
  duration: number;
  equipmentAccess: EquipmentAccess;
  emphasis?: MuscleEmphasis | "";
  variationIndex: number;
}): SessionPlan {
  const { bodyPart, goal, duration, equipmentAccess, emphasis = "", variationIndex } = params;

  const brutal = duration >= 75;
  const highish = duration >= 50;

  if (bodyPart === "chest") {
    const identities: SessionPlan[] = [
      {
        identity: "Chest Strength Session",
        focuses: ["chest", "chest_triceps"],
        unilateralTarget: 0,
        summary: "A press-led chest day built around a strong anchor and clean supporting work.",
        slots: brutal
          ? [
              { slot: "anchor", sets: 4 },
              { slot: "primary", sets: 4 },
              { slot: "secondary", sets: 3 },
              { slot: "triceps_iso", sets: 3 },
              { slot: "finisher", sets: 2 },
            ]
          : [
              { slot: "anchor", sets: 4 },
              { slot: "primary", sets: 3 },
              { slot: "secondary", sets: 3 },
              { slot: "finisher", sets: 2 },
            ],
      },
      {
        identity: "Upper Chest Focus",
        focuses: ["chest", "chest_shoulders"],
        unilateralTarget: 0,
        summary: "An upper-chest biased session using incline-friendly choices and chest support work.",
        slots: highish
          ? [
              { slot: "anchor", sets: 4 },
              { slot: "primary", sets: 4 },
              { slot: "secondary", sets: 3 },
              { slot: "side_delt_iso", sets: 3, optional: true },
              { slot: "finisher", sets: 2 },
            ]
          : [
              { slot: "anchor", sets: 4 },
              { slot: "primary", sets: 3 },
              { slot: "finisher", sets: 3 },
            ],
      },
      {
        identity: "Chest Volume Session",
        focuses: ["chest", "chest_triceps", "chest_shoulders"],
        unilateralTarget: 0,
        summary: "A more fatigue-friendly chest session focused on quality volume and tension.",
        slots: [
          { slot: "anchor", sets: 3 },
          { slot: "primary", sets: 3 },
          { slot: "secondary", sets: 3 },
          { slot: "triceps_iso", sets: 3, optional: true },
          { slot: "finisher", sets: 3 },
        ],
      },
    ];

    if (emphasis === "upper_chest") return identities[1];
    return rotateArray(identities, variationIndex)[0];
  }

  if (bodyPart === "back") {
    const identities: SessionPlan[] = [
      {
        identity: "Back Density Session",
        focuses: ["back", "back_biceps"],
        unilateralTarget: equipmentAccess === "dumbbells_only" ? 1 : 0,
        summary: "A row-dominant back session built for thickness, control, and biceps support.",
        slots: [
          { slot: "anchor", sets: 4 },
          { slot: "primary", sets: 3 },
          { slot: "secondary", sets: 3 },
          { slot: "biceps_iso", sets: 3 },
          { slot: "finisher", sets: 2, optional: true },
        ],
      },
      {
        identity: "Lat Focus Pull Day",
        focuses: ["back", "back_biceps"],
        unilateralTarget: 0,
        summary: "A pull session with more vertical emphasis for lat width and cleaner arm overlap.",
        slots: [
          { slot: "anchor", sets: 4 },
          { slot: "primary", sets: 3 },
          { slot: "lat_iso", sets: 3 },
          { slot: "biceps_iso", sets: 3 },
          { slot: "rear_delt_iso", sets: 2, optional: true },
        ],
      },
      {
        identity: "Balanced Pull Session",
        focuses: ["back", "back_biceps", "back_rear_delts"],
        unilateralTarget: 1,
        summary: "A balanced pull day mixing width, thickness, rear delts, and arm work.",
        slots: [
          { slot: "anchor", sets: 4 },
          { slot: "primary", sets: 3 },
          { slot: "unilateral", sets: 3, optional: true },
          { slot: "rear_delt_iso", sets: 3 },
          { slot: "biceps_iso", sets: 3 },
        ],
      },
    ];

    if (emphasis === "lat_width") return identities[1];
    if (emphasis === "mid_back_thickness") return identities[0];
    return rotateArray(identities, variationIndex)[0];
  }

  if (bodyPart === "legs") {
    const identities: SessionPlan[] = [
      {
        identity: "Quad Focus Lower",
        focuses: ["legs", "quads_glutes", "quads_calves"],
        unilateralTarget:
          equipmentAccess === "bodyweight_only" ? 1 : variationIndex % 3 === 0 ? 1 : 0,
        summary: "A knee-dominant lower day built to drive quad work without drifting into junk fatigue.",
        slots: highish
          ? [
              { slot: "anchor", sets: 4 },
              { slot: "primary", sets: 3 },
              { slot: "unilateral", sets: 3, optional: true },
              { slot: "quad_iso", sets: 3 },
              { slot: "ham_iso", sets: 2 },
              { slot: "calves", sets: 3 },
            ]
          : [
              { slot: "anchor", sets: 4 },
              { slot: "primary", sets: 3 },
              { slot: "quad_iso", sets: 3 },
              { slot: "calves", sets: 3 },
            ],
      },
      {
        identity: "Glute + Hamstring Session",
        focuses: ["legs", "glutes_hamstrings"],
        unilateralTarget: variationIndex % 2 === 0 ? 1 : 0,
        summary: "A posterior-chain lower session focused on glutes, hamstrings, and stable fatigue.",
        slots: [
          { slot: "anchor", sets: 4 },
          { slot: "unilateral", sets: 3, optional: true },
          { slot: "secondary", sets: 3 },
          { slot: "ham_iso", sets: 3 },
          { slot: "glute_iso", sets: 2 },
          { slot: "calves", sets: 3, optional: true },
        ],
      },
      {
        identity: "Balanced Lower Session",
        focuses: ["legs", "quads_glutes", "glutes_hamstrings"],
        unilateralTarget: variationIndex % 3 === 1 ? 1 : 0,
        summary: "A balanced lower-body day with one strong driver and enough support work to cover the whole lower body well.",
        slots: [
          { slot: "anchor", sets: 4 },
          { slot: "primary", sets: 3 },
          { slot: "secondary", sets: 3 },
          { slot: "unilateral", sets: 3, optional: true },
          { slot: "quad_iso", sets: 2, optional: true },
          { slot: "ham_iso", sets: 2, optional: true },
          { slot: "calves", sets: 3 },
        ],
      },
      {
        identity: "Unilateral Lower Session",
        focuses: ["legs", "unilateral_lower", "glutes_hamstrings", "quads_glutes"],
        unilateralTarget: 2,
        summary: "A lower-body session that intentionally uses more single-leg work for balance, control, and variation.",
        slots: [
          { slot: "anchor", sets: 3 },
          { slot: "unilateral", sets: 3 },
          { slot: "secondary_alt", sets: 3 },
          { slot: "glute_iso", sets: 2, optional: true },
          { slot: "ham_iso", sets: 2, optional: true },
          { slot: "calves", sets: 3, optional: true },
        ],
      },
    ];

    if (emphasis === "quad_bias") return identities[0];
    if (emphasis === "glute_bias" || emphasis === "hamstring_bias") return identities[1];
    return rotateArray(identities, variationIndex)[0];
  }

  if (bodyPart === "shoulders") {
    return {
      identity: variationIndex % 2 === 0 ? "Shoulder Focus Session" : "Shoulders + Arms Session",
      focuses:
        variationIndex % 2 === 0
          ? ["shoulders", "chest_shoulders"]
          : ["shoulders", "shoulders_arms"],
      unilateralTarget: variationIndex % 2 === 0 ? 1 : 0,
      summary:
        variationIndex % 2 === 0
          ? "A delt-focused upper session built around shoulder pressing and lateral/rear-delt support."
          : "A shoulder-led session with useful arm overlap and enough variety to feel complete.",
      slots:
        variationIndex % 2 === 0
          ? [
              { slot: "anchor", sets: 4 },
              { slot: "side_delt_iso", sets: 3 },
              { slot: "rear_delt_iso", sets: 3 },
              { slot: "unilateral", sets: 2, optional: true },
              { slot: "triceps_iso", sets: 2, optional: true },
            ]
          : [
              { slot: "anchor", sets: 4 },
              { slot: "side_delt_iso", sets: 3 },
              { slot: "triceps_iso", sets: 3 },
              { slot: "biceps_iso", sets: 3 },
              { slot: "rear_delt_iso", sets: 2 },
            ],
    };
  }

  if (bodyPart === "arms") {
    return {
      identity: "Arm Focus Session",
      focuses: ["arms", "shoulders_arms"],
      unilateralTarget: variationIndex % 3 === 0 ? 1 : 0,
      summary: "An arm-focused session built around clean curls, triceps work, and just enough support work to feel complete.",
      slots: [
        { slot: "biceps_iso", sets: 3 },
        { slot: "triceps_iso", sets: 3 },
        { slot: "primary", sets: 3, optional: true },
        { slot: "secondary", sets: 3, optional: true },
        { slot: "side_delt_iso", sets: 2, optional: true },
        { slot: "finisher", sets: 2, optional: true },
      ],
    };
  }

  if (bodyPart === "push") {
    return {
      identity: "Push Training Session",
      focuses: ["push", "chest_triceps", "chest_shoulders"],
      unilateralTarget: variationIndex % 4 === 0 ? 1 : 0,
      summary: "A push day blending chest, shoulders, and triceps around one strong pressing anchor.",
      slots: [
        { slot: "anchor", sets: 4 },
        { slot: "primary", sets: 3 },
        { slot: "side_delt_iso", sets: 3 },
        { slot: "triceps_iso", sets: 3 },
        { slot: "finisher", sets: 2, optional: true },
      ],
    };
  }

  if (bodyPart === "pull") {
    return {
      identity: "Pull Training Session",
      focuses: ["pull", "back_biceps", "back_rear_delts"],
      unilateralTarget: variationIndex % 3 === 0 ? 1 : 0,
      summary: "A pull day balancing rows, pulldowns, rear delts, and biceps for a more complete upper session.",
      slots: [
        { slot: "anchor", sets: 4 },
        { slot: "primary", sets: 3 },
        { slot: "secondary", sets: 3 },
        { slot: "rear_delt_iso", sets: 3 },
        { slot: "biceps_iso", sets: 3 },
      ],
    };
  }

  return goal === "strength"
    ? {
        identity: "Full Body Performance",
        focuses: ["full_body", "upper", "lower"],
        unilateralTarget: 0,
        summary: "A full-body session built around big patterns, clean loading, and broad stimulus.",
        slots: [
          { slot: "anchor", sets: 3 },
          { slot: "primary", sets: 3 },
          { slot: "secondary", sets: 3 },
          { slot: "core", sets: 3 },
          { slot: "finisher", sets: 2, optional: true },
        ],
      }
    : {
        identity: "Full Body Training Session",
        focuses: ["full_body", "upper", "lower"],
        unilateralTarget: variationIndex % 3 === 0 ? 1 : 0,
        summary: "A full-body training session that spreads quality work across the body without becoming chaotic.",
        slots: [
          { slot: "anchor", sets: 3 },
          { slot: "primary", sets: 3 },
          { slot: "secondary", sets: 3 },
          { slot: "unilateral", sets: 2, optional: true },
          { slot: "core", sets: 3 },
        ],
      };
}

function isAnchorCandidate(exercise: Exercise, plan: SessionPlan) {
  const role = inferLiftRole(exercise);
  return (
    role === "anchor" &&
    matchesAnyFocus(exercise, plan.focuses) &&
    exercise.category === "main"
  );
}

function isPrimaryCandidate(exercise: Exercise, plan: SessionPlan) {
  const role = inferLiftRole(exercise);
  return (
    matchesAnyFocus(exercise, plan.focuses) &&
    (role === "primary" || role === "anchor" || exercise.category === "main")
  );
}

function isSecondaryCandidate(exercise: Exercise, plan: SessionPlan) {
  const role = inferLiftRole(exercise);
  return (
    matchesAnyFocus(exercise, plan.focuses) &&
    (role === "secondary" || role === "primary" || exercise.category === "accessory")
  );
}

function isUnilateralCandidate(exercise: Exercise, plan: SessionPlan) {
  return (
    exercise.laterality === "unilateral" &&
    matchesAnyFocus(exercise, plan.focuses) &&
    ["accessory", "isolation", "main"].includes(exercise.category)
  );
}

function getSlotCandidates(
  slot: SessionSlot,
  pool: Exercise[],
  plan: SessionPlan
): Exercise[] {
  switch (slot) {
    case "anchor":
      return pool.filter((exercise) => isAnchorCandidate(exercise, plan));

    case "primary":
      return pool.filter((exercise) => isPrimaryCandidate(exercise, plan));

    case "secondary":
    case "secondary_alt":
      return pool.filter((exercise) => isSecondaryCandidate(exercise, plan));

    case "unilateral":
      return pool.filter((exercise) => isUnilateralCandidate(exercise, plan));

    case "lat_iso":
      return pool.filter(
        (exercise) =>
          exercise.primaryMuscle === "lats" &&
          (exercise.category === "isolation" ||
            exercise.emphasis?.includes("lat_width") ||
            exercise.movementPattern === "vertical_pull")
      );

    case "quad_iso":
      return pool.filter(
        (exercise) => exercise.primaryMuscle === "quads" && exercise.category === "isolation"
      );

    case "ham_iso":
      return pool.filter(
        (exercise) => exercise.primaryMuscle === "hamstrings" && exercise.category === "isolation"
      );

    case "glute_iso":
      return pool.filter(
        (exercise) =>
          exercise.primaryMuscle === "glutes" &&
          ["accessory", "isolation"].includes(exercise.category)
      );

    case "side_delt_iso":
      return pool.filter(
        (exercise) =>
          exercise.primaryMuscle === "side_delts" &&
          exercise.movementPattern === "raise"
      );

    case "rear_delt_iso":
      return pool.filter(
        (exercise) =>
          exercise.primaryMuscle === "rear_delts" &&
          exercise.movementPattern === "raise"
      );

    case "biceps_iso":
      return pool.filter(
        (exercise) =>
          exercise.primaryMuscle === "biceps" && exercise.movementPattern === "curl"
      );

    case "triceps_iso":
      return pool.filter(
        (exercise) =>
          exercise.primaryMuscle === "triceps" &&
          exercise.movementPattern === "tricep_extension"
      );

    case "calves":
      return pool.filter((exercise) => exercise.primaryMuscle === "calves");

    case "core":
      return pool.filter((exercise) => exercise.primaryMuscle === "core");

    case "finisher":
      return pool.filter((exercise) => matchesAnyFocus(exercise, plan.focuses));

    default:
      return pool;
  }
}

function scoreExerciseForStyle(exercise: Exercise, style: WorkoutStyle) {
  let score = 0;

  if (exercise.styleTags?.includes(style)) score += 6;

  if (style === "bodybuilding") {
    if (exercise.isStable) score += 2;
    if (exercise.category === "isolation") score += 2;
    if (exercise.fatigueCost <= 3) score += 1;
  }

  if (style === "high_volume") {
    if (exercise.fatigueCost <= 3) score += 3;
    if (exercise.category !== "main") score += 2;
    if (exercise.isStable) score += 2;
  }

  if (style === "old_school_mass") {
    if (
      exercise.equipmentTypes.includes("barbell") ||
      exercise.equipmentTypes.includes("dumbbell")
    ) {
      score += 3;
    }
    if (exercise.category === "main") score += 2;
  }

  if (style === "intensity") {
    if (exercise.isStable) score += 3;
    if (exercise.category !== "main") score += 2;
  }

  if (style === "pump") {
    if (exercise.category === "isolation") score += 3;
    if (exercise.isStable) score += 2;
  }

  if (style === "strength_size") {
    if (exercise.category === "main") score += 3;
    if (
      [
        "horizontal_press",
        "vertical_press",
        "horizontal_pull",
        "vertical_pull",
        "squat",
        "hinge",
      ].includes(exercise.movementPattern)
    ) {
      score += 2;
    }
  }

  return score;
}

function scoreExerciseForGoal(exercise: Exercise, goal: Goal) {
  let score = 0;

  if (goal === "strength") {
    if (exercise.category === "main") score += 6;
    if (
      [
        "horizontal_press",
        "vertical_press",
        "horizontal_pull",
        "vertical_pull",
        "squat",
        "hinge",
      ].includes(exercise.movementPattern)
    ) {
      score += 3;
    }
    if (exercise.category === "isolation") score -= 4;
  }

  if (goal === "hypertrophy") {
    if (exercise.category === "accessory") score += 3;
    if (exercise.category === "isolation") score += 4;
    if (exercise.isStable) score += 1;
  }

  if (goal === "fat_loss") {
    if (exercise.category === "accessory") score += 2;
    if (
      ["lunge", "core", "bodyweight_push", "bodyweight_pull"].includes(exercise.movementPattern)
    ) {
      score += 2;
    }
  }

  if (goal === "general") {
    if (exercise.category !== "main") score += 1;
  }

  return score;
}

function scoreExerciseForEmphasis(exercise: Exercise, emphasis?: MuscleEmphasis | "") {
  if (!emphasis) return 0;
  if (exercise.emphasis?.includes(emphasis)) return 6;

  if (emphasis === "glute_bias" && ["glutes", "hamstrings"].includes(exercise.primaryMuscle)) {
    return 3;
  }

  if (emphasis === "quad_bias" && ["quads", "glutes"].includes(exercise.primaryMuscle)) {
    return 3;
  }

  return 0;
}

function scoreExerciseForEquipment(
  exercise: Exercise,
  equipmentAccess: EquipmentAccess
) {
  return getEquipmentFitScore(exercise, equipmentAccess);
}

function scoreExerciseForStructure(
  exercise: Exercise,
  selected: Exercise[],
  slot: SessionSlot,
  bodyPart: BodyPart
) {
  let score = 0;

  const samePrimaryCount = selected.filter(
    (item) => item.primaryMuscle === exercise.primaryMuscle
  ).length;
  const samePatternCount = selected.filter(
    (item) => item.movementPattern === exercise.movementPattern
  ).length;

  score -= samePrimaryCount * 2;

  if (bodyPart === "legs") score -= samePatternCount * 1;
  else score -= samePatternCount * 2;

  if (slot === "anchor" && inferLiftRole(exercise) === "anchor") score += 5;
  if (slot === "unilateral" && exercise.laterality === "unilateral") score += 5;
  if (slot === "finisher" && exercise.category === "isolation") score += 3;

  return score;
}

function scoreExerciseForVariation(
  exercise: Exercise,
  slotIndex: number,
  variationIndex: number
) {
  const pseudo = (slotIndex + 1) * 7 + (variationIndex + 1) * 13 + exercise.id.length;
  return pseudo % 5;
}

function pickBestExercise(params: {
  candidates: Exercise[];
  selected: Exercise[];
  bodyPart: BodyPart;
  goal: Goal;
  style: WorkoutStyle;
  emphasis?: MuscleEmphasis | "";
  equipmentAccess: EquipmentAccess;
  usedIds: Set<string>;
  slot: SessionSlot;
  slotIndex: number;
  variationIndex: number;
  allowSameMovement?: boolean;
}) {
  const {
    candidates,
    selected,
    bodyPart,
    goal,
    style,
    emphasis,
    equipmentAccess,
    usedIds,
    slot,
    slotIndex,
    variationIndex,
    allowSameMovement = false,
  } = params;

  const usedPatterns = selected.map((exercise) => exercise.movementPattern);

  const filtered = candidates.filter((exercise) => {
    if (usedIds.has(exercise.id)) return false;
    if (!allowSameMovement && usedPatterns.includes(exercise.movementPattern) && bodyPart !== "legs") {
      return false;
    }
    return true;
  });

  const pool = filtered.length
    ? filtered
    : candidates.filter((exercise) => !usedIds.has(exercise.id));

  if (!pool.length) return null;

  const scored = rotateArray(pool, variationIndex + slotIndex).map((exercise) => {
    let score = 0;
    score += scoreExerciseForStyle(exercise, style);
    score += scoreExerciseForGoal(exercise, goal);
    score += scoreExerciseForEmphasis(exercise, emphasis);
    score += scoreExerciseForEquipment(exercise, equipmentAccess);
    score += scoreExerciseForStructure(exercise, selected, slot, bodyPart);
    score += scoreExerciseForVariation(exercise, slotIndex, variationIndex);

    if (slot === "anchor" && inferLiftRole(exercise) === "anchor") score += 8;

    return { exercise, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const bestScore = scored[0]?.score ?? 0;
  const topPool = scored
    .filter((item) => item.score >= bestScore - 2)
    .map((item) => item.exercise);

  return rotateArray(topPool, variationIndex + slotIndex)[0] ?? topPool[0] ?? null;
}

function attachFinisherNotes(style: WorkoutStyle) {
  if (style === "bodybuilding") return "Final set can be pushed very hard if form stays clean.";
  if (style === "high_volume") {
    return "Final isolation movement can use a dropset if recovery is good.";
  }
  if (style === "intensity") return "Final set can use rest-pause if technique stays sharp.";
  if (style === "pump") return "Short rests and a hard final squeeze are encouraged.";
  if (style === "old_school_mass") return "Push the final hard set with controlled aggression.";
  return null;
}

function buildExerciseCoachingNote(
  exercise: Exercise,
  goal: Goal,
  style: WorkoutStyle,
  slot: SessionSlot
) {
  if (slot === "finisher") {
    return "Finisher work. Push hard, stay controlled, and end the session with intent.";
  }

  if (slot === "anchor" || inferLiftRole(exercise) === "anchor") {
    if (goal === "strength") {
      return "Anchor lift. Prioritize setup, bracing, crisp reps, and clean force output.";
    }
    return "Anchor lift. This is the main driver of the session, so own your setup and execution.";
  }

  if (slot === "unilateral") {
    return "Single-side work. Stay controlled, own position, and make both sides earn the reps.";
  }

  if (exercise.category === "main") {
    return "Primary movement. Push performance while keeping reps clean and repeatable.";
  }

  if (exercise.category === "accessory") {
    return "Accessory work. Controlled reps, full range, and honest effort.";
  }

  if (style === "pump") {
    return "Isolation work. Keep constant tension and avoid rushing the set.";
  }

  return "Isolation work. Keep tension on the target muscle and avoid sloppy loading.";
}

function buildExerciseReason(
  exercise: Exercise,
  identity: WorkoutIdentity,
  slot: SessionSlot,
  emphasis?: MuscleEmphasis | ""
) {
  if (slot === "anchor") {
    return `Included as the anchor movement for your ${identity}.`;
  }

  if (slot === "unilateral") {
    return "Included to add variation, improve control, and create productive single-side work.";
  }

  if (slot === "finisher") {
    return "Included to finish the session with extra fatigue and targeted stimulus.";
  }

  if (emphasis && exercise.emphasis?.includes(emphasis)) {
    return `Included to support your ${toTitleCase(emphasis)} emphasis.`;
  }

  if (exercise.category === "isolation") {
    return "Included for targeted volume and cleaner fatigue management.";
  }

  return `Included to support the structure of your ${identity}.`;
}

function buildProgressionAdvice(
  goal: Goal,
  style: WorkoutStyle,
  bodyPart: BodyPart,
  totalWorkingSets: number
) {
  const advice = [
    "Stay inside the target rep range before forcing load increases.",
    "Beat last time with cleaner reps or an extra rep before chasing more weight.",
    "When all working sets reach the top of the rep range with strong form, increase load next time.",
  ];

  if (goal === "strength") {
    advice.push(
      "On anchor lifts, rest fully and earn load jumps instead of grinding every set."
    );
  } else if (style === "bodybuilding" || style === "high_volume") {
    advice.push("Use controlled eccentrics and keep tension high instead of rushing reps.");
  } else if (style === "pump") {
    advice.push("Keep rest tight, but never sacrifice rep quality just to move faster.");
  } else {
    advice.push("Prioritize repeatable execution and steady progression over aggressive jumps.");
  }

  if (bodyPart === "legs" && totalWorkingSets >= 18) {
    advice.push(
      "On high-volume lower days, protect your first big movement so later work still has quality."
    );
  }

  if (bodyPart === "shoulders" || bodyPart === "arms") {
    advice.push(
      "For smaller-muscle lifts, smaller jumps and extra reps usually beat forcing heavy increases."
    );
  }

  return advice;
}

function getEstimatedDurationFromSets(
  totalSets: number,
  style: WorkoutStyle,
  fallbackDuration: number
) {
  const secondsPerSet =
    style === "strength_size"
      ? 210
      : style === "old_school_mass"
      ? 195
      : style === "high_volume"
      ? 165
      : style === "pump"
      ? 145
      : 175;

  const bufferMinutes = 8;
  const computed = Math.round((totalSets * secondsPerSet) / 60 + bufferMinutes);

  return Math.max(fallbackDuration, computed);
}

function mergeDuplicateSelections(
  selected: Array<{ exercise: Exercise; slot: SessionSlot; setCount: number }>
) {
  const merged: Array<{ exercise: Exercise; slot: SessionSlot; setCount: number }> = [];

  selected.forEach((item) => {
    const existing = merged.find((entry) => entry.exercise.id === item.exercise.id);
    if (existing) {
      existing.setCount += item.setCount;
    } else {
      merged.push({ ...item });
    }
  });

  return merged;
}

function buildWorkoutTitle(
  identity: WorkoutIdentity,
  volumeTier: VolumeTier
) {
  const intensitySuffix =
    volumeTier === "brutal"
      ? " • Hard"
      : volumeTier === "high"
      ? " • Challenging"
      : " • Standard";

  return `${identity}${intensitySuffix}`;
}

function buildCoachNote(params: {
  plan: SessionPlan;
  goal: Goal;
  bodyPart: BodyPart;
  experienceLevel: ExperienceLevel;
  duration: number;
  equipmentAccess: EquipmentAccess;
  style: WorkoutStyle;
  volumeTier: VolumeTier;
  emphasis?: MuscleEmphasis | "";
  totalWorkingSets: number;
}) {
  const {
    plan,
    goal,
    experienceLevel,
    duration,
    equipmentAccess,
    volumeTier,
    emphasis,
    totalWorkingSets,
  } = params;

  const sessionDemand =
    volumeTier === "brutal"
      ? "This is one of your more demanding sessions."
      : volumeTier === "high"
      ? "This is a fuller training session with more total work."
      : "This session is built to be productive without adding unnecessary fatigue.";

  const goalLine =
    goal === "strength"
      ? "The workout is structured to keep your main movements strong, clean, and progressive."
      : goal === "hypertrophy"
      ? "The workout is structured to give you enough quality volume to build muscle and improve exercise performance."
      : goal === "fat_loss"
      ? "The workout is structured to keep effort high, training efficient, and movement quality strong."
      : "The workout is structured to improve overall fitness, consistency, and balanced training.";

  const identityLine = `Today’s session is ${plan.identity.toLowerCase()}, with ${totalWorkingSets} working sets and an estimated duration of about ${duration} minutes.`;

  const equipmentLine = `Exercise selection is matched to ${toTitleCase(
    equipmentAccess
  ).toLowerCase()} and scaled for a ${experienceLevel} lifter.`;

  const emphasisLine = emphasis
    ? ` Extra exercise bias was applied toward ${toTitleCase(emphasis).toLowerCase()}.`
    : "";

  const unilateralLine =
    plan.unilateralTarget === 2
      ? " This workout intentionally includes more single-side work for balance, control, and variation."
      : plan.unilateralTarget === 1
      ? " This workout may include a small amount of single-side work for balance and variation."
      : "";

  return `${sessionDemand} ${goalLine} ${identityLine} ${equipmentLine}${emphasisLine}${unilateralLine}`;
}

function fallbackCandidatesForSlot(
  slot: SessionSlot,
  pool: Exercise[],
  plan: SessionPlan
) {
  if (slot === "anchor") {
    return pool.filter(
      (exercise) =>
        matchesAnyFocus(exercise, plan.focuses) &&
        (exercise.category === "main" || inferLiftRole(exercise) === "anchor")
    );
  }

  if (slot === "unilateral") {
    return pool.filter((exercise) => exercise.laterality === "unilateral");
  }

  if (slot === "core") {
    return pool.filter((exercise) => exercise.primaryMuscle === "core");
  }

  return pool.filter((exercise) => matchesAnyFocus(exercise, plan.focuses));
}

export function generateWorkout({
  bodyPart,
  goal,
  duration = 60,
  experienceLevel,
  equipmentAccess,
  style = "balanced",
  volumeTier = "high",
  emphasis = "",
  variationIndex = 0,
}: GenerateWorkoutInput): GeneratedWorkout {
  const pool = uniqueById(
    getCandidatePool(bodyPart, equipmentAccess, experienceLevel)
  );

  const plan = chooseIdentity({
    bodyPart,
    goal,
    duration,
    equipmentAccess,
    emphasis,
    variationIndex,
  });

  const selected: Array<{ exercise: Exercise; slot: SessionSlot; setCount: number }> = [];
  const usedIds = new Set<string>();
  let unilateralCount = 0;

  plan.slots.forEach((slotDef, slotIndex) => {
    const rawCandidates = getSlotCandidates(slotDef.slot, pool, plan);

    const filteredForUnilateral =
      slotDef.slot !== "unilateral" && unilateralCount >= plan.unilateralTarget
        ? rawCandidates.filter((exercise) => exercise.laterality !== "unilateral")
        : rawCandidates;

    const allowSameMovement = [
      "side_delt_iso",
      "rear_delt_iso",
      "biceps_iso",
      "triceps_iso",
      "finisher",
      "calves",
      "core",
    ].includes(slotDef.slot);

    let chosen = pickBestExercise({
      candidates: filteredForUnilateral,
      selected: selected.map((item) => item.exercise),
      bodyPart,
      goal,
      style,
      emphasis,
      equipmentAccess,
      usedIds,
      slot: slotDef.slot,
      slotIndex,
      variationIndex,
      allowSameMovement,
    });

    if (!chosen) {
      const fallback = fallbackCandidatesForSlot(slotDef.slot, pool, plan);
      chosen = pickBestExercise({
        candidates: fallback,
        selected: selected.map((item) => item.exercise),
        bodyPart,
        goal,
        style,
        emphasis,
        equipmentAccess,
        usedIds,
        slot: slotDef.slot,
        slotIndex,
        variationIndex,
        allowSameMovement: true,
      });
    }

    if (!chosen) {
      if (!slotDef.optional) return;
      return;
    }

    selected.push({
      exercise: chosen,
      slot: slotDef.slot,
      setCount: slotDef.sets,
    });
    usedIds.add(chosen.id);

    if (chosen.laterality === "unilateral") unilateralCount += 1;
  });

  if (selected.length < 4) {
    const extra = rotateArray(
      pool.filter((exercise) => !usedIds.has(exercise.id)),
      variationIndex
    ).slice(0, 3);

    extra.forEach((exercise) => {
      selected.push({
        exercise,
        slot: "finisher",
        setCount: Math.min(3, Math.max(2, exercise.category === "main" ? 3 : 2)),
      });
      usedIds.add(exercise.id);
    });
  }

  const mergedSelections = mergeDuplicateSelections(selected);

  const exercises: GeneratedExercise[] = mergedSelections.map((item, index) => {
    const repRange = pickRepRange(goal, style, item.exercise);
    const note =
      item.slot === "finisher" && index === mergedSelections.length - 1
        ? attachFinisherNotes(style)
        : null;

    return {
      id: item.exercise.id,
      exercise_name: item.exercise.name,
      body_part: getDisplayBodyPart(item.exercise, bodyPart),
      sets: buildSets(item.setCount, repRange),
      coachingNote: buildExerciseCoachingNote(item.exercise, goal, style, item.slot),
      reason: buildExerciseReason(item.exercise, plan.identity, item.slot, emphasis),
      restSeconds: getRestSeconds(goal, style, item.exercise),
      targetWeight: null,
      repRange,
      category: item.exercise.category,
      notes: note,
    };
  });

  const totalWorkingSets = exercises.reduce(
    (sum, exercise) => sum + exercise.sets.length,
    0
  );

  const estimatedDuration = getEstimatedDurationFromSets(
    totalWorkingSets,
    style,
    duration
  );

  return {
    workout_name: buildWorkoutTitle(plan.identity, volumeTier),
    body_part: bodyPart,
    estimated_duration: estimatedDuration,
    totalWorkingSets,
    workoutStyle: STYLE_LABELS[style],
    emphasis,
    coachNote: buildCoachNote({
      plan,
      goal,
      bodyPart,
      experienceLevel,
      duration: estimatedDuration,
      equipmentAccess,
      style,
      volumeTier,
      emphasis,
      totalWorkingSets,
    }),
    intensityLabel: getIntensityLabel(estimatedDuration, goal, volumeTier),
    progressionAdvice: buildProgressionAdvice(goal, style, bodyPart, totalWorkingSets),
    exercises,
  };
}