import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  Quaternion,
  Triangle,
  Vector3,
} from 'three'

import { mulberry32 } from '@shared/rng'

import { useGame } from '../store/game'
import { useQuality } from '../store/quality'
import { CLOUDS, FOG, LIGHTS, SKY } from './sceneStyle'
import { skyUniforms } from './skyState'
import { WORLD_SKIES } from './stage/themes'
import { useAfterPlayable } from './useAfterPlayable'

/** Unit dome, scaled to just inside the camera's far plane for the current preset. */
const SKY_RADIUS = 1

/** Centre of the cloud field: the middle of the track. */
const CLOUD_CENTER = [0, 0, -80]
/** Radians per second the whole cloud field turns about its centre. */
const CLOUD_DRIFT = 0.004
/** The clouds' tint by world: cotton candy in Candy Kingdom; dusky violet in World 2's night sky. */
const CLOUD_TINTS = ['#ffffff', '#5b4c9c']
/** How many stars World 2's night sky has, and how far out they sit. */
const STAR_COUNT = 500
const STAR_RADIUS = 140

const skyVertexShader = /* glsl */ `
  varying vec3 vDirection;

  void main() {
    vDirection = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const skyFragmentShader = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  uniform float exponent;

  varying vec3 vDirection;

  void main() {
    float h = normalize(vDirection).y;
    // Below the horizon stays horizon-coloured, matching the fog on distant ground.
    vec3 color = mix(horizonColor, topColor, pow(max(h, 0.0), exponent));
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`

/**
 * Vertical gradient dome. Follows the camera so the horizon always sits at eye level
 * and the dome can never be walked out of.
 */
function SkyDome() {
  const ref = useRef(null)
  const camera = useThree((s) => s.camera)
  const radius = useQuality((s) => s.settings.viewDistance) * 0.9
  const uniforms = skyUniforms

  useFrame(() => {
    ref.current?.position.copy(camera.position)
  })

  return (
    <mesh ref={ref} renderOrder={-1} frustumCulled={false} scale={radius}>
      <sphereGeometry args={[SKY_RADIUS, 24, 12]} />
      <shaderMaterial
        side={BackSide}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={skyVertexShader}
        fragmentShader={skyFragmentShader}
      />
    </mesh>
  )
}

/**
 * A faceted puff with its shading baked into vertex colours: white where a face points
 * up or towards the sun, blue-grey underneath.
 *
 * Baked rather than lit so the clouds stay bright white regardless of the scene lights,
 * and the flat per-face colour gives the low-poly look.
 */
function createPuffGeometry() {
  const geometry = new IcosahedronGeometry(1, 1)
  const position = geometry.getAttribute('position')
  const colors = new Float32Array(position.count * 3)

  const top = new Color(CLOUDS.top)
  const bottom = new Color(CLOUDS.bottom)
  const sun = new Vector3(...LIGHTS.sunDirection).normalize()
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()
  const faceNormal = new Vector3()
  const faceColor = new Color()

  // IcosahedronGeometry is non-indexed: every 3 vertices are one face.
  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i)
    b.fromBufferAttribute(position, i + 1)
    c.fromBufferAttribute(position, i + 2)
    Triangle.getNormal(a, b, c, faceNormal)
    // Every vertex lies on the unit sphere, so the vertex itself points outward.
    if (faceNormal.dot(a) < 0) faceNormal.negate()

    const up = faceNormal.y * 0.5 + 0.5
    const lit = Math.max(faceNormal.dot(sun), 0) * 0.35
    faceColor.copy(bottom).lerp(top, Math.min(1, up * 0.85 + lit))

    for (let v = 0; v < 3; v += 1) {
      colors[(i + v) * 3] = faceColor.r
      colors[(i + v) * 3 + 1] = faceColor.g
      colors[(i + v) * 3 + 2] = faceColor.b
    }
  }

  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  return geometry
}

/**
 * Each cloud is a row of overlapping, slightly flattened puffs with one more on top.
 *
 * Kept fairly low and large: the follow camera looks slightly down, so only clouds
 * low in the sky ever reach the top of the screen. The lowest cloud bottom still sits
 * above the highest the camera can orbit.
 */
function buildCloudLayout(count) {
  const rand = mulberry32(7)
  const clouds = []

  for (let i = 0; i < count; i += 1) {
    const size = 7 + rand() * 6
    const puffCount = 3 + Math.floor(rand() * 3)
    const puffs = []

    for (let p = 0; p < puffCount; p += 1) {
      // Bigger in the middle, tapering to the ends.
      const along = (p - (puffCount - 1) / 2) * size * 0.9
      const taper = 1 - Math.abs(along) / (size * puffCount * 0.6)
      const s = size * (0.75 + rand() * 0.35) * taper
      puffs.push({
        position: [along, (rand() - 0.3) * size * 0.4, (rand() - 0.5) * size * 0.6],
        scale: [s, s * 0.75, s * 0.85],
      })
    }
    // The billow on top that makes it read as a cumulus rather than a sausage.
    puffs.push({
      position: [(rand() - 0.5) * size, size * 0.55, 0],
      scale: [size * 0.8, size * 0.65, size * 0.7],
    })

    clouds.push({
      position: [(rand() * 2 - 1) * 240, 50 + rand() * 18, (rand() * 2 - 1) * 280],
      rotationY: rand() * Math.PI,
      puffs,
    })
  }

  return clouds
}

/**
 * Every puff of every cloud in one InstancedMesh: a single draw call for the whole
 * sky, where one mesh per puff cost ~100.
 */
function Clouds() {
  // Not needed to start playing: drifted in once the game's up (see useAfterPlayable).
  const settled = useAfterPlayable()
  const count = useQuality((s) => s.settings.cloudCount) * (settled ? 1 : 0)
  const world = useGame((s) => s.profile.world)

  const mesh = useMemo(() => {
    const layout = buildCloudLayout(count)
    const puffs = []
    const cloudQuat = new Quaternion()
    const yAxis = new Vector3(0, 1, 0)
    for (const cloud of layout) {
      cloudQuat.setFromAxisAngle(yAxis, cloud.rotationY)
      for (const puff of cloud.puffs) {
        const local = new Vector3(...puff.position).applyQuaternion(cloudQuat)
        puffs.push({
          position: local.add(new Vector3(...cloud.position)),
          quaternion: cloudQuat.clone(),
          scale: new Vector3(...puff.scale),
        })
      }
    }

    // fog off: the clouds sit past the fog's far distance and would vanish.
    const instanced = new InstancedMesh(
      createPuffGeometry(),
      new MeshBasicMaterial({ vertexColors: true, fog: false }),
      puffs.length,
    )
    const matrix = new Matrix4()
    puffs.forEach((p, i) => instanced.setMatrixAt(i, matrix.compose(p.position, p.quaternion, p.scale)))
    instanced.instanceMatrix.needsUpdate = true
    instanced.computeBoundingSphere()
    instanced.position.set(...CLOUD_CENTER)
    return instanced
  }, [count])

  useEffect(
    () => () => {
      mesh.geometry.dispose()
      mesh.material.dispose()
      mesh.dispose()
    },
    [mesh],
  )

  // Tinted, not rebuilt: the vertex colours' shading stays, darkened for the night.
  useEffect(() => {
    mesh.material.color.set(CLOUD_TINTS[world] ?? CLOUD_TINTS[0])
  }, [mesh, world])

  const ref = useRef(null)
  useFrame((_state, delta) => {
    if (ref.current) ref.current.rotation.y += delta * CLOUD_DRIFT
  })

  return <primitive ref={ref} object={mesh} />
}

/**
 * Each world's sky: Candy Kingdom's lavender fading to pink (sceneStyle's SKY), or World
 * 2's night (WORLD_SKIES) - the dome's colours, the fog's and the clear colour, set when
 * the world changes - and, in a sky with stars, a field of them round the camera (presets
 * with particles only).
 */
function WorldSky() {
  const world = useGame((s) => s.profile.world)
  const particles = useQuality((s) => s.settings.particles)
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const ref = useRef(null)
  const look = WORLD_SKIES[world]

  const stars = useMemo(() => {
    const rand = mulberry32(99)
    const positions = new Float32Array(STAR_COUNT * 3)
    const p = new Vector3()
    for (let i = 0; i < STAR_COUNT; i += 1) {
      p.set(rand() * 2 - 1, rand() * 1.2 - 0.1, rand() * 2 - 1).normalize().multiplyScalar(STAR_RADIUS)
      positions.set([p.x, p.y, p.z], i * 3)
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    const points = new Points(geometry, new PointsMaterial({ color: '#ffffff', size: 2, sizeAttenuation: false, fog: false, depthWrite: false }))
    points.frustumCulled = false
    return points
  }, [])

  useEffect(
    () => () => {
      stars.geometry.dispose()
      stars.material.dispose()
    },
    [stars],
  )

  useEffect(() => {
    const top = look ? look.sky[0] : SKY.top
    const horizon = look ? look.sky[1] : SKY.horizon
    skyUniforms.topColor.value.set(top)
    skyUniforms.horizonColor.value.set(horizon)
    if (scene.fog) scene.fog.color.set(look ? horizon : FOG.color)
    gl.setClearColor(horizon)
  }, [look, scene, gl])

  const showStars = Boolean(look?.stars) && particles
  useFrame(() => {
    if (showStars && ref.current) ref.current.position.copy(camera.position)
  })

  return <primitive ref={ref} object={stars} visible={showStars} />
}

/** Gradient sky plus drifting low-poly clouds (and stars, at night). */
export function Sky() {
  return (
    <>
      <SkyDome />
      <WorldSky />
      <Clouds />
    </>
  )
}

export default Sky
