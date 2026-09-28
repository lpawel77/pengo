import { TILE, COLS, ROWS, TILE_TYPE, PLAYER_MOVE_MS, ENEMY_MOVE_MS_BASE, ENEMY_COLORS, ENEMY_ICE_COST, ENEMY_BREAK_MS } from "./constants.js";

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const STUNNED_COLOR = { fill: "#4aa8ff", outline: "#1b4f99" };
const WANDER_MIN_STEPS = 3;
const WANDER_MAX_STEPS = 6;

/**
 * Koszt dojscia do gracza z kazdego pola (Infinity = nieosiagalne). Zwykle pole kosztuje 1 krok,
 * a jesli iceCost jest podany - bloki lodu tez sa przechodnie, ale kosztuja iceCost krokow.
 * dist[pole] = koszt drogi od tego pola do gracza, bez kosztu samego pola startowego.
 */
function distanceMap(grid, col, row, iceCost = null) {
  const costOf = (c, r) => {
    if (grid.isWalkable(c, r)) return 1;
    if (iceCost !== null && grid.get(c, r) === TILE_TYPE.ICE) return iceCost;
    return Infinity;
  };
  const dist = new Array(COLS * ROWS).fill(Infinity);
  dist[row * COLS + col] = 0;
  // plansza ma ok. 250 pol - prosta Dijkstra z liniowym wyborem minimum w zupelnosci wystarcza
  const open = [[col, row]];
  while (open.length > 0) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) {
      if (dist[open[i][1] * COLS + open[i][0]] < dist[open[bi][1] * COLS + open[bi][0]]) bi = i;
    }
    const [c, r] = open.splice(bi, 1)[0];
    // z sasiada wchodzimy na (c, r) - placimy koszt wejscia na to pole
    const stepCost = dist[r * COLS + c] + (c === col && r === row ? 1 : costOf(c, r));
    for (const [dx, dy] of DIRS) {
      const nc = c + dx;
      const nr = r + dy;
      if (costOf(nc, nr) === Infinity || stepCost >= dist[nr * COLS + nc]) continue;
      dist[nr * COLS + nc] = stepCost;
      open.push([nc, nr]);
    }
  }
  return dist;
}

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
    this.color = ENEMY_COLORS[colorIndex % ENEMY_COLORS.length];
    this.moveInterval = moveInterval / this.color.speed;
    this.lastMoveAt = 0;
    this.alive = true;
    this.beingCarried = false; // jedzie razem z pchnietym blokiem lodu
    this.squashed = false; // spłaszczony po dojechaniu do sciany, tuz przed usunieciem
    this.squashDx = 0;
    this.squashDy = 0;
    this.dirX = 0; // ostatni kierunek ruchu - zeby nie zawracac co krok
    this.dirY = 0;
    // kazdy kolor troche inaczej "uparty" w poscigu
    this.chaseChance = this.color.chase;
    this.wanderSteps = 0; // ile krokow jeszcze wedruje, zanim wroci do poscigu
    this.breaking = null; // { col, row, start, until } - rozbijany wlasnie blok lodu
    this.stunnedUntil = 0; // ogluszony (po ustawieniu 3 diamentow w linii) do tego momentu
  }

  isStunned(now = performance.now()) {
    return now < this.stunnedUntil;
  }

  stun(now, duration) {
    this.stunnedUntil = now + duration;
    this.breaking = null;
  }

  /** onBreakIce(col, row) - wywolywane, gdy wrog rozbije blok lodu (np. dla dzwieku). */
  update(now, grid, player, onBreakIce = () => {}) {
    super.update(now);
    if (!this.alive || this.beingCarried || this.squashed) {
      this.breaking = null;
      return;
    }
    if (this.isStunned(now)) return;
    if (this.breaking) {
      this.updateBreaking(now, grid, onBreakIce);
      return;
    }
    if (this.isMoving) return;
    if (now - this.lastMoveAt < this.moveInterval) return;

    this.lastMoveAt = now;
    const dir = this.pickDirection(grid, player);
    if (!dir) return;
    this.dirX = dir[0];
    this.dirY = dir[1];

    const tc = this.col + dir[0];
    const tr = this.row + dir[1];
    if (grid.get(tc, tr) === TILE_TYPE.ICE) {
      // zaczyna rozbijac lod - przez ENEMY_BREAK_MS stoi w miejscu, a blok stopniowo peka
      this.breaking = { col: tc, row: tr, start: now, until: now + ENEMY_BREAK_MS };
      return;
    }

    this.beginMove(this.col + dir[0], this.row + dir[1], this.moveInterval * 0.8, now);
  }

  updateBreaking(now, grid, onBreakIce) {
    const { col, row, until } = this.breaking;
    // gracz zdazyl wypchnac lub rozbic ten blok - nie ma juz czego rozbijac
    if (grid.get(col, row) !== TILE_TYPE.ICE) {
      this.breaking = null;
      return;
    }
    if (now < until) return;

    grid.set(col, row, TILE_TYPE.EMPTY);
    this.breaking = null;
    onBreakIce(col, row);
    // od razu wchodzi na zwolnione pole
    this.dirX = col - this.col;
    this.dirY = row - this.row;
    this.lastMoveAt = now;
    this.beginMove(col, row, this.moveInterval * 0.8, now);
  }

  /**
   * Wybiera kolejny krok. Wrog idzie najkrotsza droga do gracza (BFS po wolnych polach),
   * wrogowie z breaksIce licza tez droge na skroty przez lod (troche drozsza niz korytarz),
   * a od czasu do czasu (wg chaseChance) wedruje po swojemu przez kilka krokow - dzieki temu
   * kilku wrogow nie idzie gesiego ta sama sciezka i da sie przed nimi uciec.
   */
  pickDirection(grid, player) {
    const isIce = ([dx, dy]) => grid.get(this.col + dx, this.row + dy) === TILE_TYPE.ICE;
    const options = DIRS.filter(([dx, dy]) => grid.isWalkable(this.col + dx, this.row + dy));
    const breakable = this.color.breaksIce ? DIRS.filter(isIce) : [];
    if (options.length === 0 && breakable.length === 0) return null;

    const dist = distanceMap(grid, player.col, player.row, this.color.breaksIce ? ENEMY_ICE_COST : null);
    // koszt ruchu w danym kierunku = wejscie na sasiednie pole + dalsza droga do gracza
    const costOf = (d) => (isIce(d) ? ENEMY_ICE_COST : 1) + dist[(this.row + d[1]) * COLS + (this.col + d[0])];
    // w poscigu wolno zawrocic - np. gdy gracz wyminal wroga w korytarzu
    const reachable = [...options, ...breakable].filter((d) => costOf(d) !== Infinity);

    if (this.wanderSteps === 0 && Math.random() > this.chaseChance) {
      this.wanderSteps = WANDER_MIN_STEPS + Math.floor(Math.random() * (WANDER_MAX_STEPS - WANDER_MIN_STEPS + 1));
    }

    if (reachable.length > 0 && this.wanderSteps === 0) {
      const best = Math.min(...reachable.map(costOf));
      const bestDirs = reachable.filter((d) => costOf(d) === best);
      return bestDirs[Math.floor(Math.random() * bestDirs.length)];
    }

    if (this.wanderSteps > 0) this.wanderSteps--;
    // podczas wedrowki lodu nie rozbija - jesli jest calkiem zamurowany, po prostu czeka
    if (options.length === 0) return null;

    // wedrowanie: bez zawracania (chyba ze slepy zaulek), raczej dalej prosto, na skrzyzowaniach losowo
    const isReverse = ([dx, dy]) => dx === -this.dirX && dy === -this.dirY;
    const forward = options.length > 1 ? options.filter((d) => !isReverse(d)) : options;
    const straight = forward.find(([dx, dy]) => dx === this.dirX && dy === this.dirY);
    if (straight && Math.random() < 0.7) return straight;
    return forward[Math.floor(Math.random() * forward.length)];
  }

  /** Pekniecia na rozbijanym bloku - im blizej konca rozbijania, tym ich wiecej. */
  drawCracks(ctx) {
    const { col, row, start, until } = this.breaking;
    const progress = Math.min(1, (performance.now() - start) / (until - start));
    const x = col * TILE;
    const y = row * TILE;
    const cracks = [
      [[16, 16], [9, 7], [5, 3]],
      [[16, 16], [25, 11], [29, 5]],
      [[16, 16], [12, 24], [6, 29]],
      [[16, 16], [23, 25], [28, 28]],
      [[9, 7], [3, 12]],
      [[23, 25], [27, 18]],
    ];
    const visible = Math.ceil(progress * cracks.length);

    ctx.save();
    ctx.strokeStyle = "#12233b";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const line of cracks.slice(0, visible)) {
      ctx.moveTo(x + (line[0][0] * TILE) / 32, y + (line[0][1] * TILE) / 32);
      for (const [px, py] of line.slice(1)) ctx.lineTo(x + (px * TILE) / 32, y + (py * TILE) / 32);
    }
    ctx.stroke();
    ctx.restore();
  }

  draw(ctx) {
    if (!this.alive) return;
    if (this.breaking) this.drawCracks(ctx);
    const { x, y } = this.pixelPos;
    const cx = x + TILE / 2;
    const cy = y + TILE / 2;

    ctx.save();
    ctx.translate(cx, cy);
    if (this.breaking) {
      // "dziobanie" - wrog drga w strone rozbijanego bloku
      const peck = Math.max(0, Math.sin(performance.now() / 45)) * 3;
      ctx.translate((this.breaking.col - this.col) * peck, (this.breaking.row - this.row) * peck);
    }

    if (this.squashed) {
      // splaszczony wzdluz kierunku uderzenia w sciane, rozplaszczony w poprzek
      const scaleX = this.squashDx !== 0 ? 0.25 : 1.35;
      const scaleY = this.squashDy !== 0 ? 0.25 : 1.35;
      ctx.scale(scaleX, scaleY);
    }

    // ogluszony wrog miga na niebiesko
    const stunned = this.isStunned();
    const blueBlink = stunned && Math.floor(performance.now() / 150) % 2 === 0;
    const color = blueBlink ? STUNNED_COLOR : this.color;

    ctx.fillStyle = color.fill;
    ctx.beginPath();
    ctx.ellipse(0, 0, TILE * 0.34, TILE * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color.outline;
    ctx.lineWidth = 2;
    ctx.stroke();

    if (!this.squashed) {
      ctx.strokeStyle = color.outline;
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
