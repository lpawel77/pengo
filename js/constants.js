export const TILE = 32;
export const COLS = 15;
export const ROWS = 13;

export const HUD_HEIGHT = 32;

export const TILE_TYPE = {
  EMPTY: 0,
  WALL: 1,
  ICE: 2,
  DIAMOND: 3,
};

export const DIRECTIONS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export const PLAYER_MOVE_MS = 130;
export const BLOCK_SLIDE_MS = 90;
export const ENEMY_MOVE_MS_BASE = 650;
export const SMASH_COOLDOWN_MS = 200;

export const COLORS = {
  wall: "#3a4a9f",
  wallEdge: "#5f72d6",
  ice: "#bfe7ff",
  iceEdge: "#7fbfe0",
  iceShine: "#eaf9ff",
  diamond: "#ff5fd0",
  diamondEdge: "#a0308f",
  floor: "#0f1642",
};
