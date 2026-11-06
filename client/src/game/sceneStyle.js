/**
 * The scene's whole look in one place - CANDY KINGDOM: a toy-brick sweet shop of a world
 * under a pink-and-lavender sky with cotton-candy clouds; a pastel pink studded baseplate
 * with cream icing paths and mint lawns; chocolate mountains capped with icing all round,
 * and caramel wafer cliffs either side of the STAGE gate.
 *
 * Colours are sRGB hex, exactly as you would pick them in an image editor.
 *
 * Light intensities are three.js physical units: a light of intensity PI (~3.14)
 * lights a surface facing it to its full texture colour. The hemisphere fill plus the
 * sun add up to just over that on the ground, which is what keeps the colours vivid;
 * shadowed ground only gets the fill, so shadows read as a softer, darker shade.
 */

export const SKY = {
  /** Straight up: soft lavender. */
  top: '#9d8cff',
  /** At eye level: candy-floss pink. Fog uses the same colour so distant ground melts into the sky. */
  horizon: '#ffd3ec',
  /** Lower = the lavender reaches further down towards the horizon. */
  exponent: 0.5,
}

export const FOG = {
  color: SKY.horizon,
}

export const CLOUDS = {
  /** Sunlit tops. */
  top: '#ffffff',
  /** Undersides: cotton-candy pink. */
  bottom: '#ffb8de',
}

/** Every surface colour in the lobby. */
export const PALETTE = {
  /** The baseplate: pastel pink studs. */
  plaza: '#ffd9ea',
  /** Raised kerbs round the lawns - white icing - and the pink edge painted along them. */
  curb: '#ffffff',
  curbEdge: '#ff9ccb',
  /** Mint lawns, with patches of strawberry floss. */
  lawn: '#86ebc8',
  dirt: '#ffb3d6',
  /** Cream icing paths and their bright edge. */
  apron: '#fff1dc',
  apronEdge: '#ffffff',
  shopFloor: '#f3c9a3',
  /** Chocolate mountains (three bars' worth of shades), and the caramel wafer cliffs either side of the gate. */
  rock: ['#7b4a2d', '#6a3d24', '#8c5836'],
  cliff: '#f0a85e',
  /** Lollipop sticks and the lollipops and floss on them. */
  trunk: '#fff8f0',
  leaves: ['#ff5fa8', '#ffd23f', '#7fe6c4', '#a98bff', '#ff8a5c'],
  white: '#fff8f0',
  /** The chocolate pool at the foot of the chocolate waterfall. */
  water: '#7a4426',
}

export const LIGHTS = {
  /** Fill from above (sky) and below (bounce off the grass). */
  hemiSky: '#fff6fc',
  /** Pink light bouncing up off the baseplate. */
  hemiGround: '#f3c3dc',
  hemiIntensity: 2.1,

  sunColor: '#fff2e4',
  sunIntensity: 1.65,
  /**
   * Direction *towards* the sun: high and a little to the left, behind the default
   * camera, so the side of the character you look at is lit and its shadow falls
   * beside it where you can see it, not hidden behind its back.
   */
  sunDirection: [-0.35, 0.9, 0.25],
  /** 1 = shadows get no sunlight at all; lower = lighter shadows. */
  shadowIntensity: 0.7,
  /** Blur radius of shadow edges, in shadow-map texels. */
  shadowSoftness: 3,
}
