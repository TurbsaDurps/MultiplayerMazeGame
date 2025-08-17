// Game rendering and visual effects

class GameRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private tileSize: number = 32;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        
        if (!this.ctx) {
            throw new Error('Could not get 2D context from canvas');
        }
        
        // Set up canvas properties for crisp rendering
        this.ctx.imageSmoothingEnabled = false;
    }

    /**
     * Clear the entire canvas
     */
    clear(): void {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Render the maze with camera offset
     */
    renderMaze(maze: number[][], cameraOffset: { x: number; y: number }): void {
        if (!maze || maze.length === 0) return;

        const { x: cameraX, y: cameraY } = cameraOffset;

        for (let y = 0; y < maze.length; y++) {
            for (let x = 0; x < maze[0].length; x++) {
                const tileType = maze[y][x];
                const screenX = x * this.tileSize + cameraX;
                const screenY = y * this.tileSize + cameraY;

                // Only render visible tiles for performance
                if (screenX < -this.tileSize || screenX > this.canvas.width ||
                    screenY < -this.tileSize || screenY > this.canvas.height) {
                    continue;
                }

                this.renderTile(tileType, screenX, screenY);
            }
        }
    }

    /**
     * Render a single tile based on its type
     */
    private renderTile(tileType: number, x: number, y: number): void {
        switch (tileType) {
            case 0: // Floor
                this.ctx.fillStyle = '#333';
                this.ctx.fillRect(x, y, this.tileSize, this.tileSize);
                break;
                
            case 1: // Wall
                this.ctx.fillStyle = '#666';
                this.ctx.fillRect(x, y, this.tileSize, this.tileSize);
                
                // Add border for walls
                this.ctx.strokeStyle = '#888';
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(x, y, this.tileSize, this.tileSize);
                break;
                
            case 2: // Checkpoint
                this.ctx.fillStyle = '#FFD700';
                this.ctx.fillRect(x, y, this.tileSize, this.tileSize);
                
                // Add pulsing effect
                const pulseIntensity = Math.sin(Date.now() / 200) * 0.2 + 0.8;
                this.ctx.fillStyle = `rgba(255, 215, 0, ${pulseIntensity})`;
                this.ctx.fillRect(x + 4, y + 4, this.tileSize - 8, this.tileSize - 8);
                break;
                
            case 3: // Finish
                this.ctx.fillStyle = '#4CAF50';
                this.ctx.fillRect(x, y, this.tileSize, this.tileSize);
                
                // Add checkered pattern
                this.ctx.fillStyle = '#81C784';
                for (let i = 0; i < 4; i++) {
                    for (let j = 0; j < 4; j++) {
                        if ((i + j) % 2 === 0) {
                            this.ctx.fillRect(
                                x + i * (this.tileSize / 4),
                                y + j * (this.tileSize / 4),
                                this.tileSize / 4,
                                this.tileSize / 4
                            );
                        }
                    }
                }
                break;
                
            case 4: // Obstacle
                this.ctx.fillStyle = '#8B0000';
                this.ctx.fillRect(x, y, this.tileSize, this.tileSize);
                
                // Add danger symbol (X)
                this.ctx.strokeStyle = '#FF0000';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.moveTo(x + 8, y + 8);
                this.ctx.lineTo(x + this.tileSize - 8, y + this.tileSize - 8);
                this.ctx.moveTo(x + this.tileSize - 8, y + 8);
                this.ctx.lineTo(x + 8, y + this.tileSize - 8);
                this.ctx.stroke();
                break;
                
            default:
                this.ctx.fillStyle = '#000';
                this.ctx.fillRect(x, y, this.tileSize, this.tileSize);
        }
    }

    /**
     * Render all players with camera offset
     */
    renderPlayers(players: { [key: string]: any }, cameraOffset: { x: number; y: number }, currentUserId: string): void {
        if (!players) return;

        const { x: cameraX, y: cameraY } = cameraOffset;

        Object.values(players).forEach((player: any, index: number) => {
            this.renderPlayer(player, index, cameraX, cameraY, player.id === currentUserId);
        });
    }

    /**
     * Render a single player
     */
    private renderPlayer(player: any, colorIndex: number, cameraX: number, cameraY: number, isCurrentPlayer: boolean): void {
        const x = player.position.x * this.tileSize + cameraX + this.tileSize / 2;
        const y = player.position.y * this.tileSize + cameraY + this.tileSize / 2;

        // Player body (circle)
        const playerColor = this.getPlayerColor(colorIndex);
        this.ctx.fillStyle = playerColor;
        this.ctx.beginPath();
        this.ctx.arc(x, y, this.tileSize / 3, 0, Math.PI * 2);
        this.ctx.fill();

        // Add outline for current player
        if (isCurrentPlayer) {
            this.ctx.strokeStyle = '#FFF';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }

        // Player "fists" (direction indicator)
        const fistDistance = this.tileSize / 2;
        const fistSize = 4;

        const fist1X = x + Math.cos(player.facing - 0.3) * fistDistance;
        const fist1Y = y + Math.sin(player.facing - 0.3) * fistDistance;
        const fist2X = x + Math.cos(player.facing + 0.3) * fistDistance;
        const fist2Y = y + Math.sin(player.facing + 0.3) * fistDistance;

        this.ctx.fillStyle = '#FFF';
        this.ctx.beginPath();
        this.ctx.arc(fist1X, fist1Y, fistSize, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.arc(fist2X, fist2Y, fistSize, 0, Math.PI * 2);
        this.ctx.fill();

        // Player name
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        this.ctx.strokeText(player.username || 'Player', x, y - this.tileSize / 2 - 5);
        this.ctx.fillText(player.username || 'Player', x, y - this.tileSize / 2 - 5);

        // Lives indicator (hearts)
        for (let i = 0; i < player.lives; i++) {
            const heartX = x - 10 + i * 8;
            const heartY = y + this.tileSize / 2 + 15;
            
            this.ctx.fillStyle = '#f44336';
            this.ctx.font = '12px Arial';
            this.ctx.fillText('♥', heartX, heartY);
        }

        // Status indicators
        if (player.status === 'dead') {
            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
            this.ctx.beginPath();
            this.ctx.arc(x, y, this.tileSize / 2, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.fillStyle = '#FFF';
            this.ctx.font = '16px Arial';
            this.ctx.fillText('💀', x, y + 4);
        } else if (player.status === 'finished') {
            this.ctx.fillStyle = 'rgba(76, 175, 80, 0.7)';
            this.ctx.beginPath();
            this.ctx.arc(x, y, this.tileSize / 2, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.fillStyle = '#FFF';
            this.ctx.font = '16px Arial';
            this.ctx.fillText('🏆', x, y + 4);
        }
    }

    /**
     * Render visual effects (abilities, particles, etc.)
     */
    renderEffects(players: { [key: string]: any }, cameraOffset: { x: number; y: number }): void {
        if (!players) return;

        const { x: cameraX, y: cameraY } = cameraOffset;

        Object.values(players).forEach((player: any) => {
            // Example: Shield effect
            if (this.playerHasActiveEffect(player, 'shield')) {
                const x = player.position.x * this.tileSize + cameraX + this.tileSize / 2;
                const y = player.position.y * this.tileSize + cameraY + this.tileSize / 2;

                this.ctx.strokeStyle = '#00BCD4';
                this.ctx.lineWidth = 3;
                this.ctx.setLineDash([5, 5]);
                this.ctx.beginPath();
                this.ctx.arc(x, y, this.tileSize / 2 + 5, 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.setLineDash([]);
            }

            // Example: Speed boost effect
            if (this.playerHasActiveEffect(player, 'speed')) {
                const x = player.position.x * this.tileSize + cameraX + this.tileSize / 2;
                const y = player.position.y * this.tileSize + cameraY + this.tileSize / 2;

                // Speed lines
                this.ctx.strokeStyle = '#FFEB3B';
                this.ctx.lineWidth = 2;
                for (let i = 0; i < 4; i++) {
                    const angle = (i / 4) * Math.PI * 2 + Date.now() / 200;
                    const startRadius = this.tileSize / 2 + 8;
                    const endRadius = this.tileSize / 2 + 16;
                    
                    this.ctx.beginPath();
                    this.ctx.moveTo(
                        x + Math.cos(angle) * startRadius,
                        y + Math.sin(angle) * startRadius
                    );
                    this.ctx.lineTo(
                        x + Math.cos(angle) * endRadius,
                        y + Math.sin(angle) * endRadius
                    );
                    this.ctx.stroke();
                }
            }
        });
    }

    /**
     * Get player color based on index
     */
    private getPlayerColor(index: number): string {
        const colors = [
            '#4CAF50', '#2196F3', '#FF9800', '#9C27B0',
            '#F44336', '#00BCD4', '#FFEB3B', '#795548'
        ];
        return colors[index % colors.length];
    }

    /**
     * Check if player has an active effect (placeholder implementation)
     */
    private playerHasActiveEffect(player: any, effectType: string): boolean {
        // This would check the player's active effects/abilities
        // For now, return false as placeholder
        return false;
    }

    /**
     * Calculate camera offset to center on a specific player
     */
    calculateCameraOffset(targetPlayer: any): { x: number; y: number } {
        if (!targetPlayer) {
            return { x: 0, y: 0 };
        }

        return {
            x: this.canvas.width / 2 - targetPlayer.position.x * this.tileSize,
            y: this.canvas.height / 2 - targetPlayer.position.y * this.tileSize
        };
    }

    /**
     * Render UI overlay on the canvas (minimap, crosshair, etc.)
     */
    renderUIOverlay(gameSession: any, currentUserId: string): void {
        // Crosshair in center of screen
        this.renderCrosshair();

        // Mini health/lives indicator
        if (gameSession && gameSession.players && gameSession.players[currentUserId]) {
            this.renderPlayerStatus(gameSession.players[currentUserId]);
        }
    }

    /**
     * Render crosshair in the center of the screen
     */
    private renderCrosshair(): void {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([2, 2]);

        this.ctx.beginPath();
        this.ctx.moveTo(centerX - 10, centerY);
        this.ctx.lineTo(centerX + 10, centerY);
        this.ctx.moveTo(centerX, centerY - 10);
        this.ctx.lineTo(centerX, centerY + 10);
        this.ctx.stroke();

        this.ctx.setLineDash([]);
    }

    /**
     * Render player status overlay
     */
    private renderPlayerStatus(player: any): void {
        // Lives indicator in top-left
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'left';

        for (let i = 0; i < player.lives; i++) {
            this.ctx.fillStyle = '#f44336';
            this.ctx.fillText('♥', 20 + i * 20, 30);
        }

        // Ability cooldown indicators
        this.renderAbilityCooldowns(player);
    }

    /**
     * Render ability cooldown indicators on canvas
     */
    private renderAbilityCooldowns(player: any): void {
        if (!player.abilities || !player.activeCooldowns) return;

        const startX = 20;
        const startY = 60;
        const abilitySize = 40;
        const spacing = 50;

        player.abilities.forEach((ability: any, index: number) => {
            const x = startX + index * spacing;
            const y = startY;

            // Ability background
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(x, y, abilitySize, abilitySize);

            // Ability border
            const cooldownEnd = player.activeCooldowns[ability.id] || 0;
            const isOnCooldown = Date.now() < cooldownEnd;

            this.ctx.strokeStyle = isOnCooldown ? '#f44336' : '#4CAF50';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x, y, abilitySize, abilitySize);

            // Ability key indicator
            this.ctx.fillStyle = '#FFF';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText((index + 1).toString(), x + abilitySize / 2, y + 12);

            // Cooldown overlay
            if (isOnCooldown) {
                const remainingTime = Math.ceil((cooldownEnd - Date.now()) / 1000);
                const progress = (cooldownEnd - Date.now()) / ability.cooldownMs;

                // Cooldown fill
                this.ctx.fillStyle = 'rgba(244, 67, 54, 0.7)';
                this.ctx.fillRect(x, y + abilitySize * (1 - progress), abilitySize, abilitySize * progress);

                // Cooldown text
                this.ctx.fillStyle = '#FFF';
                this.ctx.font = '10px Arial';
                this.ctx.fillText(remainingTime.toString(), x + abilitySize / 2, y + abilitySize / 2 + 3);
            }
        });
    }

    /**
     * Set tile size for rendering
     */
    setTileSize(size: number): void {
        this.tileSize = Math.max(8, Math.min(64, size));
    }

    /**
     * Get current tile size
     */
    getTileSize(): number {
        return this.tileSize;
    }

    /**
     * Render debug information
     */
    renderDebugInfo(gameSession: any, currentUserId: string, fps: number): void {
        if (!gameSession) return;

        const player = gameSession.players?.[currentUserId];
        if (!player) return;

        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(this.canvas.width - 150, 10, 140, 80);

        this.ctx.fillStyle = '#FFF';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'left';

        const debugInfo = [
            `FPS: ${fps.toFixed(1)}`,
            `Pos: ${player.position.x}, ${player.position.y}`,
            `Facing: ${(player.facing * 180 / Math.PI).toFixed(1)}°`,
            `Status: ${player.status}`,
            `Players: ${Object.keys(gameSession.players).length}`
        ];

        debugInfo.forEach((info, index) => {
            this.ctx.fillText(info, this.canvas.width - 145, 25 + index * 15);
        });
    }
}