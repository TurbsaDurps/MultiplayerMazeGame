import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';

import { DatabaseService } from './services/DatabaseService';
import { GameManager } from './services/GameManager';
import { AuthService } from './services/AuthService';
import { SocketHandler } from './controllers/SocketHandler';
import { createAuthRoutes } from './routes/authRoutes';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:8000",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false // Allow inline scripts for development
}));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../client')));

// Initialize services
const dbService = new DatabaseService();
const authService = new AuthService(dbService);
const gameManager = new GameManager(dbService);
const socketHandler = new SocketHandler(io, authService, gameManager);

// Routes
app.use('/auth', createAuthRoutes(dbService));

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/index.html'));
});

// Initialize database connection
async function startServer() {
  try {
    await dbService.initialize();
    console.log('Database connected successfully');
    
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log(`Game server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
    
    // Initialize socket handlers
    socketHandler.initialize();
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await dbService.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

startServer();

// server/src/services/DatabaseService.ts
import oracledb from 'oracledb';

export class DatabaseService {
  private pool?: oracledb.Pool;

  async initialize(): Promise<void> {
    try {
      this.pool = await oracledb.createPool({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECT_STRING,
        poolMin: 2,
        poolMax: 10,
        poolIncrement: 1,
        poolTimeout: 300
      });
      
      // Test connection
      const connection = await this.getConnection();
      await connection.close();
      console.log('Database pool created successfully');
      
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  async getConnection(): Promise<oracledb.Connection> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }
    return await this.pool.getConnection();
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      console.log('Database pool closed');
    }
  }

  // Helper method for executing queries
  async execute(sql: string, binds: any[] = [], options: oracledb.ExecuteOptions = {}): Promise<oracledb.Result<any>> {
    let connection;
    try {
      connection = await this.getConnection();
      const result = await connection.execute(sql, binds, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        autoCommit: true,
        ...options
      });
      return result;
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  }
}

// server/src/services/AuthService.ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { DatabaseService } from './DatabaseService';
import { User, CreateUserDto } from '../types/User';

export class AuthService {
  constructor(private dbService: DatabaseService) {}

  async register(userData: CreateUserDto): Promise<User> {
    const hashedPassword = await bcrypt.hash(userData.password, 12);
    
    const result = await this.dbService.execute(
      `INSERT INTO users (username, email, password_hash, coins) 
       VALUES (:username, :email, :password, 100) 
       RETURNING id, username, email, coins, created_at INTO :id, :username_out, :email_out, :coins_out, :created_at`,
      {
        username: userData.username,
        email: userData.email.toLowerCase(),
        password: hashedPassword,
        id: { dir: oracledb.BIND_OUT, type: oracledb.DB_TYPE_RAW },
        username_out: { dir: oracledb.BIND_OUT, type: oracledb.DB_TYPE_VARCHAR },
        email_out: { dir: oracledb.BIND_OUT, type: oracledb.DB_TYPE_VARCHAR },
        coins_out: { dir: oracledb.BIND_OUT, type: oracledb.DB_TYPE_NUMBER },
        created_at: { dir: oracledb.BIND_OUT, type: oracledb.DB_TYPE_TIMESTAMP }
      }
    );

    return {
      id: result.outBinds.id,
      username: result.outBinds.username_out,
      email: result.outBinds.email_out,
      coins: result.outBinds.coins_out,
      createdAt: result.outBinds.created_at
    };
  }

  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const result = await this.dbService.execute(
      'SELECT id, username, email, password_hash, coins, created_at FROM users WHERE email = :email',
      [email.toLowerCase()]
    );

    if (result.rows?.length === 0) {
      throw new Error('Invalid credentials');
    }

    const userData = result.rows![0] as any;
    const isValidPassword = await bcrypt.compare(password, userData.PASSWORD_HASH);
    
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    const user: User = {
      id: userData.ID,
      username: userData.USERNAME,
      email: userData.EMAIL,
      coins: userData.COINS,
      createdAt: userData.CREATED_AT
    };

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    return { user, token };
  }

  async verifyToken(token: string): Promise<User> {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
      
      const result = await this.dbService.execute(
        'SELECT id, username, email, coins, created_at FROM users WHERE id = :id',
        [decoded.userId]
      );

      if (result.rows?.length === 0) {
        throw new Error('User not found');
      }

      const userData = result.rows![0] as any;
      return {
        id: userData.ID,
        username: userData.USERNAME,
        email: userData.EMAIL,
        coins: userData.COINS,
        createdAt: userData.CREATED_AT
      };
    } catch (error) {
      throw new Error('Invalid token');
    }
  }
}

// server/src/services/GameManager.ts
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from './DatabaseService';
import { GameSession, Player, Ability } from '../types/Game';
import { MazeGenerator } from '../utils/MazeGenerator';
import { DEFAULT_GAME_CONFIG } from '../../../shared/types/GameConfig';

export class GameManager {
  private activeSessions: Map<string, GameSession> = new Map();
  private playerSessions: Map<string, string> = new Map(); // playerId -> sessionId

  constructor(private dbService: DatabaseService) {}

  async createSession(hostId: string, settings: any): Promise<GameSession> {
    const roomCode = this.generateRoomCode();
    const sessionId = uuidv4();

    // Calculate maze size based on settings
    const playerCount = 1; // Starting with host
    const mazeSize = Math.min(
      DEFAULT_GAME_CONFIG.maze.maxSize,
      Math.max(
        DEFAULT_GAME_CONFIG.maze.minSize,
        settings.baseSize + (playerCount * DEFAULT_GAME_CONFIG.maze.sizeMultiplier)
      )
    );

    // Create session in database
    await this.dbService.execute(
      `INSERT INTO game_sessions (id, room_code, max_players, maze_size, difficulty, has_time_limit, time_limit_minutes)
       VALUES (:id, :roomCode, :maxPlayers, :mazeSize, :difficulty, :hasTimeLimit, :timeLimit)`,
      [sessionId, roomCode, settings.maxPlayers || 6, mazeSize, settings.difficulty || 1,
       settings.hasTimeLimit ? 1 : 0, settings.timeLimitMinutes || null]
    );

    // Generate maze
    const maze = MazeGenerator.generate(mazeSize, settings.difficulty);

    const session: GameSession = {
      id: sessionId,
      roomCode,
      hostId,
      players: new Map(),
      maze,
      settings: {
        maxPlayers: settings.maxPlayers || 6,
        difficulty: settings.difficulty || 1,
        hasTimeLimit: settings.hasTimeLimit || false,
        timeLimitMinutes: settings.timeLimitMinutes || 30
      },
      status: 'waiting',
      createdAt: new Date()
    };

    this.activeSessions.set(sessionId, session);
    return session;
  }

  async joinSession(roomCode: string, playerId: string): Promise<GameSession> {
    // Find session by room code
    let targetSession: GameSession | undefined;
    for (const session of this.activeSessions.values()) {
      if (session.roomCode === roomCode && session.status === 'waiting') {
        targetSession = session;
        break;
      }
    }

    if (!targetSession) {
      throw new Error('Game session not found or already started');
    }

    if (targetSession.players.size >= targetSession.settings.maxPlayers) {
      throw new Error('Game session is full');
    }

    // Add player to session
    const startPosition = this.findSpawnPosition(targetSession.maze);
    const playerAbilities = await this.getPlayerStartingAbilities(playerId);

    const player: Player = {
      id: playerId,
      position: startPosition,
      facing: 0, // radians
      lives: DEFAULT_GAME_CONFIG.players.defaultLives,
      eliminations: 0,
      checkpointsReached: 0,
      status: 'alive',
      abilities: playerAbilities,
      activeCooldowns: new Map(),
      lastCheckpointPosition: startPosition
    };

    targetSession.players.set(playerId, player);
    this.playerSessions.set(playerId, targetSession.id);

    // Update database
    await this.dbService.execute(
      `INSERT INTO game_participants (session_id, user_id, position_x, position_y, selected_abilities)
       VALUES (:sessionId, :userId, :x, :y, :abilities)`,
      [targetSession.id, playerId, startPosition.x, startPosition.y, JSON.stringify(playerAbilities.map(a => a.id))]
    );

    return targetSession;
  }

  getSession(sessionId: string): GameSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  getSessionByPlayer(playerId: string): GameSession | undefined {
    const sessionId = this.playerSessions.get(playerId);
    return sessionId ? this.activeSessions.get(sessionId) : undefined;
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private findSpawnPosition(maze: number[][]): { x: number; y: number } {
    // Find a valid spawn position (floor tile)
    for (let y = 1; y < maze.length - 1; y++) {
      for (let x = 1; x < maze[0].length - 1; x++) {
        if (maze[y][x] === 0) { // 0 = floor
          return { x, y };
        }
      }
    }
    return { x: 1, y: 1 }; // fallback
  }

  private async getPlayerStartingAbilities(playerId: string): Promise<Ability[]> {
    const result = await this.dbService.execute(
      `SELECT a.id, a.name, a.description, a.cooldown_ms, a.ability_type, a.effect_data
       FROM abilities a
       JOIN user_abilities ua ON a.id = ua.ability_id
       WHERE ua.user_id = :userId AND a.is_starter = 1`,
      [playerId]
    );

    if (!result.rows || result.rows.length === 0) {
      // If no abilities, give them basic starter abilities
      const starterResult = await this.dbService.execute(
        'SELECT id, name, description, cooldown_ms, ability_type, effect_data FROM abilities WHERE is_starter = 1',
        []
      );
      
      return (starterResult.rows || []).slice(0, 3).map((row: any) => ({
        id: row.ID,
        name: row.NAME,
        description: row.DESCRIPTION,
        cooldownMs: row.COOLDOWN_MS,
        type: row.ABILITY_TYPE,
        effectData: JSON.parse(row.EFFECT_DATA)
      }));
    }

    return result.rows.map((row: any) => ({
      id: row.ID,
      name: row.NAME,
      description: row.DESCRIPTION,
      cooldownMs: row.COOLDOWN_MS,
      type: row.ABILITY_TYPE,
      effectData: JSON.parse(row.EFFECT_DATA)
    }));
  }
}