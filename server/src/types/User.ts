export interface User {
  id: string;
  username: string;
  email: string;
  coins: number;
  createdAt: Date;
}

export interface CreateUserDto {
  username: string;
  email: string;
  password: string;
}

// server/src/types/Game.ts
export interface Ability {
  id: string;
  name: string;
  description: string;
  cooldownMs: number;
  type: 'offensive' | 'defensive' | 'utility' | 'support';
  effectData: any;
}

export interface Player {
  id: string;
  username?: string;
  position: { x: number; y: number };
  facing: number; // radians
  lives: number;
  eliminations: number;
  checkpointsReached: number;
  status: 'alive' | 'dead' | 'finished' | 'spectating';
  abilities: Ability[];
  activeCooldowns: Map<string, number>; // abilityId -> timestamp when available
  lastCheckpointPosition: { x: number; y: number };
}

export interface GameSession {
  id: string;
  roomCode: string;
  hostId: string;
  players: Map<string, Player>;
  maze: number[][];
  settings: {
    maxPlayers: number;
    difficulty: number;
    hasTimeLimit: boolean;
    timeLimitMinutes: number;
  };
  status: 'waiting' | 'in_progress' | 'completed';
  createdAt: Date;
  startedAt?: Date;
  endedAt?: Date;
}

export interface GameState {
  sessionId: string;
  players: { [key: string]: Player };
  maze: number[][];
  status: string;
  timeRemaining?: number;
}