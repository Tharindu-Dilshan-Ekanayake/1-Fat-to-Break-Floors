import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three'

import { formatNumber } from '@shared/format'
import { mulberry32 } from '@shared/rng'
import { FLOOR_LEN, floorRect, floorTopY, padRect, roomFloorY, STAGE_HALF_W } from '@shared/world'

import { getQuality } from '../../store/quality'
import { BlockSet, createBoxInstances, createToyInstances, disposeBlocks, PropBuilder } from '../blocks'
import { burst } from '../fx/fxQueue'
import { runtime } from '../runtime'
import { LabelBatch } from '../labels/LabelBatch'
import { sharedMaterials, STYLE } from '../materials'
import { MAX_STAGES, STAGE_COUNT, STAGES } from './course'
import { buildRoom, roomLabelSpots, shade, themeOf } from './rooms'
import { shownHp, stage, WAVES, waves } from './stageControl'

/** How often the room builder runs (between frames, never inside them), and how many rooms are kept. */
const BUILD_INTERVAL_MS = 60
const CACHE_LIMIT = 5
/** The HP sign is redrawn at most this often. */
const SIGN_MS = 70
/** Rubble off a broken floor: how many chunks, how long they lie about, gravity. */
const RUBBLE = 44
const RUBBLE_LIFE = 3.2
const GRAVITY = 26
/** No rubble this close round you when a floor breaks under you. */
const RUBBLE_CLEAR = 3.4
/**
 * A slam on the floor ahead: how long the floor dips under it (and the HP sign jolts),
 * and how far. A shockwave ring spreads for WAVE_MS, to WAVE_GROW times its size.
 */
const HIT_MS = 220
const HIT_DIP = 0.14
const WAVE_MS = 480
const WAVE_GROW = 5.5
const WAVE_WHITE = new Color('#fff4fb')
const WAVE_GOLD = new Color('#ffd23f')
/** The trophies circling over the WINS pad of the room you're in, and how often it sparkles. */
const PAD_TROPHIES = 3
const SPARKLE_MS = 650
const GOLD = '#ffd21f'

const FONT = '"Fredoka One", "Arial Rounded MT Bold", sans-serif'
const TEXT = {
  white: ['#ffffff', '#ffffff', '#dfe7f0'],
  gold: ['#fffaa8', '#ffd52a', '#ff9c00'],
  pink: ['#ffe6f6', '#ff9cd6', '#ff3fa8'],
}

const _m = new Matrix4()
const _q = new Quaternion()
const _p = new Vector3()
const _s = new Vector3()
const _axis = new Vector3(1, 0.4, 0.2).normalize()
const _up = new Vector3(0, 1, 0)
const _color = new Color()
/** Lying flat on the floor (a ring geometry stands up facing +z). */
const _flat = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2)

/** A little gold trophy, for circling over a WINS pad: base, stem, cup, rim and handles. */
function trophyGeometry() {
  const p = new PropBuilder()
  p.box(0, 0.09, 0, 0.7, 0.18, 0.7, '#c98a12', STYLE.SMOOTH)
  p.box(0, 0.4, 0, 0.18, 0.45, 0.18, GOLD, STYLE.SMOOTH)
  p.box(0, 0.9, 0, 0.8, 0.55, 0.8, GOLD, STYLE.GLOW, [0, 0.785, 0])
  p.box(0, 1.22, 0, 0.92, 0.1, 0.92, '#fff1a0', STYLE.GLOW, [0, 0.785, 0])
  for (const side of [-1, 1]) p.box(side * 0.55, 0.95, 0, 0.14, 0.4, 0.14, GOLD, STYLE.SMOOTH)
  return p.build()
}

/** Rooms built, by index: one stage set at a time (module-level, like the chunks they were). */
const roomCache = new Map()
/** The rooms the frame loop wants; the builder makes it so. */
const roomWindow = { first: 0, last: 0, detail: true }

/** Draws floor HP onto the sign's canvas: "HP / MAX" and a bar, green to red as it drops. */
function drawSign(ctx, hp, max) {
  const { width: w, height: h } = ctx.canvas
  ctx.clearRect(0, 0, w, h)
  const frac = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0
  ctx.lineJoin = 'round'
  // The numbers.
  ctx.font = `${Math.round(h * 0.42)}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const text = `${formatNumber(Math.ceil(hp))}/${formatNumber(max)}`
  ctx.lineWidth = h * 0.09
  ctx.strokeStyle = '#141418'
  ctx.strokeText(text, w / 2, h * 0.3)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(text, w / 2, h * 0.3)
  // The bar: a dark tray, and the fill.
  const bx = w * 0.08
  const by = h * 0.62
  const bw = w * 0.84
  const bh = h * 0.24
  const r = bh / 2
  const round = (x, y, rw, rh, rr) => {
    ctx.beginPath()
    ctx.moveTo(x + rr, y)
    ctx.arcTo(x + rw, y, x + rw, y + rh, rr)
    ctx.arcTo(x + rw, y + rh, x, y + rh, rr)
    ctx.arcTo(x, y + rh, x, y, rr)
    ctx.arcTo(x, y, x + rw, y, rr)
    ctx.closePath()
  }
  round(bx - 6, by - 6, bw + 12, bh + 12, r + 6)
  ctx.fillStyle = '#141418'
  ctx.fill()
  if (frac > 0) {
    round(bx, by, Math.max(bh, bw * frac), bh, r)
    ctx.fillStyle = frac > 0.5 ? '#3cf25a' : frac > 0.22 ? '#ffd21f' : '#ff4a3b'
    ctx.fill()
    // A shine along its top.
    round(bx + 6, by + 4, Math.max(bh - 12, bw * frac - 12), bh * 0.3, r * 0.3)
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.fill()
  }
}

/** Dark cracks spreading from the middle and in from the edges: drawn once, faded in by damage. */
function drawCracks(ctx) {
  const { width: w, height: h } = ctx.canvas
  ctx.clearRect(0, 0, w, h)
  const rand = mulberry32(7)
  ctx.strokeStyle = 'rgba(20,16,14,0.85)'
  ctx.lineCap = 'round'
  const crack = (x, y, angle, length, width, depth) => {
    let cx = x
    let cy = y
    let a = angle
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    const steps = 6
    for (let k = 0; k < steps; k += 1) {
      a += (rand() - 0.5) * 0.9
      cx += Math.cos(a) * (length / steps)
      cy += Math.sin(a) * (length / steps)
      ctx.lineTo(cx, cy)
      if (depth > 0 && rand() < 0.35) crack(cx, cy, a + (rand() < 0.5 ? -0.9 : 0.9), length * 0.45, width * 0.6, depth - 1)
    }
    ctx.stroke()
  }
  for (let k = 0; k < 9; k += 1) crack(w / 2, h / 2, (k / 9) * Math.PI * 2 + rand() * 0.4, w * (0.28 + rand() * 0.18), 7, 2)
  for (let k = 0; k < 6; k += 1) crack(rand() * w, rand() < 0.5 ? 0 : h, rand() * Math.PI * 2, w * 0.18, 5, 1)
}

/**
 * Lazily loaded: the stages of the world you're in, under the gate. Every floor's slab
 * (the next one ahead with its HP painted on it, cracking as it goes), the rooms near you,
 * their WINS pads' and next floors' signs, and the rubble when a floor breaks. Mounted
 * afresh for each world (see GameScene).
 */
export default function Stages() {
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const rootRef = useRef(null)
  const roomsRef = useRef(null)
  const labelsRef = useRef(null)
  const slabsRef = useRef(null)
  const signRef = useRef(null)
  const cracksRef = useRef(null)
  const rubbleRef = useRef(null)
  const wavesRef = useRef(null)
  const trophiesRef = useRef(null)
  const seen = useRef({ version: -1, level: -2, breaks: new Float64Array(MAX_STAGES), dip: 0, sparkleAt: 0 })
  /** The rubble's chunks: where each is, how it moves, how long it's been about. */
  const chunksRef = useRef(null)
  if (chunksRef.current === null) {
    chunksRef.current = Array.from({ length: RUBBLE }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, spin: 0, turn: 0, size: 0, age: RUBBLE_LIFE, floor: 0 }))
  }

  const assets = useMemo(() => {
    const material = sharedMaterials().blocks
    // Every floor's slab, one instance each, in its own stage's floor.
    const set = new BlockSet()
    for (let i = 0; i < MAX_STAGES; i += 1) {
      const theme = themeOf(Math.min(i, STAGE_COUNT - 1))
      set.add(0, 0, 0, 1, 1, 1, theme.floor, theme.floorStyle ?? STYLE.TILES)
    }
    const slabs = set.build(material)
    slabs.matrixAutoUpdate = true
    slabs.frustumCulled = false

    // The HP sign on the floor ahead.
    const signCanvas = document.createElement('canvas')
    const signSize = Math.min(512, getQuality().maxTexture)
    signCanvas.width = signSize
    signCanvas.height = signSize / 2
    const signTexture = new CanvasTexture(signCanvas)
    signTexture.colorSpace = SRGBColorSpace
    const sign = new Mesh(
      new PlaneGeometry(STAGE_HALF_W * 1.5, STAGE_HALF_W * 0.75),
      new MeshBasicMaterial({ map: signTexture, transparent: true, depthWrite: false, fog: false, toneMapped: false }),
    )
    sign.rotation.x = -Math.PI / 2
    sign.renderOrder = 3
    sign.visible = false

    // The cracks, the same size as a floor.
    const crackCanvas = document.createElement('canvas')
    crackCanvas.width = signSize
    crackCanvas.height = Math.round((signSize * FLOOR_LEN) / (STAGE_HALF_W * 2))
    drawCracks(crackCanvas.getContext('2d'))
    const crackTexture = new CanvasTexture(crackCanvas)
    crackTexture.colorSpace = SRGBColorSpace
    const cracks = new Mesh(
      new PlaneGeometry(STAGE_HALF_W * 2 - 0.2, FLOOR_LEN - 0.2),
      new MeshBasicMaterial({ map: crackTexture, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
    )
    cracks.rotation.x = -Math.PI / 2
    cracks.renderOrder = 2
    cracks.visible = false

    // Rubble: a pool of chunks, reused for every floor that breaks.
    const rubble = createBoxInstances(RUBBLE, material, STYLE.STUDS)
    rubble.count = RUBBLE
    for (let k = 0; k < RUBBLE; k += 1) rubble.setMatrixAt(k, _m.makeScale(0, 0, 0))
    rubble.instanceMatrix.needsUpdate = true

    // Shockwave rings, one instance each (and one more: the WINS pad's pulsing ring),
    // added up over what's under them; faded by darkening their colour.
    const ring = new RingGeometry(0.82, 1, 40)
    const wavesMesh = new InstancedMesh(ring, new MeshBasicMaterial({ transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, toneMapped: false, fog: false }), WAVES + 1)
    for (let k = 0; k <= WAVES; k += 1) {
      wavesMesh.setMatrixAt(k, _m.makeScale(0, 0, 0))
      wavesMesh.setColorAt(k, _color.set('#000000'))
    }
    wavesMesh.frustumCulled = false
    wavesMesh.renderOrder = 4

    // The trophies circling over the WINS pad.
    const trophies = createToyInstances(trophyGeometry(), material, PAD_TROPHIES)

    return { slabs, sign, signCanvas, signTexture, cracks, crackTexture, rubble, waves: wavesMesh, trophies }
  }, [])

  // Shaders compiled in the background before the stages show, so the first slam doesn't stall.
  useEffect(() => {
    const root = rootRef.current
    if (!root || import.meta.env.DEV) return undefined
    let cancelled = false
    root.visible = false
    gl.compileAsync(root, camera, scene)
      .catch(() => null)
      .finally(() => {
        if (!cancelled) root.visible = true
      })
    return () => {
      cancelled = true
    }
  }, [gl, camera, scene])

  // Every room's signs: its WINS pad's payout, and the stage the next floor leads into;
  // and floor 0's, in the yard. One small label batch.
  useEffect(() => {
    const batch = new LabelBatch({ pageSize: Math.min(512, getQuality().maxTexture) })
    const first = floorRect(0)
    batch.add('stage-0', [0, 7.4, (first.minZ + first.maxZ) / 2], {
      lines: [
        { text: 'STAGE 1', size: 74, gradient: themeOf(0).name ?? TEXT.gold },
        { text: STAGES[0].name, size: 46, fill: '#ffffff' },
        { text: 'Stand on it to SLAM!', size: 34, gradient: TEXT.gold },
      ],
      pxPerUnit: 40,
    }, { fade: 120 })
    for (let i = 0; i < STAGE_COUNT; i += 1) {
      const spots = roomLabelSpots(i)
      const last = i === STAGE_COUNT - 1
      batch.add(`pad-${i}`, spots.pad, {
        lines: [
          { text: last ? 'ROCK BOTTOM!' : 'WINS PAD', size: 44, gradient: last ? TEXT.pink : TEXT.white },
          { text: `+${formatNumber(STAGES[i].wins)}`, size: 70, icon: 'coin', gradient: TEXT.gold },
          { text: 'Step on to RETURN', size: 30, fill: '#ffffff' },
        ],
        pxPerUnit: 52,
      }, { fade: 60, near: 3 })
      if (!last) {
        batch.add(`next-${i}`, spots.next, {
          lines: [
            { text: `STAGE ${i + 2}`, size: 70, gradient: themeOf(i + 1).name ?? TEXT.gold },
            { text: STAGES[i + 1].name, size: 44, fill: '#ffffff' },
          ],
          pxPerUnit: 44,
        }, { fade: 70, near: 4 })
      }
    }
    let cancelled = false
    batch.build().then((meshes) => {
      if (cancelled || !labelsRef.current) return
      for (const mesh of meshes) labelsRef.current.add(mesh)
    })
    return () => {
      cancelled = true
      batch.dispose()
    }
  }, [])

  // Streams rooms in and out between frames: one build per pass.
  useEffect(() => {
    const group = roomsRef.current
    const id = setInterval(() => {
      if (!group) return
      const want = roomWindow
      for (let i = want.first; i <= want.last; i += 1) {
        if (roomCache.has(i)) continue
        const mesh = buildRoom(i, { detail: want.detail }).build(sharedMaterials().blocks)
        roomCache.set(i, mesh)
        group.add(mesh)
        break
      }
      if (roomCache.size <= CACHE_LIMIT) return
      for (const [i, mesh] of roomCache) {
        if (i >= want.first && i <= want.last) continue
        group.remove(mesh)
        disposeBlocks(mesh)
        roomCache.delete(i)
      }
    }, BUILD_INTERVAL_MS)
    return () => {
      clearInterval(id)
      for (const mesh of roomCache.values()) disposeBlocks(mesh)
      roomCache.clear()
    }
  }, [])

  // The HP sign, redrawn (off the frame loop) whenever the floor ahead's HP changes.
  useEffect(() => {
    const ctx = assets.signCanvas.getContext('2d')
    let shown = ''
    const id = setInterval(() => {
      const i = stage.level + 1
      if (i >= STAGE_COUNT) return
      const hp = shownHp(i)
      const key = `${i}:${Math.ceil(hp)}:${stage.max[i]}`
      if (key === shown) return
      shown = key
      drawSign(ctx, hp, stage.max[i])
      assets.signTexture.needsUpdate = true
    }, SIGN_MS)
    return () => clearInterval(id)
  }, [assets])

  useEffect(
    () => () => {
      disposeBlocks(assets.slabs)
      disposeBlocks(assets.rubble)
      assets.waves.geometry.dispose()
      assets.waves.material.dispose()
      assets.waves.dispose()
      assets.trophies.geometry.dispose()
      assets.trophies.dispose()
      for (const mesh of [assets.sign, assets.cracks]) {
        mesh.geometry.dispose()
        mesh.material.dispose()
      }
      assets.signTexture.dispose()
      assets.crackTexture.dispose()
    },
    [assets],
  )

  useFrame((_state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const level = stage.level
    const ahead = level + 1
    const s = seen.current
    const slabs = slabsRef.current
    const sign = signRef.current
    const cracks = cracksRef.current
    const rubble = rubbleRef.current
    const chunks = chunksRef.current
    const ringsMesh = wavesRef.current
    const trophyMesh = trophiesRef.current
    if (!slabs || !sign || !cracks || !rubble || !ringsMesh || !trophyMesh) return
    const now = performance.now()

    // --- Rooms: the one you're in, the one above (through the hole) and the one below.
    roomWindow.first = Math.max(0, level - 1)
    roomWindow.last = Math.min(STAGE_COUNT - 1, level + 1)
    roomWindow.detail = getQuality().decorDensity >= 0.75
    for (const [i, mesh] of roomCache) mesh.visible = i >= roomWindow.first && i <= roomWindow.last

    // --- Slabs: whole floors near you; broken ones gone.
    if (s.version !== stage.version || s.level !== level) {
      s.level = level
      for (let i = 0; i < MAX_STAGES; i += 1) {
        const show = i < STAGE_COUNT && !stage.broken[i] && i >= level && i <= level + 2
        if (show) {
          const r = floorRect(i)
          _p.set(0, floorTopY(i) - 0.5, (r.minZ + r.maxZ) / 2)
          _s.set(STAGE_HALF_W * 2, 1, FLOOR_LEN)
        } else _s.set(0, 0, 0)
        slabs.setMatrixAt(i, _m.compose(_p, _q.identity(), _s))
      }
      slabs.instanceMatrix.needsUpdate = true
      // The sign and the cracks sit on the floor ahead.
      const live = ahead < STAGE_COUNT && !stage.broken[ahead]
      sign.visible = live
      cracks.visible = live
      if (live) {
        const r = floorRect(ahead)
        const z = (r.minZ + r.maxZ) / 2
        sign.position.set(0, floorTopY(ahead) + 0.05, z + 0.4)
        cracks.position.set(0, floorTopY(ahead) + 0.025, z)
      }
    }
    if (cracks.visible) {
      const max = stage.max[ahead] || 1
      const damage = 1 - shownHp(ahead) / max
      // Cracks spread with the damage, and flash a little darker on each slam.
      const flash = Math.max(0, 1 - (performance.now() - stage.slamAt) / 220)
      cracks.material.opacity = Math.min(1, damage ** 0.8 * 0.95 + flash * 0.25 * (damage > 0 ? 1 : 0))
    }
    s.version = stage.version

    // --- A slam on the floor ahead: it dips under you and springs back, the HP sign
    // jolts and swells. (Only while it's happening: one instance moved.)
    const hit = now - stage.slamAt
    const dip = ahead < STAGE_COUNT && !stage.broken[ahead] && hit < HIT_MS ? Math.sin((Math.PI * hit) / HIT_MS) : 0
    if (dip !== s.dip) {
      s.dip = dip
      if (ahead < STAGE_COUNT && !stage.broken[ahead]) {
        const r = floorRect(ahead)
        const z = (r.minZ + r.maxZ) / 2
        _p.set(0, floorTopY(ahead) - 0.5 - HIT_DIP * dip, z)
        _s.set(STAGE_HALF_W * 2, 1, FLOOR_LEN)
        slabs.setMatrixAt(ahead, _m.compose(_p, _q.identity(), _s))
        slabs.instanceMatrix.needsUpdate = true
        sign.position.set(Math.sin(hit * 0.09) * 0.25 * dip, floorTopY(ahead) + 0.05 - HIT_DIP * dip, z + 0.4)
        sign.scale.setScalar(1 + 0.12 * dip)
        cracks.position.y = floorTopY(ahead) + 0.025 - HIT_DIP * dip
      }
    }

    // --- Shockwave rings spreading over the floor, and the WINS pad's pulsing ring.
    let active = 0
    for (let k = 0; k < WAVES; k += 1) {
      const t = waves.at[k] > 0 ? (now - waves.at[k]) / WAVE_MS : 1
      if (t >= 1) {
        ringsMesh.setMatrixAt(k, _m.makeScale(0, 0, 0))
        continue
      }
      active += 1
      const grow = waves.size[k] * (1 + WAVE_GROW * (1 - (1 - t) ** 2))
      _p.set(waves.x[k], waves.y[k], waves.z[k])
      _s.set(grow, grow, grow)
      ringsMesh.setMatrixAt(k, _m.compose(_p, _flat, _s))
      ringsMesh.setColorAt(k, _color.copy(waves.gold[k] ? WAVE_GOLD : WAVE_WHITE).multiplyScalar((1 - t) ** 1.5))
    }
    const inRoom = level >= 0
    if (inRoom) {
      const pad = padRect(level)
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.005)
      _p.set((pad.minX + pad.maxX) / 2, roomFloorY(level) + 0.12, (pad.minZ + pad.maxZ) / 2)
      _s.setScalar(2.6 + 0.5 * pulse)
      ringsMesh.setMatrixAt(WAVES, _m.compose(_p, _flat, _s))
      ringsMesh.setColorAt(WAVES, _color.copy(WAVE_GOLD).multiplyScalar(0.35 + 0.35 * pulse))
      active += 1
    } else ringsMesh.setMatrixAt(WAVES, _m.makeScale(0, 0, 0))
    ringsMesh.count = active > 0 ? WAVES + 1 : 0
    if (active > 0) {
      ringsMesh.instanceMatrix.needsUpdate = true
      if (ringsMesh.instanceColor) ringsMesh.instanceColor.needsUpdate = true
    }

    // --- Trophies circling over the WINS pad of the room you're in, bobbing and turning,
    // and gold sparkling up off it now and then.
    if (inRoom) {
      const pad = padRect(level)
      const cx = (pad.minX + pad.maxX) / 2
      const cz = (pad.minZ + pad.maxZ) / 2
      const base = roomFloorY(level) + 2.3
      const turn = now * 0.0012
      for (let k = 0; k < PAD_TROPHIES; k += 1) {
        const a = turn + (k * Math.PI * 2) / PAD_TROPHIES
        _p.set(cx + Math.cos(a) * 1.7, base + Math.sin(now * 0.003 + k * 2) * 0.25, cz + Math.sin(a) * 1.7)
        _q.setFromAxisAngle(_up, -a * 2.5)
        _s.setScalar(0.9)
        trophyMesh.setMatrixAt(k, _m.compose(_p, _q, _s))
      }
      trophyMesh.count = PAD_TROPHIES
      trophyMesh.instanceMatrix.needsUpdate = true
      if (now - (s.sparkleAt ?? 0) > SPARKLE_MS) {
        s.sparkleAt = now
        burst({ x: cx, y: roomFloorY(level) + 0.6, z: cz, count: 6, palette: 'gold', speed: 3.5 })
      }
    } else trophyMesh.count = 0

    // --- Rubble: a floor just broke - its pieces fall into the room under it.
    for (let i = 0; i < STAGE_COUNT; i += 1) {
      if (stage.brokenAt[i] <= s.breaks[i]) continue
      s.breaks[i] = stage.brokenAt[i]
      const r = floorRect(i)
      const theme = themeOf(i)
      const rand = mulberry32(i * 31 + 5)
      const me = runtime.player.position
      for (let k = 0; k < RUBBLE; k += 1) {
        const c = chunks[k]
        c.x = r.minX + 0.8 + rand() * (r.maxX - r.minX - 1.6)
        c.z = r.minZ + 0.8 + rand() * (r.maxZ - r.minZ - 1.6)
        // None in a bubble round you (you're falling with them: they'd fill the camera),
        // and all flung out away from you and down, faster than you fall.
        const dx = c.x - me.x
        const dz = c.z - me.z
        const d = Math.hypot(dx, dz) || 1
        if (d < RUBBLE_CLEAR) {
          c.x = me.x + (dx / d) * RUBBLE_CLEAR
          c.z = me.z + (dz / d) * RUBBLE_CLEAR
        }
        c.y = floorTopY(i) - 0.4
        c.vx = (dx / d) * (2 + rand() * 3)
        c.vz = (dz / d) * (2 + rand() * 3)
        c.vy = -5 - rand() * 5
        c.spin = (rand() - 0.5) * 10
        c.turn = rand() * 6
        c.size = 0.45 + rand() * 0.85
        c.age = rand() * -0.25
        c.floor = roomFloorY(i)
        rubble.setColorAt(k, _color.copy(k % 3 === 0 ? shade(theme.floor, -0.25) : k % 3 === 1 ? shade(theme.floor, 0.1) : shade(theme.wall, 0)))
      }
      if (rubble.instanceColor) rubble.instanceColor.needsUpdate = true
    }
    let moving = false
    for (let k = 0; k < RUBBLE; k += 1) {
      const c = chunks[k]
      if (c.age >= RUBBLE_LIFE) continue
      moving = true
      c.age += delta
      if (c.age < 0) continue
      c.vy -= GRAVITY * delta
      c.x += c.vx * delta
      c.y += c.vy * delta
      c.z += c.vz * delta
      c.turn += c.spin * delta
      const rest = c.floor + c.size * 0.5
      if (c.y < rest) {
        // Land with a bounce, skid, settle.
        c.y = rest
        c.vy = Math.abs(c.vy) > 2 ? -c.vy * 0.25 : 0
        c.vx *= 0.6
        c.vz *= 0.6
        c.spin *= 0.5
      }
      const shrink = c.age > RUBBLE_LIFE - 0.6 ? Math.max(0, (RUBBLE_LIFE - c.age) / 0.6) : 1
      _p.set(c.x, c.y, c.z)
      _q.setFromAxisAngle(_axis, c.turn)
      _s.setScalar(c.size * shrink)
      rubble.setMatrixAt(k, _m.compose(_p, _q, _s))
      if (c.age >= RUBBLE_LIFE) rubble.setMatrixAt(k, _m.makeScale(0, 0, 0))
    }
    if (moving) rubble.instanceMatrix.needsUpdate = true
  })

  return (
    <group ref={rootRef}>
      <group ref={roomsRef} />
      <primitive ref={slabsRef} object={assets.slabs} />
      <primitive ref={cracksRef} object={assets.cracks} />
      <primitive ref={signRef} object={assets.sign} />
      <primitive ref={rubbleRef} object={assets.rubble} />
      <primitive ref={wavesRef} object={assets.waves} />
      <primitive ref={trophiesRef} object={assets.trophies} />
      <group ref={labelsRef} />
    </group>
  )
}
