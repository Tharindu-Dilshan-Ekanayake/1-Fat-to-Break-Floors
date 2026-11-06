import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Vector3 } from 'three'

import { DROP, roomFloorY, roomRect } from '@shared/world'

import { runtime } from './runtime'
import { stage } from './stage/stageControl'

/** How high above the player's feet the camera aims. */
const LOOK_HEIGHT = 1.6

const MIN_DISTANCE = 4
const MAX_DISTANCE = 26

// Pitch limits, in radians. Stops the camera flipping over the top or sinking
// under the ground.
const MIN_PITCH = -0.05
const MAX_PITCH = 1.2

const DRAG_SENSITIVITY = 0.005
const TOUCH_SENSITIVITY = 0.007
const ZOOM_SENSITIVITY = 0.012

// Higher = snappier. Framerate-independent via the exp() smoothing below.
const POSITION_SMOOTHING = 10
const LOOK_SMOOTHING = 14

const _desired = new Vector3()
const _target = new Vector3()
/** Where the camera is looking, eased towards its target (one camera, so module-level). */
const _lookAt = new Vector3()

/** How hard a slam shakes the camera, and how fast that settles. */
const SHAKE_SIZE = 0.32
const SHAKE_DECAY = 6
/** Inside a room of the stages, the camera keeps this far off its walls, floor and ceiling. */
const ROOM_MARGIN = 0.5
/** A slam's jolt this frame. */
const _shake = new Vector3()

/**
 * Keeps `out` (the camera's spot) inside room `level`, looking at `target`: pulled in
 * off the walls, and - for the metres the walls take off how far back it can stand -
 * raised a little, so it looks down on you rather than up your nose. Never near the
 * ceiling (it would look straight down).
 */
function keepInRoom(level, out, target) {
  const r = roomRect(level)
  const floor = roomFloorY(level)
  const before = Math.hypot(out.x - target.x, out.z - target.z)
  out.x = Math.min(r.maxX - ROOM_MARGIN, Math.max(r.minX + ROOM_MARGIN, out.x))
  out.z = Math.min(r.maxZ - ROOM_MARGIN, Math.max(r.minZ + ROOM_MARGIN, out.z))
  const lost = Math.max(0, before - Math.hypot(out.x - target.x, out.z - target.z))
  out.y = Math.min(floor + DROP - 2.5, Math.max(floor + ROOM_MARGIN, out.y + lost * 0.4))
}

/**
 * Third-person orbit camera around the player./**
 * Third-person orbit camera around the player.
 *
 * Mouse: drag (either button) orbits, wheel zooms. Touch: one-finger drag orbits (the
 * joystick owns the left side of the screen as a separate element), pinch zooms.
 *
 * Orbit state lives in `runtime.camera`. Down in the stages it stays inside the room
 * you're in, and every slam jolts it.
 */
export function FollowCamera() {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const initialised = useRef(false)

  useEffect(() => {
    const el = gl.domElement
    if (!el) return undefined

    /** pointerId -> last { x, y } */
    const pointers = new Map()
    let pinchDistance = 0

    const orbit = runtime.camera

    const onPointerDown = (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      el.setPointerCapture?.(e.pointerId)
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinchDistance = Math.hypot(a.x - b.x, a.y - b.y)
      }
    }

    const onPointerMove = (e) => {
      const last = pointers.get(e.pointerId)
      if (!last) return

      if (pointers.size >= 2) {
        last.x = e.clientX
        last.y = e.clientY
        const [a, b] = [...pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        orbit.distance = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, orbit.distance - (d - pinchDistance) * 0.04))
        pinchDistance = d
        return
      }

      const dx = e.clientX - last.x
      const dy = e.clientY - last.y
      last.x = e.clientX
      last.y = e.clientY
      const sensitivity = e.pointerType === 'touch' ? TOUCH_SENSITIVITY : DRAG_SENSITIVITY
      orbit.yaw -= dx * sensitivity
      orbit.pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, orbit.pitch + dy * sensitivity))
    }

    const endDrag = (e) => {
      pointers.delete(e.pointerId)
      el.releasePointerCapture?.(e.pointerId)
    }

    const onWheel = (e) => {
      // Without this the page scrolls behind the canvas.
      e.preventDefault()
      orbit.distance = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, orbit.distance + e.deltaY * ZOOM_SENSITIVITY))
    }

    // Right-dragging otherwise opens the browser context menu mid-orbit.
    const onContextMenu = (e) => e.preventDefault()

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', endDrag)
    el.addEventListener('pointercancel', endDrag)
    el.addEventListener('contextmenu', onContextMenu)
    // passive:false is required for preventDefault() on wheel to take effect.
    el.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', endDrag)
      el.removeEventListener('pointercancel', endDrag)
      el.removeEventListener('contextmenu', onContextMenu)
      el.removeEventListener('wheel', onWheel)
    }
  }, [gl])

  useFrame((_state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    // Whoever's being followed: you.
    const p = runtime.focus ?? runtime.player.position
    // You grow as you fatten: the camera looks at your middle and stands back to fit you.
    const grown = runtime.focus ? 1 : (runtime.player.drawnSize ?? 1)
    _target.set(p.x, p.y + LOOK_HEIGHT * grown, p.z)

    // Spherical -> cartesian. yaw 0 puts the camera south of the player, looking north.
    const { yaw, pitch } = runtime.camera
    const distance = runtime.camera.distance * (0.75 + 0.25 * grown)
    const horizontal = Math.cos(pitch) * distance
    _desired.set(
      _target.x + Math.sin(yaw) * horizontal,
      // Never under the floor you're on (the lobby's, or a room's far below it).
      Math.max(_target.y + Math.sin(pitch) * distance, p.y + 0.6),
      _target.z + Math.cos(yaw) * horizontal,
    )

    // Inside a room of the stages: kept off its walls.
    if (stage.level >= 0) keepInRoom(stage.level, _desired, _target)

    // Back from the stages the camera is far below; jump back rather than swoop.
    if (runtime.camera.snap) {
      runtime.camera.snap = false
      initialised.current = false
    }

    if (!initialised.current) {
      // Avoid a long swoop in from wherever the default camera started.
      camera.position.copy(_desired)
      _lookAt.copy(_target)
      initialised.current = true
    }

    camera.position.lerp(_desired, 1 - Math.exp(-POSITION_SMOOTHING * delta))
    _lookAt.lerp(_target, 1 - Math.exp(-LOOK_SMOOTHING * delta))
    // A slam (or a floor giving way): a jolt, settling fast - on top of the easing, so it's felt.
    if (stage.shake > 0.001) {
      const t = performance.now() * 0.07
      camera.position.add(_shake.set(Math.sin(t * 1.7), Math.sin(t * 2.3) * 1.4, Math.sin(t * 1.3)).multiplyScalar(stage.shake * SHAKE_SIZE))
      stage.shake *= Math.exp(-SHAKE_DECAY * delta)
    }
    camera.lookAt(_lookAt)
  })

  return null
}

export default FollowCamera
