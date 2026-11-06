import { WORLDS } from '@shared/balance'
import { FLOOR_LEN, floorSouth, FLOORS_BOARD, GATE_Z, STAGE_HALF_W as W } from '@shared/world'

import { STYLE } from '../materials'
import { STAGE_THEMES } from '../stage/themes'

/** Height of the yard's walls (the terrace of mountains either side is as high). */
const WALL_H = 6
/** The arch over the gate: its pillars' middles either side, and the top of its lintel. */
const PILLAR_X = W + 1.6
const ARCH_TOP = 11
const STRIPE_RED = '#ff3b5c'
const STRIPE_WHITE = '#fff6ec'
/** The lintel's strawberry frosting, and the sprinkles on it. */
const FROSTING = '#ff7ab8'
const SPRINKLES = ['#ffffff', '#ffe14a', '#7fe6c4', '#4fc3ff', '#c27bff', '#ff8a5c']
const BOARD_WOOD = '#9a5a26'

/** The first stage of world `world`: its floor's colours light the gate. */
const firstTheme = (world) => STAGE_THEMES[(WORLDS[world] ?? WORLDS[0]).stages[0].id] ?? STAGE_THEMES.grass

/**
 * The FLOORS BROKEN board by the gate: its face's middle, and its size. The count is a
 * world label floating on it (lobbyLabels.js), updated as you break floors.
 */
export const FLOORS_FACE = { x: FLOORS_BOARD.x, y: 3.4, z: FLOORS_BOARD.z + 0.32, width: 6, height: 3.6 }

/** The STAGES lettering on the arch's lintel, facing the plaza (signs.js paints it). */
export const GATE_SIGN = { x: 0, y: ARCH_TOP - 1.05, z: GATE_Z + 0.6 + 0.9, width: PILLAR_X * 2 - 2, height: 1.2, yaw: 0 }

/**
 * The STAGE gate in the plaza's north edge and the yard behind it: a red-carpet approach
 * from the plaza to floor 0 (the stages draw floor 0 itself), walls of the first stage's
 * studs either side and behind - flush with the rooms' walls below, so falling through
 * floor 0 you fall down one wall - a striped arch with glowing lamps over the gate, a
 * hazard stripe where floor 0 starts, and the FLOORS BROKEN board beside it. Boxes in the
 * world's block set: no extra draw calls.
 *
 * The yard's walls reach out to the mountains' grid (12 either side), so there's no gap
 * between them and the terraces.
 */
export function buildStageGate(blocks, { world = 0 } = {}) {
  const theme = firstTheme(world)
  const f0 = floorSouth(0)
  const back = f0 - FLOOR_LEN
  const wallStyle = theme.wallStyle ?? STYLE.BLOCK

  // The approach, from the gate to floor 0: a carpet down the middle of a stone path.
  blocks.add(0, -0.5, (GATE_Z + f0) / 2, W * 2, 1, GATE_Z - f0, '#d9e2ec', STYLE.STUDS)
  blocks.addOn(0, 0, (GATE_Z + f0) / 2 + 0.3, 6, 0.03, GATE_Z - f0 - 0.6, '#ee6a58', STYLE.SMOOTH)
  // Where floor 0 starts: a hazard stripe across, on the approach's edge.
  blocks.addOn(0, 0, f0 + 0.3, W * 2 - 0.4, 0.04, 0.6, '#ffcc1a', STYLE.STRIPES)

  // The walls: either side, out to the mountains' grid, and across the back.
  for (const side of [-1, 1]) {
    blocks.add(side * (W + 1.5), WALL_H / 2, (GATE_Z + back - 1) / 2, 3, WALL_H, GATE_Z - back + 1, theme.wall, wallStyle)
    // A glowing band along the inner top edge, in the stage's colour.
    blocks.add(side * (W - 0.1), WALL_H - 0.5, (GATE_Z + back) / 2, 0.2, 0.35, GATE_Z - back - 0.4, theme.gate, STYLE.GLOW)
  }
  blocks.add(0, WALL_H / 2, back - 0.5, W * 2, WALL_H, 1, theme.wall, wallStyle)
  blocks.add(0, WALL_H - 0.5, back + 0.1, W * 2 - 0.4, 0.35, 0.2, theme.gate, STYLE.GLOW)
  if (theme.cap) {
    for (const side of [-1, 1]) blocks.add(side * (W + 1.5), WALL_H + 0.2, (GATE_Z + back - 1) / 2, 3.1, 0.4, GATE_Z - back + 1.1, theme.cap, theme.capStyle ?? STYLE.SMOOTH)
    blocks.add(0, WALL_H + 0.2, back - 0.5, W * 2, 0.4, 1.1, theme.cap, theme.capStyle ?? STYLE.SMOOTH)
  }

  // The arch: candy-cane pillars (hooked over at the top), a frosted lintel with sprinkles
  // and icing dripping off it, lamps along it.
  for (const side of [-1, 1]) {
    const x = side * PILLAR_X
    blocks.addOn(x, 0, GATE_Z + 0.6, 2.4, 0.6, 2.4, '#ffffff', STYLE.SMOOTH)
    for (let k = 0; k < 6; k += 1) {
      blocks.addOn(x, 0.6 + k * 1.5, GATE_Z + 0.6, 1.8, 1.5, 1.8, k % 2 ? STRIPE_WHITE : STRIPE_RED, STYLE.STUDS)
    }
    // The cane's hook, curling outwards over the top.
    blocks.add(x + side * 0.9, ARCH_TOP + 1.0, GATE_Z + 0.6, 1.6, 1.4, 1.4, STRIPE_WHITE, STYLE.STUDS, 0, 0, side * 0.5)
    blocks.add(x + side * 2.1, ARCH_TOP + 0.9, GATE_Z + 0.6, 1.3, 1.3, 1.4, STRIPE_RED, STYLE.STUDS, 0, 0, side * 1.1)
    blocks.add(x + side * 2.5, ARCH_TOP - 0.3, GATE_Z + 0.6, 1.2, 1.3, 1.3, STRIPE_WHITE, STYLE.STUDS)
  }
  blocks.add(0, ARCH_TOP - 0.9, GATE_Z + 0.6, PILLAR_X * 2 + 1.8, 1.8, 1.8, '#e3a04f', STYLE.STUDS)
  blocks.add(0, ARCH_TOP + 0.05, GATE_Z + 0.6, PILLAR_X * 2 + 2, 0.5, 2.1, FROSTING, STYLE.SMOOTH)
  blocks.add(0, ARCH_TOP - 1.8, GATE_Z + 0.6, PILLAR_X * 2 + 2.2, 0.3, 2.2, '#ffd21f', STYLE.GLOW)
  for (let k = 0; k < 16; k += 1) {
    const x = -PILLAR_X + 0.4 + (k * (PILLAR_X * 2 - 0.8)) / 15
    const length = 0.15 + ((k * 5) % 4) * 0.1
    blocks.add(x, ARCH_TOP - length / 2, GATE_Z + 0.6 + 1.05, 0.7, length, 0.12, FROSTING, STYLE.SMOOTH)
    blocks.add(x + 0.35, ARCH_TOP + 0.33, GATE_Z + 0.6 + ((k * 3) % 5) * 0.3 - 0.6, 0.32, 0.1, 0.1, SPRINKLES[k % SPRINKLES.length], STYLE.SMOOTH, k * 0.7)
  }
  for (let k = -4; k <= 4; k += 1) {
    blocks.add(k * 2.3, ARCH_TOP + 0.35, GATE_Z + 0.6, 0.6, 0.6, 0.6, k % 2 ? '#ffffff' : theme.gate, STYLE.GLOW, 0.785)
  }

  // The FLOORS BROKEN board: a wooden frame on two posts, a dark face.
  const { x, z } = FLOORS_BOARD
  const { y, width, height } = FLOORS_FACE
  for (const side of [-1, 1]) {
    blocks.addOn(x + side * (width / 2 - 0.3), 0, z - 0.1, 0.4, y + height / 2 + 0.3, 0.4, BOARD_WOOD, STYLE.SMOOTH)
  }
  blocks.add(x, y, z, width + 0.4, height + 0.4, 0.5, BOARD_WOOD, STYLE.SMOOTH)
  blocks.add(x, y, z + 0.1, width, height, 0.4, '#1d2a5c', STYLE.SMOOTH)
  blocks.add(x, y + height / 2 + 0.3, z, width + 0.6, 0.25, 0.7, '#ffd21f', STYLE.GLOW)
}
