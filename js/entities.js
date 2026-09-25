import { TILE, PLAYER_MOVE_MS, ENEMY_MOVE_MS_BASE, ENEMY_COLORS } from "./constants.js";

function lerp(a, b, t) {
  return a + (b - a) * t;
}

class Mover {
  constructor(col, row) {
    this.col = col;
    this.row = row;
    this.anim = null; // { fromCol, fromRow, toCol, toRow, start, duration }
  }

  get isMoving() {
    return this.anim !== null;
  }

  beginMove(toCol, toRow, duration, now) {
    this.anim = {
      fromCol: this.col,
      fromRow: this.row,
      toCol,
      toRow,
      start: now,
      duration,
    };
    this.col = toCol;
    this.row = toRow;
  }

  update(now) {
    if (!this.anim) return;
    const t = Math.min(1, (now - this.anim.start) / this.anim.duration);
    if (t >= 1) {
      this.anim = null;
    }
  }

  get pixelPos() {
    if (!this.anim) {
      return { x: this.col * TILE, y: this.row * TILE };
    }
    const t = Math.min(1, (performance.now() - this.anim.start) / this.anim.duration);
    const eased = t;
    return {
      x: lerp(this.anim.fromCol * TILE, this.anim.toCol * TILE, eased),
      y: lerp(this.anim.fromRow * TILE, this.anim.toRow * TILE, eased),
    };
  }
}

export class Player extends Mover {
  constructor(col, row) {
    super(col, row);
    this.facing = "down";
    this.alive = true;
  }

  tryMove(dx, dy, grid, onBlocked, now) {
    if (this.isMoving) return false;

    if (dx < 0) this.facing = "left";
    else if (dx > 0) this.facing = "right";
    else if (dy < 0) this.facing = "up";
    else if (dy > 0) this.facing = "down";

    const targetCol = this.col + dx;
    const targetRow = this.row + dy;

    if (grid.isWalkable(targetCol, targetRow)) {
      this.beginMove(targetCol, targetRow, PLAYER_MOVE_MS, now);
      return true;
    }

    onBlocked(targetCol, targetRow, dx, dy);
    return false;
  }

  draw(ctx) {
    const { x, y } = this.pixelPos;
    const cx = x + TILE / 2;
    const cy = y + TILE / 2;

    ctx.save();
    ctx.translate(cx, cy);

    // cialo
    ctx.fillStyle = "#eaf6ff";
    ctx.beginPath();
    ctx.ellipse(0, 2, TILE * 0.32, TILE * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3a6ea5";
    ctx.lineWidth = 2;
    ctx.stroke();

    // brzuszek
    ctx.fillStyle = "#3a6ea5";
    ctx.beginPath();
    ctx.ellipse(0, 6, TILE * 0.16, TILE * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // oczy + dziob wg kierunku
    const dir = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[this.facing];
    ctx.fillStyle = "#ff9d2f";
    ctx.beginPath();
    ctx.moveTo(dir[0] * 6, dir[1] * 6);
    ctx.lineTo(dir[0] * 6 + dir[1] * 5, dir[1] * 6 + dir[0] * 5 - 2);
    ctx.lineTo(dir[0] * 6 - dir[1] * 5, dir[1] * 6 - dir[0] * 5 - 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#12233b";
    ctx.beginPath();
    ctx.arc(-5 + dir[0] * 3, -8 + dir[1] * 3, 2.4, 0, Math.PI * 2);
    ctx.arc(5 + dir[0] * 3, -8 + dir[1] * 3, 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

export class Enemy extends Mover {
  constructor(col, row, moveInterval = ENEMY_MOVE_MS_BASE, colorIndex = 0) {
    super(col, row);
    this.moveInterval = moveInterval;
    this.lastMoveAt = 0;
    this.alive = true;
    this.beingCarried = false; // jedzie razem z pchnietym blokiem lodu
    this.squashed = false; // spłaszczony po dojechaniu do sciany, tuz przed usunieciem
    this.squashDx = 0;
    this.squashDy = 0;
    this.color = ENEMY_COLORS[colorIndex % ENEMY_COLORS.length];
  }

  update(now, grid, player) {
    super.update(now);
    if (!this.alive || this.beingCarried || this.squashed) return;
    if (this.isMoving) return;
    if (now - this.lastMoveAt < this.moveInterval) return;

    this.lastMoveAt = now;
    const candidates = this.pickDirections(player);
    for (const [dx, dy] of candidates) {
      const nc = this.col + dx;
      const nr = this.row + dy;
      if (grid.isWalkable(nc, nr)) {
        this.beginMove(nc, nr, this.moveInterval * 0.8, now);
        return;
      }
    }
  }

  pickDirections(player) {
    const all = [[1, 0], [-1, 0], [0, 1], [0, -1]].sort(() => Math.random() - 0.5);

    // czasem czyste "blaganie" na gracza (Sno-Bee wciaz gonii), a czasem wedrowanie
    // losowe - inaczej wrogowie zawsze biegna prosto w gracza i gra jest niesprawiedliwa
    if (Math.random() > 0.5) return all;

    const dx = player.col - this.col;
    const dy = player.row - this.row;
    const dirs = [];
    const horizontal = dx > 0 ? [1, 0] : dx < 0 ? [-1, 0] : null;
    const vertical = dy > 0 ? [0, 1] : dy < 0 ? [0, -1] : null;

    if (Math.abs(dx) >= Math.abs(dy)) {
      if (horizontal) dirs.push(horizontal);
      if (vertical) dirs.push(vertical);
    } else {
      if (vertical) dirs.push(vertical);
      if (horizontal) dirs.push(horizontal);
    }

    for (const d of all) {
      if (!dirs.some((e) => e[0] === d[0] && e[1] === d[1])) dirs.push(d);
    }
    return dirs;
  }

  draw(ctx) {
    if (!this.alive) return;
    const { x, y } = this.pixelPos;
    const cx = x + TILE / 2;
    const cy = y + TILE / 2;

    ctx.save();
    ctx.translate(cx, cy);

    if (this.squashed) {
      // splaszczony wzdluz kierunku uderzenia w sciane, rozplaszczony w poprzek
      const scaleX = this.squashDx !== 0 ? 0.25 : 1.35;
      const scaleY = this.squashDy !== 0 ? 0.25 : 1.35;
      ctx.scale(scaleX, scaleY);
    }

    ctx.fillStyle = this.color.fill;
    ctx.beginPath();
    ctx.ellipse(0, 0, TILE * 0.34, TILE * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = this.color.outline;
    ctx.lineWidth = 2;
    ctx.stroke();

    if (!this.squashed) {
      ctx.strokeStyle = this.color.outline;
      ctx.beginPath();
      ctx.moveTo(-6, -10);
      ctx.lineTo(-10, -16);
      ctx.moveTo(6, -10);
      ctx.lineTo(10, -16);
      ctx.stroke();
    }

    ctx.fillStyle = "#fff2ea";
    ctx.beginPath();
    ctx.arc(-6, -2, 3.2, 0, Math.PI * 2);
    ctx.arc(6, -2, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#12233b";
    ctx.beginPath();
    ctx.arc(-6, -2, 1.6, 0, Math.PI * 2);
    ctx.arc(6, -2, 1.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
