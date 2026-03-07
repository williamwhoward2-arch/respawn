export type Goal = "strength" | "hypertrophy" | "fat_loss" | "general";

export type BodyPart =
  | "chest"
  | "back"
  | "legs"
  | "shoulders"
  | "arms"
  | "push"
  | "pull"
  | "full_body";

export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export type EquipmentAccess =
  | "full_gym"
  | "dumbbells_only"
  | "barbell_rack"
  | "machines_only"
  | "bodyweight_only"
  | "minimal_home_gym";

export type ExerciseCategory = "main" | "accessory" | "isolation";

export type Muscle =
  | "chest"
  | "back"
  | "lats"
  | "upper_back"
  | "lower_back"
  | "shoulders"
  | "front_delts"
  | "side_delts"
  | "rear_delts"
  | "biceps"
  | "triceps"
  | "forearms"
  | "quads"
  | "glutes"
  | "hamstrings"
  | "calves"
  | "core";

export type MovementPattern =
  | "horizontal_press"
  | "vertical_press"
  | "horizontal_pull"
  | "vertical_pull"
  | "squat"
  | "hinge"
  | "lunge"
  | "curl"
  | "tricep_extension"
  | "fly"
  | "raise"
  | "calves"
  | "core"
  | "bodyweight_push"
  | "bodyweight_pull";

export type BiomechanicalPattern =
  | "compound_press"
  | "compound_pull"
  | "squat_pattern"
  | "hip_hinge"
  | "single_leg"
  | "knee_extension"
  | "knee_flexion"
  | "shoulder_abduction"
  | "rear_delt_isolation"
  | "elbow_flexion"
  | "elbow_extension"
  | "chest_fly"
  | "core_flexion"
  | "core_stability"
  | "calf_plantarflexion"
  | "hip_abduction"
  | "hip_adduction";

export type EquipmentType =
  | "barbell"
  | "dumbbell"
  | "kettlebell"
  | "cable"
  | "machine"
  | "bodyweight";

export type WorkoutTag =
  | "push"
  | "pull"
  | "full_body"
  | "upper"
  | "lower"
  | "female_friendly"
  | "glute_friendly"
  | "beginner_friendly";

export type Laterality = "bilateral" | "unilateral";

export type FatigueCost = 1 | 2 | 3 | 4 | 5;
export type Complexity = 1 | 2 | 3 | 4 | 5;

export type JointArea = "shoulders" | "elbows" | "knees" | "lower_back" | "hips";
export type JointStress = "low" | "moderate" | "high";

export type ProgressionType =
  | "load_reps"
  | "reps_only"
  | "bodyweight_reps"
  | "assistance_reduction"
  | "time_hold";

export type MuscleEmphasis =
  | "upper_chest"
  | "mid_chest"
  | "lower_chest"
  | "lat_width"
  | "mid_back_thickness"
  | "upper_back_detail"
  | "quad_bias"
  | "glute_bias"
  | "hamstring_bias"
  | "front_delt_bias"
  | "side_delt_bias"
  | "rear_delt_bias"
  | "tricep_long_head"
  | "bicep_peak"
  | "core_stability";

export type Exercise = {
  id: string;
  name: string;
  primaryMuscle: Muscle;
  secondaryMuscles: Muscle[];
  category: ExerciseCategory;
  movementPattern: MovementPattern;
  biomechanicalPattern: BiomechanicalPattern;
  equipmentTypes: EquipmentType[];
  equipmentAccess: EquipmentAccess[];
  levels: ExperienceLevel[];
  workoutTags: WorkoutTag[];

  laterality: Laterality;
  fatigueCost: FatigueCost;
  complexity: Complexity;

  jointStress: JointStress;
  jointStressAreas: JointArea[];

  progressionType: ProgressionType;
  emphasis?: MuscleEmphasis[];

  isPrimaryCompound: boolean;
  isStable: boolean;
};

export const exerciseLibrary: Exercise[] = [
  {
    id: "bench_press",
    name: "Bench Press",
    primaryMuscle: "chest",
    secondaryMuscles: ["front_delts", "triceps"],
    category: "main",
    movementPattern: "horizontal_press",
    biomechanicalPattern: "compound_press",
    equipmentTypes: ["barbell"],
    equipmentAccess: ["full_gym", "barbell_rack"],
    levels: ["intermediate", "advanced"],
    workoutTags: ["push", "upper", "full_body"],
    laterality: "bilateral",
    fatigueCost: 4,
    complexity: 4,
    jointStress: "moderate",
    jointStressAreas: ["shoulders", "elbows"],
    progressionType: "load_reps",
    emphasis: ["mid_chest"],
    isPrimaryCompound: true,
    isStable: false,
  },
  {
    id: "incline_bench_press",
    name: "Incline Bench Press",
    primaryMuscle: "chest",
    secondaryMuscles: ["front_delts", "triceps"],
    category: "main",
    movementPattern: "horizontal_press",
    biomechanicalPattern: "compound_press",
    equipmentTypes: ["barbell"],
    equipmentAccess: ["full_gym", "barbell_rack"],
    levels: ["intermediate", "advanced"],
    workoutTags: ["push", "upper", "full_body"],
    laterality: "bilateral",
    fatigueCost: 4,
    complexity: 4,
    jointStress: "moderate",
    jointStressAreas: ["shoulders", "elbows"],
    progressionType: "load_reps",
    emphasis: ["upper_chest"],
    isPrimaryCompound: true,
    isStable: false,
  },
  {
    id: "dumbbell_bench_press",
    name: "Dumbbell Bench Press",
    primaryMuscle: "chest",
    secondaryMuscles: ["front_delts", "triceps"],
    category: "main",
    movementPattern: "horizontal_press",
    biomechanicalPattern: "compound_press",
    equipmentTypes: ["dumbbell"],
    equipmentAccess: ["full_gym", "dumbbells_only", "minimal_home_gym"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["push", "upper", "full_body", "beginner_friendly", "female_friendly"],
    laterality: "bilateral",
    fatigueCost: 3,
    complexity: 3,
    jointStress: "low",
    jointStressAreas: ["shoulders"],
    progressionType: "load_reps",
    emphasis: ["mid_chest"],
    isPrimaryCompound: true,
    isStable: false,
  },
  {
    id: "incline_dumbbell_press",
    name: "Incline Dumbbell Press",
    primaryMuscle: "chest",
    secondaryMuscles: ["front_delts", "triceps"],
    category: "accessory",
    movementPattern: "horizontal_press",
    biomechanicalPattern: "compound_press",
    equipmentTypes: ["dumbbell"],
    equipmentAccess: ["full_gym", "dumbbells_only", "minimal_home_gym"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["push", "upper", "full_body", "beginner_friendly", "female_friendly"],
    laterality: "bilateral",
    fatigueCost: 3,
    complexity: 3,
    jointStress: "low",
    jointStressAreas: ["shoulders"],
    progressionType: "load_reps",
    emphasis: ["upper_chest"],
    isPrimaryCompound: false,
    isStable: false,
  },
  {
    id: "chest_press_machine",
    name: "Chest Press Machine",
    primaryMuscle: "chest",
    secondaryMuscles: ["front_delts", "triceps"],
    category: "main",
    movementPattern: "horizontal_press",
    biomechanicalPattern: "compound_press",
    equipmentTypes: ["machine"],
    equipmentAccess: ["full_gym", "machines_only"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["push", "upper", "full_body", "beginner_friendly", "female_friendly"],
    laterality: "bilateral",
    fatigueCost: 2,
    complexity: 1,
    jointStress: "low",
    jointStressAreas: ["shoulders"],
    progressionType: "load_reps",
    emphasis: ["mid_chest"],
    isPrimaryCompound: true,
    isStable: true,
  },
  {
    id: "cable_fly",
    name: "Cable Fly",
    primaryMuscle: "chest",
    secondaryMuscles: ["front_delts"],
    category: "isolation",
    movementPattern: "fly",
    biomechanicalPattern: "chest_fly",
    equipmentTypes: ["cable"],
    equipmentAccess: ["full_gym"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["push", "upper", "female_friendly", "beginner_friendly"],
    laterality: "bilateral",
    fatigueCost: 1,
    complexity: 2,
    jointStress: "low",
    jointStressAreas: ["shoulders"],
    progressionType: "load_reps",
    emphasis: ["mid_chest"],
    isPrimaryCompound: false,
    isStable: true,
  },
  {
    id: "pec_deck",
    name: "Pec Deck",
    primaryMuscle: "chest",
    secondaryMuscles: ["front_delts"],
    category: "isolation",
    movementPattern: "fly",
    biomechanicalPattern: "chest_fly",
    equipmentTypes: ["machine"],
    equipmentAccess: ["full_gym", "machines_only"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["push", "upper", "female_friendly", "beginner_friendly"],
    laterality: "bilateral",
    fatigueCost: 1,
    complexity: 1,
    jointStress: "low",
    jointStressAreas: ["shoulders"],
    progressionType: "load_reps",
    emphasis: ["mid_chest"],
    isPrimaryCompound: false,
    isStable: true,
  },
  {
    id: "push_ups",
    name: "Push-Ups",
    primaryMuscle: "chest",
    secondaryMuscles: ["front_delts", "triceps", "core"],
    category: "accessory",
    movementPattern: "bodyweight_push",
    biomechanicalPattern: "compound_press",
    equipmentTypes: ["bodyweight"],
    equipmentAccess: ["full_gym", "bodyweight_only", "minimal_home_gym", "dumbbells_only", "barbell_rack"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["push", "upper", "full_body", "beginner_friendly"],
    laterality: "bilateral",
    fatigueCost: 2,
    complexity: 1,
    jointStress: "low",
    jointStressAreas: ["shoulders"],
    progressionType: "bodyweight_reps",
    emphasis: ["mid_chest"],
    isPrimaryCompound: false,
    isStable: true,
  },

  {
    id: "barbell_row",
    name: "Barbell Row",
    primaryMuscle: "back",
    secondaryMuscles: ["lats", "upper_back", "biceps"],
    category: "main",
    movementPattern: "horizontal_pull",
    biomechanicalPattern: "compound_pull",
    equipmentTypes: ["barbell"],
    equipmentAccess: ["full_gym", "barbell_rack"],
    levels: ["intermediate", "advanced"],
    workoutTags: ["pull", "upper", "full_body"],
    laterality: "bilateral",
    fatigueCost: 4,
    complexity: 4,
    jointStress: "moderate",
    jointStressAreas: ["lower_back"],
    progressionType: "load_reps",
    emphasis: ["mid_back_thickness"],
    isPrimaryCompound: true,
    isStable: false,
  },
  {
    id: "lat_pulldown",
    name: "Lat Pulldown",
    primaryMuscle: "lats",
    secondaryMuscles: ["back", "biceps"],
    category: "main",
    movementPattern: "vertical_pull",
    biomechanicalPattern: "compound_pull",
    equipmentTypes: ["cable", "machine"],
    equipmentAccess: ["full_gym", "machines_only"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["pull", "upper", "full_body", "beginner_friendly", "female_friendly"],
    laterality: "bilateral",
    fatigueCost: 2,
    complexity: 1,
    jointStress: "low",
    jointStressAreas: ["shoulders", "elbows"],
    progressionType: "load_reps",
    emphasis: ["lat_width"],
    isPrimaryCompound: true,
    isStable: true,
  },
  {
    id: "seated_cable_row",
    name: "Seated Cable Row",
    primaryMuscle: "back",
    secondaryMuscles: ["lats", "upper_back", "biceps"],
    category: "accessory",
    movementPattern: "horizontal_pull",
    biomechanicalPattern: "compound_pull",
    equipmentTypes: ["cable", "machine"],
    equipmentAccess: ["full_gym", "machines_only"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["pull", "upper", "full_body", "beginner_friendly", "female_friendly"],
    laterality: "bilateral",
    fatigueCost: 2,
    complexity: 1,
    jointStress: "low",
    jointStressAreas: ["elbows"],
    progressionType: "load_reps",
    emphasis: ["mid_back_thickness"],
    isPrimaryCompound: false,
    isStable: true,
  },
  {
    id: "single_arm_dumbbell_row",
    name: "Single Arm Dumbbell Row",
    primaryMuscle: "back",
    secondaryMuscles: ["lats", "upper_back", "biceps"],
    category: "accessory",
    movementPattern: "horizontal_pull",
    biomechanicalPattern: "compound_pull",
    equipmentTypes: ["dumbbell"],
    equipmentAccess: ["full_gym", "dumbbells_only", "minimal_home_gym"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["pull", "upper", "full_body", "beginner_friendly"],
    laterality: "unilateral",
    fatigueCost: 2,
    complexity: 2,
    jointStress: "low",
    jointStressAreas: ["lower_back"],
    progressionType: "load_reps",
    emphasis: ["mid_back_thickness"],
    isPrimaryCompound: false,
    isStable: true,
  },

  {
    id: "back_squat",
    name: "Back Squat",
    primaryMuscle: "quads",
    secondaryMuscles: ["glutes", "hamstrings", "core"],
    category: "main",
    movementPattern: "squat",
    biomechanicalPattern: "squat_pattern",
    equipmentTypes: ["barbell"],
    equipmentAccess: ["full_gym", "barbell_rack"],
    levels: ["intermediate", "advanced"],
    workoutTags: ["lower", "full_body"],
    laterality: "bilateral",
    fatigueCost: 5,
    complexity: 4,
    jointStress: "moderate",
    jointStressAreas: ["knees", "lower_back", "hips"],
    progressionType: "load_reps",
    emphasis: ["quad_bias"],
    isPrimaryCompound: true,
    isStable: false,
  },
  {
    id: "goblet_squat",
    name: "Goblet Squat",
    primaryMuscle: "quads",
    secondaryMuscles: ["glutes", "core"],
    category: "accessory",
    movementPattern: "squat",
    biomechanicalPattern: "squat_pattern",
    equipmentTypes: ["dumbbell", "kettlebell"],
    equipmentAccess: ["full_gym", "dumbbells_only", "minimal_home_gym"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["lower", "full_body", "beginner_friendly", "female_friendly"],
    laterality: "bilateral",
    fatigueCost: 2,
    complexity: 2,
    jointStress: "low",
    jointStressAreas: ["knees", "hips"],
    progressionType: "load_reps",
    emphasis: ["quad_bias"],
    isPrimaryCompound: false,
    isStable: true,
  },
  {
    id: "leg_press",
    name: "Leg Press",
    primaryMuscle: "quads",
    secondaryMuscles: ["glutes", "hamstrings"],
    category: "main",
    movementPattern: "squat",
    biomechanicalPattern: "squat_pattern",
    equipmentTypes: ["machine"],
    equipmentAccess: ["full_gym", "machines_only"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["lower", "full_body", "beginner_friendly", "female_friendly"],
    laterality: "bilateral",
    fatigueCost: 3,
    complexity: 1,
    jointStress: "moderate",
    jointStressAreas: ["knees", "hips"],
    progressionType: "load_reps",
    emphasis: ["quad_bias"],
    isPrimaryCompound: true,
    isStable: true,
  },
  {
    id: "leg_extension",
    name: "Leg Extension",
    primaryMuscle: "quads",
    secondaryMuscles: [],
    category: "isolation",
    movementPattern: "squat",
    biomechanicalPattern: "knee_extension",
    equipmentTypes: ["machine"],
    equipmentAccess: ["full_gym", "machines_only"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["lower", "beginner_friendly", "female_friendly"],
    laterality: "bilateral",
    fatigueCost: 1,
    complexity: 1,
    jointStress: "moderate",
    jointStressAreas: ["knees"],
    progressionType: "load_reps",
    emphasis: ["quad_bias"],
    isPrimaryCompound: false,
    isStable: true,
  },
  {
    id: "romanian_deadlift",
    name: "Romanian Deadlift",
    primaryMuscle: "hamstrings",
    secondaryMuscles: ["glutes", "lower_back"],
    category: "main",
    movementPattern: "hinge",
    biomechanicalPattern: "hip_hinge",
    equipmentTypes: ["barbell", "dumbbell"],
    equipmentAccess: ["full_gym", "barbell_rack", "dumbbells_only", "minimal_home_gym"],
    levels: ["intermediate", "advanced"],
    workoutTags: ["lower", "full_body", "glute_friendly"],
    laterality: "bilateral",
    fatigueCost: 4,
    complexity: 3,
    jointStress: "moderate",
    jointStressAreas: ["lower_back", "hips"],
    progressionType: "load_reps",
    emphasis: ["hamstring_bias", "glute_bias"],
    isPrimaryCompound: true,
    isStable: false,
  },
  {
    id: "hamstring_curl",
    name: "Hamstring Curl",
    primaryMuscle: "hamstrings",
    secondaryMuscles: [],
    category: "isolation",
    movementPattern: "hinge",
    biomechanicalPattern: "knee_flexion",
    equipmentTypes: ["machine"],
    equipmentAccess: ["full_gym", "machines_only"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["lower", "beginner_friendly", "female_friendly", "glute_friendly"],
    laterality: "bilateral",
    fatigueCost: 1,
    complexity: 1,
    jointStress: "low",
    jointStressAreas: ["knees"],
    progressionType: "load_reps",
    emphasis: ["hamstring_bias"],
    isPrimaryCompound: false,
    isStable: true,
  },

  {
    id: "overhead_press",
    name: "Overhead Press",
    primaryMuscle: "shoulders",
    secondaryMuscles: ["front_delts", "triceps", "core"],
    category: "main",
    movementPattern: "vertical_press",
    biomechanicalPattern: "compound_press",
    equipmentTypes: ["barbell"],
    equipmentAccess: ["full_gym", "barbell_rack"],
    levels: ["intermediate", "advanced"],
    workoutTags: ["push", "upper", "full_body"],
    laterality: "bilateral",
    fatigueCost: 4,
    complexity: 4,
    jointStress: "moderate",
    jointStressAreas: ["shoulders", "lower_back"],
    progressionType: "load_reps",
    emphasis: ["front_delt_bias"],
    isPrimaryCompound: true,
    isStable: false,
  },
  {
    id: "seated_dumbbell_press",
    name: "Seated Dumbbell Press",
    primaryMuscle: "shoulders",
    secondaryMuscles: ["front_delts", "triceps"],
    category: "main",
    movementPattern: "vertical_press",
    biomechanicalPattern: "compound_press",
    equipmentTypes: ["dumbbell"],
    equipmentAccess: ["full_gym", "dumbbells_only", "minimal_home_gym"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["push", "upper", "full_body", "beginner_friendly", "female_friendly"],
    laterality: "bilateral",
    fatigueCost: 3,
    complexity: 2,
    jointStress: "low",
    jointStressAreas: ["shoulders"],
    progressionType: "load_reps",
    emphasis: ["front_delt_bias"],
    isPrimaryCompound: true,
    isStable: true,
  },
  {
    id: "lateral_raises",
    name: "Lateral Raises",
    primaryMuscle: "side_delts",
    secondaryMuscles: ["shoulders"],
    category: "isolation",
    movementPattern: "raise",
    biomechanicalPattern: "shoulder_abduction",
    equipmentTypes: ["dumbbell"],
    equipmentAccess: ["full_gym", "dumbbells_only", "minimal_home_gym"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["push", "upper", "full_body", "female_friendly", "beginner_friendly"],
    laterality: "bilateral",
    fatigueCost: 1,
    complexity: 1,
    jointStress: "low",
    jointStressAreas: ["shoulders"],
    progressionType: "load_reps",
    emphasis: ["side_delt_bias"],
    isPrimaryCompound: false,
    isStable: true,
  },
  {
    id: "rear_delt_fly",
    name: "Rear Delt Fly",
    primaryMuscle: "rear_delts",
    secondaryMuscles: ["upper_back"],
    category: "isolation",
    movementPattern: "raise",
    biomechanicalPattern: "rear_delt_isolation",
    equipmentTypes: ["dumbbell", "machine"],
    equipmentAccess: ["full_gym", "dumbbells_only", "machines_only", "minimal_home_gym"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["pull", "upper", "full_body", "female_friendly", "beginner_friendly"],
    laterality: "bilateral",
    fatigueCost: 1,
    complexity: 1,
    jointStress: "low",
    jointStressAreas: ["shoulders"],
    progressionType: "load_reps",
    emphasis: ["rear_delt_bias"],
    isPrimaryCompound: false,
    isStable: true,
  },

  {
    id: "barbell_curl",
    name: "Barbell Curl",
    primaryMuscle: "biceps",
    secondaryMuscles: ["forearms"],
    category: "accessory",
    movementPattern: "curl",
    biomechanicalPattern: "elbow_flexion",
    equipmentTypes: ["barbell"],
    equipmentAccess: ["full_gym", "barbell_rack"],
    levels: ["intermediate", "advanced"],
    workoutTags: ["pull", "upper"],
    laterality: "bilateral",
    fatigueCost: 1,
    complexity: 2,
    jointStress: "moderate",
    jointStressAreas: ["elbows"],
    progressionType: "load_reps",
    emphasis: ["bicep_peak"],
    isPrimaryCompound: false,
    isStable: true,
  },
  {
    id: "hammer_curls",
    name: "Hammer Curls",
    primaryMuscle: "biceps",
    secondaryMuscles: ["forearms"],
    category: "accessory",
    movementPattern: "curl",
    biomechanicalPattern: "elbow_flexion",
    equipmentTypes: ["dumbbell"],
    equipmentAccess: ["full_gym", "dumbbells_only", "minimal_home_gym"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["pull", "upper", "beginner_friendly"],
    laterality: "bilateral",
    fatigueCost: 1,
    complexity: 1,
    jointStress: "low",
    jointStressAreas: ["elbows"],
    progressionType: "load_reps",
    emphasis: ["bicep_peak"],
    isPrimaryCompound: false,
    isStable: true,
  },
  {
    id: "tricep_pressdown",
    name: "Tricep Pressdown",
    primaryMuscle: "triceps",
    secondaryMuscles: [],
    category: "isolation",
    movementPattern: "tricep_extension",
    biomechanicalPattern: "elbow_extension",
    equipmentTypes: ["cable"],
    equipmentAccess: ["full_gym"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["push", "upper", "beginner_friendly", "female_friendly"],
    laterality: "bilateral",
    fatigueCost: 1,
    complexity: 1,
    jointStress: "low",
    jointStressAreas: ["elbows"],
    progressionType: "load_reps",
    emphasis: ["tricep_long_head"],
    isPrimaryCompound: false,
    isStable: true,
  },
  {
    id: "skull_crushers",
    name: "Skull Crushers",
    primaryMuscle: "triceps",
    secondaryMuscles: [],
    category: "accessory",
    movementPattern: "tricep_extension",
    biomechanicalPattern: "elbow_extension",
    equipmentTypes: ["barbell", "dumbbell"],
    equipmentAccess: ["full_gym", "barbell_rack", "dumbbells_only"],
    levels: ["intermediate", "advanced"],
    workoutTags: ["push", "upper"],
    laterality: "bilateral",
    fatigueCost: 2,
    complexity: 2,
    jointStress: "high",
    jointStressAreas: ["elbows"],
    progressionType: "load_reps",
    emphasis: ["tricep_long_head"],
    isPrimaryCompound: false,
    isStable: true,
  },

  {
    id: "plank",
    name: "Plank",
    primaryMuscle: "core",
    secondaryMuscles: ["shoulders"],
    category: "accessory",
    movementPattern: "core",
    biomechanicalPattern: "core_stability",
    equipmentTypes: ["bodyweight"],
    equipmentAccess: ["full_gym", "bodyweight_only", "minimal_home_gym", "dumbbells_only", "barbell_rack", "machines_only"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["full_body", "beginner_friendly"],
    laterality: "bilateral",
    fatigueCost: 1,
    complexity: 1,
    jointStress: "low",
    jointStressAreas: [],
    progressionType: "time_hold",
    emphasis: ["core_stability"],
    isPrimaryCompound: false,
    isStable: true,
  },
  {
    id: "crunch",
    name: "Crunch",
    primaryMuscle: "core",
    secondaryMuscles: [],
    category: "isolation",
    movementPattern: "core",
    biomechanicalPattern: "core_flexion",
    equipmentTypes: ["bodyweight"],
    equipmentAccess: ["full_gym", "bodyweight_only", "minimal_home_gym", "dumbbells_only", "barbell_rack", "machines_only"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["full_body", "beginner_friendly"],
    laterality: "bilateral",
    fatigueCost: 1,
    complexity: 1,
    jointStress: "low",
    jointStressAreas: [],
    progressionType: "reps_only",
    emphasis: [],
    isPrimaryCompound: false,
    isStable: true,
  },
];