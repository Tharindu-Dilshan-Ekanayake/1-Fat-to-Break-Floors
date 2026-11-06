/**
 * Lobby layout - "Snack Town" - and the stages under it: every gameplay-relevant position
 * and trigger area.
 *
 * Shared by the client (which renders it) and the server (which validates positions
 * against it), so the two can never disagree about where a training pad or a floor is.
 *
 * Units are roughly metres - the avatar is 1.8 tall. +X is east, -Z is north: the way
 * to the STAGE gate.
 *
 * From above, as you see it from spawn (facing north, the STAGE gate ahead):
 *
 *   portal   aura stand        [ STAGE GATE ]  floors board          waterfall
 *                                    |
 *   FOOD SHOP hut                    |          TRAINING HALL: 3 x 3 pads on
 *   (left, counter east)             |          tiers rising to the east
 *                                    |          (0 1 2 front, 3 4 5, 6 7 8 back)
 *   potions                          |
 *   champion's statue      free   SPAWN
 *                eggs  eggs  eggs  eggs  DEMON EGG          sphinx
 *                       leaderboards (behind you)
 *
 * Rects are `{ minX, maxX, minZ, maxZ }` on the ground plane. Yaws are radians about +Y,
 * 0 facing +Z (south), PI facing north.
 *
 * THE STAGES. Through the gate, a short yard leads onto FLOOR 0, a slab flush with the
 * plaza. Each floor i sits over ROOM i, a closed room DROP metres tall whose own floor
 * runs north; the last FLOOR_LEN metres of it are FLOOR i+1, over ROOM i+1, and so on
 * down and down to the north. A room holds a WINS pad halfway along. The rooms are all
 * the same shape - only how many there are depends on the world.
 *
 *   side view (north to the left):
 *
 *        room 1 ...      |      room 0      |F0|  yard  | plaza
 *                        |__________________|==|________|_______
 *     ___________________|F1|   [pad]        |
 *    |   ...                  room 1 below F1 ...
 *
 * Where you are is your LEVEL: -1 in the lobby (yard and floor 0 included), i in room i.
 */

/** Where you appear, and which way you face: north, at the STAGE gate. */
export const SPAWN = { x: 0, z: 16, yaw: Math.PI }

/** The flat, walkable plaza. Mountains surround it on every side; the stage gate is in the north edge (on the terrain grid). */
export const PLAZA = { minX: -58, maxX: 58, minZ: -46, maxZ: 42 }

// --- The stages ---------------------------------------------------------------------

/** Half the width of the yard and of every stage room (x either side of 0). */
export const STAGE_HALF_W = 9
/** How long a room is, south to north, and the breakable floor at its north end. */
export const ROOM_LEN = 34
export const FLOOR_LEN = 10
/** How far one level is below the one above: a room's height, floor to floor. */
export const DROP = 14
/** The gate, in the middle of the plaza's north edge, and the yard behind it before floor 0. */
export const GATE_Z = PLAZA.minZ
export const YARD_LEN = 5
/** How far north each room starts from the one before: a room's length less the floor they share. */
const ROOM_STEP = ROOM_LEN - FLOOR_LEN
/** Player radius kept clear of walls. */
const WALL_MARGIN = 0.55

/** South edge of floor `i` (and of room `i`, under it). */
export const floorSouth = (i) => GATE_Z - YARD_LEN - i * ROOM_STEP
/** Floor `i`: the breakable slab over room `i`. */
export function floorRect(i) {
  const s = floorSouth(i)
  return { minX: -STAGE_HALF_W, maxX: STAGE_HALF_W, minZ: s - FLOOR_LEN, maxZ: s }
}
/** Room `i`, under floor `i` and on north. */
export function roomRect(i) {
  const s = floorSouth(i)
  return { minX: -STAGE_HALF_W, maxX: STAGE_HALF_W, minZ: s - ROOM_LEN, maxZ: s }
}
/** Height of floor `i`'s top: floor 0 is flush with the plaza. */
export const floorTopY = (i) => -i * DROP
/** Height of room `i`'s floor (and of floor `i + 1`, at its north end). */
export const roomFloorY = (i) => -(i + 1) * DROP
/** Where in room `i` you stand: inside its walls. */
export function roomInterior(i) {
  const r = roomRect(i)
  return { minX: r.minX + WALL_MARGIN, maxX: r.maxX - WALL_MARGIN, minZ: r.minZ + WALL_MARGIN, maxZ: r.maxZ - WALL_MARGIN }
}
/**
 * Room `i`'s WINS pad: east of the middle, halfway along, between where you land (under
 * floor i) and the next floor - the west half stays clear to walk on by.
 */
export function padRect(i) {
  const s = floorSouth(i)
  return { minX: 1.6, maxX: STAGE_HALF_W - 1.2, minZ: s - FLOOR_LEN - 12, maxZ: s - FLOOR_LEN - 3 }
}
/** The yard: from the gate to the north wall behind floor 0 (floor 0 included). */
export const YARD = {
  minX: -STAGE_HALF_W + WALL_MARGIN,
  maxX: STAGE_HALF_W - WALL_MARGIN,
  minZ: floorSouth(0) - FLOOR_LEN + WALL_MARGIN,
  maxZ: GATE_Z + 0.5,
}
/** Where you're put back in the lobby from the stages: in front of the gate, facing spawn. */
export const STAGE_RETURN = { x: 0, z: GATE_Z + 9, yaw: 0 }

/**
 * The FLOORS BROKEN board by the gate (east of it, facing the plaza): how many floors you
 * have broken, in all.
 */
export const FLOORS_BOARD = { x: 15, z: GATE_Z + 2.5, yaw: 0 }

// --- The training hall (right) ---------------------------------------------------------

/**
 * The training pads, a 3 x 3 grid east of the runway on tiers rising away from it, like
 * seats round a stage: the front column on the ground (pads 0-2, south to north), the
 * middle one a step up (3-5), the back one two (6-8). Each is a colourful deck with two
 * dining tables, chairs all round; sit on a chair to eat. Locked ones are walled off.
 */
export const ZONE_COUNT = 9
const PAD_COLS = [17.5, 30.5, 43.5]
const PAD_ROWS = [2, -12, -26]
/** Half a pad's deck, either way. */
const PAD_HALF = 5
/** The tiers' heights, front to back: each column of pads stands on one. */
export const TIERS = [0, 1, 2]
/** A deck's top, over the tier it stands on. */
export const ZONE_HEIGHT = 0.4
export const TRAIN_PADS = Array.from({ length: ZONE_COUNT }, (_, i) => ({
  x: PAD_COLS[Math.floor(i / 3)],
  z: PAD_ROWS[i % 3],
  tier: Math.floor(i / 3),
}))
/** The hall's tiers, as raised floors: a half step at the front edge of each, then the tier. */
const HALL = { minZ: -33, maxZ: 9, back: 54 }
export const HALL_TIERS = [
  { minX: 23.5, maxX: HALL.back, minZ: HALL.minZ, maxZ: HALL.maxZ, height: 0.5 },
  { minX: 24.5, maxX: HALL.back, minZ: HALL.minZ, maxZ: HALL.maxZ, height: TIERS[1] },
  { minX: 36.5, maxX: HALL.back, minZ: HALL.minZ, maxZ: HALL.maxZ, height: 1.5 },
  { minX: 37.5, maxX: HALL.back, minZ: HALL.minZ, maxZ: HALL.maxZ, height: TIERS[2] },
]
/** The hall's back wall, the TRAIN sign on it. */
export const HALL_WALL = { minX: HALL.back, maxX: HALL.back + 1.2, minZ: HALL.minZ, maxZ: HALL.maxZ }

/** Pad `index`'s middle (and tier). */
export const zoneCenter = (index) => TRAIN_PADS[index]
/** How high pad `index`'s deck is. */
export const padHeight = (index) => TIERS[TRAIN_PADS[index].tier] + ZONE_HEIGHT

/** Half the size of pad `index`'s deck along x and z. */
export const zoneHalf = () => ({ x: PAD_HALF, z: PAD_HALF })

/** The deck of pad `index`. */
export function zoneRect(index) {
  const { x, z } = TRAIN_PADS[index]
  return { minX: x - PAD_HALF, maxX: x + PAD_HALF, minZ: z - PAD_HALF, maxZ: z + PAD_HALF }
}

/** The deck and the dark rim round it: what a locked pad walls off. */
export function zoneDeckRect(index) {
  const r = zoneRect(index)
  return { minX: r.minX - 0.4, maxX: r.maxX + 0.4, minZ: r.minZ - 0.4, maxZ: r.maxZ + 0.4 }
}

/**
 * The two dining tables on every pad, in its own terms (x, z from its middle): long
 * along x, one each side of the middle.
 */
export const PAD_TABLES = [
  { x: 0, z: -2.35 },
  { x: 0, z: 2.35 },
]
/** A table's length (along x) and depth, and how far from its middle line its chairs are. */
export const TABLE_LEN = 4.8
export const TABLE_DEPTH = 1.25
const CHAIR_OUT = 0.98
/** Three chairs down each long side of a table. */
const CHAIR_XS = [-1.55, 0, 1.55]
/** How high the seat's top is over the deck. */
export const SEAT_HEIGHT = 0.3
/** Within this of a chair, you're on it. */
export const SEAT_REACH = 0.55

/** Every chair: `{ zone, x, z, yaw }` - where you sit, facing the table. */
export const SEATS = TRAIN_PADS.flatMap((pad, zone) =>
  PAD_TABLES.flatMap((table) =>
    CHAIR_XS.flatMap((cx) => [
      // North of the table, facing south (yaw 0); south of it, facing north.
      { zone, x: pad.x + table.x + cx, z: pad.z + table.z - CHAIR_OUT, yaw: 0 },
      { zone, x: pad.x + table.x + cx, z: pad.z + table.z + CHAIR_OUT, yaw: Math.PI },
    ]),
  ),
)

/** The pad whose chair is at (x, z) (with `slack` to spare), or -1. */
export function benchAt(x, z, slack = 0) {
  const reach = (SEAT_REACH + slack) ** 2
  let best = -1
  let bestD = reach
  for (const seat of SEATS) {
    const d = (seat.x - x) ** 2 + (seat.z - z) ** 2
    if (d <= bestD) {
      bestD = d
      best = seat.zone
    }
  }
  return best
}

/**
 * The chair of pad `zone` nearest (x, z): where you sit and which way you face, written
 * into `out` ({ x, z, yaw }).
 */
export function benchSeat(zone, x, z, out = { x: 0, z: 0, yaw: 0 }) {
  let bestD = Infinity
  for (const seat of SEATS) {
    if (seat.zone !== zone) continue
    const d = (seat.x - x) ** 2 + (seat.z - z) ** 2
    if (d < bestD) {
      bestD = d
      out.x = seat.x
      out.z = seat.z
      out.yaw = seat.yaw
    }
  }
  return out
}

// --- The Food Shop (left) ---------------------------------------------------------------

/**
 * The Food Shop: one hut on the west (left) side of the plaza, its counter facing the
 * plaza (east). Walk up to the counter and the shop opens - every food in one list, to
 * buy (in order) and pick what you eat. FOOD_HUT is the hut itself (solid, `half` its
 * size either way); FOOD_COUNTER the spot in front of it where the shop opens.
 */
export const FOOD_HUT = { x: -40, z: -12, half: 3.4, yaw: Math.PI / 2 }
export const FOOD_COUNTER = { x: -34, z: -12, radius: 3.2 }

/** Whether (x, z) is at the Food Shop's counter (give or take `slack`). */
export const atFoodCounter = (x, z, slack = 0) => Math.hypot(x - FOOD_COUNTER.x, z - FOOD_COUNTER.z) <= FOOD_COUNTER.radius + slack

// --- Behind spawn: the eggs and the leaderboards; and everything else --------------------

/**
 * The egg stands, in a row behind spawn (south), facing north over the plaza: the four
 * everyday eggs, and the big Demon egg at the east end.
 */
const EGG_ROW_Z = 30
export const EGG_STANDS = [
  { eggId: 'basic', x: -15, z: EGG_ROW_Z, yaw: Math.PI },
  { eggId: 'meadow', x: -5, z: EGG_ROW_Z, yaw: Math.PI },
  { eggId: 'sunset', x: 5, z: EGG_ROW_Z, yaw: Math.PI },
  { eggId: 'unicorn', x: 15, z: EGG_ROW_Z, yaw: Math.PI },
  { eggId: 'demon', x: 26, z: EGG_ROW_Z + 1, yaw: Math.PI, big: true },
]
export const EGG_TRIGGER_RADIUS = 4.2

/** Limited premium pet on display, in the south-east corner. */
export const SPHINX_STAND = { x: 42, z: 30, yaw: -Math.PI * 0.8 }

/** The leaderboards, in a row behind the eggs, facing north over the plaza. */
export const LEADERBOARDS = [
  { id: 'rebirths', x: -13, z: 39, yaw: Math.PI },
  { id: 'fat', x: 0, z: 39, yaw: Math.PI },
  { id: 'height', x: 13, z: 39, yaw: Math.PI },
]

/** The WORLD 2 portal, north-west of the plaza. Name and Wins are WORLD_PORTALS in balance.js. */
export const PORTALS = [{ id: 'future', x: -44, z: -38, radius: 3.6 }]

/**
 * The aura stand (north-west, its counter facing south) and the potion stand (west of
 * spawn, its counter facing east): walk up to them to open their panels.
 */
export const AURA_STAND = { x: -24, z: -35, radius: 3.6 }
export const POTION_STAND = { x: -22, z: 3, radius: 3.6 }

/** The champion eater's statue, on the left of the plaza a little behind spawn, facing it. */
export const STATUE = { x: -34, z: 18, radius: 2.6, yaw: Math.PI / 2 }

/** The straight walk from spawn up to the STAGE gate: nothing stands in it. */
export const WALKWAY = { minX: -4.6, maxX: 4.6, minZ: PLAZA.minZ, maxZ: SPAWN.z }

export const FREE_REWARD = { x: 8, z: 22, radius: 3 }
export const WATERFALL = { x: 46, z: PLAZA.minZ }

// --- Collision ----------------------------------------------------------------------

const box = (x, z, halfX, halfZ) => ({
  minX: x - halfX,
  maxX: x + halfX,
  minZ: z - halfZ,
  maxZ: z + halfZ,
})

/** Solid, never-changing obstacles in the lobby. Locked training pads add their own walls at runtime. */
export const STATIC_COLLIDERS = [
  // The Food Shop hut.
  box(FOOD_HUT.x, FOOD_HUT.z, FOOD_HUT.half, FOOD_HUT.half),
  // Egg pedestals.
  ...EGG_STANDS.map((s) => box(s.x, s.z, s.big ? 2.1 : 1.6, s.big ? 2.1 : 1.6)),
  box(SPHINX_STAND.x, SPHINX_STAND.z, 3, 3),
  ...LEADERBOARDS.map((b) => box(b.x, b.z, 4.6, 0.5)),
  box(FREE_REWARD.x, FREE_REWARD.z, 1.4, 1.4),
  // Each portal ring's base; the swirl itself is walk-through.
  ...PORTALS.flatMap((p) => [box(p.x - p.radius, p.z, 0.6, 0.8), box(p.x + p.radius, p.z, 0.6, 0.8)]),
  // The stands' counters.
  box(AURA_STAND.x, AURA_STAND.z - 1.2, 2.95, 0.8),
  box(AURA_STAND.x, AURA_STAND.z - 3.5, 4.4, 0.45),
  box(POTION_STAND.x - 1.2, POTION_STAND.z, 0.9, 2.6),
  // The statue's round plinth.
  box(STATUE.x, STATUE.z, STATUE.radius - 0.2, STATUE.radius - 0.2),
  // The training hall's back wall, the floors board, and the gate's pillars.
  HALL_WALL,
  box(FLOORS_BOARD.x, FLOORS_BOARD.z, 3.2, 0.4),
  box(-(STAGE_HALF_W + 1.6), GATE_Z + 0.6, 1.2, 1.2),
  box(STAGE_HALF_W + 1.6, GATE_Z + 0.6, 1.2, 1.2),
]

/** Raised floors the player stands on, as rects with a height: the hall's tiers and the pads' decks. */
export const PLATFORMS = [...HALL_TIERS, ...Array.from({ length: ZONE_COUNT }, (_, i) => ({ ...zoneDeckRect(i), height: padHeight(i) }))]

/** Walkable ground in the lobby; the controller clamps the player into it. */
export const WALKABLE = [PLAZA, YARD]

// --- Helpers ------------------------------------------------------------------------

export const inRect = (r, x, z, margin = 0) =>
  x >= r.minX - margin && x <= r.maxX + margin && z >= r.minZ - margin && z <= r.maxZ + margin

/** Index of the training pad whose deck is under (x, z), or -1. */
export function zoneAt(x, z, margin = 0) {
  for (let i = 0; i < ZONE_COUNT; i += 1) {
    if (inRect(zoneRect(i), x, z, margin)) return i
  }
  return -1
}

/** Whether (x, z) is through the gate, in the yard or on floor 0. */
export const inYard = (x, z, margin = 0) => z < GATE_Z + margin && inRect(YARD, x, z, margin)

/** The portal whose swirl (x, z) is in, give or take `margin`, or null. */
export function portalAt(x, z, margin = 0) {
  for (const p of PORTALS) {
    if (Math.hypot(x - p.x, z - p.z) < p.radius + margin) return p
  }
  return null
}

/** The egg stand within reach of (x, z), or null. */
export function eggStandNear(x, z) {
  for (const stand of EGG_STANDS) {
    const reach = EGG_TRIGGER_RADIUS + (stand.big ? 1 : 0)
    if (Math.hypot(stand.x - x, stand.z - z) <= reach) return stand
  }
  return null
}

/** Height of the lobby's floor at (x, z): raised platforms, else the ground at 0. */
export function groundHeightAt(x, z) {
  let h = 0
  for (const p of PLATFORMS) {
    if (p.height > h && inRect(p, x, z)) h = p.height
  }
  return h
}

/** Clamps (x, z) into the nearest of `rects`, written into `out`. */
function clampInto(rects, x, z, out) {
  let best = Infinity
  for (const r of rects) {
    const cx = Math.min(r.maxX, Math.max(r.minX, x))
    const cz = Math.min(r.maxZ, Math.max(r.minZ, z))
    const d = (cx - x) ** 2 + (cz - z) ** 2
    if (d < best) {
      best = d
      out.x = cx
      out.z = cz
      if (d === 0) break
    }
  }
  return out
}

/** Clamps (x, z) into the lobby's walkable union, returning the nearest walkable point. */
export const clampToWalkable = (x, z, out = { x: 0, z: 0 }) => clampInto(WALKABLE, x, z, out)

/** Clamps (x, z) into where you can be at `level`: the lobby (-1), or room `level`. */
export function clampToLevel(level, x, z, out = { x: 0, z: 0 }) {
  if (level < 0) return clampInto(WALKABLE, x, z, out)
  const r = roomInterior(level)
  out.x = Math.min(r.maxX, Math.max(r.minX, x))
  out.z = Math.min(r.maxZ, Math.max(r.minZ, z))
  return out
}

/** Height of the floor under (x, z) at `level`: the lobby's, or room `level`'s. */
export const groundAt = (level, x, z) => (level < 0 ? groundHeightAt(x, z) : roomFloorY(level))

/** The lowest and highest a player at `level` can legitimately be (feet), jumps and falls allowed for. */
export function heightRange(level) {
  if (level < 0) return { min: -1, max: 9 }
  return { min: roomFloorY(level) - 1, max: roomFloorY(level) + DROP + 6 }
}

/** Whether (x, z) is on floor `i` (give or take `margin`). */
export const onFloor = (i, x, z, margin = 0) => inRect(floorRect(i), x, z, margin)
/** Whether (x, z) is on room `i`'s WINS pad (give or take `margin`). */
export const onPad = (i, x, z, margin = 0) => inRect(padRect(i), x, z, margin)

/** Fastest a player can legitimately move, for the server's anti-teleport check. */
export const MAX_MOVE_SPEED = 14
