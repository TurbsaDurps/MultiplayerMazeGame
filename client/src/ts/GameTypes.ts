// Shared types and interfaces for the client-side game

export interface User {
    id: string;
    username: string;
    email: string;
    coins: number;
    createdAt: Date;
}

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
    activeCooldowns: { [abilityId: string]: number }; // timestamp when available
    lastCheckpointPosition: { x: number; y: number };
}

export interface GameSession {
    id: string;
    roomCode: string;
    hostId: string;
    players: { [playerId: string]: Player };
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

export interface GameElements {
    loginScreen: HTMLElement;
    mainMenu: HTMLElement;
    gameScreen: HTMLElement;
    loginUsername: HTMLInputElement;
    loginEmail: HTMLInputElement;
    loginPassword: HTMLInputElement;
    loginBtn: HTMLButtonElement;
    registerBtn: HTMLButtonElement;
    loginMessage: HTMLElement;
    playerName: HTMLElement;
    coinCount: HTMLElement;
    createGameBtn: HTMLButtonElement;
    quickPlayBtn: HTMLButtonElement;
    roomCodeInput: HTMLInputElement;
    joinGameBtn: HTMLButtonElement;
    logoutBtn: HTMLButtonElement;
    menuMessage: HTMLElement;
    gameCanvas: HTMLCanvasElement;
    roomCode: HTMLElement;
    livesCount: HTMLElement;
    eliminationCount: HTMLElement;
    checkpointCount: HTMLElement;
    players: HTMLElement;
    abilityCards: HTMLElement;
    messages: HTMLElement;
    leaveGameBtn: HTMLButtonElement;
}

export interface Position {
    x: number;
    y: number;
}

export interface MousePosition {
    x: number;
    y: number;
}

// Tile types for the maze
export enum TileType {
    FLOOR = 0,
    WALL = 1,
    CHECKPOINT = 2,
    FINISH = 3,
    OBSTACLE = 4
}

// Message types for the message system
export interface GameMessage {
    message: string;
    type: 'normal' | 'system' | 'elimination' | 'ability';
    timestamp?: Date;
}

// API Response types
export interface AuthResponse {
    user: User;
    token: string;
}

export interface ErrorResponse {
    message: string;
}

// Socket event types
export interface SocketEvents {
    // Client to server
    authenticate: { token: string };
    createGame: any; // game settings
    joinGame: { roomCode: string };
    quickPlay: void;
    move: { dx: number; dy: number };
    updateFacing: { facing: number };
    useAbility: { abilityId: string; target: Position };
    leaveGame: void;

    // Server to client
    authenticated: { user: User };
    gameJoined: { session: GameSession };
    playerJoined: { players: { [key: string]: Player }; newPlayer: string };
    playerLeft: { players: { [key: string]: Player }; leftPlayer: string };
    gameState: GameState;
    message: GameMessage;
    error: ErrorResponse;
}

// Constants
export const TILE_SIZE = 32;
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;

// Player colors for multiplayer rendering
export const PLAYER_COLORS = [
    '#4CAF50', '#2196F3', '#FF9800', '#9C27B0',
    '#F44336', '#00BCD4', '#FFEB3B', '#795548'
];

// Game configuration
export const GAME_CONFIG = {
    MOVEMENT_SPEED: 200, // pixels per second
    FIST_DISTANCE: 16, // pixels from player center
    FIST_SIZE: 4, // radius of fist circles
    PLAYER_RADIUS: 10, // radius of player circle
    FPS_TARGET: 60,
    FRAME_TIME: 1000 / 60 // ~16.67ms
} as const;