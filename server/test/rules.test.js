import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  AURAS,
  FOODS,
  EGGS,
  levelCap,
  fatForLevel,
  rebirthMultiplier,
  SHOP,
  SLAM_INTERVAL,
  SLAMS_PER_FLOOR,
  TRAIN_ZONES,
  TUTORIAL,
  walkSpeed,
  WORLD_PORTALS,
  WORLDS,
} from '../../shared/balance.js'
import { formatNumber } from '../../shared/format.js'
import {
  applyBite,
  applyRebirth,
  applyTrain,
  buyFood,
  buyFatPack,
  buyShopItem,
  createProfile,
  dailyStatus,
  hatchEgg,
  levelFor,
  levelXp,
  fatPacks,
  normalizeProfile,
  padWins,
  skipRebirth,
  slamsToBreak,
  STAGE_SETS,
  coinsMultiplier,
} from '../../shared/logic.js'
import { PlayerSession } from '../../shared/session.js'
import {
  benchAt,
  benchSeat,
  clampToLevel,
  EGG_STANDS,
  floorRect,
  floorTopY,
  FOOD_COUNTER,
  FOOD_HUT,
  GATE_Z,
  groundAt,
  LEADERBOARDS,
  padHeight,
  padRect,
  PORTALS,
  roomFloorY,
  roomRect,
  SEATS,
  SPAWN,
  STAGE_RETURN,
  STATIC_COLLIDERS,
  STATUE,
  WALKWAY,
  YARD,
  zoneCenter,
  ZONE_COUNT,
  zoneDeckRect,
} from '../../shared/world.js'

/** Sat on a chair of training pad `i`. */
const onBench = (i) => ({ ...benchSeat(i, zoneCenter(i).x, zoneCenter(i).z), y: padHeight(i) })
/** The middle of floor `i`, `up` over its top. */
const onFloorAt = (i, up = 0) => {
  const r = floorRect(i)
  return { x: (r.minX + r.maxX) / 2, y: floorTopY(i) + up, z: (r.minZ + r.maxZ) / 2 }
}
/** The middle of room `i`'s WINS pad. */
const onPadAt = (i) => {
  const r = padRect(i)
  return { x: (r.minX + r.maxX) / 2, y: roomFloorY(i), z: (r.minZ + r.maxZ) / 2 }
}

/** A session for `profile` with its events collected, standing at `pos`. */
function sessionAt(pos, profile = createProfile('a', 'A')) {
  const events = []
  const s = new PlayerSession(profile, { now: 0, emit: (type, payload) => events.push({ type, payload }), getPosition: () => pos })
  return { s, events, p: profile, of: (type) => events.filter((e) => e.type === type) }
}

/** Slams the floor ahead from `pos` once a slam-interval apart, from time `t0`, until it breaks (or `max` slams). Returns the time. */
function slamThrough(s, pos, t0 = 0, max = 400) {
  const target = s.level + 1
  let t = t0
  for (let i = 0; i < max && s.level < target; i += 1) {
    t += SLAM_INTERVAL * 1000 + 10
    s.handle('slam', { x: pos.x, z: pos.z }, t)
  }
  return t
}

test('numbers format like the HUD', () => {
  assert.deepEqual(
    [0, 999, 1000, 1234, 7300, 14000, 2.5e6, 9999].map(formatNumber),
    ['0', '999', '1K', '1.2K', '7.3K', '14K', '2.5M', '9.9K'],
  )
})

test('levels come from the Fat eaten: 15, 19, 23, 29, 36... each', () => {
  assert.deepEqual([2, 3, 4, 5].map(fatForLevel), [15, 34, 57, 86])
  const p = createProfile('a', 'A')
  p.eaten = fatForLevel(4) + 25
  p.fat = 3
  p.level = levelFor(p.eaten, 0)
  assert.equal(p.level, 4, 'what you ate, not what you carry')
  assert.deepEqual(levelXp(p), { have: 25, need: fatForLevel(5) - fatForLevel(4) })
})

test('rebirth is at level 5, then 10, 20, 30, with +0.5x per rebirth', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(levelCap), [5, 10, 20, 30, 40])
  assert.deepEqual([0, 1, 2, 3].map(rebirthMultiplier), [1, 1.5, 2, 2.5])
  assert.equal(levelFor(1e9, 0), 5, 'never past the cap')
})

test('Fat keeps piling on at max level; only the level stops', () => {
  const p = createProfile('a', 'A')
  for (let i = 0; i < 1000; i += 1) applyBite(p, -1, 0)
  assert.equal(p.fat, 1000)
  assert.equal(p.eaten, 1000)
  assert.equal(p.level, levelCap(0))
  assert.equal(p.stats.bestFat, 1000)
})

test('foods, training pads and rebirths multiply bites', () => {
  const p = createProfile('a', 'A')
  applyBite(p, -1, 0)
  assert.equal(p.fat, 1)
  p.ownedFoods.push('fries', 'donut')
  p.equippedFood = 'donut'
  applyBite(p, -1, 0)
  assert.equal(p.fat, 1 + 3)
  p.rebirths = 1
  applyTrain(p, 1, 0)
  assert.equal(p.fat, 1 + 3 + 3 * 2 * 1.5)
})

test('locked training pads give nothing', () => {
  const p = createProfile('a', 'A')
  assert.equal(applyTrain(p, 1, 0).ok, false)
  assert.equal(p.fat, 0)
})

test('rebirth needs max level, resets Fat and what you ate, keeps Wins and foods', () => {
  const p = createProfile('a', 'A')
  assert.equal(applyRebirth(p).ok, false)
  p.ownedFoods.push('fries')
  for (let i = 0; i < 400; i += 1) applyBite(p, -1, 0)
  p.coins = 50
  assert.equal(applyRebirth(p).ok, true)
  assert.equal(p.rebirths, 1)
  assert.equal(p.fat, 0)
  assert.equal(p.eaten, 0)
  assert.equal(p.level, 1)
  assert.equal(p.coins, 50)
  assert.deepEqual(p.ownedFoods, ['cookie', 'fries'])
})

test('skipping to a rebirth costs Wins', () => {
  const p = createProfile('a', 'A')
  assert.equal(skipRebirth(p).ok, false)
  p.coins = 1e9
  assert.equal(skipRebirth(p).ok, true)
  assert.equal(p.rebirths, 1)
  assert.ok(p.coins < 1e9)
})

test('every floor takes its own HP to break, a slam of your Fat at a time', () => {
  const [w1] = STAGE_SETS
  assert.deepEqual(w1.stages.slice(0, 3).map((st) => st.hp), [80, 800, 2000])
  assert.equal(slamsToBreak(80, 20), 4)
  assert.equal(slamsToBreak(80, 80), 1)
  assert.equal(slamsToBreak(80, 0), Infinity)
  // What a dive on some Fat gets you in good time: every floor it breaks in four slams or fewer.
  assert.equal(w1.reachFor(19), 0)
  assert.equal(w1.reachFor(20), 1)
  assert.equal(w1.reachFor(500), 3, '80, 800 and 2000 - not 4000')
  assert.equal(w1.runWins(19), 0)
  assert.equal(w1.runWins(20), w1.stages[0].wins)
  assert.equal(w1.reachFor(1e15), w1.count)
})

test('the first dive pays enough for the first food, as the guide asks', () => {
  assert.ok(STAGE_SETS[0].runWins(TUTORIAL[0].fat) >= FOODS[1].cost)
  assert.deepEqual(
    TUTORIAL.map((step) => step.event),
    ['eat', 'floor', 'wins', 'buyFood'],
    'eat, break the first floor, claim its pad, buy a food - and that is all',
  )
})

test('the guide: eat at the table, break the first floor, claim the pad, buy a food, done', () => {
  const p = createProfile('a', 'A')
  const pos = onBench(0)
  const { s } = sessionAt(pos, p)
  s.handle('enterZone', { zone: 0 }, 0)
  for (let t = 0; s.profile.fat < TUTORIAL[0].fat && t < 200; t += 1) s.tick(1, t * 1000)
  assert.equal(p.tutorialStep, 1, 'fat enough for the first floor')
  s.handle('leaveZone', {}, 0)
  Object.assign(pos, onFloorAt(0, 1))
  let t = slamThrough(s, pos, 300000)
  assert.equal(s.level, 0, 'through the floor')
  assert.equal(p.tutorialStep, 2)
  Object.assign(pos, onPadAt(0))
  s.handle('claimWins', pos, (t += 1000))
  assert.equal(p.tutorialStep, 3, 'claimed the pad')
  assert.ok(p.coins >= FOODS[1].cost)
  Object.assign(pos, { x: FOOD_COUNTER.x, y: 0, z: FOOD_COUNTER.z })
  s.handle('buyFood', { id: FOODS[1].id }, t + 2000)
  assert.equal(p.tutorialStep, TUTORIAL.length, 'and the guide is over')
})

test('the guide skips a step already done out of order', () => {
  const p = createProfile('a', 'A')
  p.fat = 25
  const pos = onFloorAt(0)
  const { s } = sessionAt(pos, p)
  slamThrough(s, pos)
  assert.equal(p.tutorialStep, 2, 'slammed without eating at a table: on to the pad')
})

test('foods are bought in order with Wins', () => {
  const p = createProfile('a', 'A')
  p.coins = 1000
  assert.equal(buyFood(p, FOODS[3].id).ok, false)
  assert.equal(buyFood(p, FOODS[1].id).ok, true)
  assert.equal(p.coins, 1000 - FOODS[1].cost)
  assert.equal(p.equippedFood, FOODS[1].id)
})

test('Fat packs scale with your level', () => {
  const p = createProfile('a', 'A')
  const early = fatPacks(p)
  assert.equal(early.length, 3)
  p.fat = 300
  p.eaten = 300
  p.level = levelFor(p.eaten, 0)
  const later = fatPacks(p)
  assert.ok(later[0].amount > early[0].amount)
  p.coins = later[2].price
  assert.equal(buyFatPack(p, 2).ok, true)
  assert.equal(p.fat, 300 + later[2].amount)
  assert.equal(p.coins, 0)
})

test('egg odds add up to 100% and hatching charges Wins', () => {
  for (const [id, egg] of Object.entries(EGGS)) {
    assert.equal(egg.pets.reduce((s, [, w]) => s + w, 0), 100, id)
  }
  const p = createProfile('a', 'A')
  p.coins = EGGS.basic.cost.coins
  const r = hatchEgg(p, 'basic', 1, { rand: () => 0 })
  assert.equal(r.ok, true)
  assert.equal(p.coins, 0)
  assert.equal(p.pets[0].id, 'cat')
  assert.deepEqual(p.equippedPets, [p.pets[0].uid])
})

test('daily rewards unlock one per day', () => {
  const p = createProfile('a', 'A')
  const states = dailyStatus(p, 0).map((d) => d.state)
  assert.deepEqual(states.slice(0, 3), ['ready', 'next', 'locked'])
})

test('corrupt or old saves load safely', () => {
  const p = normalizeProfile({ pets: [{ uid: 1, id: 'nope' }], equippedPets: [1], ownedFoods: ['nope'], fat: 'x', equippedAura: 'water' }, 'x', 'X')
  assert.deepEqual(p.pets, [])
  assert.deepEqual(p.equippedPets, [])
  assert.deepEqual(p.ownedFoods, ['cookie'])
  assert.equal(p.fat, 0)
  assert.equal(p.eaten, 0)
  assert.equal(p.equippedAura, null, 'an aura you never bought')
  // A save without `eaten` counts the Fat it carries as eaten.
  assert.equal(normalizeProfile({ fat: 40 }, 'y', 'Y').eaten, 40)
})

test('the session only feeds you sat at a table where the player really is', () => {
  const pos = { x: 0, y: 0, z: 0 }
  const { s } = sessionAt(pos)
  s.handle('enterZone', { zone: 0 }, 0)
  s.tick(2, 0)
  assert.equal(s.profile.fat, 0, 'claimed a training pad from spawn')
  // Standing on the deck, off its chairs, gives nothing.
  Object.assign(pos, { x: zoneCenter(0).x + 4.5, y: padHeight(0), z: zoneCenter(0).z + 4.5 })
  s.tick(2, 0)
  assert.equal(s.profile.fat, 0, 'on the deck but not on a chair')
  Object.assign(pos, onBench(0))
  s.tick(2, 0)
  assert.ok(s.profile.fat > 0)
  // Any chair of the pad counts, side by side with others.
  let before = s.profile.fat
  const other = SEATS.filter((seat) => seat.zone === 0).at(-1)
  Object.assign(pos, { x: other.x, z: other.z })
  s.tick(2, 0)
  assert.ok(s.profile.fat > before, 'at another chair')
  // Another pad's chair isn't this one's.
  Object.assign(pos, onBench(1))
  before = s.profile.fat
  s.tick(2, 0)
  assert.equal(s.profile.fat, before)
})

test('bites are limited to a human clicking rate', () => {
  const { s, p } = sessionAt({ x: 0, y: 0, z: 0 })
  // 200 clicks in the same instant: only the banked burst counts.
  for (let i = 0; i < 200; i += 1) s.handle('eat', {}, 1000)
  assert.ok(p.fat <= 12, `got ${p.fat}`)
  // A second later the bucket has refilled by about nine.
  for (let i = 0; i < 200; i += 1) s.handle('eat', {}, 2000)
  assert.ok(p.fat <= 22, `got ${p.fat}`)
})

test('bites at a training pad are multiplied by it', () => {
  const pos = onBench(1)
  const p = createProfile('a', 'A')
  p.rebirths = 1
  const { s } = sessionAt(pos, p)
  s.handle('enterZone', { zone: 1 }, 0)
  s.handle('eat', {}, 0)
  assert.equal(p.fat, 1 * TRAIN_ZONES[1].mult * 1.5)
})

test('slams only count on the floor ahead, only with Fat, and no faster than a person slams', () => {
  const p = createProfile('a', 'A')
  const pos = { x: 0, y: 0, z: 10 }
  const { s, of } = sessionAt(pos, p)
  p.fat = 10
  s.handle('slam', pos, 1000)
  assert.equal(of('slam').length, 0, 'not from the plaza')
  Object.assign(pos, onFloorAt(0))
  p.fat = 0
  s.handle('slam', pos, 2000)
  assert.equal(of('slam').length, 0, 'no Fat, no slam')
  p.fat = 10
  s.handle('slam', { x: pos.x + 10, z: pos.z }, 3000)
  assert.equal(of('slam').length, 0, 'not from somewhere we never saw you')
  s.handle('slam', pos, 3000)
  assert.deepEqual(of('slam')[0].payload, { stage: 0, hp: 70, max: 80, damage: 10 })
  // A burst at once: only the banked slams count.
  for (let i = 0; i < 20; i += 1) s.handle('slam', pos, 3001)
  assert.ok(of('slam').length <= 4, `got ${of('slam').length}`)
  // Slamming doesn't burn your Fat.
  assert.equal(p.fat, 10)
})

test('a floor breaks at 0 HP: you are in its room, and the next floor is the one ahead', () => {
  const p = createProfile('a', 'A')
  p.fat = 30
  const pos = onFloorAt(0)
  const { s, of } = sessionAt(pos, p)
  slamThrough(s, pos)
  assert.equal(of('slam').length, 3, '80 HP in slams of 30')
  assert.deepEqual(of('floorBreak')[0].payload, { stage: 0 })
  assert.equal(s.level, 0)
  assert.equal(p.stats.floors, 1)
  assert.equal(p.stats.bestFloor, 1)
  assert.equal(p.stats.runs, 1)
  // Floor 0 again is behind you now; floor 1, at the far end of the room, is ahead.
  s.handle('slam', pos, 1e6)
  assert.equal(of('slam').length, 3)
  Object.assign(pos, onFloorAt(1, 0.5))
  s.handle('slam', pos, 1e6 + 1000)
  assert.equal(of('slam').at(-1).payload.stage, 1)
  assert.equal(of('slam').at(-1).payload.hp, 800 - 30)
})

test('the WINS pad pays its stage, boosted, and sends you home with every floor whole again', () => {
  const p = createProfile('a', 'A')
  p.fat = 1000
  p.passes.coinsX2 = true
  const pos = onFloorAt(0)
  const { s, of } = sessionAt(pos, p)
  let t = slamThrough(s, pos)
  Object.assign(pos, onFloorAt(1, 0.2))
  t = slamThrough(s, pos, t)
  assert.equal(s.level, 1)
  // Not from room 0's pad, now you're in room 1; not from beside the pad.
  Object.assign(pos, onPadAt(0))
  s.handle('claimWins', pos, (t += 100))
  assert.equal(p.coins, 0)
  Object.assign(pos, { ...onPadAt(1), x: -6 })
  s.handle('claimWins', pos, (t += 100))
  assert.equal(p.coins, 0)
  Object.assign(pos, onPadAt(1))
  s.handle('claimWins', pos, (t += 100))
  assert.equal(p.coins, WORLDS[0].stages[1].wins * 2)
  assert.equal(padWins(p, 1, 0), WORLDS[0].stages[1].wins * 2)
  assert.deepEqual(of('wins')[0].payload, { stage: 1, wins: WORLDS[0].stages[1].wins * 2, last: false })
  assert.deepEqual(of('teleport')[0].payload, { x: STAGE_RETURN.x, z: STAGE_RETURN.z, yaw: STAGE_RETURN.yaw, reason: 'wins' })
  assert.equal(s.level, -1)
  assert.equal(s.dive, null)
  // Once only.
  s.handle('claimWins', pos, (t += 100))
  assert.equal(of('wins').length, 1)
  assert.equal(p.fat, 1000, 'as fat as you went')
})

test('leaving the stages pays nothing; walking off floor 0 heals it', () => {
  const p = createProfile('a', 'A')
  p.fat = 100
  const pos = onFloorAt(0)
  const { s, of } = sessionAt(pos, p)
  slamThrough(s, pos)
  s.handle('leaveStage', {}, 9000)
  assert.equal(of('teleport')[0].payload.reason, 'left')
  assert.equal(p.coins, 0)
  // Slammed a bit, then walked back out into the plaza: floor 0 is whole again.
  p.fat = 10
  Object.assign(pos, onFloorAt(0))
  s.handle('slam', pos, 20000)
  assert.equal(of('slam').at(-1).payload.hp, 70)
  Object.assign(pos, { x: 0, y: 0, z: GATE_Z + 10 })
  s.tick(0.1, 21000)
  assert.equal(s.dive, null)
  assert.deepEqual(of('slam').at(-1).payload, { stage: 0, hp: 80, max: 80, damage: 0 })
})

test('the deepest pad of a world is rock bottom', () => {
  const p = createProfile('a', 'A')
  p.fat = 1e15
  const pos = onFloorAt(0)
  const { s, of } = sessionAt(pos, p)
  let t = 0
  const last = STAGE_SETS[0].count - 1
  for (let i = 0; i <= last; i += 1) {
    Object.assign(pos, onFloorAt(i, 0.3))
    t = slamThrough(s, pos, t)
  }
  assert.equal(s.level, last)
  // Nothing more to slam.
  s.handle('slam', pos, (t += 1000))
  assert.equal(of('floorBreak').length, last + 1)
  Object.assign(pos, onPadAt(last))
  s.handle('claimWins', pos, (t += 1000))
  assert.equal(of('wins')[0].payload.last, true)
  assert.ok(p.badges.includes('top'))
})

test('the World 2 portal badges you only from its swirl, with its Wins', () => {
  const pos = { x: 0, y: 0, z: 0 }
  const { s } = sessionAt(pos)
  const portal = PORTALS[0]
  s.profile.coins = WORLD_PORTALS[portal.id].coins - 1
  s.handle('portal', {}, 0)
  assert.deepEqual(s.profile.badges, [], 'not from spawn')
  Object.assign(pos, { x: portal.x, z: portal.z })
  s.handle('portal', {}, 0)
  assert.deepEqual(s.profile.badges, [], 'one Win short')
  s.profile.coins += 1
  s.handle('portal', {}, 0)
  assert.deepEqual(s.profile.badges, [portal.id])
  assert.equal(s.profile.world, 1, 'into World 2')
  // Back through to World 1, and - having been - in again without the Wins.
  s.handle('portal', {}, 0)
  assert.equal(s.profile.world, 0)
  s.profile.coins = 0
  s.handle('portal', {}, 0)
  assert.equal(s.profile.world, 1)
})

test('World 1 has 13 stages and World 2 7, each harder and paying more than the last', () => {
  assert.equal(WORLDS[0].stages.length, 13)
  assert.equal(WORLDS[1].stages.length, 7)
  assert.equal(WORLDS[1].name, 'World 2')
  for (const world of WORLDS) {
    world.stages.forEach((st, i) => {
      if (!i) return
      assert.ok(st.hp > world.stages[i - 1].hp, `${st.id} harder`)
      assert.ok(st.wins > world.stages[i - 1].wins, `${st.id} pays more`)
    })
  }
  // A floor takes SLAMS_PER_FLOOR slams of the Fat a player has by then: the first, of the tutorial's Fat.
  assert.equal(WORLDS[0].stages[0].hp, TUTORIAL[0].fat * SLAMS_PER_FLOOR)
})

test('a dive in World 2 is down its own stages', () => {
  const p = createProfile('a', 'A')
  p.world = 1
  p.fat = WORLDS[1].stages[0].hp
  const pos = onFloorAt(0)
  const { s, of } = sessionAt(pos, p)
  slamThrough(s, pos)
  assert.equal(of('slam').length, 1, 'one slam of its HP')
  assert.equal(of('slam')[0].payload.max, WORLDS[1].stages[0].hp)
  Object.assign(pos, onPadAt(0))
  s.handle('claimWins', pos, 1e6)
  assert.equal(p.coins, WORLDS[1].stages[0].wins)
})

test('where you can be is your level: the lobby and yard, or the room you broke into', () => {
  // The yard and floor 0 are part of the lobby; rooms are below and walled.
  assert.deepEqual(clampToLevel(-1, 0, floorRect(0).minZ + 2), { x: 0, z: floorRect(0).minZ + 2 })
  const deep = clampToLevel(-1, 0, roomRect(0).minZ)
  assert.ok(deep.z >= YARD.minZ, 'no walking into room 0 from the lobby')
  const inRoom = clampToLevel(2, 30, roomRect(2).minZ - 50)
  assert.ok(inRoom.x < 9 && inRoom.z > roomRect(2).minZ, 'room 2 is walled in')
  // Each room's floor is a drop below the floor above it, and the next floor is flush with it.
  assert.equal(groundAt(-1, 0, 0), 0)
  assert.equal(groundAt(0, 0, -70), roomFloorY(0))
  assert.equal(floorTopY(1), roomFloorY(0))
  // Floor i + 1 is at the far end of room i, and room i + 1 is under it.
  for (let i = 0; i < 5; i += 1) {
    const next = floorRect(i + 1)
    const room = roomRect(i)
    assert.equal(next.minZ, room.minZ, `floor ${i + 1} at the north end of room ${i}`)
    assert.equal(roomRect(i + 1).maxZ, next.maxZ, `room ${i + 1} under floor ${i + 1}`)
    const pad = padRect(i)
    assert.ok(pad.maxZ < floorRect(i).minZ && pad.minZ > next.maxZ, `pad ${i} between where you land and the next floor`)
  }
})

test('walking speed grows with every level ever reached, and never drops on rebirth', () => {
  assert.equal(walkSpeed(1, 0), 10)
  assert.ok(walkSpeed(5, 0) > walkSpeed(1, 0))
  assert.ok(walkSpeed(1, 1) >= walkSpeed(5, 0), 'a rebirth keeps you as quick')
  assert.ok(walkSpeed(30, 5) <= 13.5)
})

test('walking earns no Fat: only eating does', () => {
  const pos = { x: 0, y: 0, z: 10 }
  const { s, p } = sessionAt(pos)
  s.tick(0.1, 0)
  // Walk 41 m round the lobby at 8.2 m/s.
  for (let i = 1; i <= 50; i += 1) {
    pos.x += 0.82
    s.tick(0.1, i * 100)
  }
  assert.equal(p.fat, 0)
})

test('foods can only be bought at the Food Shop counter', () => {
  const pos = { x: 0, y: 0, z: 0 }
  const p = createProfile('a', 'A')
  p.coins = 100
  const { s } = sessionAt(pos, p)
  s.handle('buyFood', { id: 'fries' }, 0)
  assert.equal(p.ownedFoods.length, 1, 'not from the middle of the plaza')
  Object.assign(pos, { x: FOOD_COUNTER.x, z: FOOD_COUNTER.z })
  s.handle('buyFood', { id: 'fries' }, 0)
  assert.equal(p.ownedFoods.length, 2)
  // Picking which owned food to eat works anywhere.
  Object.assign(pos, { x: 0, z: 0 })
  s.handle('equipFood', { id: 'cookie' }, 0)
  assert.equal(p.equippedFood, 'cookie')
})

test('only brand-new players get the tutorial', () => {
  const fresh = normalizeProfile({ rebirths: 0, tutorialStep: 1 }, 'a', 'A')
  assert.equal(fresh.tutorialStep, 1)
  const reborn = normalizeProfile({ rebirths: 1, tutorialStep: 1 }, 'b', 'B')
  assert.equal(reborn.tutorialStep, TUTORIAL.length)
})

test('the shop sells for Wins only', () => {
  const p = createProfile('a', 'A')
  const { s } = sessionAt({ x: 0, z: 0 }, p)
  s.handle('purchase', { productId: 'fatX2' }, 0)
  assert.equal(p.passes.fatX2, undefined)
  p.coins = SHOP.fatX2.price + 7
  s.handle('purchase', { productId: 'fatX2' }, 0)
  assert.equal(p.passes.fatX2, true)
  assert.equal(p.coins, 7)
  applyBite(p, -1, 0)
  assert.equal(p.fat, 2, 'x2 Fat doubles gains')
})

test('the store: x3 and VIP passes stack, and bundles give three of a thing', () => {
  const p = createProfile('a', 'A')
  p.coins = SHOP.coinsX3.price + SHOP.vip.price + SHOP.potionsFat.price + SHOP.eggsUnicorn.price
  assert.equal(coinsMultiplier(p, 0), 1)
  assert.equal(buyShopItem(p, 'coinsX3').ok, true)
  assert.equal(buyShopItem(p, 'vip').ok, true)
  assert.equal(coinsMultiplier(p, 0), 4.5)
  assert.equal(buyShopItem(p, 'potionsFat').ok, true)
  assert.equal(p.items.potionFat, 3)
  assert.equal(buyShopItem(p, 'eggsUnicorn').ok, true)
  assert.equal(p.items.eggUnicorn, 3)
  assert.equal(buyShopItem(p, 'vip').ok, false, 'a pass is bought once')
})

test('auras are worn when bought and multiply Wins', () => {
  const p = createProfile('a', 'A')
  const { s } = sessionAt({ x: 0, z: 0 }, p)
  p.coins = SHOP.auraLightning.price
  s.handle('purchase', { productId: 'auraLightning' }, 0)
  assert.equal(p.equippedAura, 'lightning')
  assert.equal(coinsMultiplier(p, 0), AURAS.lightning.coins)
  s.handle('equipAura', { id: null }, 0)
  assert.equal(coinsMultiplier(p, 0), 1)
  s.handle('equipAura', { id: 'water' }, 0)
  assert.equal(p.equippedAura, null, 'not one you never bought')
})

test('Snack Town: the training hall on the right in order, the Food Shop on the left, eggs and boards behind, the walk to the gate clear', () => {
  // Facing north from spawn: the training pads to the right, in a grid rising away from
  // the runway; the Food Shop hut on the left; the eggs and leaderboards behind.
  for (let i = 0; i < ZONE_COUNT; i += 1) {
    assert.ok(zoneCenter(i).x > SPAWN.x + 10, `pad ${i} on the right`)
    if (i % 3) assert.ok(zoneCenter(i).z < zoneCenter(i - 1).z, `pad ${i} north of pad ${i - 1}`)
    if (i >= 3) assert.ok(padHeight(i) > padHeight(i - 3), `pad ${i} a tier up from pad ${i - 3}`)
  }
  assert.ok(FOOD_HUT.x < SPAWN.x - 20 && FOOD_COUNTER.x < SPAWN.x - 15, 'the Food Shop on the left')
  for (const egg of EGG_STANDS) assert.ok(egg.z > SPAWN.z, `${egg.eggId} egg behind`)
  for (const board of LEADERBOARDS) assert.ok(board.z > SPAWN.z, `${board.id} board behind`)
  assert.ok(Math.abs(STATUE.x) > 15, 'the statue well clear of the gate')
  // Every chair is reachable: off every wall, and nobody spawns on one.
  assert.equal(benchAt(SPAWN.x, SPAWN.z), -1)
  for (const seat of SEATS) {
    assert.equal(benchAt(seat.x, seat.z), seat.zone)
    for (const wall of STATIC_COLLIDERS) assert.ok(!(seat.x > wall.minX && seat.x < wall.maxX && seat.z > wall.minZ && seat.z < wall.maxZ), `chair of pad ${seat.zone} inside a wall`)
  }
  // The counter is reachable, not inside the hut.
  for (const wall of STATIC_COLLIDERS) assert.ok(!(FOOD_COUNTER.x > wall.minX && FOOD_COUNTER.x < wall.maxX && FOOD_COUNTER.z > wall.minZ && FOOD_COUNTER.z < wall.maxZ), 'counter inside a wall')
  // The straight walk from spawn up to the gate is clear: nothing solid in it.
  const overlaps = (a, b) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ
  assert.ok(WALKWAY.minX <= SPAWN.x && WALKWAY.maxX >= SPAWN.x && WALKWAY.minZ <= GATE_Z)
  for (const wall of STATIC_COLLIDERS) assert.ok(!overlaps(wall, WALKWAY), `something solid on the walkway: ${JSON.stringify(wall)}`)
  for (let i = 0; i < ZONE_COUNT; i += 1) assert.ok(!overlaps(zoneDeckRect(i), WALKWAY), `pad ${i} on the walkway`)
  // Back from the stages, you're in front of the gate, on the walkway.
  assert.ok(STAGE_RETURN.z > GATE_Z && STAGE_RETURN.z < SPAWN.z)
})
