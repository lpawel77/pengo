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

  /** Generuje plansze dla danego poziomu - ukladu jest kilka, zmieniaja sie cyklicznie. */
  generateLevel(levelNumber = 1) {
    this.tiles.fill(TILE_TYPE.ICE);

    for (let col = 0; col < COLS; col++) {
      this.set(col, 0, TILE_TYPE.WALL);
      this.set(col, ROWS - 1, TILE_TYPE.WALL);
    }
    for (let row = 0; row < ROWS; row++) {
      this.set(0, row, TILE_TYPE.WALL);
      this.set(COLS - 1, row, TILE_TYPE.WALL);
    }

    const layouts = [this._layoutCross, this._layoutGrid, this._layoutRing, this._layoutZigzag];
    const layout = layouts[(levelNumber - 1) % layouts.length];
    return layout.call(this);
  }

  /** Uklad 1: krzyzowy korytarz przez srodek, 4 diamenty po cwiartkach. */
  _layoutCross() {
    const midCol = Math.floor(COLS / 2);
    const midRow = Math.floor(ROWS / 2);

    for (let row = 1; row < ROWS - 1; row++) this.set(midCol, row, TILE_TYPE.EMPTY);
    for (let col = 1; col < COLS - 1; col++) this.set(col, midRow, TILE_TYPE.EMPTY);

    const offCol = 3;
    const offRow = 3;
    this.set(midCol - offCol, midRow - offRow, TILE_TYPE.DIAMOND);
    this.set(midCol + offCol, midRow - offRow, TILE_TYPE.DIAMOND);
    this.set(midCol - offCol, midRow + offRow, TILE_TYPE.DIAMOND);
    this.set(midCol + offCol, midRow + offRow, TILE_TYPE.DIAMOND);

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

  /** Uklad 2: siatka "w kratke" - dwa korytarze pionowe i dwa poziome dziela plansze na 9 pol lodu. */
  _layoutGrid() {
    const colA = 4;
    const colB = 10;
    const rowA = 4;
    const rowB = 8;

    for (let row = 1; row < ROWS - 1; row++) {
      this.set(colA, row, TILE_TYPE.EMPTY);
      this.set(colB, row, TILE_TYPE.EMPTY);
    }
    for (let col = 1; col < COLS - 1; col++) {
      this.set(col, rowA, TILE_TYPE.EMPTY);
      this.set(col, rowB, TILE_TYPE.EMPTY);
    }

    this.set(2, 2, TILE_TYPE.DIAMOND);
    this.set(12, 2, TILE_TYPE.DIAMOND);
    this.set(2, 10, TILE_TYPE.DIAMOND);
    this.set(12, 10, TILE_TYPE.DIAMOND);

    return {
      playerStart: { col: colA, row: rowA },
      enemySpawns: [
        { col: colB, row: rowA },
        { col: colA, row: rowB },
        { col: colB, row: rowB },
        { col: colA, row: 1 },
      ],
    };
  }

  /** Uklad 3: prostokatny pierscien-korytarz z lodowym "sejfem" w srodku. */
  _layoutRing() {
    const left = 2;
    const right = COLS - 3;
    const top = 2;
    const bottom = ROWS - 3;
    const midCol = Math.floor(COLS / 2);
    const midRow = Math.floor(ROWS / 2);

    for (let col = left; col <= right; col++) {
      this.set(col, top, TILE_TYPE.EMPTY);
      this.set(col, bottom, TILE_TYPE.EMPTY);
    }
    for (let row = top; row <= bottom; row++) {
      this.set(left, row, TILE_TYPE.EMPTY);
      this.set(right, row, TILE_TYPE.EMPTY);
    }

    this.set(left + 2, top + 2, TILE_TYPE.DIAMOND);
    this.set(right - 2, top + 2, TILE_TYPE.DIAMOND);
    this.set(left + 2, bottom - 2, TILE_TYPE.DIAMOND);
    this.set(right - 2, bottom - 2, TILE_TYPE.DIAMOND);

    return {
      playerStart: { col: midCol, row: top },
      enemySpawns: [
        { col: midCol, row: bottom },
        { col: left, row: midRow },
        { col: right, row: midRow },
        { col: left, row: top },
      ],
    };
  }

  /** Uklad 4: korytarz w ksztalcie "S" (zygzak) przez plansze. */
  _layoutZigzag() {
    const rowTop = 3;
    const rowBottom = ROWS - 4;
    const colLink = 9;

    for (let col = 1; col <= colLink; col++) this.set(col, rowTop, TILE_TYPE.EMPTY);
    for (let row = rowTop; row <= rowBottom; row++) this.set(colLink, row, TILE_TYPE.EMPTY);
    for (let col = 5; col < COLS - 1; col++) this.set(col, rowBottom, TILE_TYPE.EMPTY);

    this.set(11, 2, TILE_TYPE.DIAMOND);
    this.set(2, ROWS - 3, TILE_TYPE.DIAMOND);
    this.set(3, 6, TILE_TYPE.DIAMOND);
    this.set(12, 6, TILE_TYPE.DIAMOND);

    return {
      playerStart: { col: colLink, row: Math.floor((rowTop + rowBottom) / 2) },
      enemySpawns: [
        { col: 1, row: rowTop },
        { col: COLS - 2, row: rowBottom },
        { col: colLink, row: rowTop },
        { col: colLink, row: rowBottom },
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
