// server/src/server.ts
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';

import { DatabaseService } from './services/DatabaseService';
import { GameService } from './services/GameService';
import { AuthService } from './services/AuthService';
import { AuthController } from './controllers/AuthController';
import { GameController } from './controllers/GameController';
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
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:8000",
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../client')));

// Initialize services
const dbService = new DatabaseService();
const authService = new AuthService(dbService);
const gameService = new GameService(dbService);

// Initialize controllers
const authController = new AuthController(authService);
const gameController = new GameController(gameService, authService);

// Routes
app.use('/auth', createAuthRoutes(authController));

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/index.html'));
});

// Socket.io event handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Authentication
  socket.on('authenticate', (data) => {
    gameController.handleAuthentication(socket, data);
  });

  // Game management
  socket.on('createGame', (settings) => {
    gameController.handleCreateGame(socket, settings);
  });

  socket.on('joinGame', (data) => {
    gameController.handleJoinGame(socket, data);
  });

  socket.on('quickPlay', () => {
    gameController.handleQuickPlay(socket);
  });

  // Game actions
  socket.on('move', (data) => {
    gameController.handleMove(socket, data);
  });

  socket.on('updateFacing', (data) => {
    gameController.handleUpdateFacing(socket, data);
  });

  socket.on('useAbility', (data) => {
    gameController.handleUseAbility(socket, data);
  });

  socket.on('leaveGame', () => {
    gameController.handleLeaveGame(socket);
  });

  socket.on('disconnect', () => {
    gameController.handleDisconnect(socket);
  });
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

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await dbService.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

startServer();