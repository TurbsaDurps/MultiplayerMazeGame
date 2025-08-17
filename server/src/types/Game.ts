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

// server/src/controllers/SocketHandler.ts
import { Server, Socket } from 'socket.io';
import { AuthService } from '../services/AuthService';
import { GameManager } from '../services/GameManager';
import { User } from '../types/User';

export class SocketHandler {
  private connectedUsers: Map<string, { user: User; socketId: string }> = new Map();

  constructor(
    private io: Server,
    private authService: AuthService,
    private gameManager: GameManager
  ) {}

  initialize() {
    this.io.on('connection', (socket: Socket) => {
      console.log(`Client connected: ${socket.id}`);

      socket.on('authenticate', async (data) => {
        try {
          const user = await this.authService.verifyToken(data.token);
          this.connectedUsers.set(socket.id, { user, socketId: socket.id });
          socket.emit('authenticated', { user });
        } catch (error) {
          socket.emit('error', { message: 'Authentication failed' });
        }
      });

      socket.on('createGame', async (settings) => {
        const userInfo = this.connectedUsers.get(socket.id);
        if (!userInfo) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        try {
          const session = await this.gameManager.createSession(userInfo.user.id, settings);
          
          // Add host to the session
          await this.gameManager.joinSession(session.roomCode, userInfo.user.id);
          const updatedSession = this.gameManager.getSession(session.id);
          
          if (updatedSession) {
            // Add username to player
            const player = updatedSession.players.get(userInfo.user.id);
            if (player) {
              player.username = userInfo.user.username;
            }
            
            socket.join(session.id);
            socket.emit('gameJoined', { session: this.serializeSession(updatedSession) });
          }
        } catch (error) {
          socket.emit('error', { message: 'Failed to create game' });
        }
      });

      socket.on('joinGame', async (data) => {
        const userInfo = this.connectedUsers.get(socket.id);
        if (!userInfo) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        try {
          const session = await this.gameManager.joinSession(data.roomCode, userInfo.user.id);
          
          // Add username to player
          const player = session.players.get(userInfo.user.id);
          if (player) {
            player.username = userInfo.user.username;
          }
          
          socket.join(session.id);
          socket.emit('gameJoined', { session: this.serializeSession(session) });
          
          // Notify other players
          socket.to(session.id).emit('playerJoined', {
            players: this.serializePlayers(session.players),
            newPlayer: userInfo.user.username
          });
          
          this.io.to(session.id).emit('message', {
            message: `${userInfo.user.username} joined the game`,
            type: 'system'
          });
          
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      socket.on('quickPlay', async () => {
        const userInfo = this.connectedUsers.get(socket.id);
        if (!userInfo) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        // For now, create a new game (implement matchmaking later)
        const settings = {
          maxPlayers: 6,
          difficulty: 1,
          hasTimeLimit: false,
          baseSize: 20
        };

        try {
          const session = await this.gameManager.createSession(userInfo.user.id, settings);
          await this.gameManager.joinSession(session.roomCode, userInfo.user.id);
          const updatedSession = this.gameManager.getSession(session.id);
          
          if (updatedSession) {
            const player = updatedSession.players.get(userInfo.user.id);
            if (player) {
              player.username = userInfo.user.username;
            }
            
            socket.join(session.id);
            socket.emit('gameJoined', { session: this.serializeSession(updatedSession) });
          }
        } catch (error) {
          socket.emit('error', { message: 'Failed to find game' });
        }
      });

      socket.on('move', (data) => {
        const userInfo = this.connectedUsers.get(socket.id);
        if (!userInfo) return;

        const session = this.gameManager.getSessionByPlayer(userInfo.user.id);
        if (!session) return;

        const player = session.players.get(userInfo.user.id);
        if (!player || player.status !== 'alive') return;

        // Validate movement
        const newX = Math.max(0, Math.min(session.maze[0].length - 1, player.position.x + data.dx));
        const newY = Math.max(0, Math.min(session.maze.length - 1, player.position.y + data.dy));

        // Check if new position is valid (not a wall)
        if (session.maze[newY][newX] !== 1) { // 1 = wall
          player.position.x = newX;
          player.position.y = newY;
          
          // Check for special tiles
          this.checkTileInteraction(session, player, newX, newY);
          
          // Broadcast updated game state
          this.broadcastGameState(session);
        }
      });

      socket.on('updateFacing', (data) => {
        const userInfo = this.connectedUsers.get(socket.id);
        if (!userInfo) return;

        const session = this.gameManager.getSessionByPlayer(userInfo.user.id);
        if (!session) return;

        const player = session.players.get(userInfo.user.id);
        if (player) {
          player.facing = data.facing;
          this.broadcastGameState(session);
        }
      });

      socket.on('useAbility', (data) => {
        const userInfo = this.connectedUsers.get(socket.id);
        if (!userInfo) return;

        const session = this.gameManager.getSessionByPlayer(userInfo.user.id);
        if (!session) return;

        const player = session.players.get(userInfo.user.id);
        if (!player || player.status !== 'alive') return;

        this.handleAbilityUse(session, player, data.abilityId, data.target);
      });

      socket.on('leaveGame', () => {
        this.handlePlayerLeave(socket);
      });

      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        this.handlePlayerLeave(socket);
        this.connectedUsers.delete(socket.id);
      });
    });
  }

  private handlePlayerLeave(socket: Socket) {
    const userInfo = this.connectedUsers.get(socket.id);
    if (!userInfo) return;

    const session = this.gameManager.getSessionByPlayer(userInfo.user.id);
    if (session) {
      session.players.delete(userInfo.user.id);
      
      socket.to(session.id).emit('playerLeft', {
        players: this.serializePlayers(session.players),
        leftPlayer: userInfo.user.username
      });
      
      this.io.to(session.id).emit('message', {
        message: `${userInfo.user.username} left the game`,
        type: 'system'
      });
      
      socket.leave(session.id);
    }
  }

  private checkTileInteraction(session: GameSession, player: Player, x: number, y: number) {
    const tileType = session.maze[y][x];
    
    switch (tileType) {
      case 2: // Checkpoint
        player.checkpointsReached++;
        player.lastCheckpointPosition = { x, y };
        
        this.io.to(session.id).emit('message', {
          message: `${player.username} reached a checkpoint!`,
          type: 'system'
        });
        
        // TODO: Present ability choices
        break;
        
      case 3: // Finish
        player.status = 'finished';
        
        this.io.to(session.id).emit('message', {
          message: `${player.username} finished the maze!`,
          type: 'system'
        });
        
        // TODO: Calculate rewards
        break;
        
      case 4: // Obstacle
        this.handleObstacleInteraction(session, player);
        break;
    }
  }

  private handleObstacleInteraction(session: GameSession, player: Player) {
    // Simple obstacle: player loses a life
    player.lives--;
    
    if (player.lives <= 0) {
      player.status = 'dead';
      
      this.io.to(session.id).emit('message', {
        message: `${player.username} was eliminated!`,
        type: 'elimination'
      });
    } else {
      // Respawn at last checkpoint
      player.position = { ...player.lastCheckpointPosition };
      
      this.io.to(session.id).emit('message', {
        message: `${player.username} lost a life! (${player.lives} remaining)`,
        type: 'system'
      });
    }
  }

  private handleAbilityUse(session: GameSession, player: Player, abilityId: string, target: any) {
    const ability = player.abilities.find(a => a.id === abilityId);
    if (!ability) return;

    // Check cooldown
    const cooldownEnd = player.activeCooldowns.get(abilityId) || 0;
    if (Date.now() < cooldownEnd) return;

    // Set cooldown
    player.activeCooldowns.set(abilityId, Date.now() + ability.cooldownMs);

    // Apply ability effect (simplified implementation)
    switch (ability.name) {
      case 'Speed Boost':
        // TODO: Implement speed boost effect
        this.io.to(session.id).emit('message', {
          message: `${player.username} used Speed Boost!`,
          type: 'system'
        });
        break;
        
      case 'Shield':
        // TODO: Implement shield effect
        this.io.to(session.id).emit('message', {
          message: `${player.username} activated Shield!`,
          type: 'system'
        });
        break;
        
      case 'Teleport':
        this.handleTeleport(session, player, target);
        break;
    }

    this.broadcastGameState(session);
  }

  private handleTeleport(session: GameSession, player: Player, target: any) {
    const range = 3; // tiles
    const dx = Math.sign(target.x - player.position.x);
    const dy = Math.sign(target.y - player.position.y);
    
    let newX = player.position.x;
    let newY = player.position.y;
    
    for (let i = 0; i < range; i++) {
      const testX = newX + dx;
      const testY = newY + dy;
      
      if (testX >= 0 && testX < session.maze[0].length &&
          testY >= 0 && testY < session.maze.length &&
          session.maze[testY][testX] !== 1) { // Not a wall
        newX = testX;
        newY = testY;
      } else {
        break;
      }
    }
    
    player.position = { x: newX, y: newY };
    
    this.io.to(session.id).emit('message', {
      message: `${player.username} teleported!`,
      type: 'system'
    });
  }

  private broadcastGameState(session: GameSession) {
    const gameState = {
      sessionId: session.id,
      players: this.serializePlayers(session.players),
      maze: session.maze,
      status: session.status
    };
    
    this.io.to(session.id).emit('gameState', gameState);
  }

  private serializeSession(session: GameSession) {
    return {
      id: session.id,
      roomCode: session.roomCode,
      hostId: session.hostId,
      players: this.serializePlayers(session.players),
      maze: session.maze,
      settings: session.settings,
      status: session.status,
      createdAt: session.createdAt
    };
  }

  private serializePlayers(players: Map<string, Player>) {
    const result: { [key: string]: any } = {};
    for (const [id, player] of players) {
      result[id] = {
        ...player,
        activeCooldowns: Object.fromEntries(player.activeCooldowns)
      };
    }
    return result;
  }
}