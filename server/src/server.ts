import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { GameManager } from './game/GameManager';
import { ClientToServerEvents, ServerToClientEvents } from '../../shared/types/game';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Serve static files from client build
app.use(express.static(path.join(__dirname, '../../client/dist')));

const gameManager = new GameManager(io);

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  console.log(`🎮 Maze Game Server running on port ${PORT}`);
  console.log(`🌐 Client URL: http://localhost:3000`);
});