export interface Player {
    id: string;
    x: number;
    y: number;
    angle: number;
    color: string;
    lives: number;
    checkpointsPassed: number;
    isAlive: boolean;
}
export interface GameRoom {
    id: string;
    players: Map<string, Player>;
    maze: number[][];
    checkpoints: Checkpoint[];
    gameState: GameState;
    createdAt: Date;
    maxPlayers: number;
}
export interface Checkpoint {
    x: number;
    y: number;
    id: string;
    reached: boolean;
}
export interface Position {
    x: number;
    y: number;
}
export interface MazeCell {
    x: number;
    y: number;
    walls: {
        top: boolean;
        right: boolean;
        bottom: boolean;
        left: boolean;
    };
    isCheckpoint: boolean;
    isStart: boolean;
    isEnd: boolean;
}
export declare enum GameState {
    WAITING = "waiting",
    STARTING = "starting",
    IN_PROGRESS = "in_progress",
    FINISHED = "finished"
}
export declare enum CellType {
    WALL = 0,
    EMPTY = 1,
    START = 2,
    END = 3,
    CHECKPOINT = 4
}
export interface ClientToServerEvents {
    'join-game': (roomId?: string) => void;
    'player-move': (position: Position, angle: number) => void;
    'player-ready': () => void;
    'leave-game': () => void;
}
export interface ServerToClientEvents {
    'game-joined': (roomId: string, playerId: string) => void;
    'game-state': (gameRoom: Partial<GameRoom>) => void;
    'player-update': (players: Player[]) => void;
    'maze-data': (maze: number[][], checkpoints: Checkpoint[]) => void;
    'game-started': () => void;
    'game-finished': (winnerId: string) => void;
    'player-died': (playerId: string) => void;
    'checkpoint-reached': (playerId: string, checkpointId: string) => void;
    'error': (message: string) => void;
}
//# sourceMappingURL=game.d.ts.map