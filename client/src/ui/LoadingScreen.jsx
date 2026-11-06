import { useProgress } from '@react-three/drei'
import { useEffect, useState } from 'react'

import { iconUrl } from './icons'
import StrokeText from './StrokeText'

/** The title's fill: white over the top half, gold below. */
const TITLE_FILL = 'linear-gradient(180deg, #ffffff 0%, #ffffff 55%, #ffe36b 56%, #ffb21e 100%)'

const TIPS = [
  'Every bite makes you FATTER!',
  'Sit at a training pad table and you eat all by yourself.',
  'More Fat = harder slams = deeper stages = more Wins!',
  'Spend Wins on tastier food - every bite gives more Fat.',
  'Rebirth at max level for a Fat boost that lasts forever.',
  'Every slam knocks your Fat off the floor. Break it and fall through!',
  'The deeper the stage, the bigger its WINS pad!',
  'You keep your Fat after a dive - slam again and again for Wins.',
]

/**
 * Full-screen loading overlay. Progress is drei's asset loader progress, blended with a
 * time-based creep so a single large download never looks frozen, and it only reaches
 * 100% when the game reports ready (avatar in place, first frame drawn).
 *
 * @param {{ done: boolean }} props
 */
export function LoadingScreen({ done }) {
  const { progress } = useProgress()
  const [creep, setCreep] = useState(0)
  const [hidden, setHidden] = useState(false)
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)])

  useEffect(() => {
    if (done) return undefined
    const id = setInterval(() => setCreep((c) => Math.min(90, c + (90 - c) * 0.06)), 120)
    return () => clearInterval(id)
  }, [done])

  useEffect(() => {
    if (!done) return undefined
    const id = setTimeout(() => setHidden(true), 450)
    return () => clearTimeout(id)
  }, [done])

  if (hidden) return null
  const shown = done ? 100 : Math.max(creep, Math.min(95, progress * 0.95))

  return (
    <div
      className="pp-font absolute inset-0 z-[100] flex flex-col items-center justify-center gap-8 transition-opacity duration-500"
      style={{
        opacity: done ? 0 : 1,
        background: 'linear-gradient(180deg, #2f8ff2 0%, #6fc0fb 55%, #a4cdee 55.2%, #8bbbe2 100%)',
      }}
    >
      <div className="pp-loading-disc" aria-hidden="true">
        <img src={iconUrl('food')} alt="" width="150" height="150" draggable={false} />
      </div>

      {/* The title on two lines, each its own outlined text so each gets the whole white-to-gold fill;
          sized to the height too, so a phone on its side still shows the bar and the tip. */}
      <h1 className="m-0 text-center leading-none" style={{ fontSize: 'clamp(34px, min(9vw, 12vh), 96px)', transform: 'rotate(-3deg)' }}>
        <StrokeText stroke="0.16em" gradient={TITLE_FILL} style={{ fontSize: '0.62em' }}>
          FAT TO
        </StrokeText>
        <br />
        <StrokeText stroke="0.16em" gradient={TITLE_FILL}>
          BREAK FLOOR
        </StrokeText>
      </h1>

      <div className="w-[min(560px,80vw)]">
        <div className="relative h-9 overflow-hidden rounded-xl border-4 border-black bg-black/40">
          <div
            className="h-full rounded-md transition-[width] duration-200"
            style={{ width: `${shown}%`, background: 'linear-gradient(180deg, #fff27a 0%, #ffc61e 50%, #ff9a12 100%)' }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-lg">
            <StrokeText stroke={5}>{done ? 'READY!' : `LOADING ${Math.round(shown)}%`}</StrokeText>
          </div>
        </div>
        <p className="mt-4 text-center text-base md:text-lg">
          <StrokeText stroke={4}>{tip}</StrokeText>
        </p>
      </div>
    </div>
  )
}

export default LoadingScreen
