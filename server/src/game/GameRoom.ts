import { v4 as uuidv4 } from 'uuid';
import { Player, GameState, Checkpoint, Position } from '../../../shared/types/game';
import { MazeGenerator } from './MazeGenerator';

export class GameRoom {
  public id: string;
  public players: Map<string, Player> = new Map();
  public maze: number[][];
  public checkpoints: Checkpoint[] = [];
  public gameState: GameState = GameState.WAITING;
  public maxPlayers: number;
  public startPosition: Position;
  public endPosition: Position;
  private readyPlayers: Set<string> = new Set();
  private mazeWidth: number;
  private mazeHeight: number;

  constructor(id: string, maxPlayers: number) {
    this.id = id;
    this.maxPlayers = maxPlayers;
    this.mazeWidth = parseInt(process.env.MAZE_WIDTH || '31');
    this.mazeHeight = parseInt(process.env.MAZE_HEIGHT || '31');
    
    this.generateMaze();
  }

  private generateMaze(): void {
    const generator = new MazeGenerator(this.mazeWidth, this.mazeHeight);
    this.maze = generator.generate();
    
    // Set start and end positions
    this.startPosition = { x: 1, y: 1 };
    this.endPosition = { x: this.mazeWidth - 2, y: this.mazeHeight - 2 };
    
    // Generate checkpoints
    this.generateCheckpoints();
  }

  private generateCheckpoints(): void {
    const numCheckpoints = Math.floor((this.mazeWidth * this.mazeHeight) / 100);
    this.checkpoints = [];

    for (let i = 0; i < numCheckpoints; i++) {
      let x, y;
      do {
        x = Math.floor(Math.random() * (this.mazeWidth - 2)) + 1;
        y = Math.floor(Math.random() * (this.mazeHeight - 2)) + 1;
      } while (
        this.maze[y][x] === 0 || // Wall
        (x === this.startPosition.x && y === this.startPosition.y) || // Start
        (x === this.endPosition.x && y === this.endPosition.y) || // End
        this.checkpoints.some(cp => cp.x === x && cp.y === y) // Existing checkpoint
      );

      this.checkpoints.push({
        id: uuidv4(),
        x,
        y,
        reached: false
      });
    }
  }

  public addPlayer(player: Player): void {
    this.players.set(player.id, player);
  }

  public removePlayer(playerId: string): void {
    this.players.delete(playerId);
    this.readyPlayers.delete(playerId);
  }

  public updatePlayerPosition(playerId: string, position: Position, angle: number): void {
    const player = this.players.get(playerId);
    if (!player || !player.isAlive) return;

    // Check collision with walls
    if (this.isValidPosition(position.x, position.y)) {
      player.x = position.x;
      player.y = position.y;
      player.angle = angle;

      // Check checkpoint collision
      this.checkCheckpointCollision(player);
      
      // Check end position collision
      this.checkEndCollision(player);
    }
  }

  private isValidPosition(x: number, y: number): boolean {
    const cellX = Math.floor(x);
    const cellY = Math.floor(y);
    
    if (cellX < 0 || cellX >= this.mazeWidth || cellY < 0 || cellY >= this.mazeHeight) {
      return false;
    }
    
    return this.maze[cellY][cellX] === 1; // 1 = empty space
  }

  private checkCheckpointCollision(player: Player): void {
    const COLLISION_DISTANCE = 0.5;
    
    for (const checkpoint of this.checkpoints) {
      if (!checkpoint.reached) {
        const distance = Math.sqrt(
          Math.pow(player.x - checkpoint.x, 2) + Math.pow(player.y - checkpoint.y, 2)
        );
        
        if (distance < COLLISION_DISTANCE) {
          checkpoint.reached = true;
          player.checkpointsPassed++;
          // Emit checkpoint reached event would go here
        }
      }
    }
  }

  private checkEndCollision(player: Player): void {
    const COLLISION_DISTANCE = 0.5;
    const distance = Math.sqrt(
      Math.pow(player.x - this.endPosition.x, 2) + Math.pow(player.y - this.endPosition.y, 2)
    );
    
    if (distance < COLLISION_DISTANCE) {
      this.gameState = GameState.FINISHED;
    }
  }

  public setPlayerReady(playerId: string): void {
    this.readyPlayers.add(playerId);
  }

  public canStartGame(): boolean {
    const minPlayers = parseInt(process.env.MIN_PLAYERS_PER_GAME || '2');
    return this.players.size >= minPlayers && this.readyPlayers.size === this.players.size;
  }

  public startGame(): void {
    this.gameState = GameState.IN_PROGRESS;
  }

  public update(): void {
    // Game logic updates (future: abilities, obstacles, etc.)
  }

  public checkGameCompletion(): boolean {
    return this.gameState === GameState.FINISHED;
  }

  public getWinnerId(): string | null {
    // Simple win condition: first player to reach the end
    for (const player of this.players.values()) {
      const distance = Math.sqrt(
        Math.pow(player.x - this.endPosition.x, 2) + Math.pow(player.y - this.endPosition.y, 2)
      );
      if (distance < 0.5) {
        return player.id;
      }
    }
    return null;
  }
}