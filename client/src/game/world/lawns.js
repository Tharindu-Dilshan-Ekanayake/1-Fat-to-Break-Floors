import { mulberry32 } from '@shared/rng'

import { STYLE } from '../materials'

/**
 * The kerbed lawns, laid out in the blocks the paths leave (see ground.js), framing them
 * rather than dotted about: one beside the runway north of spawn, a strip each side of
 * the walk from spawn to the egg plaza, one between the runway and the food shop, one
 * behind the egg stands in front of the leaderboards, one behind the Sphinx, one by the
 * waterfall, one either side of the runway further up, and ones behind the food shop
 * and the champion's square. The ground map paints the grass (and a dirt patch on the
 * bigger ones); the kerbs are blocks in the world's one block set. All rects are on whole
 * units, so their edges fall on the ground map's texels.
 */
export const LAWN = {
  /** Beside the runway, west, just north of spawn. */
  avenue: { minX: -13, maxX: -7, minZ: -6, maxZ: 8 },
  /** Either side of the walk from spawn down to the egg plaza. */
  stripW: { minX: -20, maxX: -6, minZ: 21, maxZ: 23 },
  stripE: { minX: 13, maxX: 22, minZ: 21, maxZ: 23 },
  /** Behind the egg stands, in front of the leaderboards. */
  boards: { minX: -20, maxX: 20, minZ: 34, maxZ: 37 },
  /** Behind the Sphinx, in the south-east corner. */
  corner: { minX: 34, maxX: 56, minZ: 36, maxZ: 41 },
  /** By the waterfall, north of the training hall. */
  falls: { minX: 26, maxX: 38, minZ: -44, maxZ: -38 },
  /** Either side of the runway further up, between the streets crossing it. */
  upW: { minX: -20, maxX: -8, minZ: -25, maxZ: -18 },
  upE: { minX: 14, maxX: 23, minZ: -42, maxZ: -38 },
  /** Between the runway and the food shop, south of the street to its counter. */
  shop: { minX: -28, maxX: -15, minZ: -8, maxZ: -3 },
  /** Behind the food shop's hut, and behind the champion's square: trees as a backdrop. */
  behindHut: { minX: -56, maxX: -47, minZ: -22, maxZ: -2 },
  behindStatue: { minX: -56, maxX: -44, minZ: 10, maxZ: 26 },
}
export const LAWNS = Object.values(LAWN)

/** Kerb height and width: low enough to step over. */
const CURB_H = 0.16
const CURB_W = 0.7

/**
 * A dirt patch or so inside each of the bigger lawns, the same everywhere (seeded):
 * rects in world units, kept a little in from the edges.
 */
export const DIRT_PATCHES = LAWNS.flatMap((lawn, i) => {
  const rand = mulberry32(31 + i * 17)
  const w = lawn.maxX - lawn.minX
  const d = lawn.maxZ - lawn.minZ
  const count = Math.round((w * d) / 90)
  return Array.from({ length: count }, () => {
    const pw = Math.min(w - 2, 2 + Math.floor(rand() * 4))
    const pd = Math.max(1, Math.min(d - 2, 2 + Math.floor(rand() * 3)))
    const x = Math.floor(lawn.minX + 1 + rand() * Math.max(0, w - pw - 2))
    const z = Math.floor(lawn.minZ + 1 + rand() * Math.max(0, d - pd - 2))
    return { minX: x, maxX: x + pw, minZ: z, maxZ: z + pd }
  })
})

/** The kerbs round every lawn, in `palette`'s kerb colour. */
export function buildLawnCurbs(blocks, palette) {
  for (const l of LAWNS) {
    const w = l.maxX - l.minX
    const d = l.maxZ - l.minZ
    const cx = (l.minX + l.maxX) / 2
    const cz = (l.minZ + l.maxZ) / 2
    for (const side of [-1, 1]) {
      blocks.addOn(cx, 0, cz + side * (d / 2 + CURB_W / 2), w + CURB_W * 2, CURB_H, CURB_W, palette.curb, STYLE.STUDS)
      blocks.addOn(cx + side * (w / 2 + CURB_W / 2), 0, cz, CURB_W, CURB_H, d, palette.curb, STYLE.STUDS)
    }
  }
}
