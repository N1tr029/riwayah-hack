export type Confidence = 'excellent' | 'good' | 'weak';
export type EnergyLevel = 'High' | 'Steady' | 'Low';
export type StressLevel = 'Low' | 'Balanced' | 'Elevated';
export type SleepLabel = 'Recovered' | 'Adequate' | 'Light';
export type Mood = 'great' | 'good' | 'okay' | 'low';
export type Workout = 'volleyball' | 'weights' | 'run' | 'walk' | 'rest';

export interface DayRecord {
  /** YYYY-MM-DD, local time */
  date: string;
  recovery: number;
  statusWord: string;
  energy: EnergyLevel;
  stress: StressLevel;
  sleep: SleepLabel;
  sleepHours: number;
  /** Hour the user went to bed; 24+ means after midnight */
  bedtimeHour: number;
  /** Most recent Apple Health heart-rate sample, when one is available. */
  hr: number | null;
  /** Overnight resting heart rate */
  rhr: number;
  /** HRV (RMSSD, ms) */
  hrv: number;
  confidence: Confidence;
  explanation: string;
  recommendation: string;
  mission: string;
  mood?: Mood;
  journal?: string;
  workout?: Workout;
  event?: string;
}

export interface AppSettings {
  showAdvanced: boolean;
  reminderEnabled: boolean;
  reminderTime: string;
  units: 'metric' | 'imperial';
  haptics: boolean;
  /** Allow Brief to read health data from Apple Health / Health Connect. */
  healthSync: boolean;
  /** Experimental face-pulse research feature (never affects readiness). */
  faceResearch: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  showAdvanced: false,
  reminderEnabled: true,
  reminderTime: '7:30 AM',
  units: 'metric',
  haptics: true,
  healthSync: false,
  faceResearch: false,
};

export interface PatternObservation {
  id: string;
  icon: string;
  title: string;
  detail: string;
}
