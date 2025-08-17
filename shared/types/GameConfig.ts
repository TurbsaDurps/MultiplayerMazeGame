// shared/types/GameConfig.ts
export interface GameConfig {
  maze: {
    minSize: number;
    maxSize: number;
    sizeMultiplier: number; // size = baseSize + (players * sizeMultiplier)
    obstacleFrequency: number; // 0-1, percentage of corridors with obstacles
  };
  players: {
    minPlayers: number;
    maxPlayers: number;
    defaultLives: number;
    startingAbilities: number; // how many abilities to choose from at start
  };
  abilities: {
    maxActive: number; // max abilities a player can have active
    cooldownMultiplier: number; // global cooldown modifier
  };
  rewards: {
    baseReward: number;
    timeBonus: number; // coins per second under time limit
    eliminationBonus: number;
    cooperationBonus: number; // bonus when all players finish
    difficultyMultiplier: number;
  };
  gameplay: {
    respawnInvulnerabilityMs: number;
    movementSpeed: number;
    viewDistance: number; // how far players can see
  };
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  maze: {
    minSize: 15,
    maxSize: 50,
    sizeMultiplier: 3,
    obstacleFrequency: 0.15
  },
  players: {
    minPlayers: 2,
    maxPlayers: 8,
    defaultLives: 3,
    startingAbilities: 3
  },
  abilities: {
    maxActive: 5,
    cooldownMultiplier: 1.0
  },
  rewards: {
    baseReward: 50,
    timeBonus: 2,
    eliminationBonus: 25,
    cooperationBonus: 20,
    difficultyMultiplier: 1.5
  },
  gameplay: {
    respawnInvulnerabilityMs: 3000,
    movementSpeed: 200, // pixels per second
    viewDistance: 5 // tiles
  }
};