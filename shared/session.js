import {
  EGGS,
  ITEMS,
  BITE_BURST,
  MAX_BITES_PER_SECOND,
  MULTI_HATCH,
  SHOP,
  SLAM_BURST,
  SLAM_INTERVAL,
  TRAIN_INTERVAL,
  TRAIN_ZONES,
  WORLD_PORTALS,
} from './balance.js'
import {
  advanceTutorial,
  applyBite,
  applyRebirth,
  applyTrain,
  awardBadge,
  buyFood,
  buyFatPack,
  buyShopItem,
  claimDaily,
  claimFreeReward,
  claimPlaytime,
  createSession,
  deletePet,
  equipAura,
  equipBestPets,
  equipFood,
  equipPet,
  hatchEgg,
  isMaxLevel,
  isZoneUnlocked,
  padWins,
  skipRebirth,
  slamDamage,
  stagesOf,
  unequipPet,
  usePotion,
  worldUnlocked,
} from './logic.js'
import {
  atFoodCounter,
  benchAt,
  eggStandNear,
  floorTopY,
  FREE_REWARD,
  inYard,
  onFloor,
  onPad,
  portalAt,
  roomFloorY,
  STAGE_RETURN,
} from './world.js'

/** A seated player's reported position may wander this far off the chair (lag). */
const SEAT_SLACK = 0.5
/** Food is bought at the Food Shop's counter; allow for a little lag. */
const COUNTER_SLACK = 2
/** A slam or a pad claim says where it happened: it must be this close to where we last had the player. */
const CLAIM_NEAR = 3.5
/** How far off a floor or pad's edge a slam or claim may be (lag, and your belly's size). */
const FLOOR_SLACK = 1.2
const PAD_SLACK = 1
/** How far above a floor's top a slam may come from (you're mid-jump when you report). */
const SLAM_HEIGHT = 5

/**
 * One player's authoritative session: validates intents, runs the training-pad tick and
 * reports what happened through `emit`.
 *
 * Transport-agnostic on purpose. The Colyseus room wraps one of these per client; the
 * offline mode wraps one for the local player. Either way the rules that run are
 * byte-for-byte the same.
 *
 * THE STAGES. `level` is where the player is: -1 in the lobby (the yard and floor 0
 * too), i in room i. Standing on the floor ahead (floor `level + 1`) they slam it: every
 * slam knocks their Fat off its HP, and at 0 it breaks and they're in the room under it.
 * There the WINS pad pays and sends them home; or they walk on and slam the next floor.
 * Floors' HP is per dive: back in the lobby, every floor is whole again.
 *
 * Events emitted (type, payload):
 * - 'profile'    { profile, session }  full state, after anything structural
 * - 'train'      { source, zone, gain, fat, eaten, level, leveledUp, maxed }  each Fat
 *                  gain; `source` is 'bite' (a click) or 'zone' (sat at training pad
 *                  `zone`). Walking earns nothing.
 * - 'slam'       { stage, hp, max, damage }  floor `stage` was slammed (or, with damage 0,
 *                  healed back up): its HP left
 * - 'floorBreak' { stage }  floor `stage` broke: you're in its room now
 * - 'wins'       { stage, wins, last }  a WINS pad paid out
 * - 'teleport'   { x, z, yaw, reason }  put back in the lobby ('wins', 'left')
 * - 'pack'       { amount }  a Fat pack landed
 * - 'hatch'      { eggId, pets: [{ uid, id }] }  pets to reveal
 * - 'badge'      { id, name }
 * - 'world'      { world }  through a portal
 *
 * `onLevel(level)` lets the host tell other players which level someone is on;
 * `onTeleport(x, z)` moves them there on the host's side.
 */
export class PlayerSession {
  /**
   * @param {object} profile normalized profile (see logic.normalizeProfile)
   * @param {{ now: number, emit: (type: string, payload?: object) => void,
   *           getPosition: () => {x: number, y: number, z: number},
   *           onPurchase?: (productId: string) => boolean,
   *           onLevel?: (level: number) => void,
   *           onTeleport?: (x: number, z: number) => void }} options
   *   `onPurchase` lets the host veto or count a shop sale (stock limits).
   */
  constructor(profile, { now, emit, getPosition, onPurchase, onLevel, onTeleport }) {
    this.profile = profile
    this.session = createSession(now)
    this.emit = emit
    this.getPosition = getPosition
    this.onPurchase = onPurchase
    this.onLevel = onLevel
    this.onTeleport = onTeleport

    /** Training pad the client says it's sat at; verified against position every tick. */
    this.zone = -1
    this.trainTimer = 0
    /** Where in the stages: -1 the lobby, i room i. */
    this.level = -1
    /** This dive: each floor's HP left (missing = whole), and when it began. Null in the lobby, before any slam. */
    this.dive = null
    /** Wins earned (pads) not yet counted towards a leaderboard. */
    this.coinsEarned = 0
    /** Bites banked (a token bucket refilling at MAX_BITES_PER_SECOND), and when last refilled. */
    this.biteTokens = BITE_BURST
    this.biteRefilledAt = now
    /** Slams banked, the same way (one per SLAM_INTERVAL). */
    this.slamTokens = SLAM_BURST
    this.slamRefilledAt = now
    this.dirty = false
  }

  // --- Plumbing --------------------------------------------------------------------

  sendProfile() {
    this.dirty = false
    this.emit('profile', { profile: this.profile, session: this.session })
  }

  badge(id) {
    const badge = awardBadge(this.profile, id)
    if (badge) {
      this.dirty = true
      this.emit('badge', badge)
    }
  }

  tutorial(event) {
    if (advanceTutorial(this.profile, event)) this.dirty = true
  }

  /**
   * Where a slam or a pad claim says it happened, if that's believable - near where we
   * last had the player - else null. (Their own report is fresher than our last
   * position update; their position updates keep it honest.)
   */
  claimedAt({ x, z }) {
    const p = this.getPosition()
    const cx = Number(x)
    const cz = Number(z)
    if (!Number.isFinite(cx) || !Number.isFinite(cz)) return { x: p.x, y: p.y, z: p.z }
    if (Math.hypot(cx - p.x, cz - p.z) > CLAIM_NEAR) return null
    return { x: cx, y: p.y, z: cz }
  }

  // --- Intents ---------------------------------------------------------------------

  /** Dispatches one client message. Unknown types are ignored. */
  handle(type, payload = {}, now) {
    const handler = this.handlers[type]
    if (!handler) return
    handler.call(this, payload || {}, now)
    if (this.dirty) this.sendProfile()
  }

  handlers = {
    enterZone({ zone }) {
      const index = Number(zone)
      if (!Number.isInteger(index) || !TRAIN_ZONES[index]) return
      if (!isZoneUnlocked(this.profile, index) || this.level >= 0) return
      if (this.zone !== index) {
        this.zone = index
        // The first bite comes a beat after sitting down, not instantly.
        this.trainTimer = TRAIN_INTERVAL * 0.5
      }
    },

    leaveZone() {
      this.zone = -1
    },

    /** One click: a bite of your food, worth more sat at a training pad. Anywhere, even down in the stages. */
    eat(_payload, now) {
      this.biteTokens = Math.min(BITE_BURST, this.biteTokens + ((now - this.biteRefilledAt) / 1000) * MAX_BITES_PER_SECOND)
      this.biteRefilledAt = now
      if (this.biteTokens < 1) return
      this.biteTokens -= 1
      const zone = this.onClaimedZone() ? this.zone : -1
      this.gain('bite', zone, applyBite(this.profile, zone, now))
      this.tutorial('eat')
    },

    setting({ key, value }) {
      if (key !== 'autoRebirth') return
      this.profile.settings.autoRebirth = Boolean(value)
      this.dirty = true
    },

    rebirth() {
      const result = applyRebirth(this.profile)
      if (result.ok) this.afterRebirth()
    },

    skipRebirth() {
      const result = skipRebirth(this.profile)
      if (result.ok) this.afterRebirth()
    },

    /**
     * A slam, landing on the floor ahead (floor `level + 1`) at (x, z): knocks your Fat
     * off its HP - one per SLAM_INTERVAL at most - and at 0 HP breaks it, and you're in
     * the room under it. No Fat, no slam.
     */
    slam(payload, now) {
      const set = stagesOf(this.profile)
      const target = this.level + 1
      if (target >= set.count) return
      const p = this.claimedAt(payload)
      if (!p || !onFloor(target, p.x, p.z, FLOOR_SLACK)) return
      const top = floorTopY(target)
      if (p.y < top - 1.5 || p.y > top + SLAM_HEIGHT) return
      const damage = slamDamage(this.profile)
      if (!(damage > 0)) return
      this.slamTokens = Math.min(SLAM_BURST, this.slamTokens + (now - this.slamRefilledAt) / 1000 / SLAM_INTERVAL)
      this.slamRefilledAt = now
      if (this.slamTokens < 1) return
      this.slamTokens -= 1

      if (!this.dive) this.dive = { world: this.profile.world, hp: [], startedAt: now }
      const max = set.stages[target].hp
      const hp = Math.max(0, (this.dive.hp[target] ?? max) - damage)
      this.dive.hp[target] = hp
      this.zone = -1
      this.emit('slam', { stage: target, hp, max, damage })
      if (hp > 0) return

      // Broken through: you're in its room.
      this.level = target
      const stats = this.profile.stats
      stats.floors += 1
      stats.bestFloor = Math.max(stats.bestFloor, target + 1)
      if (target === 0) stats.runs += 1
      this.dirty = true
      this.emit('floorBreak', { stage: target })
      this.onLevel?.(this.level)
      this.tutorial('floor')
      if (target === 0) this.badge('firstRun')
      this.badge('firstTape')
    },

    /** Stepping onto the WINS pad of the room you're in, at (x, z): it pays, and home you go. */
    claimWins(payload, now) {
      if (this.level < 0) return
      const p = this.claimedAt(payload)
      if (!p || !onPad(this.level, p.x, p.z, PAD_SLACK)) return
      if (Math.abs(p.y - roomFloorY(this.level)) > 3) return
      const set = stagesOf(this.profile)
      const stage = this.level
      const wins = padWins(this.profile, stage, now)
      const last = stage === set.count - 1
      this.profile.coins += wins
      this.coinsEarned += wins
      this.dirty = true
      this.emit('wins', { stage, wins, last })
      this.tutorial('wins')
      if (last) {
        this.profile.stats.tops += 1
        this.badge('top')
      }
      this.returnToLobby('wins')
    },

    /** Back to the lobby from the stages, with nothing (the Lobby button, or Reset Character). */
    leaveStage() {
      if (this.level < 0) return
      this.returnToLobby('left')
    },

    buyFood({ id }) {
      if (!this.atCounter()) return
      const result = buyFood(this.profile, id)
      if (!result.ok) return
      this.dirty = true
      if (result.bought) this.tutorial('buyFood')
    },

    equipFood({ id }) {
      const result = equipFood(this.profile, id)
      if (result.ok) this.dirty = true
    },

    equipAura({ id }) {
      if (equipAura(this.profile, id ?? null).ok) this.dirty = true
    },

    buyPack({ index }) {
      const result = buyFatPack(this.profile, Number(index))
      if (!result.ok) return
      this.dirty = true
      this.emit('pack', { amount: result.amount })
    },

    hatch({ eggId, count }) {
      const egg = EGGS[eggId]
      if (!egg) return
      const p = this.getPosition()
      if (eggStandNear(p.x, p.z)?.eggId !== eggId) return
      const n = count === MULTI_HATCH ? MULTI_HATCH : 1
      this.reveal(hatchEgg(this.profile, eggId, n))
    },

    openEggItem({ itemId }) {
      const item = ITEMS[itemId]
      if (!item || item.kind !== 'egg') return
      this.reveal(hatchEgg(this.profile, item.egg, 1, { paid: 'item' }))
    },

    equipPet({ uid }) {
      if (equipPet(this.profile, Number(uid)).ok) this.dirty = true
    },

    unequipPet({ uid }) {
      unequipPet(this.profile, Number(uid))
      this.dirty = true
    },

    equipBest() {
      equipBestPets(this.profile)
      this.dirty = true
    },

    deletePet({ uid }) {
      if (deletePet(this.profile, Number(uid)).ok) this.dirty = true
    },

    claimDaily({ day }, now) {
      const result = claimDaily(this.profile, Number(day), now)
      this.afterReward(result)
    },

    claimPlaytime({ index }, now) {
      const result = claimPlaytime(this.profile, this.session, Number(index), now)
      this.afterReward(result)
    },

    claimFreeReward() {
      const p = this.getPosition()
      if (this.level >= 0 || Math.hypot(p.x - FREE_REWARD.x, p.z - FREE_REWARD.z) > FREE_REWARD.radius + 1.5) return
      const result = claimFreeReward(this.profile, this.session)
      this.afterReward(result)
    },

    /**
     * Stepping through a world portal: to its world (the first time, with its Wins), or,
     * from that world, back to World 1. Only from the lobby.
     */
    portal() {
      if (this.level >= 0) return
      const p = this.getPosition()
      const portal = portalAt(p.x, p.z, 2)
      if (!portal) return
      const there = WORLD_PORTALS[portal.id].world
      const to = this.profile.world === there ? 0 : there
      if (!worldUnlocked(this.profile, to)) return
      if (to === there) this.badge(portal.id)
      this.profile.world = to
      this.dive = null
      this.dirty = true
      this.emit('world', { world: to })
    },

    usePotion({ itemId }, now) {
      const result = usePotion(this.profile, itemId, now)
      if (!result.ok) return
      this.dirty = true
    },

    /** Buys a SHOP item with Wins. */
    purchase({ productId }) {
      const item = SHOP[productId]
      if (!item) return
      // Checked before the host takes stock, so a short wallet never uses up a Sphinx.
      if (this.profile.coins < item.price) return
      if (item.kind === 'pass' && this.profile.passes[productId]) return
      if (this.onPurchase && !this.onPurchase(productId)) return
      const result = buyShopItem(this.profile, productId)
      if (!result.ok) return
      this.dirty = true
      this.reveal(result)
    },
  }

  afterReward(result) {
    if (!result?.ok) return
    this.dirty = true
    if (result.pets?.length) this.reveal(result)
  }

  /** Sends newly gained pets to the client's hatch animation. */
  reveal(result) {
    if (!result?.ok || !result.pets?.length) return
    this.dirty = true
    this.emit('hatch', { eggId: result.eggId ?? null, pets: result.pets })
    this.tutorial('hatch')
    this.badge('firstPet')
  }

  afterRebirth() {
    this.dirty = true
    this.tutorial('rebirth')
    if (this.profile.rebirths === 1) this.badge('firstRebirth')
  }

  /** Out of the stages, back in front of the gate; every floor is whole again. */
  returnToLobby(reason) {
    this.level = -1
    this.dive = null
    this.zone = -1
    this.dirty = true
    this.onLevel?.(-1)
    this.onTeleport?.(STAGE_RETURN.x, STAGE_RETURN.z)
    this.emit('teleport', { x: STAGE_RETURN.x, z: STAGE_RETURN.z, yaw: STAGE_RETURN.yaw, reason })
  }

  /** Back to the very start (Boxity's Reset Character, a reconnect): out of the stages, nothing paid. */
  resetPlace() {
    this.level = -1
    this.dive = null
    this.zone = -1
    this.onLevel?.(-1)
  }

  // --- Simulation ------------------------------------------------------------------

  /** Whether the player is at (or right by) the Food Shop's counter. */
  atCounter() {
    const p = this.getPosition()
    return this.level < 0 && atFoodCounter(p.x, p.z, COUNTER_SLACK)
  }

  /** Whether the player is really sat at a chair of the training pad they claim. */
  onClaimedZone() {
    if (this.zone < 0 || this.level >= 0) return false
    const p = this.getPosition()
    return benchAt(p.x, p.z, SEAT_SLACK) === this.zone
  }

  /** Advances training-pad eating. Call at a steady rate (the room's simulation interval). */
  tick(dt, now) {
    if (this.zone >= 0 && this.onClaimedZone()) {
      this.trainTimer += dt
      while (this.trainTimer >= TRAIN_INTERVAL) {
        this.trainTimer -= TRAIN_INTERVAL
        this.trainOnce(now)
      }
    } else {
      this.trainTimer = Math.min(this.trainTimer, TRAIN_INTERVAL * 0.5)
    }
    // Walked away from floor 0 without breaking it: it's whole again.
    if (this.level < 0 && this.dive) {
      const p = this.getPosition()
      if (!inYard(p.x, p.z, 1.5)) {
        const max = stagesOf(this.profile).stages[0].hp
        this.dive = null
        this.emit('slam', { stage: 0, hp: max, max, damage: 0 })
      }
    }
    this.profile.stats.playtime += dt
    if (this.dirty) this.sendProfile()
  }

  /** Tells the client about a Fat gain from `source` ('bite' or 'zone'). */
  gain(source, zone, result) {
    if (result.gain > 0) {
      this.emit('train', {
        source,
        zone,
        gain: result.gain,
        fat: this.profile.fat,
        eaten: this.profile.eaten,
        level: this.profile.level,
        leveledUp: result.leveledUp,
        maxed: result.maxed,
      })
    }
    if (this.profile.settings.autoRebirth && isMaxLevel(this.profile)) {
      const rebirth = applyRebirth(this.profile)
      if (rebirth.ok) this.afterRebirth()
    }
  }

  trainOnce(now) {
    const result = applyTrain(this.profile, this.zone, now)
    if (!result.ok) {
      this.zone = -1
      return
    }
    this.gain('zone', this.zone, result)
    this.tutorial('eat')
  }
}
