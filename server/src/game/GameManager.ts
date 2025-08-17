import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { GameRoom } from './GameRoom';
import { ClientToServerEvents, ServerToClientEvents, GameState, Player } from '../../../shared/types/game';

export class GameManager {
  private io: Server<ClientToServerEvents, ServerToClientEvents>;
  private gameRooms: Map<string, GameRoom> = new Map();
  private playerRooms: Map<string, string> = new Map(); // playerId -> roomId

  constructor(io: Server<ClientToServerEvents, ServerToClientEvents>) {
    this.io = io;
    this.setupSocketHandlers();
    this.startGameLoop();
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
      console.log(`👤 Player connected: ${socket.id}`);

      socket.on('join-game', (roomId?: string) => {
        this.handleJoinGame(socket, roomId);
      });

      socket.on('player-move', (position, angle) => {
        this.handlePlayerMove(socket.id, position, angle);
      });

      socket.on('player-ready', () => {
        this.handlePlayerReady(socket.id);
      });

      socket.on('leave-game', () => {
        this.handleLeaveGame(socket.id);
      });

      socket.on('disconnect', () => {
        console.log(`👋 Player disconnected: ${socket.id}`);
        this.handleLeaveGame(socket.id);
      });
    });
  }

  private handleJoinGame(socket: Socket, roomId?: string): void {
    try {
      let room: GameRoom | null = null;

      if (roomId && this.gameRooms.has(roomId)) {
        room = this.gameRooms.get(roomId)!;
      } else {
        // Find an available room or create new one
        room = this.findAvailableRoom() || this.createNewRoom();
      }

      if (room.players.size >= room.maxPlayers) {
        socket.emit('error', 'Room is full');
        return;
      }

      // Create new player
      const player: Player = {
        id: socket.id,
        x: room.startPosition.x,
        y: room.startPosition.y,
        angle: 0,
        color: this.generatePlayerColor(room.players.size),
        lives: 3,
        checkpointsPassed: 0,
        isAlive: true
      };

      // Add player to room
      room.addPlayer(player);
      this.playerRooms.set(socket.id, room.id);
      socket.join(room.id);

      // Send game data to player
      socket.emit('game-joined', room.id, socket.id);
      socket.emit('maze-data', room.maze, room.checkpoints);
      
      // Update all players in room
      this.io.to(room.id).emit('game-state', {
        id: room.id,
        gameState: room.gameState,
        maxPlayers: room.maxPlayers
      });

      console.log(`🎮 Player ${socket.id} joined room ${room.id} (${room.players.size}/${room.maxPlayers})`);

    } catch (error) {
      console.error('Error joining game:', error);
      socket.emit('error', 'Failed to join game');
    }
  }

  private handlePlayerMove(playerId: string, position: { x: number; y: number }, angle: number): void {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) return;

    const room = this.gameRooms.get(roomId);
    if (!room || room.gameState !== GameState.IN_PROGRESS) return;

    room.updatePlayerPosition(playerId, position, angle);
  }

  private handlePlayerReady(playerId: string): void {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) return;

    const room = this.gameRooms.get(roomId);
    if (!room) return;

    room.setPlayerReady(playerId);

    if (room.canStartGame()) {
      room.startGame();
      this.io.to(roomId).emit('game-started');
      console.log(`🚀 Game started in room ${roomId}`);
    }
  }

  private handleLeaveGame(playerId: string): void {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) return;

    const room = this.gameRooms.get(roomId);
    if (!room) return;

    room.removePlayer(playerId);
    this.playerRooms.delete(playerId);

    if (room.players.size === 0) {
      this.gameRooms.delete(roomId);
      console.log(`🗑️  Deleted empty room ${roomId}`);
    } else {
      this.io.to(roomId).emit('game-state', {
        id: room.id,
        gameState: room.gameState,
        maxPlayers: room.maxPlayers
      });
    }
  }

  private findAvailableRoom(): GameRoom | null {
    for (const room of this.gameRooms.values()) {
      if (room.players.size < room.maxPlayers && room.gameState === GameState.WAITING) {
        return room;
      }
    }
    return null;
  }

  private createNewRoom(): GameRoom {
    const roomId = uuidv4();
    const room = new GameRoom(roomId, parseInt(process.env.MAX_PLAYERS_PER_GAME || '8'));
    this.gameRooms.set(roomId, room);
    console.log(`🏠 Created new room: ${roomId}`);
    return room;
  }

  private generatePlayerColor(playerIndex: number): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
      '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD'
    ];
    return colors[playerIndex % colors.length];
  }

  private startGameLoop(): void {
    const TICK_RATE = 60; // 60 FPS
    const TICK_INTERVAL = 1000 / TICK_RATE;

    setInterval(() => {
      for (const room of this.gameRooms.values()) {
        if (room.gameState === GameState.IN_PROGRESS) {
          room.update();
          
          // Send player updates
          const players = Array.from(room.players.values());
          this.io.to(room.id).emit('player-update', players);

          // Check for game completion
          if (room.checkGameCompletion()) {
            this.io.to(room.id).emit('game-finished', room.getWinnerId() || '');
          }
        }
      }
    }, TICK_INTERVAL);
  }
}