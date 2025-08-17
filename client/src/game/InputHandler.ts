export class InputHandler {
    private canvas: HTMLCanvasElement;
    private keys: Set<string> = new Set();
    private mousePosition = { x: 0, y: 0 };
    private lastPosition = { x: 1, y: 1 };
    
    // Movement properties
    private moveSpeed = 2; // units per second
    private currentPosition = { x: 1, y: 1 };
    
    public onMove?: (position: { x: number; y: number }, angle: number) => void;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        // Keyboard events
        document.addEventListener('keydown', (e) => {
            this.keys.add(e.code);
            e.preventDefault();
        });

        document.addEventListener('keyup', (e) => {
            this.keys.delete(e.code);
            e.preventDefault();
        });

        // Mouse events
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mousePosition.x = e.clientX - rect.left;
            this.mousePosition.y = e.clientY - rect.top;
        });

        // Prevent context menu
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    public update(deltaTime: number): void {
        const dt = deltaTime / 1000; // Convert to seconds
        
        // Calculate movement
        let dx = 0;
        let dy = 0;

        if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) dy -= 1;
        if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) dy += 1;
        if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) dx -= 1;
        if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) dx += 1;

        // Normalize diagonal movement
        if (dx !== 0 && dy !== 0) {
            dx *= 0.707; // 1/√2
            dy *= 0.707;
        }

        // Apply movement
        if (dx !== 0 || dy !== 0) {
            this.currentPosition.x += dx * this.moveSpeed * dt;
            this.currentPosition.y += dy * this.moveSpeed * dt;

            // Calculate angle based on mouse position relative to player
            const centerX = this.canvas.width / 2;
            const centerY = this.canvas.height / 2;
            const angle = Math.atan2(
                this.mousePosition.y - centerY,
                this.mousePosition.x - centerX
            );

            // Send position update if moved
            if (this.onMove &&
                (Math.abs(this.currentPosition.x - this.lastPosition.x) > 0.01 ||
                 Math.abs(this.currentPosition.y - this.lastPosition.y) > 0.01)) {
                
                this.onMove({ ...this.currentPosition }, angle);
                this.lastPosition = { ...this.currentPosition };
            }
        }
    }

    public setPosition(x: number, y: number): void {
        this.currentPosition = { x, y };
        this.lastPosition = { x, y };
    }
}