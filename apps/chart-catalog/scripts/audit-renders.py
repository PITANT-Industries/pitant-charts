"""Check the public documentation and render every catalog example across viewport and theme profiles."""

import argparse
import asyncio
import json
import math
import os
import re
from pathlib import Path
from urllib.parse import urlencode, urljoin, urlsplit

from playwright.async_api import async_playwright, expect


CATALOG = Path(__file__).resolve().parents[1] / 'src/catalog-data.json'
PROFILES = [
    (f'{size}-{theme}', width, height, theme)
    for size, width, height in [('desktop', 1440, 900), ('mobile', 390, 844)]
    for theme in ['light', 'dark']
]
DOC_SECTIONS = {
    'introduction': 'Introduction',
    'components': 'Components',
    'installation': 'Installation',
    'theming': 'Theming',
    'cli': 'CLI',
    'registry': 'Registry',
    'skills': 'Skills',
    'changelog': 'Changelog',
}


async def check_chart_output(plot):
    await expect(plot.locator('.chart-preview')).to_be_visible()
    await expect(plot.locator('.chart-preview').locator('svg:visible, canvas:visible, table:visible').first).to_be_visible()
    await expect(plot.locator('.chart-render-message')).to_have_count(0)


async def check_public_preview(browser, local_url, example):
    page = await browser.new_page()
    try:
        slug = example['id']
        preview_url = f'{local_url}#{urlencode({"example": slug})}'
        legacy_url = f'{preview_url}&view=compare&review=all'
        await page.goto(legacy_url, wait_until='domcontentloaded', timeout=20000)
        await page.wait_for_url(preview_url, timeout=8000)
        dialog = page.get_by_role('dialog')
        await dialog.get_by_role('heading', name=example['title'], exact=True).wait_for(timeout=8000)
        await dialog.get_by_role('tab', name='Preview', selected=True).wait_for(timeout=8000)
        if await dialog.locator('iframe').count() or await dialog.get_by_role('tab').count() != 2:
            raise RuntimeError('Expected only the public Preview and Code tabs')
        await page.keyboard.press('Escape')
        await dialog.wait_for(state='hidden', timeout=8000)
        await page.get_by_role('button', name='Open chart categories').click(timeout=8000)
        menu = page.get_by_role('navigation', name='Chart categories')
        await menu.wait_for(timeout=8000)
        if await menu.get_by_text('Parity review', exact=True).count() or await menu.get_by_text('Reference gallery', exact=True).count():
            raise RuntimeError('Internal controls appeared in the public catalog menu')
    finally:
        await page.close()


async def check_gallery_documentation(browser, local_url, example):
    page = await browser.new_page(viewport={'width': 320, 'height': 568}, reduced_motion='reduce')
    try:
        slug = example['id']
        fragment = urlencode({'docs': example['family'], 'variant': slug})
        await page.goto(local_url, wait_until='domcontentloaded', timeout=20000)
        catalog = page.locator('#catalog')
        tile = page.locator(f'.hero .example-card[data-example-id="{slug}"]')
        link = tile.locator('a.example-card-link').and_(
            tile.get_by_role('link', name=f'Documentation for {example["title"]}', exact=True),
        )
        await expect(link).to_have_attribute('href', f'#{fragment}', timeout=8000)
        await expect(link).not_to_have_attribute('title', re.compile('.+'))
        plot = tile.locator('.card-plot[inert]')
        await plot.locator('svg, canvas').first.wait_for(state='visible', timeout=8000)
        await page.evaluate('document.fonts.ready.then(() => true)')
        await expect(tile).to_be_in_viewport(ratio=1)
        if await page.evaluate('window.scrollY') != 0:
            raise RuntimeError('The featured chart must fit on the first screen without scrolling')
        await link.hover(timeout=8000)
        await expect(tile.get_by_role('link')).to_have_count(1)
        await expect(tile.locator('button:visible, [role="tooltip"]:visible, .line-detail-tooltip:visible')).to_have_count(0)
        await expect(catalog.get_by_role('button', name=re.compile(r'copy|view code', re.I))).to_have_count(0)
        await expect(catalog.get_by_role('tooltip')).to_have_count(0)

        await link.click(timeout=8000)
        await page.wait_for_url(f'{local_url}#{fragment}', timeout=8000)
        await expect(page.locator('dialog[open]')).to_have_count(0)
        preview = page.locator('#docs-preview')
        await check_chart_output(preview.locator(f'.docs-example-plot[data-example-id="{slug}"]'))
        await preview.get_by_role('tab', name='Code', exact=True).click(timeout=8000)
        await expect(preview.locator('pre code')).to_contain_text(f"getExample('{slug}')", timeout=8000)
        await expect(preview.get_by_role('button', name='Copy code', exact=True)).to_be_visible()
        await page.get_by_role('button', name='Open Sidebar', exact=True).click()
        mobile_sidebar = page.locator('#nd-sidebar-mobile')
        await mobile_sidebar.get_by_role('link', name='Installation', exact=True).click()
        await expect(page.locator('#family-docs-title')).to_have_text('Installation')
        await expect(mobile_sidebar).not_to_be_visible()
    finally:
        await page.close()


async def check_complete_gallery(browser, local_url, examples):
    page = await browser.new_page(viewport={'width': 1440, 'height': 900}, reduced_motion='reduce')
    try:
        await page.goto(local_url, wait_until='domcontentloaded')
        cards = page.locator('.example-card-link')
        await expect(cards).to_have_count(len(examples))
        expected = {f"#{urlencode({'docs': example['family'], 'variant': example['id']})}" for example in examples}
        hrefs = await cards.evaluate_all("(links) => links.map(link => link.getAttribute('href'))")
        if set(hrefs) != expected:
            raise RuntimeError('Every example must have its own chart card and documentation link')

        first_plot = page.locator('.example-card--featured .card-plot')
        last_plot = page.locator('.example-grid .example-card').last.locator('.card-plot')
        await check_chart_output(first_plot)
        await expect(last_plot.locator('.chart-preview')).to_have_count(0)
        await cards.last.scroll_into_view_if_needed()
        await check_chart_output(last_plot)
        await expect(first_plot.locator('.chart-preview')).to_have_count(0)

        await page.get_by_role('button', name='List view', exact=True).click()
        rows = page.locator('.example-list-row')
        await expect(rows).to_have_count(len(examples))
        hrefs = await rows.evaluate_all("(links) => links.map(link => link.getAttribute('href'))")
        if set(hrefs) != expected:
            raise RuntimeError('Every example must also be reachable from list view')
    finally:
        await page.close()


async def check_docs_navigation(browser, local_url, catalog):
    page = await browser.new_page(viewport={'width': 1440, 'height': 900}, reduced_motion='reduce')
    try:
        await page.goto(local_url, wait_until='domcontentloaded')
        await page.get_by_role('navigation', name='PITANT Charts sections').get_by_role('link', name='Documentation', exact=True).click()
        sidebar = page.locator('#nd-sidebar')
        title = page.locator('#nd-page #family-docs-title')
        for section, name in DOC_SECTIONS.items():
            link = sidebar.get_by_role('link', name=name, exact=True)
            await expect(link).to_have_attribute('href', f'#docs={section}')
            await link.click()
            await page.wait_for_url(f'{local_url}#docs={section}')
            await expect(title).to_have_text(name)
            await expect(link).to_have_attribute('aria-current', 'page')
            await expect(page.locator('#nd-page .pitant-docs-body')).not_to_be_empty()

        await sidebar.get_by_role('link', name='Installation', exact=True).click()
        commands = page.locator('#nd-page .docs-package-managers').first
        for manager, prefix in [('npm', 'npm install'), ('pnpm', 'pnpm add'), ('yarn', 'yarn add'), ('bun', 'bun add')]:
            tab = commands.get_by_role('tab', name=manager, exact=True)
            await tab.click()
            await expect(tab).to_have_attribute('aria-selected', 'true')
            await expect(commands.get_by_role('tabpanel').locator('pre code')).to_contain_text(prefix)

        await sidebar.locator('[data-search-full]').click()
        search = page.get_by_role('dialog')
        search_input = search.get_by_role('combobox', name='Search documentation')
        await search_input.fill('spectral waterfall')
        await expect(search.get_by_role('option', name='Spectral waterfall', exact=False)).to_be_visible()
        await search_input.press('Enter')
        await page.wait_for_url(f'{local_url}#docs=spectral-waterfall')
        await expect(search).not_to_be_visible()

        line = next(family for family in catalog if family['id'] == 'line')
        fragment = urlencode({'docs': 'line', 'variant': 'line-time-range'})
        await page.goto(f'{local_url}#{fragment}', wait_until='domcontentloaded')
        range_plot = page.locator('#docs-preview .docs-example-plot[data-example-id="line-time-range"]')
        await check_chart_output(range_plot)
        await expect(range_plot.locator('[data-line-axis] text').last).to_be_in_viewport(ratio=1)
        if await range_plot.evaluate('(plot) => plot.scrollHeight - plot.clientHeight > 1'):
            raise RuntimeError('The time-range preview should show its date axis without an inner scrollbar')
        toc = page.locator('#nd-toc')
        await toc.get_by_role('link', name='Examples', exact=True).click()
        section_url = f'{local_url}#{fragment}&section=docs-examples-title'
        await page.wait_for_url(section_url)
        await expect(page.locator('#docs-examples-title')).to_be_in_viewport()
        await page.reload(wait_until='domcontentloaded')
        await expect(page.locator('#docs-examples-title')).to_be_in_viewport()
        last_example = line['examples'][-1]
        inline_plot = page.locator(f'#docs-examples .docs-example-plot[data-example-id="{last_example["id"]}"]')
        await inline_plot.scroll_into_view_if_needed()
        await check_chart_output(inline_plot)
        inline_tabs = page.get_by_role('tablist', name=f'{last_example["title"]} example view', exact=True)
        await inline_tabs.get_by_role('tab', name='Code', exact=True).click()
        await expect(page.locator('#docs-examples pre code')).to_contain_text(f"getExample('{last_example['id']}')")
        await inline_tabs.get_by_role('tab', name='Preview', exact=True).click()
        await check_chart_output(inline_plot)

        for family in catalog:
            await page.goto(f'{local_url}#docs={family["id"]}', wait_until='domcontentloaded')
            await expect(title).to_have_text(family['name'])
            plots = page.locator('#nd-page .docs-example-plot[data-example-id]')
            await expect(plots).to_have_count(len(family['examples']))
            shown = await plots.evaluate_all('(plots) => plots.map(plot => plot.dataset.exampleId)')
            if set(shown) != {example['id'] for example in family['examples']}:
                raise RuntimeError(f'Incomplete inline examples for {family["id"]}')

        response = await page.request.get(urljoin(local_url, 'r/registry.json'))
        if not response.ok:
            raise RuntimeError(f'Chart registry returned HTTP {response.status}')
        registry = await response.json()
        if not registry['items']:
            raise RuntimeError('The chart registry must list installable chart blocks')
        for item in registry['items']:
            response = await page.request.get(urljoin(local_url, f'r/{item["name"]}.json'))
            if not response.ok:
                raise RuntimeError(f'Chart registry block {item["name"]} returned HTTP {response.status}')
            block = await response.json()
            if block['name'] != item['name'] or not block['files'] or not all(file.get('content') for file in block['files']):
                raise RuntimeError(f'Chart registry block {item["name"]} is missing source files')
    finally:
        await page.close()


async def check_scientific_catalog(browser, local_url, catalog):
    families = {
        'mass-spectrum', 'spectrum', 'spectrogram', 'spectral-waterfall', 'correlation-matrix',
        'process-control', 'campbell-diagram', 'mode-shapes', 'shaft-orbit', 'frequency-response',
    }
    examples = [example for family in catalog if family['id'] in families for example in family['examples']]
    for width, height, theme in [(390, 844, 'light'), (1440, 900, 'dark')]:
        await check_scientific_profile(browser, local_url, examples, width, height, theme)


async def check_scientific_profile(browser, local_url, examples, width, height, theme):
    touch = width < 768
    page = await browser.new_page(viewport={'width': width, 'height': height}, has_touch=touch, reduced_motion='reduce')
    try:
        await page.goto(local_url, wait_until='domcontentloaded', timeout=20000)
        if theme == 'dark':
            await page.get_by_role('button', name='Dark theme').click()
        rail = page.get_by_role('navigation', name='Popular chart families')
        await rail.get_by_role('button', name='Scientific analysis').click(timeout=8000)
        await page.wait_for_url(f'{local_url}#category=scientific', timeout=8000)
        grid = page.locator('.example-grid--scientific')
        await expect(grid.locator('.example-card-link')).to_have_count(len(examples))
        for index, slug in enumerate(['mass-spectrum-cms', 'spectral-waterfall-xrd']):
            await expect(grid.locator('.example-card').nth(index)).to_have_attribute('data-example-id', slug)
        for example in examples:
            card = grid.locator(f'.example-card[data-example-id="{example["id"]}"]')
            await card.scroll_into_view_if_needed()
            await expect(card.locator('.example-card-title')).to_have_text(example['title'])
            card_plot = card.locator('.card-plot[inert]')
            await check_chart_output(card_plot)
            await expect(card.locator('button:visible, input:visible, [role="tooltip"]:visible')).to_have_count(0)
            if example['family'] == 'campbell-diagram':
                await check_campbell_figure(card_plot.locator('[data-campbell-heatmap]'), compact=True)
                await expect(card_plot.locator('select, output[data-campbell-readout]')).to_have_count(0)
            elif example['family'] == 'mode-shapes':
                await check_mode_shape_figure(card_plot.locator('[data-mode-shape-plot]'))
                await expect(card_plot.locator('[data-mode-readout]')).to_have_count(0)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=mode-shapes&variant=mode-shapes-cantilever'
                )
            elif example['family'] == 'shaft-orbit':
                await check_shaft_orbit_figure(card_plot.locator('svg[data-orbit-plot]'), compact=True)
                await expect(card_plot.locator('select, [data-orbit-waveforms], [data-orbit-readout]')).to_have_count(0)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=shaft-orbit&variant=shaft-orbit-probes'
                )
            elif example['family'] == 'frequency-response':
                nyquist = card_plot.locator('svg[data-nyquist-plot]')
                await expect(nyquist).to_be_visible()
                await expect(nyquist.locator('path[data-response-trace]')).to_have_attribute('d', re.compile(r'^M'))
                await expect(card_plot.locator('select, [data-bode-magnitude], [data-bode-phase], [data-response-readout]')).to_have_count(0)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=frequency-response&variant=frequency-response-servo'
                )
        await grid.locator('.example-card-link').first.click(timeout=8000)
        await page.wait_for_url(f'{local_url}#docs=mass-spectrum&variant=mass-spectrum-cms', timeout=8000)

        for example in examples:
            slug = example['id']
            fragment = urlencode({'docs': example['family'], 'variant': slug})
            if page.url != f'{local_url}#{fragment}':
                await page.goto(f'{local_url}#{fragment}', wait_until='domcontentloaded', timeout=20000)
            await page.wait_for_url(f'{local_url}#{fragment}', timeout=8000)
            preview = page.locator('#docs-preview')
            plot = preview.locator(f'.docs-example-plot[data-example-id="{slug}"]')
            await check_chart_output(plot)
            await expect(plot.locator('figcaption a').first).to_be_visible()
            if await plot.evaluate('el => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1'):
                raise RuntimeError(f'{theme} {width}px {slug}: chart, controls, and source must fit the preview')
            if await plot.evaluate("el => ['auto', 'scroll'].includes(getComputedStyle(el).overflowY)"):
                raise RuntimeError(f'{slug} must use page scrolling for its preview')
            await expect(page.get_by_role('list', name='Data sources')).to_be_visible()
            if example['family'] == 'spectral-waterfall':
                await check_spectral_waterfall(plot, slug)
                code_import = 'SpectralWaterfall'
            elif example['family'] == 'mass-spectrum':
                await check_particle_mass_spectrum(plot)
                code_import = "getExample('mass-spectrum-cms')"
            elif example['family'] == 'campbell-diagram':
                await check_campbell_diagram(plot, touch)
                code_import = 'CampbellDiagram'
            elif example['family'] == 'mode-shapes':
                await check_mode_shapes(plot, touch)
                code_import = 'ModeShapes'
            elif example['family'] == 'shaft-orbit':
                await check_shaft_orbit(plot, touch)
                code_import = 'ShaftOrbit'
            elif example['family'] == 'frequency-response':
                await check_frequency_response(plot, touch)
                code_import = 'FrequencyResponse'
            elif slug == 'spectrogram-measured':
                await check_mauna_loa_spectrogram(plot, touch)
                code_import = '@pitant/charts-react'
            else:
                await check_native_scientific(plot, slug, touch)
                code_import = '@pitant/charts-react'
            await preview.get_by_role('tab', name='Code', exact=True).click(timeout=8000)
            await expect(preview.locator('pre code')).to_contain_text(code_import)
            await expect(preview.get_by_role('button', name='Copy code', exact=True)).to_be_visible()
    finally:
        await page.close()


async def check_campbell_figure(heatmap, compact=False):
    await expect(heatmap).to_be_visible()
    await expect(heatmap.locator('[data-campbell-raster]')).to_have_attribute('href', re.compile(r'^data:image/png;base64,'))
    await expect(heatmap.locator('rect[data-campbell-axis-frame]')).to_be_visible()
    await expect(heatmap.locator('.scientific-tick').first).to_be_attached()
    colorbar = heatmap.locator('[data-campbell-colorbar]')
    await expect(colorbar.locator('rect[fill^="url("]')).to_be_visible()
    await expect(colorbar.get_by_text('Relative amplitude (dB)', exact=True)).to_be_visible()
    await expect(colorbar.get_by_text(re.compile(r'^[−-]60$'))).to_be_visible()
    await expect(colorbar.get_by_text('0', exact=True)).to_be_visible()
    await expect(colorbar.locator('text')).to_have_count(4 if compact else 5)
    clipped_label = await colorbar.evaluate("""bar => {
      const figure = bar.ownerSVGElement.getBoundingClientRect()
      return Array.from(bar.querySelectorAll('text')).find(label => {
        const box = label.getBoundingClientRect()
        return box.left < figure.left - 1 || box.right > figure.right + 1 ||
          box.top < figure.top - 1 || box.bottom > figure.bottom + 1
      })?.textContent
    }""")
    if clipped_label:
        raise RuntimeError(f'The Campbell color scale label {clipped_label!r} extends beyond the figure')


async def check_campbell_diagram(plot, touch):
    heatmap = plot.locator('[data-campbell-heatmap]')
    await check_campbell_figure(heatmap)
    spectrum = plot.locator('[data-campbell-spectrum]')
    await expect(spectrum).to_be_visible()
    trace = spectrum.locator('[data-campbell-spectrum-path]')
    await expect(trace).to_have_attribute('d', re.compile(r'^M'))
    readout = plot.locator('output[data-campbell-readout]')
    await expect(readout).to_be_visible()
    speed = plot.get_by_role('slider', name='Shaft speed', exact=True)
    frequency = plot.get_by_role('slider', name='Frequency', exact=True)
    bearing = plot.get_by_role('combobox', name='Bearing condition', exact=True)
    options = bearing.locator('option')
    await expect(options).to_have_count(2)
    initial_bearing = await bearing.input_value()
    option_values = await options.evaluate_all('(options) => options.map(option => option.value)')
    if len(set(option_values)) != 2 or initial_bearing not in option_values:
        raise RuntimeError('The Campbell diagram should offer two distinct bearing conditions')
    alternate_bearing = next(value for value in option_values if value != initial_bearing)

    await speed.press('Home')
    start_rpm = await readout.get_attribute('data-rpm')
    start_spectrum = await trace.get_attribute('d')
    await speed.press('End')
    await expect(readout).not_to_have_attribute('data-rpm', start_rpm)
    end_rpm = await readout.get_attribute('data-rpm')
    if not float(end_rpm) > float(start_rpm):
        raise RuntimeError(f'Increasing shaft speed should raise RPM, observed {start_rpm} to {end_rpm}')
    await expect(trace).not_to_have_attribute('d', start_spectrum)

    await frequency.press('Home')
    start_frequency = await readout.get_attribute('data-frequency')
    await frequency.press('End')
    await expect(readout).not_to_have_attribute('data-frequency', start_frequency)
    end_frequency = await readout.get_attribute('data-frequency')
    if not float(end_frequency) > float(start_frequency):
        raise RuntimeError(f'Increasing frequency should raise Hz, observed {start_frequency} to {end_frequency}')
    await expect(readout).to_have_attribute('data-rpm', end_rpm)

    await speed.press('Home')
    await frequency.press('Home')
    target = heatmap.locator('.campbell-pick')
    bounds = await target.bounding_box()
    position = {'x': bounds['width'] * 0.9, 'y': bounds['height'] * 0.1}
    if touch:
        await target.tap(position=position)
    else:
        await target.click(position=position)
    await expect(readout).not_to_have_attribute('data-rpm', start_rpm)
    await expect(readout).not_to_have_attribute('data-frequency', start_frequency)

    await speed.press('Home')
    await frequency.press('Home')
    initial_spectrum = await trace.get_attribute('d')
    await bearing.select_option(alternate_bearing)
    await expect(bearing).to_have_value(alternate_bearing)
    await speed.press('Home')
    await frequency.press('Home')
    await expect(trace).not_to_have_attribute('d', initial_spectrum)


async def check_mode_shape_figure(beam):
    await expect(beam).to_be_visible()
    await expect(beam.locator('rect[data-mode-axis-frame]')).to_be_visible()
    await expect(beam.locator('.scientific-tick').first).to_be_attached()
    await expect(beam.get_by_text('Normalized span, x/L', exact=True)).to_be_visible()
    await expect(beam.get_by_text('Scaled deflection, u/A₀', exact=True)).to_be_visible()


async def check_mode_shapes(plot, touch):
    chart = plot.locator('[data-mode-shapes]')
    beam = chart.locator('[data-mode-shape-plot]')
    await check_mode_shape_figure(beam)
    deflection = chart.locator('[data-mode-deflection]')
    await expect(deflection).to_have_attribute('d', re.compile(r'^M'))
    readout = chart.locator('[data-mode-readout]')
    await expect(readout).to_be_visible()
    first_mode = chart.get_by_role('button', name='Mode 1', exact=True)
    third_mode = chart.get_by_role('button', name='Mode 3', exact=True)
    phase = chart.get_by_role('slider', name='Oscillation phase', exact=True)
    scale = chart.get_by_role('slider', name='Deformation scale', exact=True)
    play = chart.get_by_role('button', name='Play deformation', exact=True)
    pause = chart.get_by_role('button', name='Pause deformation', exact=True)
    await expect(play).to_be_visible()
    await expect(chart.get_by_role('button', name=re.compile(r'^Mode [1-4]$'))).to_have_count(4)
    await expect(third_mode).to_have_attribute('aria-pressed', 'true')
    await expect(readout).to_have_attribute('data-mode', '3')
    initial_frequency = await readout.get_attribute('data-frequency')
    if initial_frequency is None or not abs(float(initial_frequency) - 119.2323) <= 0.001:
        raise RuntimeError(f'Mode 3 should have a frequency of 119.2323 Hz, observed {initial_frequency}')

    tip = beam.locator('[data-mode-tip]')
    await expect(tip).to_be_visible()
    await expect(scale).to_have_value('100')
    await expect(readout).to_have_attribute('data-phase', '0')
    if not math.isclose(float(await tip.get_attribute('data-deflection')), 1, abs_tol=1e-6):
        raise RuntimeError('At default scale and 0° the free tip should equal +1 normalized deflection')
    positive_y = float(await tip.get_attribute('cy'))
    await phase.fill('90')
    await expect(readout).to_have_attribute('data-phase', '90')
    if not math.isclose(float(await tip.get_attribute('data-deflection')), 0, abs_tol=1e-6):
        raise RuntimeError('At 90° the free tip should have zero deflection')
    frame = beam.locator('rect[data-mode-axis-frame]')
    zero_y = float(await frame.get_attribute('y')) + float(await frame.get_attribute('height')) / 2
    tip_y = float(await tip.get_attribute('cy'))
    if not positive_y < tip_y or not math.isclose(tip_y, zero_y, abs_tol=0.1):
        raise RuntimeError('The selected mode tip should move from positive deflection to the zero line')
    await phase.press('Home')
    await expect(readout).to_have_attribute('data-phase', '0')

    initial_deflection = await deflection.get_attribute('d')
    nodes = chart.locator('[data-mode-node]')
    initial_nodes = await nodes.count()
    if touch:
        await first_mode.tap()
    else:
        await first_mode.click()
    await expect(first_mode).to_have_attribute('aria-pressed', 'true')
    await expect(third_mode).to_have_attribute('aria-pressed', 'false')
    await expect(readout).to_have_attribute('data-mode', '1')
    first_frequency = await readout.get_attribute('data-frequency')
    if first_frequency is None or not abs(float(first_frequency) - 6.79484) <= 0.001:
        raise RuntimeError(f'Mode 1 should have a frequency of 6.79484 Hz, observed {first_frequency}')
    await expect(deflection).not_to_have_attribute('d', initial_deflection)
    await expect(nodes).not_to_have_count(initial_nodes)

    await scale.press('End')
    await phase.press('Home')
    await expect(readout).to_have_attribute('data-phase', '0')
    start_deflection = await deflection.get_attribute('d')
    await phase.press('PageUp')
    await expect(readout).not_to_have_attribute('data-phase', '0')
    await expect(deflection).not_to_have_attribute('d', start_deflection)
    scaled_deflection = await deflection.get_attribute('d')
    scaled_phase = await readout.get_attribute('data-phase')
    await scale.press('Home')
    await expect(deflection).not_to_have_attribute('d', scaled_deflection)
    await expect(readout).to_have_attribute('data-phase', scaled_phase)

    await play.click()
    await expect(pause).to_be_visible()
    await expect(readout).not_to_have_attribute('data-phase', scaled_phase)
    await pause.click()
    await expect(play).to_be_visible()
    stopped_phase = await readout.get_attribute('data-phase')
    await readout.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
    await expect(readout).to_have_attribute('data-phase', stopped_phase)


async def check_shaft_orbit_figure(orbit, compact=False):
    await expect(orbit).to_be_visible()
    frame = orbit.locator('rect[data-orbit-axis-frame]')
    await expect(frame).to_be_visible()
    await expect(orbit.locator('.scientific-tick').first).to_be_attached()
    await expect(orbit.get_by_text('X displacement (µm)', exact=True)).to_be_visible()
    await expect(orbit.get_by_text('Y displacement (µm)', exact=True)).to_be_visible()
    await expect(orbit.locator('[data-orbit-trigger]')).to_be_visible()
    bounds = await frame.bounding_box()
    if not math.isclose(bounds['width'], bounds['height'], abs_tol=0.5):
        raise RuntimeError(f'The equal-scale orbit frame should be square, observed {bounds["width"]} × {bounds["height"]}')
    if compact:
        clipped = await orbit.evaluate("""async figure => {
          await document.fonts.ready
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
          const cardBounds = figure.closest('.card-plot').getBoundingClientRect()
          const figureBounds = figure.getBoundingClientRect()
          const fits = (box, bounds) => box.left >= bounds.left - 1 && box.top >= bounds.top - 1 &&
            box.right <= bounds.right + 1 && box.bottom <= bounds.bottom + 1
          const marks = figure.querySelectorAll('rect[data-orbit-axis-frame], text')
          return [figure, ...marks].filter(mark => {
            const box = mark.getBoundingClientRect()
            return !fits(box, cardBounds) || (mark !== figure && !fits(box, figureBounds))
          }).map(mark => mark.matches('text') ? mark.textContent : mark.localName)
        }""")
        if clipped:
            raise RuntimeError(f'Compact orbit marks extend beyond the visible card plot: {clipped}')


async def check_shaft_orbit(plot, touch):
    chart = plot.locator('[data-shaft-orbit]')
    await expect(chart.locator('figcaption')).to_contain_text(re.compile(r'\bsimulat(?:ed|ion)\b', re.I))
    orbit = chart.locator('svg[data-orbit-plot]')
    await check_shaft_orbit_figure(orbit)
    waveforms = chart.locator('svg[data-orbit-waveforms]')
    await expect(waveforms).to_be_visible()
    await expect(waveforms.locator('rect[data-orbit-waveform-frame]')).to_be_visible()
    await expect(waveforms.locator('.scientific-tick').first).to_be_attached()
    await expect(waveforms.get_by_text('Displacement (µm)', exact=True)).to_be_visible()
    await expect(waveforms.get_by_text('Time from trigger (ms)', exact=True)).to_be_visible()
    probe_key = chart.get_by_role('list', name='Probe key', exact=True)
    await expect(probe_key).to_be_visible()
    await expect(probe_key.get_by_role('listitem')).to_have_text(['X probe', 'Y probe'])
    orbit_key = chart.get_by_role('list', name='Orbit key', exact=True)
    await expect(orbit_key.get_by_text('Turn trigger', exact=True)).to_be_visible()
    await expect(chart.locator('canvas')).to_have_count(0)
    trace = orbit.locator('[data-orbit-path]').first
    await expect(trace).to_have_attribute('d', re.compile(r'^M'))
    readout = chart.locator('output[data-orbit-readout]')
    await expect(readout).to_be_visible()
    await expect(readout).to_have_attribute('data-rpm', '1800')
    for axis in ['x', 'y']:
        await expect(readout).to_have_attribute(f'data-{axis}', re.compile(r'^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$', re.I))
    scenario = chart.get_by_role('combobox', name='Signal scenario', exact=True)
    revolution = chart.get_by_role('slider', name='Revolution', exact=True)
    phase = chart.get_by_role('slider', name='Shaft phase', exact=True)
    await expect(scenario).to_have_value('synchronous')
    options = await scenario.locator('option').evaluate_all('(options) => options.map(option => option.value)')
    if len(options) != 3 or set(options) != {'synchronous', 'second-order', 'subsynchronous'}:
        raise RuntimeError(f'The shaft orbit should offer three signal scenarios, observed {options}')

    probe_coordinates = '(output) => [output.dataset.x, output.dataset.y]'
    await expect(readout).to_have_attribute('data-phase', '0')
    synchronous_trace = await trace.get_attribute('d')
    synchronous_point = await readout.evaluate(probe_coordinates)
    await phase.press('PageUp')
    await expect(readout).not_to_have_attribute('data-phase', '0')
    await scenario.select_option('second-order')
    await expect(scenario).to_have_value('second-order')
    await expect(readout).to_have_attribute('data-revolution', '1')
    await expect(readout).to_have_attribute('data-phase', '0')
    await expect(trace).not_to_have_attribute('d', synchronous_trace)
    if await readout.evaluate(probe_coordinates) == synchronous_point:
        raise RuntimeError('The synchronous and second-order scenarios should show distinct probe readings')

    second_order_trace = await trace.get_attribute('d')
    await scenario.select_option('subsynchronous')
    await expect(scenario).to_have_value('subsynchronous')
    await expect(trace).not_to_have_attribute('d', second_order_trace)
    await phase.press('PageUp')
    selected_phase = await readout.get_attribute('data-phase')
    first_revolution_trace = await trace.get_attribute('d')
    first_revolution_point = await readout.evaluate(probe_coordinates)
    await revolution.press('End')
    await expect(readout).to_have_attribute('data-revolution', '12')
    await expect(readout).to_have_attribute('data-phase', selected_phase)
    await expect(trace).not_to_have_attribute('d', first_revolution_trace)
    if await readout.evaluate(probe_coordinates) == first_revolution_point:
        raise RuntimeError('At fixed phase the subsynchronous orbit should vary across revolutions')

    last_revolution_trace = await trace.get_attribute('d')
    last_revolution_point = await readout.evaluate(probe_coordinates)
    await phase.press('End')
    await expect(readout).to_have_attribute('data-phase', '360')
    await expect(trace).to_have_attribute('d', last_revolution_trace)
    if await readout.evaluate(probe_coordinates) == last_revolution_point:
        raise RuntimeError('Changing shaft phase should move the selected probe point')

    target = waveforms.locator('.orbit-waveform-pick')
    await expect(target).to_be_visible()
    bounds = await target.bounding_box()
    position = {'x': bounds['width'] * 0.7, 'y': bounds['height'] * 0.5}
    if touch:
        await target.tap(position=position)
    else:
        await target.click(position=position)
    await expect(readout).not_to_have_attribute('data-phase', '360')
    selected_phase = float(await readout.get_attribute('data-phase'))
    if not math.isclose(selected_phase, 252, abs_tol=2):
        raise RuntimeError(f'Picking 70% of the trace window should select approximately 252°, observed {selected_phase}°')
    await expect(readout).to_have_attribute('data-revolution', '12')
    await expect(readout).to_have_attribute('data-rpm', '1800')


async def check_frequency_response(plot, touch):
    chart = plot.locator('[data-frequency-response]')
    await expect(chart.locator('figcaption')).to_contain_text(re.compile(r'\bsimulat(?:ed|ion)\b', re.I))
    magnitude = chart.locator('svg[data-bode-magnitude]')
    phase = chart.locator('svg[data-bode-phase]')
    nyquist = chart.locator('svg[data-nyquist-plot]')
    panels = [magnitude, phase, nyquist]
    traces = [panel.locator('path[data-response-trace]') for panel in panels]
    for panel, trace in zip(panels, traces):
        await expect(panel).to_be_visible()
        await expect(trace).to_have_attribute('d', re.compile(r'^M'))
        await expect(panel.locator('[data-response-marker]')).to_be_visible()
    await expect(nyquist.locator('[data-nyquist-critical]')).to_be_visible()

    readout = chart.locator('output[data-response-readout]')
    frequency = chart.get_by_role('slider', name='Frequency', exact=True)
    gain = chart.get_by_role('combobox', name='Loop gain', exact=True)
    await expect(readout).to_be_visible()
    await expect(gain).to_have_value('nominal')

    async def linked_sample():
        attributes = await readout.evaluate(
            "output => ['frequency', 'magnitude', 'phase', 'real', 'imaginary'].map(key => output.dataset[key])"
        )
        for panel in panels:
            await expect(panel.locator('[data-response-marker]')).to_have_attribute('data-frequency', attributes[0])
        hz, magnitude_db, phase_deg, real, imaginary = map(float, attributes)
        if hz <= 0 or not all(map(math.isfinite, (hz, magnitude_db, phase_deg, real, imaginary))):
            raise RuntimeError(f'Invalid frequency response sample: {attributes}')
        if not math.isclose(magnitude_db, 20 * math.log10(math.hypot(real, imaginary)), abs_tol=0.001):
            raise RuntimeError(f'Magnitude does not match the complex sample at {hz} Hz')
        wrapped_phase = math.degrees(math.atan2(imaginary, real))
        if abs(math.remainder(phase_deg - wrapped_phase, 360)) > 0.001:
            raise RuntimeError(f'Phase does not match the complex sample at {hz} Hz')
        return hz, magnitude_db, phase_deg, real, imaginary

    await frequency.press('Home')
    first_hz, *_ = await linked_sample()
    await frequency.press('End')
    last_hz, _, last_phase, *_ = await linked_sample()
    if not math.isclose(first_hz, 0.6) or not math.isclose(last_hz, 200):
        raise RuntimeError(f'Expected fixture frequencies from 0.6 to 200 Hz, observed {first_hz} to {last_hz} Hz')
    if not math.isclose(last_phase, -255.03, abs_tol=0.01):
        raise RuntimeError(f'Phase should continue below −180° after the wrap, observed {last_phase}° at {last_hz} Hz')

    async def pick(target, position):
        if touch:
            await target.tap(position=position)
        else:
            await target.click(position=position)

    bode_picks = [(magnitude, 0.74), (phase, 0.27)]
    selected_frequencies = []
    for panel, fraction in bode_picks:
        target = panel.locator('.response-bode-pick')
        await expect(target).to_be_visible()
        bounds = await target.bounding_box()
        await pick(target, {'x': bounds['width'] * fraction, 'y': bounds['height'] * 0.5})
        hz, *_ = await linked_sample()
        selected_frequencies.append(hz)
    magnitude_hz, phase_hz = selected_frequencies
    if not first_hz < phase_hz < magnitude_hz < last_hz:
        raise RuntimeError(f'Bode selections should match their horizontal frequency position: {selected_frequencies}')

    target = nyquist.locator('.response-nyquist-pick')
    await expect(target).to_be_visible()
    position = await target.evaluate("""target => {
      const trace = target.ownerSVGElement.querySelector('[data-response-trace]')
      const point = trace.getPointAtLength(trace.getTotalLength() * 0.5).matrixTransform(trace.getScreenCTM())
      const bounds = target.getBoundingClientRect()
      return { x: point.x - bounds.left, y: point.y - bounds.top }
    }""")
    await pick(target, position)
    hz, nominal_db, nominal_phase, nominal_real, nominal_imaginary = await linked_sample()
    if not first_hz < hz < last_hz or hz == phase_hz:
        raise RuntimeError(f'Picking the Nyquist curve should select an interior frequency, observed {hz} Hz')

    nominal_magnitude_path = await traces[0].get_attribute('d')
    nominal_nyquist_path = await traces[2].get_attribute('d')
    await gain.select_option('higher-gain')
    await expect(gain).to_have_value('higher-gain')
    next_hz, higher_db, higher_phase, higher_real, higher_imaginary = await linked_sample()
    if next_hz != hz:
        raise RuntimeError(f'Changing loop gain should preserve the chosen frequency, observed {hz} and {next_hz} Hz')
    gain_ratio = 0.84 / 0.48
    expected_db = nominal_db + 20 * math.log10(gain_ratio)
    if not all((
        math.isclose(higher_db, expected_db, abs_tol=0.001),
        math.isclose(higher_phase, nominal_phase, abs_tol=0.001),
        math.isclose(higher_real, nominal_real * gain_ratio, abs_tol=0.001),
        math.isclose(higher_imaginary, nominal_imaginary * gain_ratio, abs_tol=0.001),
    )):
        raise RuntimeError('Increasing loop gain should scale the complex response and preserve its phase')
    await expect(traces[0]).not_to_have_attribute('d', nominal_magnitude_path)
    await expect(traces[2]).not_to_have_attribute('d', nominal_nyquist_path)


async def check_native_scientific(plot, slug, touch):
    await expect(plot.locator('[data-scientific-ready]')).to_have_count(1, timeout=8000)
    await expect(plot.locator('[data-scientific-axes]')).to_be_visible()
    selection = plot.locator('[data-scientific-selection]')
    await expect(selection).to_have_attribute('data-x-index', re.compile(r'^\d+$'))
    previous_x_index = await selection.get_attribute('data-x-index')
    readout = plot.locator('output')

    if slug == 'spectrum-measured':
        await plot.get_by_role('slider', name='Frequency bin').press('Home')
        await expect(readout).to_contain_text('0.025 cycles/year')
    elif slug.startswith('correlation-matrix-'):
        coefficients = plot.locator('[data-scientific-coefficient]')
        await expect(coefficients).to_have_count(16)
        await expect(coefficients.filter(has_text=re.compile(r'^1\.00$'))).to_have_count(4)
        if slug == 'correlation-matrix-steel':
            await expect(readout).to_contain_text('Pearson r = 0.967')
            await expect(readout).to_contain_text('1,941 paired observations')
            await expect(plot.locator('figcaption')).to_contain_text('Steel Plates Faults')
        await plot.get_by_role('combobox', name='Column variable').select_option('0')
        await expect(readout).to_contain_text('Pearson r = 1')
    else:
        slider_names = {
            'process-control-individuals': 'Observation',
            'process-control-capability': 'Histogram bin',
        }
        previous_readout = await readout.inner_text()
        slider = plot.get_by_role('slider', name=slider_names[slug], exact=True)
        at_end = await slider.input_value() == await slider.get_attribute('max')
        await slider.press('Home' if at_end else 'End')
        await expect(readout).not_to_have_text(previous_readout)

    await expect(selection).to_be_visible()
    await expect(selection).not_to_have_attribute('data-x-index', previous_x_index)
    selected_x_index = await selection.get_attribute('data-x-index')
    pick_area = plot.locator('[data-scientific-pick]')
    if touch:
        await pick_area.tap()
    else:
        await pick_area.click()
    await expect(selection).not_to_have_attribute('data-x-index', selected_x_index)


async def check_mauna_loa_spectrogram(plot, touch):
    await expect(plot.locator('[data-scientific-ready]')).to_have_count(1, timeout=8000)
    raster = plot.locator('svg image[data-mauna-loa-raster]')
    await expect(raster).to_have_count(1)
    await expect(raster).to_be_visible()
    await expect(raster).to_have_attribute('href', re.compile(r'^data:image/png;base64,[A-Za-z0-9+/]'))
    await expect(plot.locator('[data-scientific-axes]')).to_be_visible()
    selection = plot.locator('[data-scientific-selection]')
    readout = plot.locator('output')
    trace = plot.locator('[data-mauna-loa-trace]')
    await expect(trace).to_be_visible()

    await plot.get_by_role('slider', name='Window center year', exact=True).press('End')
    await expect(readout).to_have_attribute('data-year', '2016')
    cycles = [('Six-month cycle', '2', 1.006443), ('Four-month cycle', '3', 0.106317)]
    for name, frequency, expected_amplitude in cycles:
        shortcut = plot.get_by_role('button', name=name, exact=True)
        await shortcut.click()
        await expect(shortcut).to_have_attribute('aria-pressed', 'true')
        await expect(readout).to_have_attribute('data-frequency', frequency)
        await expect(readout).to_have_attribute('data-year', '2016')
        await expect(trace).to_have_attribute('data-frequency', frequency)
        amplitude = await readout.get_attribute('data-amplitude')
        if amplitude is None or not abs(float(amplitude) - expected_amplitude) <= 0.0005:
            raise RuntimeError(f'{name} amplitude for 2016 should be {expected_amplitude} ppm, observed {amplitude}')

    await plot.get_by_role('slider', name='Frequency bin', exact=True).press('ArrowLeft')
    await expect(readout).to_have_attribute('data-frequency', '2.875')
    await expect(trace).to_have_attribute('data-frequency', '2.875')
    await expect(selection).to_be_visible()
    await expect(selection).to_have_attribute('data-x-index', '32')
    pick_area = plot.locator('[data-scientific-pick]')
    if touch:
        await pick_area.tap()
    else:
        await pick_area.click()
    await expect(selection).not_to_have_attribute('data-x-index', '32')
    await expect(readout).not_to_have_attribute('data-year', '2016')


async def check_particle_mass_spectrum(plot):
    await expect(plot.locator('figure[data-particle-mass-spectrum]')).to_be_visible()
    await expect(plot.locator('svg[data-particle-plot]')).to_be_visible()
    await expect(plot.locator('figcaption')).to_contain_text('100,000')
    slider = plot.get_by_role('slider', name='Invariant mass bin')
    readout = plot.locator('output[data-selected-particle-bin]')
    await expect(readout).to_have_attribute('data-events', '4432')
    initial_bin = await readout.get_attribute('data-bin-index')
    z_region = plot.get_by_role('button', name='Select Z region', exact=True)
    await z_region.click()
    await expect(z_region).to_have_attribute('aria-pressed', 'true')
    await expect(readout).not_to_have_attribute('data-bin-index', initial_bin)
    await slider.press('Home')
    await expect(readout).to_have_attribute('data-bin-index', '0')
    await expect(readout).to_have_attribute('data-events', '664')


async def check_spectral_waterfall(plot, slug):
    ridges = plot.locator('[data-waterfall-ridge]')
    await ridges.first.wait_for(state='attached', timeout=8000)
    await expect(plot.locator('dl[aria-label="Plot axes"]')).to_be_visible()
    azimuth = plot.get_by_role('slider', name='Azimuth')
    initial_azimuth = await azimuth.input_value()
    await azimuth.press('ArrowRight')
    await expect(azimuth).not_to_have_value(initial_azimuth)
    await plot.get_by_role('button', name='Reset view').click()
    await expect(azimuth).to_have_value(initial_azimuth)

    await plot.get_by_role('slider', name='Scan', exact=True).press('Home')
    await plot.get_by_role('slider', name='Spectral bin').press('Home')
    readout = plot.locator('[data-spectral-measurement]')
    await expect(readout).to_have_attribute('data-scan-index', '0')
    await expect(readout).to_have_attribute('data-bin-index', '0')
    await expect(readout).to_contain_text('10.91 K' if slug.endswith('-xrd') else '1984')
    await plot.get_by_role('tab', name='Spectrum', exact=True).click()
    await expect(plot.locator('[data-spectral-view="spectrum"] [data-spectral-selection]')).to_be_visible()

    intensity = await readout.get_attribute('data-intensity')
    await plot.get_by_role('tab', name='Heatmap').click()
    heatmap = plot.locator('[data-spectral-view="heatmap"] svg')
    await expect(heatmap).to_be_visible()
    await expect(readout).to_have_attribute('data-intensity', intensity)
    await heatmap.press('ArrowRight')
    await expect(readout).to_have_attribute('data-bin-index', '1')
    await plot.get_by_role('tab', name='3D Waterfall').click()
    await expect(plot.locator('[data-waterfall-selected-bin="1"]')).to_be_visible()


async def run(browser, queue, results, local_url):
    while not queue.empty():
        try:
            profile, examples = queue.get_nowait()
        except asyncio.QueueEmpty:
            return
        name, width, height, theme = profile
        page = await browser.new_page(viewport={'width': width, 'height': height}, reduced_motion='reduce')
        page.set_default_navigation_timeout(20000)
        errors = []
        diagnostics = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('console', lambda message: diagnostics.append(message.text[:500]) if message.type == 'error' else None)
        page.on('requestfailed', lambda request: diagnostics.append(f'{request.url}: {request.failure}'))
        parsed_url = urlsplit(local_url)
        origin = json.dumps(f'{parsed_url.scheme}://{parsed_url.netloc}')
        await page.add_init_script(f'''(() => {{
            if (location.origin !== {origin}) return;
            localStorage.setItem('chart-library:layout', '"list"');
            localStorage.setItem('chart-library:theme', '"{theme}"');
        }})()''')
        response = await page.goto(local_url, wait_until='domcontentloaded')
        if response is None or not response.ok:
            raise RuntimeError(f'Local gallery returned HTTP {response.status if response else "unavailable"} at {local_url}')
        for example in examples:
            slug = example['id']
            errors.clear()
            try:
                await asyncio.wait_for(page.evaluate('(hash) => { location.hash = hash }', urlencode({'example': slug})), timeout=20)
                await page.get_by_role('heading', name=example['title'], exact=True).wait_for(timeout=8000)
                await page.locator(f'html[data-theme="{theme}"]').wait_for(state='attached', timeout=8000)
                plot = page.locator('.detail-plot')
                output = plot.locator('svg path, svg circle, svg rect, svg polygon, svg polyline, canvas, table, [role=alert]').first
                await output.wait_for(state='attached', timeout=8000)
                visible_output = await asyncio.wait_for(plot.evaluate("""plot => [...plot.querySelectorAll('svg, canvas, table')].some(mark => {
                    const { width, height } = mark.getBoundingClientRect();
                    return width > 0 && height > 0;
                })"""), timeout=20)
                if not visible_output or await page.locator('.detail-plot [role=alert], [data-chart-error]').count():
                    errors.append('Chart output missing or error state displayed')
            except TimeoutError as error:
                raise RuntimeError(f'{name} {slug}: browser evaluation timed out') from error
            except Exception as error:
                errors.append(str(error).splitlines()[0])
            results[name][slug] = list(errors)
            if errors:
                try:
                    state = await asyncio.wait_for(page.evaluate("""() => ({
                        theme: document.documentElement.dataset.theme,
                        headings: [...document.querySelectorAll('h1, h2')].map(element => element.textContent),
                        dialog: !!document.querySelector('dialog[open]'),
                        alerts: [...document.querySelectorAll('[role="alert"]')].map(element => element.textContent)
                    })"""), timeout=3)
                except Exception:
                    state = {'url': page.url, 'responsive': False}
                state['diagnostics'] = diagnostics[-8:]
                print(f'{name} {slug}: {errors[0]} {json.dumps(state)}', flush=True)
        await page.close()
        print(f'{name}: checked {len(results[name])} examples', flush=True)


async def audit(args):
    catalog = json.loads(CATALOG.read_text(encoding='utf-8'))
    examples = [example for family in catalog for example in family['examples']]
    results = {name: {} for name, *_ in PROFILES}
    queue = asyncio.Queue()
    for profile in PROFILES:
        for start in range(0, len(examples), 56):
            queue.put_nowait((profile, examples[start:start + 56]))
    async with async_playwright() as playwright:
        if args.browser == 'edge':
            edge_path = os.getenv('EDGE_PATH')
            browser = await playwright.chromium.launch(executable_path=edge_path) if edge_path else await playwright.chromium.launch(channel='msedge')
        elif args.browser == 'chromium':
            browser = await playwright.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH'))
        elif args.browser == 'firefox':
            browser = await playwright.firefox.launch()
        else:
            browser = await playwright.webkit.launch()
        await check_public_preview(browser, args.local, examples[0])
        await check_gallery_documentation(
            browser, args.local, next(example for example in examples if example['id'] == 'line-time-range'),
        )
        await check_complete_gallery(browser, args.local, examples)
        await check_docs_navigation(browser, args.local, catalog)
        await check_scientific_catalog(browser, args.local, catalog)
        if args.docs_only:
            print(f'Passed catalog and documentation checks for {len(examples)} examples across {len(catalog)} families')
            await browser.close()
            return 0
        await asyncio.gather(*(run(browser, queue, results, args.local) for _ in range(args.workers)))
        await browser.close()
    for profile, observations in results.items():
        print(f'{profile}: {sum(not errors for errors in observations.values())}/{len(examples)} passed')
    failures = {profile: {slug: errors for slug, errors in observations.items() if errors}
                for profile, observations in results.items()}
    if args.report:
        args.report.write_text(json.dumps(results, indent=2) + '\n')
    if any(failures.values()):
        print(json.dumps(failures, indent=2))
        return 1
    return 0


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--local', required=True, help='URL of the running gallery')
    parser.add_argument('--browser', choices=['chromium', 'firefox', 'webkit', 'edge'], default='chromium')
    parser.add_argument('--workers', type=int, default=4, choices=range(1, 9))
    parser.add_argument('--report', type=Path, help='Optional JSON output with all results')
    parser.add_argument('--docs-only', action='store_true', help='Check catalog navigation, documentation, and scientific examples')
    args = parser.parse_args()
    raise SystemExit(asyncio.run(audit(args)))
