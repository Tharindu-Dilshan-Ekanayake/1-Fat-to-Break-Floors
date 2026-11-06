import { BoxGeometry } from 'three'

import { STYLE } from '../materials'

/** One box, for the lollipop heads' parts (each a scaled copy of it in the prop mesh). */
const BOX = new BoxGeometry(1, 1, 1)

/**
 * A giant lollipop: its white stick in the block set, up into the middle of its head; the
 * head - an eight-sided swirl turned to `yaw` - in the prop mesh, bobbing gently up and
 * down on the stick (the toy shader does it: no per-frame work).
 */
function giantLollipop(blocks, props, x, z, s, k, yaw, palette) {
  const pick = (n) => palette.leaves[(k + n) % palette.leaves.length]
  const y = 6.9 * s
  blocks.addOn(x, 0, z, 0.36 * s, y, 0.36 * s, palette.trunk, STYLE.SMOOTH)
  const anim = [k * 1.3, 0.28]
  const part = (sx, sy, sz, color, spin) =>
    props.add(BOX, { position: [x, y, z], scale: [sx * s, sy * s, sz * s], rotation: [0, yaw, spin], color, style: STYLE.SMOOTH, anim })
  part(3.4, 3.4, 0.7, pick(0), 0)
  part(3.4, 3.4, 0.7, pick(0), Math.PI / 4)
  part(2.3, 2.3, 0.76, '#ffffff', Math.PI / 8)
  part(1.4, 1.4, 0.82, pick(2), Math.PI / 4)
}

/** A candy cane standing at (x, z), its hook turned to `yaw`: red with white stripes. */
function candyCane(blocks, x, z, height, yaw) {
  blocks.addOn(x, 0, z, 0.55, height, 0.55, '#ff3b5c', STYLE.STRIPES)
  const dx = Math.sin(yaw)
  const dz = Math.cos(yaw)
  blocks.add(x + dx * 0.35, height + 0.25, z + dz * 0.35, 0.55, 0.55, 0.9, '#ffffff', STYLE.SMOOTH, yaw, 0.5)
  blocks.add(x + dx * 0.9, height + 0.35, z + dz * 0.9, 0.55, 0.55, 0.7, '#ff3b5c', STYLE.SMOOTH, yaw, -0.3)
  blocks.add(x + dx * 1.25, height - 0.15, z + dz * 1.25, 0.55, 0.9, 0.55, '#ffffff', STYLE.SMOOTH, yaw)
}

/**
 * Candy Kingdom's landmarks: giant lollipops beside the runway near spawn and either side
 * of the way up to the gate (their heads bobbing, in the prop mesh), and candy canes
 * either side of the walk down to the eggs. None in World 2.
 */
export function buildCandyDecor(blocks, props, { palette } = {}) {
  if (!palette.candy) return
  // Giant lollipops either side of the runway: near spawn, and either side of the way up to the gate.
  giantLollipop(blocks, props, -10, -2, 1.7, 0, Math.PI / 2 - 0.4, palette)
  giantLollipop(blocks, props, 7.6, -1, 1.5, 3, -Math.PI / 2 + 0.4, palette)
  giantLollipop(blocks, props, -16, -39, 1.6, 1, Math.PI / 2 - 0.5, palette)
  giantLollipop(blocks, props, 21, -38.5, 1.5, 2, -Math.PI / 2 + 0.5, palette)
  // Candy canes either side of the walk down to the eggs, hooks turned out.
  candyCane(blocks, -5.5, 21, 3.4, -Math.PI / 2)
  candyCane(blocks, 5.2, 19.5, 3.4, Math.PI / 2)
}
