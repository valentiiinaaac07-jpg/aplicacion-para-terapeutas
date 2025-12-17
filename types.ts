export enum UserRole {
  THERAPIST = 'THERAPIST',
  PATIENT = 'PATIENT',
  ADMIN = 'ADMIN',
}

export interface User {
  id: string;
  email: string; // Replaces username as the primary ID
  password?: string;
  name: string;
  role: UserRole;
  status: 'active' | 'inactive';
  lastLoginDate?: string;
}

export interface ExerciseStep {
  stepNumber: number;
  instruction: string;
}

export interface Exercise {
  id: string;
  title: string;
  description: string;
  symptomsAddressed: string;
  steps: string[];
  assignedDate: string;
  completed: boolean;
  completionDate?: string;
  patientNotes?: string;
  moodRatingAfter?: number; // 1-10
}

export interface Task {
  id: string;
  content: string;
  completed: boolean;
}

export interface Patient extends User {
  therapistId: string;
  assignedExercises: Exercise[];
  todoTasks: Task[];
  progressHistory: {
    date: string;
    moodAverage: number;
    exercisesCompleted: number;
  }[];
}

export interface AuthState {
  user: User | Patient | null;
  isAuthenticated: boolean;
}

export interface GeminiExerciseResponse {
  title: string;
  description: string;
  steps: string[];
}

export interface LoginLog {
  email: string;
  timestamp: string;
}