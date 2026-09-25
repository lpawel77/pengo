import { TILE, COLS, ROWS, HUD_HEIGHT, TILE_TYPE, DIRECTIONS, BLOCK_SLIDE_MS, ENEMY_MOVE_MS_BASE, SMASH_COOLDOWN_MS, SQUASH_DURATION_MS } from "./constants.js";
import { Grid } from "./grid.js";
import { Player, Enemy } from "./entities.js";
import * as sound from "./sound.js";

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
    this.squashing = []; // wrogowie w trakcie krotkiej animacji splaszczenia
    this.heldKeys = []; // klawisze ruchu aktualnie przytrzymane, w kolejnosci nacisniecia
    this.lastSmashAt = 0;
    this.paused = false;
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
      this.enemies.push(new Enemy(s.col, s.row, enemySpeed, i));
    }
    this.slidingBlocks = [];
    this.squashing = [];
  }

  onKeyDown(e) {
    sound.unlock(); // wymaga gestu uzytkownika - najpewniej zadzialac przy kazdym klawiszu
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

    if (e.key === "p" || e.key === "P") {
      e.preventDefault();
      this.paused = !this.paused;
      return;
    }
    if (this.paused) return; // podczas pauzy ignorujemy wszystkie inne klawisze

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
    sound.playSmash();
  }

  restart() {
    this.level = 1;
    this.score = 0;
    this.lives = 3;
    this.paused = false;
    this.startLevel();
    this.state = "playing";
  }

  loop(now) {
    this.update(now);
    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  update(now) {
    if (this.state !== "playing" || this.paused) return;

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
    this.updateSquashing(now);
    this.checkPlayerCollision();

    if (this.enemies.every((e) => !e.alive)) {
      this.state = "levelComplete";
      this.message = `Poziom ${this.level} ukonczony! Za chwile poziom ${this.level + 1}...`;
      sound.playLevelComplete();
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

    this.grid.set(targetCol, targetRow, TILE_TYPE.EMPTY);
    sound.playPush();

    const block = { col: targetCol, row: targetRow, dx, dy, carried: [], anim: null, finished: false };
    this.slidingBlocks.push(block);
    this.advanceSlidingBlock(block, now);
  }

  /**
   * Blok przesuwa sie o jeden kafelek na raz, sprawdzajac kolizje na biezaco
   * (a nie z gory dla calej trasy) - dzieki temu lapie tez wrogow, ktorzy
   * wejda na jego tor dopiero w trakcie jazdy, i nie "przenika" przez nikogo.
   */
  advanceSlidingBlock(block, now) {
    const nextCol = block.col + block.dx;
    const nextRow = block.row + block.dy;

    if (!this.grid.isWalkable(nextCol, nextRow)) {
      this.finishSlidingBlock(block, now);
      return;
    }

    // lapiemy WSZYSTKICH zywych wrogow na tym polu - moze ich tam stac kilku naraz
    // (np. gdy dwoje wrogow wystartowalo w tym samym miejscu)
    for (const enemy of this.enemiesAt(nextCol, nextRow)) {
      if (!block.carried.includes(enemy)) {
        enemy.beingCarried = true;
        block.carried.push(enemy);
      }
    }

    block.anim = { fromCol: block.col, fromRow: block.row, toCol: nextCol, toRow: nextRow, start: now, duration: BLOCK_SLIDE_MS };
    block.col = nextCol;
    block.row = nextRow;

    for (const carried of block.carried) {
      carried.beginMove(nextCol, nextRow, BLOCK_SLIDE_MS, now);
    }
  }

  /** Blok trafil na przeszkode - osiada w miejscu, a przenoszeni wrogowie splaszczaja sie tutaj. */
  finishSlidingBlock(block, now) {
    this.grid.set(block.col, block.row, TILE_TYPE.ICE);
    block.anim = null;
    block.finished = true;

    block.carried.forEach((enemy, i) => {
      const combo = i + 1;
      enemy.beingCarried = false;
      enemy.squashed = true;
      enemy.squashDx = block.dx;
      enemy.squashDy = block.dy;
      this.score += 100 * combo;
      sound.playCrush(combo);
      this.squashing.push({ enemy, finishAt: now + SQUASH_DURATION_MS });
    });
  }

  /** Krotka animacja splaszczenia dobiega konca - wrog znika ostatecznie. */
  updateSquashing(now) {
    this.squashing = this.squashing.filter((s) => {
      if (now < s.finishAt) return true;
      s.enemy.alive = false;
      return false;
    });
  }

  enemyAt(col, row) {
    return this.enemies.find((e) => e.alive && e.col === col && e.row === row);
  }

  /** Jak enemyAt, ale zwraca WSZYSTKICH zywych wrogow na danym polu (moze ich stac kilku naraz). */
  enemiesAt(col, row) {
    return this.enemies.filter((e) => e.alive && e.col === col && e.row === row);
  }

  updateSlidingBlocks(now) {
    this.slidingBlocks = this.slidingBlocks.filter((block) => {
      const t = (now - block.anim.start) / block.anim.duration;
      if (t < 1) return true;
      this.advanceSlidingBlock(block, now);
      return !block.finished;
    });
  }

  checkPlayerCollision() {
    if (this.player.isMoving) return;
    const hit = this.enemyAt(this.player.col, this.player.row);
    if (hit) {
      this.lives -= 1;
      sound.playHit();
      if (this.lives <= 0) {
        this.state = "gameOver";
        this.message = "Koniec gry! Wcisnij R, aby zaczac od nowa.";
        sound.playGameOver();
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
      if (!b.anim) continue;
      const t = Math.min(1, (performance.now() - b.anim.start) / b.anim.duration);
      const x = b.anim.fromCol * TILE + (b.anim.toCol - b.anim.fromCol) * TILE * t;
      const y = b.anim.fromRow * TILE + (b.anim.toRow - b.anim.fromRow) * TILE * t;
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
    } else if (this.paused) {
      this.drawPauseOverlay();
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

  drawPauseOverlay() {
    ctx.fillStyle = "rgba(11, 14, 35, 0.78)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffd23f";
    ctx.font = "28px Consolas, monospace";
    ctx.textAlign = "center";
    ctx.fillText("PAUZA", canvas.width / 2, canvas.height / 2 - 12);
    ctx.fillStyle = "#eaf6ff";
    ctx.font = "14px Consolas, monospace";
    ctx.fillText("Wcisnij P, aby wznowic", canvas.width / 2, canvas.height / 2 + 18);
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
