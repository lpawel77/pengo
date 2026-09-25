import { TILE, COLS, ROWS, HUD_HEIGHT, TILE_TYPE, DIRECTIONS, BLOCK_SLIDE_MS, ENEMY_MOVE_MS_BASE, SMASH_COOLDOWN_MS } from "./constants.js";
import { Grid } from "./grid.js";
import { Player, Enemy } from "./entities.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const menuEl = document.getElementById("menu");
canvas.width = COLS * TILE;
canvas.height = ROWS * TILE + HUD_HEIGHT;

const KEY_TO_DIR = {
  ArrowUp: "up", w: "up", W: "up",
  ArrowDown: "down", s: "down", S: "down",
  ArrowLeft: "left", a: "left", A: "left",
  ArrowRight: "right", d: "right", D: "right",
};

class Game {
  constructor() {
    this.grid = new Grid();
    this.state = "start"; // start | playing | levelComplete | gameOver
    this.level = 1;
    this.score = 0;
    this.lives = 3;
    this.slidingBlocks = [];
    this.heldKeys = []; // klawisze ruchu aktualnie przytrzymane, w kolejnosci nacisniecia
    this.lastSmashAt = 0;
    this.message = "Nacisnij dowolny klawisz, aby zaczac";

    this.startLevel();

    window.addEventListener("keydown", (e) => this.onKeyDown(e));
    window.addEventListener("keyup", (e) => this.onKeyUp(e));
    window.addEventListener("blur", () => this.heldKeys.length = 0);
    requestAnimationFrame((t) => this.loop(t));
  }

  startLevel() {
    const layout = this.grid.generateLevel(this.level);
    this.player = new Player(layout.playerStart.col, layout.playerStart.row);
    const enemySpeed = Math.max(220, ENEMY_MOVE_MS_BASE - (this.level - 1) * 40);
    const enemyCount = Math.min(6, 3 + this.level);
    this.enemies = [];
    for (let i = 0; i < enemyCount; i++) {
      const s = layout.enemySpawns[i % layout.enemySpawns.length];
      this.enemies.push(new Enemy(s.col, s.row, enemySpeed));
    }
    this.slidingBlocks = [];
  }

  onKeyDown(e) {
    if (this.state === "start") {
      this.state = "playing";
      menuEl.style.display = "none";
      return;
    }
    if (this.state === "gameOver") {
      if (e.key === "r" || e.key === "R") this.restart();
      return;
    }
    if (this.state === "levelComplete") return;

    if (e.key === " " || e.key === "e" || e.key === "E") {
      e.preventDefault();
      this.trySmash();
      return;
    }

    if (KEY_TO_DIR[e.key]) {
      e.preventDefault();
      if (!this.heldKeys.includes(e.key)) this.heldKeys.push(e.key);
    }
  }

  onKeyUp(e) {
    const idx = this.heldKeys.indexOf(e.key);
    if (idx !== -1) this.heldKeys.splice(idx, 1);
  }

  /** Zwraca kierunek najpozniej wcisnietego, wciaz przytrzymanego klawisza ruchu. */
  getActiveDirection() {
    for (let i = this.heldKeys.length - 1; i >= 0; i--) {
      const dir = KEY_TO_DIR[this.heldKeys[i]];
      if (dir) return dir;
    }
    return null;
  }

  /** Niszczy blok lodu tuz przed graczem, w miejscu (bez przesuwania go). */
  trySmash() {
    const now = performance.now();
    if (now - this.lastSmashAt < SMASH_COOLDOWN_MS) return;

    const { dx, dy } = DIRECTIONS[this.player.facing];
    const col = this.player.col + dx;
    const row = this.player.row + dy;
    if (this.grid.get(col, row) !== TILE_TYPE.ICE) return;

    this.grid.set(col, row, TILE_TYPE.EMPTY);
    this.lastSmashAt = now;
  }

  restart() {
    this.level = 1;
    this.score = 0;
    this.lives = 3;
    this.startLevel();
    this.state = "playing";
  }

  loop(now) {
    this.update(now);
    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  update(now) {
    if (this.state !== "playing") return;

    const activeDir = this.getActiveDirection();
    if (activeDir && !this.player.isMoving) {
      const { dx, dy } = DIRECTIONS[activeDir];
      this.player.tryMove(dx, dy, this.grid, (col, row) => this.tryPush(col, row, dx, dy, now), now);
    }
    this.player.update(now);

    for (const enemy of this.enemies) {
      enemy.update(now, this.grid, this.player);
    }

    this.updateSlidingBlocks(now);
    this.checkPlayerCollision();

    if (this.enemies.every((e) => !e.alive)) {
      this.state = "levelComplete";
      this.message = `Poziom ${this.level} ukonczony! Za chwile poziom ${this.level + 1}...`;
      setTimeout(() => {
        this.level += 1;
        this.startLevel();
        this.state = "playing";
      }, 1800);
    }
  }

  tryPush(targetCol, targetRow, dx, dy, now) {
    const tileType = this.grid.get(targetCol, targetRow);
    if (tileType !== TILE_TYPE.ICE) return; // sciana lub diament - nie da sie ruszyc

    const nextCol = targetCol + dx;
    const nextRow = targetRow + dy;
    if (!this.grid.isWalkable(nextCol, nextRow)) {
      return; // brak miejsca za blokiem - nie da sie pchnac
    }

    let curCol = targetCol;
    let curRow = targetRow;
    let combo = 0;

    for (;;) {
      const nCol = curCol + dx;
      const nRow = curRow + dy;
      const enemy = this.enemyAt(nCol, nRow);
      if (enemy) {
        enemy.alive = false;
        combo += 1;
        this.score += 100 * combo;
        curCol = nCol;
        curRow = nRow;
        continue;
      }
      if (this.grid.isWalkable(nCol, nRow)) {
        curCol = nCol;
        curRow = nRow;
        continue;
      }
      break; // przeszkoda - blok zatrzymuje sie na (curCol, curRow)
    }

    this.grid.set(targetCol, targetRow, TILE_TYPE.EMPTY);
    const distance = Math.max(Math.abs(curCol - targetCol), Math.abs(curRow - targetRow));
    this.slidingBlocks.push({
      fromCol: targetCol,
      fromRow: targetRow,
      toCol: curCol,
      toRow: curRow,
      start: now,
      duration: Math.max(BLOCK_SLIDE_MS, distance * BLOCK_SLIDE_MS),
    });
  }

  enemyAt(col, row) {
    return this.enemies.find((e) => e.alive && e.col === col && e.row === row);
  }

  updateSlidingBlocks(now) {
    this.slidingBlocks = this.slidingBlocks.filter((b) => {
      const t = (now - b.start) / b.duration;
      if (t >= 1) {
        this.grid.set(b.toCol, b.toRow, TILE_TYPE.ICE);
        return false;
      }
      return true;
    });
  }

  checkPlayerCollision() {
    if (this.player.isMoving) return;
    const hit = this.enemyAt(this.player.col, this.player.row);
    if (hit) {
      this.lives -= 1;
      if (this.lives <= 0) {
        this.state = "gameOver";
        this.message = "Koniec gry! Wcisnij R, aby zaczac od nowa.";
      } else {
        this.startLevel();
      }
    }
  }

  render() {
    ctx.save();
    ctx.translate(0, HUD_HEIGHT);
    this.grid.draw(ctx);

    for (const b of this.slidingBlocks) {
      const t = Math.min(1, (performance.now() - b.start) / b.duration);
      const x = b.fromCol * TILE + (b.toCol - b.fromCol) * TILE * t;
      const y = b.fromRow * TILE + (b.toRow - b.fromRow) * TILE * t;
      ctx.save();
      ctx.translate(x, y);
      this.grid.drawTile(ctx, 0, 0, TILE_TYPE.ICE);
      ctx.restore();
    }

    for (const enemy of this.enemies) enemy.draw(ctx);
    this.player.draw(ctx);
    ctx.restore();

    this.drawHud();

    if (this.state === "gameOver" || this.state === "levelComplete") {
      this.drawOverlay();
    }
  }

  drawHud() {
    ctx.fillStyle = "#0b0e23";
    ctx.fillRect(0, 0, canvas.width, HUD_HEIGHT);
    ctx.fillStyle = "#ffd23f";
    ctx.font = "16px Consolas, monospace";
    ctx.textBaseline = "middle";
    ctx.fillText(`Wynik: ${this.score}`, 8, HUD_HEIGHT / 2);
    ctx.fillText(`Poziom: ${this.level}`, canvas.width / 2 - 30, HUD_HEIGHT / 2);
    ctx.fillText(`Zycia: ${Math.max(0, this.lives)}`, canvas.width - 100, HUD_HEIGHT / 2);
  }

  drawOverlay() {
    ctx.fillStyle = "rgba(11, 14, 35, 0.78)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#eaf6ff";
    ctx.font = "20px Consolas, monospace";
    ctx.textAlign = "center";
    wrapText(ctx, this.message, canvas.width / 2, canvas.height / 2, canvas.width - 60, 26);
    ctx.textAlign = "left";
  }
}

function wrapText(context, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  const lines = [];
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (context.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  lines.push(line);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => context.fillText(l, x, startY + i * lineHeight));
}

window.game = new Game();
