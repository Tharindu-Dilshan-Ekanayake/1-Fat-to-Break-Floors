import { actions } from '../net/actions'
import { runtime } from './runtime'

/**
 * One bite: up to the mouth, chomp chomp chomp, GULP (the Player plays it, crunches
 * and all), the "+N Fat" when the authority answers. Every click, tap, the EAT button
 * and Auto Eat come through here - anywhere, down in the stages too.
 */
export function eat() {
  runtime.player.ateAt = performance.now()
  actions.eat()
}
