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

export type Exercise = {
  id: string;
  name: string;
  primaryMuscle: Muscle;
  secondaryMuscles: Muscle[];
  category: ExerciseCategory;
  movementPattern: MovementPattern;
  equipmentTypes: EquipmentType[];
  equipmentAccess: EquipmentAccess[];
  levels: ExperienceLevel[];
  workoutTags: WorkoutTag[];
};

export const exerciseLibrary: Exercise[] = [
  // CHEST
  {
    id: "bench_press",
    name: "Bench Press",
    primaryMuscle: "chest",
    secondaryMuscles: ["front_delts", "triceps"],
    category: "main",
    movementPattern: "horizontal_press",
    equipmentTypes: ["barbell"],
    equipmentAccess: ["full_gym", "barbell_rack"],
    levels: ["intermediate", "advanced"],
    workoutTags: ["push", "upper", "full_body"],
  },
  {
    id: "incline_bench_press",
    name: "Incline Bench Press",
    primaryMuscle: "chest",
    secondaryMuscles: ["front_delts", "triceps"],
    category: "main",
    movementPattern: "horizontal_press",
    equipmentTypes: ["barbell"],
    equipmentAccess: ["full_gym", "barbell_rack"],
    levels: ["intermediate", "advanced"],
    workoutTags: ["push", "upper", "full_body"],
  },
  {
    id: "dumbbell_bench_press",
    name: "Dumbbell Bench Press",
    primaryMuscle: "chest",
    secondaryMuscles: ["front_delts", "triceps"],
    category: "main",
    movementPattern: "horizontal_press",
    equipmentTypes: ["dumbbell"],
    equipmentAccess: ["full_gym", "dumbbells_only", "minimal_home_gym"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: [
      "push",
      "upper",
      "full_body",
      "beginner_friendly",
      "female_friendly",
    ],
  },
  {
    id: "incline_dumbbell_press",
    name: "Incline Dumbbell Press",
    primaryMuscle: "chest",
    secondaryMuscles: ["front_delts", "triceps"],
    category: "accessory",
    movementPattern: "horizontal_press",
    equipmentTypes: ["dumbbell"],
    equipmentAccess: ["full_gym", "dumbbells_only", "minimal_home_gym"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: [
      "push",
      "upper",
      "full_body",
      "beginner_friendly",
      "female_friendly",
    ],
  },
  {
    id: "chest_press_machine",
    name: "Chest Press Machine",
    primaryMuscle: "chest",
    secondaryMuscles: ["front_delts", "triceps"],
    category: "main",
    movementPattern: "horizontal_press",
    equipmentTypes: ["machine"],
    equipmentAccess: ["full_gym", "machines_only"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: [
      "push",
      "upper",
      "full_body",
      "beginner_friendly",
      "female_friendly",
    ],
  },
  {
    id: "cable_fly",
    name: "Cable Fly",
    primaryMuscle: "chest",
    secondaryMuscles: ["front_delts"],
    category: "isolation",
    movementPattern: "fly",
    equipmentTypes: ["cable"],
    equipmentAccess: ["full_gym"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["push", "upper", "female_friendly", "beginner_friendly"],
  },
  {
    id: "pec_deck",
    name: "Pec Deck",
    primaryMuscle: "chest",
    secondaryMuscles: ["front_delts"],
    category: "isolation",
    movementPattern: "fly",
    equipmentTypes: ["machine"],
    equipmentAccess: ["full_gym", "machines_only"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["push", "upper", "female_friendly", "beginner_friendly"],
  },
  {
    id: "push_ups",
    name: "Push-Ups",
    primaryMuscle: "chest",
    secondaryMuscles: ["front_delts", "triceps", "core"],
    category: "accessory",
    movementPattern: "bodyweight_push",
    equipmentTypes: ["bodyweight"],
    equipmentAccess: [
      "full_gym",
      "bodyweight_only",
      "minimal_home_gym",
      "dumbbells_only",
      "barbell_rack",
    ],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["push", "upper", "full_body", "beginner_friendly"],
  },

  // BACK
  {
    id: "barbell_row",
    name: "Barbell Row",
    primaryMuscle: "back",
    secondaryMuscles: ["lats", "upper_back", "biceps"],
    category: "main",
    movementPattern: "horizontal_pull",
    equipmentTypes: ["barbell"],
    equipmentAccess: ["full_gym", "barbell_rack"],
    levels: ["intermediate", "advanced"],
    workoutTags: ["pull", "upper", "full_body"],
  },
  {
  id: "deadlift",
  name: "Deadlift",
  primaryMuscle: "back",
  secondaryMuscles: ["glutes", "hamstrings", "lower_back", "upper_back", "forearms"],
  category: "main",
  movementPattern: "hinge",
  equipmentTypes: ["barbell"],
  equipmentAccess: ["full_gym", "barbell_rack"],
  levels: ["intermediate", "advanced"],
  workoutTags: ["pull", "lower", "full_body"],
},
  {
    id: "lat_pulldown",
    name: "Lat Pulldown",
    primaryMuscle: "lats",
    secondaryMuscles: ["back", "biceps"],
    category: "main",
    movementPattern: "vertical_pull",
    equipmentTypes: ["cable", "machine"],
    equipmentAccess: ["full_gym", "machines_only"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: [
      "pull",
      "upper",
      "full_body",
      "beginner_friendly",
      "female_friendly",
    ],
  },
  {
    id: "pull_ups",
    name: "Pull-Ups",
    primaryMuscle: "lats",
    secondaryMuscles: ["back", "biceps", "upper_back"],
    category: "main",
    movementPattern: "bodyweight_pull",
    equipmentTypes: ["bodyweight"],
    equipmentAccess: ["full_gym", "minimal_home_gym"],
    levels: ["intermediate", "advanced"],
    workoutTags: ["pull", "upper", "full_body"],
  },
  {
    id: "assisted_pull_ups",
    name: "Assisted Pull-Ups",
    primaryMuscle: "lats",
    secondaryMuscles: ["back", "biceps"],
    category: "accessory",
    movementPattern: "vertical_pull",
    equipmentTypes: ["machine"],
    equipmentAccess: ["full_gym", "machines_only"],
    levels: ["beginner", "intermediate"],
    workoutTags: ["pull", "upper", "beginner_friendly", "female_friendly"],
  },
  {
    id: "seated_cable_row",
    name: "Seated Cable Row",
    primaryMuscle: "back",
    secondaryMuscles: ["lats", "upper_back", "biceps"],
    category: "accessory",
    movementPattern: "horizontal_pull",
    equipmentTypes: ["cable", "machine"],
    equipmentAccess: ["full_gym", "machines_only"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: [
      "pull",
      "upper",
      "full_body",
      "beginner_friendly",
      "female_friendly",
    ],
  },
  {
    id: "single_arm_dumbbell_row",
    name: "Single Arm Dumbbell Row",
    primaryMuscle: "back",
    secondaryMuscles: ["lats", "upper_back", "biceps"],
    category: "accessory",
    movementPattern: "horizontal_pull",
    equipmentTypes: ["dumbbell"],
    equipmentAccess: ["full_gym", "dumbbells_only", "minimal_home_gym"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["pull", "upper", "full_body", "beginner_friendly"],
  },
  {
    id: "chest_supported_row",
    name: "Chest Supported Row",
    primaryMuscle: "upper_back",
    secondaryMuscles: ["back", "lats", "biceps"],
    category: "accessory",
    movementPattern: "horizontal_pull",
    equipmentTypes: ["dumbbell", "machine"],
    equipmentAccess: ["full_gym", "dumbbells_only", "machines_only"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["pull", "upper", "beginner_friendly", "female_friendly"],
  },
  {
    id: "face_pulls",
    name: "Face Pulls",
    primaryMuscle: "rear_delts",
    secondaryMuscles: ["upper_back"],
    category: "isolation",
    movementPattern: "raise",
    equipmentTypes: ["cable"],
    equipmentAccess: ["full_gym"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["pull", "upper", "beginner_friendly", "female_friendly"],
  },
  {
    id: "back_extensions",
    name: "Back Extensions",
    primaryMuscle: "lower_back",
    secondaryMuscles: ["glutes", "hamstrings"],
    category: "isolation",
    movementPattern: "hinge",
    equipmentTypes: ["bodyweight"],
    equipmentAccess: ["full_gym", "minimal_home_gym"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["pull", "lower", "full_body", "beginner_friendly"],
  },

  // LEGS / GLUTES
  {
    id: "back_squat",
    name: "Back Squat",
    primaryMuscle: "quads",
    secondaryMuscles: ["glutes", "hamstrings", "core"],
    category: "main",
    movementPattern: "squat",
    equipmentTypes: ["barbell"],
    equipmentAccess: ["full_gym", "barbell_rack"],
    levels: ["intermediate", "advanced"],
    workoutTags: ["lower", "full_body"],
  },
  {
    id: "front_squat",
    name: "Front Squat",
    primaryMuscle: "quads",
    secondaryMuscles: ["glutes", "core"],
    category: "main",
    movementPattern: "squat",
    equipmentTypes: ["barbell"],
    equipmentAccess: ["full_gym", "barbell_rack"],
    levels: ["advanced"],
    workoutTags: ["lower", "full_body"],
  },
  {
    id: "goblet_squat",
    name: "Goblet Squat",
    primaryMuscle: "quads",
    secondaryMuscles: ["glutes", "core"],
    category: "main",
    movementPattern: "squat",
    equipmentTypes: ["dumbbell", "kettlebell"],
    equipmentAccess: ["full_gym", "dumbbells_only", "minimal_home_gym"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: [
      "lower",
      "full_body",
      "beginner_friendly",
      "female_friendly",
    ],
  },
  {
    id: "leg_press",
    name: "Leg Press",
    primaryMuscle: "quads",
    secondaryMuscles: ["glutes", "hamstrings"],
    category: "main",
    movementPattern: "squat",
    equipmentTypes: ["machine"],
    equipmentAccess: ["full_gym", "machines_only"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: [
      "lower",
      "full_body",
      "beginner_friendly",
      "female_friendly",
    ],
  },
  {
    id: "romanian_deadlift",
    name: "Romanian Deadlift",
    primaryMuscle: "hamstrings",
    secondaryMuscles: ["glutes", "lower_back"],
    category: "accessory",
    movementPattern: "hinge",
    equipmentTypes: ["barbell", "dumbbell"],
    equipmentAccess: [
      "full_gym",
      "barbell_rack",
      "dumbbells_only",
      "minimal_home_gym",
    ],
    levels: ["intermediate", "advanced"],
    workoutTags: ["lower", "full_body", "glute_friendly"],
  },
  {
    id: "walking_lunges",
    name: "Walking Lunges",
    primaryMuscle: "quads",
    secondaryMuscles: ["glutes", "hamstrings"],
    category: "accessory",
    movementPattern: "lunge",
    equipmentTypes: ["bodyweight", "dumbbell"],
    equipmentAccess: [
      "full_gym",
      "dumbbells_only",
      "bodyweight_only",
      "minimal_home_gym",
    ],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: [
      "lower",
      "full_body",
      "beginner_friendly",
      "female_friendly",
      "glute_friendly",
    ],
  },
  {
    id: "bulgarian_split_squat",
    name: "Bulgarian Split Squat",
    primaryMuscle: "quads",
    secondaryMuscles: ["glutes", "hamstrings"],
    category: "accessory",
    movementPattern: "lunge",
    equipmentTypes: ["dumbbell", "bodyweight"],
    equipmentAccess: ["full_gym", "dumbbells_only", "minimal_home_gym"],
    levels: ["intermediate", "advanced"],
    workoutTags: [
      "lower",
      "full_body",
      "female_friendly",
      "glute_friendly",
    ],
  },
  {
    id: "leg_extension",
    name: "Leg Extension",
    primaryMuscle: "quads",
    secondaryMuscles: [],
    category: "isolation",
    movementPattern: "squat",
    equipmentTypes: ["machine"],
    equipmentAccess: ["full_gym", "machines_only"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["lower", "beginner_friendly", "female_friendly"],
  },
  {
    id: "hamstring_curl",
    name: "Hamstring Curl",
    primaryMuscle: "hamstrings",
    secondaryMuscles: [],
    category: "isolation",
    movementPattern: "hinge",
    equipmentTypes: ["machine"],
    equipmentAccess: ["full_gym", "machines_only"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: [
      "lower",
      "beginner_friendly",
      "female_friendly",
      "glute_friendly",
    ],
  },
  {
    id: "calf_raises",
    name: "Calf Raises",
    primaryMuscle: "calves",
    secondaryMuscles: [],
    category: "isolation",
    movementPattern: "calves",
    equipmentTypes: ["bodyweight", "dumbbell", "machine"],
    equipmentAccess: [
      "full_gym",
      "bodyweight_only",
      "minimal_home_gym",
      "dumbbells_only",
      "machines_only",
    ],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["lower", "full_body", "beginner_friendly"],
  },
  {
    id: "hip_thrust",
    name: "Hip Thrust",
    primaryMuscle: "glutes",
    secondaryMuscles: ["hamstrings"],
    category: "main",
    movementPattern: "hinge",
    equipmentTypes: ["barbell", "machine"],
    equipmentAccess: [
      "full_gym",
      "barbell_rack",
      "machines_only",
      "minimal_home_gym",
    ],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: [
      "lower",
      "full_body",
      "female_friendly",
      "glute_friendly",
      "beginner_friendly",
    ],
  },
  {
    id: "glute_bridge",
    name: "Glute Bridge",
    primaryMuscle: "glutes",
    secondaryMuscles: ["hamstrings", "core"],
    category: "accessory",
    movementPattern: "hinge",
    equipmentTypes: ["bodyweight", "dumbbell", "barbell"],
    equipmentAccess: [
      "full_gym",
      "bodyweight_only",
      "minimal_home_gym",
      "dumbbells_only",
      "barbell_rack",
    ],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: [
      "lower",
      "full_body",
      "female_friendly",
      "glute_friendly",
      "beginner_friendly",
    ],
  },

  // SHOULDERS
  {
    id: "overhead_press",
    name: "Overhead Press",
    primaryMuscle: "shoulders",
    secondaryMuscles: ["front_delts", "triceps", "core"],
    category: "main",
    movementPattern: "vertical_press",
    equipmentTypes: ["barbell"],
    equipmentAccess: ["full_gym", "barbell_rack"],
    levels: ["intermediate", "advanced"],
    workoutTags: ["push", "upper", "full_body"],
  },
  {
    id: "seated_dumbbell_press",
    name: "Seated Dumbbell Press",
    primaryMuscle: "shoulders",
    secondaryMuscles: ["front_delts", "triceps"],
    category: "main",
    movementPattern: "vertical_press",
    equipmentTypes: ["dumbbell"],
    equipmentAccess: ["full_gym", "dumbbells_only", "minimal_home_gym"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: [
      "push",
      "upper",
      "full_body",
      "beginner_friendly",
      "female_friendly",
    ],
  },
  {
    id: "arnold_press",
    name: "Arnold Press",
    primaryMuscle: "shoulders",
    secondaryMuscles: ["front_delts", "triceps"],
    category: "accessory",
    movementPattern: "vertical_press",
    equipmentTypes: ["dumbbell"],
    equipmentAccess: ["full_gym", "dumbbells_only", "minimal_home_gym"],
    levels: ["intermediate", "advanced"],
    workoutTags: ["push", "upper", "female_friendly"],
  },
  {
    id: "machine_shoulder_press",
    name: "Machine Shoulder Press",
    primaryMuscle: "shoulders",
    secondaryMuscles: ["front_delts", "triceps"],
    category: "main",
    movementPattern: "vertical_press",
    equipmentTypes: ["machine"],
    equipmentAccess: ["full_gym", "machines_only"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["push", "upper", "beginner_friendly", "female_friendly"],
  },
  {
    id: "lateral_raises",
    name: "Lateral Raises",
    primaryMuscle: "side_delts",
    secondaryMuscles: ["shoulders"],
    category: "isolation",
    movementPattern: "raise",
    equipmentTypes: ["dumbbell"],
    equipmentAccess: ["full_gym", "dumbbells_only", "minimal_home_gym"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: [
      "push",
      "upper",
      "full_body",
      "female_friendly",
      "beginner_friendly",
    ],
  },
  {
    id: "rear_delt_fly",
    name: "Rear Delt Fly",
    primaryMuscle: "rear_delts",
    secondaryMuscles: ["upper_back"],
    category: "isolation",
    movementPattern: "raise",
    equipmentTypes: ["dumbbell", "machine"],
    equipmentAccess: [
      "full_gym",
      "dumbbells_only",
      "machines_only",
      "minimal_home_gym",
    ],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: [
      "pull",
      "upper",
      "full_body",
      "female_friendly",
      "beginner_friendly",
    ],
  },
  {
    id: "pike_push_ups",
    name: "Pike Push-Ups",
    primaryMuscle: "shoulders",
    secondaryMuscles: ["triceps", "core"],
    category: "accessory",
    movementPattern: "bodyweight_push",
    equipmentTypes: ["bodyweight"],
    equipmentAccess: ["bodyweight_only", "minimal_home_gym"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["push", "upper", "beginner_friendly"],
  },

  // ARMS
  {
    id: "close_grip_bench_press",
    name: "Close Grip Bench Press",
    primaryMuscle: "triceps",
    secondaryMuscles: ["chest", "front_delts"],
    category: "main",
    movementPattern: "horizontal_press",
    equipmentTypes: ["barbell"],
    equipmentAccess: ["full_gym", "barbell_rack"],
    levels: ["intermediate", "advanced"],
    workoutTags: ["push", "upper"],
  },
  {
    id: "barbell_curl",
    name: "Barbell Curl",
    primaryMuscle: "biceps",
    secondaryMuscles: ["forearms"],
    category: "main",
    movementPattern: "curl",
    equipmentTypes: ["barbell"],
    equipmentAccess: ["full_gym", "barbell_rack"],
    levels: ["intermediate", "advanced"],
    workoutTags: ["pull", "upper"],
  },
  {
    id: "hammer_curls",
    name: "Hammer Curls",
    primaryMuscle: "biceps",
    secondaryMuscles: ["forearms"],
    category: "accessory",
    movementPattern: "curl",
    equipmentTypes: ["dumbbell"],
    equipmentAccess: ["full_gym", "dumbbells_only", "minimal_home_gym"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["pull", "upper", "beginner_friendly"],
  },
  {
    id: "cable_curls",
    name: "Cable Curls",
    primaryMuscle: "biceps",
    secondaryMuscles: ["forearms"],
    category: "accessory",
    movementPattern: "curl",
    equipmentTypes: ["cable"],
    equipmentAccess: ["full_gym"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["pull", "upper", "beginner_friendly"],
  },
  {
    id: "tricep_pressdown",
    name: "Tricep Pressdown",
    primaryMuscle: "triceps",
    secondaryMuscles: [],
    category: "isolation",
    movementPattern: "tricep_extension",
    equipmentTypes: ["cable"],
    equipmentAccess: ["full_gym"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: [
      "push",
      "upper",
      "beginner_friendly",
      "female_friendly",
    ],
  },
  {
    id: "overhead_tricep_extension",
    name: "Overhead Tricep Extension",
    primaryMuscle: "triceps",
    secondaryMuscles: [],
    category: "isolation",
    movementPattern: "tricep_extension",
    equipmentTypes: ["dumbbell", "cable"],
    equipmentAccess: ["full_gym", "dumbbells_only", "minimal_home_gym"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: [
      "push",
      "upper",
      "female_friendly",
      "beginner_friendly",
    ],
  },
  {
    id: "preacher_curl",
    name: "Preacher Curl",
    primaryMuscle: "biceps",
    secondaryMuscles: ["forearms"],
    category: "isolation",
    movementPattern: "curl",
    equipmentTypes: ["machine"],
    equipmentAccess: ["full_gym", "machines_only"],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["pull", "upper", "beginner_friendly"],
  },
  {
    id: "skull_crushers",
    name: "Skull Crushers",
    primaryMuscle: "triceps",
    secondaryMuscles: [],
    category: "accessory",
    movementPattern: "tricep_extension",
    equipmentTypes: ["barbell", "dumbbell"],
    equipmentAccess: ["full_gym", "barbell_rack", "dumbbells_only"],
    levels: ["intermediate", "advanced"],
    workoutTags: ["push", "upper"],
  },

  // CORE
  {
    id: "crunch",
    name: "Crunch",
    primaryMuscle: "core",
    secondaryMuscles: [],
    category: "isolation",
    movementPattern: "core",
    equipmentTypes: ["bodyweight"],
    equipmentAccess: [
      "full_gym",
      "bodyweight_only",
      "minimal_home_gym",
      "dumbbells_only",
      "barbell_rack",
      "machines_only",
    ],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["full_body", "beginner_friendly"],
  },
  {
    id: "plank",
    name: "Plank",
    primaryMuscle: "core",
    secondaryMuscles: ["shoulders"],
    category: "accessory",
    movementPattern: "core",
    equipmentTypes: ["bodyweight"],
    equipmentAccess: [
      "full_gym",
      "bodyweight_only",
      "minimal_home_gym",
      "dumbbells_only",
      "barbell_rack",
      "machines_only",
    ],
    levels: ["beginner", "intermediate", "advanced"],
    workoutTags: ["full_body", "beginner_friendly"],
  },
];