import { useEffect, useMemo, useRef, useState } from 'react'
import { usePlotSize } from '../../usePlotSize'
import { cantileverModes } from './cantilever'
import type { CantileverMode, ModeShapeBeam } from './cantilever'
import './mode-shapes.css'

export interface ModeShapesProps {
  beam: ModeShapeBeam
  label?: string
  compact?: boolean
}

const displayCycleMs = 2400
const spanFractions = [0, .25, .5, .75, 1]
const frequencyFormat = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 4 })
const spanFormat = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 3 })
const methodsUrl = 'https://ntrs.nasa.gov/citations/20090021633'

function BeamPlot({ mode, phase, scale, length, compact, label }: {
  mode: CantileverMode
  phase: number
  scale: number
  length: number
  compact: boolean
  label: string
}) {
  const { plot, width, height } = usePlotSize<HTMLDivElement>(compact ? 480 : 780, compact ? 210 : 290)
  const left = 32
  const right = Math.max(left + 1, width - 23)
  const top = 29
  const bottom = Math.max(top + 1, height - 36)
  const neutral = (top + bottom) / 2
  const maxDisplacement = (bottom - top) * .45 * scale / 150
  const x = (fraction: number) => left + (right - left) * fraction
  const frequency = frequencyFormat.format(mode.frequencyHz)
  const phaseFactor = Math.cos(phase * Math.PI / 180)
  const maxIndex = mode.displacements.length - 1

  function deflectionPath(factor: number) {
    return mode.displacements.map((value, index) =>
      `${index ? 'L' : 'M'}${x(index / maxIndex).toFixed(2)} ${(neutral - value * maxDisplacement * factor).toFixed(2)}`,
    ).join(' ')
  }

  const upperEnvelope = deflectionPath(1)
  const lowerEnvelope = deflectionPath(-1)
  const deformed = deflectionPath(phaseFactor)

  return (
    <div className="mode-beam" ref={plot}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label}, mode ${mode.number}, ${frequency} Hz`}
        data-mode-shape-plot="">
        <g className="mode-grid" aria-hidden="true">
          {spanFractions.map((fraction) => <line key={fraction} x1={x(fraction)} x2={x(fraction)} y1={top} y2={bottom} />)}
          {spanFractions.map((fraction) => {
            const height = top + (bottom - top) * fraction
            return <line key={fraction} x1={left} x2={right} y1={height} y2={height} />
          })}
          <line className="mode-neutral" x1={left} x2={right} y1={neutral} y2={neutral} />
        </g>
        <g aria-hidden="true">
          <path className="mode-envelope" d={upperEnvelope} />
          <path className="mode-envelope" d={lowerEnvelope} />
          <path className="mode-centerline" d={deformed} data-mode-deflection="" />
          <circle className="mode-tip" cx={right} cy={neutral - maxDisplacement * phaseFactor} r={4} />
          <line className="mode-restraint" x1={left} x2={left} y1={neutral - 19} y2={neutral + 19} />
          {[-14, -7, 0, 7, 14].map((offset) => (
            <line className="mode-hatch" key={offset} x1={left - 9} x2={left - 1}
              y1={neutral + offset + 5} y2={neutral + offset - 3} />
          ))}
          {mode.nodeFractions.map((fraction) => (
            <circle key={fraction} className="mode-node" cx={x(fraction)} cy={neutral} r={4} data-mode-node="" />
          ))}
        </g>
        <g className="mode-plot-label" aria-hidden="true">
          <text x={left} y={17}>Mode {mode.number} · {frequency} Hz</text>
          <text x={left} y={height - 17}>Clamped</text>
          <text x={right} y={height - 17} textAnchor="end">Free end · {spanFormat.format(length)} m</text>
        </g>
      </svg>
    </div>
  )
}

function ModeShapeFigure({ beam, modes, label, compact }: Required<ModeShapesProps> & { modes: readonly CantileverMode[] }) {
  const [selectedMode, setSelectedMode] = useState(3)
  const [phase, setPhase] = useState(0)
  const [scale, setScale] = useState(100)
  const [playing, setPlaying] = useState(false)
  const phaseRef = useRef(0)
  const mode = modes[compact ? 2 : selectedMode - 1]

  useEffect(() => {
    if (!playing || compact) return
    const initial = phaseRef.current
    let start: number | undefined
    let frame: number
    function animate(now: number) {
      start ??= now
      const next = (initial + ((now - start) / displayCycleMs) * 360) % 360
      phaseRef.current = next
      setPhase(next)
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [playing, compact])

  function scrubPhase(next: number) {
    setPlaying(false)
    phaseRef.current = next
    setPhase(next)
  }

  const phaseDegrees = Math.round(phase)
  return (
    <figure className="mode-shapes" data-mode-shapes="" data-compact={compact}>
      {!compact && (
        <>
          <figcaption className="mode-caption">
            <strong>Simulated cantilever beam</strong>
            <p>Computed bending modes for a uniform rectangular beam. The dotted lines show peak deflection in both directions. <a href={methodsUrl}>Model equations</a></p>
          </figcaption>
          <div className="mode-choices" role="group" aria-label="Natural bending modes">
            {modes.map((candidate) => (
              <button type="button" key={candidate.number} aria-label={`Mode ${candidate.number}`}
                aria-description={`${frequencyFormat.format(candidate.frequencyHz)} hertz`}
                aria-pressed={mode.number === candidate.number} onClick={() => setSelectedMode(candidate.number)}>
                <span>Mode {candidate.number}</span>
                <strong>{frequencyFormat.format(candidate.frequencyHz)} Hz</strong>
              </button>
            ))}
          </div>
        </>
      )}
      <BeamPlot mode={mode} phase={compact ? 0 : phase} scale={compact ? 100 : scale}
        length={beam.lengthM} label={label} compact={compact} />
      {!compact && (
        <div className="mode-inspector">
          <output data-mode-readout="" data-mode={mode.number} data-frequency={mode.frequencyHz}
            data-phase={phaseDegrees} aria-live="off">
            <strong>{mode.nodeFractions.length} interior {mode.nodeFractions.length === 1 ? 'node' : 'nodes'}</strong>
            {mode.nodeFractions.length > 0 && (
              <span>At {mode.nodeFractions.map((node) => `${(node * 100).toFixed(1)}%`).join(', ')} of span from the clamp</span>
            )}
          </output>
          <div className="mode-controls">
            <button type="button" onClick={() => setPlaying((current) => !current)}>
              {playing ? 'Pause deformation' : 'Play deformation'}
            </button>
            <label>
              <span>Oscillation phase <span>{phaseDegrees}°</span></span>
              <input type="range" min={0} max={360} step={1} value={phaseDegrees} aria-label="Oscillation phase"
                aria-valuetext={`${phaseDegrees} degrees`} onChange={(event) => scrubPhase(event.currentTarget.valueAsNumber)} />
            </label>
            <label>
              <span>Deformation scale <span>{scale}%</span></span>
              <input type="range" min={25} max={150} step={5} value={scale} aria-label="Deformation scale"
                aria-valuetext={`${scale} percent`} onChange={(event) => setScale(event.currentTarget.valueAsNumber)} />
            </label>
          </div>
        </div>
      )}
    </figure>
  )
}

export function ModeShapes({ beam, label = 'Cantilever beam bending mode', compact = false }: ModeShapesProps) {
  const modes = useMemo(() => cantileverModes(beam), [beam])
  if (!modes.length) {
    return <p className="chart-render-message" role="status">Provide positive, finite beam dimensions, elastic modulus, and density.</p>
  }
  return <ModeShapeFigure beam={beam} label={label} compact={compact} modes={modes} />
}
