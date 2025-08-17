export class MazeGenerator {
  private width: number;
  private height: number;
  private maze: number[][];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.maze = [];
  }

  public generate(): number[][] {
    // Initialize maze with walls
    this.maze = Array(this.height).fill(null).map(() => Array(this.width).fill(0));
    
    // Use recursive backtracking algorithm
    this.recursiveBacktrack(1, 1);
    
    return this.maze;
  }

  private recursiveBacktrack(x: number, y: number): void {
    this.maze[y][x] = 1; // Mark as path
    
    const directions = [
      [0, -2], [2, 0], [0, 2], [-2, 0] // North, East, South, West (step by 2)
    ];
    
    // Shuffle directions for randomness
    this.shuffle(directions);
    
    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      
      if (this.isValid(nx, ny) && this.maze[ny][nx] === 0) {
        // Remove wall between current cell and next cell
        this.maze[y + dy / 2][x + dx / 2] = 1;
        this.recursiveBacktrack(nx, ny);
      }
    }
  }

  private isValid(x: number, y: number): boolean {
    return x > 0 && x < this.width - 1 && y > 0 && y < this.height - 1;
  }

  private shuffle<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}