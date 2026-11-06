import {
  BufferAttribute,
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearMipmapLinearFilter,
  NearestFilter,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three'

import {
  AURA_STAND,
  EGG_STANDS,
  FOOD_COUNTER,
  FOOD_HUT,
  FREE_REWARD,
  GATE_Z,
  HALL_TIERS,
  PLAZA,
  PORTALS,
  POTION_STAND,
  SPAWN,
  SPHINX_STAND,
  STATUE,
  WALKWAY,
  WATERFALL,
} from '@shared/world'

import { STYLE } from '../materials'
import { DIRT_PATCHES, LAWNS } from './lawns'
import { SQUARE_RADIUS } from './structures'

/**
 * The plaza floor: one big plane whose colours come from a tiny "ground map" texture
 * painted at one texel per world unit. Paths, squares and lawns are painted into it -
 * rects and discs on the texel grid, so their edges always fall on the stud-tile seams -
 * and the whole floor is a single draw call regardless of how many painted regions it has.
 *
 * The layout, as you see it from spawn (facing north): straight ahead the runway, a wide
 * red carpet with nothing on it, all the way to the STAGE gate; a cross street through
 * spawn, west to the champion's square and east to the training hall's street, which runs
 * north along the front of the hall; behind you a walk down to the egg plaza - a
 * promenade along the front of the egg stands, the leaderboards behind them. Further up
 * the runway two more streets cross it to the west: one to the food shop's counter, and
 * one near the top to the aura stand and the portal. A short walk leads up to the potion
 * stand.
 */

const MAP = { minX: PLAZA.minX - 10, maxX: PLAZA.maxX + 10, minZ: PLAZA.minZ, maxZ: PLAZA.maxZ + 8 }
const MAP_W = MAP.maxX - MAP.minX
const MAP_H = MAP.maxZ - MAP.minZ

/** Where the ground plane ends to the north: the gate (the yard behind it has a floor of its own). */
export const GROUND_NORTH_EDGE = GATE_Z

/** The runway: WALKWAY, out to whole units, from spawn right up to the gate. */
const RUNWAY = { minX: Math.floor(WALKWAY.minX), maxX: Math.ceil(WALKWAY.maxX), minZ: PLAZA.minZ, maxZ: SPAWN.z }
/** The street through spawn: west to the champion's square, east to the training hall's street. */
const CROSS = { minX: Math.round(STATUE.x + SQUARE_RADIUS) - 1, maxX: 12, minZ: SPAWN.z - 4, maxZ: SPAWN.z + 4 }
/** Up the front of the training hall, from the cross street to the corner by the gate. */
const HALL_STREET = { minX: 8, maxX: 12, minZ: -38, maxZ: CROSS.minZ }
/** From the runway's top over to the hall street. */
const HALL_LINK = { minX: RUNWAY.maxX, maxX: HALL_STREET.minX, minZ: -38, maxZ: -34 }
/** The floor of the hall's front column, under the pads on the ground. */
const HALL_FLOOR = { minX: HALL_STREET.maxX - 1, maxX: Math.ceil(HALL_TIERS[0].minX) + 1, minZ: Math.floor(HALL_TIERS[0].minZ) - 1, maxZ: Math.ceil(HALL_TIERS[0].maxZ) + 1 }
/** Across the runway on the line of the food shop's counter: west to the counter. */
const MIDWAY = { minX: Math.round(FOOD_COUNTER.x), maxX: RUNWAY.minX, minZ: Math.round(FOOD_COUNTER.z) - 2, maxZ: Math.round(FOOD_COUNTER.z) + 2 }
/** Across the runway near the top: west past the aura stand's front to the portal. */
const NORTH = { minX: Math.round(PORTALS[0].x) + 4, maxX: RUNWAY.minX, minZ: Math.round(AURA_STAND.z) + 4, maxZ: Math.round(AURA_STAND.z) + 8 }
/** The egg plaza's promenade, along the front of the egg stands. */
const PROMENADE = { minX: -24, maxX: 36, minZ: 24, maxZ: 28 }
/** The band the egg stands stand on. */
const EGG_BAND = { minX: -20, maxX: 31, minZ: PROMENADE.maxZ, maxZ: 34 }
/** The paving round the food shop's hut, and the round welcome patch in front of its counter. */
const HUT_APRON = {
  minX: Math.round(FOOD_HUT.x - FOOD_HUT.half) - 1,
  maxX: Math.round(FOOD_HUT.x + FOOD_HUT.half) + 1,
  minZ: Math.round(FOOD_HUT.z - FOOD_HUT.half) - 1,
  maxZ: Math.round(FOOD_HUT.z + FOOD_HUT.half) + 1,
}
const WELCOME = FOOD_COUNTER.radius + 0.8
/** From the cross street up to the front of the potion stand (its counter faces east). */
const POTION_WALK = { minX: Math.round(POTION_STAND.x) + 3, maxX: Math.round(POTION_STAND.x) + 7, minZ: Math.round(POTION_STAND.z), maxZ: CROSS.minZ + 1 }
/** The spawn disc's radius. */
const SPAWN_RADIUS = 5.5
/** Every path but the runway, all on whole units (8 wide for the main street, 4 for the rest). */
const PATHS = [
  CROSS,
  HALL_STREET,
  HALL_LINK,
  MIDWAY,
  NORTH,
  POTION_WALK,
  // Spawn down to the egg plaza.
  { minX: -4, maxX: 4, minZ: SPAWN.z, maxZ: PROMENADE.minZ },
  PROMENADE,
]

function painter(ctx) {
  const rect = (r, color) => {
    ctx.fillStyle = color
    ctx.fillRect(
      Math.round(r.minX - MAP.minX),
      Math.round(r.minZ - MAP.minZ),
      Math.round(r.maxX - r.minX),
      Math.round(r.maxZ - r.minZ),
    )
  }
  const bordered = (r, fill, edge) => {
    rect(r, edge)
    rect({ minX: r.minX + 1, maxX: r.maxX - 1, minZ: r.minZ + 1, maxZ: r.maxZ - 1 }, fill)
  }
  /**
   * Every texel whose middle is between `inner` and `outer` from (x, z), in `color` - or,
   * given several, in turn round the ring in `count` tiles.
   */
  const band = (x, z, inner, outer, color, count = 1) => {
    const colors = Array.isArray(color) ? color : [color]
    const i0 = Math.max(0, Math.floor(x - outer - MAP.minX))
    const i1 = Math.min(MAP_W - 1, Math.ceil(x + outer - MAP.minX))
    const j0 = Math.max(0, Math.floor(z - outer - MAP.minZ))
    const j1 = Math.min(MAP_H - 1, Math.ceil(z + outer - MAP.minZ))
    for (let j = j0; j <= j1; j += 1) {
      for (let i = i0; i <= i1; i += 1) {
        const dx = MAP.minX + i + 0.5 - x
        const dz = MAP.minZ + j + 0.5 - z
        const d2 = dx * dx + dz * dz
        if (d2 > outer * outer || d2 < inner * inner) continue
        const tile = Math.floor(((Math.atan2(dz, dx) + Math.PI) / (Math.PI * 2)) * count)
        ctx.fillStyle = colors[tile % colors.length]
        ctx.fillRect(i, j, 1, 1)
      }
    }
  }
  const disc = (x, z, radius, color) => band(x, z, 0, radius, color)
  /** A paved disc with a light rim. */
  const paved = (x, z, radius, fill, edge) => {
    disc(x, z, radius, edge)
    disc(x, z, radius - 1, fill)
  }
  return { rect, bordered, band, disc, paved }
}

/** Paints the ground map in `palette`'s colours (see palette.js). */
export function createGroundMap(maxTexture, palette) {
  const p = palette
  const canvas = document.createElement('canvas')
  canvas.width = MAP_W
  canvas.height = MAP_H
  const ctx = canvas.getContext('2d')
  const { rect, bordered, band, disc, paved } = painter(ctx)

  rect(MAP, p.plaza)

  // The kerbed lawns and their dirt patches.
  for (const lawn of LAWNS) bordered(lawn, p.lawn, p.curbEdge)
  for (const patch of DIRT_PATCHES) rect(patch, p.dirt)

  // The training hall's front column: warm paving under the pads on the ground.
  bordered(HALL_FLOOR, p.street, p.streetEdge)

  // The paths, and the band under the egg stands.
  for (const r of PATHS) bordered(r, p.path, p.pathEdge)
  bordered(EGG_BAND, p.eggBand, p.eggBandEdge)
  // The apron in front of the gate.
  bordered({ minX: -13, maxX: 13, minZ: GATE_Z, maxZ: GATE_Z + 5 }, p.path, p.pathEdge)

  // Round paved spots for the stands, the free gift, the Sphinx and the portal, and one
  // under the big Demon egg.
  paved(AURA_STAND.x, AURA_STAND.z, 5.5, p.path, p.pathEdge)
  paved(POTION_STAND.x, POTION_STAND.z, 4.5, p.path, p.pathEdge)
  paved(FREE_REWARD.x, FREE_REWARD.z, 4, p.path, p.pathEdge)
  paved(SPHINX_STAND.x, SPHINX_STAND.z, 5, p.path, p.pathEdge)
  band(SPHINX_STAND.x, SPHINX_STAND.z, 3.6, 4.2, p.gold)
  for (const portal of PORTALS) paved(portal.x, portal.z, 6, p.path, p.pathEdge)
  const big = EGG_STANDS.find((s) => s.big)
  if (big) paved(big.x, big.z, 3.6, p.eggBand, p.eggBandEdge)

  // The food shop: warm paving round the hut, and in front of its counter a round
  // welcome patch with a border of alternating tiles.
  bordered(HUT_APRON, p.market, p.streetEdge)
  paved(FOOD_COUNTER.x, FOOD_COUNTER.z, WELCOME, p.market, p.streetEdge)
  disc(FOOD_COUNTER.x, FOOD_COUNTER.z, WELCOME - 1.6, p.marketRing)
  band(FOOD_COUNTER.x, FOOD_COUNTER.z, WELCOME - 1, WELCOME, p.marketBorder, 20)

  // The champion's square: concentric rings of paving round the plinth.
  paved(STATUE.x, STATUE.z, SQUARE_RADIUS, p.path, p.pathEdge)
  band(STATUE.x, STATUE.z, STATUE.radius + 2.0, STATUE.radius + 2.7, p.gold)
  disc(STATUE.x, STATUE.z, STATUE.radius + 1.0, p.pathEdge)
  disc(STATUE.x, STATUE.z, STATUE.radius + 0.4, p.squareCore)

  // The runway: one clean carpet from spawn to the gate, over everything it crosses -
  // a light edge, a gold line, then the carpet.
  rect(RUNWAY, p.runwayEdge)
  rect({ minX: RUNWAY.minX + 1, maxX: RUNWAY.maxX - 1, minZ: RUNWAY.minZ, maxZ: RUNWAY.maxZ }, p.runwayLine)
  rect({ minX: RUNWAY.minX + 2, maxX: RUNWAY.maxX - 2, minZ: RUNWAY.minZ, maxZ: RUNWAY.maxZ }, p.runway)

  // Spawn: a paved disc at the foot of the runway, where the streets meet, a gold ring on it.
  paved(SPAWN.x, SPAWN.z, SPAWN_RADIUS, p.path, p.pathEdge)
  band(SPAWN.x, SPAWN.z, 2.4, 3.3, p.gold)

  // Waterfall pool at the foot of the north cliff.
  rect({ minX: WATERFALL.x - 6, maxX: WATERFALL.x + 6, minZ: WATERFALL.z, maxZ: WATERFALL.z + 5 }, p.water)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = NearestFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.anisotropy = maxTexture > 512 ? 4 : 1
  return texture
}

/**
 * The runway's chevrons: big flat arrows up the middle of the runway pointing to the
 * STAGE gate, flat on the ground (a few hundredths up: paint, not props - nothing stands
 * on the runway). Boxes in the world's block set. In World 2 they glow.
 */
export function buildRunway(blocks, palette) {
  const start = SPAWN.z - SPAWN_RADIUS - 2
  const end = GATE_Z + 6
  for (let z = start; z > end; z -= 5) {
    // Not where the streets cross.
    if ([MIDWAY, NORTH].some((r) => z > r.minZ - 1.5 && z < r.maxZ + 1.5)) continue
    for (const side of [-1, 1]) {
      blocks.addOn(side * 0.95, 0, z, 2.6, 0.04, 0.7, palette.chevron, palette.chevronStyle, -side * 0.75)
    }
  }
}

/**
 * World 2's neon: glowing strips down both sides of the runway, a ring on spawn's gold
 * ring, and rings round the champion's square and the food shop's welcome patch (open
 * where paths come in) - thin boxes in the world's block set, so they cost no draw call.
 * None by day (`palette.neon` is null).
 */
export function buildNeonTrims(blocks, palette) {
  if (!palette.neon) return
  const [pink, cyan] = palette.neon
  const H = 0.05
  const W = 0.18
  const alongZ = (x, z0, z1, color) => {
    if (z1 - z0 > 0.5) blocks.addOn(x, 0, (z0 + z1) / 2, W, H, z1 - z0, color, STYLE.GLOW)
  }
  /** How far either side of a disc's middle a line `off` from it crosses its rim. */
  const rim = (radius, off) => Math.sqrt(Math.max(0, radius * radius - off * off))
  const onPath = (x, z) => [RUNWAY, ...PATHS].some((r) => x > r.minX - 0.6 && x < r.maxX + 0.6 && z > r.minZ - 0.6 && z < r.maxZ + 0.6)
  /** A ring of chords round (x, z); with `cut`, none where a path crosses it. */
  const ring = (x, z, radius, segments, color, cut) => {
    const step = (Math.PI * 2) / segments
    const chord = 2 * radius * Math.sin(step / 2) - 0.06
    for (let s = 0; s < segments; s += 1) {
      const a = (s + 0.5) * step
      const px = x + Math.cos(a) * radius
      const pz = z + Math.sin(a) * radius
      if (cut && onPath(px, pz)) continue
      blocks.addOn(px, 0, pz, chord, H, W, color, STYLE.GLOW, Math.PI / 2 - a)
    }
  }

  // Down both sides of the runway, on its gold lines, broken where the streets cross.
  const rx = RUNWAY.maxX - 1.5
  for (const side of [-1, 1]) {
    alongZ(side * rx, MIDWAY.maxZ, SPAWN.z - rim(SPAWN_RADIUS, rx), cyan)
    alongZ(side * rx, NORTH.maxZ, MIDWAY.minZ, cyan)
    alongZ(side * rx, GATE_Z + 5, NORTH.minZ, cyan)
  }
  // Rings: on spawn's gold ring, round the champion's square, round the welcome patch.
  ring(SPAWN.x, SPAWN.z, 2.85, 20, pink, false)
  ring(STATUE.x, STATUE.z, SQUARE_RADIUS - 0.5, 32, pink, true)
  ring(FOOD_COUNTER.x, FOOD_COUNTER.z, WELCOME - 0.5, 20, cyan, true)
}

/**
 * The ground plane, with UVs computed from world position so the map lands exactly
 * on the world grid. Outside the map, clamp-to-edge repeats the plaza colour.
 */
export function createGroundGeometry() {
  const minX = -280
  const maxX = 280
  const minZ = GROUND_NORTH_EDGE
  const maxZ = 280
  const geometry = new PlaneGeometry(maxX - minX, maxZ - minZ)
  geometry.rotateX(-Math.PI / 2)
  geometry.translate((minX + maxX) / 2, 0, (minZ + maxZ) / 2)

  const position = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i)
    const z = position.getZ(i)
    uv.setXY(i, (x - MAP.minX) / MAP_W, 1 - (z - MAP.minZ) / MAP_H)
  }
  uv.needsUpdate = true
  geometry.setAttribute('aStyle', new BufferAttribute(new Float32Array(position.count), 1))
  return geometry
}
