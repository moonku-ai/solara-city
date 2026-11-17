// Solara City — every tunable number lives here so the rest of the game
// reads one source of truth instead of scattering magic numbers around.

export const WORLD = {
  // Roads run on a square grid. ROAD_LINES are the centre lines of the roads.
  roadSpacing: 60,
  roadHalf: 6,
  roadLines: [-180, -120, -60, 0, 60, 120, 180],
  cityHalf: 215,
  // South of this z the ground turns to sand, then ocean.
  beachStartZ: 218,
  oceanStartZ: 268,
  oceanEndZ: 460,
  // Sun position for the golden-hour look (from the south-east, so the
  // faces the usual cameras see are lit).
  sunDir: { x: 0.45, y: 0.62, z: 0.5 },
};

export const PLAYER_TUNING = {
  walkSpeed: 6.5,
  runSpeed: 11,
  accel: 42,
  friction: 30,
  radius: 0.7,
  maxHealth: 100,
  turnSpeed: 9,
};

export const CAR_TUNING = {
  accel: 16,
  reverseAccel: 10,
  brake: 34,
  handbrake: 46,
  maxSpeed: 34,
  maxReverse: 12,
  steerMax: 0.55,
  steerSpeed: 2.4,
  drag: 0.55,
  radius: 2.4,
};

export const TRAFFIC_TUNING = {
  carCount: 14,
  pedCount: 26,
  carSpeedMin: 8,
  carSpeedMax: 13,
  pedSpeedMin: 1.1,
  pedSpeedMax: 2.1,
};

export const POLICE_TUNING = {
  chaseCarSpeed: 36,
  footCopSpeed: 7.5,
  arrestSeconds: 2.2,
  decayGraceSeconds: 25,
  decayStepSeconds: 12,
  spawnDistance: 70,
};

export const COMBAT_TUNING = {
  pistolDamage: 34,
  pistolMag: 12,
  pistolRange: 90,
  punchDamage: 25,
  punchRange: 2.4,
  reloadSeconds: 1.1,
};

export const MISSION_REWARDS = [150, 300, 500];

export const PALETTE = {
  sky: 0x8ec9e8,
  fog: 0xa8c8dd,
  sun: 0xffe0b3,
  asphalt: 0x2e3138,
  sidewalk: 0x9aa0a3,
  sand: 0xe8d29a,
  ocean: 0x1e7fa8,
  oceanDeep: 0x0d5c86,
  grass: 0x5da24a,
  buildingColors: [0xe8b48a, 0xd9a0a8, 0xa8c4d4, 0xf2d8a0, 0xc4b49a, 0xb8d4c0, 0xe0a090, 0x9fb4d8],
  carColors: [0xd23c2e, 0x2e6fd2, 0xe8c832, 0x3aa655, 0xe8e8e8, 0x222226, 0x8a4fd2, 0xe87a2e],
  policeBody: 0xf2f2f2,
  policeTrim: 0x1a2a44,
};

export const SAVE_KEY = 'solara-city-save-v1';
