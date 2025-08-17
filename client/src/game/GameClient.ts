import { io, Socket } from 'socket.io-client';
import { Renderer } from './Renderer';
import { InputHandler } from './InputHandler';
import { Player, GameState, Checkpoint, ClientToServerEvents, ServerToClientEvents } from '../../../shared/types/game';

export class GameClient {
    private socket: Socket<ServerToClientEvents, ClientToServerEvents>;
    private renderer: Renderer;
    private inputHandler: InputHandler;
    
    // Game state
    private playerId: string = '';
    private roomId: string = '';
    private players: Map<string, Player> = new Map();
    private maze: number[][] = [];
    private checkpoints: Checkpoint[] = [];
    private gameState: GameState = GameState.WAITING;
    private currentPlayer: Player | null = null;
    
    // UI elements
    private canvas: HTMLCanvasElement;
    private joinGameBtn: HTMLButtonElement;
    private readyBtn: HTMLButtonElement;
    private statusEl: HTMLElement;
    private roomIdEl: HTMLElement;
    private playerCountEl: HTMLElement;
    private playerLivesEl: HTMLElement;
    private checkpointCountEl: HTMLElement;
    private loadingScreen: HTMLElement;
    
    private lastUpdateTime: number = 0;
    private gameLoop: number = 0;

    constructor() {
        // Initialize socket connection
        this.socket = io('http://localhost:8080');
        
        // Get UI elements
        this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
        this.joinGameBtn = document.getElementById('joinGameBtn') as HTMLButtonElement;
        this.readyBtn = document.getElementById('readyBtn') as HTMLButtonElement;
        this.statusEl = document.getElementById('status') as HTMLElement;
        this.roomIdEl = document.getElementById('roomId') as HTMLElement;
        this.playerCountEl = document.getElementById('playerCount') as HTMLElement;
        this.playerLivesEl = document.getElementById('playerLives') as HTMLElement;
        this.checkpointCountEl = document.getElementById('checkpointCount') as HTMLElement;
        this.loadingScreen = document.getElementById('loadingScreen') as HTMLElement;
        
        // Initialize renderer and input handler
        this.renderer = new Renderer(this.canvas);
        this.inputHandler = new InputHandler(this.canvas);
    }

    public initialize(): void {
        this.setupCanvas();
        this.setupSocketHandlers();
        this.setupUIHandlers();
        this.startGameLoop();
    }

    private setupCanvas(): void {
        // Make canvas responsive
        const resizeCanvas = () => {
            const container = this.canvas.parentElement!;
            const ui = document.getElementById('ui')!;
            
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight - ui.offsetHeight;
            
            this.renderer.updateCanvasSize(this.canvas.width, this.canvas.height);
        };
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
    }

    private setupSocketHandlers(): void {
        this.socket.on('connect', () => {
            console.log('🔗 Connected to server');
            this.statusEl.textContent = 'Connected';
            this.hideLoadingScreen();
        });

        this.socket.on('disconnect', () => {
            console.log('❌ Disconnected from server');
            this.statusEl.textContent = 'Disconnected';
            this.showLoadingScreen();
        });

        this.socket.on('game-joined', (roomId, playerId) => {
            console.log(`🎮 Joined game room: ${roomId}`);
            this.roomId = roomId;
            this.playerId = playerId;
            this.roomIdEl.textContent = roomId.substring(0, 8);
            this.readyBtn.disabled = false;
            this.statusEl.textContent = 'In Lobby';
        });

        this.socket.on('maze-data', (maze, checkpoints) => {
            console.log('🗺️  Received maze data');
            this.maze = maze;
            this.checkpoints = checkpoints;
            this.renderer.setMazeData(maze, checkpoints);
        });

        this.socket.on('game-state', (gameRoom) => {
            console.log('📊 Game state updated', gameRoom);
            if (gameRoom.gameState) {
                this.gameState = gameRoom.gameState;
            }
            
            const playerCount = this.players.size;
            const maxPlayers = gameRoom.maxPlayers || 8;
            this.playerCountEl.textContent = `${playerCount}/${maxPlayers}`;
            
            this.updateGameState();
        });

        this.socket.on('player-update', (players) => {
            this.players.clear();
            players.forEach(player => {
                this.players.set(player.id, player);
                if (player.id === this.playerId) {
                    this.currentPlayer = player;
                    this.playerLivesEl.textContent = player.lives.toString();
                    this.checkpointCountEl.textContent = player.checkpointsPassed.toString();
                }
            });
            
            const playerCount = players.length;
            const currentCount = this.playerCountEl.textContent?.split('/')[1] || '8';
            this.playerCountEl.textContent = `${playerCount}/${currentCount}`;
        });

        this.socket.on('game-started', () => {
            console.log('🚀 Game started!');
            this.gameState = GameState.IN_PROGRESS;
            this.statusEl.textContent = 'Playing';
            this.readyBtn.disabled = true;
            this.joinGameBtn.disabled = true;
        });

        this.socket.on('game-finished', (winnerId) => {
            console.log('🏆 Game finished! Winner:', winnerId);
            this.gameState = GameState.FINISHED;
            
            if (winnerId === this.playerId) {
                this.statusEl.textContent = 'You Won! 🎉';
            } else {
                const winner = this.players.get(winnerId);
                this.statusEl.textContent = `Game Over - Winner: Player ${winnerId.substring(0, 8)}`;
            }
            
            // Re-enable join button after a delay
            setTimeout(() => {
                this.joinGameBtn.disabled = false;
                this.readyBtn.disabled = true;
            }, 3000);
        });

        this.socket.on('error', (message) => {
            console.error('❌ Server error:', message);
            alert(`Error: ${message}`);
        });
    }

    private setupUIHandlers(): void {
        this.joinGameBtn.addEventListener('click', () => {
            this.socket.emit('join-game');
            this.joinGameBtn.disabled = true;
        });

        this.readyBtn.addEventListener('click', () => {
            this.socket.emit('player-ready');
            this.readyBtn.disabled = true;
            this.statusEl.textContent = 'Ready - Waiting for others';
        });

        // Handle input
        this.inputHandler.onMove = (position, angle) => {
            if (this.gameState === GameState.IN_PROGRESS && this.currentPlayer) {
                this.socket.emit('player-move', position, angle);
            }
        };
    }

    private updateGameState(): void {
        switch (this.gameState) {
            case GameState.WAITING:
                this.statusEl.textContent = 'In Lobby';
                break;
            case GameState.STARTING:
                this.statusEl.textContent = 'Starting...';
                break;
            case GameState.IN_PROGRESS:
                this.statusEl.textContent = 'Playing';
                break;
            case GameState.FINISHED:
                break; // Handled in game-finished event
        }
    }

    private startGameLoop(): void {
        const gameLoop = (timestamp: number) => {
            const deltaTime = timestamp - this.lastUpdateTime;
            this.lastUpdateTime = timestamp;

            // Update input handler
            this.inputHandler.update(deltaTime);

            // Render the game
            this.renderer.render(
                Array.from(this.players.values()),
                this.currentPlayer,
                deltaTime
            );

            this.gameLoop = requestAnimationFrame(gameLoop);
        };

        this.gameLoop = requestAnimationFrame(gameLoop);
    }

    private showLoadingScreen(): void {
        this.loadingScreen.style.display = 'flex';
    }

    private hideLoadingScreen(): void {
        this.loadingScreen.style.display = 'none';
    }
}