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
OTTAWA_BEARING_DATASET = re.compile(r'^https://(?:doi\.org/10\.17632/v43hmbwxpm\.2|data\.mendeley\.com/datasets/v43hmbwxpm/2)/?$')
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
        'process-control', 'campbell-diagram', 'mode-shapes', 'shaft-orbit', 'frequency-response', 'coherence-phase',
        'wavelet-scalogram', 'bearing-envelope', 'eye-diagram', 'allan-deviation', 'phase-plane', 'xrd-peak-tracker',
        'stress-strain-comparison', 'full-field-strain', 'fatigue-sn', 'crack-growth', 'binary-phase-diagram',
        'ternary-mixture-map', 'industrial-ct', 'cad-scan-deviation', 'cie-chromaticity',
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
                await check_nyquist_figure(nyquist)
                await check_compact_figure_bounds(nyquist, 'rect[data-nyquist-axis-frame]')
                await expect(nyquist.locator('path[data-response-trace]')).to_have_attribute('d', re.compile(r'^M'))
                await expect(card_plot.locator('select, [data-bode-magnitude], [data-bode-phase], [data-response-readout]')).to_have_count(0)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=frequency-response&variant=frequency-response-servo'
                )
            elif example['family'] == 'coherence-phase':
                coherence = card_plot.locator('svg[data-coherence-plot]')
                await check_coherence_axes(coherence, 'Coherence')
                await expect(coherence.get_by_text('Frequency (Hz)', exact=True)).to_be_visible()
                await check_compact_figure_bounds(coherence, 'rect[data-coherence-axis-frame]')
                await expect(coherence.locator('path[data-coherence-trace]')).to_have_attribute('d', re.compile(r'^M'))
                await expect(card_plot.locator('select, [data-cross-phase-plot], [data-coherence-readout]')).to_have_count(0)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=coherence-phase&variant=coherence-phase-bearing'
                )
            elif example['family'] == 'wavelet-scalogram':
                scalogram = card_plot.locator('svg[data-wavelet-plot]')
                await check_wavelet_figure(scalogram, compact=True)
                await check_compact_figure_bounds(scalogram, 'rect[data-wavelet-axis-frame]')
                await expect(card_plot.locator('select, [data-wavelet-signal], [data-wavelet-readout]')).to_have_count(0)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=wavelet-scalogram&variant=wavelet-scalogram-bearing'
                )
            elif example['family'] == 'bearing-envelope':
                spectrum = card_plot.locator('svg[data-envelope-spectrum]')
                await check_envelope_axes(spectrum, 'Order (× shaft frequency)', 'Relative amplitude (dB)')
                await check_envelope_references(spectrum)
                await check_compact_figure_bounds(spectrum, 'rect[data-envelope-axis-frame]')
                await expect(spectrum.locator('path[data-envelope-trace]')).to_have_attribute('d', re.compile(r'^M'))
                await expect(card_plot.locator('select, [data-envelope-carrier], [data-envelope-readout]')).to_have_count(0)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=bearing-envelope&variant=bearing-envelope-ottawa'
                )
            elif example['family'] == 'eye-diagram':
                eye = card_plot.locator('svg[data-eye-plot]')
                await check_eye_figure(eye)
                await check_compact_figure_bounds(eye, 'rect[data-eye-axis-frame]')
                await expect(card_plot.locator('select, [data-eye-readout], [data-eye-sampling-line]')).to_have_count(0)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=eye-diagram&variant=eye-diagram-nrz'
                )
            elif example['family'] == 'allan-deviation':
                allan = card_plot.locator('svg[data-allan-plot]')
                await check_allan_figure(allan, compact=True)
                await check_compact_figure_bounds(allan, 'rect[data-allan-axis-frame]')
                await expect(card_plot.locator('select, [data-allan-readout], [data-allan-cursor]')).to_have_count(0)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=allan-deviation&variant=allan-deviation-stability'
                )
            elif example['family'] == 'phase-plane':
                portrait = card_plot.locator('svg[data-phase-plot]')
                await check_phase_figure(portrait)
                await check_compact_figure_bounds(portrait, 'rect[data-phase-axis-frame]')
                await expect(card_plot.locator('select, [data-phase-cursor], [data-phase-readout], [data-phase-history]')).to_have_count(0)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=phase-plane&variant=phase-plane-pendulum'
                )
            elif example['family'] == 'xrd-peak-tracker':
                profile = card_plot.locator('svg[data-xrd-profile]')
                await check_xrd_profile(profile)
                await check_compact_figure_bounds(profile, 'rect[data-xrd-axis-frame]')
                await expect(card_plot.locator('select, [data-xrd-trend], [data-xrd-readout]')).to_have_count(0)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=xrd-peak-tracker&variant=xrd-peak-tracker-dynic2'
                )
            elif example['family'] == 'stress-strain-comparison':
                stress = card_plot.locator('svg[data-stress-overview]')
                await check_stress_axes(stress)
                await expect(stress.locator('path[data-stress-curve]')).to_have_count(3)
                await check_compact_figure_bounds(stress, 'rect[data-stress-axis-frame]')
                await expect(card_plot.locator('select, [data-stress-detail], [data-stress-readout]')).to_have_count(0)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=stress-strain-comparison&variant=stress-strain-heat-treatment'
                )
            elif example['family'] == 'full-field-strain':
                strain_map = card_plot.locator('svg[data-strain-map]')
                await check_strain_map(strain_map)
                await check_compact_figure_bounds(strain_map, 'rect[data-strain-map-frame]')
                await expect(card_plot.locator('[data-strain-probe], [data-strain-force], [data-strain-readout]')).to_have_count(0)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=full-field-strain&variant=full-field-strain-tensile'
                )
            elif example['family'] == 'fatigue-sn':
                fatigue = card_plot.locator('svg[data-fatigue-plot]')
                await check_fatigue_figure(fatigue)
                await check_compact_figure_bounds(fatigue, 'rect[data-fatigue-axis-frame]')
                await expect(card_plot.locator('select, [data-fatigue-cursor], [data-fatigue-readout]')).to_have_count(0)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=fatigue-sn&variant=fatigue-sn-measured'
                )
            elif example['family'] == 'crack-growth':
                crack = card_plot.locator('svg[data-crack-plot]')
                await check_crack_figure(crack, compact=True)
                await check_compact_figure_bounds(crack, 'rect[data-crack-axis-frame]')
                await expect(card_plot.locator('select, [data-crack-cursor], [data-crack-readout]')).to_have_count(0)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=crack-growth&variant=crack-growth-fatigue'
                )
            elif example['family'] == 'binary-phase-diagram':
                diagram = card_plot.locator('svg[data-phase-diagram]')
                await check_binary_phase_figure(diagram)
                await check_compact_figure_bounds(diagram, 'rect[data-phase-diagram-frame]')
                await expect(card_plot.locator('input, button, .alloy-plot-pick, [data-alloy-cooling], [data-alloy-cursor], [data-alloy-readout]')).to_have_count(0)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=binary-phase-diagram&variant=binary-phase-diagram-ag-cu'
                )
            elif example['family'] == 'ternary-mixture-map':
                ternary = card_plot.locator('svg[data-ternary-plot]')
                await check_ternary_figure(ternary)
                await check_compact_figure_bounds(ternary, 'path[data-ternary-simplex]')
                await expect(card_plot.locator('input, select, button, [data-ternary-cursor], [data-ternary-readout]')).to_have_count(0)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=ternary-mixture-map&variant=ternary-mixture-response'
                )
            elif example['family'] == 'industrial-ct':
                await check_compact_industrial_ct(card_plot)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=industrial-ct&variant=industrial-ct-porosity'
                )
            elif example['family'] == 'cad-scan-deviation':
                await check_compact_cad_scan(card_plot)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=cad-scan-deviation&variant=cad-scan-deviation-registered'
                )
            elif example['family'] == 'cie-chromaticity':
                cie = card_plot.locator('svg[data-cie-diagram]')
                await check_cie_figure(cie, 'xy')
                await check_compact_figure_bounds(cie, 'rect[data-cie-frame]')
                await expect(card_plot.locator('select, input, button, [data-cie-selected], [data-cie-readout]')).to_have_count(0)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=cie-chromaticity&variant=cie-chromaticity-gamuts'
                )
        await grid.locator('.example-card-link').first.click(timeout=8000)
        await page.wait_for_url(f'{local_url}#docs=mass-spectrum&variant=mass-spectrum-cms', timeout=8000)
        if touch:
            await page.go_back()
            await page.wait_for_url(f'{local_url}#category=scientific', timeout=8000)
            legacy_spectrum = grid.locator('.example-card[data-example-id="spectrum-measured"]')
            await legacy_spectrum.scroll_into_view_if_needed()
            await expect(legacy_spectrum.locator('.card-plot [data-scientific-ready]')).to_be_attached()
            coherence_card = grid.locator('.example-card[data-example-id="coherence-phase-bearing"]')
            await coherence_card.locator('.example-card-link').click()
            await page.wait_for_url(f'{local_url}#docs=coherence-phase&variant=coherence-phase-bearing', timeout=8000)
            panels = page.locator('#docs-preview svg[data-coherence-plot], #docs-preview svg[data-cross-phase-plot]')
            await expect(panels).to_have_count(2)
            heights = await panels.evaluate_all("""async panels => {
              await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
              return panels.map(panel => panel.getBoundingClientRect().height)
            }""")
            if min(heights) < 170:
                raise RuntimeError(f'Mobile coherence panels should remain at least 170px after the spectrum loads: {heights}')

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
            elif example['family'] == 'coherence-phase':
                await check_coherence_phase(plot, touch)
                code_import = 'CoherencePhase'
            elif example['family'] == 'wavelet-scalogram':
                await check_wavelet_scalogram(plot, touch)
                code_import = 'WaveletScalogram'
            elif example['family'] == 'bearing-envelope':
                await check_bearing_envelope(plot, touch)
                code_import = 'BearingEnvelope'
            elif example['family'] == 'eye-diagram':
                await check_eye_diagram(plot, touch)
                code_import = 'EyeDiagram'
            elif example['family'] == 'allan-deviation':
                await check_allan_deviation(plot, touch)
                code_import = 'AllanDeviation'
            elif example['family'] == 'phase-plane':
                await check_phase_plane(plot, touch)
                code_import = 'PhasePlane'
            elif example['family'] == 'xrd-peak-tracker':
                await check_xrd_peak_tracker(plot, touch)
                code_import = 'PeakTracker'
            elif example['family'] == 'stress-strain-comparison':
                await check_stress_strain(plot)
                code_import = 'StressStrainComparison'
            elif example['family'] == 'full-field-strain':
                await check_full_field_strain(plot, touch)
                code_import = 'FullFieldStrain'
            elif example['family'] == 'fatigue-sn':
                await check_fatigue_sn(plot, touch)
                code_import = 'FatigueSn'
            elif example['family'] == 'crack-growth':
                await check_crack_growth(plot, touch)
                code_import = 'CrackGrowth'
            elif example['family'] == 'binary-phase-diagram':
                await check_binary_phase_diagram(plot, touch)
                code_import = 'BinaryPhaseDiagram'
            elif example['family'] == 'ternary-mixture-map':
                await check_ternary_mixture(plot, touch)
                code_import = 'TernaryMixtureMap'
            elif example['family'] == 'industrial-ct':
                await check_industrial_ct(plot, touch)
                code_import = 'IndustrialCtViewer'
            elif example['family'] == 'cad-scan-deviation':
                await check_cad_scan(plot, touch)
                code_import = 'CadScanDeviation'
            elif example['family'] == 'cie-chromaticity':
                await check_cie_chromaticity(plot, touch)
                code_import = 'CieChromaticityDiagram'
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


async def check_compact_figure_bounds(svg, frame_selector):
    clipped = await svg.evaluate("""async (figure, frameSelector) => {
      await document.fonts.ready
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const cardBounds = figure.closest('.card-plot').getBoundingClientRect()
      const figureBounds = figure.getBoundingClientRect()
      const fits = (box, bounds) => box.left >= bounds.left - 1 && box.top >= bounds.top - 1 &&
        box.right <= bounds.right + 1 && box.bottom <= bounds.bottom + 1
      const marks = figure.querySelectorAll(frameSelector + ', text')
      return [figure, ...marks].filter(mark => {
        const box = mark.getBoundingClientRect()
        return !fits(box, cardBounds) || (mark !== figure && !fits(box, figureBounds))
      }).map(mark => mark.matches('text') ? mark.textContent : mark.localName)
    }""", frame_selector)
    if clipped:
        raise RuntimeError(f'Compact figure marks extend beyond the visible card plot: {clipped}')


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
        await check_compact_figure_bounds(orbit, 'rect[data-orbit-axis-frame]')


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


async def check_nyquist_figure(nyquist):
    await expect(nyquist).to_be_visible()
    await expect(nyquist.locator('rect[data-nyquist-axis-frame]')).to_be_visible()
    await expect(nyquist.locator('.scientific-tick').first).to_be_attached()
    await expect(nyquist.get_by_text('Real part', exact=True)).to_be_visible()
    await expect(nyquist.get_by_text('Imaginary part', exact=True)).to_be_visible()
    await expect(nyquist.locator('[data-nyquist-critical]')).to_be_visible()
    reflection = nyquist.locator('path[data-nyquist-reflection]')
    await expect(reflection).to_have_attribute('d', re.compile(r'^M'))
    if await reflection.evaluate('path => getComputedStyle(path).strokeDasharray') == 'none':
        raise RuntimeError('The reflected branch should use a dashed trace')


async def check_bode_axes(magnitude, phase):
    ticks_by_panel = []
    for panel, label in [(magnitude, 'Magnitude (dB)'), (phase, 'Phase (°)')]:
        await expect(panel.locator('rect[data-bode-axis-frame]')).to_be_visible()
        await expect(panel.locator('.scientific-tick').first).to_be_attached()
        await expect(panel.get_by_text(label, exact=True)).to_be_visible()
        ticks = await panel.locator('[data-bode-frequency-tick]').evaluate_all("""marks => marks.map(mark => [
          Number(mark.dataset.frequency), mark.getBoundingClientRect().left
        ])""")
        ticks_by_panel.append(dict(ticks))
    await expect(phase.get_by_text('Frequency (Hz)', exact=True)).to_be_visible()

    magnitude_ticks, phase_ticks = ticks_by_panel
    if len(magnitude_ticks) < 3 or magnitude_ticks.keys() != phase_ticks.keys():
        raise RuntimeError(f'The Bode plots should show the same major frequency ticks: {ticks_by_panel}')
    first, last = min(magnitude_ticks), max(magnitude_ticks)
    if first <= 0 or not magnitude_ticks[first] < magnitude_ticks[last]:
        raise RuntimeError(f'The logarithmic axis should increase from left to right: {magnitude_ticks}')
    for hz, x in magnitude_ticks.items():
        fraction = math.log(hz / first) / math.log(last / first)
        expected_x = magnitude_ticks[first] + (magnitude_ticks[last] - magnitude_ticks[first]) * fraction
        if not math.isclose(x, phase_ticks[hz], abs_tol=0.5) or not math.isclose(x, expected_x, abs_tol=0.5):
            raise RuntimeError(f'Bode panels should align on a shared logarithmic axis at {hz} Hz')


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
    await check_bode_axes(magnitude, phase)
    await check_nyquist_figure(nyquist)
    nyquist_key = chart.get_by_role('list', name='Nyquist key', exact=True)
    await expect(nyquist_key).to_be_visible()
    await expect(nyquist_key.get_by_role('listitem')).to_have_text(
        ['Positive frequency', 'Reflected branch', 'Critical point (−1, 0)']
    )

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


async def check_coherence_axes(panel, label):
    await expect(panel).to_be_visible()
    await expect(panel.locator('rect[data-coherence-axis-frame]')).to_be_visible()
    await expect(panel.locator('.scientific-tick').first).to_be_attached()
    await expect(panel.get_by_text(label, exact=True)).to_be_visible()


async def check_coherence_phase(plot, touch):
    chart = plot.locator('[data-coherence-chart]')
    coherence = chart.locator('svg[data-coherence-plot]')
    phase = chart.locator('svg[data-cross-phase-plot]')
    await check_coherence_axes(coherence, 'Coherence')
    await check_coherence_axes(phase, 'Phase (°)')
    await expect(phase.get_by_text('Frequency (Hz)', exact=True)).to_be_visible()
    await expect(chart.get_by_role('link', name='Dataset', exact=True)).to_have_attribute(
        'href', re.compile(r'^https://(?:doi\.org/10\.5281/zenodo\.|zenodo\.org/records/)14388093/?$')
    )
    coherence_trace = coherence.locator('path[data-coherence-trace]')
    await expect(coherence_trace).to_have_attribute('d', re.compile(r'^M'))
    phase_trace = phase.locator('path[data-phase-trace]')
    coherence_marker = coherence.locator('[data-coherence-marker]')
    phase_marker = phase.locator('[data-phase-marker]')
    readout = chart.locator('output[data-coherence-readout]')
    threshold = chart.get_by_role('slider', name='Coherence threshold', exact=True)
    frequency = chart.get_by_role('slider', name='Frequency', exact=True)
    band = chart.get_by_role('combobox', name='Frequency band', exact=True)
    await expect(readout).to_be_visible()
    await expect(band).to_have_value('low')
    await band.select_option('full')
    await threshold.press('Home')
    await expect(readout).to_have_attribute('data-threshold', '0')
    await expect(phase_trace).to_have_attribute('d', re.compile(r'^M'))

    async def linked_sample():
        attributes = await readout.evaluate(
            "output => ['frequency', 'coherence', 'phase'].map(key => output.dataset[key])"
        )
        for marker in [coherence_marker, phase_marker]:
            await expect(marker).to_be_visible()
            await expect(marker).to_have_attribute('data-frequency', attributes[0])
        if not math.isclose(float(await coherence_marker.get_attribute('cx')),
                            float(await phase_marker.get_attribute('cx')), abs_tol=0.5):
            raise RuntimeError('The coherence and phase cursors should align at the selected frequency')
        hz, magnitude_squared, phase_deg = map(float, attributes)
        if not all(map(math.isfinite, (hz, magnitude_squared, phase_deg))) or not (
            hz >= 0 and 0 <= magnitude_squared <= 1 and -180 <= phase_deg <= 180
        ):
            raise RuntimeError(f'Invalid coherence and phase sample: {attributes}')
        return hz, magnitude_squared, phase_deg

    await frequency.press('Home')
    first_hz, *_ = await linked_sample()
    await frequency.press('End')
    last_hz, *_ = await linked_sample()
    if (first_hz, last_hz) != (2.9296875, 1500):
        raise RuntimeError(f'Expected the measured fixture range 2.9296875–1500 Hz, observed {first_hz}–{last_hz} Hz')
    selected = []
    for panel, fraction in [(coherence, 0.73), (phase, 0.28)]:
        target = panel.locator('.coherence-plot-pick')
        await expect(target).to_be_visible()
        bounds = await target.bounding_box()
        position = {'x': bounds['width'] * fraction, 'y': bounds['height'] * 0.5}
        if touch:
            await target.tap(position=position)
        else:
            await target.click(position=position)
        selected.append(await linked_sample())
    if not first_hz < selected[1][0] < selected[0][0] < last_hz:
        raise RuntimeError(f'Both plots should select frequencies from their horizontal axis: {selected}')
    if selected[1][1] >= 1:
        raise RuntimeError('The demo selection must fall below unit coherence to audit phase masking')

    selected_hz = await readout.get_attribute('data-frequency')
    selected_value = await readout.get_attribute('data-coherence')
    selected_phase = await readout.get_attribute('data-phase')
    unmasked_path = await phase_trace.get_attribute('d')
    await threshold.press('End')
    await expect(readout).to_have_attribute('data-threshold', '1')
    await expect(readout).to_have_attribute('data-frequency', selected_hz)
    await expect(readout).to_have_attribute('data-coherence', selected_value)
    await expect(readout).to_have_attribute('data-phase', '')
    await expect(phase_marker).to_have_count(0)
    await expect(phase_trace).not_to_have_attribute('d', unmasked_path)
    await threshold.press('Home')
    await expect(readout).to_have_attribute('data-threshold', '0')
    await expect(readout).to_have_attribute('data-phase', selected_phase)
    await linked_sample()

    await expect(band).to_have_value('full')
    await band.select_option('low')
    await frequency.press('End')
    low_last_hz, *_ = await linked_sample()
    if not first_hz < low_last_hz < last_hz:
        raise RuntimeError(f'Low band should narrow the selectable frequency range, observed {low_last_hz} Hz')
    await band.select_option('full')
    await frequency.press('End')
    restored_hz, *_ = await linked_sample()
    if restored_hz != last_hz:
        raise RuntimeError('Restoring the full band should restore its last selectable frequency')

    recording = chart.get_by_role('combobox', name='Recording', exact=True)
    await expect(recording).to_have_value('baseline')
    values = await recording.locator('option').evaluate_all('options => options.map(option => option.value)')
    if values != ['baseline', 'drive-end-unbalance']:
        raise RuntimeError('The demo should offer the two measured recordings')
    await frequency.fill('9')
    hz, baseline_coherence, baseline_phase = await linked_sample()
    if hz != 29.296875 or not math.isclose(baseline_coherence, 0.9989, abs_tol=0.00005) or not math.isclose(
        baseline_phase, 132.73, abs_tol=0.01
    ):
        raise RuntimeError(f'Unexpected baseline coherence or phase at the rotor-speed bin: {hz}, {baseline_coherence}, {baseline_phase}')
    original_trace = await coherence_trace.get_attribute('d')
    await recording.select_option('drive-end-unbalance')
    await expect(coherence_trace).not_to_have_attribute('d', original_trace)
    new_hz, unbalance_coherence, unbalance_phase = await linked_sample()
    if new_hz != hz or not math.isclose(unbalance_coherence, 0.9992, abs_tol=0.00005) or not math.isclose(
        unbalance_phase, -143.14, abs_tol=0.01
    ):
        raise RuntimeError(f'Unexpected unbalance coherence or phase at the prior bin: {new_hz}, {unbalance_coherence}, {unbalance_phase}')


async def check_wavelet_figure(scalogram, compact=False):
    await expect(scalogram).to_be_visible()
    raster = scalogram.locator('image[data-wavelet-raster]')
    await expect(raster).to_have_attribute('href', re.compile(r'^data:image/png;base64,'))
    if await raster.evaluate('image => getComputedStyle(image).imageRendering') in ('crisp-edges', 'pixelated'):
        raise RuntimeError('The wavelet raster should use smooth image rendering')
    await expect(scalogram.locator('rect[data-wavelet-axis-frame]')).to_be_visible()
    await expect(scalogram.locator('.scientific-tick').first).to_be_attached()
    await expect(scalogram.get_by_text('Time (s)', exact=True)).to_be_visible()
    await expect(scalogram.get_by_text('Frequency (Hz, log scale)', exact=True)).to_be_visible()
    colorbar = scalogram.locator('[data-wavelet-colorbar]')
    await expect(colorbar.get_by_text('Relative power (dB)', exact=True)).to_be_visible()
    await expect(colorbar.locator('rect[fill^="url("]')).to_be_visible()
    values = [text.strip().replace('−', '-') for text in await colorbar.locator('text').all_text_contents()]
    levels = sorted(float(value) for value in values if re.fullmatch(r'-?\d+(?:\.\d+)?', value))
    if levels != ([-60, -30, 0] if compact else [-60, -40, -20, 0]):
        raise RuntimeError(f'Wavelet colorbar should retain its declared display scale, observed {levels}')
    boundaries = scalogram.locator('[data-wavelet-coi]')
    await expect(boundaries).to_be_visible()
    await expect(boundaries.locator('path')).to_have_count(2)


async def check_wavelet_scalogram(plot, touch):
    chart = plot.locator('[data-wavelet-scalogram]')
    await expect(chart.get_by_role('link', name='Dataset', exact=True)).to_have_attribute('href', OTTAWA_BEARING_DATASET)
    scalogram = chart.locator('svg[data-wavelet-plot]')
    await check_wavelet_figure(scalogram)
    signal = chart.locator('svg[data-wavelet-signal]')
    await expect(signal).to_be_visible()
    trace = signal.locator('path[data-wavelet-signal-trace]')
    await expect(trace).to_have_attribute('d', re.compile(r'^M'))
    readout = chart.locator('output[data-wavelet-readout]')
    await expect(readout).to_be_visible()
    time = chart.get_by_role('slider', name='Time', exact=True)
    frequency = chart.get_by_role('slider', name='Frequency', exact=True)
    window = chart.get_by_role('combobox', name='Waveform window', exact=True)
    await expect(window).to_have_value('0.25')

    async def selection():
        attributes = await readout.evaluate(
            "output => ['time', 'frequency', 'power', 'windowStart', 'windowEnd'].map(key => output.dataset[key])"
        )
        seconds, hz, power, start, end = map(float, attributes)
        if not all(map(math.isfinite, (seconds, hz, power, start, end))) or not (
            hz > 0 and -60 <= power <= 0 and start <= seconds <= end and start < end
        ):
            raise RuntimeError(f'Invalid wavelet selection or waveform extent: {attributes}')
        return seconds, hz, start, end

    initial_time, initial_hz, *_ = await selection()
    initial_power = float(await readout.get_attribute('data-power'))
    if not math.isclose(initial_time, 4.606) or not math.isclose(initial_hz, 1638.68316531) or initial_power != 0:
        raise RuntimeError(f'The example should open on the measured peak, observed {initial_time} s, {initial_hz} Hz, {initial_power} dB')

    await time.press('Home')
    await frequency.press('Home')
    await expect(readout.get_by_text('Near the transform boundary', exact=True)).to_be_visible()
    first_time, first_hz, first_start, *_ = await selection()
    first_trace = await trace.get_attribute('d')
    await time.press('End')
    last_time, same_hz, last_start, *_ = await selection()
    if not math.isclose(first_time, 3.502, abs_tol=0.00001) or not math.isclose(last_time, 6.058, abs_tol=0.00001):
        raise RuntimeError(f'Unexpected measured time grid: {first_time}–{last_time} s')
    if same_hz != first_hz or last_start <= first_start:
        raise RuntimeError('Time should shift the linked waveform window and retain the selected frequency')
    await expect(trace).not_to_have_attribute('d', first_trace)

    await frequency.press('End')
    fixed_time, last_hz, *_ = await selection()
    if fixed_time != last_time or not math.isclose(first_hz, 30) or not math.isclose(last_hz, 3000):
        raise RuntimeError(f'Unexpected measured frequency grid: {first_hz}–{last_hz} Hz')
    target = scalogram.locator('.wavelet-plot-pick')
    await expect(target).to_be_visible()
    bounds = await target.bounding_box()
    position = {'x': bounds['width'] * 0.7, 'y': bounds['height'] * 0.22}
    if touch:
        await target.tap(position=position)
    else:
        await target.click(position=position)
    selected_time, selected_hz, start, end = await selection()
    await expect(readout.get_by_text('Near the transform boundary', exact=True)).to_have_count(0)
    expected_time = first_time + (last_time - first_time) * 0.7
    expected_hz = first_hz * (last_hz / first_hz) ** 0.78
    if not math.isclose(selected_time, expected_time, abs_tol=0.02) or not math.isclose(selected_hz, expected_hz, rel_tol=0.05):
        raise RuntimeError(f'Scalogram pick should follow the time and log-frequency axes: {selected_time} s, {selected_hz} Hz')
    if not math.isclose(end - start, 0.25, abs_tol=0.001):
        raise RuntimeError(f'Expected a 0.25 s waveform window, observed {end - start} s')

    for value in ['0.05', '1']:
        previous_trace = await trace.get_attribute('d')
        await window.select_option(value)
        seconds, hz, start, end = await selection()
        if (seconds, hz) != (selected_time, selected_hz) or not math.isclose(end - start, float(value), abs_tol=0.001):
            raise RuntimeError(f'Window {value} s should resize the waveform and preserve selection: {seconds} s, {hz} Hz, {end - start} s')
        await expect(trace).not_to_have_attribute('d', previous_trace)


async def check_envelope_axes(panel, x_label, y_label):
    await expect(panel).to_be_visible()
    await expect(panel.locator('rect[data-envelope-axis-frame]')).to_be_visible()
    await expect(panel.locator('.scientific-tick').first).to_be_attached()
    await expect(panel.get_by_text(x_label, exact=True)).to_be_visible()
    await expect(panel.get_by_text(y_label, exact=True)).to_be_visible()


async def check_envelope_references(spectrum):
    reference = spectrum.locator('[data-envelope-reference]')
    await expect(reference).to_have_count(3)
    await expect(spectrum.locator('text').filter(has_text=re.compile(r'\bBPF[IO]\b')).first).to_be_visible()
    orders = await reference.evaluate_all('references => references.map(ref => Number(ref.dataset.order))')
    if sorted(orders) != [3.57, 5.43, 10.86]:
        raise RuntimeError(f'Expected outer race, inner race and second harmonic reference orders, observed {orders}')


async def check_bearing_envelope(plot, touch):
    chart = plot.locator('[data-envelope-chart]')
    await expect(chart.get_by_role('link', name='Dataset', exact=True)).to_have_attribute('href', OTTAWA_BEARING_DATASET)
    carrier = chart.locator('svg[data-envelope-carrier]')
    spectrum = chart.locator('svg[data-envelope-spectrum]')
    await check_envelope_axes(carrier, 'Carrier frequency (Hz)', 'Relative PSD (dB)')
    await check_envelope_axes(spectrum, 'Order (× shaft frequency)', 'Relative amplitude (dB)')
    trace = spectrum.locator('path[data-envelope-trace]')
    await expect(trace).to_have_attribute('d', re.compile(r'^M'))

    references = chart.get_by_role('checkbox', name='Show reference orders', exact=True)
    await expect(references).to_be_checked()
    await check_envelope_references(spectrum)
    await references.uncheck()
    await expect(spectrum.locator('[data-envelope-reference]')).to_have_count(0)
    await references.check()
    await check_envelope_references(spectrum)

    readout = chart.locator('output[data-envelope-readout]')
    bearing = chart.get_by_role('combobox', name='Bearing condition', exact=True)
    band = chart.get_by_role('combobox', name='Demodulation band', exact=True)
    order = chart.get_by_role('slider', name='Shaft order', exact=True)
    shading = carrier.locator('rect[data-envelope-band]')
    await expect(readout).to_be_visible()
    await expect(shading).to_be_visible()

    async def selected_bin():
        selected_order, level = map(float, await readout.evaluate("output => [output.dataset.order, output.dataset.level]"))
        if not math.isfinite(selected_order) or selected_order < 0 or not -65 <= level <= 0:
            raise RuntimeError(f'Invalid envelope sample: order {selected_order}, relative level {level}')
        return selected_order, level

    async def active_band():
        rectangle = await shading.evaluate("""band => {
          const geometry = band.getBoundingClientRect()
          return [Number(band.dataset.lowHz), Number(band.dataset.highHz), geometry.left, geometry.right]
        }""")
        low, high, left, right = rectangle
        frame = await carrier.locator('rect[data-envelope-axis-frame]').bounding_box()
        if not 0 <= low < high or not frame['x'] - 1 <= left < right <= frame['x'] + frame['width'] + 1:
            raise RuntimeError(f'Demodulation band should be a positive interval within the carrier frame: {rectangle}')
        return rectangle

    await expect(bearing).to_have_value('inner-race-fault')
    await expect(band).to_have_value('high-carrier')
    selected_order, initial_level = await selected_bin()
    if not math.isclose(selected_order, 5.45) or initial_level != 0:
        raise RuntimeError(f'The example should open on the measured fault peak: {selected_order} order, {initial_level} dB')
    first_low, first_high, first_left, first_right = await active_band()
    if (first_low, first_high) != (3200, 6400):
        raise RuntimeError(f'Unexpected initial demodulation band: {first_low}–{first_high} Hz')
    bands = await band.locator('option').evaluate_all('options => options.map(option => option.value)')
    if set(bands) != {'low-carrier', 'mid-carrier', 'high-carrier'}:
        raise RuntimeError(f'Expected the three measured demodulation bands, observed {bands}')
    for value, expected, expected_level in [('low-carrier', (800, 1600), -6.3), ('mid-carrier', (1600, 3200), -8.5)]:
        previous_trace = await trace.get_attribute('d')
        await band.select_option(value)
        low, high, left, right = await active_band()
        if (low, high) != expected or (left, right) == (first_left, first_right):
            raise RuntimeError(f'Changing band should move the carrier highlight to {expected}, observed {low}–{high} Hz')
        shaded_ratio = (right - left) / (first_right - first_left)
        if not math.isclose(shaded_ratio, (high - low) / (first_high - first_low), rel_tol=0.001):
            raise RuntimeError('Band shading width should match the selected frequencies on the carrier axis')
        await expect(trace).not_to_have_attribute('d', previous_trace)
        next_order, level = await selected_bin()
        if next_order != selected_order or not math.isclose(level, expected_level, abs_tol=0.05):
            raise RuntimeError(f'Band {value} should retain the order and report {expected_level} dB, observed {next_order}, {level} dB')

    await band.select_option('high-carrier')
    conditions = await bearing.locator('option').evaluate_all('options => options.map(option => option.value)')
    if set(conditions) != {'healthy', 'inner-race-fault'}:
        raise RuntimeError(f'Expected healthy and fault bearing recordings, observed {conditions}')
    band_trace = await trace.get_attribute('d')
    await bearing.select_option('healthy')
    await expect(trace).not_to_have_attribute('d', band_trace)
    new_order, level = await selected_bin()
    if new_order != selected_order or not math.isclose(level, -35.2, abs_tol=0.05):
        raise RuntimeError(f'The healthy recording should retain the order and report −35.2 dB, observed {new_order}, {level} dB')

    await order.press('Home')
    first_order, _ = await selected_bin()
    await order.press('End')
    last_order, _ = await selected_bin()
    if not math.isclose(first_order, 0.01666667, abs_tol=1e-8) or not math.isclose(last_order, 15):
        raise RuntimeError(f'Unexpected measured order grid: {first_order}–{last_order}')
    target = spectrum.locator('.envelope-plot-pick')
    await expect(target).to_be_visible()
    bounds = await target.bounding_box()
    position = {'x': bounds['width'] * 0.63, 'y': bounds['height'] * 0.5}
    if touch:
        await target.tap(position=position)
    else:
        await target.click(position=position)
    picked_order, _ = await selected_bin()
    expected = first_order + (last_order - first_order) * 0.63
    if not math.isclose(picked_order, expected, abs_tol=0.2):
        raise RuntimeError(f'Pointer pick should align with the linear shaft order axis: {picked_order}')


async def check_eye_figure(eye):
    await expect(eye).to_be_visible()
    await expect(eye.locator('rect[data-eye-axis-frame]')).to_be_visible()
    await expect(eye.locator('.scientific-tick').first).to_be_attached()
    await expect(eye.get_by_text('Time (UI)', exact=True)).to_be_visible()
    await expect(eye.get_by_text('Voltage (mV)', exact=True)).to_be_visible()
    traces = eye.locator('path[data-eye-trace]')
    await expect(traces.first).to_have_attribute('d', re.compile(r'^M'))
    await expect(traces.nth(1)).to_have_attribute('d', re.compile(r'^M'))


async def check_eye_diagram(plot, touch):
    chart = plot.locator('[data-eye-diagram]')
    caption = chart.locator('figcaption')
    await expect(caption).to_contain_text(re.compile(r'\bsimulat(?:ed|ion)\b', re.I))
    await expect(caption.locator('a').first).to_have_attribute('href', re.compile(r'^https://(?:[a-z0-9-]+\.)?tek\.com/'))
    eye = chart.locator('svg[data-eye-plot]')
    await check_eye_figure(eye)
    first_trace = eye.locator('path[data-eye-trace]').first
    sampling = eye.locator('line[data-eye-sampling-line]')
    opening = eye.locator('path[data-eye-opening]')
    await expect(sampling).to_be_attached()
    readout = chart.locator('output[data-eye-readout]')
    channel = chart.get_by_role('combobox', name='Channel', exact=True)
    phase = chart.get_by_role('slider', name='Sampling phase', exact=True)
    await expect(readout).to_be_visible()
    await expect(channel).to_have_value('reference')

    async def metrics():
        data = await readout.evaluate(
            "out => ['phase', 'heightMv', 'jitterUi', 'overshootPercent'].map(key => out.dataset[key])"
        )
        selected_phase, height, jitter, overshoot = map(float, data)
        if not all(map(math.isfinite, (selected_phase, height, jitter, overshoot))) or not (
            0 <= selected_phase <= 1 and jitter >= 0 and overshoot >= 0
        ):
            raise RuntimeError(f'Invalid simulated eye view metrics: {data}')
        return selected_phase, height, jitter, overshoot

    center, reference_height, reference_jitter, reference_overshoot = await metrics()
    if center != 0.5 or reference_height <= 0:
        raise RuntimeError(f'The reference eye should open at the default 0.5 UI phase: {center}, {reference_height} mV')
    await expect(opening).to_be_visible()
    initial_trace = await first_trace.get_attribute('d')
    initial_opening = await opening.get_attribute('d')

    await phase.press('Home')
    first_phase, edge_height, *_ = await metrics()
    first_x = float(await sampling.get_attribute('x1'))
    if first_phase != 0 or edge_height >= 0:
        raise RuntimeError(f'The eye should be closed at the symbol boundary: {first_phase} UI, {edge_height} mV')
    await expect(opening).to_have_count(0)
    await phase.press('End')
    last_phase, *_ = await metrics()
    last_x = float(await sampling.get_attribute('x1'))
    if last_phase != 1 or last_x <= first_x:
        raise RuntimeError('Keyboard endpoints should span exactly one unit interval')

    target = eye.locator('.eye-plot-pick')
    await expect(target).to_be_visible()
    bounds = await target.bounding_box()
    position = {'x': bounds['width'] * 0.72, 'y': bounds['height'] * 0.5}
    if touch:
        await target.tap(position=position)
    else:
        await target.click(position=position)
    picked_phase, picked_height, *_ = await metrics()
    selected_x = float(await sampling.get_attribute('x1'))
    if not math.isclose(picked_phase, 0.72, abs_tol=0.015) or not math.isclose(
        selected_x, first_x + picked_phase * (last_x - first_x), abs_tol=0.5
    ):
        raise RuntimeError(f'Pointer selection and plotted sampling line should share the chosen phase: {picked_phase} UI')
    if picked_height > 0:
        await expect(opening).not_to_have_attribute('d', initial_opening)

    selected_phase_text = await readout.get_attribute('data-phase')
    await channel.select_option('impaired')
    await expect(readout).to_have_attribute('data-phase', selected_phase_text)
    await expect(first_trace).not_to_have_attribute('d', initial_trace)
    await phase.fill('0.5')
    center, impaired_height, impaired_jitter, impaired_overshoot = await metrics()
    if center != 0.5 or not (0 < impaired_height < reference_height and impaired_jitter > reference_jitter
                              and impaired_overshoot > reference_overshoot):
        raise RuntimeError(f'Impairment should reduce eye opening and increase jitter/overshoot at 0.5 UI: '
                           f'{impaired_height} mV, {impaired_jitter} UI, {impaired_overshoot}%')
    expected_metrics = [
        ((reference_height, reference_jitter, reference_overshoot), (795.07866, 0.00349593, 0.49311167)),
        ((impaired_height, impaired_jitter, impaired_overshoot), (363.54172, 0.03962228, 8.51445402)),
    ]
    for actual, expected in expected_metrics:
        if not all(math.isclose(value, target, abs_tol=tolerance)
                   for value, target, tolerance in zip(actual, expected, (0.01, 1e-7, 0.001))):
            raise RuntimeError(f'Expected independently derived metrics {expected}, observed {actual}')
    await expect(opening).to_be_visible()


async def check_allan_figure(allan, compact=False):
    await expect(allan).to_be_visible()
    await expect(allan.locator('rect[data-allan-axis-frame]')).to_be_visible()
    await expect(allan.locator('.scientific-tick').first).to_be_attached()
    await expect(allan.get_by_text('Averaging time, τ (s)', exact=True)).to_be_visible()
    label = 'Allan deviation' if compact else 'Overlapping Allan deviation'
    await expect(allan.get_by_text(re.compile(rf'^{label}, σᵧ\(τ\)(?: \(.+\))?$'))).to_be_visible()
    traces = allan.locator('path[data-allan-trace]')
    await expect(traces).to_have_count(3)
    await expect(traces.first).to_have_attribute('d', re.compile(r'^M'))


async def check_allan_deviation(plot, touch):
    chart = plot.locator('[data-allan-deviation]')
    await expect(chart.locator('figcaption a').first).to_have_attribute(
        'href', re.compile(r'^https://doi\.org/10\.18434/M32206/?$', re.I)
    )
    allan = chart.locator('svg[data-allan-plot]')
    await check_allan_figure(allan)
    reference = allan.locator('[data-allan-reference]')
    slopes = chart.get_by_role('checkbox', name='Show reference slopes', exact=True)
    await expect(slopes).to_be_checked()
    await expect(reference).to_have_count(3)
    shown_slopes = await reference.evaluate_all('lines => lines.map(line => Number(line.dataset.slope))')
    if sorted(shown_slopes) != [-0.5, 0, 0.5]:
        raise RuntimeError(f'Expected the three logarithmic reference slopes, observed {shown_slopes}')
    await slopes.uncheck()
    await expect(reference).to_have_count(0)
    await slopes.check()
    await expect(reference).to_have_count(3)

    readout = chart.locator('output[data-allan-readout]')
    averaging = chart.get_by_role('slider', name='Averaging time', exact=True)
    cursor = allan.locator('circle[data-allan-cursor]')
    await expect(readout).to_be_visible()
    await expect(cursor).to_be_visible()

    async def selection():
        data = await readout.evaluate("out => ['tau', 'deviation', 'pairs'].map(key => out.dataset[key])")
        tau, deviation, pairs = map(float, data)
        if not all(map(math.isfinite, (tau, deviation, pairs))) or not (tau > 0 and deviation > 0 and pairs > 0 and pairs.is_integer()):
            raise RuntimeError(f'Invalid Allan deviation sample: {data}')
        return tau, deviation, pairs

    await averaging.press('Home')
    first_tau, first_deviation, first_pairs = await selection()
    left, first_y = [float(await cursor.get_attribute(key)) for key in ('cx', 'cy')]
    await averaging.press('End')
    last_tau, last_deviation, last_pairs = await selection()
    right, last_y = [float(await cursor.get_attribute(key)) for key in ('cx', 'cy')]
    if (first_tau, first_pairs, last_tau, last_pairs) != (1, 44000, 10000, 24002) or not left < right:
        raise RuntimeError(f'Unexpected NIST averaging endpoints and pair counts: {first_tau}, {first_pairs}, {last_tau}, {last_pairs}')

    recording = chart.get_by_role('combobox', name='Recording', exact=True)
    await expect(recording).to_have_value('optical')
    point = allan.locator('circle[data-allan-point][data-curve="optical"][data-tau="100"]')
    await expect(point).to_be_visible()
    tau, deviation, pairs = map(float, await point.evaluate("point => [point.dataset.tau, point.dataset.deviation, point.dataset.pairs]"))
    if pairs != 43802 or not math.isclose(deviation, 2.858125499849438e-17, rel_tol=1e-9):
        raise RuntimeError(f'Unexpected measured optical beat at 100 s: {deviation} from {pairs} pairs')
    x, y = [float(await point.get_attribute(key)) for key in ('cx', 'cy')]
    expected_x = left + (right - left) * math.log(tau / first_tau) / math.log(last_tau / first_tau)
    expected_y = first_y + (last_y - first_y) * math.log(deviation / first_deviation) / math.log(last_deviation / first_deviation)
    if not math.isclose(x, expected_x, abs_tol=0.5) or not math.isclose(y, expected_y, abs_tol=0.5):
        raise RuntimeError(f'The Allan point should follow a log scale on both axes: observed ({x}, {y}), expected ({expected_x}, {expected_y})')

    target = allan.locator('.allan-plot-pick')
    await expect(target).to_be_visible()
    bounds = await target.bounding_box()
    point_bounds = await point.bounding_box()
    position = {'x': point_bounds['x'] + point_bounds['width'] * 0.5 - bounds['x'], 'y': bounds['height'] * 0.5}
    if touch:
        await target.tap(position=position)
    else:
        await target.click(position=position)
    if await selection() != (tau, deviation, pairs):
        raise RuntimeError('Pointer selection should report the deviation and pair count of the plotted averaging time')

    for curve_id, expected in [('microwave', 2.86930895664297e-17), ('residual', 3.454429003013355e-18)]:
        await recording.select_option(curve_id)
        await expect(cursor).to_have_attribute('data-curve', curve_id)
        selected_tau, selected_deviation, selected_pairs = await selection()
        if (selected_tau, selected_pairs) != (100, 43802) or not math.isclose(selected_deviation, expected, rel_tol=1e-9):
            raise RuntimeError(f'Unexpected measured {curve_id} at shared 100 s: {selected_tau}, {selected_deviation}, {selected_pairs}')


async def check_phase_figure(portrait):
    await expect(portrait).to_be_visible()
    await expect(portrait.locator('rect[data-phase-axis-frame]')).to_be_visible()
    await expect(portrait.locator('.scientific-tick').first).to_be_attached()
    await expect(portrait.locator('line.phase-zero')).to_have_count(2)
    await expect(portrait.get_by_text('Angular displacement, θ (rad)', exact=True)).to_be_visible()
    await expect(portrait.get_by_text('Angular velocity, ω (rad/s)', exact=True)).to_be_visible()
    await expect(portrait.locator('path[data-phase-trace]')).to_have_attribute('d', re.compile(r'^M'))
    await expect(portrait.locator('path[data-phase-direction]').first).to_have_attribute('d', re.compile(r'^M'))


async def check_phase_plane(plot, touch):
    chart = plot.locator('[data-phase-plane]')
    await expect(chart.locator('figcaption a').first).to_have_attribute(
        'href', re.compile(r'^https://github\.com/EnzeXu/Damped_Pendulum_Dataset(?:/tree/cbf82673641ecd65e902ad5c38a048387649a2a0)?/?$')
    )
    portrait = chart.locator('svg[data-phase-plot]')
    await check_phase_figure(portrait)
    history = chart.locator('svg[data-phase-history]')
    await expect(history).to_be_visible()
    await expect(history.get_by_text('Time, t (s)', exact=True)).to_be_visible()
    await expect(history.get_by_text('Angular displacement, θ (rad)', exact=True)).to_be_visible()
    await expect(chart.get_by_role('checkbox', name='Show direction field', exact=True)).to_have_count(0)
    await expect(portrait.locator('[data-phase-field]')).to_have_count(0)

    time = chart.get_by_role('slider', name='Time', exact=True)
    trajectory = chart.get_by_role('combobox', name='Trajectory', exact=True)
    readout = chart.locator('output[data-phase-readout]')
    phase_cursor = portrait.locator('circle[data-phase-cursor]')
    history_cursor = history.locator('circle[data-phase-history-cursor]')
    await expect(readout).to_be_visible()
    await expect(phase_cursor).to_be_visible()
    await expect(history_cursor).to_be_visible()
    ids = await trajectory.locator('option').evaluate_all('options => options.map(option => option.value)')
    if set(ids) != {'air-only', 'small-baffle', 'large-baffle'}:
        raise RuntimeError(f'Expected the three measured pendulum recordings, observed {ids}')
    await expect(trajectory).to_have_value('large-baffle')

    async def selection():
        values = await readout.evaluate("out => ['time', 'position', 'velocity'].map(key => out.dataset[key])")
        seconds, position, velocity = map(float, values)
        if not all(map(math.isfinite, (seconds, position, velocity))):
            raise RuntimeError(f'Invalid pendulum state: {values}')
        await expect(phase_cursor).to_have_attribute('data-time', values[0])
        await expect(phase_cursor).to_have_attribute('data-position', values[1])
        await expect(phase_cursor).to_have_attribute('data-velocity', values[2])
        await expect(history_cursor).to_have_attribute('data-time', values[0])
        await expect(history_cursor).to_have_attribute('data-position', values[1])
        return seconds, position, velocity

    async def cursor_x():
        return await history_cursor.evaluate('cursor => { const box = cursor.getBoundingClientRect(); return box.left + box.width / 2 }')

    if await selection() != (2, -0.028, -1.99):
        raise RuntimeError('The guide should open on the measured large-baffle state at 2 s')
    await time.press('Home')
    first_time, first_position, first_velocity = await selection()
    if (first_time, first_position, first_velocity) != (0, 0.559, 0):
        raise RuntimeError(f'Unexpected large-baffle state at release: {first_time}, {first_position}, {first_velocity}')
    left = await cursor_x()
    first_phase = [await phase_cursor.get_attribute(key) for key in ('cx', 'cy')]
    await time.press('End')
    last_time, last_position, last_velocity = await selection()
    right = await cursor_x()
    if (last_time, last_position, last_velocity) != (16, 0.276, -0.471) or not left < right:
        raise RuntimeError(f'Unexpected final large-baffle sample: {last_time}, {last_position}, {last_velocity}')
    if [await phase_cursor.get_attribute(key) for key in ('cx', 'cy')] == first_phase:
        raise RuntimeError(f'Time should move the phase cursor away from ({first_position}, {first_velocity})')

    target = history.locator('.phase-history-pick')
    await expect(target).to_be_visible()
    bounds = await target.bounding_box()
    fraction = 0.63
    position = {'x': left + (right - left) * fraction - bounds['x'], 'y': bounds['height'] * 0.5}
    if touch:
        await target.tap(position=position)
    else:
        await target.click(position=position)
    selected_time, selected_position, selected_velocity = await selection()
    expected_time = first_time + (last_time - first_time) * fraction
    nominal_step = (last_time - first_time) / float(await time.get_attribute('max'))
    if not math.isclose(selected_time, expected_time, abs_tol=nominal_step * 2):
        raise RuntimeError(f'History pointer should select the plotted time: expected around {expected_time} s, observed {selected_time} s')

    trace = portrait.locator('path[data-phase-trace]')
    for trajectory_id in ['air-only', 'small-baffle']:
        original_path = await trace.get_attribute('d')
        await trajectory.select_option(trajectory_id)
        await expect(trace).not_to_have_attribute('d', original_path)
        next_time, position, velocity = await selection()
        if next_time != selected_time or (position, velocity) == (selected_position, selected_velocity):
            raise RuntimeError('Changing trajectories should preserve requested time and move to the corresponding state')

    await time.fill('50')
    for trajectory_id, state in [('air-only', (-0.101, -2.147)), ('small-baffle', (-0.094, -2.251))]:
        await trajectory.select_option(trajectory_id)
        if await selection() != (2, *state):
            raise RuntimeError(f'Unexpected measured {trajectory_id} state at 2 s')


async def check_xrd_profile(profile):
    await expect(profile).to_be_visible()
    await expect(profile.locator('rect[data-xrd-axis-frame]')).to_be_visible()
    await expect(profile.locator('.scientific-tick').first).to_be_attached()
    await expect(profile.get_by_text('Diffraction angle, 2θ (°)', exact=True)).to_be_visible()
    await expect(profile.get_by_text('Intensity (a.u.)', exact=True)).to_be_visible()
    await expect(profile.locator('[data-xrd-measured]')).to_be_visible()
    await expect(profile.locator('path[data-xrd-fit]')).to_have_attribute('d', re.compile(r'^M'))


async def check_xrd_peak_tracker(plot, touch):
    chart = plot.locator('[data-xrd-peak-tracker]')
    await expect(chart.locator('figcaption a').first).to_have_attribute(
        'href', re.compile(r'^https://doi\.org/10\.7910/DVN/ACPWBG/?$', re.I)
    )
    profile = chart.locator('svg[data-xrd-profile]')
    await check_xrd_profile(profile)
    fit = profile.locator('path[data-xrd-fit]')
    await expect(profile.locator('[data-xrd-baseline]')).to_be_attached()
    await expect(profile.locator('[data-xrd-fwhm]')).to_be_visible()
    await expect(chart.locator('svg[data-xrd-trend]')).to_have_count(3)
    trends = {name: chart.locator(f'svg[data-xrd-trend][data-metric="{name}"]') for name in ['center', 'fwhm', 'height']}
    for name, label in [('center', '2θ (°)'), ('fwhm', 'FWHM (°)'), ('height', 'Height (a.u.)')]:
        trend = trends[name]
        await expect(trend).to_be_visible()
        await expect(trend.get_by_text('Temperature (K)', exact=True)).to_be_visible()
        await expect(trend.get_by_text(label, exact=True)).to_be_visible()
    peak = chart.get_by_role('combobox', name='Peak', exact=True)
    temperatures = chart.get_by_role('slider', name='Temperature', exact=True)
    readout = chart.locator('output[data-xrd-readout]')
    await expect(readout).to_be_visible()
    await expect(peak).to_have_value('peak-high')

    async def selection():
        values = await readout.evaluate(
            "out => ['temperature', 'center', 'fwhm', 'height', 'rmse'].map(key => out.dataset[key])"
        )
        kelvin, center, fwhm, height, rmse = map(float, values)
        if not all(map(math.isfinite, (kelvin, center, fwhm, height, rmse))) or not (
            kelvin > 0 and center > 0 and fwhm > 0 and height > 0 and rmse >= 0
        ):
            raise RuntimeError(f'Invalid local XRD fit or temperature: {values}')
        cursor_x_positions = []
        for metric, value in zip(trends, values[1:4]):
            cursor = trends[metric].locator('circle[data-xrd-trend-cursor]')
            await expect(cursor).to_be_visible()
            await expect(cursor).to_have_attribute('data-temperature', values[0])
            await expect(cursor).to_have_attribute('data-value', value)
            cursor_x_positions.append(float(await cursor.get_attribute('cx')))
        if max(cursor_x_positions) - min(cursor_x_positions) > 0.5:
            raise RuntimeError(f'XRD trend cursors should align at the selected temperature: {cursor_x_positions}')
        return kelvin, center, fwhm, height, rmse

    trend_cursor = trends['center'].locator('circle[data-xrd-trend-cursor]')

    async def cursor_x():
        return await trend_cursor.evaluate('cursor => { const box = cursor.getBoundingClientRect(); return box.left + box.width / 2 }')

    async def pick(target, x):
        await expect(target).to_be_visible()
        bounds = await target.bounding_box()
        position = {'x': x - bounds['x'], 'y': bounds['height'] * 0.5}
        if touch:
            await target.tap(position=position)
        else:
            await target.click(position=position)

    initial_fit = await selection()
    await temperatures.press('Home')
    first_temperature, *_ = await selection()
    first_x = await cursor_x()
    first_fit = await fit.get_attribute('d')
    await temperatures.press('End')
    last_temperature, *_ = await selection()
    last_x = await cursor_x()
    if (first_temperature, last_temperature) != (10.91, 294.11) or not first_x < last_x:
        raise RuntimeError(f'Unexpected temperature endpoints or cursor positions: {first_temperature}–{last_temperature} K')
    await expect(fit).not_to_have_attribute('d', first_fit)

    await temperatures.fill('13')
    chosen_temperature, *_ = await selection()
    expected_x = first_x + (last_x - first_x) * (269.16 - first_temperature) / (last_temperature - first_temperature)
    if chosen_temperature != 269.16 or not math.isclose(await cursor_x(), expected_x, abs_tol=0.5):
        raise RuntimeError('The cursor must position 269.16 K using its physical temperature instead of its recording index')
    await temperatures.press('Home')

    hit = trends['center'].locator('.xrd-trend-pick')
    await pick(hit, expected_x)
    picked_fit = await selection()
    picked_temperature = picked_fit[0]
    if picked_temperature != chosen_temperature:
        raise RuntimeError(f'Trend selection should pick the nearest physical temperature: {picked_temperature} K')
    known_fits = [
        (initial_fit, (144.29, 5.358128979, 0.02017690145, 63.56737184, 1.554932679)),
        (picked_fit, (269.16, 5.349275413, 0.02301408353, 25.28104532, 0.2268623807)),
    ]
    for observed, expected in known_fits:
        if not all(math.isclose(value, anchor, rel_tol=1e-7) for value, anchor in zip(observed, expected)):
            raise RuntimeError(f'Unexpected high-peak fit: observed {observed}, expected {expected}')

    options = await peak.locator('option').evaluate_all('options => options.map(option => option.value)')
    if set(options) != {'peak-low', 'peak-middle', 'peak-high'}:
        raise RuntimeError(f'Expected the three local diffraction peaks, observed {options}')
    initial_peak = await peak.input_value()
    previous_center = (await selection())[1]
    previous_fit = await fit.get_attribute('d')
    await peak.select_option(next(value for value in options if value != initial_peak))
    new_temperature, center, *_ = await selection()
    if new_temperature != picked_temperature or center == previous_center:
        raise RuntimeError('Changing tracked peak should retain the scan and show its local fit')
    await expect(fit).not_to_have_attribute('d', previous_fit)

    profile_hit = profile.locator('.xrd-profile-pick')
    await expect(profile_hit).to_be_visible()
    profile_bounds = await profile_hit.bounding_box()
    minimum_angle, maximum_angle = 5.00235532352023, 5.499932201584514
    for angle in [5.29, 5.45]:
        x = profile_bounds['x'] + profile_bounds['width'] * (angle - minimum_angle) / (maximum_angle - minimum_angle)
        await pick(profile_hit, x)
        await expect(peak).to_have_value('peak-middle')
        if (await selection())[0] != picked_temperature:
            raise RuntimeError(f'Picking diffraction angle {angle}° should retain the selected scan')


async def check_stress_axes(panel):
    await expect(panel).to_be_visible()
    await expect(panel.locator('rect.scientific-frame')).to_be_visible()
    await expect(panel.locator('.scientific-tick').first).to_be_attached()
    await expect(panel.get_by_text('Engineering strain, ε (%)', exact=True)).to_be_visible()
    await expect(panel.get_by_text('Engineering stress, σ (MPa)', exact=True)).to_be_visible()


async def check_stress_strain(plot):
    chart = plot.locator('[data-stress-strain-comparison]')
    await expect(chart.locator('figcaption a').first).to_have_attribute(
        'href', re.compile(r'^https://(?:doi\.org/10\.5281/zenodo\.|zenodo\.org/records/)10377164/?$')
    )
    overview = chart.locator('svg[data-stress-overview]')
    detail = chart.locator('svg[data-stress-detail]')
    await check_stress_axes(overview)
    await check_stress_axes(detail)
    curves = overview.locator('path[data-stress-curve]')
    conditions = {
        't61': (78928.05, 363.2333, 428.6515454439417, 0.0529786866721968, 419.8302238439861),
        'aged-160c': (69495.98, 283.0986, 362.0105593051729, 0.0819847441562559, 335.8435939304965),
        'aged-190c': (66815.61, 248.9384, 342.7704259942056, 0.0787740619650348, 322.1875264674847),
    }
    await expect(curves).to_have_count(len(conditions))
    for name in conditions:
        await expect(overview.locator(f'path[data-stress-curve][data-condition="{name}"]')).to_have_attribute('d', re.compile(r'^M'))
    fit = detail.locator('path[data-stress-elastic]')
    offset = detail.locator('path[data-stress-offset]')
    measured = detail.locator('path[data-stress-detail-curve]')
    proof = detail.locator('circle[data-stress-proof]')
    ultimate_point = overview.locator('circle[data-stress-ultimate]')
    endpoint = overview.locator('circle[data-stress-endpoint]')
    for path in [fit, offset, measured]:
        await expect(path).to_have_attribute('d', re.compile(r'^M'))
    await expect(offset).to_have_attribute('data-offset-strain', '0.002')
    condition = chart.get_by_role('combobox', name='Condition', exact=True)
    readout = chart.locator('output[data-stress-readout]')
    await expect(readout).to_be_visible()
    choices = await condition.locator('option').evaluate_all('options => options.map(option => option.value)')
    if set(choices) != set(conditions):
        raise RuntimeError(f'Expected the three measured aluminum conditions, observed {choices}')

    previous_curve = None
    for name, expected in conditions.items():
        await condition.select_option(name)
        await expect(readout).to_have_attribute('data-condition', name)
        await expect(readout).to_have_attribute('data-fracture', 'false')
        await expect(readout).to_contain_text('Recorded endpoint strain')
        await expect(proof).to_be_visible()
        await expect(ultimate_point).to_be_visible()
        await expect(endpoint).to_be_visible()
        metrics = await readout.evaluate("out => ['modulus', 'proof', 'ultimate', 'endStrain'].map(key => Number(out.dataset[key]))")
        modulus, proof_stress, ultimate, end_strain = metrics
        strain, stress = await proof.evaluate("point => [Number(point.dataset.strain), Number(point.dataset.stress)]")
        intercept = float(await fit.get_attribute('data-intercept'))
        slope = float(await fit.get_attribute('data-slope'))
        if not all(map(math.isfinite, [*metrics, strain, stress, intercept, slope])) or not (
            end_strain > strain > 0.002 and ultimate >= proof_stress > 0 and modulus > 0
        ):
            raise RuntimeError(f'Invalid mechanical indicators for {name}: {metrics}, proof ({strain}, {stress})')
        if not all((
            math.isclose(slope, modulus, abs_tol=0.1),
            math.isclose(stress, proof_stress, abs_tol=0.001),
            math.isclose(stress, slope * (strain - 0.002) + intercept, abs_tol=0.02),
        )):
            raise RuntimeError(f'Proof stress for {name} must lie at the 0.2% offset intersection')
        if not math.isclose(float(await ultimate_point.get_attribute('data-stress')), ultimate, abs_tol=0.001) or not math.isclose(
            float(await endpoint.get_attribute('data-strain')), end_strain, abs_tol=1e-10
        ):
            raise RuntimeError(f'Ultimate and endpoint markers should match the measured indicators for {name}')
        measured_values = [*metrics, float(await endpoint.get_attribute('data-stress'))]
        if not all(math.isclose(value, target, abs_tol=tolerance) for value, target, tolerance in zip(
            measured_values, expected, (0.1, 0.001, 0.001, 1e-10, 0.001)
        )):
            raise RuntimeError(f'Unexpected analysis for {name}: observed {measured_values}, expected {expected}')

        errors = await proof.evaluate("""marker => {
          const panel = marker.ownerSVGElement
          const x = marker.cx.baseVal.value
          const y = marker.cy.baseVal.value
          const atX = path => {
            let low = 0
            let high = path.getTotalLength()
            for (let i = 0; i < 22; i++) {
              const middle = (low + high) / 2
              if (path.getPointAtLength(middle).x < x) low = middle
              else high = middle
            }
            return path.getPointAtLength((low + high) / 2).y
          }
          const atY = path => {
            const first = path.getPointAtLength(0)
            const last = path.getPointAtLength(path.getTotalLength())
            return first.x + (last.x - first.x) * (y - first.y) / (last.y - first.y)
          }
          const frame = panel.querySelector('rect.scientific-frame')
          const left = Number(frame.getAttribute('x'))
          const right = left + Number(frame.getAttribute('width'))
          const bottom = Number(frame.getAttribute('y')) + Number(frame.getAttribute('height'))
          const ticks = Array.from(panel.querySelectorAll('text')).filter(label => Number(label.getAttribute('y')) > bottom)
            .map(label => [Number(label.getAttribute('x')), Number(label.textContent.trim().replace('−', '-'))])
            .filter(([tickX, strain]) => left - 0.5 <= tickX && tickX <= right + 0.5 && Number.isFinite(strain))
            .sort(([a], [b]) => a - b)
          const first = ticks[0]
          const last = ticks[ticks.length - 1]
          const offset = panel.querySelector('[data-stress-offset]')
          const elastic = panel.querySelector('[data-stress-elastic]')
          const measured = panel.querySelector('[data-stress-detail-curve]')
          const expectedShift = 0.2 * (last[0] - first[0]) / (last[1] - first[1])
          return [
            Math.abs(atX(measured) - y),
            Math.abs(atX(offset) - y),
            Math.abs((atY(offset) - atY(elastic)) - expectedShift),
          ]
        }""")
        if any(error is None or error > 0.75 for error in errors):
            raise RuntimeError(f'Rendered proof point or offset spacing is inconsistent for {name}: {errors} SVG units')
        if previous_curve is not None:
            await expect(measured).not_to_have_attribute('d', previous_curve)
        previous_curve = await measured.get_attribute('d')


async def check_strain_map(strain_map):
    await expect(strain_map).to_be_visible()
    await expect(strain_map.locator('rect[data-strain-map-frame]')).to_be_visible()
    await expect(strain_map.locator('.scientific-tick').first).to_be_attached()
    await expect(strain_map.get_by_text('X (mm)', exact=True)).to_be_visible()
    await expect(strain_map.get_by_text('Y (mm)', exact=True)).to_be_visible()
    raster = strain_map.locator('image[data-strain-raster]')
    await expect(raster).to_have_attribute('href', re.compile(r'^data:image/png;base64,'))
    if await raster.evaluate('image => getComputedStyle(image).imageRendering') in ('crisp-edges', 'pixelated'):
        raise RuntimeError('The strain raster should use smooth rendering')
    raster_size = await raster.evaluate("""async raster => {
      const image = new Image()
      image.src = raster.getAttribute('href')
      await image.decode()
      return [image.naturalWidth, image.naturalHeight]
    }""")
    if min(raster_size) < 128:
        raise RuntimeError(f'Expected a dense strain-map PNG, observed {raster_size}')
    colorbar = strain_map.locator('[data-strain-colorbar]')
    await expect(colorbar.locator('text').first).to_be_visible()
    await expect(colorbar.locator('rect[fill^="url("]')).to_be_visible()


async def check_full_field_strain(plot, touch):
    chart = plot.locator('[data-full-field-strain]')
    await expect(chart.locator('figcaption a').first).to_have_attribute(
        'href', re.compile(r'^https://(?:doi\.org/10\.5281/zenodo\.|zenodo\.org/records/)18617429/?$')
    )
    strain_map = chart.locator('svg[data-strain-map]')
    await check_strain_map(strain_map)
    raster = strain_map.locator('image[data-strain-raster]')
    colorbar = strain_map.locator('[data-strain-colorbar]')
    probe = strain_map.locator('[data-strain-probe]')
    await expect(probe).to_be_visible()
    inspect = strain_map.get_by_role('button', name='Inspect strain map', exact=True)
    await expect(inspect).to_be_visible()
    force = chart.locator('svg[data-strain-force]')
    await expect(force).to_be_visible()
    await expect(force.get_by_text('Elapsed time (s)', exact=True)).to_be_visible()
    await expect(force.get_by_text('Force (N)', exact=True)).to_be_visible()
    force_cursor = force.locator('circle[data-strain-force-cursor]')
    await expect(force_cursor).to_be_visible()
    frame = chart.get_by_role('slider', name='Frame', exact=True)
    readout = chart.locator('output[data-strain-readout]')
    await expect(readout).to_be_visible()

    async def selection():
        data = await readout.evaluate(
            "out => ['xMm', 'yMm', 'stage', 'force', 'strain'].map(key => out.dataset[key])"
        )
        x, y, stage, newtons = map(float, data[:4])
        strain = float(data[4]) if data[4] not in ('', None) else None
        if not all(map(math.isfinite, (x, y, stage, newtons))) or (strain is not None and not math.isfinite(strain)):
            raise RuntimeError(f'Invalid strain-map or force state: {data}')
        await expect(force_cursor).to_have_attribute('data-stage', data[2])
        await expect(force_cursor).to_have_attribute('data-force', data[3])
        return x, y, stage, newtons, strain

    async def cursor_x():
        return await force_cursor.evaluate('cursor => { const box = cursor.getBoundingClientRect(); return box.left + box.width / 2 }')

    async def pick(target, x, y):
        await expect(target).to_be_visible()
        position = {'x': x, 'y': y}
        if touch:
            await target.tap(position=position)
        else:
            await target.click(position=position)

    initial_scale = await colorbar.locator('text').all_text_contents()
    labels = [value.strip().replace('−', '-').removesuffix('%') for value in initial_scale]
    scale = [float(label) for label in labels if re.fullmatch(r'-?\d+(?:\.\d+)?', label)]
    if not scale or (min(scale), max(scale)) != (-5, 70):
        raise RuntimeError(f'Expected the declared −5% to 70% scale, observed {initial_scale}')
    if (await selection())[2] != 60:
        raise RuntimeError('The measured example should open at 60 s')
    await frame.press('Home')
    first_selection = await selection()
    await expect(raster).to_have_attribute('data-stage', await readout.get_attribute('data-stage'))
    first_raster = await raster.get_attribute('href')
    left = await cursor_x()
    await frame.press('End')
    last_selection = await selection()
    right = await cursor_x()
    if (first_selection[2], last_selection[2]) != (1, 62.9) or not left < right or not (
        math.isclose(first_selection[3], 1.109, abs_tol=0.002) and math.isclose(last_selection[3], 58.394, abs_tol=0.002)
    ):
        raise RuntimeError(f'Unexpected first/last measured force stages: {first_selection[2:4]}, {last_selection[2:4]}')
    await expect(raster).to_have_attribute('data-stage', await readout.get_attribute('data-stage'))
    await expect(raster).not_to_have_attribute('href', first_raster)
    await expect(raster).to_have_attribute('href', re.compile(r'^data:image/png;base64,'))
    if await colorbar.locator('text').all_text_contents() != initial_scale:
        raise RuntimeError('All strain frames should share the same color scale')

    middle = int(await frame.get_attribute('max')) // 2
    await frame.fill(str(middle))
    selected_frame = (await selection())[2:4]
    if selected_frame[0] != 30 or not math.isclose(selected_frame[1], 38.429, abs_tol=0.002):
        raise RuntimeError(f'Expected the measured 30 s frame at 38.429 N, observed {selected_frame}')
    target_x = await cursor_x()
    await frame.press('Home')
    target = force.locator('.strain-force-pick')
    await expect(target).to_be_visible()
    bounds = await target.bounding_box()
    await pick(target, target_x - bounds['x'], bounds['height'] * 0.5)
    if (await selection())[2:4] != selected_frame:
        raise RuntimeError('The force plot should select the same frame and measured force as the slider')

    bounds = await inspect.bounding_box()
    hotspot_x, hotspot_y = 12.075, 23.1
    await pick(inspect, bounds['width'] * hotspot_x / 19.95, bounds['height'] * (1 - hotspot_y / 29.925))
    x, y, stage, newtons, measured_strain = await selection()
    if (stage, newtons) != selected_frame or not (
        math.isclose(x, hotspot_x) and math.isclose(y, hotspot_y) and measured_strain is not None
        and math.isclose(measured_strain, 22.944, abs_tol=0.002)
    ):
        raise RuntimeError(f'Unexpected 30 s hotspot probe: ({x}, {y}) mm at {measured_strain}%')
    await frame.press('End')
    last_x, last_y, _, _, last_strain = await selection()
    if (last_x, last_y) != (x, y) or last_strain is None or not math.isclose(last_strain, 67.033, abs_tol=0.002):
        raise RuntimeError(f'Final map should retain the hotspot and report 67.033%, observed {last_strain}%')
    await frame.fill(str(middle))
    await inspect.press('ArrowRight')
    right_x, same_y, stage, newtons, _ = await selection()
    if not math.isclose(right_x - x, 0.525) or same_y != y or (stage, newtons) != selected_frame:
        raise RuntimeError('ArrowRight should advance the spatial probe by one measured grid step along +X')
    await inspect.press('ArrowUp')
    same_x, upper_y, stage, newtons, _ = await selection()
    if same_x != right_x or not math.isclose(upper_y - same_y, 0.525) or (stage, newtons) != selected_frame:
        raise RuntimeError('ArrowUp should advance the spatial probe by one measured grid step along +Y')


async def check_fatigue_figure(fatigue):
    await expect(fatigue).to_be_visible()
    await expect(fatigue.locator('rect[data-fatigue-axis-frame]')).to_be_visible()
    await expect(fatigue.locator('.scientific-tick').first).to_be_attached()
    await expect(fatigue.get_by_text('Cycles, N (log scale)', exact=True)).to_be_visible()
    await expect(fatigue.get_by_text('Stress amplitude, σₐ (MPa)', exact=True)).to_be_visible()
    await expect(fatigue.locator('circle[data-fatigue-failure]').first).to_be_visible()
    runouts = fatigue.locator('path[data-fatigue-runout]')
    await expect(runouts).to_have_count(2)
    symbols = await runouts.evaluate_all("""arrows => arrows.map(arrow => {
      const node = arrow.parentElement.querySelector('circle.fatigue-runout-node')
      const markerRight = node.cx.baseVal.value + node.r.baseVal.value
      const arrowBox = arrow.getBBox()
      const frame = arrow.ownerSVGElement.querySelector('rect[data-fatigue-axis-frame]')
      const right = frame.x.baseVal.value + frame.width.baseVal.value
      return [getComputedStyle(node).fill, arrowBox.x - markerRight, arrowBox.x + arrowBox.width - markerRight,
        right - arrowBox.x - arrowBox.width]
    })""")
    for fill, start, end, clearance in symbols:
        if fill not in ('none', 'rgb(255, 255, 255)', 'rgba(0, 0, 0, 0)') or abs(start) > 0.5 or end < 2 or clearance < -0.5:
            raise RuntimeError(f'Run-outs should be hollow points with an unclipped rightward censoring arrow: {symbols}')


async def check_fatigue_sn(plot, touch):
    chart = plot.locator('[data-fatigue-sn]')
    await expect(chart.locator('figcaption a').first).to_have_attribute(
        'href', re.compile(r'^https://(?:doi\.org/10\.5281/zenodo\.|zenodo\.org/records/)23603840/?$')
    )
    fatigue = chart.locator('svg[data-fatigue-plot]')
    await check_fatigue_figure(fatigue)
    marks = fatigue.locator('[data-fatigue-test]')
    failure_marks = fatigue.locator('[data-fatigue-test][data-outcome="failure"]')
    runout_marks = fatigue.locator('[data-fatigue-test][data-outcome="runout"]')
    outcome = chart.get_by_role('combobox', name='Outcome', exact=True)
    specimen = chart.get_by_role('combobox', name='Specimen', exact=True)
    series = chart.get_by_role('combobox', name='Series', exact=True)
    readout = chart.locator('output[data-fatigue-readout]')
    cursor = fatigue.locator('[data-fatigue-cursor]')
    await expect(outcome).to_have_value('all')
    await expect(series).to_have_value('')
    await expect(readout).to_be_visible()
    await expect(cursor).to_be_visible()
    failure_count = await failure_marks.count()
    runout_count = await runout_marks.count()
    total_count = await marks.count()
    if (total_count, failure_count, runout_count) != (22, 20, 2):
        raise RuntimeError(f'Unexpected FABEST test counts: {total_count} total, {failure_count} failures, {runout_count} run-outs')
    await expect(readout).to_have_attribute('data-specimen', 'FAB060_A37-02B')
    await expect(readout).to_have_attribute('data-stress', '800')
    await expect(readout).to_have_attribute('data-cycles', '11893')
    await expect(readout).to_contain_text(re.compile(r'Stress ratio, R\s*[-−]1'))

    coordinates = sorted(await failure_marks.evaluate_all("""marks => marks.map(mark => [
      Number(mark.dataset.cycles),
      mark.querySelector('circle[data-fatigue-failure]').cx.baseVal.value
    ])"""))
    first_cycles, first_x = coordinates[0]
    last_cycles, last_x = coordinates[-1]
    if len({cycles for cycles, _ in coordinates}) < 3 or not (0 < first_cycles < last_cycles and first_x < last_x):
        raise RuntimeError('Expected measured failures at distinct positive cycle counts')
    for cycles, x in coordinates:
        expected_x = first_x + (last_x - first_x) * math.log(cycles / first_cycles) / math.log(last_cycles / first_cycles)
        if not math.isclose(x, expected_x, abs_tol=0.5):
            raise RuntimeError(f'Fatigue failure at {cycles} cycles is misplaced on the logarithmic axis')

    async def reported(mark):
        fields = ['specimen', 'cycles', 'stress', 'outcome', 'series']
        for field in fields:
            value = await mark.get_attribute(f'data-{field}')
            await expect(readout).to_have_attribute(f'data-{field}', value)
        selected = json.loads(await specimen.input_value())
        if selected != [await mark.get_attribute('data-series'), await mark.get_attribute('data-specimen')]:
            raise RuntimeError(f'The specimen selector and plotted result should agree: {selected}')
        await expect(cursor).to_have_attribute('data-series', selected[0])
        await expect(cursor).to_have_attribute('data-specimen', selected[1])

    await outcome.select_option('runout')
    await expect(failure_marks).to_have_count(0)
    await expect(runout_marks).to_have_count(runout_count)
    await expect(readout).to_have_attribute('data-outcome', 'runout')
    anchors = {'FAB060_A37-10': 2634775, 'FAB060_A37-02': 13149279}
    for specimen_id, cycles in anchors.items():
        mark = fatigue.locator(f'[data-fatigue-test][data-outcome="runout"][data-specimen="{specimen_id}"]')
        await expect(mark).to_have_attribute('data-cycles', str(cycles))
        await expect(mark).to_have_attribute('data-stress', '600')
    initial_runout = await readout.get_attribute('data-specimen')
    other_runout = next(value for value in anchors if value != initial_runout)
    marker = fatigue.locator(f'[data-fatigue-test][data-outcome="runout"][data-specimen="{other_runout}"]')
    await expect(marker).to_be_visible()
    if touch:
        await marker.tap()
    else:
        await marker.click()
    await reported(marker)
    await expect(readout).to_contain_text('Cycles survived')

    await outcome.select_option('failure')
    await expect(runout_marks).to_have_count(0)
    await expect(failure_marks).to_have_count(failure_count)
    await expect(readout).to_have_attribute('data-outcome', 'failure')
    await expect(specimen.locator('option')).to_have_count(failure_count)
    failure = fatigue.locator('[data-fatigue-test][data-specimen="FAB070_A35-02"]')
    await specimen.select_option('["fab070","FAB070_A35-02"]')
    await reported(failure)
    await expect(readout).to_have_attribute('data-stress', '800')
    await expect(readout).to_have_attribute('data-cycles', '4339')
    await expect(readout).to_contain_text('Cycles to failure')
    failure_dot = failure.locator('circle[data-fatigue-failure]')
    failure_x = float(await failure_dot.get_attribute('cx'))

    await series.select_option('fab070')
    await expect(marks).to_have_count(10)
    if not math.isclose(float(await failure_dot.get_attribute('cx')), failure_x, abs_tol=0.5):
        raise RuntimeError('Filtering series should retain the full-range logarithmic cycle axis')
    await outcome.select_option('runout')
    await expect(marks).to_have_count(0)
    await expect(specimen).to_be_disabled()
    await expect(chart.get_by_role('status').filter(has_text='No tests match the selected filters.')).to_be_visible()
    await series.select_option('fab060')
    await expect(runout_marks).to_have_count(2)
    await expect(specimen).to_be_enabled()

    await series.select_option('')
    await outcome.select_option('all')
    await expect(marks).to_have_count(total_count)
    await expect(specimen.locator('option')).to_have_count(total_count)


async def check_crack_figure(crack, compact=False):
    await expect(crack).to_be_visible()
    await expect(crack.locator('rect[data-crack-axis-frame]')).to_be_visible()
    await expect(crack.locator('.scientific-tick').first).to_be_attached()
    horizontal = 'ΔK (MPa√m)' if compact else 'Stress-intensity range, ΔK (MPa√m)'
    vertical = 'da/dN (mm/cycle)' if compact else 'Crack-growth rate, da/dN (mm/cycle)'
    await expect(crack.get_by_text(horizontal, exact=True)).to_be_visible()
    await expect(crack.get_by_text(vertical, exact=True)).to_be_visible()
    await expect(crack.locator('circle[data-crack-point]').first).to_be_visible()
    await expect(crack.locator('path[data-crack-fit]')).to_have_attribute('d', re.compile(r'^M'))


async def check_crack_growth(plot, touch):
    chart = plot.locator('[data-crack-growth]')
    await expect(chart.locator('figcaption a').first).to_have_attribute(
        'href', re.compile(r'^https://(?:doi\.org/10\.5281/zenodo\.|zenodo\.org/records/)21901500/?$')
    )
    crack = chart.locator('svg[data-crack-plot]')
    await check_crack_figure(crack)
    marks = crack.locator('circle[data-crack-point]')
    fit = crack.locator('path[data-crack-fit]')
    cursor = crack.locator('circle[data-crack-cursor]')
    readout = chart.locator('output[data-crack-readout]')
    measurement = chart.get_by_role('combobox', name='Measurement', exact=True)
    fit_from = chart.get_by_role('combobox', name='Fit from', exact=True)
    fit_through = chart.get_by_role('combobox', name='Fit through', exact=True)
    series = chart.get_by_role('combobox', name='Series', exact=True)
    await expect(readout).to_be_visible()
    await expect(cursor).to_be_visible()
    await expect(series).to_have_value('s460')

    async def points():
        return await marks.evaluate_all("""marks => marks.map(point => [
          Number(point.dataset.deltaK), Number(point.dataset.rate), point.dataset.inFit === 'true',
          point.cx.baseVal.value, point.cy.baseVal.value
        ])""")

    async def check_fit():
        data = await points()
        first = int(await fit_from.input_value())
        last = int(await fit_through.input_value())
        selected = [point for point in data if point[2]]
        if not 0 <= first < last < len(data) or selected != data[first:last + 1]:
            raise RuntimeError(f'The fit must use only its declared measurement interval {first}–{last}')
        x = [math.log10(point[0]) for point in selected]
        y = [math.log10(point[1]) for point in selected]
        count = len(x)
        mean_x, mean_y = sum(x) / count, sum(y) / count
        sxx = sum((value - mean_x) ** 2 for value in x)
        syy = sum((value - mean_y) ** 2 for value in y)
        sxy = sum((delta - mean_x) * (rate - mean_y) for delta, rate in zip(x, y))
        slope = sxy / sxx
        expected = (count, slope, 10 ** (mean_y - slope * mean_x), sxy ** 2 / (sxx * syy))
        observed = await readout.evaluate(
            "out => ['count', 'exponent', 'coefficient', 'rSquared'].map(key => Number(out.dataset[key]))"
        )
        if slope <= 0 or not all(math.isclose(value, target, rel_tol=1e-7) for value, target in zip(observed, expected)):
            raise RuntimeError(f'Paris-law fit should match log-space OLS: observed {observed}, expected {expected}')
        line_ends = await fit.evaluate(
            'line => [line.getPointAtLength(0), line.getPointAtLength(line.getTotalLength())].map(point => [point.x, point.y])'
        )
        endpoints = [data[first][3], data[last][3]]
        start_k = float(await fit.get_attribute('data-from'))
        through_k = float(await fit.get_attribute('data-through'))
        if not math.isclose(start_k, data[first][0]) or not math.isclose(through_k, data[last][0]):
            raise RuntimeError('The fit path should declare the selected physical ΔK bounds')
        low, high = min(data, key=lambda point: point[1]), max(data, key=lambda point: point[1])
        for (actual_x, actual_y), index in zip(line_ends, (first, last)):
            log_rate = math.log10(expected[2]) + slope * math.log10(data[index][0])
            fraction = (log_rate - math.log10(low[1])) / math.log10(high[1] / low[1])
            expected_y = low[4] + (high[4] - low[4]) * fraction
            if not math.isclose(actual_x, data[index][3], abs_tol=0.5) or not math.isclose(actual_y, expected_y, abs_tol=0.5):
                raise RuntimeError(f'Fit geometry should show the calculated segment at the selected ΔK bounds: {line_ends}')
        for selector, limit in zip(['[data-crack-fit-start]', '[data-crack-fit-end]'], endpoints):
            guide_x = float(await crack.locator(selector).get_attribute('x1'))
            if not math.isclose(guide_x, limit, abs_tol=0.5):
                raise RuntimeError('A marked fit bound does not match its selected measurement')
        return (first, last), observed

    async def check_measurement(index):
        mark = marks.nth(index)
        await expect(measurement).to_have_value(str(index))
        await expect(cursor).to_have_attribute('data-index', str(index))
        for field in ['delta-k', 'rate']:
            await expect(readout).to_have_attribute(f'data-{field}', await mark.get_attribute(f'data-{field}'))
        for field in ['cx', 'cy']:
            if not math.isclose(float(await cursor.get_attribute(field)), float(await mark.get_attribute(field)), abs_tol=0.5):
                raise RuntimeError('The crack-growth cursor must align with the recorded measurement')

    data = await points()
    for axis, coordinate in [(0, 3), (1, 4)]:
        low, high = min(data, key=lambda point: point[axis]), max(data, key=lambda point: point[axis])
        if not 0 < low[axis] < high[axis]:
            raise RuntimeError('Crack-growth measurements must use positive values on both logarithmic axes')
        for point in data:
            fraction = math.log(point[axis] / low[axis]) / math.log(high[axis] / low[axis])
            expected = low[coordinate] + (high[coordinate] - low[coordinate]) * fraction
            if not math.isclose(point[coordinate], expected, abs_tol=0.5):
                raise RuntimeError(f'Crack-growth point is misplaced on its logarithmic axis: {point}')

    measured_fits = [
        ('s460', 24, (9, 20), (12, 2.985466161628327, 4.1693025652975545e-9, 0.9975404230504434)),
        ('s690', 75, (17, 57), (41, 2.833413463957257, 7.044641745705058e-9, 0.979295503806746)),
        ('s960', 97, (54, 92), (39, 2.5452216103445395, 1.5579579690189874e-8, 0.9985085213085692)),
    ]
    axis_ticks = crack.locator('g.scientific-axis text')
    shared_scale = await axis_ticks.all_text_contents()
    for series_id, count, bounds, expected in measured_fits:
        await series.select_option(series_id)
        await expect(readout).to_have_attribute('data-series', series_id)
        await expect(marks).to_have_count(count)
        actual_bounds, metrics = await check_fit()
        if actual_bounds != bounds or not all(math.isclose(value, anchor, rel_tol=1e-7) for value, anchor in zip(metrics, expected)):
            raise RuntimeError(f'Unexpected measured default fit for {series_id}: {actual_bounds}, {metrics}')
        if await axis_ticks.all_text_contents() != shared_scale:
            raise RuntimeError('Switching steel grades should retain the common crack-growth plot scales')

    await series.select_option('s460')
    (first, last), _ = await check_fit()
    initial_path = await fit.get_attribute('d')
    await fit_from.select_option(str(first + 1))
    if (await check_fit())[0] != (first + 1, last):
        raise RuntimeError('Moving the starting bound should shrink the fitted interval')
    await fit_through.select_option(str(last - 1))
    if (await check_fit())[0] != (first + 1, last - 1):
        raise RuntimeError('Moving the ending bound should shrink the fitted interval')
    await expect(fit).not_to_have_attribute('d', initial_path)

    await measurement.select_option('0')
    await check_measurement(0)
    selected = len(data) - 1
    target = marks.nth(selected)
    if touch:
        await target.tap()
    else:
        await target.click()
    await check_measurement(selected)
    picked_k = float(await readout.get_attribute('data-delta-k'))
    picked_rate = float(await readout.get_attribute('data-rate'))
    if not math.isclose(picked_k, 27.02276940331986) or not math.isclose(picked_rate, 8.85838e-5):
        raise RuntimeError(f'Unexpected final S460 measurement: {picked_k}, {picked_rate}')
    await check_fit()


async def check_alloy_guide_line(locator):
    await expect(locator).to_be_attached()
    painted = await locator.evaluate("""line => {
      const { stroke, strokeWidth, visibility } = getComputedStyle(line)
      return stroke !== 'none' && parseFloat(strokeWidth) > 0 && visibility === 'visible' && line.getTotalLength() > 0
    }""")
    if not painted:
        raise RuntimeError('Expected a visible stroked line in the equilibrium figure')


async def check_binary_phase_figure(diagram):
    await expect(diagram).to_be_visible()
    await expect(diagram.locator('rect[data-phase-diagram-frame]')).to_be_visible()
    await expect(diagram.locator('.scientific-tick').first).to_be_attached()
    await expect(diagram.get_by_text('Composition (at. % Cu)', exact=True)).to_be_visible()
    await expect(diagram.get_by_text('Temperature (°C)', exact=True)).to_be_visible()
    boundaries = diagram.locator('path[data-alloy-boundary]')
    await expect(boundaries).to_have_count(6)
    boundary_paths = await boundaries.evaluate_all(
        "paths => paths.map(path => [path.dataset.boundary, path.getAttribute('d'), path.getTotalLength()])"
    )
    if len({entry[0] for entry in boundary_paths}) != 6 or any(
        not path_data.startswith('M') or not math.isfinite(length) or length <= 0
        for _, path_data, length in boundary_paths
    ):
        raise RuntimeError(f'Expected six assessed Ag–Cu boundary branches, observed {boundary_paths}')
    eutectic = diagram.locator('line[data-alloy-eutectic]')
    await check_alloy_guide_line(eutectic)
    await expect(eutectic).to_have_attribute('data-temperature', '779.13')


async def check_binary_phase_diagram(plot, touch):
    chart = plot.locator('[data-binary-phase-diagram]')
    await expect(chart.locator('figcaption a').first).to_have_attribute(
        'href', re.compile(r'^https://(?:doi\.org/10\.5281/zenodo\.|zenodo\.org/records/)23735859/?$')
    )
    diagram = chart.locator('svg[data-phase-diagram]')
    await check_binary_phase_figure(diagram)
    frame = diagram.locator('rect[data-phase-diagram-frame]')
    cursor = diagram.locator('circle[data-alloy-cursor]')
    tie_line = diagram.locator('line[data-alloy-tie-line]')
    cooling = diagram.locator('line[data-alloy-cooling]')
    readout = chart.locator('output[data-alloy-readout]')
    composition = chart.get_by_role('slider', name='Composition', exact=True)
    temperature = chart.get_by_role('slider', name='Temperature', exact=True)
    await expect(readout).to_be_visible()
    await expect(cursor).to_be_visible()
    await check_alloy_guide_line(cooling)
    await expect(composition).to_have_attribute('step', '0.1')
    await expect(temperature).to_have_attribute('step', '0.1')
    x_domain = (0, 100)
    y_domain = (300, 1125)
    for slider, (minimum, maximum) in [(composition, x_domain), (temperature, y_domain)]:
        await expect(slider).to_have_attribute('min', str(minimum))
        await expect(slider).to_have_attribute('max', str(maximum))

    def test_close(actual, expected, message, tolerance=0.05):
        if not math.isclose(actual, expected, abs_tol=tolerance):
            raise RuntimeError(f'{message}: observed {actual}, expected {expected}')

    async def selection():
        values = await readout.evaluate(
            "out => ['composition', 'temperature', 'region', 'leftFraction', 'rightFraction'].map(key => out.dataset[key])"
        )
        selected_x, selected_y = map(float, values[:2])
        test_close(float(await composition.input_value()), selected_x, 'Composition slider and readout should agree')
        test_close(float(await temperature.input_value()), selected_y, 'Temperature slider and readout should agree')
        left, top, width, height = await frame.evaluate(
            "rect => ['x', 'y', 'width', 'height'].map(key => rect[key].baseVal.value)"
        )
        cx, cy = await cursor.evaluate("circle => [circle.cx.baseVal.value, circle.cy.baseVal.value]")
        test_close(cx, left + width * selected_x / 100, 'Cursor x should match atomic percent copper', 0.5)
        expected_y = top + height * (y_domain[1] - selected_y) / (y_domain[1] - y_domain[0])
        test_close(cy, expected_y, 'Cursor y should match temperature', 0.5)
        cool_x1, cool_x2, cool_y1, cool_y2 = await cooling.evaluate(
            "line => ['x1', 'x2', 'y1', 'y2'].map(key => line[key].baseVal.value)"
        )
        for x in [cool_x1, cool_x2]:
            test_close(x, cx, 'The cooling path should follow the selected composition at all temperatures', 0.5)
        test_close(cool_y1, top, 'Cooling path should start at the top of the plot', 0.5)
        test_close(cool_y2, top + height, 'Cooling path should span the full temperature domain', 0.5)
        return selected_x, selected_y, values[2], values[3:]

    async def set_point(requested_x, requested_y, region):
        await composition.fill(str(requested_x))
        await temperature.fill(str(requested_y))
        await expect(readout).to_have_attribute('data-region', region)
        observed_x, observed_y, _, fractions = await selection()
        test_close(observed_x, requested_x, 'Unexpected selected alloy composition')
        test_close(observed_y, requested_y, 'Unexpected selected alloy temperature')
        return fractions

    initial_x, initial_y, initial_region, _ = await selection()
    if (initial_x, initial_y, initial_region) != (20, 850, 'left-liquid'):
        raise RuntimeError('The assessed Ag–Cu example should open with a selected solid–liquid tie line')
    for x, y, region in [(50, 1100, 'liquid'), (2, 650, 'left-solid'), (99, 650, 'right-solid')]:
        if await set_point(x, y, region) != [None, None]:
            raise RuntimeError(f'No lever-rule fractions apply to the single phase in {region}')
        await expect(tie_line).to_have_count(0)

    for x, y, region, endpoints in [
        (20, 850, 'left-liquid', (9.0775147219, 21.6165790622)),
        (85, 900, 'right-liquid', (70.9717258602, 95.6304162042)),
        (50, 650, 'two-solids', (7.120995, 97.880975)),
    ]:
        fractions = list(map(float, await set_point(x, y, region)))
        expected_right = (x - endpoints[0]) / (endpoints[1] - endpoints[0])
        test_close(fractions[0], 1 - expected_right, f'Unexpected left phase fraction in {region}', 0.0002)
        test_close(fractions[1], expected_right, f'Unexpected right phase fraction in {region}', 0.0002)
        await check_alloy_guide_line(tie_line)
        tie_x1, tie_x2, tie_y1, tie_y2 = await tie_line.evaluate(
            "line => ['x1', 'x2', 'y1', 'y2'].map(key => line[key].baseVal.value)"
        )
        left, width = await frame.evaluate("rect => [rect.x.baseVal.value, rect.width.baseVal.value]")
        cx, cy = await cursor.evaluate("circle => [circle.cx.baseVal.value, circle.cy.baseVal.value]")
        for side, drawn_endpoint, actual_endpoint in zip(['left', 'right'], [tie_x1, tie_x2], endpoints):
            test_close(float(await tie_line.get_attribute(f'data-{side}')), actual_endpoint, f'Incorrect {side} tie endpoint in {region}', 0.001)
            test_close(drawn_endpoint, left + width * actual_endpoint / 100, f'Misplaced tie endpoint in {region}', 0.5)
        if not tie_x1 < cx < tie_x2:
            raise RuntimeError(f'Overall composition should lie between the endpoints in {region}')
        test_close(tie_y1, cy, 'The tie line should cross the selected temperature', 0.5)
        test_close(tie_y2, cy, 'The tie line should run horizontally at constant temperature', 0.5)

    await composition.press('ArrowRight')
    await temperature.press('ArrowUp')
    selected_x, selected_y, region, _ = await selection()
    test_close(selected_x, 50.1, 'Composition keyboard step did not move by 0.1 at. % Cu', 0.001)
    test_close(selected_y, 650.1, 'Temperature keyboard step did not move by 0.1 °C', 0.001)
    if region != 'two-solids':
        raise RuntimeError(f'Keyboard step should remain in the two-solid region, observed {region}')

    eutectic_button = chart.get_by_role('button', name='Go to eutectic', exact=True)
    if touch:
        await eutectic_button.tap()
    else:
        await eutectic_button.press('Enter')
    invariant_x, invariant_y, region, fractions = await selection()
    test_close(invariant_x, 40.254, 'Unexpected assessed eutectic composition', 0.000001)
    test_close(invariant_y, 779.13, 'Unexpected assessed eutectic temperature', 0.000001)
    if region != 'eutectic' or fractions != [None, None]:
        raise RuntimeError(f'Phase fractions must remain undetermined at the three-phase eutectic, observed {region} and {fractions}')
    await expect(tie_line).to_have_count(0)
    await expect(readout).to_contain_text('Undetermined at this invariant')
    invariant_line = diagram.locator('line[data-alloy-eutectic]')
    test_close(float(await invariant_line.get_attribute('y1')), float(await cursor.get_attribute('cy')), 'Eutectic cursor should align with the invariant isotherm', 0.5)

    target = diagram.locator('.alloy-plot-pick')
    await target.scroll_into_view_if_needed()
    bounds = await target.bounding_box()
    position = {'x': bounds['width'] * 0.7, 'y': bounds['height'] * 0.1}
    if touch:
        await target.tap(position=position)
    else:
        await target.click(position=position)
    selected_x, selected_y, region, _ = await selection()
    test_close(selected_x, 70, 'Pointer should move composition along the horizontal axis', 0.75)
    test_close(selected_y, 1042.5, 'Pointer should move temperature along the vertical axis', 4)
    if region != 'liquid':
        raise RuntimeError(f'Pointer choice should enter the liquid region, observed {region}')
    if not touch:
        bounds = await target.bounding_box()
        mouse = diagram.page.mouse
        await mouse.move(bounds['x'] + bounds['width'] * 0.7, bounds['y'] + bounds['height'] * 0.1)
        await mouse.down()
        await mouse.move(bounds['x'] + bounds['width'] * 0.3, bounds['y'] + bounds['height'] * 0.75, steps=5)
        await mouse.up()
        selected_x, selected_y, region, _ = await selection()
        test_close(selected_x, 30, 'Dragging should update composition continuously', 0.75)
        test_close(selected_y, 506.25, 'Dragging should update temperature continuously', 4)
        if region != 'two-solids':
            raise RuntimeError(f'Dragging should enter the two-solid region, observed {region}')


async def check_ternary_figure(ternary):
    await expect(ternary).to_be_visible()
    simplex = ternary.locator('path[data-ternary-simplex]')
    support = ternary.locator('path[data-ternary-support]')
    for outline in [simplex, support]:
        await expect(outline).to_have_attribute('d', re.compile(r'^M'))
        if await outline.evaluate('outline => outline.getTotalLength()') <= 0:
            raise RuntimeError('The ternary plot needs a simplex and a measured support boundary')
    raster = ternary.locator('image[data-ternary-surface]')
    await expect(raster).to_have_attribute('href', re.compile(r'^data:image/png;base64,'))
    if await raster.evaluate('image => getComputedStyle(image).imageRendering') in ('crisp-edges', 'pixelated'):
        raise RuntimeError('The interpolated ternary surface should use smooth image rendering')
    await expect(ternary.locator('.scientific-tick').first).to_be_attached()
    for component, high_percent in [('Slag', 50), ('Fly ash', 80), ('Red mud', 30)]:
        await expect(ternary.get_by_text(f'{component} {high_percent}%', exact=True)).to_be_visible()
    colorbar = ternary.locator('[data-ternary-colorbar]')
    await expect(colorbar.get_by_text('Compressive strength (MPa)', exact=True)).to_be_visible()
    await expect(colorbar).to_have_attribute('data-min', '65')
    await expect(colorbar).to_have_attribute('data-max', '115')
    await expect(colorbar.locator('rect[fill^="url("]')).to_be_visible()
    await expect(ternary.locator('circle[data-ternary-observation]')).to_have_count(10)


async def check_ternary_raster(raster, samples):
    # Inspect the PNG itself so that a drawn boundary or clip cannot hide extrapolated pixels.
    image_size, alpha = await raster.evaluate("""async (raster, samples) => {
      const image = new Image()
      image.src = raster.getAttribute('href')
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0)
      const [left, top, width, height] = ['x', 'y', 'width', 'height'].map(key => raster[key].baseVal.value)
      const alpha = samples.map(([x, y]) => {
        const ix = Math.floor((x - left) / width * canvas.width)
        const iy = Math.floor((y - top) / height * canvas.height)
        return context.getImageData(ix, iy, 1, 1).data[3]
      })
      return [[canvas.width, canvas.height], alpha]
    }""", samples)
    if min(image_size) < 128:
        raise RuntimeError(f'Expected a dense interpolated ternary raster, observed {image_size}')
    if alpha[0] <= 0 or alpha[1] != 0:
        raise RuntimeError(f'Ternary raster must paint inside measured support and remain transparent outside: {alpha}')


async def check_ternary_mixture(plot, touch):
    chart = plot.locator('[data-ternary-mixture]')
    ternary = chart.locator('svg[data-ternary-plot]')
    await check_ternary_figure(ternary)
    simplex = ternary.locator('path[data-ternary-simplex]')
    marks = ternary.locator('circle[data-ternary-observation]')
    cursor = ternary.locator('[data-ternary-cursor]')
    readout = chart.locator('output[data-ternary-readout]')
    observation = chart.get_by_role('combobox', name='Observation', exact=True)
    full_view = chart.get_by_role('checkbox', name='Show full composition triangle', exact=True)
    slag = chart.get_by_role('slider', name='Ground granulated blast-furnace slag', exact=True)
    ash = chart.get_by_role('slider', name='Fly ash', exact=True)
    await expect(chart.locator('figcaption a').first).to_have_attribute('href', 'https://doi.org/10.3390/polym18182271')
    await expect(ternary.get_by_text('Composition (%)', exact=True)).to_be_visible()
    await expect(cursor).to_be_visible()
    await expect(readout).to_be_visible()
    await expect(full_view).not_to_be_checked()

    async def frame():
        return await simplex.evaluate("""triangle => {
          const box = triangle.getBBox()
          const svg = triangle.ownerSVGElement
          const domain = ['aMin', 'bMin', 'cMin', 'span'].map(key => Number(svg.dataset[key]))
          return [box.x, box.y, box.width, box.height, ...domain]
        }""")
    magnified = await frame()
    if any(not math.isclose(actual, expected, abs_tol=1e-8) for actual, expected in zip(magnified[4:], [0.2, 0.5, 0, 0.3])):
        raise RuntimeError(f'The chart should start with the magnified binder composition frame, observed {magnified[4:]}')

    def plot_point(fractions, axes):
        left, top, width, height, a_min, b_min, c_min, span = axes
        a, b, c = [(part - minimum) / span for part, minimum in zip(fractions, [a_min, b_min, c_min])]
        return left + width * (0.5 * a + c), top + height * (b + c)

    def check_fractions(fractions):
        if not all(math.isfinite(part) and 0 <= part <= 1 for part in fractions) or not math.isclose(sum(fractions), 1, abs_tol=1e-8):
            raise RuntimeError(f'Ternary fractions must be bounded and sum to one: {fractions}')

    def check_point(coords, fractions, axes):
        expected = plot_point(fractions, axes)
        if not all(math.isclose(actual, target, abs_tol=0.5) for actual, target in zip(coords, expected)):
            raise RuntimeError(f'Ternary point {coords} should align with mixture {fractions}, expected {expected}')

    async def measure():
        values = await readout.evaluate(
            "out => ['a', 'b', 'c', 'prediction', 'observed', 'id'].map(key => out.dataset[key])"
        )
        fractions = list(map(float, values[:3]))
        check_fractions(fractions)
        coords = await cursor.evaluate('mark => [Number(mark.getAttribute("cx")), Number(mark.getAttribute("cy"))]')
        check_point(coords, fractions, await frame())
        prediction = float(values[3]) if values[3] not in (None, '') else None
        observed = float(values[4]) if values[4] not in (None, '') else None
        return fractions, prediction, observed, values[5]

    samples = await marks.evaluate_all("""marks => marks.map(mark => [
      mark.dataset.id, ['a', 'b', 'c', 'value'].map(key => Number(mark.dataset[key])),
      [mark.cx.baseVal.value, mark.cy.baseVal.value],
    ])""")
    if len(samples) < 3 or len(set(row[0] for row in samples)) != len(samples):
        raise RuntimeError('The ternary plot needs distinct observation IDs')
    for _, (a, b, c, value), coords in samples:
        check_fractions([a, b, c])
        check_point(coords, [a, b, c], magnified)
        if not math.isfinite(value):
            raise RuntimeError('A ternary observation must retain a finite recorded response')

    default_parts, default_prediction, default_observed, default_id = await measure()
    if (default_parts, default_observed, default_id) != ([0.30, 0.60, 0.10], 89.0, 'G30F60R10') or (
        default_prediction is None or not math.isclose(default_prediction, 85.91666667, abs_tol=1e-6)
    ):
        raise RuntimeError(f'Unexpected initial measured mixture or fitted response: {default_id}, {default_parts}, {default_observed}, {default_prediction}')
    for sample in [samples[0], samples[-1]]:
        sample_id, (*expected_parts, expected_value), _ = sample
        await observation.select_option(sample_id)
        parts, prediction, observed, selected_id = await measure()
        if selected_id != sample_id or parts != expected_parts or observed != expected_value:
            raise RuntimeError(f'Choosing observation {sample_id} should show the exact recorded fractions and value')
        if prediction is None or not math.isfinite(prediction):
            raise RuntimeError(f'The observation {sample_id} should have a finite model response')
    chosen = await measure()
    await full_view.check()
    full_axes = await frame()
    if full_axes[4:] != [0, 0, 0, 1] or await measure() != chosen:
        raise RuntimeError('The full simplex should preserve the selected mixture while changing the composition frame')
    for component in ['Slag', 'Fly ash', 'Red mud']:
        await expect(ternary.get_by_text(component, exact=True)).to_be_visible()

    interior = [0.30, 0.55, 0.15]
    exterior = [0.30, 0.45, 0.25]
    raster = ternary.locator('image[data-ternary-surface]')
    await expect(raster).to_have_attribute('href', re.compile(r'^data:image/png;base64,'))
    await check_ternary_raster(raster, [plot_point(parts, full_axes) for parts in [interior, exterior]])

    async def check_custom(expected_parts, expected_prediction, tolerance=1e-8):
        parts, prediction, observed, selected_id = await measure()
        if any(abs(actual - expected) > tolerance for actual, expected in zip(parts, expected_parts)):
            raise RuntimeError(f'Expected custom fractions {expected_parts}, observed {parts}')
        if observed is not None or selected_id is not None:
            raise RuntimeError('A custom composition must not identify an observed response')
        if expected_prediction is None:
            if prediction is not None:
                raise RuntimeError(f'Expected no prediction outside the support, observed {prediction}')
            await expect(readout).to_contain_text('Outside sampled region')
        elif prediction is None or not math.isclose(prediction, expected_prediction, abs_tol=0.5 if tolerance > 1e-8 else 1e-6):
            raise RuntimeError(f'Expected fitted strength {expected_prediction} MPa, observed {prediction}')

    await slag.fill('30')
    await ash.fill('55')
    await check_custom(interior, 85.50970819)
    await ash.press('ArrowRight')
    stepped_parts, _, _, _ = await measure()
    if not math.isclose(stepped_parts[1], 0.551, abs_tol=1e-8):
        raise RuntimeError(f'Keyboard selection should move by 0.1 percentage point: {stepped_parts}')
    await ash.fill('45')
    await check_custom(exterior, None)
    await slag.press('End')
    await check_custom([1, 0, 0], None)

    hit = ternary.locator('.ternary-pick')
    await hit.scroll_into_view_if_needed()
    point = await hit.evaluate("""(hit, [x, y]) => {
      const box = hit.getBoundingClientRect()
      const target = new DOMPoint(x, y).matrixTransform(hit.getScreenCTM())
      return { x: target.x - box.left, y: target.y - box.top }
    }""", plot_point(interior, full_axes))
    if touch:
        await hit.tap(position=point)
    else:
        await hit.click(position=point)
    await check_custom(interior, 85.50970819, tolerance=0.01)

    marker = ternary.locator('circle[data-ternary-observation][data-id="G30F60R10"]')
    if touch:
        await marker.tap()
    else:
        await marker.click()
    if await measure() != (default_parts, default_prediction, default_observed, default_id):
        raise RuntimeError('Clicking a measured mixture should restore its exact recorded and fitted response')


async def check_ct_slice(panel, horizontal, vertical):
    await expect(panel).to_be_visible()
    await expect(panel.locator('rect[data-ct-slice-frame]')).to_be_visible()
    await expect(panel.locator('.scientific-tick').first).to_be_attached()
    await expect(panel.get_by_text(f'{horizontal} (mm)', exact=True)).to_be_visible()
    await expect(panel.get_by_text(f'{vertical} (mm)', exact=True)).to_be_visible()
    raster = panel.locator('image[data-ct-raster]')
    await expect(raster).to_have_attribute('href', re.compile(r'^data:image/png;base64,'))
    return raster


async def check_compact_industrial_ct(card_plot):
    root = card_plot.locator('[data-industrial-ct]')
    xy = root.locator('svg[data-ct-slice][data-plane="xy"]')
    await expect(root.locator('svg[data-ct-slice]')).to_have_count(1)
    raster = await check_ct_slice(xy, 'X', 'Y')
    await check_compact_figure_bounds(xy, 'rect[data-ct-slice-frame]')
    width, height, levels, colored, _ = await ct_raster_stats(raster)
    if (width, height) != (64, 64) or levels < 12 or colored <= 0:
        raise RuntimeError('The compact preview should include measured CT texture and the segmented pore overlay')
    await expect(root.locator('canvas, input, select, button, [data-ct-crosshair], [data-ct-readout], .ct-slice-pick')).to_have_count(0)


async def ct_raster_stats(raster, pixel=None):
    return await raster.evaluate("""async (raster, pixel) => {
      const image = new Image()
      image.src = raster.getAttribute('href')
      await image.decode()
      const buffer = document.createElement('canvas')
      buffer.width = image.naturalWidth
      buffer.height = image.naturalHeight
      const context = buffer.getContext('2d')
      context.drawImage(image, 0, 0)
      const bytes = context.getImageData(0, 0, buffer.width, buffer.height).data
      const luminance = new Set()
      let colored = 0
      for (let pixel = 0; pixel < bytes.length; pixel += 4) {
        const [r, g, b, a] = bytes.subarray(pixel, pixel + 4)
        if (a === 0) continue
        luminance.add(r)
        if (r !== g || g !== b) colored++
      }
      const intensity = pixel ? bytes[4 * (pixel[0] + buffer.width * pixel[1])] : null
      return [buffer.width, buffer.height, luminance.size, colored, intensity]
    }""", pixel)


async def check_industrial_ct(plot, touch):
    chart = plot.locator('[data-industrial-ct]')
    readout = chart.locator('output[data-ct-readout]')
    volume = chart.locator('canvas[data-ct-volume-render]')
    pore = chart.get_by_role('combobox', name='Pore', exact=True)
    mask = chart.get_by_role('checkbox', name='Show pore mask', exact=True)
    rotate_right = chart.get_by_role('button', name='Rotate right', exact=True)
    rotate_left = chart.get_by_role('button', name='Rotate left', exact=True)
    sliders = [chart.get_by_role('slider', name=f'{axis} slice', exact=True) for axis in 'XYZ']
    await expect(readout).to_be_visible()
    await expect(chart.locator('figcaption a').first).to_have_attribute('href', 'https://doi.org/10.18434/M32162')
    await expect(volume).to_be_visible()
    await expect(mask).to_be_checked()
    await expect(chart.locator('svg[data-ct-slice]')).to_have_count(3)
    spatial_axes = [(0, 1, 2), (0, 2, 1), (1, 2, 0)]
    panels = [chart.locator(f'svg[data-ct-slice][data-plane="{name}"]') for name in ('xy', 'xz', 'yz')]
    rasters = [await check_ct_slice(panel, 'XYZ'[h], 'XYZ'[v]) for panel, (h, v, _) in zip(panels, spatial_axes)]
    for panel, section in zip(panels, ['Axial · XY', 'Coronal · XZ', 'Sagittal · YZ']):
        await expect(panel.get_by_text(section, exact=True)).to_be_visible()
    dimensions = [int(await slider.get_attribute('max')) + 1 for slider in sliders]
    if dimensions != [64, 64, 64]:
        raise RuntimeError(f'Unexpected native NIST CT crop dimensions: {dimensions}')
    spacing_mm = 0.00245
    origin = [0.8869, 1.2691, 0.9114]
    for slider in sliders:
        await expect(slider).to_have_attribute('min', '0')
        await expect(slider).to_have_attribute('step', '1')
    for raster, (h, v, _) in zip(rasters, spatial_axes):
        width, height, levels, colored, _ = await ct_raster_stats(raster)
        if (width, height) != (dimensions[h], dimensions[v]) or levels < 12 or colored <= 0:
            raise RuntimeError('Each CT cross-section should contain native grayscale levels and a pore overlay')

    async def selection():
        values = await readout.evaluate("""out => [
          ['x', 'y', 'z'].map(key => Number(out.dataset[key])),
          ['xMm', 'yMm', 'zMm'].map(key => Number(out.dataset[key])),
          ...['pore', 'voxels', 'volumeMm3', 'intensity'].map(key => out.dataset[key]),
        ]""")
        indices, physical = values[:2]
        expected_physical = [start + index * spacing_mm for start, index in zip(origin, indices)]
        if not all(math.isclose(observed, expected, abs_tol=1e-10) for observed, expected in zip(physical, expected_physical)):
            raise RuntimeError(f'CT coordinates should retain source voxel spacing and crop origin: {indices}, {physical}, {expected_physical}')
        for slider, index in zip(sliders, indices):
            await expect(slider).to_have_value(str(index))
        for panel, (horizontal, vertical, fixed) in zip(panels, spatial_axes):
            await expect(panel).to_have_attribute('data-slice-index', str(indices[fixed]))
            geometry = await panel.evaluate("""svg => {
              const frame = svg.querySelector('[data-ct-slice-frame]')
              const [left, top, width, height] = ['x', 'y', 'width', 'height'].map(key => frame[key].baseVal.value)
              const lines = [...svg.querySelectorAll('line[data-ct-crosshair], [data-ct-crosshair] line')]
              const value = (line, key) => line[key].baseVal.value
              const x = lines.find(line => value(line, 'x1') === value(line, 'x2'))
              const y = lines.find(line => value(line, 'y1') === value(line, 'y2'))
              return [left, top, width, height, x && value(x, 'x1'), y && value(y, 'y1')]
            }""")
            left, top, width, height, cross_x, cross_y = geometry
            if not math.isclose(width / height, dimensions[horizontal] / dimensions[vertical], rel_tol=1e-5):
                raise RuntimeError('The isotropic scan should use the same physical scale on both slice axes')
            expected_x = left + width * (indices[horizontal] + 0.5) / dimensions[horizontal]
            expected_y = top + height * (1 - (indices[vertical] + 0.5) / dimensions[vertical])
            if cross_x is None or cross_y is None or not (
                math.isclose(cross_x, expected_x, abs_tol=0.5) and math.isclose(cross_y, expected_y, abs_tol=0.5)
            ):
                raise RuntimeError(f'CT crosshair should mark the calibrated voxel center on each slice: {indices}, {geometry}')
        return indices, physical, *values[2:]

    async def pick_voxel(panel, horizontal, vertical, axes):
        target = panel.locator('.ct-slice-pick')
        bounds = await target.bounding_box()
        h, v, _ = axes
        position = {
            'x': bounds['width'] * (horizontal + 0.5) / dimensions[h],
            'y': bounds['height'] * (1 - (vertical + 0.5) / dimensions[v]),
        }
        if touch:
            await target.tap(position=position)
        else:
            await target.click(position=position)

    async def view_state():
        yaw, pitch, active, faces = await volume.evaluate(
            "canvas => [Number(canvas.dataset.yaw), Number(canvas.dataset.pitch), canvas.dataset.pore, Number(canvas.dataset.faceCount)]"
        )
        if not all(map(math.isfinite, (yaw, pitch, faces))) or faces <= 0:
            raise RuntimeError(f'Expected visible reconstructed pore faces and finite view angles: {yaw}, {pitch}, {faces}')
        return yaw, pitch, active

    async def capture_volume():
        return await volume.evaluate("""async canvas => {
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
          return canvas.toDataURL()
        }""")

    async def check_pore(pore_id, expected_indices, expected_voxels, expected_intensity):
        sample = await selection()
        indices, _, active_pore, voxels, volume_mm3, intensity = sample
        await expect(pore).to_have_value(str(pore_id))
        await expect(volume).to_have_attribute('data-pore', str(pore_id))
        if indices != expected_indices or active_pore != str(pore_id) or int(voxels) != expected_voxels or not math.isclose(
            float(volume_mm3), expected_voxels * spacing_mm ** 3, abs_tol=1e-12
        ) or int(intensity) != expected_intensity:
            raise RuntimeError(f'Pore {pore_id} should retain its representative voxel, count, volume and display intensity: {sample}')
        return sample

    pore_one = (1, [25, 12, 37], 959, 47)
    pore_two = (2, [20, 56, 42], 423, 48)
    initial_selection = await check_pore(*pore_one)
    await expect(readout).to_contain_text('47 / 255')
    initial_yaw, initial_pitch, active = await view_state()
    initial_image = await capture_volume()
    if touch:
        await rotate_right.tap()
    else:
        await rotate_right.press('Enter')
    yaw, pitch, rotated_pore = await view_state()
    if yaw == initial_yaw or pitch != initial_pitch or rotated_pore != active or await selection() != initial_selection:
        raise RuntimeError('Rotating the CT volume should change only the viewing angle')
    if len(initial_image) < 1024 or await capture_volume() == initial_image:
        raise RuntimeError('The rendered CT reconstruction pixels should change with the view')
    await rotate_left.click()
    restored_yaw, restored_pitch, _ = await view_state()
    if not math.isclose(restored_yaw, initial_yaw, abs_tol=1e-8) or restored_pitch != initial_pitch:
        raise RuntimeError('Rotate left should reverse the Rotate right step')

    # Capture a solid orange facet while pore 1 is active, then change its selection color without moving the camera.
    pixel = await volume.evaluate("""async canvas => {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const { width, height } = canvas
      const { data } = canvas.getContext('2d').getImageData(0, 0, width, height)
      const pixels = []
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 100 && data[i + 1] <= 80 && data[i + 2] <= 48) {
          const pixel = i / 4
          pixels.push([pixel % width, Math.floor(pixel / width)])
        }
      }
      if (pixels.length === 0) return null
      const centerX = pixels.reduce((sum, point) => sum + point[0], 0) / pixels.length
      const centerY = pixels.reduce((sum, point) => sum + point[1], 0) / pixels.length
      const distance = ([x, y]) => (x - centerX) ** 2 + (y - centerY) ** 2
      const [x, y] = pixels.reduce((best, point) => distance(point) < distance(best) ? point : best)
      return [(x + 0.5) / width, (y + 0.5) / height]
    }""")
    if pixel is None:
        raise RuntimeError('The rotatable rendering should include a colored surface for the selected pore')
    await pore.select_option('2')
    await check_pore(*pore_two)
    bounds = await volume.bounding_box()
    position = {'x': pixel[0] * bounds['width'], 'y': pixel[1] * bounds['height']}
    if touch:
        await volume.tap(position=position)
    else:
        await volume.click(position=position)
    await check_pore(*pore_one)

    if not touch:
        await volume.scroll_into_view_if_needed()
        bounds = await volume.bounding_box()
        mouse = volume.page.mouse
        x, y = bounds['x'] + bounds['width'] * 0.45, bounds['y'] + bounds['height'] * 0.45
        await mouse.move(x, y)
        await mouse.down()
        await mouse.move(x + 35, y - 20, steps=5)
        await mouse.up()
        yaw, pitch, active_pore = await view_state()
        if yaw <= initial_yaw or pitch >= initial_pitch or active_pore != '1':
            raise RuntimeError('Dragging the reconstructed volume should rotate both axes and preserve its pore selection')
        await check_pore(*pore_one)

    masked_xy = await rasters[0].get_attribute('href')
    await mask.uncheck()
    await expect(rasters[0]).not_to_have_attribute('href', masked_xy)
    for raster, (h, v, _) in zip(rasters, spatial_axes):
        voxel = pore_one[1]
        pixel = [voxel[h], dimensions[v] - 1 - voxel[v]]
        _, _, levels, colored, intensity = await ct_raster_stats(raster, pixel)
        if levels < 12 or colored != 0 or intensity != 47:
            raise RuntimeError(f'Unmasked planes should show the same recorded grayscale voxel (47/255), observed {intensity}')
    await sliders[2].press('ArrowRight')
    adjacent = await selection()
    if adjacent[0] != [25, 12, 38] or adjacent[-1] != '17':
        raise RuntimeError(f'Moving the Z slider one voxel should show the adjacent measured intensity: {adjacent}')
    await sliders[2].press('ArrowLeft')
    await check_pore(*pore_one)
    await expect(rasters[0]).to_have_attribute('href', re.compile(r'^data:image/png;base64,'))
    previous_slices = [await raster.get_attribute('href') for raster in rasters]

    await sliders[0].press('Home')
    if (await selection())[0] != [0, 12, 37]:
        raise RuntimeError('Moving the X slider should update only the sagittal slice index')
    await expect(rasters[2]).not_to_have_attribute('href', previous_slices[2])
    for raster, previous in zip(rasters[:2], previous_slices[:2]):
        await expect(raster).to_have_attribute('href', previous)

    await pick_voxel(panels[0], 5, 50, spatial_axes[0])
    if (await selection())[0] != [5, 50, 37]:
        raise RuntimeError('Axial picking should update X/Y and keep the active Z slice')
    await pick_voxel(panels[1], 12, 20, spatial_axes[1])
    if (await selection())[0] != [12, 50, 20]:
        raise RuntimeError('Coronal picking should update X/Z and keep the active Y slice')
    await pick_voxel(panels[2], 9, 26, spatial_axes[2])
    if (await selection())[0] != [12, 9, 26]:
        raise RuntimeError('Sagittal picking should update Y/Z and keep the active X slice')


async def check_cad_canvas_pixels(viewport):
    await expect(viewport).to_be_visible()
    width, height, warm, cool = await viewport.evaluate("""async canvas => {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const { width, height } = canvas
      const bytes = canvas.getContext('2d').getImageData(0, 0, width, height).data
      let warm = 0
      let cool = 0
      for (let i = 0; i < bytes.length; i += 4) {
        if (bytes[i + 3] === 0) continue
        const red = bytes[i]
        const blue = bytes[i + 2]
        if (red > blue + 40) warm++
        if (blue > red + 40) cool++
      }
      return [width, height, warm, cool]
    }""")
    if min(width, height) < 100 or min(warm, cool) < 12:
        raise RuntimeError(f'Expected a live scan render with colors on both sides of zero: {width}×{height}, {warm} warm/{cool} cool pixels')


async def check_compact_cad_scan(card_plot):
    chart = card_plot.locator('[data-cad-scan]')
    viewport = chart.locator('canvas[data-cad-viewport]')
    await check_cad_canvas_pixels(viewport)
    fit = await viewport.evaluate("""async canvas => {
      await document.fonts.ready
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const box = canvas.getBoundingClientRect()
      const card = canvas.closest('.card-plot').getBoundingClientRect()
      const fits = box.left >= card.left - 1 && box.top >= card.top - 1 && box.right <= card.right + 1 && box.bottom <= card.bottom + 1
      return fits ? null : { canvas: box.toJSON(), card: card.toJSON() }
    }""")
    if fit:
        raise RuntimeError(f'The compact scan render should fit the available gallery preview: {fit}')
    await check_compact_figure_bounds(chart.locator('svg[data-cad-colorbar]'), 'rect.scientific-frame')
    await expect(chart.locator('input, select, button, [data-cad-section], [data-cad-readout]')).to_have_count(0)


async def check_cad_scan(plot, touch):
    chart = plot.locator('[data-cad-scan]')
    viewport = chart.locator('canvas[data-cad-viewport]')
    section = chart.locator('svg[data-cad-section]')
    tolerance = chart.get_by_label('Tolerance (mm)', exact=True)
    outside = chart.get_by_role('checkbox', name='Outside tolerance only', exact=True)
    nominal = chart.get_by_role('checkbox', name='Show nominal surface', exact=True)
    plane = chart.get_by_role('slider', name='Section position', exact=True)
    rotate_right = chart.get_by_role('button', name='Rotate right', exact=True)
    rotate_left = chart.get_by_role('button', name='Rotate left', exact=True)
    readout = chart.locator('output[data-cad-readout]')
    colorbar = chart.locator('[data-cad-colorbar]')
    scan_marks = section.locator('circle[data-cad-section-point]')
    selected_mark = section.locator('circle[data-cad-section-selected]')
    nominal_section = section.locator('[data-cad-section-nominal]')
    await check_cad_canvas_pixels(viewport)
    await expect(chart.locator('figcaption a').first).to_have_attribute('href', 'https://doi.org/10.18434/mds2-2291')
    await expect(section).to_be_visible()
    await expect(section).to_have_attribute('data-section-axis', 'y')
    await expect(section.get_by_text('X (mm)', exact=True)).to_be_visible()
    await expect(section.get_by_text('Z (mm)', exact=True)).to_be_visible()
    await expect(section.locator('rect[data-cad-section-frame]')).to_be_visible()
    await expect(section.locator('.scientific-tick').first).to_be_attached()
    await expect(scan_marks.first).to_be_visible()
    await expect(nominal_section.first).to_be_attached()
    await expect(readout).to_be_visible()
    await expect(colorbar).to_be_visible()
    await expect(colorbar.get_by_text('Δ (mm)', exact=True)).to_be_visible()
    await expect(colorbar.get_by_text('0', exact=True)).to_be_visible()
    await expect(colorbar.locator('rect[fill^="url("]')).to_be_visible()
    color_limit = float(await colorbar.get_attribute('data-max'))
    if color_limit != 0.6 or -color_limit != float(await colorbar.get_attribute('data-min')):
        raise RuntimeError('Signed scan deviations should use a fixed diverging scale centered on zero')
    await expect(outside).not_to_be_checked()
    await expect(nominal).to_be_checked()
    await expect(viewport).to_have_attribute('data-nominal', 'true')

    async def state():
        attributes = await readout.evaluate("""out => [
          ...['tolerance', 'outsideCount', 'visibleCount'].map(key => Number(out.dataset[key])),
          ...['index', 'deviationMm', 'x', 'y', 'z'].map(key => out.dataset[key]),
        ]""")
        tol, beyond, visible, index, deviation, x, y, z = attributes
        await expect(viewport).to_have_attribute('data-visible-count', str(visible))
        if not math.isclose(float(await tolerance.input_value()), tol, abs_tol=1e-8):
            raise RuntimeError('Tolerance control and point-count readout should agree')
        if index in ('', None):
            return tol, beyond, visible, None
        await expect(viewport).to_have_attribute('data-selected', index)
        return tol, beyond, visible, (int(index), float(deviation), [float(x), float(y), float(z)])

    async def view_angles():
        angles = await viewport.evaluate('canvas => [Number(canvas.dataset.yaw), Number(canvas.dataset.pitch)]')
        if not all(map(math.isfinite, angles)):
            raise RuntimeError(f'Invalid 3D scan camera angles: {angles}')
        return angles

    async def canvas_image():
        return await viewport.evaluate("""async canvas => {
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
          return canvas.toDataURL()
        }""")
    async def check_point(expected):
        index, deviation, xyz = expected
        await expect(readout).to_have_attribute('data-index', str(index))
        active = (await state())[3]
        if active != (index, deviation, xyz):
            raise RuntimeError(f'Unexpected signed deviation or coordinates for scan point {index}: {active}')
        axis = await section.get_attribute('data-section-axis')
        selected_position = float(await section.get_attribute('data-section-position'))
        if not math.isclose(selected_position, xyz['xyz'.index(axis)], abs_tol=1e-5):
            raise RuntimeError('Selecting a measured point should move the physical section plane to its coordinate')
        await expect(selected_mark).to_have_attribute('data-index', str(index))
        view_x = float(await viewport.get_attribute('data-selected-x'))
        view_y = float(await viewport.get_attribute('data-selected-y'))
        return {'x': view_x, 'y': view_y}

    positive = (639, 1.043947, [1.062512, 2.421255, 3.452785])
    negative = (2441, -0.475798, [6.223645, 1.116349, 0.524201])
    initial_state = await state()
    if initial_state != (0.1, 1269, 3601, positive):
        raise RuntimeError(f'Unexpected NIST point count, default tolerance or selected measurement: {initial_state}')
    await expect(readout.get_by_text('Outside tolerance', exact=True)).to_be_visible()
    initial_angles = await view_angles()
    initial_image = await canvas_image()
    original_section = await section.get_attribute('data-section-position')
    nominal_segments = await nominal_section.count()
    await nominal.uncheck()
    await expect(viewport).to_have_attribute('data-nominal', 'false')
    if await canvas_image() == initial_image:
        raise RuntimeError('The nominal mesh toggle should change the live 3D render')
    if await state() != initial_state or await view_angles() != initial_angles or await nominal_section.count() != nominal_segments:
        raise RuntimeError('Hiding the 3D nominal mesh should preserve data, camera and the sectional reference')
    await nominal.check()
    await expect(viewport).to_have_attribute('data-nominal', 'true')

    if touch:
        await rotate_right.tap()
    else:
        await rotate_right.press('Enter')
    yaw, pitch = await view_angles()
    if yaw == initial_angles[0] or pitch != initial_angles[1] or await state() != initial_state:
        raise RuntimeError('The rotate button should change azimuth while preserving the selected measurement')
    if await canvas_image() == initial_image:
        raise RuntimeError('Changing the camera angle should produce a new 3D render')
    await rotate_left.click()
    restored_angles = await view_angles()
    if any(not math.isclose(actual, expected, abs_tol=1e-8) for actual, expected in zip(restored_angles, initial_angles)):
        raise RuntimeError('Rotate left should reverse the Rotate right angular step')

    await plane.press('Home')
    await expect(section).to_have_attribute('data-section-position', await plane.get_attribute('min'))
    if await state() != initial_state or await view_angles() != restored_angles:
        raise RuntimeError('Navigating section position should preserve the active 3D measurement')
    await plane.fill(original_section)

    async def pick(target, position=None):
        if touch:
            await target.tap(position=position)
        else:
            await target.click(position=position)

    await outside.check()
    if (await state())[:3] != (0.1, 1269, 1269):
        raise RuntimeError('The default tolerance filter should show exactly 1269 sampled outliers')
    await tolerance.fill('0.45')
    tol, beyond, visible, _ = await state()
    if (tol, beyond, visible) != (0.45, 198, 198):
        raise RuntimeError(f'Expected 198 sampled outliers at ±0.45 mm, observed {tol}, {beyond}, {visible}')
    await expect(colorbar).to_have_attribute('data-min', '-0.6')
    await expect(colorbar).to_have_attribute('data-max', '0.6')

    await pick(section.locator(f'circle[data-cad-section-point][data-index="{positive[0]}"]'))
    projected = await check_point(positive)
    await plane.fill(str(negative[2][1]))
    if (await state())[3] != positive:
        raise RuntimeError('Moving the section plane should preserve the selected scan point in the 3D view')
    await pick(section.locator(f'circle[data-cad-section-point][data-index="{negative[0]}"]'))
    await check_point(negative)
    await pick(viewport, projected)
    await check_point(positive)

    await outside.uncheck()
    if (await state())[:3] != (0.45, beyond, 3601):
        raise RuntimeError('Disabling the filter should restore every measurement while retaining the updated tolerance')
    await tolerance.fill('1.13')
    if await state() != (1.13, 0, 3601, positive):
        raise RuntimeError('A tolerance above the largest measured deviation should retain the sample and show no outliers')
    await expect(readout.get_by_text('Within tolerance', exact=True)).to_be_visible()

    if not touch:
        await expect(viewport).to_have_attribute('tabindex', '0')
        yaw, pitch = await view_angles()
        await viewport.press('ArrowUp')
        next_yaw, next_pitch = await view_angles()
        if next_yaw != yaw or next_pitch == pitch or (await state())[3] != positive:
            raise RuntimeError('The focused scan should support keyboard pitch without changing azimuth or selection')
        await viewport.press('ArrowDown')
        _, restored_pitch = await view_angles()
        if not math.isclose(restored_pitch, pitch, abs_tol=1e-8):
            raise RuntimeError('ArrowDown should reverse the keyboard pitch adjustment')
        await viewport.scroll_into_view_if_needed()
        bounds = await viewport.bounding_box()
        mouse = viewport.page.mouse
        x, y = bounds['x'] + bounds['width'] * 0.42, bounds['y'] + bounds['height'] * 0.46
        yaw, pitch = await view_angles()
        await mouse.move(x, y)
        await mouse.down()
        await mouse.move(x + 35, y - 20, steps=5)
        await mouse.up()
        next_yaw, next_pitch = await view_angles()
        if next_yaw <= yaw or next_pitch >= pitch:
            raise RuntimeError('Dragging the registered scan should rotate both viewing axes')
        await check_point(positive)


async def cie_frame(figure):
    frame = figure.locator('rect[data-cie-frame]')
    return await frame.evaluate("""rect => [
      ...['x', 'y', 'width', 'height'].map(key => rect[key].baseVal.value),
      ...['xMax', 'yMax'].map(key => Number(rect.dataset[key] ?? rect.ownerSVGElement.dataset[key])),
    ]""")


async def check_cie_figure(figure, space):
    await expect(figure).to_be_visible()
    await expect(figure).to_have_attribute('data-space', space)
    await expect(figure.locator('rect[data-cie-frame]')).to_be_visible()
    await expect(figure.locator('.scientific-tick').first).to_be_attached()
    labels = ('x', 'y') if space == 'xy' else ('u′', 'v′')
    for label in labels:
        await expect(figure.get_by_text(label, exact=True)).to_be_visible()
    left, top, width, height, x_max, y_max = await cie_frame(figure)
    domain = (0.8, 0.9) if space == 'xy' else (0.65, 0.65)
    if (x_max, y_max) != domain or not math.isclose(width / x_max, height / y_max, rel_tol=1e-5):
        raise RuntimeError(f'Chromaticity axes should use equal coordinate units over the expected domains: {(width, height, x_max, y_max)}')
    for stroke in ('path[data-cie-spectral-locus]', 'path[data-cie-purple-line]'):
        path = figure.locator(stroke)
        await expect(path).to_have_attribute('d', re.compile(r'^M'))
        if await path.evaluate('mark => mark.getTotalLength()') <= 0:
            raise RuntimeError(f'Missing CIE outline geometry on {stroke}')
    locus = figure.locator('path[data-cie-spectral-locus]')
    wavelength_nodes = (await locus.get_attribute('d')).removeprefix('M').split('L')
    if len(wavelength_nodes) != 471:
        raise RuntimeError(f'Expected all 471 official CIE points at 1 nm from 360 to 830 nm, observed {len(wavelength_nodes)}')
    observed = list(map(float, wavelength_nodes[550 - 360].split(',')))
    x, y = (0.3016, 0.69231) if space == 'xy' else cie_uv(0.3016, 0.69231)
    expected = [left + width * x / x_max, top + height * (1 - y / y_max)]
    if any(not math.isclose(value, anchor, abs_tol=0.5) for value, anchor in zip(observed, expected)):
        raise RuntimeError(f'The 550 nm CIE locus sample is misplaced: {observed}, expected {expected}')
    await expect(figure.locator('path[data-cie-white]')).to_be_visible()
    for polygon in ('[data-cie-gamut="reference"]', '[data-cie-gamut="comparison"]', '[data-cie-overlap]'):
        await expect(figure.locator(f'polygon{polygon}')).to_be_visible()
    raster = figure.locator('image[data-cie-field]')
    await expect(raster).to_have_attribute('href', re.compile(r'^data:image/png;base64,'))
    raster_size, clipped, colors = await raster.evaluate(r"""async raster => {
      const image = new Image()
      image.src = raster.getAttribute('href')
      await image.decode()
      const { naturalWidth: width, naturalHeight: height } = image
      const buffer = document.createElement('canvas')
      buffer.width = width
      buffer.height = height
      const ctx = buffer.getContext('2d')
      ctx.drawImage(image, 0, 0)
      const { data } = ctx.getImageData(0, 0, width, height)
      const colors = new Set()
      for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 0) {
        const [r, g, b] = data.subarray(i, i + 3)
        colors.add(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4))
      }
      const clip = [raster, raster.parentElement].map(mark => mark.getAttribute('clip-path')).find(Boolean)
      const id = clip?.match(/url\(#([^)]*)\)/)?.[1]
      const constraint = id && raster.ownerDocument.getElementById(id)
      const locus = raster.ownerSVGElement.querySelector('[data-cie-spectral-locus]').getAttribute('d')
      return [[width, height], constraint?.querySelector('path')?.getAttribute('d') === locus + 'Z', colors.size]
    }""")
    expected_size = [320, 360 if space == 'xy' else 320]
    if raster_size != expected_size or not clipped or colors < 32:
        raise RuntimeError(f'Expected a dense chromaticity raster clipped to the spectral locus: {raster_size}, {clipped}, {colors}')


def cie_uv(x, y):
    denominator = 3 - 2 * x + 12 * y
    return 4 * x / denominator, 9 * y / denominator


def cie_polygon_area(points):
    return abs(math.fsum(a[0] * b[1] - a[1] * b[0] for a, b in zip(points, points[1:] + points[:1]))) / 2


async def check_cie_chromaticity(plot, touch):
    chart = plot.locator('[data-cie-chromaticity]')
    figure = chart.locator('svg[data-cie-diagram]')
    space_control = chart.get_by_role('combobox', name='Coordinate space', exact=True)
    ref_control = chart.get_by_role('combobox', name='Reference gamut', exact=True)
    cmp_control = chart.get_by_role('combobox', name='Comparison gamut', exact=True)
    readout = chart.locator('output[data-cie-readout]')
    selected = figure.locator('circle[data-cie-selected]')
    target = figure.locator('rect[data-cie-pick]')
    primaries = {
        'srgb': [(0.64, 0.33), (0.30, 0.60), (0.15, 0.06)],
        'display-p3': [(0.68, 0.32), (0.265, 0.69), (0.15, 0.06)],
        'rec2020': [(0.708, 0.292), (0.170, 0.797), (0.131, 0.046)],
    }
    await check_cie_figure(figure, 'xy')
    await expect(chart.locator('figcaption a').first).to_have_attribute('href', 'https://doi.org/10.25039/CIE.DS.mifmy4x4')
    await expect(readout).to_be_visible()
    await expect(selected).to_be_visible()
    await expect(space_control).to_have_value('xy')
    await expect(ref_control).to_have_value('srgb')
    await expect(cmp_control).to_have_value('display-p3')

    async def check_areas(space, ref_id, cmp_id):
        attributes = await readout.evaluate("""out => [
          ...['referenceArea', 'comparisonArea', 'intersectionArea', 'coverage', 'comparisonCoverage'].map(key => Number(out.dataset[key])),
          out.dataset.reference, out.dataset.comparison,
        ]""")
        reference, comparison, overlap, coverage, reverse_coverage, actual_ref, actual_cmp = attributes
        if (actual_ref, actual_cmp) != (ref_id, cmp_id):
            raise RuntimeError(f'Selected gamut identifiers do not match the readout: {attributes}')
        standard_areas = []
        for gamut in (ref_id, cmp_id):
            coordinates = primaries[gamut]
            if space == 'uv':
                coordinates = [cie_uv(x, y) for x, y in coordinates]
            standard_areas.append(cie_polygon_area(coordinates))
        if {ref_id, cmp_id} == {'display-p3', 'rec2020'}:
            # The near-nested primaries still clip a small portion of Display P3.
            expected_overlap = 0.15196971562126144 if space == 'xy' else 0.08146188240816035
        else:
            expected_overlap = min(standard_areas)
        expected_coverage = expected_overlap / standard_areas[0]
        expected = [*standard_areas, expected_overlap, expected_coverage, expected_overlap / standard_areas[1]]
        if not (0 <= coverage <= 1 and 0 <= reverse_coverage <= 1) or not all(
            math.isclose(actual, anchor, abs_tol=1e-8) for actual, anchor in zip(attributes[:5], expected)
        ):
            raise RuntimeError(f'Unexpected {space} gamut areas or directional coverage: {attributes[:5]}, expected {expected}')
        _, _, width, height, x_max, y_max = await cie_frame(figure)
        scale = (width / x_max) * (height / y_max)
        names = ['[data-cie-gamut="reference"]', '[data-cie-gamut="comparison"]', '[data-cie-overlap]']
        for selector, physical_area in zip(names, (reference, comparison, overlap)):
            vertices = await figure.locator(f'polygon{selector}').evaluate(
                'mark => Array.from(mark.points, vertex => [vertex.x, vertex.y])'
            )
            if not math.isclose(cie_polygon_area(vertices) / scale, physical_area, abs_tol=1e-4):
                raise RuntimeError(f'Drawn {selector} polygon must match its {space} geometric area')
        return reference, comparison, overlap, coverage, reverse_coverage

    async def selection(space):
        x, y, u, v, in_reference, in_comparison = await readout.evaluate("""out => [
          ...['x', 'y', 'u', 'v'].map(key => Number(out.dataset[key])),
          out.dataset.inReference, out.dataset.inComparison,
        ]""")
        if not (0 <= x <= 1 and 0 <= y <= 1 and x + y <= 1) or not all(
            math.isclose(actual, expected, abs_tol=1e-9) for actual, expected in zip([u, v], cie_uv(x, y))
        ):
            raise RuntimeError(f'The selected chromaticity should retain consistent xy and u′v′ coordinates: {x}, {y}, {u}, {v}')
        mx, my, cx, cy = await selected.evaluate("""mark => [
          Number(mark.dataset.x), Number(mark.dataset.y), mark.cx.baseVal.value, mark.cy.baseVal.value,
        ]""")
        if (mx, my) != (x, y):
            raise RuntimeError('Marker and readout should preserve the same canonical xy point')
        left, top, width, height, x_max, y_max = await cie_frame(figure)
        horizontal, vertical = (x, y) if space == 'xy' else (u, v)
        if not math.isclose(cx, left + width * horizontal / x_max, abs_tol=0.5) or not math.isclose(
            cy, top + height * (1 - vertical / y_max), abs_tol=0.5
        ):
            raise RuntimeError(f'Selection marker should project onto the {space} coordinates')
        return x, y, in_reference, in_comparison

    white = await selection('xy')
    if white != (0.3127, 0.329, 'true', 'true'):
        raise RuntimeError(f'Expected D65 at the startup white point inside both standard gamuts: {white}')
    xy_areas = await check_areas('xy', 'srgb', 'display-p3')
    await space_control.select_option('uv')
    await check_cie_figure(figure, 'uv')
    if await selection('uv') != white:
        raise RuntimeError('Switching to CIE u′v′ should preserve the D65 canonical xy coordinates')
    uv_areas = await check_areas('uv', 'srgb', 'display-p3')
    if math.isclose(uv_areas[0], xy_areas[0], abs_tol=1e-4):
        raise RuntimeError('The plotted area should be recomputed in CIE u′v′ coordinates')
    await ref_control.select_option('display-p3')
    await cmp_control.select_option('rec2020')
    near_coverage = (await check_areas('uv', 'display-p3', 'rec2020'))[3]
    if not 0.999 < near_coverage < 1:
        raise RuntimeError('The near-contained Display P3 polygon should retain its narrow non-overlap in u′v′')
    await ref_control.select_option('rec2020')
    await cmp_control.select_option('srgb')
    uv_coverage = (await check_areas('uv', 'rec2020', 'srgb'))[3]
    if not 0 < uv_coverage < 1 or await selection('uv') != white:
        raise RuntimeError('Changing gamut roles should preserve D65 and report directional coverage')
    await space_control.select_option('xy')
    await expect(figure).to_have_attribute('data-space', 'xy')
    await check_areas('xy', 'rec2020', 'srgb')
    await ref_control.select_option('srgb')
    await cmp_control.select_option('display-p3')

    async def pick(x, y):
        await target.scroll_into_view_if_needed()
        bounds = await target.bounding_box()
        _, _, _, _, x_max, y_max = await cie_frame(figure)
        position = {'x': bounds['width'] * x / x_max, 'y': bounds['height'] * (1 - y / y_max)}
        if touch:
            await target.tap(position=position)
        else:
            await target.click(position=position)

    if touch:
        await target.scroll_into_view_if_needed()
        bounds = await target.bounding_box()
        await target.dispatch_event('pointerdown', {
            'pointerType': 'touch',
            'clientX': bounds['x'] + bounds['width'] * 0.28 / 0.8,
            'clientY': bounds['y'] + bounds['height'] * (1 - 0.64 / 0.9),
        })
        await target.dispatch_event('pointercancel', {'pointerType': 'touch'})
        if await selection('xy') != white:
            raise RuntimeError('Beginning a touch scroll over the plot should preserve the selected chromaticity')
    await pick(0.28, 0.64)
    picked = await selection('xy')
    if not math.isclose(picked[0], 0.28, abs_tol=0.005) or not math.isclose(picked[1], 0.64, abs_tol=0.005) or (
        picked[2:] != ('false', 'true')
    ):
        raise RuntimeError(f'Pointer pick should select the P3-only green; observed {picked}')
    await pick(0.75, 0.7)
    if await selection('xy') != picked:
        raise RuntimeError('A point outside the spectral boundary should leave the selection unchanged')

    await expect(target).to_have_attribute('tabindex', '0')
    await target.press('ArrowRight')
    moved = await selection('xy')
    if moved[0] <= picked[0] or not math.isclose(moved[1], picked[1], abs_tol=1e-9):
        raise RuntimeError(f'Right arrow should increase the horizontal chromaticity while preserving the vertical coordinate: {moved}')
    await space_control.select_option('uv')
    await expect(figure).to_have_attribute('data-space', 'uv')
    if any(not math.isclose(actual, expected, abs_tol=1e-9) for actual, expected in zip(
        (await selection('uv'))[:2], moved[:2]
    )):
        raise RuntimeError('A manually selected chromaticity should remain invariant when coordinates change')
    u, v = cie_uv(*moved[:2])
    await target.press('ArrowRight')
    new_u, new_v = cie_uv(*(await selection('uv'))[:2])
    if not math.isclose(new_u, u + 0.005, abs_tol=1e-9) or not math.isclose(new_v, v, abs_tol=1e-9):
        raise RuntimeError('Right arrow should move by 0.005 along the active u′ axis and preserve v′')


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
