/**
 * A full-screen white flash for cuts (back to the plaza after a roll), done with a CSS
 * transition on one element the ScreenFade component registers here: no React renders.
 */
let element = null

export function setFadeElement(el) {
  element = el
}

/** A quick white flash over the screen (a floor giving way): up to `peak`, and gone. */
export function flashScreen({ peak = 0.5, inMs = 40, outMs = 280 } = {}) {
  if (!element) return
  const el = element
  el.style.transition = `opacity ${inMs}ms ease-out`
  el.style.opacity = String(peak)
  setTimeout(() => {
    el.style.transition = `opacity ${outMs}ms ease-in`
    el.style.opacity = '0'
  }, inMs)
}

/** Fades to white, runs `midway` while the screen is covered, then fades back. */
export function fadeThrough(midway, { inMs = 220, holdMs = 90, outMs = 450 } = {}) {
  if (!element) {
    midway()
    return
  }
  const el = element
  el.style.transition = `opacity ${inMs}ms ease-in`
  el.style.opacity = '1'
  setTimeout(() => {
    midway()
    setTimeout(() => {
      el.style.transition = `opacity ${outMs}ms ease-out`
      el.style.opacity = '0'
    }, holdMs)
  }, inMs)
}
