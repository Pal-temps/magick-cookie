export interface DogWalk {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  durationSeconds: number | null;
  notes: string | null;
  createdAt: Date;
}

export interface CreateDogWalkInput {
  startedAt?: Date;
  notes?: string | null;
}

export interface StopDogWalkInput {
  endedAt: Date;
  durationSeconds: number;
}
