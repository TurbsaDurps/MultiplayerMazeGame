// Main game client class that handles all game logic and networking

class GameClient {
    // Core properties
    private socket: any = null;
    private currentUser: any = null;
    private gameSession: any = null;
    private renderer: GameRenderer;
    private elements: any = {};

    // Input handling
    private keys: Set<string> = new Set();
    private mouse: { x: number; y: number } = { x: 0, y: 0 };

    // Game loop
    private lastUpdateTime: number = 0;
    private lastFrameTime: number = 0;
    private frameCount: number = 0;
    private fps: number = 60;
    private debugMode: boolean = false;

    constructor() {
        this.initializeElements();
        this.attachEventListeners();
        
        const canvas = this.elements.gameCanvas;
        this.renderer = new GameRenderer(canvas);
    }

    /**
     * Initialize all DOM elements
     */
    private initializeElements(): void {
        this.elements = {
            loginScreen: document.getElementById('loginScreen'),
            mainMenu: document.getElementById('mainMenu'),
            gameScreen: document.getElementById('gameScreen'),
            loginUsername: document.getElementById('loginUsername'),
            loginEmail: document.getElementById('loginEmail'),
            loginPassword: document.getElementById('loginPassword'),
            loginBtn: document.getElementById('loginBtn'),
            registerBtn: document.getElementById('registerBtn'),
            loginMessage: document.getElementById('loginMessage'),
            playerName: document.getElementById('playerName'),
            coinCount: document.getElementById('coinCount'),
            createGameBtn: document.getElementById('createGameBtn'),
            quickPlayBtn: document.getElementById('quickPlayBtn'),
            roomCodeInput: document.getElementById('roomCodeInput'),
            joinGameBtn: document.getElementById('joinGameBtn'),
            logoutBtn: document.getElementById('logoutBtn'),
            menuMessage: document.getElementById('menuMessage'),
            gameCanvas: document.getElementById('gameCanvas'),
            roomCode: document.getElementById('roomCode'),
            livesCount: document.getElementById('livesCount'),
            eliminationCount: document.getElementById('eliminationCount'),
            checkpointCount: document.getElementById('checkpointCount'),
            players: document.getElementById('players'),
            abilityCards: document.getElementById('abilityCards'),
            messages: document.getElementById('messages'),
            leaveGameBtn: document.getElementById('leaveGameBtn')
        };

        // Validate that all elements exist
        for (const [key, element] of Object.entries(this.elements)) {
            if (!element) {
                console.error(`Element not found: ${key}`);
            }
        }
    }

    /**
     * Attach all event listeners
     */
    private attachEventListeners(): void {
        // Authentication events
        this.elements.loginBtn?.addEventListener('click', () => this.login());
        this.elements.registerBtn?.addEventListener('click', () => this.register());
        this.elements.logoutBtn?.addEventListener('click', () => this.logout());

        // Menu events
        this.elements.createGameBtn?.addEventListener('click', () => this.createGame());
        this.elements.quickPlayBtn?.addEventListener('click', () => this.quickPlay());
        this.elements.joinGameBtn?.addEventListener('click', () => this.joinGame());
        this.elements.leaveGameBtn?.addEventListener('click', () => this.leaveGame());

        // Keyboard events
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));

        // Mouse events for game canvas
        if (this.elements.gameCanvas) {
            this.elements.gameCanvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
            this.elements.gameCanvas.addEventListener('click', (e) => this.handleClick(e));
        }

        // Enter key support for inputs
        const enterInputs = [this.elements.loginPassword, this.elements.roomCodeInput];
        enterInputs.forEach((input, index) => {
            input?.addEventListener('keypress', (e: KeyboardEvent) => {
                if (e.key === 'Enter') {
                    if (index === 0) this.login();
                    if (index === 1) this.joinGame();
                }
            });
        });

        // Debug mode toggle
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'D')) {
                e.preventDefault();
                this.debugMode = !this.debugMode;
            }
        });
    }

    /**
     * Initialize socket connection and event handlers
     */
    private connectSocket(): void {
        this.socket = io('http://localhost:3000');

        this.socket.on('connect', () => {
            console.log('Connected to server');
            
            // Auto-authenticate if we have a token
            const token = localStorage.getItem('authToken');
            if (token) {
                this.socket.emit('authenticate', { token });
            }
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.addMessage('Disconnected from server', 'system');
        });

        this.socket.on('authenticated', (data: any) => {
            console.log('Authenticated:', data.user);
            this.currentUser = data.user;
        });

        this.socket.on('gameJoined', (data: any) => {
            this.gameSession = data.session;
            this.showScreen('gameScreen');
            this.elements.roomCode.textContent = this.gameSession.roomCode;
            this.updatePlayerList();
            this.updateAbilities();
            this.addMessage('Joined game successfully!', 'system');
        });

        this.socket.on('playerJoined', (data: any) => {
            if (this.gameSession) {
                this.gameSession.players = data.players;
                this.updatePlayerList();
                this.addMessage(`${data.newPlayer} joined the game`, 'system');
            }
        });

        this.socket.on('playerLeft', (data: any) => {
            if (this.gameSession) {
                this.gameSession.players = data.players;
                this.updatePlayerList();
                this.addMessage(`${data.leftPlayer} left the game`, 'system');
            }
        });

        this.socket.on('gameState', (data: any) => {
            this.gameSession = data;
            this.updateUI();
        });

        this.socket.on('message', (data: any) => {
            this.addMessage(data.message, data.type || 'normal');
        });

        this.socket.on('error', (data: any) => {
            this.showMessage(data.message, 'error');
        });
    }

    /**
     * Handle user login
     */
    private async login(): Promise<void> {
        const email = this.elements.loginEmail?.value?.trim();
        const password = this.elements.loginPassword?.value;

        if (!email || !password) {
            this.showMessage('Please fill in all fields', 'error', 'loginMessage');
            return;
        }

        try {
            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.currentUser = data.user;
                localStorage.setItem('authToken', data.token);
                this.showMainMenu();
                this.connectSocket();
            } else {
                this.showMessage(data.message || 'Login failed', 'error', 'loginMessage');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showMessage('Connection error', 'error', 'loginMessage');
        }
    }

    /**
     * Handle user registration
     */
    private async register(): Promise<void> {
        const username = this.elements.loginUsername?.value?.trim();
        const email = this.elements.loginEmail?.value?.trim();
        const password = this.elements.loginPassword?.value;

        if (!username || !email || !password) {
            this.showMessage('Please fill in all fields', 'error', 'loginMessage');
            return;
        }

        if (password.length < 6) {
            this.showMessage('Password must be at least 6 characters', 'error', 'loginMessage');
            return;
        }

        try {
            const response = await fetch('/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.showMessage('Registration successful! Please login.', 'success', 'loginMessage');
                this.elements.loginUsername.value = '';
                this.elements.loginPassword.value = '';
            } else {
                this.showMessage(data.message || 'Registration failed', 'error', 'loginMessage');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showMessage('Connection error', 'error', 'loginMessage');
        }
    }

    /**
     * Handle user logout
     */
    private logout(): void {
        localStorage.removeItem('authToken');
        this.currentUser = null;
        this.gameSession = null;
        
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        this.showScreen('loginScreen');
        this.clearInputs();
    }

    /**
     * Show main menu and update user info
     */
    private showMainMenu(): void {
        if (this.currentUser) {
            this.elements.playerName.textContent = this.currentUser.username;
            this.elements.coinCount.textContent = this.currentUser.coins.toString();
        }
        this.showScreen('mainMenu');
    }

    /**
     * Create a new game
     */
    private createGame(): void {
        if (!this.socket) {
            this.showMessage('Not connected to server', 'error');
            return;
        }

        const settings = {
            maxPlayers: 6,
            difficulty: 1,
            hasTimeLimit: false,
            baseSize: 20
        };

        this.socket.emit('createGame', settings);
    }

    /**
     * Join quick play queue
     */
    private quickPlay(): void {
        if (!this.socket) {
            this.showMessage('Not connected to server', 'error');
            return;
        }
        
        this.socket.emit('quickPlay');
    }

    /**
     * Join a game by room code
     */
    private joinGame(): void {
        const roomCode = this.elements.roomCodeInput?.value?.trim()?.toUpperCase();
        
        if (!roomCode) {
            this.showMessage('Please enter a room code', 'error');
            return;
        }

        if (!this.socket) {
            this.showMessage('Not connected to server', 'error');
            return;
        }

        this.socket.emit('joinGame', { roomCode });
    }

    /**
     * Leave current game
     */
    private leaveGame(): void {
        if (!this.socket) return;

        this.socket.emit('leaveGame');
        this.showScreen('mainMenu');
        this.gameSession = null;
    }

    /**
     * Handle keydown events
     */
    private handleKeyDown(e: KeyboardEvent): void {
        this.keys.add(e.code);

        // Handle ability hotkeys (1-5)
        if (e.code >= 'Digit1' && e.code <= 'Digit5') {
            const abilityIndex = parseInt(e.code.charAt(5)) - 1;
            this.useAbility(abilityIndex);
        }

        // Prevent default for game keys
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
            e.preventDefault();
        }
    }

    /**
     * Handle keyup events
     */
    private handleKeyUp(e: KeyboardEvent): void {
        this.keys.delete(e.code);
    }

    /**
     * Handle mouse movement
     */
    private handleMouseMove(e: MouseEvent): void {
        if (!this.elements.gameCanvas) return;

        const rect = this.elements.gameCanvas.getBoundingClientRect();
        this.mouse.x = e.clientX - rect.left;
        this.mouse.y = e.clientY - rect.top;

        // Send facing direction to server
        if (this.socket && this.gameSession) {
            const centerX = this.elements.gameCanvas.width / 2;
            const centerY = this.elements.gameCanvas.height / 2;
            const facing = Math.atan2(this.mouse.y - centerY, this.mouse.x - centerX);

            this.socket.emit('updateFacing', { facing });
        }
    }

    /**
     * Handle mouse clicks
     */
    private handleClick(e: MouseEvent): void {
        // Right click for context actions
        if (e.button === 2) {
            e.preventDefault();
        }
    }

    /**
     * Use an ability by index
     */
    private useAbility(index: number): void {
        if (!this.socket || !this.gameSession || !this.currentUser) return;

        const player = this.gameSession.players?.[this.currentUser.id];
        if (!player || !player.abilities || player.status !== 'alive') return;

        if (index >= 0 && index < player.abilities.length) {
            const ability = player.abilities[index];
            
            // Check cooldown
            const cooldownEnd = player.activeCooldowns?.[ability.id] || 0;
            if (Date.now() < cooldownEnd) return;

            this.socket.emit('useAbility', {
                abilityId: ability.id,
                target: { x: this.mouse.x, y: this.mouse.y }
            });
        }
    }

    /**
     * Send movement input to server
     */
    private sendMovement(): void {
        if (!this.socket) return;

        let dx = 0, dy = 0;

        if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) dy = -1;
        if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) dy = 1;
        if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) dx = -1;
        if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) dx = 1;

        if (dx !== 0 || dy !== 0) {
            this.socket.emit('move', { dx, dy });
        }
    }

    /**
     * Update player list in sidebar
     */
    private updatePlayerList(): void {
        if (!this.gameSession || !this.elements.players) return;

        const playersContainer = this.elements.players;
        playersContainer.innerHTML = '';

        Object.values(this.gameSession.players).forEach((player: any) => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'player-item';

            const statusColor = player.status === 'alive' ? '#4CAF50' :
                               player.status === 'dead' ? '#f44336' : 
                               player.status === 'finished' ? '#FFD700' : '#FFC107';

            playerDiv.innerHTML = `
                <span>${player.username || 'Player'}</span>
                <span style="color: ${statusColor}">♥${player.lives}</span>
            `;
            
            playersContainer.appendChild(playerDiv);
        });
    }

    /**
     * Update abilities display
     */
    private updateAbilities(): void {
        if (!this.gameSession || !this.currentUser || !this.elements.abilityCards) return;

        const player = this.gameSession.players?.[this.currentUser.id];
        if (!player || !player.abilities) return;

        const abilitiesContainer = this.elements.abilityCards;
        abilitiesContainer.innerHTML = '';

        player.abilities.forEach((ability: any, index: number) => {
            const abilityDiv = document.createElement('div');
            abilityDiv.className = 'ability-card';

            const cooldownEnd = player.activeCooldowns?.[ability.id] || 0;
            const isOnCooldown = cooldownEnd > Date.now();

            if (isOnCooldown) {
                abilityDiv.classList.add('on-cooldown');
            }

            const cooldownText = isOnCooldown 
                ? `<div class="cooldown-timer">${Math.ceil((cooldownEnd - Date.now()) / 1000)}s</div>`
                : '';

            abilityDiv.innerHTML = `
                <div class="ability-name">${index + 1}. ${ability.name}</div>
                <div class="ability-description">${ability.description}</div>
                ${cooldownText}
            `;

            abilityDiv.addEventListener('click', () => {
                if (!isOnCooldown) this.useAbility(index);
            });

            abilitiesContainer.appendChild(abilityDiv);
        });
    }

    /**
     * Update UI elements
     */
    private updateUI(): void {
        if (!this.gameSession || !this.currentUser) return;

        const player = this.gameSession.players?.[this.currentUser.id];
        if (player) {
            this.elements.livesCount.textContent = player.lives.toString();
            this.elements.eliminationCount.textContent = player.eliminations.toString();
            this.elements.checkpointCount.textContent = player.checkpointsReached.toString();
        }

        this.updatePlayerList();
        this.updateAbilities();
    }

    /**
     * Add message to chat
     */
    private addMessage(message: string, type: string = 'normal'): void {
        if (!this.elements.messages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;

        this.elements.messages.appendChild(messageDiv);
        this.elements.messages.scrollTop = this.elements.messages.scrollHeight;

        // Remove old messages (keep last 20)
        while (this.elements.messages.children.length > 20) {
            this.elements.messages.removeChild(this.elements.messages.firstChild);
        }
    }

    /**
     * Show temporary message
     */
    private showMessage(message: string, type: string, elementId: string = 'menuMessage'): void {
        const element = this.elements[elementId];
        if (!element) return;

        element.className = type === 'error' ? 'error-message' : 'success-message';
        element.textContent = message;

        setTimeout(() => {
            element.textContent = '';
            element.className = '';
        }, 5000);
    }

    /**
     * Switch between screens
     */
    private showScreen(screenId: string): void {
        const screens = ['loginScreen', 'mainMenu', 'gameScreen'];
        screens.forEach(id => {
            this.elements[id]?.classList.remove('active');
        });
        this.elements[screenId]?.classList.add('active');
    }

    /**
     * Clear all input fields
     */
    private clearInputs(): void {
        const inputs = ['loginUsername', 'loginEmail', 'loginPassword', 'roomCodeInput'];
        inputs.forEach(id => {
            if (this.elements[id]) {
                this.elements[id].value = '';
            }
        });
    }

    /**
     * Main game loop
     */
    public startGameLoop(): void {
        const gameLoop = (timestamp: number) => {
            // Calculate FPS
            if (timestamp - this.lastFrameTime >= 1000) {
                this.fps = this.frameCount;
                this.frameCount = 0;
                this.lastFrameTime = timestamp;
            }
            this.frameCount++;

            // Update at ~60 FPS
            if (timestamp - this.lastUpdateTime >= 16.67) {
                this.update();
                this.render();
                this.lastUpdateTime = timestamp;
            }

            requestAnimationFrame(gameLoop);
        };

        requestAnimationFrame(gameLoop);
    }

    /**
     * Update game state
     */
    private update(): void {
        // Send movement input
        this.sendMovement();
        
        // Update any client-side animations or effects
        // (This would be expanded for particle effects, smooth movement interpolation, etc.)
    }

    /**
     * Render the game
     */
    private render(): void {
        if (!this.gameSession || !this.currentUser) return;

        const currentPlayer = this.gameSession.players?.[this.currentUser.id];
        if (!currentPlayer) return;

        // Clear canvas
        this.renderer.clear();

        // Calculate camera offset
        const cameraOffset = this.renderer.calculateCameraOffset(currentPlayer);

        // Render maze
        this.renderer.renderMaze(this.gameSession.maze, cameraOffset);

        // Render players
        this.renderer.renderPlayers(this.gameSession.players, cameraOffset, this.currentUser.id);

        // Render effects
        this.renderer.renderEffects(this.gameSession.players, cameraOffset);

        // Render UI overlay
        this.renderer.renderUIOverlay(this.gameSession, this.currentUser.id);

        // Render debug info if enabled
        if (this.debugMode) {
            this.renderer.renderDebugInfo(this.gameSession, this.currentUser.id, this.fps);
        }
    }
}