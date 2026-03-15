export interface DogWalk {
  id: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  notes: string | null;
  createdAt: string;
}

export interface DogWalkStats {
  totalSeconds: number;
  walkCount: number;
}
