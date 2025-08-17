export class MazeGenerator {
  static generate(size: number, difficulty: number): number[][] {
    // Initialize maze with walls
    const maze: number[][] = Array(size).fill(null).map(() => Array(size).fill(1));
    
    // Create basic maze using recursive backtracking
    const stack: Array<{x: number, y: number}> = [];
    const visited: boolean[][] = Array(size).fill(null).map(() => Array(size).fill(false));
    
    // Start from top-left corner
    let currentX = 1;
    let currentY = 1;
    maze[currentY][currentX] = 0; // Floor
    visited[currentY][currentX] = true;
    
    const directions = [
      { dx: 0, dy: -2 }, // Up
      { dx: 2, dy: 0 },  // Right
      { dx: 0, dy: 2 },  // Down
      { dx: -2, dy: 0 }  // Left
    ];
    
    while (true) {
      // Get unvisited neighbors
      const neighbors: Array<{x: number, y: number, wallX: number, wallY: number}> = [];
      
      for (const dir of directions) {
        const newX = currentX + dir.dx;
        const newY = currentY + dir.dy;
        const wallX = currentX + dir.dx / 2;
        const wallY = currentY + dir.dy / 2;
        
        if (newX >= 1 && newX < size - 1 && 
            newY >= 1 && newY < size - 1 && 
            !visited[newY][newX]) {
          neighbors.push({ x: newX, y: newY, wallX, wallY });
        }
      }
      
      if (neighbors.length > 0) {
        // Choose random neighbor
        const next = neighbors[Math.floor(Math.random() * neighbors.length)];
        
        // Remove wall between current and next cell
        maze[next.wallY][next.wallX] = 0;
        maze[next.y][next.x] = 0;
        visited[next.y][next.x] = true;
        
        // Push current position to stack
        stack.push({ x: currentX, y: currentY });
        
        // Move to next cell
        currentX = next.x;
        currentY = next.y;
      } else if (stack.length > 0) {
        // Backtrack
        const prev = stack.pop()!;
        currentX = prev.x;
        currentY = prev.y;
      } else {
        break;
      }
    }
    
    // Add checkpoints (every ~10-15 tiles along the path)
    this.addCheckpoints(maze, Math.max(2, Math.floor(size / 10)));
    
    // Add finish at bottom-right area
    this.addFinish(maze);
    
    // Add obstacles based on difficulty
    this.addObstacles(maze, difficulty);
    
    return maze;
  }
  
  private static addCheckpoints(maze: number[][], count: number) {
    const floorTiles: Array<{x: number, y: number}> = [];
    
    // Find all floor tiles
    for (let y = 1; y < maze.length - 1; y++) {
      for (let x = 1; x < maze[0].length - 1; x++) {
        if (maze[y][x] === 0) {
          floorTiles.push({ x, y });
        }
      }
    }
    
    // Randomly place checkpoints
    for (let i = 0; i < count && floorTiles.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * floorTiles.length);
      const checkpoint = floorTiles.splice(randomIndex, 1)[0];
      maze[checkpoint.y][checkpoint.x] = 2; // Checkpoint
    }
  }
  
  private static addFinish(maze: number[][]) {
    const size = maze.length;
    
    // Try to place finish in bottom-right quadrant
    for (let attempts = 0; attempts < 20; attempts++) {
      const x = Math.floor(size * 0.7 + Math.random() * size * 0.25);
      const y = Math.floor(size * 0.7 + Math.random() * size * 0.25);
      
      if (x < size - 1 && y < size - 1 && maze[y][x] === 0) {
        maze[y][x] = 3; // Finish
        return;
      }
    }
    
    // Fallback: place at any floor tile in bottom half
    for (let y = Math.floor(size / 2); y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        if (maze[y][x] === 0) {
          maze[y][x] = 3; // Finish
          return;
        }
      }
    }
  }
  
  private static addObstacles(maze: number[][], difficulty: number) {
    const floorTiles: Array<{x: number, y: number}> = [];
    
    // Find all floor tiles (excluding checkpoints and finish)
    for (let y = 1; y < maze.length - 1; y++) {
      for (let x = 1; x < maze[0].length - 1; x++) {
        if (maze[y][x] === 0) {
          floorTiles.push({ x, y });
        }
      }
    }
    
    // Add obstacles based on difficulty (higher difficulty = more obstacles)
    const obstacleCount = Math.floor(floorTiles.length * 0.05 * difficulty);
    
    for (let i = 0; i < obstacleCount && floorTiles.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * floorTiles.length);
      const obstacle = floorTiles.splice(randomIndex, 1)[0];
      maze[obstacle.y][obstacle.x] = 4; // Obstacle
    }
  }
}
