import { DROP, FLOOR_LEN, floorSouth, padRect, roomFloorY, ROOM_LEN, STAGE_HALF_W as W } from '@shared/world'

import { BlockSet, toColor } from '../blocks'
import { STYLE } from '../materials'
import { STAGE_COUNT, STAGES } from './course'
import { STAGE_THEMES } from './themes'

/**
 * The rooms under the floors, one BlockSet each (one draw call a room), built when you
 * get near them. Room i is a closed box DROP tall under floor i: its own floor running
 * north to floor i + 1 (the breakable slab - Stages.jsx draws those), walls of big
 * studs in its stage's colours with a glowing band along the top and lamps down the
 * sides, a ceiling (open over where floor i was: the hole you fell through), and the
 * gold WINS pad halfway along with trophies round it. Glowing arrows on the floor point
 * on to the next floor, and a hazard stripe marks where it starts. The deepest room of a
 * world has a giant trophy at its end instead.
 *
 * No two visible faces share a plane: where boxes meet, one stops short or the faces
 * are hidden inside the walls (flush faces flicker on phones' depth buffers).
 */

const T = 1
const GOLD = '#ffd21f'
const PAD_RIM = '#2b2f38'

const shades = new Map()
/** `color` a little lighter (`by` > 0) or darker (< 0), made once. */
export function shade(color, by) {
  const key = `${color}${by}`
  if (!shades.has(key)) shades.set(key, toColor(color).clone().lerp(toColor(by > 0 ? '#ffffff' : '#000000'), Math.abs(by)))
  return shades.get(key)
}

/** A box from (x0, y0, z0) to (x1, y1, z1). */
function span(b, x0, x1, y0, y1, z0, z1, color, style) {
  b.add((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, color, style)
}

/** A little gold cup on the floor at (x, y, z), `s` big. */
function trophy(b, x, y, z, s) {
  b.addOn(x, y, z, 0.7 * s, 0.18 * s, 0.7 * s, '#c98a12', STYLE.SMOOTH)
  b.addOn(x, y + 0.18 * s, z, 0.18 * s, 0.45 * s, 0.18 * s, GOLD, STYLE.SMOOTH)
  b.addOn(x, y + 0.63 * s, z, 0.8 * s, 0.55 * s, 0.8 * s, GOLD, STYLE.GLOW, 0.785)
  b.addOn(x, y + 1.18 * s, z, 0.92 * s, 0.1 * s, 0.92 * s, '#fff1a0', STYLE.GLOW, 0.785)
  for (const side of [-1, 1]) b.add(x + side * 0.55 * s, y + 0.9 * s, z, 0.14 * s, 0.4 * s, 0.14 * s, GOLD, STYLE.SMOOTH)
}

/** The theme of stage `i` (any world). */
export const themeOf = (i) => STAGE_THEMES[STAGES[i]?.id] ?? STAGE_THEMES.grass

/** Builds room `i` of the world you're in. `detail` (off on LOW) adds the small stuff. */
export function buildRoom(i, { detail = true } = {}) {
  const b = new BlockSet()
  const theme = themeOf(i)
  const s = floorSouth(i)
  const n = s - ROOM_LEN
  const h = roomFloorY(i)
  const top = h + DROP
  const last = i === STAGE_COUNT - 1
  const wallStyle = theme.wallStyle ?? STYLE.BLOCK
  const floorStyle = theme.floorStyle ?? STYLE.TILES
  const trim = theme.cap ?? shade(theme.wall, 0.3)
  const trimStyle = theme.capStyle ?? STYLE.SMOOTH
  const lamp = theme.gate ?? GOLD

  // The floor: all of it but the next floor's slab at the north end (the last room's is whole).
  const floorNorth = last ? n : n + FLOOR_LEN
  span(b, -W, W, h - 1, h, floorNorth, s, theme.floor, floorStyle)
  // The walls: sides the whole length (round the corners), north, and south under the room above's floor.
  span(b, -W - T, -W, h, top, n - T, s + T, theme.wall, wallStyle)
  span(b, W, W + T, h, top, n - T, s + T, theme.wall, wallStyle)
  span(b, -W, W, h, top, n - T, n, theme.wall, wallStyle)
  span(b, -W, W, h, top - 1, s, s + T, theme.wall, wallStyle)
  // The ceiling: north of the hole you fell through (and the room above's north wall's foot).
  span(b, -W, W, top, top + 1, n, s - FLOOR_LEN - T, shade(theme.wall, -0.18), STYLE.STUDS)

  // A kerb along the foot of the walls, and a glowing band along their top.
  const kerb = shade(theme.wall, -0.25)
  for (const side of [-1, 1]) {
    const x = side * (W - 0.13)
    span(b, x - 0.13, x + 0.13, h, h + 0.35, n + 0.26, s - 0.01, kerb, STYLE.SMOOTH)
    span(b, x - 0.1, x + 0.1, top - 0.9, top - 0.5, n + 0.2, s, trim, trimStyle)
  }
  span(b, -W + 0.26, W - 0.26, h, h + 0.35, n, n + 0.26, kerb, STYLE.SMOOTH)
  span(b, -W + 0.2, W - 0.2, top - 0.9, top - 0.5, n, n + 0.2, trim, trimStyle)
  // The south wall's band stops at the hole's edge (the room above's floor is over it).
  span(b, -W + 0.2, W - 0.2, top - 2.4, top - 2.0, s - 0.2, s, trim, trimStyle)

  // Lamps down both sides, in the stage's colour.
  for (let z = s - 4; z > n + 2; z -= 7) {
    for (const side of [-1, 1]) {
      const x = side * (W - 0.18)
      b.add(x, h + 5.2, z, 0.3, 0.9, 0.9, '#2c313c', STYLE.SMOOTH)
      b.add(x - side * 0.12, h + 5.2, z, 0.25, 0.6, 0.6, lamp, STYLE.GLOW)
      if (detail) b.add(x - side * 0.05, h + 9.6, z + 3.5, 0.2, 0.45, 0.45, lamp, STYLE.GLOW)
    }
  }

  // The WINS pad: a dark rim, the gold glowing top, trophies at its corners.
  const pad = padRect(i)
  const pcx = (pad.minX + pad.maxX) / 2
  const pcz = (pad.minZ + pad.maxZ) / 2
  span(b, pad.minX - 0.3, pad.maxX + 0.3, h, h + 0.05, pad.minZ - 0.3, pad.maxZ + 0.3, PAD_RIM, STYLE.SMOOTH)
  span(b, pad.minX, pad.maxX, h + 0.05, h + 0.09, pad.minZ, pad.maxZ, last ? '#ff9ae8' : GOLD, STYLE.GLOW)
  // A darker gold diamond in its middle: what the label floats over.
  b.addOn(pcx, h + 0.09, pcz, 2.4, 0.02, 2.4, last ? '#ff5fd0' : '#ff9c00', STYLE.GLOW, 0.785)
  for (const [ux, uz] of [
    [pad.minX + 0.6, pad.minZ + 0.6],
    [pad.maxX - 0.6, pad.minZ + 0.6],
    [pad.minX + 0.6, pad.maxZ - 0.6],
    [pad.maxX - 0.6, pad.maxZ - 0.6],
  ]) {
    trophy(b, ux, h + 0.09, uz, 0.8)
  }
  if (detail) {
    // A pillar of light rising off the pad.
    for (const [dx, dz] of [
      [-1.6, 0],
      [1.6, 0],
      [0, -2.6],
      [0, 2.6],
    ]) {
      b.add(pcx + dx, h + 2.2, pcz + dz, 0.08, 4, 0.08, '#fff6c0', STYLE.GLOW)
    }
  }

  if (last) {
    // Rock bottom: a giant trophy on a plinth at the end of the room.
    const z = n + 4
    b.addOn(0, h, z, 5, 1.2, 5, '#3a2a6a', STYLE.GALAXY)
    trophy(b, 0, h + 1.2, z, 4.2)
    return b
  }

  // On to the next floor: glowing arrows down the clear west side, a hazard stripe where
  // the slab starts, and a lit frame on the walls round it.
  const next = themeOf(i + 1)
  for (let z = s - FLOOR_LEN - 2; z > n + FLOOR_LEN + 1.5; z -= 3.2) {
    for (const side of [-1, 1]) b.addOn(-4 + side * 0.55, h, z, 1.5, 0.03, 0.42, '#ffffff', STYLE.GLOW, side * 0.75)
  }
  span(b, -W + 0.26, W - 0.26, h, h + 0.03, n + FLOOR_LEN, n + FLOOR_LEN + 0.55, '#ffcc1a', STYLE.STRIPES)
  for (const side of [-1, 1]) {
    const x = side * (W - 0.12)
    span(b, x - 0.12, x + 0.12, h, h + 7, n + FLOOR_LEN - 0.15, n + FLOOR_LEN + 0.15, next.gate ?? GOLD, STYLE.GLOW)
  }
  span(b, -W + 0.2, W - 0.2, h + 7, h + 7.3, n + FLOOR_LEN - 0.15, n + FLOOR_LEN + 0.15, next.gate ?? GOLD, STYLE.GLOW)
  return b
}

/** Where room `i`'s labels float: over its WINS pad, and over the next floor. */
export function roomLabelSpots(i) {
  const pad = padRect(i)
  const h = roomFloorY(i)
  const n = floorSouth(i) - ROOM_LEN
  return {
    pad: [(pad.minX + pad.maxX) / 2, h + 4.2, (pad.minZ + pad.maxZ) / 2],
    next: [0, h + 9.2, n + FLOOR_LEN / 2],
  }
}

export { W as HALF_WIDTH }
