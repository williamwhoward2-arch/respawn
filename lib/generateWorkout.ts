import {
  exerciseLibrary,
  type Goal,
  type BodyPart,
  type ExperienceLevel,
  type EquipmentAccess,
  type Exercise,
  type ExerciseCategory,
  type MuscleEmphasis,
  type WorkoutStyle,
  type VolumeTier,
  type GeneratedWorkoutStyle,
  type EquipmentType,
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
  duration: number;
  experienceLevel: ExperienceLevel;
  equipmentAccess: EquipmentAccess;
  style?: WorkoutStyle;
  volumeTier?: VolumeTier;
  emphasis?: MuscleEmphasis | "";
  variationIndex?: number;
};

type TemplateSlot =
  | "primary_press"
  | "secondary_press"
  | "upper_bias_press"
  | "stable_press"
  | "stretch_chest_iso"
  | "squeeze_chest_iso"
  | "back_row_primary"
  | "back_row_secondary"
  | "back_vertical_pull"
  | "lat_isolation"
  | "legs_main_knee"
  | "legs_main_hinge"
  | "legs_secondary_knee"
  | "legs_unilateral"
  | "legs_quad_iso"
  | "legs_ham_iso"
  | "legs_glute_iso"
  | "calves"
  | "shoulder_press"
  | "side_delt"
  | "rear_delt"
  | "biceps_primary"
  | "biceps_secondary"
  | "triceps_primary"
  | "triceps_secondary"
  | "core"
  | "finisher";

type SlotDefinition = {
  slot: TemplateSlot;
  sets: number;
  optional?: boolean;
};

type LegFocus = "balanced" | "quad_bias" | "glute_ham_bias";

const STYLE_LABELS: Record<WorkoutStyle, GeneratedWorkoutStyle> = {
  balanced: "Balanced Hypertrophy",
  bodybuilding: "Bodybuilding Builder",
  high_volume: "High Volume Mass",
  old_school_mass: "Old School Mass",
  intensity: "Intensity Focus",
  pump: "Pump Session",
  strength_size: "Strength + Size",
};

const EXPERIENCE_RANK: Record<ExperienceLevel, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

const EQUIPMENT_COMPATIBILITY: Record<EquipmentAccess, EquipmentType[]> = {
  full_gym: [
    "barbell",
    "dumbbell",
    "kettlebell",
    "cable",
    "machine",
    "bodyweight",
    "smith",
    "plate_loaded",
  ],
  dumbbells_only: ["dumbbell", "kettlebell", "bodyweight"],
  barbell_rack: ["barbell", "dumbbell", "bodyweight"],
  machines_only: ["machine", "cable", "plate_loaded", "smith", "bodyweight"],
  bodyweight_only: ["bodyweight"],
  minimal_home_gym: ["dumbbell", "barbell", "kettlebell", "bodyweight"],
};

function toTitleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function shuffleArray<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function sampleOne<T>(items: T[]): T | null {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)];
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
  if (goal === "strength" && duration >= 45) return "hard";
  if (volumeTier === "brutal") return "hard";
  if (duration >= 60 || volumeTier === "high") return "hard";
  if (duration <= 30 && volumeTier === "moderate") return "easy";
  return "moderate";
}

function getWorkoutTitle(
  bodyPart: BodyPart,
  style: WorkoutStyle,
  volumeTier: VolumeTier,
  emphasis?: MuscleEmphasis | ""
) {
  const bodyPartLabel = toTitleCase(bodyPart);
  const styleLabel = STYLE_LABELS[style];
  const volumeLabel =
    volumeTier === "moderate"
      ? "Standard"
      : volumeTier === "high"
      ? "High Volume"
      : "Brutal Volume";

  if (emphasis) {
    return `${bodyPartLabel} • ${styleLabel} • ${toTitleCase(emphasis)} Focus • ${volumeLabel}`;
  }

  return `${bodyPartLabel} • ${styleLabel} • ${volumeLabel}`;
}

function isExerciseValidForUser(
  exercise: Exercise,
  equipmentAccess: EquipmentAccess,
  experienceLevel: ExperienceLevel
) {
  const allowedEquipment = EQUIPMENT_COMPATIBILITY[equipmentAccess];
  const equipmentOk = exercise.equipmentTypes.some((type) =>
    allowedEquipment.includes(type)
  );

  const levelOk = exercise.levels.some(
    (level) => EXPERIENCE_RANK[level] <= EXPERIENCE_RANK[experienceLevel]
  );

  return equipmentOk && levelOk;
}

function getPoolForBodyPart(bodyPart: BodyPart) {
  return exerciseLibrary.filter((exercise) => {
    if (bodyPart === "push") {
      return ["chest", "shoulders", "front_delts", "side_delts", "triceps"].includes(
        exercise.primaryMuscle
      );
    }

    if (bodyPart === "pull") {
      return [
        "back",
        "lats",
        "upper_back",
        "lower_back",
        "rear_delts",
        "biceps",
        "forearms",
      ].includes(exercise.primaryMuscle);
    }

    if (bodyPart === "full_body") return true;

    if (bodyPart === "arms") {
      return ["biceps", "triceps", "forearms"].includes(exercise.primaryMuscle);
    }

    if (bodyPart === "shoulders") {
      return ["shoulders", "front_delts", "side_delts", "rear_delts"].includes(
        exercise.primaryMuscle
      );
    }

    if (bodyPart === "legs") {
      return ["quads", "glutes", "hamstrings", "calves"].includes(exercise.primaryMuscle);
    }

    if (bodyPart === "chest") {
      return ["chest", "front_delts", "triceps"].includes(exercise.primaryMuscle);
    }

    if (bodyPart === "back") {
      return ["back", "lats", "upper_back", "lower_back", "rear_delts", "biceps"].includes(
        exercise.primaryMuscle
      );
    }

    return false;
  });
}

function getLegFocus(emphasis?: MuscleEmphasis | ""): LegFocus {
  if (emphasis === "quad_bias") return "quad_bias";
  if (emphasis === "glute_bias" || emphasis === "hamstring_bias") return "glute_ham_bias";
  return "balanced";
}

function buildSlotSelector(slot: TemplateSlot, bodyPart: BodyPart) {
  return (exercise: Exercise) => {
    switch (slot) {
      case "primary_press":
        return (
          exercise.category === "main" &&
          exercise.movementPattern === "horizontal_press" &&
          exercise.primaryMuscle === "chest"
        );

      case "secondary_press":
        return (
          ["main", "accessory"].includes(exercise.category) &&
          exercise.movementPattern === "horizontal_press" &&
          exercise.primaryMuscle === "chest"
        );

      case "upper_bias_press":
        return (
          ["main", "accessory"].includes(exercise.category) &&
          exercise.movementPattern === "horizontal_press" &&
          exercise.emphasis?.includes("upper_chest")
        );

      case "stable_press":
        return (
          ["main", "accessory"].includes(exercise.category) &&
          exercise.movementPattern === "horizontal_press" &&
          exercise.isStable
        );

      case "stretch_chest_iso":
        return (
          exercise.category === "isolation" &&
          exercise.primaryMuscle === "chest" &&
          exercise.movementPattern === "fly"
        );

      case "squeeze_chest_iso":
        return (
          exercise.category === "isolation" &&
          exercise.primaryMuscle === "chest" &&
          exercise.movementPattern === "fly" &&
          exercise.isStable
        );

      case "back_row_primary":
        return exercise.category === "main" && exercise.movementPattern === "horizontal_pull";

      case "back_row_secondary":
        return (
          ["main", "accessory"].includes(exercise.category) &&
          exercise.movementPattern === "horizontal_pull"
        );

      case "back_vertical_pull":
        return (
          ["main", "accessory"].includes(exercise.category) &&
          (exercise.movementPattern === "vertical_pull" ||
            exercise.movementPattern === "bodyweight_pull")
        );

      case "lat_isolation":
        return (
          exercise.primaryMuscle === "lats" &&
          (exercise.emphasis?.includes("lat_width") ||
            exercise.movementPattern === "vertical_pull")
        );

      case "legs_main_knee":
        return (
          ["main", "accessory"].includes(exercise.category) &&
          ["squat", "lunge"].includes(exercise.movementPattern) &&
          ["quads", "glutes"].includes(exercise.primaryMuscle)
        );

      case "legs_main_hinge":
        return (
          ["main", "accessory"].includes(exercise.category) &&
          exercise.movementPattern === "hinge" &&
          ["hamstrings", "glutes"].includes(exercise.primaryMuscle)
        );

      case "legs_secondary_knee":
        return (
          ["main", "accessory"].includes(exercise.category) &&
          ["squat", "lunge"].includes(exercise.movementPattern)
        );

      case "legs_unilateral":
        return (
          exercise.laterality === "unilateral" &&
          ["quads", "glutes", "hamstrings"].includes(exercise.primaryMuscle)
        );

      case "legs_quad_iso":
        return (
          exercise.category === "isolation" &&
          exercise.primaryMuscle === "quads"
        );

      case "legs_ham_iso":
        return (
          exercise.category === "isolation" &&
          exercise.primaryMuscle === "hamstrings"
        );

      case "legs_glute_iso":
        return (
          (exercise.primaryMuscle === "glutes" &&
            ["accessory", "isolation"].includes(exercise.category)) ||
          exercise.emphasis?.includes("glute_bias")
        );

      case "calves":
        return exercise.primaryMuscle === "calves";

      case "shoulder_press":
        return (
          ["main", "accessory"].includes(exercise.category) &&
          exercise.movementPattern === "vertical_press"
        );

      case "side_delt":
        return (
          exercise.primaryMuscle === "side_delts" &&
          exercise.movementPattern === "raise"
        );

      case "rear_delt":
        return (
          exercise.primaryMuscle === "rear_delts" &&
          exercise.movementPattern === "raise"
        );

      case "biceps_primary":
        return (
          ["accessory", "isolation"].includes(exercise.category) &&
          exercise.primaryMuscle === "biceps" &&
          exercise.movementPattern === "curl"
        );

      case "biceps_secondary":
        return exercise.primaryMuscle === "biceps";

      case "triceps_primary":
        return (
          ["accessory", "isolation"].includes(exercise.category) &&
          exercise.primaryMuscle === "triceps" &&
          exercise.movementPattern === "tricep_extension"
        );

      case "triceps_secondary":
        return exercise.primaryMuscle === "triceps";

      case "core":
        return exercise.primaryMuscle === "core";

      case "finisher":
        if (bodyPart === "chest") {
          return ["chest", "triceps", "front_delts"].includes(exercise.primaryMuscle);
        }
        if (bodyPart === "back") {
          return ["back", "lats", "upper_back", "biceps", "rear_delts"].includes(
            exercise.primaryMuscle
          );
        }
        if (bodyPart === "legs") {
          return ["quads", "glutes", "hamstrings", "calves"].includes(exercise.primaryMuscle);
        }
        if (bodyPart === "shoulders") {
          return ["shoulders", "front_delts", "side_delts", "rear_delts"].includes(
            exercise.primaryMuscle
          );
        }
        if (bodyPart === "arms") {
          return ["biceps", "triceps", "forearms"].includes(exercise.primaryMuscle);
        }
        return true;

      default:
        return false;
    }
  };
}

function getLegTemplate(
  volumeTier: VolumeTier,
  emphasis?: MuscleEmphasis | ""
): SlotDefinition[] {
  const focus = getLegFocus(emphasis);

  if (focus === "quad_bias") {
    if (volumeTier === "brutal") {
      return [
        { slot: "legs_main_knee", sets: 4 },
        { slot: "legs_secondary_knee", sets: 4 },
        { slot: "legs_unilateral", sets: 3 },
        { slot: "legs_quad_iso", sets: 3 },
        { slot: "legs_ham_iso", sets: 3 },
        { slot: "calves", sets: 4 },
      ];
    }

    if (volumeTier === "high") {
      return [
        { slot: "legs_main_knee", sets: 4 },
        { slot: "legs_secondary_knee", sets: 3 },
        { slot: "legs_unilateral", sets: 3 },
        { slot: "legs_quad_iso", sets: 3 },
        { slot: "legs_ham_iso", sets: 2 },
        { slot: "calves", sets: 3 },
      ];
    }

    return [
      { slot: "legs_main_knee", sets: 4 },
      { slot: "legs_unilateral", sets: 3 },
      { slot: "legs_quad_iso", sets: 3 },
      { slot: "legs_ham_iso", sets: 2 },
      { slot: "calves", sets: 3 },
    ];
  }

  if (focus === "glute_ham_bias") {
    if (volumeTier === "brutal") {
      return [
        { slot: "legs_main_hinge", sets: 4 },
        { slot: "legs_unilateral", sets: 4 },
        { slot: "legs_secondary_knee", sets: 3 },
        { slot: "legs_ham_iso", sets: 3 },
        { slot: "legs_glute_iso", sets: 3 },
        { slot: "calves", sets: 4 },
      ];
    }

    if (volumeTier === "high") {
      return [
        { slot: "legs_main_hinge", sets: 4 },
        { slot: "legs_unilateral", sets: 3 },
        { slot: "legs_secondary_knee", sets: 3 },
        { slot: "legs_ham_iso", sets: 3 },
        { slot: "legs_glute_iso", sets: 2 },
        { slot: "calves", sets: 3 },
      ];
    }

    return [
      { slot: "legs_main_hinge", sets: 4 },
      { slot: "legs_unilateral", sets: 3 },
      { slot: "legs_ham_iso", sets: 3 },
      { slot: "legs_glute_iso", sets: 2 },
      { slot: "calves", sets: 3 },
    ];
  }

  if (volumeTier === "brutal") {
    return [
      { slot: "legs_main_knee", sets: 4 },
      { slot: "legs_main_hinge", sets: 4 },
      { slot: "legs_unilateral", sets: 3 },
      { slot: "legs_quad_iso", sets: 3 },
      { slot: "legs_ham_iso", sets: 3 },
      { slot: "calves", sets: 4 },
    ];
  }

  if (volumeTier === "high") {
    return [
      { slot: "legs_main_knee", sets: 4 },
      { slot: "legs_main_hinge", sets: 4 },
      { slot: "legs_unilateral", sets: 3 },
      { slot: "legs_quad_iso", sets: 3 },
      { slot: "legs_ham_iso", sets: 2 },
      { slot: "calves", sets: 3 },
    ];
  }

  return [
    { slot: "legs_main_knee", sets: 4 },
    { slot: "legs_main_hinge", sets: 3 },
    { slot: "legs_unilateral", sets: 3 },
    { slot: "legs_quad_iso", sets: 2 },
    { slot: "legs_ham_iso", sets: 2 },
    { slot: "calves", sets: 3 },
  ];
}

function getTemplate(
  bodyPart: BodyPart,
  volumeTier: VolumeTier,
  emphasis?: MuscleEmphasis | ""
): SlotDefinition[] {
  const upperChestBias = emphasis === "upper_chest";
  const latBias = emphasis === "lat_width";
  const sideDeltBias = emphasis === "side_delt_bias";

  if (bodyPart === "chest") {
    if (volumeTier === "brutal") {
      return [
        { slot: upperChestBias ? "upper_bias_press" : "primary_press", sets: 4 },
        { slot: "secondary_press", sets: 4 },
        { slot: "upper_bias_press", sets: 4 },
        { slot: "stable_press", sets: 4 },
        { slot: "stretch_chest_iso", sets: 3 },
        { slot: "squeeze_chest_iso", sets: 3 },
        { slot: "finisher", sets: 2 },
      ];
    }

    if (volumeTier === "high") {
      return [
        { slot: upperChestBias ? "upper_bias_press" : "primary_press", sets: 4 },
        { slot: "secondary_press", sets: 4 },
        { slot: "stable_press", sets: 3 },
        { slot: "stretch_chest_iso", sets: 3 },
        { slot: "squeeze_chest_iso", sets: 3 },
        { slot: "finisher", sets: 2 },
      ];
    }

    return [
      { slot: upperChestBias ? "upper_bias_press" : "primary_press", sets: 4 },
      { slot: "secondary_press", sets: 3 },
      { slot: "stretch_chest_iso", sets: 3 },
      { slot: "squeeze_chest_iso", sets: 2 },
      { slot: "finisher", sets: 2 },
    ];
  }

  if (bodyPart === "back") {
    if (volumeTier === "brutal") {
      return [
        { slot: latBias ? "back_vertical_pull" : "back_row_primary", sets: 4 },
        { slot: "back_vertical_pull", sets: 4 },
        { slot: "back_row_secondary", sets: 4 },
        { slot: "back_vertical_pull", sets: 3 },
        { slot: "lat_isolation", sets: 3 },
        { slot: "back_row_secondary", sets: 3 },
        { slot: "finisher", sets: 2 },
      ];
    }

    if (volumeTier === "high") {
      return [
        { slot: latBias ? "back_vertical_pull" : "back_row_primary", sets: 4 },
        { slot: "back_vertical_pull", sets: 4 },
        { slot: "back_row_secondary", sets: 3 },
        { slot: "lat_isolation", sets: 3 },
        { slot: "back_row_secondary", sets: 3 },
        { slot: "finisher", sets: 2 },
      ];
    }

    return [
      { slot: latBias ? "back_vertical_pull" : "back_row_primary", sets: 4 },
      { slot: "back_vertical_pull", sets: 3 },
      { slot: "back_row_secondary", sets: 3 },
      { slot: "lat_isolation", sets: 3 },
      { slot: "finisher", sets: 2 },
    ];
  }

  if (bodyPart === "legs") {
    return getLegTemplate(volumeTier, emphasis);
  }

  if (bodyPart === "shoulders") {
    if (volumeTier === "brutal") {
      return [
        { slot: "shoulder_press", sets: 4 },
        { slot: "side_delt", sets: sideDeltBias ? 5 : 4 },
        { slot: "rear_delt", sets: 4 },
        { slot: "shoulder_press", sets: 3 },
        { slot: "side_delt", sets: 4 },
        { slot: "rear_delt", sets: 3 },
      ];
    }

    if (volumeTier === "high") {
      return [
        { slot: "shoulder_press", sets: 4 },
        { slot: "side_delt", sets: sideDeltBias ? 5 : 4 },
        { slot: "rear_delt", sets: 3 },
        { slot: "side_delt", sets: 3 },
        { slot: "rear_delt", sets: 3 },
      ];
    }

    return [
      { slot: "shoulder_press", sets: 4 },
      { slot: "side_delt", sets: 3 },
      { slot: "rear_delt", sets: 3 },
      { slot: "side_delt", sets: 3 },
    ];
  }

  if (bodyPart === "arms") {
    if (volumeTier === "brutal") {
      return [
        { slot: "biceps_primary", sets: 4 },
        { slot: "triceps_primary", sets: 4 },
        { slot: "biceps_secondary", sets: 4 },
        { slot: "triceps_secondary", sets: 4 },
        { slot: "biceps_secondary", sets: 3 },
        { slot: "triceps_secondary", sets: 3 },
      ];
    }

    if (volumeTier === "high") {
      return [
        { slot: "biceps_primary", sets: 4 },
        { slot: "triceps_primary", sets: 4 },
        { slot: "biceps_secondary", sets: 3 },
        { slot: "triceps_secondary", sets: 3 },
        { slot: "biceps_secondary", sets: 3 },
        { slot: "triceps_secondary", sets: 3 },
      ];
    }

    return [
      { slot: "biceps_primary", sets: 3 },
      { slot: "triceps_primary", sets: 3 },
      { slot: "biceps_secondary", sets: 3 },
      { slot: "triceps_secondary", sets: 3 },
    ];
  }

  if (bodyPart === "push") {
    return [
      ...getTemplate("chest", volumeTier === "brutal" ? "high" : "moderate", emphasis).slice(
        0,
        3
      ),
      ...getTemplate("shoulders", "moderate", emphasis).slice(0, 2),
      ...getTemplate("arms", "moderate", emphasis).slice(1, 2),
    ];
  }

  if (bodyPart === "pull") {
    return [
      ...getTemplate("back", volumeTier === "brutal" ? "high" : "moderate", emphasis).slice(
        0,
        4
      ),
      { slot: "rear_delt", sets: 3 },
      { slot: "biceps_primary", sets: 3 },
    ];
  }

  if (bodyPart === "full_body") {
    return [
      { slot: "legs_main_knee", sets: 3 },
      { slot: "back_row_primary", sets: 3 },
      { slot: "primary_press", sets: 3 },
      { slot: "back_vertical_pull", sets: 3 },
      { slot: "shoulder_press", sets: 2 },
      { slot: "core", sets: 3 },
    ];
  }

  return [{ slot: "core", sets: 3 }];
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

    if (
      ["quads", "glutes", "hamstrings"].includes(exercise.primaryMuscle) &&
      exercise.isStable
    ) {
      score += 2;
    }
  }

  if (goal === "fat_loss") {
    if (exercise.category === "accessory") score += 2;
    if (
      ["lunge", "core", "bodyweight_push", "bodyweight_pull"].includes(
        exercise.movementPattern
      )
    ) {
      score += 2;
    }
    if (
      ["quads", "glutes", "hamstrings"].includes(exercise.primaryMuscle) &&
      exercise.isStable
    ) {
      score += 1;
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

  if (
    emphasis === "glute_bias" &&
    ["glutes", "hamstrings"].includes(exercise.primaryMuscle)
  ) {
    return 3;
  }

  return 0;
}

function scoreExerciseForStructure(
  exercise: Exercise,
  selected: Exercise[],
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

  if (bodyPart === "legs") {
    score -= samePatternCount * 1;
  } else {
    score -= samePatternCount * 3;
  }

  if (
    exercise.category === "main" &&
    selected.filter((item) => item.category === "main").length >= 2 &&
    bodyPart !== "legs"
  ) {
    score -= 3;
  }

  return score;
}

function pickRepRange(goal: Goal, style: WorkoutStyle, exercise: Exercise) {
  if (goal === "strength") {
    if (exercise.category === "main") return "4-6";
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
    if (exercise.category === "main") {
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

function buildExerciseCoachingNote(
  exercise: Exercise,
  goal: Goal,
  style: WorkoutStyle,
  slot: TemplateSlot
) {
  if (slot === "finisher") {
    return "Finisher work. Push hard, chase tension, and finish the session with intent.";
  }

  if (exercise.category === "main") {
    if (goal === "strength") {
      return "Main lift. Prioritize crisp reps, strong setup, and force output.";
    }
    if (style === "bodybuilding" || style === "high_volume") {
      return "Main movement. Push performance, but keep every rep controlled and repeatable.";
    }
    return "Main movement. Own your setup and execute clean working sets.";
  }

  if (exercise.category === "accessory") {
    return "Accessory work. Controlled reps, full range, and honest effort.";
  }

  return "Isolation work. Keep tension on the target muscle and avoid ego loading.";
}

function buildExerciseReason(
  exercise: Exercise,
  bodyPart: BodyPart,
  slot: TemplateSlot,
  emphasis?: MuscleEmphasis | ""
) {
  if (
    slot === "primary_press" ||
    slot === "back_row_primary" ||
    slot === "legs_main_knee" ||
    slot === "legs_main_hinge" ||
    slot === "shoulder_press"
  ) {
    return "Included as a primary anchor movement to drive the session.";
  }

  if (slot === "finisher") {
    return "Included to finish the session with extra fatigue and targeted stimulus.";
  }

  if (emphasis && exercise.emphasis?.includes(emphasis)) {
    return `Included to support your ${toTitleCase(emphasis)} emphasis.`;
  }

  if (exercise.category === "isolation") {
    return "Included for targeted isolation volume and a stronger hypertrophy stimulus.";
  }

  return `Included to round out your ${toTitleCase(bodyPart)} session with better movement balance.`;
}

function buildCoachNote(params: {
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
    goal,
    bodyPart,
    experienceLevel,
    duration,
    equipmentAccess,
    style,
    volumeTier,
    emphasis,
    totalWorkingSets,
  } = params;

  const styleText =
    style === "bodybuilding"
      ? "This session is built with a bodybuilding bias: strong compounds, stable accessories, and targeted pump work."
      : style === "high_volume"
      ? "This session is built to push a lot of productive hypertrophy volume."
      : style === "old_school_mass"
      ? "This session leans into a heavier old-school mass-building feel."
      : style === "pump"
      ? "This session is built to chase tension, short rests, and a big pump."
      : style === "strength_size"
      ? "This session blends heavier loading with enough volume to grow."
      : style === "intensity"
      ? "This session is built around hard work, lower fluff, and strong effort."
      : "This session balances quality compounds, useful accessories, and recoverable volume.";

  const focus = ` Focus is ${toTitleCase(bodyPart)} with ${totalWorkingSets} working sets across roughly ${duration} minutes using ${toTitleCase(
    equipmentAccess
  ).toLowerCase()}.`;

  const level = ` Programming is scaled for a ${experienceLevel} lifter.`;

  const goalNote =
    goal === "strength"
      ? " Main lifts should stay crisp and powerful."
      : goal === "hypertrophy"
      ? " Keep tension high and execution clean."
      : goal === "fat_loss"
      ? " Keep the pace honest without sacrificing lifting quality."
      : " Aim for clean progression and consistency.";

  const emphasisNote = emphasis
    ? ` Extra selection bias was applied toward ${toTitleCase(emphasis)}.`
    : "";

  const volumeNote =
    volumeTier === "brutal"
      ? " This is a high-demand session, so do not waste effort on junk reps."
      : volumeTier === "high"
      ? " Expect a fuller session with meaningful volume."
      : "";

  return `${styleText}${focus}${level}${goalNote}${emphasisNote}${volumeNote}`;
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
    advice.push("On primary compounds, rest fully and earn load jumps instead of grinding every set.");
  } else if (style === "bodybuilding" || style === "high_volume") {
    advice.push("Use controlled eccentrics and keep tension high instead of rushing reps.");
  } else if (style === "pump") {
    advice.push("Keep rest tight, but never sacrifice rep quality just to move faster.");
  } else {
    advice.push("Prioritize repeatable execution and steady progression over aggressive jumps.");
  }

  if (bodyPart === "legs" && totalWorkingSets >= 20) {
    advice.push("On high-volume leg days, protect your first main lift so the later work still has quality.");
  }

  if (bodyPart === "shoulders" || bodyPart === "arms") {
    advice.push("For smaller-muscle lifts, smaller jumps and extra reps usually beat forcing heavy increases.");
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

function pickBestExercise(params: {
  candidates: Exercise[];
  selected: Exercise[];
  style: WorkoutStyle;
  goal: Goal;
  emphasis?: MuscleEmphasis | "";
  usedIds: Set<string>;
  bodyPart: BodyPart;
  allowSameMovement?: boolean;
  variationIndex?: number;
}) {
  const {
    candidates,
    selected,
    style,
    goal,
    emphasis,
    usedIds,
    bodyPart,
    allowSameMovement = false,
    variationIndex = 0,
  } = params;

  const usedPatterns = selected.map((exercise) => exercise.movementPattern);

  const available = candidates.filter((exercise) => {
    if (usedIds.has(exercise.id)) return false;
    if (!allowSameMovement && usedPatterns.includes(exercise.movementPattern) && bodyPart !== "legs") {
      return false;
    }
    return true;
  });

  const pool = available.length
    ? available
    : candidates.filter((exercise) => !usedIds.has(exercise.id));

  if (!pool.length) return null;

  const rotatedPool = rotateArray(pool, variationIndex);

  const scored = rotatedPool.map((exercise, index) => {
    let score = 0;
    score += scoreExerciseForStyle(exercise, style);
    score += scoreExerciseForGoal(exercise, goal);
    score += scoreExerciseForEmphasis(exercise, emphasis);
    score += scoreExerciseForStructure(exercise, selected, bodyPart);

    if (index < 3) score += 2;
    else if (index < 6) score += 1;

    return { exercise, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const topScore = scored[0]?.score ?? 0;
  const topPool = scored
    .filter((item) => item.score >= topScore - 2)
    .map((item) => item.exercise);

  const rotatedTopPool = rotateArray(topPool, variationIndex);

  return rotatedTopPool[0] ?? sampleOne(topPool);
}

function attachFinisherNotes(style: WorkoutStyle) {
  if (style === "bodybuilding") return "Final set can be taken very close to failure.";
  if (style === "high_volume") return "Final isolation movement can use a dropset if recovery is good.";
  if (style === "intensity") return "Final set can use rest-pause if form stays clean.";
  if (style === "pump") return "Short rests and a hard final squeeze are encouraged.";
  if (style === "old_school_mass") return "Push the final hard set with controlled aggression.";
  return null;
}

function mergeDuplicateSelections(
  selected: Array<{ exercise: Exercise; slot: TemplateSlot; setCount: number }>
) {
  const merged: Array<{ exercise: Exercise; slot: TemplateSlot; setCount: number }> = [];

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

export function generateWorkout({
  bodyPart,
  goal,
  duration,
  experienceLevel,
  equipmentAccess,
  style = "bodybuilding",
  volumeTier = "high",
  emphasis = "",
  variationIndex = 0,
}: GenerateWorkoutInput): GeneratedWorkout {
  const pool = getPoolForBodyPart(bodyPart).filter((exercise) =>
    isExerciseValidForUser(exercise, equipmentAccess, experienceLevel)
  );

  const template = getTemplate(bodyPart, volumeTier, emphasis);
  const selected: Array<{ exercise: Exercise; slot: TemplateSlot; setCount: number }> = [];
  const usedIds = new Set<string>();

  template.forEach((slotDef, slotIndex) => {
    const selector = buildSlotSelector(slotDef.slot, bodyPart);
    const candidates = pool.filter(selector);

    const allowSameMovement = [
      "side_delt",
      "rear_delt",
      "biceps_secondary",
      "triceps_secondary",
      "finisher",
      "legs_secondary_knee",
      "legs_unilateral",
    ].includes(slotDef.slot);

    const chosen = pickBestExercise({
      candidates,
      selected: selected.map((item) => item.exercise),
      style,
      goal,
      emphasis,
      usedIds,
      bodyPart,
      allowSameMovement,
      variationIndex: variationIndex + slotIndex,
    });

    if (!chosen) {
      if (!slotDef.optional) {
        const fallbackCandidates = pool.filter((exercise) => !usedIds.has(exercise.id));
        const fallback = pickBestExercise({
          candidates: fallbackCandidates,
          selected: selected.map((item) => item.exercise),
          style,
          goal,
          emphasis,
          usedIds,
          bodyPart,
          allowSameMovement: true,
          variationIndex: variationIndex + slotIndex,
        });

        if (fallback) {
          selected.push({
            exercise: fallback,
            slot: slotDef.slot,
            setCount: slotDef.sets,
          });
          usedIds.add(fallback.id);
        }
      }
      return;
    }

    selected.push({
      exercise: chosen,
      slot: slotDef.slot,
      setCount: slotDef.sets,
    });
    usedIds.add(chosen.id);
  });

  if (selected.length < 4) {
    const fallback = rotateArray(
      shuffleArray(pool).filter((exercise) => !usedIds.has(exercise.id)),
      variationIndex
    ).slice(0, 3);

    fallback.forEach((exercise) => {
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
      reason: buildExerciseReason(item.exercise, bodyPart, item.slot, emphasis),
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
    workout_name: getWorkoutTitle(bodyPart, style, volumeTier, emphasis),
    body_part: bodyPart,
    estimated_duration: estimatedDuration,
    totalWorkingSets,
    workoutStyle: STYLE_LABELS[style],
    emphasis,
    coachNote: buildCoachNote({
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