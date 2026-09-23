export interface Exercise {
  id: string;
  name: string;
  normalizedName: string;
  muscleGroup: string;
  equipment: string | null;
  imageUri: string | null;
  isCustom: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExerciseInput {
  name: string;
  muscleGroup: string;
  equipment: string;
}

export const exerciseLimits = { name: 80, muscleGroup: 60, equipment: 60, search: 120 } as const;
