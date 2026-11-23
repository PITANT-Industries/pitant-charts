import { useEffect, useMemo, useRef, useState } from 'react'
import { usePlotSize } from '../../usePlotSize'
import { cantileverModes } from './cantilever'
import type { CantileverMode, ModeShapeBeam } from './cantilever'
import '../scientific-figure.css'
import './mode-shapes.css'

export interface ModeShapesProps {
  beam: ModeShapeBeam
  label?: string
  compact?: boolean
}

const displayCycleMs = 2400
const spanFractions = [0, .25, .5, .75, 1]
const deflectionTicks = [-1.5, -1, -.5, 0, .5, 1, 1.5]
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
  const left = 54
  const right = Math.max(left + 1, width - 23)
  const top = 26
  const bottom = Math.max(top + 1, height - 42)
  const x = (fraction: number) => left + (right - left) * fraction
  const y = (displacement: number) => (top + bottom) / 2 - displacement * (bottom - top) / 3.3
  const normalizedAmplitude = scale / 100
  const frequency = frequencyFormat.format(mode.frequencyHz)
  const phaseFactor = Math.cos(phase * Math.PI / 180)
  const tipDisplacement = normalizedAmplitude * phaseFactor
  const maxIndex = mode.displacements.length - 1

  function deflectionPath(factor: number) {
    return mode.displacements.map((value, index) =>
      `${index ? 'L' : 'M'}${x(index / maxIndex).toFixed(2)} ${y(value * normalizedAmplitude * factor).toFixed(2)}`,
    ).join(' ')
  }

  const upperEnvelope = deflectionPath(1)
  const lowerEnvelope = deflectionPath(-1)
  const deformed = deflectionPath(phaseFactor)

  return (
    <div className="mode-beam scientific-plot" ref={plot}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label}, mode ${mode.number}, ${frequency} Hz, scaled deflection versus normalized span`}
        data-mode-shape-plot="">
        <g className="scientific-axis" aria-hidden="true">
          <rect className="scientific-frame" data-mode-axis-frame="" x={left} y={top} width={right - left} height={bottom - top} />
          <line className="scientific-reference" x1={left} x2={right} y1={y(0)} y2={y(0)} />
          {spanFractions.map((fraction) => (
            <g key={fraction}>
              <line className="scientific-tick" x1={x(fraction)} x2={x(fraction)} y1={bottom} y2={bottom + 4} />
              <text x={x(fraction)} y={bottom + 17} textAnchor="middle">{fraction}</text>
            </g>
          ))}
          {deflectionTicks.map((value) => (
            <g key={value}>
              <line className="scientific-tick" x1={left - 4} x2={left} y1={y(value)} y2={y(value)} />
              <text x={left - 8} y={y(value) + 4} textAnchor="end">{value}</text>
            </g>
          ))}
          <text className="scientific-panel-title" x={left} y={16}>Mode {mode.number} · {frequency} Hz</text>
          {width > 240 && <text x={right} y={16} textAnchor="end">L = {spanFormat.format(length)} m</text>}
          <text className="scientific-axis-label" x={(left + right) / 2} y={height - 6} textAnchor="middle">Normalized span, x/L</text>
          <text className="scientific-axis-label" transform={`translate(13 ${y(0)}) rotate(-90)`} textAnchor="middle">Scaled deflection, u/A₀</text>
        </g>
        <g aria-hidden="true">
          <path className="mode-envelope" d={upperEnvelope} />
          <path className="mode-envelope" d={lowerEnvelope} />
          <path className="mode-centerline" d={deformed} data-mode-deflection="" />
          <circle className="mode-tip" cx={right} cy={y(tipDisplacement)} r={2.8}
            data-mode-tip="" data-deflection={tipDisplacement} />
          {mode.nodeFractions.map((fraction) => (
            <circle key={fraction} className="mode-node" cx={x(fraction)} cy={y(0)} r={3.2} data-mode-node="" />
          ))}
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
        <>
          <ul className="mode-legend" aria-label="Figure key">
            <li>Selected phase</li>
            <li>Phase limits</li>
            <li>Interior node</li>
          </ul>
          <div className="mode-inspector">
            <output data-mode-readout="" data-mode={mode.number} data-frequency={mode.frequencyHz}
              data-phase={phaseDegrees} aria-live="off">
              <strong>{mode.nodeFractions.length} interior {mode.nodeFractions.length === 1 ? 'node' : 'nodes'}</strong>
              {mode.nodeFractions.length > 0 && (
                <span>x/L = {mode.nodeFractions.map((node) => node.toFixed(3)).join(', ')}</span>
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
          <figcaption className="mode-caption">
            <strong>Simulated cantilever beam</strong>
            <p>Computed Euler–Bernoulli bending modes. The normalized span runs from the clamp at 0 to the free tip at 1. Deflection is relative to the reference tip amplitude A₀. <a href={methodsUrl}>Model equations</a></p>
          </figcaption>
        </>
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
