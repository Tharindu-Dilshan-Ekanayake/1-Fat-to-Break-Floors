import { FOODS, EGGS, PETS, SHOP, TRAIN_ZONES, WORLD_PORTALS, WORLDS } from '@shared/balance'
import { formatNumber } from '@shared/format'
import { isZoneUnlocked } from '@shared/logic'
import {
  AURA_STAND,
  FOOD_COUNTER,
  FOOD_HUT,
  EGG_STANDS,
  FREE_REWARD,
  GATE_Z,
  HALL_TIERS,
  LEADERBOARDS,
  PORTALS,
  POTION_STAND,
  SPHINX_STAND,
  STATUE,
} from '@shared/world'

import { WORLD } from '../stage/course'
import { eggHeight } from '../world/eggs'
import { FLOORS_FACE } from '../world/stageGate'
import { PAD_THEMES, zoneSignPosition } from '../world/trainingPads'

/**
 * Text styles, as gradients top-to-bottom: chunky, candy-bright signage.
 */
export const TEXT = {
  gold: ['#fffaa8', '#ffd52a', '#ff9c00'],
  green: ['#e6ffb0', '#8dff4f', '#2fd12f'],
  price: ['#d9ff9a', '#7dff4a', '#2fd12f'],
  white: ['#ffffff', '#ffffff', '#dfe7f0'],
  red: ['#ffb0a8', '#ff4a3b', '#d4142a'],
  blue: ['#e0faff', '#7fe2ff', '#2fa8ff'],
  orange: ['#fff1c2', '#ffb03b', '#ff6a00'],
  purple: ['#f3d9ff', '#c27bff', '#7a2fd6'],
}

const tint = (hex) => ['#ffffff', hex, hex]

/** Pad labels' scale: readable from the hall's front, not so big they pile up from the runway. */
const ZONE_PX = 62

/** A training pad's multiplier, big, and its name: "x2 FAT / Diner Pad". */
const zoneHead = (zone, theme) => [
  { text: `x${zone.mult} FAT`, size: 70, icon: 'fat', gradient: theme ? tint(theme.text) : undefined },
  { text: zone.name, size: 36, gradient: theme ? TEXT.white : undefined },
]

/**
 * A training pad's sign: its multiplier and name, then whether you can eat there:
 * "x1.5 FAT / Snack Pad / FREE", "x2 FAT / Diner Pad / 1 Rebirth",
 * "x30 FAT / Frosty Pad / VERY OP! / 3.3M Wins"...
 */
export function zoneLabelSpec(index, unlocked) {
  const zone = TRAIN_ZONES[index]
  const lines = zoneHead(zone, PAD_THEMES[index])
  if (unlocked) {
    lines.push({ text: zone.rebirths === 0 && !zone.product ? 'FREE' : 'UNLOCKED', size: 44, gradient: TEXT.green })
  } else if (zone.product) {
    lines.push({ text: zone.tag, size: 44, rainbow: true })
    lines.push({ text: `${formatNumber(SHOP[zone.product].price)} Wins`, size: 40, icon: 'coin', gradient: TEXT.gold })
  } else {
    const word = zone.rebirths === 1 ? 'Rebirth' : 'Rebirths'
    lines.push({ text: `${zone.rebirths} ${word}`, size: 46, icon: 'rebirth', gradient: TEXT.green })
  }
  return { lines, pxPerUnit: ZONE_PX }
}

/** Largest a zone label can get, so its atlas slot fits every state. */
const zoneReserve = (index) => {
  const zone = TRAIN_ZONES[index]
  const lines = zoneHead(zone)
  if (zone.product) {
    lines.push({ text: zone.tag, size: 44 })
    lines.push({ text: `${formatNumber(SHOP[zone.product].price)} Wins`, size: 40, icon: 'coin' })
  } else {
    lines.push({ text: 'UNLOCKED', size: 46, icon: 'rebirth' })
  }
  return { lines }
}

export function zoneLabels(profile) {
  return TRAIN_ZONES.map((zone, i) => {
    // Over the pad's middle; the four-line ones a touch higher.
    const [x, y, z] = zoneSignPosition(i)
    return {
      id: `zone-${i}`,
      position: [x, y + (zone.product ? 0.35 : 0), z],
      spec: zoneLabelSpec(i, isZoneUnlocked(profile, i)),
      reserve: zoneReserve(i),
      // Faded out past the hall's front, so from the runway the far rows don't stack up.
      fade: 70,
      near: 6,
    }
  })
}

/** Where food `index` stands for you in the shop: 'equipped' | 'owned' | 'buy' | 'locked'. */
export function padState(profile, index) {
  const food = FOODS[index]
  if (profile.equippedFood === food.id) return 'equipped'
  if (profile.ownedFoods.includes(food.id)) return 'owned'
  const previous = FOODS[index - 1]
  return !previous || profile.ownedFoods.includes(previous.id) ? 'buy' : 'locked'
}

export function eggLabels() {
  return EGG_STANDS.map((stand) => {
    const egg = EGGS[stand.eggId]
    const lines = stand.big
      ? [
          { text: 'Demon Egg', size: 54, gradient: TEXT.red },
          { text: `${formatNumber(egg.cost.coins)} Wins`, size: 46, icon: 'coin', gradient: TEXT.gold },
        ]
      : [
          { text: `${egg.name} Egg`, size: 50, fill: '#ffffff' },
          { text: `${formatNumber(egg.cost.coins)} Wins`, size: 44, icon: 'coin', gradient: TEXT.gold },
        ]
    // Over the egg, a little towards its front (the plaza).
    const out = stand.big ? 1.2 : 0.6
    return {
      id: `egg-${stand.eggId}`,
      position: [stand.x + Math.sin(stand.yaw) * out, eggHeight(stand) + (stand.big ? 4 : 2.5), stand.z + Math.cos(stand.yaw) * out],
      spec: { lines, pxPerUnit: 62 },
      fade: 100,
    }
  })
}

/** The limited Sphinx showcase: price, hype, and live stock. */
export function sphinxLabelSpec(stock) {
  const mult = PETS.sphinx.mult
  return {
    lines: [
      { text: `${formatNumber(SHOP.sphinx.price)} Wins`, size: 46, icon: 'coin', gradient: TEXT.gold },
      { text: 'BEST IN GAME', size: 56, gradient: TEXT.red },
      { text: 'Sphinx', size: 76, fill: '#ffffff' },
      { text: `${formatNumber(mult * 100 - 100)}% BETTER`, size: 54, rainbow: true },
      { text: `${formatNumber(stock)} Left`, size: 50, gradient: TEXT.green },
    ],
    pxPerUnit: 48,
  }
}

export function sphinxLabel(stock) {
  return {
    id: 'sphinx',
    position: [SPHINX_STAND.x, 11.5, SPHINX_STAND.z],
    spec: sphinxLabelSpec(stock),
    reserve: sphinxLabelSpec(88888),
    fade: 140,
  }
}

/** The gate's label id, and the FLOORS BROKEN board's. */
export const GATE_LABEL_ID = 'gate'
export const FLOORS_LABEL_ID = 'floors-broken'

/**
 * A big two-line sign over an area of the plaza: its name, and what it's for. The areas'
 * section signs are the biggest; a stand's (`px` higher) a size down.
 */
const title = (id, position, name, sub, gradient, fade = 120, px = 54) => ({
  id,
  position,
  spec: {
    lines: [
      { text: name, size: 72, gradient },
      { text: sub, size: 34, fill: '#ffffff' },
    ],
    pxPerUnit: px,
  },
  fade,
})

/**
 * Where each area's section sign floats, so it reads from spawn (facing north): the
 * training hall's on the right, at the front corner of its tiers, and the Food Shop's
 * on the left in front of its counter; and for what's behind you, over the egg row and
 * the leaderboards.
 */
const SECTION = (() => {
  const hall = HALL_TIERS[0]
  const eggs = EGG_STANDS.filter((s) => !s.big)
  const boards = LEADERBOARDS.reduce((a, b) => (Math.abs(b.x) < Math.abs(a.x) ? b : a))
  return {
    // At the hall's front corner, nearest spawn.
    courts: [hall.minX - 13, 6.4, hall.maxZ + 1],
    // In front of the food shop's welcome patch and counter.
    shop: [FOOD_COUNTER.x + FOOD_COUNTER.radius + 0.4, 5.8, FOOD_HUT.z],
    // Over the middle of the egg row, above the eggs' own signs.
    eggs: [eggs.reduce((s, e) => s + e.x, 0) / eggs.length, 8.9, eggs[0].z - 1],
    // Over the middle leaderboard.
    boards: [boards.x, 12.4, boards.z],
  }
})()

/** The section signs, the free reward, the portal, the statue's challenge, the gate's and the floors board's. */
function placeLabels() {
  const portal = PORTALS[0]
  return [
    title('title-zones', SECTION.courts, 'Training Pads', 'Sit at a table to eat for EXTRA FAT!', TEXT.orange, 150),
    title('title-foods', SECTION.shop, 'Food Shop', 'Buy and Equip FOOD!', TEXT.blue, 150),
    title('title-auras', [AURA_STAND.x, 7.4, AURA_STAND.z - 3.2], 'Auras', 'Buy and Equip Auras!', TEXT.purple, 70, 74),
    title('title-potions', [POTION_STAND.x + 1, 5.6, POTION_STAND.z], 'Potions', 'Use and Buy Potions Here!', TEXT.green, 70, 74),
    title('title-eggs', SECTION.eggs, 'Eggs', 'Hatch pets for more Fat!', TEXT.gold, 110),
    title('title-boards', SECTION.boards, 'Leaderboards', 'The fattest players of all!', TEXT.purple, 110),
    {
      id: 'free-reward',
      position: [FREE_REWARD.x, 4.6, FREE_REWARD.z],
      spec: { lines: [{ text: 'FREE REWARD', size: 50, gradient: ['#fff2b0', '#ffb347', '#ff6a1e'] }], pxPerUnit: 60 },
      fade: 90,
    },
    {
      id: `portal-${portal.id}`,
      position: [portal.x, portal.radius * 2 + 3.6, portal.z],
      spec: portalLabelSpec(portal.id, 0),
      reserve: portalLabelSpec(portal.id, 0),
      fade: 140,
    },
    {
      id: 'statue',
      position: [STATUE.x, 13.8, STATUE.z],
      spec: { lines: [{ text: 'HOW DEEP CAN', size: 46, fill: '#ffffff' }, { text: 'YOU SLAM?', size: 62, gradient: TEXT.gold }], pxPerUnit: 40 },
      fade: 140,
    },
    {
      id: GATE_LABEL_ID,
      position: [0, 14.2, GATE_Z + 0.6],
      spec: gateLabelSpec(),
      reserve: WORLDS.map((_, world) => gateLabelSpec(world)).reduce((x, y) => (y.lines[1].text.length > x.lines[1].text.length ? y : x)),
      fade: 160,
    },
    {
      id: FLOORS_LABEL_ID,
      position: [FLOORS_FACE.x, FLOORS_FACE.y, FLOORS_FACE.z + 0.2],
      spec: floorsLabelSpec(0),
      reserve: floorsLabelSpec(888888),
      fade: 70,
      near: 3,
    },
  ]
}

/** Over the STAGE gate: how many stages the world you're in (or `world`) goes down, and what to do. */
export function gateLabelSpec(world = WORLD) {
  const count = (WORLDS[world] ?? WORLDS[0]).stages.length
  return {
    lines: [
      { text: `${count} STAGES DEEP`, size: 50, gradient: TEXT.orange },
      { text: 'SLAM the floors to break them!', size: 34, fill: '#ffffff' },
    ],
    pxPerUnit: 40,
  }
}

/** The FLOORS BROKEN board: how many floors you've broken, in all. */
export function floorsLabelSpec(floors) {
  return {
    lines: [
      { text: 'FLOORS BROKEN', size: 34, fill: '#ffffff' },
      { text: formatNumber(floors), size: 78, gradient: TEXT.gold },
      { text: 'by you', size: 30, gradient: TEXT.blue },
    ],
    pxPerUnit: 70,
  }
}

/** "WORLD 2" for world index 1: worlds are numbered from 1 on their signs. */
const worldNumber = (world) => `WORLD ${world + 1}`

/**
 * World portal `id`'s sign, seen from world `world`: "WORLD 2" (and the world's own name,
 * if it has one besides), its stages and price - or, from inside, the way back to World 1.
 */
export function portalLabelSpec(id, world) {
  const portal = WORLD_PORTALS[id]
  if (world === portal.world) {
    return {
      lines: [
        { text: worldNumber(0), size: 60, gradient: TEXT.green },
        { text: 'Step in to go back!', size: 40, fill: '#ffffff' },
        { text: ' ', size: 40, fill: '#ffffff' },
      ],
      pxPerUnit: 52,
    }
  }
  const number = worldNumber(portal.world)
  const named = portal.name && portal.name.toUpperCase() !== number
  return {
    lines: [
      { text: number, size: 64, gradient: TEXT.blue },
      ...(named ? [{ text: portal.name, size: 40, gradient: TEXT.purple }] : []),
      { text: `${WORLDS[portal.world].stages.length} NEW STAGES!`, size: 40, fill: '#ffffff' },
      { text: `Need ${formatNumber(portal.coins)} Wins`, size: 40, icon: 'coin', gradient: TEXT.gold },
    ],
    pxPerUnit: 52,
  }
}

/** Every label in the lobby. */
export function lobbyLabels(profile, { sphinxStock = 0 } = {}) {
  return [...zoneLabels(profile), ...eggLabels(), sphinxLabel(sphinxStock), ...placeLabels()]
}
