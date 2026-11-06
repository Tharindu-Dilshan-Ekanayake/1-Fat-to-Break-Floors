import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Matrix4, Quaternion, Vector3 } from 'three'

import { TUTORIAL } from '@shared/balance'
import { benchSeat, EGG_STANDS, floorRect, FOOD_COUNTER, groundAt, padRect, TRAIN_PADS } from '@shared/world'

import { getGame } from '../../store/game'
import { createToyInstances, PropBuilder } from '../blocks'
import { sharedMaterials, STYLE } from '../materials'
import { runtime } from '../runtime'
import { stage } from '../stage/stageControl'

const MAX_CHEVRONS = 14
const SPACING = 2.4
/** Stop drawing arrows this close to the goal. */
const ARRIVED = 3.5

const egg = EGG_STANDS.find((s) => s.eggId === 'basic') ?? EGG_STANDS[0]
/** The FREE pad's chair nearest the runway, and the way its diner faces (over the table). */
const seat = benchSeat(0, TRAIN_PADS[0].x - 5, TRAIN_PADS[0].z)
const first = floorRect(0)
const pad = padRect(0)

/** Ground point each tutorial step leads to. */
const TARGETS = {
  // The middle of floor 0, through the gate.
  stage: { x: 0, z: (first.minZ + first.maxZ) / 2 },
  // Room 0's WINS pad (shown once you're down there).
  pad: { x: (pad.minX + pad.maxX) / 2, z: (pad.minZ + pad.maxZ) / 2 },
  // The FREE pad's chair, just short of it.
  zone0: { x: seat.x + Math.sin(seat.yaw) * -0.8, z: seat.z + Math.cos(seat.yaw) * -0.8 },
  // The spot in front of the food shop's counter, where the shop opens.
  foods: { x: FOOD_COUNTER.x, z: FOOD_COUNTER.z },
  // In front of the basic egg's stand, on the plaza side.
  eggs: { x: egg.x + Math.sin(egg.yaw) * 3.5, z: egg.z + Math.cos(egg.yaw) * 3.5 },
}

const _m = new Matrix4()
const _q = new Quaternion()
const _p = new Vector3()
const _s = new Vector3(1, 1, 1)
const _up = new Vector3(0, 1, 0)

/** A flat ">"-shaped chevron lying on the ground, pointing along +Z. */
function chevronGeometry() {
  const p = new PropBuilder()
  for (const side of [-1, 1]) {
    p.box(side * 0.42, 0.05, -0.05, 1.15, 0.08, 0.38, '#ff9a1f', STYLE.GLOW, [0, side * 0.75, 0])
  }
  return p.build()
}

/**
 * Orange chevrons on the ground leading to the current tutorial goal, as in the
 * reference. They march towards the target and disappear once you get there.
 */
export function TutorialArrows() {
  const ref = useRef(null)
  const { mesh } = useMemo(() => {
    const m = createToyInstances(chevronGeometry(), sharedMaterials().toy, MAX_CHEVRONS)
    return { mesh: m }
  }, [])

  useEffect(
    () => () => {
      mesh.geometry.dispose()
      mesh.dispose()
    },
    [mesh],
  )

  useFrame((state) => {
    const instanced = ref.current
    if (!instanced) return
    const { profile } = getGame()
    const step = TUTORIAL[profile.tutorialStep]
    const target = step && TARGETS[step.target]
    const player = runtime.player.position
    // The pad is down in room 0: only shown there; everything else only in the lobby.
    const here = step?.target === 'pad' ? stage.level === 0 : stage.level < 0
    if (!target || !here || runtime.camera.mode !== 'follow') {
      instanced.count = 0
      return
    }
    const dx = target.x - player.x
    const dz = target.z - player.z
    const dist = Math.hypot(dx, dz)
    if (dist < ARRIVED) {
      instanced.count = 0
      return
    }
    const ux = dx / dist
    const uz = dz / dist
    _q.setFromAxisAngle(_up, Math.atan2(ux, uz))
    // March towards the goal.
    const offset = (state.clock.elapsedTime * 3) % SPACING
    let count = 0
    for (let d = 1.6 + offset; d < dist - 1 && count < MAX_CHEVRONS; d += SPACING) {
      const x = player.x + ux * d
      const z = player.z + uz * d
      // Over the training pads' decks, not under them; on the room's floor down below.
      _p.set(x, groundAt(stage.level, x, z) + 0.06, z)
      // Fade in near the player, shrink near the goal.
      const scale = Math.min(1, (d - 1.2) / 1.5) * Math.min(1, (dist - d) / 2)
      _s.setScalar(Math.max(0.01, scale))
      instanced.setMatrixAt(count, _m.compose(_p, _q, _s))
      count += 1
    }
    instanced.count = count
    instanced.instanceMatrix.needsUpdate = true
  })

  return <primitive ref={ref} object={mesh} />
}

export default TutorialArrows
