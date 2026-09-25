import { TILE, COLS, ROWS, TILE_TYPE, COLORS } from "./constants.js";

export class Grid {
  constructor() {
    this.tiles = new Array(COLS * ROWS).fill(TILE_TYPE.ICE);
  }

  index(col, row) {
    return row * COLS + col;
  }

  inBounds(col, row) {
    return col >= 0 && col < COLS && row >= 0 && row < ROWS;
  }

  get(col, row) {
    if (!this.inBounds(col, row)) return TILE_TYPE.WALL;
    return this.tiles[this.index(col, row)];
  }

  set(col, row, type) {
    if (!this.inBounds(col, row)) return;
    this.tiles[this.index(col, row)] = type;
  }

  isWalkable(col, row) {
    return this.get(col, row) === TILE_TYPE.EMPTY;
  }

  isObstacle(col, row) {
    const type = this.get(col, row);
    return type === TILE_TYPE.WALL || type === TILE_TYPE.ICE || type === TILE_TYPE.DIAMOND;
  }

  /** Generuje plansze: ramka scian, krzyzowy korytarz przez srodek, 4 diamenty (po jednym na cwiartke). */
  generateLevel() {
    this.tiles.fill(TILE_TYPE.ICE);

    for (let col = 0; col < COLS; col++) {
      this.set(col, 0, TILE_TYPE.WALL);
      this.set(col, ROWS - 1, TILE_TYPE.WALL);
    }
    for (let row = 0; row < ROWS; row++) {
      this.set(0, row, TILE_TYPE.WALL);
      this.set(COLS - 1, row, TILE_TYPE.WALL);
    }

    const midCol = Math.floor(COLS / 2);
    const midRow = Math.floor(ROWS / 2);

    for (let row = 1; row < ROWS - 1; row++) {
      this.set(midCol, row, TILE_TYPE.EMPTY);
    }
    for (let col = 1; col < COLS - 1; col++) {
      this.set(col, midRow, TILE_TYPE.EMPTY);
    }

    const diamondOffsetCol = 3;
    const diamondOffsetRow = 3;
    this.set(midCol - diamondOffsetCol, midRow - diamondOffsetRow, TILE_TYPE.DIAMOND);
    this.set(midCol + diamondOffsetCol, midRow - diamondOffsetRow, TILE_TYPE.DIAMOND);
    this.set(midCol - diamondOffsetCol, midRow + diamondOffsetRow, TILE_TYPE.DIAMOND);
    this.set(midCol + diamondOffsetCol, midRow + diamondOffsetRow, TILE_TYPE.DIAMOND);

    return {
      playerStart: { col: midCol, row: midRow },
      enemySpawns: [
        { col: midCol, row: 2 },
        { col: midCol, row: ROWS - 3 },
        { col: 2, row: midRow },
        { col: COLS - 3, row: midRow },
      ],
    };
  }

  draw(ctx) {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        this.drawTile(ctx, col, row, this.get(col, row));
      }
    }
  }

  drawTile(ctx, col, row, type) {
    const x = col * TILE;
    const y = row * TILE;

    ctx.fillStyle = COLORS.floor;
    ctx.fillRect(x, y, TILE, TILE);

    if (type === TILE_TYPE.WALL) {
      ctx.fillStyle = COLORS.wall;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = COLORS.wallEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
    } else if (type === TILE_TYPE.ICE) {
      ctx.fillStyle = COLORS.ice;
      ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
      ctx.strokeStyle = COLORS.iceEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
      ctx.fillStyle = COLORS.iceShine;
      ctx.fillRect(x + 5, y + 5, 6, 6);
    } else if (type === TILE_TYPE.DIAMOND) {
      const cx = x + TILE / 2;
      const cy = y + TILE / 2;
      ctx.fillStyle = COLORS.diamond;
      ctx.beginPath();
      ctx.moveTo(cx, y + 4);
      ctx.lineTo(x + TILE - 4, cy);
      ctx.lineTo(cx, y + TILE - 4);
      ctx.lineTo(x + 4, cy);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = COLORS.diamondEdge;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}
