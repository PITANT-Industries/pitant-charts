import { describe, expect, it, vi } from 'vitest'
import {
  buildSpectrumCommandFrame,
  buildSpectrumRenderPlan,
  ChartPluginLifecycle,
  commandFrameToSvg,
  renderSpectrumPlan,
} from '../index.js'
import type { RenderContext } from '../renderer/types.js'

describe('chart frame plugins', () => {
  it('keeps mounted plugin identities across updates and cleans up in reverse order', () => {
    const context = {} as RenderContext
    const calls: string[] = []
    const plugin = (name: string) => ({
      mount: (activeContext: RenderContext) => {
        expect(activeContext).toBe(context)
        calls.push(`mount ${name}`)
        return () => calls.push(`dispose ${name}`)
      },
    })
    const first = plugin('first')
    const second = plugin('second')
    const third = plugin('third')
    const plugins = new ChartPluginLifecycle(context)
    plugins.update([first, second, second])
    plugins.update([second, third])
    plugins.dispose()
    plugins.dispose()
    expect(calls).toEqual([
      'mount first',
      'mount second',
      'mount third',
      'dispose first',
      'dispose third',
      'dispose second',
    ])
  })

  it('exports added commands and runs native hooks in rendering order', () => {
    const plan = buildSpectrumRenderPlan({ series: [] })
    const calls: string[] = []
    const plugins = [
      {
        extendFrame: (frame: ReturnType<typeof buildSpectrumCommandFrame>) => {
          calls.push('extend')
          frame.commands.addText('Plugin label', 12, 20, { color: [0, 0, 0, 1] })
        },
        beforeDraw: () => calls.push('before'),
        afterDraw: () => calls.push('after'),
      },
    ]
    const svg = commandFrameToSvg(buildSpectrumCommandFrame(plan, 400, 250, { plugins }))
    expect(svg).toContain('Plugin label')
    expect(calls).toEqual(['extend'])
    const context = {
      width: 400,
      height: 250,
      beginFrame: vi.fn(),
      endFrame: vi.fn(),
      setTransform: vi.fn(),
      drawText: () => calls.push('draw'),
    } as unknown as RenderContext
    renderSpectrumPlan(context, plan, { plugins })
    expect(calls).toEqual(['extend', 'extend', 'before', 'draw', 'after'])
    expect(context.endFrame).toHaveBeenCalledOnce()
  })
})
