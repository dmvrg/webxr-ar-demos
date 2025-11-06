export const GRID_SIZE = 3;

export class GameState3D {
  constructor() {
    this.grid = this._createEmptyGrid();
    this.isGameOver = false;
    this.winner = null;       // 'O' | 'X' | 'draw' | null
    this.winningLine = null;  // { start: {x,y,z}, end: {x,y,z} } | null
  }

  _createEmptyGrid() {
    return Array(GRID_SIZE).fill().map(() =>
      Array(GRID_SIZE).fill().map(() =>
        Array(GRID_SIZE).fill(null)
      )
    );
  }

  reset() {
    this.grid = this._createEmptyGrid();
    this.isGameOver = false;
    this.winner = null;
    this.winningLine = null;
  }

  /**
   * Try to play at (x,y,z) for player 'O' or 'X'
   * Returns { success, winner } where winner may be 'O'|'X'|'draw'|null
   */
  makeMove(x, y, z, player) {
    if (this.isGameOver) {
      return { success: false, winner: this.winner };
    }
    if (this.grid[x][y][z] !== null) {
      return { success: false, winner: this.winner };
    }

    this.grid[x][y][z] = player;
    const result = this._checkWinOrDraw();
    if (result) {
      this.isGameOver = true;
      this.winner = result;
    }
    return { success: true, winner: this.winner };
  }

  /**
   * Get the winning line (if any).
   * Returns { start: {x,y,z}, end: {x,y,z} } or null
   */
  getWinningLine() {
    return this.winningLine;
  }

  /**
   * Internal: check for win or draw.
   * Sets this.winningLine when someone wins.
   */
  _checkWinOrDraw() {
    // Reset winning line first
    this.winningLine = null;

    const directions = [
      // Horizontal lines (9)
      ...[0, 1, 2].flatMap((y) =>
        [0, 1, 2].map((z) => ({ dx: 1, dy: 0, dz: 0, x: 0, y, z }))
      ),
      // Vertical lines (9)
      ...[0, 1, 2].flatMap((x) =>
        [0, 1, 2].map((z) => ({ dx: 0, dy: 1, dz: 0, x, y: 0, z }))
      ),
      // Depth lines (9)
      ...[0, 1, 2].flatMap((x) =>
        [0, 1, 2].map((y) => ({ dx: 0, dy: 0, dz: 1, x, y, z: 0 }))
      ),
      // Diagonals in each face (6)
      ...[0, 1, 2].map((z) => ({ dx: 1, dy: 1, dz: 0, x: 0, y: 0, z })),
      ...[0, 1, 2].map((z) => ({ dx: 1, dy: -1, dz: 0, x: 0, y: 2, z })),
      ...[0, 1, 2].map((y) => ({ dx: 1, dy: 0, dz: 1, x: 0, y, z: 0 })),
      ...[0, 1, 2].map((y) => ({ dx: 1, dy: 0, dz: -1, x: 0, y, z: 2 })),
      ...[0, 1, 2].map((x) => ({ dx: 0, dy: 1, dz: 1, x, y: 0, z: 0 })),
      ...[0, 1, 2].map((x) => ({ dx: 0, dy: 1, dz: -1, x, y: 0, z: 2 })),
      // Main space diagonals through cube (4)
      { dx: 1, dy: 1, dz: 1, x: 0, y: 0, z: 0 },
      { dx: 1, dy: 1, dz: -1, x: 0, y: 0, z: 2 },
      { dx: 1, dy: -1, dz: 1, x: 0, y: 2, z: 0 },
      { dx: 1, dy: -1, dz: -1, x: 0, y: 2, z: 2 }
    ];

    for (const dir of directions) {
      const line = [];
      const start = { x: dir.x, y: dir.y, z: dir.z };
      let x = dir.x;
      let y = dir.y;
      let z = dir.z;

      for (let i = 0; i < 3; i++) {
        if (x >= 0 && x < 3 && y >= 0 && y < 3 && z >= 0 && z < 3) {
          line.push(this.grid[x][y][z]);
        }
        x += dir.dx;
        y += dir.dy;
        z += dir.dz;
      }

      if (line.length === 3 && line[0] !== null && line.every((v) => v === line[0])) {
        // Store winning line endpoints in grid coords
        this.winningLine = {
          start,
          end: {
            x: start.x + 2 * dir.dx,
            y: start.y + 2 * dir.dy,
            z: start.z + 2 * dir.dz
          }
        };
        return line[0]; // 'O' or 'X'
      }
    }

    // Draw?
    const isFull = this.grid.every((plane) =>
      plane.every((row) => row.every((cell) => cell !== null))
    );
    if (isFull) {
      this.winningLine = null;
      return 'draw';
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // Evaluation / AI helpers (unchanged except they use this.grid)
  // ---------------------------------------------------------------------------

  _countInLine(line, player) {
    const playerCount = line.filter((c) => c === player).length;
    const emptyCount = line.filter((c) => c === null).length;
    const opponentCount = line.filter((c) => c !== null && c !== player).length;
    return { playerCount, emptyCount, opponentCount };
  }

  _getLinesThrough(x, y, z) {
    const lines = [];
    const dirs = [
      // axes
      { dx: 1, dy: 0, dz: 0 },
      { dx: 0, dy: 1, dz: 0 },
      { dx: 0, dy: 0, dz: 1 },
      // face diagonals
      { dx: 1, dy: 1, dz: 0 },
      { dx: 1, dy: -1, dz: 0 },
      { dx: 1, dy: 0, dz: 1 },
      { dx: 1, dy: 0, dz: -1 },
      { dx: 0, dy: 1, dz: 1 },
      { dx: 0, dy: 1, dz: -1 },
      // space diagonals
      { dx: 1, dy: 1, dz: 1 },
      { dx: 1, dy: 1, dz: -1 },
      { dx: 1, dy: -1, dz: 1 },
      { dx: 1, dy: -1, dz: -1 }
    ];

    for (const { dx, dy, dz } of dirs) {
      for (let t = -2; t <= 0; t++) {
        const cells = [];
        let valid = true;

        for (let k = 0; k < 3; k++) {
          const px = x + (t + k) * dx;
          const py = y + (t + k) * dy;
          const pz = z + (t + k) * dz;

          if (px < 0 || px > 2 || py < 0 || py > 2 || pz < 0 || pz > 2) {
            valid = false;
            break;
          }
          cells.push({ x: px, y: py, z: pz });
        }

        if (valid && t <= 0 && t + 2 >= 0) {
          lines.push(cells.map((c) => this.grid[c.x][c.y][c.z]));
        }
      }
    }
    return lines;
  }

  evaluatePosition(x, y, z, player) {
    if (this.grid[x][y][z] !== null) return -1;

    let score = 0;
    const opponent = player === 'X' ? 'O' : 'X';
    const lines = this._getLinesThrough(x, y, z);

    for (const line of lines) {
      const counts = this._countInLine(line, player);

      // Immediate win
      if (counts.playerCount === 2 && counts.emptyCount === 1) {
        return 1000;
      }

      // Block opponent's win
      const oppCounts = this._countInLine(line, opponent);
      if (oppCounts.playerCount === 2 && oppCounts.emptyCount === 1) {
        return 900;
      }

      // Build own potential
      if (counts.playerCount === 1 && counts.emptyCount === 2) {
        score += 50;
      }

      // Block opponent's potential
      if (oppCounts.playerCount === 1 && oppCounts.emptyCount === 2) {
        score += 40;
      }
    }

    // Strategic bonus
    if (x === 1 && y === 1 && z === 1) {
      score += 100; // center
    } else if (
      (x === 1 && y === 1) ||
      (x === 1 && z === 1) ||
      (y === 1 && z === 1)
    ) {
      score += 50; // face centers
    } else if (
      (x === 0 || x === 2) &&
      (y === 0 || y === 2) &&
      (z === 0 || z === 2)
    ) {
      score += 40; // corners
    } else {
      score += 20; // edges
    }

    // Lines with 3 empties
    const possibleLines = this._getLinesThrough(x, y, z);
    const potentialWinningLines = possibleLines.filter((line) => {
      const counts = this._countInLine(line, player);
      return counts.playerCount === 0 && counts.emptyCount === 3;
    }).length;

    score += potentialWinningLines * 30;

    return score;
  }

  /**
   * Compute best move for `player` using evaluatePosition.
   * Returns { x, y, z } or null if no move.
   */
  findBestMove(player) {
    let bestScore = -1;
    let bestMove = null;

    for (let x = 0; x < GRID_SIZE; x++) {
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let z = 0; z < GRID_SIZE; z++) {
          const score = this.evaluatePosition(x, y, z, player);
          if (score > bestScore) {
            bestScore = score;
            bestMove = { x, y, z };
          }
        }
      }
    }
    return bestMove;
  }
}
