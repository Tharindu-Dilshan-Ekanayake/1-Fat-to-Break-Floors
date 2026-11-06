import { formatNumber } from '@shared/format'
import { floorRect, floorTopY, padRect, roomFloorY, SPAWN } from '@shared/world'

import { sfx } from '../../audio/sfx'
import { actions } from '../../net/actions'
import { getGame } from '../../store/game'
import { flyCoins } from '../../ui/coinsFly'
import { fadeThrough, flashScreen } from '../../ui/fade'
import { iconUrl } from '../../ui/icons'
import { burst } from '../fx/fxQueue'
import { spawnPopup } from '../fx/popups'
import { runtime } from '../runtime'
import { MAX_STAGES, STAGE_COUNT, STAGES } from './course'

/** A predicted slam not echoed by the authority in this long was refused: stop counting it. */
const PREDICTION_MS = 1500
/** A pad claim is resent this often while you stand on it, until the authority sends you home. */
const CLAIM_EVERY_MS = 450
/** Back in the lobby: this long into the dance, the Wins start flying home. */
const FLY_HOME_MS = 550
/** "Eat food first!" no more often than this, standing on a floor with no Fat. */
const HUNGRY_EVERY_MS = 2600

const WIN = iconUrl('coin')
const DAMAGE_GRADIENT = 'linear-gradient(180deg, #ffffff 0%, #ffd0d0 40%, #ff4a3b 100%)'

/**
 * The stages, as this client sees them - read every frame by the player, the camera, the
 * stages' scene and the HUD (it's all plain data: nothing here re-renders anything).
 *
 * `level` is where you are: -1 in the lobby (yard and floor 0 included), i in room i,
 * exactly as the authority has it (it changes when the authority says a floor broke, or
 * sends you home). Floors' HP is drawn from what the authority last said, less the slams
 * we've landed since that it hasn't answered yet - so a slam shows at once.
 */
export const stage = {
  level: -1,
  /** Each floor's HP as the authority last told it, and the most it has. */
  hp: new Float64Array(MAX_STAGES),
  max: new Float64Array(MAX_STAGES),
  /** Slams we've landed and not heard back about: `{ stage, damage, at }`. */
  pending: [],
  /** Floors broken this dive (drawn as holes), and when (performance.now(), for the rubble). */
  broken: new Uint8Array(MAX_STAGES),
  brokenAt: new Float64Array(MAX_STAGES),
  /** Bumped whenever any floor's shown HP changes, so the HP sign knows to redraw. */
  version: 0,
  /** When the last slam landed, and how hard (0-1, for the camera's jolt and the crack's flash). */
  slamAt: 0,
  shake: 0,
  /** Wins a pad just paid, shown and flown home once we're back in the lobby. */
  wins: 0,
  /** When we last asked the pad to pay. */
  claimAt: 0,
  /** Being sent home: position reports are held until we're there (see connection.js). */
  returning: false,
  hungryAt: 0,
}

/** The floor ahead: the one you'd slam next (STAGE_COUNT once there's none left). */
export const targetFloor = () => stage.level + 1

/** Floor `i`'s HP as shown: the authority's word, less our unanswered slams on it. */
export function shownHp(i) {
  let hp = stage.hp[i]
  for (const p of stage.pending) if (p.stage === i) hp -= p.damage
  return Math.max(0, hp)
}

/**
 * Shockwave rings spreading over the floor - a slam's, a floor breaking, a pad paying: a
 * small ring buffer the stages' scene draws (`at` is performance.now(), 0 for none).
 */
export const WAVES = 6
export const waves = {
  next: 0,
  x: new Float32Array(WAVES),
  y: new Float32Array(WAVES),
  z: new Float32Array(WAVES),
  at: new Float64Array(WAVES),
  size: new Float32Array(WAVES),
  gold: new Uint8Array(WAVES),
}

/** Starts a shockwave ring at (x, y, z), `size` across to begin with; `gold` for the big moments. */
function addWave(x, y, z, size, gold = false) {
  const i = waves.next
  waves.next = (i + 1) % WAVES
  waves.x[i] = x
  waves.y[i] = y
  waves.z[i] = z
  waves.size[i] = size
  waves.gold[i] = gold ? 1 : 0
  waves.at[i] = performance.now()
}

/** Every floor whole again, nothing broken: a fresh dive, in the world you're in. */
export function resetDive() {
  stage.pending.length = 0
  for (let i = 0; i < MAX_STAGES; i += 1) {
    const hp = STAGES[i]?.hp ?? 0
    stage.hp[i] = hp
    stage.max[i] = hp
    stage.broken[i] = 0
    stage.brokenAt[i] = 0
  }
  stage.version += 1
}
resetDive()

/** Shows a banner. Deferred: reached from the frame loop, which must never update React state itself. */
const showBanner = (banner) => setTimeout(() => getGame().showPushBanner(banner), 0)

/** Standing on a floor with no Fat to slam it with: "Eat food first!" (now and then). From the frame loop. */
export function noteHungry() {
  const now = performance.now()
  if (now - stage.hungryAt < HUNGRY_EVERY_MS) return
  stage.hungryAt = now
  showBanner({ kind: 'hungry' })
  sfx.error()
}

/** Middle of floor `i`'s slab top, for effects: written into `out`. */
function floorMiddle(i, out) {
  const r = floorRect(i)
  out.x = (r.minX + r.maxX) / 2
  out.y = floorTopY(i)
  out.z = (r.minZ + r.maxZ) / 2
  return out
}
const _at = { x: 0, y: 0, z: 0 }

/**
 * Your belly hit the floor ahead at `at`: tell the authority, knock your Fat off its
 * shown HP at once, and make it felt - a thump, dust and chips off the floor, the
 * damage popping up, the camera jolting. Called from the player's frame loop.
 */
export function slamImpact(at) {
  const i = targetFloor()
  if (i >= STAGE_COUNT) return
  const fat = getGame().profile.fat
  const now = performance.now()
  if (!(fat > 0)) {
    noteHungry()
    return
  }
  actions.slam(Math.round(at.x * 100) / 100, Math.round(at.z * 100) / 100)
  // Old predictions the authority never answered were refused: forget them.
  while (stage.pending.length && now - stage.pending[0].at > PREDICTION_MS) stage.pending.shift()
  stage.pending.push({ stage: i, damage: fat, at: now })
  stage.version += 1
  stage.slamAt = now
  const left = shownHp(i)
  const max = Math.max(1, stage.max[i])
  stage.shake = Math.min(1, 0.55 + 0.45 * Math.min(1, fat / max))
  addWave(at.x, floorTopY(i) + 0.07, at.z, 0.9 + 0.8 * Math.min(1, fat / max))
  burst({ x: at.x, y: floorTopY(i) + 0.3, z: at.z, count: 16, palette: 'dust', speed: 6 })
  burst({ x: at.x, y: floorTopY(i) + 0.3, z: at.z, count: 10, palette: 'rubble', speed: 8 })
  spawnPopup(`-${formatNumber(fat)}`, { x: at.x, y: at.y + 2.6, z: at.z }, { gradient: DAMAGE_GRADIENT, scale: 1.25, life: 900 })
  sfx.slam(Math.min(1, getGame().profile.fat / max), left <= 0)
}

/** The authority's word on floor `stage`'s HP (a slam it took, or it healing back up). */
export function onSlam({ stage: i, hp, max, damage }) {
  if (!(i >= 0 && i < MAX_STAGES)) return
  stage.hp[i] = hp
  stage.max[i] = max
  if (damage > 0) {
    // That's one of ours answered: the oldest still waiting on this floor.
    const k = stage.pending.findIndex((p) => p.stage === i)
    if (k >= 0) stage.pending.splice(k, 1)
  } else {
    // Healed (we walked off it): nothing of ours on it counts any more.
    stage.pending = stage.pending.filter((p) => p.stage !== i)
  }
  stage.version += 1
}

/** Floor `i` broke under you: you're in its room now, falling. */
export function onFloorBreak({ stage: i }) {
  if (!(i >= 0 && i < MAX_STAGES)) return
  stage.hp[i] = 0
  stage.pending = stage.pending.filter((p) => p.stage !== i)
  stage.broken[i] = 1
  stage.brokenAt[i] = performance.now()
  stage.level = i
  stage.shake = 1
  stage.version += 1
  const mid = floorMiddle(i, _at)
  addWave(runtime.player.position.x, mid.y + 0.1, runtime.player.position.z, 2.4, true)
  flashScreen()
  burst({ x: runtime.player.position.x, y: mid.y + 0.4, z: runtime.player.position.z, count: 40, palette: 'dust', speed: 11 })
  burst({ x: runtime.player.position.x, y: mid.y + 0.4, z: runtime.player.position.z, count: 26, palette: 'rubble', speed: 12 })
  sfx.floorBreak()
  const game = getGame()
  game.showPushBanner({ kind: 'floor', stage: i, last: i === STAGE_COUNT - 1 })
  game.setClimb('stage')
}

/**
 * Standing on the WINS pad of the room you're in: ask it to pay (again every so often,
 * in case the authority hadn't seen us on it yet). Called from the player's frame loop.
 */
export function claimPad(at) {
  if (stage.level < 0 || stage.returning) return
  const now = performance.now()
  if (now - stage.claimAt < CLAIM_EVERY_MS) return
  stage.claimAt = now
  actions.claimWins(Math.round(at.x * 100) / 100, Math.round(at.z * 100) / 100)
}

/** A WINS pad paid out: a shower of gold now; the Wins fly home once we're back in the lobby. */
export function onWins({ stage: i, wins, last }) {
  stage.wins = wins
  const game = getGame()
  // The counter holds at what you had: the payout flies home to it from the lobby.
  game.holdCoins(game.profile.coins)
  const p = runtime.player.position
  // A cheer, a golden ring off the pad, and a shower of gold.
  runtime.player.happyAt = performance.now()
  addWave(p.x, p.y + 0.12, p.z, 2, true)
  burst({ x: p.x, y: p.y + 1.5, z: p.z, count: 50, palette: 'gold', speed: 10 })
  burst({ x: p.x, y: p.y + 1.2, z: p.z, count: 30, palette: 'confetti', speed: 8 })
  sfx.trophy()
  sfx.coins()
  game.showPushBanner({ kind: 'wins', stage: i, wins, last })
}

/**
 * The authority sent us back to the lobby (a pad paid, or we left): fade through white
 * to the spot in front of the gate, every floor whole again - dancing, with the Wins
 * flying home, if a pad paid. Position reports wait until we're there.
 */
export function onTeleport({ x, z, yaw = 0, reason }) {
  stage.returning = true
  const wins = reason === 'wins' ? stage.wins : 0
  stage.wins = 0
  runtime.player.frozen = true
  fadeThrough(() => {
    arriveAt(x, z, yaw, wins)
    stage.returning = false
  })
}

/** In the lobby at (x, z), facing `yaw`: dancing and the Wins flying home, given `wins`. */
function arriveAt(x, z, yaw, wins) {
  stage.level = -1
  stage.shake = 0
  resetDive()
  const player = runtime.player
  player.position.set(x, 0, z)
  player.yaw = yaw
  player.frozen = false
  player.danceAt = wins > 0 ? performance.now() : 0
  runtime.camera.yaw = yaw + Math.PI
  runtime.camera.snap = true
  const game = getGame()
  game.setClimb(null)
  game.showPushBanner(null)
  if (wins > 0) {
    burst({ x, y: 1.4, z, count: 60, palette: 'confetti', speed: 8 })
    spawnPopup(`+${formatNumber(wins)} WINS!`, { x, y: 2.6, z }, { iconUrl: WIN, scale: 1.6, life: 2200 })
    setTimeout(() => flyCoins(wins), FLY_HOME_MS)
  } else game.showCoins()
  // Whatever happens to the flight, the counter shows your real Wins again in the end.
  setTimeout(() => getGame().showCoins(), 12000)
}

/** Back to the lobby from down in the stages (the Lobby button): the authority sends us. */
export function leaveStages() {
  if (stage.level < 0 || stage.returning) return
  actions.leaveStage()
}

/**
 * Boxity's "Reset Character": straight back. Down in the stages, that's the lobby; in
 * the lobby, the spawn point.
 */
export function resetCharacter() {
  if (stage.level >= 0) {
    leaveStages()
    return
  }
  actions.respawn()
  resetDive()
  runtime.player.position.set(SPAWN.x, 0, SPAWN.z)
  runtime.player.yaw = SPAWN.yaw
}

/** A fresh connection (or a new world): out of the stages, every floor whole. */
export function leaveStagesQuietly() {
  stage.level = -1
  stage.returning = false
  resetDive()
  getGame().setClimb(null)
}

/** Whether (x, z) is on room `level`'s WINS pad: for the player's frame loop. */
export function onPadNow(level, x, z) {
  if (level < 0) return false
  const r = padRect(level)
  return x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ
}

/** Height of room `level`'s floor, for things standing in it. */
export const levelFloor = (level) => (level < 0 ? 0 : roomFloorY(level))
