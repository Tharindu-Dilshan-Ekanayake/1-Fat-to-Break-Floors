/**
 * Every tunable number in the game. Rules live in logic.js; this file is only data,
 * so balancing never means touching code.
 *
 * Shared by client (display) and server (authority): both always agree on costs and
 * multipliers because they read the same table.
 *
 * The loop: eat food to get FAT (your belly grows with every bite), then walk through the
 * STAGE gate onto a floor and SLAM it: you jump up and come down belly first, and every
 * slam knocks your Fat off the floor's HP. Break it and you fall into the room below,
 * where a WINS pad pays out and takes you home - or walk on to the next stage's floor and
 * slam your way deeper for a bigger pad. You keep your Fat, so buy better food with the
 * Wins, eat more, and dive deeper. (Wins are the currency; in code they're `coins`.)
 */

// --- Fat and levels ----------------------------------------------------------------

/** Fat one bite (click) is worth before any multiplier: the "+1". */
export const BASE_GAIN = 1
/** Bites the server accepts per second, and how many can be banked for a burst. */
export const MAX_BITES_PER_SECOND = 9
export const BITE_BURST = 12
/** Seconds between the bites you take automatically sat at a training pad's table. */
export const TRAIN_INTERVAL = 0.8

/**
 * Your level comes from the Fat you've eaten since your last rebirth. Level L needs
 * LEVEL_FIRST * LEVEL_GROWTH^(L-1) more than the one before (15, 19, 23, 29, 36 ...), so
 * reaching level L takes fatForLevel(L) eaten in all.
 */
export const LEVEL_FIRST = 15
export const LEVEL_GROWTH = 1.25
export const fatForLevel = (level) =>
  level <= 1 ? 0 : Math.round((LEVEL_FIRST * (LEVEL_GROWTH ** (level - 1) - 1)) / (LEVEL_GROWTH - 1))

// --- Rebirth ----------------------------------------------------------------------

/** The level you must reach to rebirth: R0 = 5, R1 = 10, R2 = 20, R3 = 30, then +10 per rebirth. */
export const levelCap = (rebirths) => (rebirths <= 0 ? 5 : 10 * rebirths)

/** Fat multiplier from rebirths: R0 = x1, R1 = x1.5, R2 = x2 ... */
export const rebirthMultiplier = (rebirths) => 1 + 0.5 * Math.max(0, rebirths)

/**
 * Walking speed (m/s): a little quicker with every level you've ever reached - a rebirth
 * puts your level back to 1 but keeps the levels behind it, so you never slow down - up
 * to a top speed safely under the server's MAX_MOVE_SPEED (world.js).
 */
export function walkSpeed(level = 1, rebirths = 0) {
  let levels = Math.max(0, level - 1)
  for (let k = 0; k < rebirths && levels < 40; k += 1) levels += levelCap(k)
  return Math.min(13.5, 10 + 0.1 * levels)
}

/** Skipping straight to a rebirth costs this many max-level dives' worth of Wins. */
export const REBIRTH_SKIP_RUNS = 8

// --- Training pads -----------------------------------------------------------------

/**
 * The training pads, in the training hall east of the runway (world.js), in order: a
 * colourful deck with two dining tables, chairs all round. Sat at one you take a bite
 * automatically every TRAIN_INTERVAL, and every bite there (clicks too) is worth `mult`
 * times more. `rebirths` = rebirths needed; `product` = the SHOP pass that unlocks it
 * instead.
 */
export const TRAIN_ZONES = [
  { id: 'snack', name: 'Snack Pad', mult: 1.5, rebirths: 0 },
  { id: 'diner', name: 'Diner Pad', mult: 2, rebirths: 1 },
  { id: 'grill', name: 'Grill Pad', mult: 3, rebirths: 2 },
  { id: 'bakery', name: 'Bakery Pad', mult: 5, rebirths: 3 },
  { id: 'spicy', name: 'Spicy Pad', mult: 8, rebirths: 5 },
  { id: 'sushi', name: 'Sushi Pad', mult: 12, rebirths: 7 },
  { id: 'royal', name: 'Royal Pad', mult: 18, rebirths: 10 },
  { id: 'frost', name: 'Frosty Pad', mult: 30, product: 'zoneVeryOp', tag: 'VERY OP!' },
  { id: 'galaxy', name: 'Galaxy Pad', mult: 60, product: 'zoneBest', tag: 'BEST OVERALL!' },
]

// --- Foods ------------------------------------------------------------------------

/**
 * What you eat. `power` is the Fat each bite gives before multipliers; `cost` is in
 * Wins. Bought in order from the Food Shop.
 *
 * Prices go with the stages (World 1's thirteen, then World 2's seven): from the Taco
 * on, each food costs two or three dives to the stage it goes with, paid in the Wins
 * that stage's pad gives with the boosts a player has by then - so every new stage pays
 * for about one new food.
 */
export const FOODS = [
  { id: 'cookie', name: 'Choco Cookie', power: 1, cost: 0 },
  // Cheap enough for the Wins from your very first dive.
  { id: 'fries', name: 'Crispy Fries', power: 2, cost: 3 },
  { id: 'donut', name: 'Sprinkle Donut', power: 3, cost: 20 },
  { id: 'hotdog', name: 'Hot Dog', power: 5, cost: 60 },
  { id: 'pizza', name: 'Pizza Slice', power: 8, cost: 150 },
  { id: 'taco', name: 'Crunchy Taco', power: 12, cost: 1300 },
  { id: 'burger', name: 'Double Burger', power: 18, cost: 2800 },
  { id: 'sushi', name: 'Sushi Roll', power: 27, cost: 8700 },
  { id: 'icecream', name: 'Triple Scoop', power: 40, cost: 23000 },
  { id: 'cupcake', name: 'Cherry Cupcake', power: 60, cost: 48000 },
  { id: 'pancakes', name: 'Pancake Tower', power: 90, cost: 220000 },
  { id: 'drumstick', name: 'BBQ Drumstick', power: 135, cost: 470000 },
  { id: 'ramen', name: 'Ramen Bowl', power: 200, cost: 1200000 },
  { id: 'cake', name: 'Party Cake', power: 300, cost: 2800000 },
  { id: 'watermelon', name: 'Mega Melon', power: 450, cost: 9000000 },
  { id: 'turkey', name: 'Roast Turkey', power: 700, cost: 230000000 },
  { id: 'galaxyDonut', name: 'Galaxy Donut', power: 1000, cost: 2500000000 },
  { id: 'neonSundae', name: 'Neon Sundae', power: 1500, cost: 75000000000 },
  { id: 'diamondCupcake', name: 'Diamond Cupcake', power: 2300, cost: 1100000000000 },
  { id: 'dragonSteak', name: 'DRAGON STEAK', power: 3500, cost: 15000000000000, tag: 'OP' },
]

// --- The stages -------------------------------------------------------------------

/**
 * The worlds, each with its own stages under the STAGE gate: World 1, and World 2
 * through the portal (WORLD_PORTALS), which takes `coins` Wins to step into the first
 * time.
 *
 * A world's stages go down and down: stage i is a FLOOR (`hp` to break) with a room
 * under it. Standing on a floor you slam it, each slam knocking your Fat off its HP;
 * at 0 it shatters and you fall into its room. There, the WINS pad pays `wins` (times
 * your Wins boosts) and takes you back to the lobby - or walk on to the next stage's
 * floor at the far end and slam on. A floor's HP comes back when you leave the stages.
 *
 * `hp` is SLAMS_PER_FLOOR slams of the Fat a player has by the time they get there; a
 * pad's `wins` is about what every stage above it would have paid, and a half more.
 */
export const WORLDS = [
  {
    id: 'earth',
    name: 'World 1',
    stages: [
      { id: 'grass', name: 'Grassy', hp: 80, wins: 15 },
      { id: 'sand', name: 'Sandy', hp: 800, wins: 160 },
      { id: 'ice', name: 'Frozen', hp: 2000, wins: 550 },
      { id: 'jungle', name: 'Jungle', hp: 4000, wins: 1300 },
      { id: 'volcano', name: 'Lava', hp: 8000, wins: 2800 },
      { id: 'beach', name: 'Beach', hp: 20000, wins: 6500 },
      { id: 'mushroom', name: 'Mushroom', hp: 40000, wins: 14000 },
      { id: 'candy', name: 'Candy', hp: 80000, wins: 29000 },
      { id: 'spooky', name: 'Spooky', hp: 200000, wins: 67000 },
      { id: 'swamp', name: 'Toxic', hp: 400000, wins: 140000 },
      { id: 'crystal', name: 'Crystal', hp: 800000, wins: 290000 },
      { id: 'cloud', name: 'Cloud', hp: 2000000, wins: 670000 },
      { id: 'moon', name: 'Moon Core', hp: 8000000, wins: 2200000 },
    ],
  },
  {
    id: 'future',
    name: 'World 2',
    coins: 1400000,
    stages: [
      { id: 'neon', name: 'Neon', hp: 20000000, wins: 3800000 },
      { id: 'cyber', name: 'Cyber', hp: 200000000, wins: 41000000 },
      { id: 'factory', name: 'Robot', hp: 2000000000, wins: 420000000 },
      { id: 'station', name: 'Space', hp: 20000000000, wins: 4200000000 },
      { id: 'mars', name: 'Mars', hp: 200000000000, wins: 42000000000 },
      { id: 'asteroid', name: 'Asteroid', hp: 2000000000000, wins: 420000000000 },
      { id: 'galaxy', name: 'Galaxy Core', hp: 20000000000000, wins: 4200000000000 },
    ],
  },
]
/** How many slams a floor is meant to take, at the Fat you'd have by then (hp / 4 is that Fat). */
export const SLAMS_PER_FLOOR = 4
/**
 * Slams the server accepts: one every SLAM_INTERVAL seconds, with SLAM_BURST banked (a
 * jump-and-slam takes about half a second, so a fair player never hits the limit).
 */
export const SLAM_INTERVAL = 0.36
export const SLAM_BURST = 3

// --- Pets & eggs ------------------------------------------------------------------

export const RARITIES = {
  common: { name: 'Common', color: '#b9c3cf', order: 0 },
  uncommon: { name: 'Uncommon', color: '#4ade80', order: 1 },
  rare: { name: 'Rare', color: '#38bdf8', order: 2 },
  epic: { name: 'Epic', color: '#b15cff', order: 3 },
  legendary: { name: 'Legendary', color: '#ffc41f', order: 4 },
  mythic: { name: 'Mythic', color: '#ff3b6b', order: 5 },
  secret: { name: 'Secret', color: '#ff5bd8', order: 6 },
}

/** `mult` multiplies Fat gains. Equipped pets stack additively (see logic.js). */
export const PETS = {
  cat: { name: 'Cat', rarity: 'common', mult: 1.2 },
  dog: { name: 'Dog', rarity: 'common', mult: 1.3 },
  bunny: { name: 'Bunny', rarity: 'uncommon', mult: 1.5 },
  bear: { name: 'Bear', rarity: 'rare', mult: 2 },
  cow: { name: 'Cow', rarity: 'uncommon', mult: 2.5 },
  parrot: { name: 'Parrot', rarity: 'rare', mult: 3 },
  fox: { name: 'Fox', rarity: 'epic', mult: 4 },
  tiger: { name: 'Tiger', rarity: 'legendary', mult: 6 },
  flamingo: { name: 'Flamingo', rarity: 'uncommon', mult: 8 },
  turtle: { name: 'Turtle', rarity: 'rare', mult: 10 },
  owl: { name: 'Owl', rarity: 'epic', mult: 14 },
  phoenix: { name: 'Phoenix', rarity: 'legendary', mult: 25 },
  pony: { name: 'Pony', rarity: 'rare', mult: 10 },
  unicorn: { name: 'Unicorn', rarity: 'epic', mult: 18 },
  pegasus: { name: 'Pegasus', rarity: 'legendary', mult: 30 },
  imp: { name: 'Imp', rarity: 'rare', mult: 20 },
  bat: { name: 'Bat', rarity: 'epic', mult: 30 },
  demon: { name: 'Demon', rarity: 'legendary', mult: 50 },
  hellhound: { name: 'Hellhound', rarity: 'mythic', mult: 80 },
  dragon: { name: 'Dragon', rarity: 'epic', mult: 6 },
  crab: { name: 'Lucky Crab', rarity: 'uncommon', mult: 1.5 },
  sphinx: { name: 'Sphinx', rarity: 'secret', mult: 150 },
}

/**
 * Eggs, bought with Wins. `pets` are [petId, weight] - weights are percentages and
 * sum to 100.
 */
export const EGGS = {
  basic: { name: 'Basic', cost: { coins: 50 }, pets: [['cat', 45], ['dog', 30], ['bunny', 20], ['bear', 5]] },
  meadow: { name: 'Grass', cost: { coins: 930 }, pets: [['cow', 45], ['parrot', 30], ['fox', 20], ['tiger', 5]] },
  sunset: { name: 'Sunset', cost: { coins: 12000 }, pets: [['flamingo', 45], ['turtle', 30], ['owl', 20], ['phoenix', 5]] },
  unicorn: { name: 'Unicorn', cost: { coins: 560000 }, pets: [['pony', 50], ['unicorn', 35], ['pegasus', 15]] },
  demon: { name: 'Demon', cost: { coins: 12000000000 }, pets: [['imp', 50], ['bat', 30], ['demon', 15], ['hellhound', 5]] },
}

export const MAX_EQUIPPED_PETS = 3
export const MAX_PET_INVENTORY = 60
/** Multi-hatch opens this many at once, for that many times the cost. */
export const MULTI_HATCH = 3

// --- Items, boosts, rewards -------------------------------------------------------

export const POTION_DURATION_MS = 5 * 60 * 1000

export const ITEMS = {
  potionFat: { name: 'x2 Fat Potion', kind: 'potion', boost: 'fat', durationMs: POTION_DURATION_MS },
  potionCoins: { name: 'x2 Wins Potion', kind: 'potion', boost: 'coins', durationMs: POTION_DURATION_MS },
  eggMeadow: { name: 'Grass Egg', kind: 'egg', egg: 'meadow' },
  eggSunset: { name: 'Sunset Egg', kind: 'egg', egg: 'sunset' },
  eggUnicorn: { name: 'Unicorn Egg', kind: 'egg', egg: 'unicorn' },
  eggDemon: { name: 'Demon Egg', kind: 'egg', egg: 'demon' },
}

/** 7-day cycle; day N unlocks N x 24h after the cycle started. */
export const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000
export const DAILY_REWARDS = [
  { label: 'x2 Wins', icon: 'potionCoins', sub: '5m', grant: { item: 'potionCoins' } },
  { label: 'Dragon', icon: 'pet:dragon', sub: 'x1', grant: { pet: 'dragon' } },
  { label: 'x2 Fat', icon: 'potionFat', sub: '5m', grant: { item: 'potionFat' } },
  { label: 'Unicorn Egg', icon: 'egg:unicorn', sub: 'x1', grant: { item: 'eggUnicorn' } },
  { label: 'x2 Fat', icon: 'potionFat', sub: '5m', grant: { item: 'potionFat' } },
  { label: 'x2 Wins', icon: 'potionCoins', sub: '5m', grant: { item: 'potionCoins' } },
  { label: 'Demon Egg', icon: 'egg:demon', sub: 'x1', grant: { item: 'eggDemon' } },
]

/** Claimable once each per session, after this many minutes played. */
export const PLAYTIME_REWARDS = [
  { minutes: 5, label: '+50 Wins', icon: 'coin', grant: { coins: 50 } },
  { minutes: 10, label: 'x2 Fat', icon: 'potionFat', grant: { item: 'potionFat' } },
  { minutes: 15, label: 'Grass Egg', icon: 'egg:meadow', grant: { item: 'eggMeadow' } },
  { minutes: 30, label: 'x2 Wins', icon: 'potionCoins', grant: { item: 'potionCoins' } },
  { minutes: 45, label: '+1K Wins', icon: 'coin', grant: { coins: 1000 } },
  { minutes: 60, label: 'Sunset Egg', icon: 'egg:sunset', grant: { item: 'eggSunset' } },
]

/** The stand by spawn: a pet the first time, a potion on later sessions. */
export const FREE_REWARD = { firstTime: { pet: 'crab' }, repeat: { item: 'potionFat' } }

/** Offline snacking: a quarter of your training pad's rate, for up to 8 hours away. */
export const OFFLINE_RATE = 0.25
export const OFFLINE_MAX_MS = 8 * 60 * 60 * 1000
export const OFFLINE_MIN_MS = 60 * 1000

/**
 * The world portals (placed by PORTALS in world.js): the world each takes you to (and
 * back from), its name, and the Wins needed to step through the first time. Stepping
 * through earns the badge of the same id.
 */
export const WORLD_PORTALS = {
  future: { world: 1, name: WORLDS[1].name, coins: WORLDS[1].coins },
}

// --- Auras ------------------------------------------------------------------------

/**
 * Auras: a glow round your character that multiplies the Wins you earn. Bought from
 * the SHOP (`product`); the one you bought last is worn.
 */
export const AURAS = {
  lightning: { name: 'Lightning Aura', coins: 1.25, color: '#7fe0ff', product: 'auraLightning' },
  galaxy: { name: 'Galaxy Aura', coins: 1.5, color: '#b66bff', product: 'auraGalaxy' },
  water: { name: 'Water Aura', coins: 2, color: '#2fb4ff', product: 'auraWater' },
  fire: { name: 'Fire Aura', coins: 3, color: '#ff6a1e', product: 'auraFire' },
  rainbow: { name: 'Rainbow Aura', coins: 5, color: '#ff7ad9', product: 'auraRainbow' },
}

// --- Shop -------------------------------------------------------------------------

/**
 * The shop. Wins are the game's only currency: everything here, like foods and eggs,
 * is bought with them. `pass` = permanent unlock; `consumable` = grants every time.
 * Priced like the foods: a few dives to the stage each belongs to.
 */
export const SHOP = {
  fatX2: { name: 'x2 Fat', price: 3700, kind: 'pass' },
  coinsX2: { name: 'x2 Wins', price: 73000, kind: 'pass' },
  fatX3: { name: 'x3 Fat', price: 230000000, kind: 'pass' },
  coinsX3: { name: 'x3 Wins', price: 2500000000, kind: 'pass' },
  vip: { name: 'VIP', price: 75000000000, kind: 'pass' },
  zoneVeryOp: { name: 'VERY OP! Training Pad', price: 3300000, kind: 'pass' },
  zoneBest: { name: 'BEST OVERALL! Training Pad', price: 2500000000, kind: 'pass' },
  auraLightning: { name: 'Lightning Aura', price: 6500, kind: 'pass', aura: 'lightning' },
  auraGalaxy: { name: 'Galaxy Aura', price: 7200000, kind: 'pass', aura: 'galaxy' },
  auraWater: { name: 'Water Aura', price: 1100000000000, kind: 'pass', aura: 'water' },
  auraFire: { name: 'Fire Aura', price: 20000000000000, kind: 'pass', aura: 'fire' },
  auraRainbow: { name: 'Rainbow Aura', price: 750000000000000, kind: 'pass', aura: 'rainbow' },
  potionsFat: { name: '3 Fat Potions', price: 4400, kind: 'consumable', grant: { item: 'potionFat', amount: 3 } },
  potionsCoins: { name: '3 Wins Potions', price: 12000, kind: 'consumable', grant: { item: 'potionCoins', amount: 3 } },
  eggsSunset: { name: '3 Sunset Eggs', price: 30000, kind: 'consumable', grant: { item: 'eggSunset', amount: 3 } },
  eggsUnicorn: { name: '3 Unicorn Eggs', price: 1400000, kind: 'consumable', grant: { item: 'eggUnicorn', amount: 3 } },
  eggsDemon: { name: '3 Demon Eggs', price: 30000000000, kind: 'consumable', grant: { item: 'eggDemon', amount: 3 } },
  sphinx: { name: 'Sphinx', price: 20000000000000, kind: 'consumable', grant: { pet: 'sphinx' }, stock: 1000 },
}

/** Sphinx stock shown before the server reports the live count. */
export const SPHINX_STOCK_DEFAULT = 954

/**
 * The three Fat packs under the level bar (green, orange, pink). They grow with you:
 * each gives `share` of the Fat your next level needs, for `runs` dives' worth of Wins
 * at that Fat.
 */
export const FAT_PACKS = [
  { share: 1, runs: 0.6 },
  { share: 6, runs: 3 },
  { share: 25, runs: 10 },
]

// --- Tutorial & badges ------------------------------------------------------------

/**
 * The guide for brand-new players - all of it: eat until you're fat enough for the first
 * floor (tap, or sit at the FREE training pad), go through the STAGE gate and slam the
 * floor until it breaks, claim the Wins pad down there, and spend the Wins on better
 * food. After that, no more guides. Each step completes when its event fires (with at
 * least `fat` Fat on you, where given).
 */
export const TUTORIAL = [
  { text: 'Eat food to get FAT! Tap, or sit at the FREE table!', event: 'eat', target: 'zone0', fat: 20 },
  { text: 'Go through the STAGE gate and SLAM the floor!', event: 'floor', target: 'stage' },
  { text: 'Step on the WINS pad to claim your Wins!', event: 'wins', target: 'pad' },
  { text: 'Buy the Crispy Fries with your Wins!', event: 'buyFood', target: 'foods' },
]

/**
 * The game's Boxity leaderboards, shown on its Boxity page and behind the trophy button
 * in the game. Ids and settings are permanent once Boxity has seen them (later changes
 * are made in the Boxity dashboard). The client declares them; the server reports the
 * scores, from its own state.
 */
export const BOXITY_BOARDS = [
  { id: 'fat', label: 'Fattest', order: 'desc', mode: 'best', format: 'compact', reset: 'none' },
  { id: 'rebirths', label: 'Most Rebirths', order: 'desc', mode: 'best', format: 'number', reset: 'weekly' },
  { id: 'coins', label: 'Most Wins', order: 'desc', mode: 'sum', format: 'compact', reset: 'weekly' },
]

export const BADGES = {
  firstRun: { name: 'First Slam' },
  firstTape: { name: 'Floor Breaker' },
  firstRebirth: { name: 'First Rebirth' },
  firstPet: { name: 'Pet Owner' },
  top: { name: 'Rock Bottom' },
  future: { name: 'Time Traveller' },
}
