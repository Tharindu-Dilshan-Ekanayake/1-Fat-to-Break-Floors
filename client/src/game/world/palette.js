import { STYLE } from '../materials'
import { PALETTE } from '../sceneStyle'

/**
 * The lobby's colours, per world. World 1 is CANDY KINGDOM (sceneStyle's PALETTE): pastel
 * pink and cream, mint lawns, chocolate mountains with icing, lollipop trees and
 * candy-cane lamps. World 2 is the same town by night - a neon diner out in space: deep indigo
 * studs, violet paving with glowing edges, teal lawns with glowing flowers, purple moon
 * rock, and pink and cyan lamps. The builders take one of these, so the whole lobby is
 * rebuilt in the other set when you go through the portal (behind the fade to black).
 */

const DAY = {
  night: false,
  /** Lollipop and cotton-candy trees, gumdrop bushes, icing on the mountains (see terrain.js, garden.js). */
  candy: true,
  /** The icing on the mountains' terraces, in turn by height. */
  icing: ['#ffffff', '#ffc2e2', '#fff3c4'],
  plaza: PALETTE.plaza,
  curb: PALETTE.curb,
  curbEdge: PALETTE.curbEdge,
  lawn: PALETTE.lawn,
  lawnEdge: '#5fd6ad',
  dirt: PALETTE.dirt,
  path: PALETTE.apron,
  pathEdge: PALETTE.apronEdge,
  /** The runway from spawn to the STAGE gate: a strawberry carpet, a lemon line and an icing edge down each side, white chevrons up it. */
  runway: '#ff6fae',
  runwayLine: '#fff07a',
  runwayEdge: '#ffffff',
  chevron: '#ffffff',
  chevronStyle: STYLE.SMOOTH,
  /** The food market yard's border: a ring of alternating tiles. */
  marketBorder: ['#ff4f9a', '#ffffff'],
  /** The training hall's front: wafer paving, and its light edge. */
  street: '#ffdcae',
  streetEdge: '#fff3e0',
  /** The food shop's yard: butterscotch, its rings a shade deeper. */
  market: '#ffe6c2',
  marketRing: '#ffd29a',
  marketCore: '#f2b77a',
  /** The town square's rings: a lemon band, strawberry paving round the plinth. */
  gold: '#fff07a',
  squareCore: '#ffc2dc',
  /** The egg plaza: its band under the egg stands, and the edge round it. */
  eggBand: '#ffeaf5',
  eggBandEdge: '#ffffff',
  rock: PALETTE.rock,
  cliff: PALETTE.cliff,
  cliffStyle: STYLE.BLOCK,
  trunk: PALETTE.trunk,
  leaves: PALETTE.leaves,
  water: PALETTE.water,
  /** A chocolate waterfall. */
  waterfall: '#7a4426',
  splash: '#b8784a',
  /** Lamp lanterns, in turn, on candy-cane posts (red, striped white). */
  lamps: ['#fff3b0', '#ffd1f0'],
  lampPost: '#ff3b5c',
  lampPostStyle: STYLE.STRIPES,
  /** Gumdrops, in turn. */
  flowers: ['#ff5a7a', '#ffe14a', '#7fe6c4', '#c27bff', '#ffffff', '#4fc3ff'],
  flowerStyle: STYLE.SMOOTH,
  /** Neon strips along the paths' edges: none by day. */
  neon: null,
  bed: '#ffffff',
  /** The training hall: wafer tiers with caramel steps, a chocolate back wall with a strawberry top. */
  hallTier: '#ffe0b3',
  hallStep: '#f2b77a',
  hallWall: '#6a3d24',
  hallTrim: '#ff6fae',
  hallBoard: '#3e2214',
}

const NIGHT = {
  night: true,
  candy: false,
  icing: null,
  plaza: '#2c2a5e',
  curb: '#4a4794',
  curbEdge: '#1d1b46',
  lawn: '#1d7a76',
  lawnEdge: '#145a5c',
  dirt: '#4a2f86',
  path: '#4b4690',
  pathEdge: '#8f86ea',
  runway: '#6b2a9c',
  runwayLine: '#ff5fd0',
  runwayEdge: '#2a2758',
  chevron: '#58f0ff',
  chevronStyle: STYLE.GLOW,
  marketBorder: ['#ff5fd0', '#2c2a66'],
  street: '#4a3470',
  streetEdge: '#ff6fd8',
  market: '#3d3a80',
  marketRing: '#4c4898',
  marketCore: '#2c2a66',
  gold: '#ffcf4a',
  squareCore: '#36346e',
  eggBand: '#433a7c',
  eggBandEdge: '#a99cff',
  rock: ['#4b4668', '#403b5c', '#57517a'],
  cliff: '#5b3b86',
  cliffStyle: STYLE.BLOCK,
  trunk: '#3b2a52',
  leaves: ['#1fb59c', '#27c9ad', '#17907c'],
  water: '#7a63ff',
  waterfall: '#8a7aff',
  splash: '#c4b8ff',
  lamps: ['#ff7ad9', '#7ff6ff'],
  lampPost: '#262044',
  lampPostStyle: STYLE.SMOOTH,
  flowers: ['#ff5ad8', '#7ff6ff', '#ffe14a', '#b47bff', '#ffffff', '#5aff9c'],
  flowerStyle: STYLE.GLOW,
  /** Neon strips along the paths' edges, in turn. */
  neon: ['#ff5fd0', '#58f0ff'],
  bed: '#5a55a8',
  hallTier: '#4b4690',
  hallStep: '#8f86ea',
  hallWall: '#2a2758',
  hallTrim: '#ff5fd0',
  hallBoard: '#120d33',
}

/** The lobby palette for world `world` (0 = World 1, 1 = World 2). */
export const lobbyPalette = (world) => (world === 1 ? NIGHT : DAY)
