import { WORLDS } from '@shared/balance'
import { STAGE_SETS } from '@shared/logic'

/**
 * The stages of the world you're in. You dive one world's stages at a time, so
 * everything down there reads them from these live bindings, and setWorld swaps them
 * when you step through a portal (the scene then rebuilds the stages: see GameScene). The
 * authority keeps a set per player instead: shared/logic STAGE_SETS.
 */
export let WORLD = 0
export let STAGE_SET = STAGE_SETS[0]
/** `{ id, name, hp, wins }` per stage, top down. */
export let STAGES = STAGE_SET.stages
export let STAGE_COUNT = STAGES.length

/** The most stages any world has: for pools sized once, whatever world you're in. */
export const MAX_STAGES = Math.max(...WORLDS.map((world) => world.stages.length))

/** Dives world `world`'s stages from now on. Returns whether that's a change. */
export function setWorld(world) {
  const set = STAGE_SETS[world] ?? STAGE_SETS[0]
  if (set === STAGE_SET) return false
  WORLD = set.index
  STAGE_SET = set
  STAGES = set.stages
  STAGE_COUNT = STAGES.length
  return true
}
