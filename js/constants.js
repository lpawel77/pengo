export const TILE = 32;
export const COLS = 15;
export const ROWS = 17;

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
export const SQUASH_DURATION_MS = 220;
// ustawienie 3 diamentow w jednej linii: bonus punktowy i ogluszenie wszystkich wrogow
export const DIAMOND_BONUS = 5000;
export const STUN_MS = 10000;
// ile "krokow" kosztuje wroga przejscie przez blok lodu przy szukaniu drogi - niewiele wiecej
// niz zwykle pole, wiec wrog rozbijajacy lod idzie do gracza prawie najkrotsza droga
export const ENEMY_ICE_COST = 1.5;
// ile trwa rozbijanie bloku lodu przez wroga (ms) - w tym czasie stoi w miejscu, a blok peka
export const ENEMY_BREAK_MS = 1200;

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

// paleta kolorow wrogow - kazdy kolor ma tez wlasny "charakter":
// chase = szansa (na kazdy krok), ze goni gracza zamiast zrobic krotki "spacer",
// speed = mnoznik predkosci (1 = bazowa, wiecej = szybciej),
// breaksIce = potrafi rozbijac bloki lodu, zeby dostac sie do gracza na skroty
export const ENEMY_COLORS = [
  { fill: "#ff5a4e", outline: "#8a1c14", chase: 0.95, speed: 1.15, breaksIce: true }, // czerwony - najgrozniejszy
  { fill: "#ff9d4e", outline: "#a35200", chase: 0.85, speed: 1 }, // pomaranczowy
  { fill: "#eda100", outline: "#8a5b00", chase: 0.8, speed: 1 }, // zolty
  { fill: "#b06aff", outline: "#5a2e99", chase: 0.9, speed: 1, breaksIce: true }, // fioletowy
  { fill: "#4ce07a", outline: "#1b7a3e", chase: 0.75, speed: 1 }, // zielony
];
