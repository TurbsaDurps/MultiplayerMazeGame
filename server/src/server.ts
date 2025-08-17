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
