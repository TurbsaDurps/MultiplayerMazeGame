import { Player, Checkpoint, CellType } from '../../../shared/types/game';

export class Renderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private maze: number[][] = [];
    private checkpoints: Checkpoint[] = [];
    
    // Rendering properties
    private camera = { x: 0, y: 0 };
    private cellSize = 30;
    private playerSize = 12;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        
        // Set up canvas properties
        this.ctx.imageSmoothingEnabled = false;
    }

    public updateCanvasSize(width: number, height: number): void {
        this.canvas.width = width;
        this.canvas.height = height;
    }

    public setMazeData(maze: number[][], checkpoints: Checkpoint[]): void {
        this.maze = maze;
        this.checkpoints = checkpoints;
    }

    public render(players: Player[], currentPlayer: Player | null, deltaTime: number): void {
        // Clear canvas
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (!currentPlayer || this.maze.length === 0) {
            this.drawWaitingMessage();
            return;
        }

        // Update camera to follow current player
        this.updateCamera(currentPlayer);

        // Render maze
        this.renderMaze();
        
        // Render checkpoints
        this.renderCheckpoints();
        
        // Render players
        this.renderPlayers(players, currentPlayer);
        
        // Render UI overlay
        this.renderUI(currentPlayer);
    }

    private drawWaitingMessage(): void {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(
            'Waiting for game data...',
            this.canvas.width / 2,
            this.canvas.height / 2
        );
    }

    private updateCamera(player: Player): void {
        // Center camera on player with smooth following
        const targetX = player.x * this.cellSize - this.canvas.width / 2;
        const targetY = player.y * this.cellSize - this.canvas.height / 2;
        
        // Smooth camera movement
        this.camera.x += (targetX - this.camera.x) * 0.1;
        this.camera.y += (targetY - this.camera.y) * 0.1;
    }

    private renderMaze(): void {
        const startX = Math.floor(this.camera.x / this.cellSize);
        const startY = Math.floor(this.camera.y / this.cellSize);
        const endX = startX + Math.ceil(this.canvas.width / this.cellSize) + 1;
        const endY = startY + Math.ceil(this.canvas.height / this.cellSize) + 1;

        for (let y = Math.max(0, startY); y < Math.min(this.maze.length, endY); y++) {
            for (let x = Math.max(0, startX); x < Math.min(this.maze[0].length, endX); x++) {
                const screenX = x * this.cellSize - this.camera.x;
                const screenY = y * this.cellSize - this.camera.y;

                if (this.maze[y][x] === 0) {
                    // Wall
                    this.ctx.fillStyle = '#444444';
                    this.ctx.fillRect(screenX, screenY, this.cellSize, this.cellSize);
                    
                    // Wall border
                    this.ctx.strokeStyle = '#666666';
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(screenX, screenY, this.cellSize, this.cellSize);
                } else {
                    // Empty space
                    this.ctx.fillStyle = '#2a2a2a';
                    this.ctx.fillRect(screenX, screenY, this.cellSize, this.cellSize);
                }

                // Mark start position (green)
                if (x === 1 && y === 1) {
                    this.ctx.fillStyle = '#00ff00';
                    this.ctx.fillRect(screenX + 5, screenY + 5, this.cellSize - 10, this.cellSize - 10);
                }

                // Mark end position (red)
                if (x === this.maze[0].length - 2 && y === this.maze.length - 2) {
                    this.ctx.fillStyle = '#ff0000';
                    this.ctx.fillRect(screenX + 5, screenY + 5, this.cellSize - 10, this.cellSize - 10);
                }
            }
        }
    }

    private renderCheckpoints(): void {
        this.checkpoints.forEach(checkpoint => {
            const screenX = checkpoint.x * this.cellSize - this.camera.x;
            const screenY = checkpoint.y * this.cellSize - this.camera.y;

            // Only render if on screen
            if (screenX >= -this.cellSize && screenX <= this.canvas.width &&
                screenY >= -this.cellSize && screenY <= this.canvas.height) {
                
                this.ctx.fillStyle = checkpoint.reached ? '#888888' : '#ffff00';
                this.ctx.beginPath();
                this.ctx.arc(
                    screenX + this.cellSize / 2,
                    screenY + this.cellSize / 2,
                    8,
                    0,
                    Math.PI * 2
                );
                this.ctx.fill();

                // Checkpoint border
                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            }
        });
    }

    private renderPlayers(players: Player[], currentPlayer: Player): void {
        players.forEach(player => {
            if (!player.isAlive) return;

            const screenX = player.x * this.cellSize - this.camera.x;
            const screenY = player.y * this.cellSize - this.camera.y;

            // Only render if on screen
            if (screenX >= -this.cellSize && screenX <= this.canvas.width &&
                screenY >= -this.cellSize && screenY <= this.canvas.height) {

                // Player body
                this.ctx.fillStyle = player.color;
                this.ctx.beginPath();
                this.ctx.arc(screenX, screenY, this.playerSize, 0, Math.PI * 2);
                this.ctx.fill();

                // Player direction indicator
                const dirX = Math.cos(player.angle) * (this.playerSize + 5);
                const dirY = Math.sin(player.angle) * (this.playerSize + 5);
                
                this.ctx.strokeStyle = player.color;
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.moveTo(screenX, screenY);
                this.ctx.lineTo(screenX + dirX, screenY + dirY);
                this.ctx.stroke();

                // Player name/ID
                if (player.id === currentPlayer.id) {
                    this.ctx.fillStyle = '#ffffff';
                    this.ctx.font = '12px Arial';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillText('YOU', screenX, screenY - this.playerSize - 5);
                } else {
                    this.ctx.fillStyle = '#cccccc';
                    this.ctx.font = '10px Arial';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillText(
                        player.id.substring(0, 6),
                        screenX,
                        screenY - this.playerSize - 5
                    );
                }
            }
        });
    }

    private renderUI(player: Player): void {
        // Mini-map (optional for future implementation)
        // Health/lives indicator could go here
        // Ability cooldowns could go here
    }
}