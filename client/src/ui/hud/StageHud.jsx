import { useEffect, useRef } from 'react'

import { formatNumber } from '@shared/format'
import { slamsToBreak } from '@shared/logic'

import { useBloxityStore } from '../../bloxity/store'
import { STAGE_COUNT, STAGES } from '../../game/stage/course'
import { leaveStages, shownHp, stage } from '../../game/stage/stageControl'
import { STAGE_THEMES } from '../../game/stage/themes'
import { getGame, useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { ChunkyButton } from './parts'
import { GRADIENTS, u } from './style'

/** How often the frame-rate stage numbers are copied into the DOM. */
const UPDATE_MS = 1000 / 12

const stageGradient = (i) => {
  const [a, b, c] = STAGE_THEMES[STAGES[i]?.id]?.name ?? ['#ffffff', '#ffe066', '#e8a81a']
  return `linear-gradient(180deg, ${a} 0%, ${b} 45%, ${c} 100%)`
}

/**
 * The floor ahead, across the top: its stage's number and name, and its HP as a bar -
 * green, yellow, red as it goes - with what's left and how many of your slams that is.
 * Written from the frame-rate stage state by a timer, never by React.
 */
function FloorBar() {
  const titleRef = useRef(null)
  const barRef = useRef(null)
  const fillRef = useRef(null)
  const hpRef = useRef(null)
  const slamsRef = useRef(null)
  useEffect(() => {
    let shown = { title: null, width: -1, hp: null, slams: null, floor: -1, left: Infinity }
    const write = (el, text, attr) => {
      for (const span of el.querySelectorAll(`[${attr}]`)) span.textContent = text
    }
    const id = setInterval(() => {
      const i = stage.level + 1
      if (i >= STAGE_COUNT) return
      const title = `STAGE ${i + 1} · ${STAGES[i].name}`
      if (title !== shown.title && titleRef.current) {
        shown.title = title
        write(titleRef.current, title, 'data-title')
        const fill = titleRef.current.querySelector('[data-title-fill]')
        if (fill) fill.style.backgroundImage = stageGradient(i)
      }
      const max = Math.max(1, stage.max[i])
      const hp = shownHp(i)
      // Took a hit: the bar shakes and its fill flashes.
      if (i === shown.floor && hp < shown.left && barRef.current) {
        barRef.current.animate(
          [{ transform: 'translateX(0) rotate(0)' }, { transform: 'translateX(-7px) rotate(-1.2deg)' }, { transform: 'translateX(6px) rotate(1deg)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0) rotate(0)' }],
          { duration: 220, easing: 'ease-out' },
        )
        fillRef.current?.animate([{ filter: 'brightness(2.2)' }, { filter: 'brightness(1)' }], { duration: 240 })
      }
      shown.floor = i
      shown.left = hp
      const frac = Math.max(0, Math.min(1, hp / max))
      const width = Math.round(frac * 1000) / 10
      if (width !== shown.width && fillRef.current) {
        shown.width = width
        fillRef.current.style.width = `${width}%`
        fillRef.current.style.background = frac > 0.5 ? 'linear-gradient(180deg,#9dff8a,#3cf25a 55%,#19b52a)' : frac > 0.22 ? 'linear-gradient(180deg,#fff27a,#ffd21f 55%,#ff9a0a)' : 'linear-gradient(180deg,#ff9a8a,#ff4a3b 55%,#d4142a)'
      }
      const hpText = `${formatNumber(Math.ceil(hp))} / ${formatNumber(max)}`
      if (hpText !== shown.hp && hpRef.current) {
        shown.hp = hpText
        write(hpRef.current, hpText, 'data-hp')
      }
      const n = slamsToBreak(hp, getGame().profile.fat)
      const slams = n === Infinity ? 'Eat food to slam!' : `${formatNumber(n)} ${n === 1 ? 'slam' : 'slams'} to break`
      if (slams !== shown.slams && slamsRef.current) {
        shown.slams = slams
        write(slamsRef.current, slams, 'data-slams')
      }
    }, UPDATE_MS)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center" style={{ top: u(16), width: u(640), gap: u(6) }}>
      <span ref={titleRef} className="pp-text" style={{ fontSize: u(46) }}>
        <span data-title aria-hidden="true" className="pp-text-stroke" style={{ WebkitTextStrokeWidth: u(10) }} />
        <span data-title data-title-fill className="pp-text-fill" style={{ WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }} />
      </span>
      <div ref={barRef} className="relative w-full overflow-hidden" style={{ height: u(46), borderRadius: u(23), background: '#141418', border: `${u(4)} solid #141418`, boxShadow: `0 ${u(4)} 0 rgba(0,0,0,0.35)` }}>
        <div ref={fillRef} className="absolute inset-y-0 left-0" style={{ width: '100%', borderRadius: u(19), transition: 'width 120ms ease-out' }} />
        <div className="absolute inset-0 flex items-center justify-center" style={{ gap: u(8) }}>
          <span ref={hpRef} className="pp-text" style={{ fontSize: u(32) }}>
            <span data-hp aria-hidden="true" className="pp-text-stroke" style={{ WebkitTextStrokeWidth: u(8) }} />
            <span data-hp className="pp-text-fill" style={{ color: '#ffffff' }} />
          </span>
        </div>
      </div>
      <span ref={slamsRef} className="pp-text" style={{ fontSize: u(28) }}>
        <span data-slams aria-hidden="true" className="pp-text-stroke" style={{ WebkitTextStrokeWidth: u(7) }} />
        <span data-slams className="pp-text-fill" style={{ color: '#ffe14a' }} />
      </span>
    </div>
  )
}

/** The big message of the moment: a floor broken, a pad paid, or no Fat to slam with. */
function Banner() {
  const banner = useGame((s) => s.pushBanner)
  if (!banner) return null
  if (banner.kind === 'hungry') {
    return (
      <div key={banner.id} className="pp-banner pointer-events-none absolute left-1/2 top-[46%] flex flex-col items-center text-center">
        <span style={{ fontSize: u(84) }}>
          <StrokeText stroke={u(18)} gradient={GRADIENTS.priceShort}>
            TOO SKINNY!
          </StrokeText>
        </span>
        <span className="flex items-center" style={{ fontSize: u(44), gap: u(8) }}>
          <Icon name="fat" size={u(56)} />
          <StrokeText stroke={u(9)}>Eat food - your Fat is your slam power!</StrokeText>
        </span>
      </div>
    )
  }
  if (banner.kind === 'wins') {
    return (
      <div key={banner.id} className="pp-banner pointer-events-none absolute left-1/2 top-[46%] flex flex-col items-center text-center">
        <span style={{ fontSize: u(banner.last ? 100 : 92) }}>
          <StrokeText stroke={u(18)} gradient={banner.last ? GRADIENTS.rainbow : GRADIENTS.gold}>
            {banner.last ? 'ROCK BOTTOM!' : 'WINS CLAIMED!'}
          </StrokeText>
        </span>
        <span className="flex items-center" style={{ fontSize: u(70), gap: u(10) }}>
          <Icon name="coin" size={u(90)} />
          <StrokeText stroke={u(14)} gradient={GRADIENTS.gold}>
            {`+${formatNumber(banner.wins)} Wins!`}
          </StrokeText>
        </span>
      </div>
    )
  }
  // A floor broken: on into its stage.
  const i = Math.min(STAGE_COUNT - 1, banner.stage ?? 0)
  return (
    <div key={banner.id} className="pp-banner pointer-events-none absolute left-1/2 top-[46%] flex flex-col items-center text-center">
      <span style={{ fontSize: u(98) }}>
        <StrokeText stroke={u(18)} gradient={GRADIENTS.gold}>
          FLOOR BROKEN!
        </StrokeText>
      </span>
      <span style={{ fontSize: u(58) }}>
        <StrokeText stroke={u(12)} gradient={stageGradient(i)}>
          {`STAGE ${i + 1} · ${STAGES[i]?.name ?? ''}`}
        </StrokeText>
      </span>
      <span style={{ fontSize: u(34) }}>
        <StrokeText stroke={u(8)}>{banner.last ? 'The deepest stage! Claim the WINS pad!' : 'Claim the WINS pad - or slam on deeper!'}</StrokeText>
      </span>
    </div>
  )
}

/** Back to the lobby from the stages (Q on a keyboard, or Escape outside Boxity). */
function LobbyButton() {
  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat) return
      // Escape opens Boxity's menu inside Boxity (see bloxity/platform).
      if (e.code === 'KeyQ' || (e.code === 'Escape' && !useBloxityStore.getState().embedded)) leaveStages()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className="absolute" style={{ right: u(24), top: u(150) }}>
      <ChunkyButton gradient={GRADIENTS.slate} onClick={leaveStages} title="Back to the lobby (Q)" radius={10} border={4} style={{ height: u(76), padding: `0 ${u(20)}`, gap: u(10) }}>
        <Icon name="home" size={u(56)} />
        <span style={{ fontSize: u(36) }}>
          <StrokeText stroke={u(8)}>Lobby</StrokeText>
        </span>
      </ChunkyButton>
    </div>
  )
}

/**
 * Through the gate and down in the stages: the floor ahead's HP across the top, the way
 * back to the lobby (down in the rooms), and the banners.
 */
export function StageHud() {
  const inYard = useGame((s) => s.zone.yard)
  const down = useGame((s) => s.climb === 'stage')
  const deepest = useGame((s) => s.zone.stage >= STAGE_COUNT - 1)
  return (
    <>
      {(inYard || down) && !deepest && <FloorBar />}
      {down && <LobbyButton />}
      <Banner />
    </>
  )
}

export default StageHud
