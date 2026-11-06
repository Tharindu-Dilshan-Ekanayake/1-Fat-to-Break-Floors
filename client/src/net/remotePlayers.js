import { Vector3 } from 'three'

import { WORLD } from '../game/stage/course'
import { runtime } from '../game/runtime'

/**
 * Other players, as the network last described them. Network callbacks write here;
 * the renderer reads it each frame and interpolates between snapshots, drawing
 * everyone ~110 ms in the past so 10 Hz updates still move smoothly.
 */

/** sessionId -> remote player */
export const remotePlayers = new Map()

const MAX_SNAPSHOTS = 24

export function upsertRemotePlayer(sessionId, state) {
  let r = remotePlayers.get(sessionId)
  if (!r) {
    r = {
      sessionId,
      name: '',
      snaps: [],
      position: new Vector3(state.x, state.y, state.z),
      yaw: state.rotY,
      speed: 0,
      anim: 'idle',
      foodId: 'wood',
      aura: '',
      /** Their avatar's outfit, parsed from `look`; `lookKey` is the raw string. */
      look: null,
      lookKey: '',
      petIds: [],
      /** Follow state per equipped pet, grown as needed and reused. */
      pets: [],
      walkPhase: 0,
      /** Where in the stages they are: -1 in the lobby, i in room i (of their world's stages). */
      stage: -1,
      /** Their Fat, and when it last went up (they're eating: curl). */
      fat: state.fat || 0,
      ateAt: 0,
      /** Where they're drawn. */
      shownAt: new Vector3(state.x, state.y, state.z),
    }
    r.shadow = { position: r.shownAt, size: 1.1, visible: true }
    runtime.shadowCasters.add(r.shadow)
    remotePlayers.set(sessionId, r)
  }
  r.name = state.name
  /** Their Boxity account id ('' for a guest of ours): what chat bubbles find them by. */
  r.uid = state.uid || ''
  r.anim = state.anim
  // A Boxity emote: played from when we heard of it.
  if ((state.emote || '') !== (r.emote || '')) {
    r.emote = state.emote || ''
    r.emoteStart = performance.now()
  }
  r.foodId = state.foodId || 'wood'
  r.aura = state.aura || ''
  if (state.fat > r.fat) r.ateAt = performance.now()
  r.fat = state.fat
  r.world = state.world || 0
  r.stage = Number.isFinite(state.stage) ? state.stage : -1
  // Down in another world's stages: not in ours (they're only in the lobby's plaza).
  r.elsewhere = r.stage >= 0 && r.world !== WORLD
  if (state.look !== r.lookKey) {
    r.lookKey = state.look
    try {
      r.look = state.look ? JSON.parse(state.look) : null
    } catch {
      r.look = null
    }
  }
  r.petIds = [...state.petIds]
  while (r.pets.length < r.petIds.length) {
    r.pets.push({ id: '', position: r.position.clone(), yaw: 0, hop: 0 })
  }
  const last = r.snaps[r.snaps.length - 1]
  if (!last || last.x !== state.x || last.y !== state.y || last.z !== state.z || last.r !== state.rotY) {
    r.snaps.push({ t: performance.now(), x: state.x, y: state.y, z: state.z, r: state.rotY })
    if (r.snaps.length > MAX_SNAPSHOTS) r.snaps.shift()
  }
}

/**
 * Whether another player is where you can see them: in your world's lobby or stages, and
 * on your level of them - within a room's height of you (the rooms are closed boxes, one
 * under the next, so anyone further up or down is behind a floor or a ceiling).
 */
export const sharesLevel = (r) => !r.elsewhere && Math.abs(r.position.y - runtime.player.position.y) < 9

export function removeRemotePlayer(sessionId) {
  const r = remotePlayers.get(sessionId)
  if (!r) return
  runtime.shadowCasters.delete(r.shadow)
  remotePlayers.delete(sessionId)
}

export function clearRemotePlayers() {
  for (const id of [...remotePlayers.keys()]) removeRemotePlayer(id)
  runtime.remotePets.length = 0
}
