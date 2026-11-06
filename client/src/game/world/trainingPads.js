import {
  HALL_TIERS,
  HALL_WALL,
  PAD_TABLES,
  padHeight,
  SEAT_HEIGHT,
  SEATS,
  TABLE_DEPTH,
  TABLE_LEN,
  TIERS,
  TRAIN_PADS,
  ZONE_COUNT,
  ZONE_HEIGHT,
  zoneHalf,
} from '@shared/world'

import { toColor } from '../blocks'
import { addFoodToProps, foodGeometry, foodSize } from '../food'
import { STYLE } from '../materials'

/**
 * The training hall, east of the runway: nine training pads in a 3 x 3 grid on tiers
 * that rise away from the runway like seats round a stage - the front column on the
 * ground, the middle a step up, the back two - with a tall back wall behind them for the
 * TRAIN sign. Each pad is a square deck in its own bright colour on a dark rim, two
 * dining tables on it (a cloth runner in the pad's colour, plates of food and drinks)
 * with three chairs down each long side, a lamp at each back corner, and a giant food
 * bobbing on a pillar behind it.
 *
 * Sit on a chair to eat (world.js SEATS); only locked pads are solid (the ticker walls
 * them off). All boxes, in the world's one block set; the giant foods in the one prop
 * mesh. `detail` (off on LOW) adds the small stuff: cups' rims, cutlery, bulbs.
 */

/** Per-pad look, in pad order (TRAIN_ZONES in shared/balance.js). `text` colours its label. */
export const PAD_THEMES = [
  { deck: '#7ed957', deckStyle: STYLE.STUDS, chair: '#3fb34a', cloth: '#ffffff', text: '#9dff6a', food: 'fries' },
  { deck: '#ffe14a', deckStyle: STYLE.STUDS, chair: '#ff9a1f', cloth: '#ff5a4a', text: '#ffe45c', food: 'burger' },
  { deck: '#ff7ad9', deckStyle: STYLE.STUDS, chair: '#d13fb4', cloth: '#ffffff', text: '#ff9ce8', food: 'pizza' },
  { deck: '#ffb347', deckStyle: STYLE.TILES, chair: '#b0743c', cloth: '#fff1d6', text: '#ffc46a', food: 'cake' },
  { deck: '#ff5a4a', deckStyle: STYLE.STUDS, chair: '#ffd23a', cloth: '#ffd23a', text: '#ff8a7a', food: 'taco' },
  { deck: '#4fa8ff', deckStyle: STYLE.STUDS, chair: '#ffffff', cloth: '#ff6fa8', text: '#7fc8ff', food: 'sushi' },
  { deck: '#b47bff', deckStyle: STYLE.PLATE, chair: '#ffd21f', cloth: '#ffd21f', text: '#d0a8ff', food: 'turkey' },
  { deck: '#bff4ff', deckStyle: STYLE.TILES, chair: '#5cc8ff', cloth: '#ff9ccf', text: '#c9f3ff', food: 'icecream' },
  { deck: '#2a1f6a', deckStyle: STYLE.GALAXY, chair: '#c35cff', cloth: '#c35cff', text: '#d39bff', food: 'galaxyDonut' },
]

const RIM = '#2b2f38'
const WOOD = '#b0743c'
const WOOD_DARK = '#7a4a22'
const CHINA = '#f4f7fb'
/** How high a table's top is over its deck: elbow height, sat on a chair. */
const TABLE_TOP = 0.62
/** How big each pad's giant food is, against the one in your hand. */
const GIANT_FOOD = 5.5

const darker = new Map()
/** `color`, a shade darker (cached: builders ask thousands of times). */
function shade(color, k = 0.78) {
  const key = `${color}:${k}`
  if (!darker.has(key)) darker.set(key, toColor(color).clone().multiplyScalar(k))
  return darker.get(key)
}

/** Little blocky dishes, each sat on a plate whose top is at y. */
const DISHES = [
  (b, x, y, z) => {
    b.addOn(x, y, z, 0.24, 0.06, 0.24, '#e3a04f', STYLE.SMOOTH)
    b.addOn(x, y + 0.06, z, 0.26, 0.05, 0.26, '#5a2e1a', STYLE.SMOOTH)
    b.addOn(x, y + 0.11, z, 0.24, 0.08, 0.24, '#e8a650', STYLE.SMOOTH)
  },
  (b, x, y, z) => {
    b.addOn(x, y, z, 0.24, 0.15, 0.18, '#ff9ccf', STYLE.SMOOTH, 0.4)
    b.addOn(x, y + 0.15, z, 0.06, 0.06, 0.06, '#e01f3d', STYLE.SMOOTH)
  },
  (b, x, y, z) => {
    b.addOn(x, y, z, 0.16, 0.15, 0.11, '#e8322f', STYLE.SMOOTH)
    b.addOn(x, y + 0.15, z, 0.12, 0.08, 0.06, '#ffd447', STYLE.SMOOTH)
  },
  (b, x, y, z) => {
    b.addOn(x - 0.03, y, z, 0.2, 0.12, 0.16, '#a4471e', STYLE.SMOOTH, 0.5)
    b.addOn(x + 0.1, y + 0.03, z + 0.06, 0.16, 0.05, 0.05, '#f7f0e1', STYLE.SMOOTH, 0.5)
  },
  (b, x, y, z) => {
    for (const turn of [0, Math.PI / 4]) b.addOn(x, y, z, 0.24, 0.06, 0.24, '#e0a35a', STYLE.SMOOTH, turn)
    b.addOn(x, y + 0.06, z, 0.21, 0.02, 0.21, '#ff7eb6', STYLE.SMOOTH, Math.PI / 8)
  },
]
const CUPS = ['#ff4a6a', '#4fc3ff', '#ffd447', '#7dff6a', '#ff8a5c']

/** The hall's tiers: each band of floor, from the ground (sunk a little) up to its height, in `palette`'s wafer with caramel steps. */
function tiers(blocks, palette) {
  // Side by side, never stacked: no two faces share a plane.
  const bands = HALL_TIERS.map((t, i) => ({ ...t, maxX: HALL_TIERS[i + 1]?.minX ?? t.maxX }))
  for (const t of bands) {
    const cx = (t.minX + t.maxX) / 2
    const cz = (t.minZ + t.maxZ) / 2
    const step = t.maxX - t.minX < 2
    blocks.addOn(cx, -0.5, cz, t.maxX - t.minX, t.height + 0.5, t.maxZ - t.minZ, step ? palette.hallStep : palette.hallTier, step ? STYLE.STUDS : STYLE.PLATE)
    // A glowing line along each front edge.
    blocks.addOn(t.minX + 0.08, t.height, cz, 0.16, 0.04, t.maxZ - t.minZ - 0.4, palette.hallTrim, STYLE.GLOW)
  }
}

/** The TRAIN lettering on the back wall's board, facing the runway (signs.js paints it). */
export const TRAIN_SIGN = {
  x: HALL_WALL.minX - 0.1,
  y: TIERS[2] + 5.6,
  z: (HALL_WALL.minZ + HALL_WALL.maxZ) / 2,
  width: 17,
  height: 4.2,
  yaw: -Math.PI / 2,
}

/** The back wall - a slab of chocolate, strawberry icing along its top - with a glowing frame for the TRAIN sign on its face. */
function backWall(blocks, palette) {
  const w = HALL_WALL
  const cz = (w.minZ + w.maxZ) / 2
  const depth = w.maxZ - w.minZ
  const top = TIERS[2] + 8.5
  blocks.addOn((w.minX + w.maxX) / 2, -0.5, cz, w.maxX - w.minX, top + 0.5, depth, palette.hallWall, STYLE.STUDS)
  blocks.addOn((w.minX + w.maxX) / 2, top, cz, w.maxX - w.minX + 0.4, 0.5, depth + 0.4, palette.hallTrim, STYLE.SMOOTH)
  // Icing dripping down its face, between the sign and the ends.
  for (let k = 0; k < 14; k += 1) {
    const z = w.minZ + 1 + (k * (depth - 2)) / 13
    if (Math.abs(z - cz) < 9.6) continue
    const length = 0.6 + ((k * 7) % 5) * 0.35
    blocks.add(w.minX - 0.06, top - length / 2 + 0.1, z, 0.14, length, 0.7, palette.hallTrim, STYLE.SMOOTH)
  }
  // The sign board on its face, framed in light.
  const face = w.minX - 0.05
  blocks.add(face, TIERS[2] + 5.6, cz, 0.1, 4.6, 18, palette.hallBoard, STYLE.SMOOTH)
  for (const side of [-1, 1]) blocks.add(face - 0.04, TIERS[2] + 5.6, cz + side * 9.1, 0.12, 4.8, 0.3, '#ffd21f', STYLE.GLOW)
  for (const dy of [-2.35, 2.35]) blocks.add(face - 0.04, TIERS[2] + 5.6 + dy, cz, 0.12, 0.3, 18.5, '#ffd21f', STYLE.GLOW)
}

/** A dining table at (x, z), long along x, `top` its top: a cloth runner, plates and drinks along both sides. */
function table(blocks, x, z, base, t, index, detail) {
  const top = base + TABLE_TOP
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) blocks.addOn(x + sx * (TABLE_LEN / 2 - 0.3), base, z + sz * (TABLE_DEPTH / 2 - 0.2), 0.12, TABLE_TOP - 0.08, 0.12, WOOD_DARK, STYLE.SMOOTH)
  blocks.addOn(x, top - 0.08, z, TABLE_LEN, 0.08, TABLE_DEPTH, WOOD, STYLE.SMOOTH)
  blocks.addOn(x, top, z, TABLE_LEN - 0.3, 0.015, 0.4, t.cloth, STYLE.SMOOTH)
  for (const side of [-1, 1]) {
    for (let k = -1; k <= 1; k += 1) {
      const px = x + k * 1.55
      const pz = z + side * 0.36
      blocks.addOn(px, top, pz, 0.4, 0.025, 0.4, CHINA, STYLE.SMOOTH, 0.785)
      DISHES[(k + 1 + index + (side > 0 ? 2 : 0)) % DISHES.length](blocks, px, top + 0.025, pz)
      const cup = CUPS[(k + 2 + index * 2 + side) % CUPS.length]
      blocks.addOn(px + 0.42, top + 0.015, pz, 0.12, 0.2, 0.12, cup, STYLE.SMOOTH)
      if (detail) blocks.addOn(px + 0.42, top + 0.215, pz, 0.13, 0.02, 0.13, CHINA, STYLE.SMOOTH)
    }
  }
}

/** A chair at (x, z) facing `yaw` (towards its table), `base` the deck's top: legs, a padded seat, a back. */
function chair(blocks, x, z, yaw, base, color) {
  const back = Math.cos(yaw) > 0 ? -1 : 1
  const seat = base + SEAT_HEIGHT
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) blocks.addOn(x + sx * 0.24, base, z + sz * 0.24, 0.07, SEAT_HEIGHT - 0.08, 0.07, WOOD_DARK, STYLE.SMOOTH)
  blocks.addOn(x, seat - 0.08, z, 0.6, 0.1, 0.6, color, STYLE.SMOOTH)
  blocks.addOn(x, seat + 0.02, z, 0.5, 0.04, 0.5, shade(color, 0.85), STYLE.SMOOTH)
  blocks.addOn(x, seat + 0.02, z + back * 0.27, 0.6, 0.62, 0.08, color, STYLE.SMOOTH)
  blocks.add(x, seat + 0.66, z + back * 0.27, 0.66, 0.08, 0.12, shade(color, 0.8), STYLE.SMOOTH)
}

/** Where training pad `index`'s label floats: over its middle, above the diners' heads. */
export function zoneSignPosition(index) {
  const p = TRAIN_PADS[index]
  return [p.x, padHeight(index) + 4.6, p.z]
}

/**
 * Builds the training hall into the world's block set (and the pads' giant foods into
 * `props`, or later through `decor`).
 */
export function buildTrainingPads(blocks, props, { detail = true, decor = null, palette } = {}) {
  tiers(blocks, palette)
  backWall(blocks, palette)
  const half = zoneHalf()
  for (let i = 0; i < ZONE_COUNT; i += 1) {
    const t = PAD_THEMES[i]
    const { x, z, tier } = TRAIN_PADS[i]
    const ground = TIERS[tier]
    const top = ground + ZONE_HEIGHT
    // The deck: a dark rim (zoneDeckRect: 0.4 of it), the floor in the pad's colour.
    blocks.addOn(x, ground - 0.1, z, half.x * 2 + 0.8, ZONE_HEIGHT + 0.1, half.z * 2 + 0.8, RIM, STYLE.SMOOTH)
    blocks.addOn(x, top - 0.06, z, half.x * 2 - 0.3, 0.1, half.z * 2 - 0.3, t.deck, t.deckStyle)
    // A strip of light along its front (west) edge, where you step up.
    blocks.addOn(x - half.x + 0.05, top - 0.06, z, 0.2, 0.12, half.z * 2 - 0.3, t.text, STYLE.GLOW)

    for (const tb of PAD_TABLES) table(blocks, x + tb.x, z + tb.z, top, t, i, detail)
    for (const seat of SEATS) if (seat.zone === i) chair(blocks, seat.x, seat.z, seat.yaw, top, t.chair)

    // A lamp at each back corner, lit in the pad's colour.
    for (const side of [-1, 1]) {
      const lx = x + half.x - 0.35
      const lz = z + side * (half.z - 0.35)
      blocks.addOn(lx, top, lz, 0.18, 2.2, 0.18, '#3a4150', STYLE.SMOOTH)
      blocks.add(lx, top + 2.4, lz, 0.44, 0.44, 0.44, t.text, STYLE.GLOW, 0.785)
      if (detail) blocks.add(lx, top + 2.7, lz, 0.54, 0.1, 0.54, '#2b2f38', STYLE.SMOOTH)
    }

    // A pillar behind the deck (on its tier, east side), a giant food bobbing on top.
    const px = x + half.x + 0.9
    blocks.addOn(px, ground, z, 0.9, 2.6, 0.9, shade(t.chair, 0.7), STYLE.STUDS)
    blocks.addOn(px, ground + 2.6, z, 1.3, 0.25, 1.3, t.text, STYLE.GLOW)
    const place = (builder) => {
      const drop = -foodGeometry(t.food).boundingBox.min.y * foodSize(t.food) * GIANT_FOOD
      addFoodToProps(builder, t.food, { position: [px, ground + 2.85 + drop, z], yaw: -Math.PI / 2, lean: 0.12, scale: GIANT_FOOD, anim: [i * 1.9, 0.25] })
    }
    if (decor) decor.later(place)
    else if (props) place(props)
  }
}
