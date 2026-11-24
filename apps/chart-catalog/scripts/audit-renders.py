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
WAVELET_ORIGINAL_ASSET = re.compile(r'/wavelet-original-waveform(?:-[^/?]+)?\.bin(?:\?.*)?$')
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
        'mass-spectrum', 'mass-spectrum-mirror', 'pca-biplot', 'pareto-frontier', 'batch-genealogy',
        'spatial-defect-map', 'lcms-feature-map', 'chromatogram-peak-integration', 'spectrum', 'spectrogram',
        'spectral-waterfall', 'correlation-matrix',
        'gauge-rr', 'kaplan-meier', 'weibull-probability', 'process-control', 'hotelling-process-monitor',
        'classifier-threshold-explorer', 'fault-event-replay', 'startup-overlay', 'cumulative-flow', 'takt-balance',
        'energy-operating-map',
        'campbell-diagram', 'mode-shapes', 'shaft-orbit', 'frequency-response', 'coherence-phase',
        'wavelet-scalogram', 'bearing-envelope', 'eye-diagram', 'allan-deviation', 'phase-plane', 'xrd-peak-tracker',
        'stress-strain-comparison', 'full-field-strain', 'fatigue-sn', 'crack-growth', 'binary-phase-diagram',
        'ternary-mixture-map', 'industrial-ct', 'cad-scan-deviation', 'cie-chromaticity', 'hyperspectral-cube', 'response-surface',
    }
    examples = [example for family in catalog if family['id'] in families for example in family['examples']]
    for width, height, theme in [(390, 844, 'light'), (1440, 900, 'dark')]:
        await check_scientific_profile(browser, local_url, examples, width, height, theme)
    await check_invalid_original_waveform(browser, local_url)


async def check_scientific_profile(browser, local_url, examples, width, height, theme):
    touch = width < 768
    page = await browser.new_page(viewport={'width': width, 'height': height}, has_touch=touch, reduced_motion='reduce')
    waveform_requests = []
    page.on('request', lambda request: waveform_requests.append(request.url) if WAVELET_ORIGINAL_ASSET.search(request.url) else None)
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
            elif example['family'] == 'mass-spectrum-mirror':
                spectrum = card_plot.locator('svg[data-mirror-spectrum-plot]')
                await check_mirror_spectrum_plot(spectrum)
                await check_compact_figure_bounds(spectrum, 'rect[data-mirror-spectrum-frame]')
                await expect(card_plot.locator('select, [data-mirror-readout], [data-mirror-pick], [data-selected="true"]')).to_have_count(0)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=mass-spectrum-mirror&variant=mass-spectrum-mirror-caffeine'
                )
            elif example['family'] == 'pca-biplot':
                biplot = card_plot.locator('svg[data-pca-plot]')
                await check_pca_plot(biplot)
                await check_compact_figure_bounds(biplot, 'rect[data-pca-frame]')
                await expect(card_plot.locator('select, [data-pca-brush-target], [data-pca-loading-axes], [data-pca-readout]')).to_have_count(0)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=pca-biplot&variant=pca-biplot-glass'
                )
            elif example['family'] == 'pareto-frontier':
                frontier = card_plot.locator('svg[data-pareto-plot]')
                await check_initial_pareto_plot(frontier, example['id'])
                await check_compact_figure_bounds(frontier, '[data-pareto-face]')
                await expect(card_plot.locator('select, input, [data-pareto-readout], [data-pareto-active], .pareto-hit')).to_have_count(0)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', f'#docs=pareto-frontier&variant={example["id"]}'
                )
            elif example['family'] == 'batch-genealogy':
                genealogy = card_plot.locator('svg[data-genealogy-plot]')
                await check_genealogy_plot(genealogy, 'horizontal')
                await check_compact_figure_bounds(genealogy, '.genealogy-node-shape')
                interactive = 'button, select, [data-genealogy-evidence], [data-inspected="true"], [data-witness="true"]'
                await expect(card_plot.locator(interactive)).to_have_count(0)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=batch-genealogy&variant=batch-genealogy-enclosures'
                )
            elif example['family'] == 'spatial-defect-map':
                wafer = card_plot.locator('svg[data-wafer-plot]')
                await check_wafer_plot(wafer, example['id'])
                await check_compact_figure_bounds(wafer, '[data-wafer-outline]')
                measured = example['id'] == 'spatial-defect-map-measured'
                await expect(wafer.locator('.wafer-compact-layer')).to_have_count(2 if measured else 5)
                interactive = 'button, select, [data-wafer-die], [data-wafer-cursor], [data-wafer-readout]'
                await expect(card_plot.locator(interactive)).to_have_count(0)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', f'#docs=spatial-defect-map&variant={example["id"]}'
                )
            elif example['family'] == 'chromatogram-peak-integration':
                await check_peak_integration_compact(card_plot)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=chromatogram-peak-integration&variant=chromatogram-peak-integration-coffee'
                )
            elif example['family'] == 'gauge-rr':
                await check_gauge_rr_compact(card_plot)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', f'#docs=gauge-rr&variant={example["id"]}'
                )
            elif example['family'] == 'hotelling-process-monitor':
                await check_hotelling_compact(card_plot)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=hotelling-process-monitor&variant=hotelling-process-monitor-milling'
                )
            elif example['family'] == 'energy-operating-map':
                await check_energy_operating_map_compact(card_plot)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=energy-operating-map&variant=energy-operating-map-machine'
                )
            elif example['family'] == 'takt-balance':
                await check_takt_balance_compact(card_plot)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=takt-balance&variant=takt-balance-assembly'
                )
            elif example['family'] == 'cumulative-flow':
                await check_cumulative_flow_compact(card_plot)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=cumulative-flow&variant=cumulative-flow-manufacturing'
                )
            elif example['family'] == 'startup-overlay':
                await check_startup_overlay_compact(card_plot)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=startup-overlay&variant=startup-overlay-measured'
                )
            elif example['family'] == 'fault-event-replay':
                await check_fault_replay_compact(card_plot)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=fault-event-replay&variant=fault-event-replay-pronto'
                )
            elif example['family'] == 'classifier-threshold-explorer':
                await check_classifier_threshold_compact(card_plot)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=classifier-threshold-explorer&variant=classifier-threshold-explorer-secom'
                )
            elif example['family'] == 'weibull-probability':
                await check_weibull_compact(card_plot, example['id'])
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', f'#docs=weibull-probability&variant={example["id"]}'
                )
            elif example['family'] == 'kaplan-meier':
                await check_kaplan_meier_compact(card_plot)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=kaplan-meier&variant=kaplan-meier-glass-capacitors'
                )
            elif example['family'] == 'lcms-feature-map':
                await check_lcms_compact(card_plot)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=lcms-feature-map&variant=lcms-feature-map-openms'
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
                await expect(card_plot.locator(
                    'select, input, button, [data-cie-selected], [data-cie-sample], [data-cie-readout]'
                )).to_have_count(0)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=cie-chromaticity&variant=cie-chromaticity-gamuts'
                )
            elif example['family'] == 'hyperspectral-cube':
                image = card_plot.locator('svg[data-hyper-image]')
                await check_hyper_image(image)
                await check_compact_figure_bounds(image, 'rect[data-hyper-image-frame]')
                await expect(card_plot.locator('input, select, button, [data-hyper-region], [data-hyper-spectrum], [data-hyper-readout]')).to_have_count(0)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=hyperspectral-cube&variant=hyperspectral-cube-cuprite'
                )
            elif example['family'] == 'response-surface':
                await check_compact_response_surface(card_plot)
                await expect(card.locator('.example-card-link')).to_have_attribute(
                    'href', '#docs=response-surface&variant=response-surface-thermal'
                )
        if waveform_requests:
            raise RuntimeError('Showing the compact wavelet card must not request the original recording')
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
                await check_spectral_waterfall(plot, slug, touch)
                code_import = 'SpectralWaterfall'
            elif example['family'] == 'mass-spectrum':
                await check_particle_mass_spectrum(plot)
                code_import = "getExample('mass-spectrum-cms')"
            elif example['family'] == 'mass-spectrum-mirror':
                await check_mass_spectrum_mirror(plot, touch)
                code_import = 'MassSpectrumMirror'
            elif example['family'] == 'pca-biplot':
                await check_pca_biplot(plot, touch)
                code_import = 'PcaBiplot'
            elif example['family'] == 'pareto-frontier':
                await check_pareto_frontier(plot, slug, touch)
                code_import = 'ParetoFrontier'
            elif example['family'] == 'batch-genealogy':
                await check_batch_genealogy(plot, touch)
                code_import = 'BatchGenealogy'
            elif example['family'] == 'spatial-defect-map':
                await check_spatial_defect_map(plot, slug, touch)
                code_import = 'SpatialDefectMap'
            elif example['family'] == 'chromatogram-peak-integration':
                await check_peak_integration(plot, touch)
                code_import = 'ChromatogramPeakIntegration'
            elif example['family'] == 'gauge-rr':
                await check_gauge_rr(plot, slug, touch)
                code_import = 'GaugeRR'
            elif example['family'] == 'hotelling-process-monitor':
                await check_hotelling(plot, touch)
                code_import = 'HotellingProcessMonitor'
            elif example['family'] == 'energy-operating-map':
                await check_energy_operating_map(plot, touch)
                code_import = 'EnergyOperatingMap'
            elif example['family'] == 'takt-balance':
                await check_takt_balance(plot, touch)
                code_import = 'TaktBalance'
            elif example['family'] == 'cumulative-flow':
                await check_cumulative_flow(plot, touch)
                code_import = 'CumulativeFlow'
            elif example['family'] == 'startup-overlay':
                await check_startup_overlay(plot, touch)
                code_import = 'StartupOverlay'
            elif example['family'] == 'fault-event-replay':
                await check_fault_replay(plot, touch)
                code_import = 'FaultReplay'
            elif example['family'] == 'classifier-threshold-explorer':
                await check_classifier_threshold(plot, touch)
                code_import = 'ClassifierThresholdExplorer'
            elif example['family'] == 'weibull-probability':
                await check_weibull_probability(plot, slug, touch)
                code_import = 'WeibullProbabilityPlot'
            elif example['family'] == 'kaplan-meier':
                await check_kaplan_meier(plot, touch)
                code_import = 'KaplanMeierReliability'
            elif example['family'] == 'lcms-feature-map':
                await check_lcms_feature_map(plot, touch)
                code_import = 'LcMsFeatureMap'
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
                if not waveform_requests:
                    raise RuntimeError('The wavelet guide must request the original-rate recording')
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
            elif example['family'] == 'hyperspectral-cube':
                await check_hyperspectral_cube(plot, touch)
                code_import = 'HyperspectralCube'
            elif example['family'] == 'response-surface':
                await check_response_surface(plot, touch)
                code_import = 'ResponseSurface'
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
    await expect(signal).to_have_attribute('data-sample-rate', '200000')
    await expect(signal).to_have_attribute('data-sample-count', '512000')
    await expect(signal.get_by_text('Waveform (channel units)', exact=True)).to_be_visible()
    trace = signal.locator('path[data-wavelet-signal-trace]')
    await expect(trace).to_have_attribute('d', re.compile(r'^M'))
    readout = chart.locator('output[data-wavelet-readout]')
    await expect(readout).to_be_visible()
    time = chart.get_by_role('slider', name='Time', exact=True)
    frequency = chart.get_by_role('slider', name='Frequency', exact=True)
    window = chart.get_by_role('combobox', name='Waveform window', exact=True)
    await expect(window).to_have_value('0.25')
    await expect(readout).to_contain_text('200 kHz waveform')
    sample_anchors = {
        400: 0.19708191740696052,
        221200: 0.1339432644718509,
        511600: 0.2924475979226131,
    }

    async def selection():
        attributes = await readout.evaluate("""output => [
          ...['time', 'frequency', 'power', 'windowStart', 'windowEnd',
            'waveletSampleIndex', 'waveletSampleTime', 'waveletSampleValue'].map(key => Number(output.dataset[key])),
        ]""")
        seconds, hz, power, start, end, index, sample_time, sample = attributes
        if not all(map(math.isfinite, (seconds, hz, power, start, end))) or not (
            hz > 0 and -60 <= power <= 0 and start <= seconds <= end and start < end
        ):
            raise RuntimeError(f'Invalid wavelet selection or waveform extent: {attributes}')
        expected = round((seconds - 3.5) * 200000)
        if index != expected or not math.isclose(sample_time, 3.5 + expected / 200000, abs_tol=1e-12) or not math.isfinite(sample):
            raise RuntimeError(f'Wavelet selection at {seconds} s must link to original excerpt sample {expected}: {attributes[5:]}')
        if expected in sample_anchors and not math.isclose(sample, sample_anchors[expected], rel_tol=1e-12, abs_tol=1e-12):
            raise RuntimeError(f'Excerpt sample {expected} must preserve its collected Channel_1 value: {sample}')
        return seconds, hz, start, end

    initial_time, initial_hz, *_ = await selection()
    initial_power = float(await readout.get_attribute('data-power'))
    if not math.isclose(initial_time, 4.606) or not math.isclose(initial_hz, 1638.68316531) or initial_power != 0:
        raise RuntimeError(f'The example should open on the measured peak, observed {initial_time} s, {initial_hz} Hz, {initial_power} dB')

    for value in ['0.001', '0.01']:
        previous_trace = await trace.get_attribute('d')
        await window.select_option(value)
        seconds, hz, start, end = await selection()
        if (seconds, hz) != (initial_time, initial_hz) or not math.isclose(end - start, float(value), abs_tol=1e-10):
            raise RuntimeError(f'Window {value} s should show the selected impact without moving the cursor: {seconds}, {hz}')
        await expect(trace).not_to_have_attribute('d', previous_trace)
        if value == '0.001':
            points, frame, amplitude, marker, time_ticks = await signal.evaluate(r"""svg => {
              const path = svg.querySelector('[data-wavelet-signal-trace]').getAttribute('d')
              const points = path.match(/[ML][^ML]+/g).map(pair => pair.slice(1).trim().split(/\s+/).map(Number))
              const frame = svg.querySelector('rect.scientific-frame')
              const marker = svg.querySelector('circle.wavelet-sample-marker')
              const timeTicks = [...svg.querySelectorAll('.scientific-axis g')].flatMap(tick => {
                const line = tick.querySelector('line')
                return line.x1.baseVal.value === line.x2.baseVal.value ? [tick.querySelector('text').textContent] : []
              })
              return [points, ['x', 'y', 'width', 'height'].map(key => frame[key].baseVal.value),
                [Number(svg.dataset.amplitudeMin), Number(svg.dataset.amplitudeMax)],
                [marker.cx.baseVal.value, marker.cy.baseVal.value], timeTicks]
            }""")
            left, top, width, height = frame
            step = width / ((end - start) * 200000)
            if not 199 <= len(points) <= 201 or any(
                not math.isclose(b[0] - a[0], step, abs_tol=0.011) for a, b in zip(points, points[1:])
            ):
                raise RuntimeError(f'The 1 ms trace must display individual original-rate samples, observed {len(points)} vertices')
            lower, upper = amplitude
            expected_x = left + width * (initial_time - start) / (end - start)
            expected_y = top + height * (upper - sample_anchors[221200]) / (upper - lower)
            if not all(math.isclose(actual, expected, abs_tol=0.012) for actual, expected in zip(marker, [expected_x, expected_y])) or not any(
                math.isclose(x, expected_x, abs_tol=0.012) and math.isclose(y, expected_y, abs_tol=0.012) for x, y in points
            ):
                raise RuntimeError('The original sample value and its marker must agree with the displayed waveform coordinates')
            if len(time_ticks) < 2 or len(time_ticks) != len(set(time_ticks)):
                raise RuntimeError(f'The 1 ms window requires distinguishable time labels: {time_ticks}')
    await window.select_option('0.25')

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


async def check_invalid_original_waveform(browser, local_url):
    page = await browser.new_page(viewport={'width': 1440, 'height': 900}, reduced_motion='reduce')
    try:
        await page.route(WAVELET_ORIGINAL_ASSET, lambda route: route.fulfill(
            content_type='application/octet-stream', body=b'Invalid original recording',
        ))
        await page.goto(f'{local_url}#docs=wavelet-scalogram&variant=wavelet-scalogram-bearing',
                        wait_until='domcontentloaded', timeout=20000)
        plot = page.locator('#docs-preview .docs-example-plot[data-example-id="wavelet-scalogram-bearing"]')
        await expect(plot.get_by_text(
            'Original-rate recording unavailable. Showing the processed 12.5 kHz waveform.', exact=True,
        )).to_be_visible()
        waveform = plot.locator('svg[data-wavelet-signal]')
        await expect(waveform).to_have_attribute('data-sample-rate', '12500')
        await expect(waveform).to_have_attribute('data-sample-count', '32000')
        await expect(plot.locator('output[data-wavelet-readout]')).to_contain_text('12.5 kHz waveform')
        await expect(plot.locator('image[data-wavelet-raster]')).to_have_attribute('href', re.compile(r'^data:image/png;base64,'))
    finally:
        await page.close()


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
        't61': (78928.05, 363.2333, 428.6515454439417, 0.0529786866721968, 419.8302238439861, '0.053'),
        'aged-160c': (69495.98, 283.0986, 362.0105593051729, 0.0819847441562559, 335.8435939304965, '0.082'),
        'aged-190c': (66815.61, 248.9384, 342.7704259942056, 0.0787740619650348, 322.1875264674847, '0.079'),
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
    for name, (*expected, elongation) in conditions.items():
        await condition.select_option(name)
        await expect(readout).to_have_attribute('data-condition', name)
        await expect(readout).to_have_attribute('data-fracture', 'false')
        await expect(readout).to_have_attribute('data-elongation-after-fracture', elongation)
        elongation_percent = re.escape(f'{float(elongation) * 100:.1f}')
        await expect(readout.get_by_text(re.compile(rf'^Elongation after fracture, A\s*{elongation_percent}0?%$'))).to_be_visible()
        await expect(readout).to_contain_text('Recorded endpoint strain')
        await expect(proof).to_be_visible()
        await expect(ultimate_point).to_be_visible()
        await expect(endpoint).to_be_visible()
        await expect(endpoint).to_have_attribute('data-fracture', 'false')
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
    sample_control = chart.get_by_role('combobox', name='Measured sample', exact=True)
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
    await expect(sample_control).to_have_value('')

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

    marks = figure.locator('g[data-cie-sample]')
    inclusion_counts = {'srgb': 93, 'display-p3': 99, 'rec2020': 99}
    isolated_xy = (0.234775964, 0.431760842)

    def inside_triangle(point, vertices):
        x, y = point
        crosses = [(bx - ax) * (y - ay) - (by - ay) * (x - ax)
                   for (ax, ay), (bx, by) in zip(vertices, vertices[1:] + vertices[:1])]
        return min(crosses) >= -1e-12 or max(crosses) <= 1e-12

    async def check_sample_totals(reference, comparison):
        counts = await readout.evaluate("""out =>
          ['sampleCount', 'samplesInReference', 'samplesInComparison'].map(key => Number(out.dataset[key]))
        """)
        if counts != [99, inclusion_counts[reference], inclusion_counts[comparison]]:
            raise RuntimeError(f'Expected the D65 CES sample totals for {reference} and {comparison}, observed {counts}')
        await expect(readout.get_by_text('Sample containment', exact=True)).to_be_visible()
        await expect(readout).to_contain_text(f'Inside reference {inclusion_counts[reference]} / 99')
        await expect(readout).to_contain_text(f'Inside comparison {inclusion_counts[comparison]} / 99')

    async def check_sample_marks(space, reference, comparison):
        await expect(marks).to_have_count(99)
        left, top, width, height, x_max, y_max = await cie_frame(figure)
        rows = await marks.evaluate_all("""marks => marks.map(mark => {
          const matrix = mark.ownerSVGElement.getCTM().inverse().multiply(mark.getCTM())
          const { x, y } = new DOMPoint().matrixTransform(matrix)
          return [mark.dataset.id, Number(mark.dataset.x), Number(mark.dataset.y), mark.dataset.inReference,
            mark.querySelector('circle, rect')?.localName, x, y]
        })""")
        if {row[0] for row in rows} != {f'ces-{index:02d}' for index in range(1, 100)}:
            raise RuntimeError('The gamut comparison must plot the complete set of 99 distinct CIE test samples')
        for id_, x, y, membership, shape, screen_x, screen_y in rows:
            inside = inside_triangle((x, y), primaries[reference])
            projected_x, projected_y = (x, y) if space == 'xy' else cie_uv(x, y)
            expected_x = left + width * projected_x / x_max
            expected_y = top + height * (1 - projected_y / y_max)
            if not (0 <= x <= 1 and 0 <= y <= 1 and x + y <= 1) or membership != str(inside).lower() or (
                shape != ('circle' if inside else 'rect')
            ) or not math.isclose(screen_x, expected_x, abs_tol=0.5) or not math.isclose(screen_y, expected_y, abs_tol=0.5):
                raise RuntimeError(f'{id_} should project into {space} with its {reference} membership encoded by shape')
        await check_sample_totals(reference, comparison)

    async def check_sample_selection(space, id_, xy, memberships):
        await expect(sample_control).to_have_value(id_)
        await expect(readout).to_have_attribute('data-sample-id', id_)
        await expect(figure.locator('[data-cie-sample][data-selected="true"]')).to_have_attribute('data-id', id_)
        result = await selection(space)
        if result[2:] != memberships or not all(math.isclose(actual, expected, abs_tol=1e-10)
                                                for actual, expected in zip(result[:2], xy)):
            raise RuntimeError(f'{id_} should retain its measured coordinates and gamut membership: {result}')

    async def check_free_probe():
        await expect(sample_control).to_have_value('')
        await expect(readout).not_to_have_attribute('data-sample-id', re.compile('.+'))
        await expect(figure.locator('[data-cie-sample][data-selected="true"]')).to_have_count(0)

    async def field_geometry():
        return await figure.evaluate("""svg => [
          ['[data-cie-field]', 'href'], ['[data-cie-spectral-locus]', 'd'],
          ['[data-cie-gamut="reference"]', 'points'], ['[data-cie-gamut="comparison"]', 'points'],
          ['[data-cie-overlap]', 'points'],
        ].map(([selector, attribute]) => svg.querySelector(selector).getAttribute(attribute))""")

    await space_control.select_option('xy')
    await expect(figure).to_have_attribute('data-space', 'xy')
    await expect(figure.locator('[data-cie-field]')).to_have_attribute('href', re.compile(r'^data:image/png;base64,'))
    await check_free_probe()
    await check_sample_marks('xy', 'srgb', 'display-p3')
    geometry = await field_geometry()
    await sample_control.select_option('ces-01')
    await check_sample_selection('xy', 'ces-01', (0.343072466, 0.311700566), ('true', 'true'))
    isolated = figure.locator('[data-cie-sample][data-id="ces-53"]')
    if touch:
        await isolated.tap()
    else:
        await isolated.click()
    await check_sample_selection('xy', 'ces-53', isolated_xy, ('false', 'true'))
    if await field_geometry() != geometry:
        raise RuntimeError('Picking a measured sample must preserve the spectral field and gamut geometry')

    await space_control.select_option('uv')
    await check_sample_selection('uv', 'ces-53', isolated_xy, ('false', 'true'))
    await check_sample_marks('uv', 'srgb', 'display-p3')
    await ref_control.select_option('display-p3')
    await cmp_control.select_option('rec2020')
    await check_sample_selection('uv', 'ces-53', isolated_xy, ('true', 'true'))
    await check_sample_marks('uv', 'display-p3', 'rec2020')

    show_markers = chart.get_by_role('checkbox', name='Show sample markers', exact=True)
    await expect(show_markers).to_be_checked()
    await show_markers.uncheck()
    await expect(figure.locator('[data-cie-sample]:visible')).to_have_count(0)
    await expect(sample_control).to_have_value('ces-53')
    await expect(readout).to_have_attribute('data-sample-id', 'ces-53')
    await check_sample_totals('display-p3', 'rec2020')
    await show_markers.check()
    await check_sample_selection('uv', 'ces-53', isolated_xy, ('true', 'true'))

    sample_u, sample_v = cie_uv(*isolated_xy)
    await target.press('ArrowRight')
    await check_free_probe()
    probe_u, probe_v = cie_uv(*(await selection('uv'))[:2])
    if not math.isclose(probe_u, sample_u + 0.005, abs_tol=1e-9) or not math.isclose(probe_v, sample_v, abs_tol=1e-9):
        raise RuntimeError('The keyboard must move from the measured sample into free-probe mode')
    await sample_control.select_option('ces-53')
    await space_control.select_option('xy')
    await pick(0.75, 0.7)
    await check_sample_selection('xy', 'ces-53', isolated_xy, ('true', 'true'))
    await pick(0.28, 0.64)
    await check_free_probe()
    probe_x, probe_y = (await selection('xy'))[:2]
    if not math.isclose(probe_x, 0.28, abs_tol=0.005) or not math.isclose(probe_y, 0.64, abs_tol=0.005):
        raise RuntimeError('A valid field pick must leave sample mode and inspect the chosen coordinate')
    await check_sample_totals('display-p3', 'rec2020')


async def check_hyper_image(image, mode='rgb'):
    await expect(image).to_be_visible()
    await expect(image).to_have_attribute('data-mode', mode)
    frame = image.locator('rect[data-hyper-image-frame]')
    await expect(frame).to_be_visible()
    raster = image.locator('image[data-hyper-raster]')
    await expect(raster).to_have_attribute('href', re.compile(r'^data:image/png;base64,'))
    width, height, levels, colored = await raster.evaluate("""async raster => {
      const decoded = new Image()
      decoded.src = raster.getAttribute('href')
      await decoded.decode()
      const { naturalWidth: width, naturalHeight: height } = decoded
      const buffer = document.createElement('canvas')
      buffer.width = width
      buffer.height = height
      const ctx = buffer.getContext('2d')
      ctx.drawImage(decoded, 0, 0)
      const { data } = ctx.getImageData(0, 0, width, height)
      const colors = new Set()
      let colored = 0
      for (let i = 0; i < data.length; i += 4) {
        if (!data[i + 3]) continue
        const [r, g, b] = data.subarray(i, i + 3)
        colors.add((r << 16) | (g << 8) | b)
        if (r !== g || r !== b) colored++
      }
      return [width, height, colors.size, colored]
    }""")
    expected = [int(await image.get_attribute(f'data-{axis}')) for axis in ['width', 'height']]
    if [width, height] != expected or expected != [108, 84] or levels < 8 or ((colored > 0) != (mode == 'rgb')):
        raise RuntimeError(f'Expected native measured {mode} raster {expected}; observed {width}×{height}, {levels} levels, {colored} colored pixels')
    plot_width, plot_height = await frame.evaluate('frame => [frame.width.baseVal.value, frame.height.baseVal.value]')
    if not math.isclose(plot_width / plot_height, width / height, rel_tol=1e-5):
        raise RuntimeError('Hyperspectral image should preserve its source pixel aspect ratio')
    return raster


async def check_hyperspectral_cube(plot, touch):
    chart = plot.locator('[data-hyperspectral-cube]')
    image = chart.locator('svg[data-hyper-image]')
    spectrum = chart.locator('svg[data-hyper-spectrum]')
    frame = image.locator('rect[data-hyper-image-frame]')
    trace = spectrum.locator('path[data-hyper-trace]')
    envelope = spectrum.locator('path[data-hyper-envelope]')
    readout = chart.locator('output[data-hyper-readout]')
    region = image.locator('rect[data-hyper-region]')
    image_pick = image.locator('rect[data-hyper-image-pick]')
    spectrum_pick = spectrum.locator('rect[data-hyper-spectrum-pick]')
    mode = chart.get_by_role('combobox', name='Image mode', exact=True)
    red = chart.get_by_role('combobox', name='Red band', exact=True)
    green = chart.get_by_role('combobox', name='Green band', exact=True)
    blue = chart.get_by_role('combobox', name='Blue band', exact=True)
    bands = chart.get_by_role('slider', name='Wavelength band', exact=True)
    raster = await check_hyper_image(image)
    await expect(chart.locator('figcaption a').first).to_have_attribute('href', 'https://popo.jpl.nasa.gov/1995_cuprite_RTGC_rfl_cube/')
    for label in ('Source column', 'Source row'):
        await expect(image.get_by_text(label, exact=True)).to_be_visible()
    await expect(spectrum.get_by_text('Wavelength (nm)', exact=True)).to_be_visible()
    await expect(spectrum.get_by_text('Surface reflectance (%)', exact=True)).to_be_visible()
    await expect(trace).to_have_attribute('d', re.compile(r'^M'))
    await expect(bands).to_have_attribute('min', '0')
    await expect(bands).to_have_attribute('max', '117')
    await expect(image_pick).to_have_attribute('tabindex', '0')
    await expect(spectrum_pick).to_have_attribute('tabindex', '0')
    await expect(readout).to_be_visible()
    await expect(mode).to_have_value('rgb')
    width, height = [int(await image.get_attribute(f'data-{axis}')) for axis in ('width', 'height')]

    async def stats():
        band, wavelength, mean, sd, count, current, *roi = await readout.evaluate("""out => [
          Number(out.dataset.band), Number(out.dataset.wavelength), out.dataset.mean, out.dataset.sd,
          Number(out.dataset.count), out.dataset.mode,
          ...['x0', 'x1', 'y0', 'y1'].map(key => Number(out.dataset[key]))
        ]""")
        await expect(image).to_have_attribute('data-band', str(band))
        await expect(spectrum).to_have_attribute('data-band', str(band))
        await expect(image).to_have_attribute('data-mode', current)
        spectral_x, spectral_width = await spectrum_pick.evaluate('rect => [rect.x.baseVal.value, rect.width.baseVal.value]')
        marker = spectrum.locator('line[data-hyper-spectral-marker]')
        marker_x = float(await marker.get_attribute('x1'))
        expected_x = spectral_x + spectral_width * (wavelength - 383.15) / (2508.20 - 383.15)
        if not math.isclose(marker_x, expected_x, abs_tol=0.5):
            raise RuntimeError('The selected band marker should match its physical wavelength')
        await expect(mode).to_have_value(current)
        for axis, coord in zip(['x0', 'x1', 'y0', 'y1'], roi):
            await expect(region).to_have_attribute(f'data-{axis}', str(coord))
        left, top, plot_width, plot_height = await frame.evaluate(
            "frame => ['x', 'y', 'width', 'height'].map(key => frame[key].baseVal.value)"
        )
        observed = await region.evaluate(
            "region => ['x', 'y', 'width', 'height'].map(key => region[key].baseVal.value)"
        )
        x0, x1, y0, y1 = roi
        expected = [
            left + plot_width * x0 / width, top + plot_height * y0 / height,
            plot_width * (x1 - x0 + 1) / width, plot_height * (y1 - y0 + 1) / height,
        ]
        if any(not math.isclose(actual, anchor, abs_tol=0.5) for actual, anchor in zip(observed, expected)):
            raise RuntimeError(f'ROI must cover its entire inclusive pixel rectangle: {roi}, {observed}, expected {expected}')
        mean = float(mean) if mean not in ('', None) else None
        sd = float(sd) if sd not in ('', None) else None
        return band, wavelength, mean, sd, count, current, roi

    async def pick(target, horizontal, vertical):
        await target.scroll_into_view_if_needed()
        box = await target.bounding_box()
        position = {'x': box['width'] * horizontal, 'y': box['height'] * vertical}
        if touch:
            await target.tap(position=position)
        else:
            await target.click(position=position)

    for control, channel, expected_band in [(red, 'red', 106), (green, 'green', 100), (blue, 'blue', 88)]:
        await expect(control).to_have_value(str(expected_band))
        await expect(image).to_have_attribute(f'data-{channel}', str(expected_band))
        await expect(control.locator('option')).to_have_count(118)
    await expect(envelope).to_have_count(0)
    initial = await stats()
    if initial[:2] != (100, 2210.28) or initial[3:] != (0, 1, 'rgb', [85, 85, 39, 39]) or not math.isclose(
        initial[2], 29.12, abs_tol=1e-8
    ):
        raise RuntimeError(f'Unexpected initial Cuprite pixel or reflectance: {initial}')
    start_trace = await trace.get_attribute('d')
    if start_trace.count('M') != 3:
        raise RuntimeError('Excluded atmospheric intervals should leave two gaps in the physical-wavelength trace')

    original_rgb = await raster.get_attribute('href')
    await red.select_option('88')
    await expect(image).to_have_attribute('data-red', '88')
    await expect(image).to_have_attribute('data-green', '100')
    await expect(image).to_have_attribute('data-blue', '88')
    await expect(raster).not_to_have_attribute('href', original_rgb)
    if await stats() != initial:
        raise RuntimeError('Changing an RGB channel should preserve the measured spectrum and the selected region')
    await red.select_option('106')
    await expect(raster).to_have_attribute('href', original_rgb)
    await mode.select_option('band')
    await expect(raster).not_to_have_attribute('href', original_rgb)
    await check_hyper_image(image, 'band')
    tone = image.locator('[data-hyper-colorbar]')
    await expect(tone).to_have_attribute('data-min', '19')
    await expect(tone).to_have_attribute('data-max', '40')
    if (await stats())[-1] != initial[-1]:
        raise RuntimeError('Switching to a single band should retain the location')

    await pick(image_pick, (70 + .5) / width, (52 + .5) / height)
    pixel = await stats()
    if pixel[4:] != (1, 'band', [70, 70, 52, 52]) or not math.isclose(pixel[2], 36.425, abs_tol=1e-8):
        raise RuntimeError(f'Unexpected result for the selected measured pixel: {pixel}')

    await image_pick.scroll_into_view_if_needed()
    if touch:
        await pick(image_pick, (81 + .5) / width, (34 + .5) / height)
        for key, steps in [('Shift+ArrowRight', 4), ('Shift+ArrowDown', 5)]:
            for _ in range(steps):
                await image_pick.press(key)
    else:
        box = await image_pick.bounding_box()
        mouse = image_pick.page.mouse
        await mouse.move(box['x'] + box['width'] * (81 + .5) / width, box['y'] + box['height'] * (34 + .5) / height)
        await mouse.down()
        secondary = {
            'pointerId': 200, 'pointerType': 'touch', 'isPrimary': False,
            'clientX': box['x'] + 5, 'clientY': box['y'] + 5,
        }
        await image_pick.dispatch_event('pointermove', secondary)
        await expect(region).to_have_attribute('data-x0', '81')
        await expect(region).to_have_attribute('data-y0', '34')
        await image_pick.dispatch_event('pointerup', secondary)
        await image_pick.dispatch_event('pointercancel', {**secondary, 'pointerId': 201})
        await mouse.move(box['x'] + box['width'] * (85 + .5) / width, box['y'] + box['height'] * (39 + .5) / height, steps=5)
        await mouse.up()
    area = await stats()
    if area[:2] != initial[:2] or area[4:] != (30, 'band', [81, 85, 34, 39]) or not all(
        value is not None and math.isclose(value, target, abs_tol=1e-8)
        for value, target in zip(area[2:4], [31.34733333333333, 3.3164563752428418])
    ):
        raise RuntimeError(f'Inclusive Cuprite ROI must report its 30 measured pixels, mean and population SD: {area}')
    await expect(envelope).to_have_attribute('d', re.compile(r'^M'))
    await expect(trace).not_to_have_attribute('d', start_trace)

    await mode.select_option('rgb')
    if (await stats())[-1] != area[-1]:
        raise RuntimeError('Returning to RGB should preserve the selected region')
    await bands.press('Home')
    first = await stats()
    if first[:2] != (0, 383.15) or first[-2:] != ('band', area[-1]):
        raise RuntimeError(f'Spectral slider Home should select the first valid physical band: {first}')
    await bands.press('End')
    last = await stats()
    if last[:2] != (125, 2508.20) or last[-2:] != ('band', area[-1]):
        raise RuntimeError(f'Spectral slider End should select the last valid physical band: {last}')
    await expect(spectrum).to_have_attribute('data-wavelength-min', '383.15')
    await expect(spectrum).to_have_attribute('data-wavelength-max', '2508.2')
    await pick(image_pick, (85 + .5) / width, (39 + .5) / height)
    await expect(envelope).to_have_count(0)
    await pick(spectrum_pick, (1391.82 - 383.15) / (2508.20 - 383.15), .5)
    before_gap = await stats()
    if before_gap[:2] != (53, 1351.98) or not math.isclose(before_gap[2], 49.76, abs_tol=1e-8):
        raise RuntimeError(f'Picking an excluded atmospheric band should select the physically nearest usable band: {before_gap}')
    await spectrum_pick.press('ArrowRight')
    after_gap = await stats()
    if after_gap[:2] != (57, 1471.50) or not math.isclose(after_gap[2], 45.115, abs_tol=1e-8):
        raise RuntimeError(f'Keyboard band navigation should skip the three unavailable bands: {after_gap}')
    await bands.fill('97')
    shoulder = await stats()
    if shoulder[:2] != (105, 2260.10) or shoulder[-1] != initial[-1] or not math.isclose(
        shoulder[2], 34.575, abs_tol=1e-8
    ):
        raise RuntimeError(f'Band ordinal 97 should show the measured 2260.10 nm shoulder: {shoulder}')


async def check_response_surface_pixels(viewport):
    await expect(viewport).to_be_visible()
    await expect(viewport).to_have_attribute('data-face-count', re.compile(r'^[1-9]\d*$'))
    width, height, drawn, tones = await viewport.evaluate("""async canvas => {
      await document.fonts.ready
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const { width, height } = canvas
      const pixels = canvas.getContext('2d').getImageData(0, 0, width, height).data
      const colors = new Set()
      let colored = 0
      for (let i = 0; i < pixels.length; i += 4) {
        if (!pixels[i + 3]) continue
        const [red, green, blue] = pixels.subarray(i, i + 3)
        if (Math.max(red, green, blue) - Math.min(red, green, blue) < 23) continue
        colored++
        colors.add((red << 16) | (green << 8) | blue)
      }
      return [width, height, colored, colors.size]
    }""")
    if min(width, height) < 100 or drawn < 300 or tones < 12:
        raise RuntimeError(f'Expected an actual color-filled response mesh, observed {width}×{height} with {drawn} pixels and {tones} tones')


async def check_compact_response_surface(card_plot):
    chart = card_plot.locator('[data-response-surface]')
    viewport = chart.locator('canvas[data-response-viewport]')
    await check_response_surface_pixels(viewport)
    await expect(viewport).to_have_attribute('data-face-count', '1352')
    await expect(viewport).to_have_attribute('data-trial-count', '0')
    clipped = await viewport.evaluate("""canvas => {
      const view = canvas.getBoundingClientRect()
      const card = canvas.closest('.card-plot').getBoundingClientRect()
      const fits = view.left >= card.left - 1 && view.right <= card.right + 1 &&
        view.top >= card.top - 1 && view.bottom <= card.bottom + 1
      return fits ? null : { view: view.toJSON(), card: card.toJSON() }
    }""")
    if clipped:
        raise RuntimeError(f'The compact response surface must fit the gallery card: {clipped}')
    await expect(chart.locator(
        'input, select, button, [data-response-map], [data-response-section], [data-response-readout]'
    )).to_have_count(0)


async def check_response_map_geometry(contour_map, predict):
    await expect(contour_map).to_be_visible()
    await expect(contour_map.locator('rect[data-response-map-frame]')).to_be_visible()
    await expect(contour_map.get_by_text('Heating temperature (°C)', exact=True)).to_be_visible()
    await expect(contour_map.get_by_text('Heating time (min)', exact=True)).to_be_visible()
    await expect(contour_map.get_by_text('Sphericity (%)', exact=True)).to_be_visible()
    await expect(contour_map.locator('path[data-response-map-domain]')).to_have_attribute('d', re.compile(r'^M'))
    levels, bands, covered, uncovered = await contour_map.evaluate("""svg => {
      const frame = svg.querySelector('[data-response-map-frame]')
      const pick = svg.querySelector('[data-response-map-pick]')
      const [xMin, xMax, yMin, yMax] = ['xMin', 'xMax', 'yMin', 'yMax'].map(key => Number(pick.dataset[key]))
      const [x, y, width, height] = ['x', 'y', 'width', 'height'].map(key => frame[key].baseVal.value)
      const fromFrame = frame.getCTM()
      const toFrame = fromFrame.inverse()
      const factor = ({ x: px, y: py }) => [
        xMin + (xMax - xMin) * (px - x) / width,
        yMax - (yMax - yMin) * (py - y) / height,
      ]
      const levels = Array.from(svg.querySelectorAll('path[data-response-map-contour]'), path => {
        const length = path.getTotalLength()
        const matrix = path.getCTM()
        return [Number(path.dataset.level), Array.from({ length: 25 }, (_, i) =>
          factor(path.getPointAtLength(length * i / 24).matrixTransform(matrix).matrixTransform(toFrame))
        )]
      })
      const paths = Array.from(svg.querySelectorAll('path[data-response-map-band]'))
      const bands = paths.map(path => [Number(path.dataset.low), Number(path.dataset.high), getComputedStyle(path).fill])
      const bandAt = ([xf, yf]) => {
        const local = new DOMPoint(x + width * (xf - xMin) / (xMax - xMin), y + height * (yMax - yf) / (yMax - yMin))
        const screen = local.matrixTransform(fromFrame)
        return paths.flatMap((path, index) => path.isPointInFill(screen.matrixTransform(path.getCTM().inverse())) ? [index] : [])
      }
      return [levels, bands, [[67, 31], [59, 27], [94, 30]].map(point => [...point, bandAt(point)]),
        [[41, 6], [99, 59]].map(bandAt)]
    }""")
    if len(levels) < 4 or len(bands) != len(levels) + 1 or len({band[2] for band in bands}) != len(bands):
        raise RuntimeError('The fitted surface map must draw distinct filled response bands separated by isolines')
    if any(not low < high or color == 'none' for low, high, color in bands) or any(
        not math.isclose(level, bands[index][1], abs_tol=1e-8)
        or not math.isclose(level, bands[index + 1][0], abs_tol=1e-8)
        for index, (level, _) in enumerate(levels)
    ):
        raise RuntimeError('Response bands and isolines must use the same strictly ordered fitted thresholds')
    hull = [(40, 32.5), (49, 13.1), (70, 5), (91, 13.1), (100, 32.5), (91, 52), (70, 60), (49, 52)]
    for level, points in levels:
        for x, y in points:
            if any(
                (bx - ax) * (y - ay) - (by - ay) * (x - ax) < -0.25
                for (ax, ay), (bx, by) in zip(hull, hull[1:] + hull[:1])
            ):
                raise RuntimeError(f'Response isoline {level} leaves the tested factor hull at {(x, y)}')
            if not math.isclose(predict(x, y), level, abs_tol=0.02):
                raise RuntimeError(f'Response isoline {level} must approximate the fitted value at {(x, y)}')
    for x, y, indices in covered:
        fitted = predict(x, y)
        if len(indices) != 1 or not bands[indices[0]][0] - 0.02 <= fitted <= bands[indices[0]][1] + 0.02:
            raise RuntimeError(f'Experiment point {(x, y)} must use the color band for fitted response {fitted}')
    if any(uncovered):
        raise RuntimeError('Unsampled factor corners must be outside the visible response fills')
    legend, map_view = await contour_map.evaluate("""async svg => {
      await document.fonts.ready
      await new Promise(resolve => requestAnimationFrame(resolve))
      const frame = svg.getBoundingClientRect()
      const values = [...svg.querySelectorAll('g.scientific-axis > text[y]')]
      const baseline = Math.max(...values.map(label => Number(label.getAttribute('y'))))
      const legend = values.filter(label => Number(label.getAttribute('y')) === baseline).map(label => {
        const box = label.getBoundingClientRect()
        return [Number(label.textContent), box.left, box.right]
      })
      return [legend, [frame.left, frame.right]]
    }""")
    if len(legend) < 2 or any(
        value_left >= value_right or end_left + 1 > start_right
        for (value_left, _, end_left), (value_right, start_right, _) in zip(legend, legend[1:])
    ) or any(start < map_view[0] - 1 or end > map_view[1] + 1 for _, start, end in legend):
        raise RuntimeError(f'Fitted response scale labels must be ordered, legible, and fit the chart: {legend}')


async def check_response_surface(plot, touch):
    chart = plot.locator('[data-response-surface]')
    viewport = chart.locator('canvas[data-response-viewport]')
    contour_map = chart.locator('svg[data-response-map]')
    map_probe = contour_map.locator('[data-response-map-probe]')
    map_pick = contour_map.locator('rect[data-response-map-pick]')
    section = chart.locator('svg[data-response-section]')
    trace = section.locator('path[data-response-section-path]')
    marker = section.locator('circle[data-response-section-marker]')
    target = section.locator('rect[data-response-section-pick]')
    readout = chart.locator('output[data-response-readout]')
    fixed = chart.get_by_role('combobox', name='Fixed factor', exact=True)
    position = chart.get_by_role('slider', name='Section position', exact=True)
    trial = chart.get_by_role('combobox', name='Trial', exact=True)
    rotate_left = chart.get_by_role('button', name='Rotate left', exact=True)
    rotate_right = chart.get_by_role('button', name='Rotate right', exact=True)
    await check_response_surface_pixels(viewport)
    await expect(viewport).to_have_attribute('data-face-count', '1352')
    await expect(viewport).to_have_attribute('data-trial-count', '11')
    await expect(section).to_be_visible()
    await expect(section.locator('rect[data-response-frame]')).to_be_visible()
    await expect(section.locator('.scientific-tick').first).to_be_attached()
    await expect(trace).to_have_attribute('d', re.compile(r'^M'))
    await expect(marker).to_be_visible()
    await expect(readout).to_be_visible()
    await expect(chart.locator('figcaption a').first).to_have_attribute('href', 'https://doi.org/10.3390/foods8110578')
    await expect(section.get_by_text('Heating time (min)', exact=True)).to_be_visible()
    await expect(section.get_by_text('Sphericity (%)', exact=True)).to_be_visible()
    await expect(fixed).to_have_value('x')
    await expect(target).to_have_attribute('data-min', '5')
    await expect(target).to_have_attribute('data-max', '60')

    async def selection():
        x, y, fit, axis, plane, id_, measured, residual = await readout.evaluate("""out => [
          ...['x','y','fitted'].map(key => Number(out.dataset[key])),
          out.dataset.axis, Number(out.dataset.position), out.dataset.trial, out.dataset.measured, out.dataset.residual
        ]""")
        if not all(map(math.isfinite, (x, y, fit, plane))):
            raise RuntimeError(f'Response selection must retain its calibrated factors and fitted value: {x}, {y}, {fit}, {plane}')
        await expect(section).to_have_attribute('data-axis', axis)
        if not math.isclose(plane, float(await section.get_attribute('data-position')), abs_tol=1e-8) or not math.isclose(
            plane, x if axis == 'x' else y, abs_tol=1e-8
        ):
            raise RuntimeError('Selected point and section coordinates should stay linked')
        await expect(fixed).to_have_value(axis)
        if not math.isclose(float(await position.input_value()), plane, abs_tol=1e-8):
            raise RuntimeError('The physical section slider should agree with the selected factor')
        coordinates = await marker.evaluate("mark => ['x','y','fitted'].map(key => Number(mark.dataset[key]))")
        if any(not math.isclose(actual, expected, abs_tol=1e-8) for actual, expected in zip(coordinates, [x, y, fit])):
            raise RuntimeError('Section marker and readout must represent the same fitted response')
        await expect(contour_map).to_have_attribute('data-axis', axis)
        map_position = float(await contour_map.get_attribute('data-position'))
        map_coordinates = await map_probe.evaluate("mark => ['x','y','fitted'].map(key => Number(mark.dataset[key]))")
        if any(not math.isclose(actual, expected, abs_tol=1e-8) for actual, expected in zip(
            [map_position, *map_coordinates], [plane, x, y, fit]
        )):
            raise RuntimeError('Contour probe, section plane and readout must remain synchronized')
        error = await section.evaluate("""svg => {
          const path = svg.querySelector('[data-response-section-path]')
          const mark = svg.querySelector('[data-response-section-marker]')
          const x = mark.cx.baseVal.value
          const y = mark.cy.baseVal.value
          let lower = 0
          let upper = path.getTotalLength()
          for (let i = 0; i < 22; i++) {
            const middle = (lower + upper) / 2
            if (path.getPointAtLength(middle).x < x) lower = middle
            else upper = middle
          }
          const nearest = path.getPointAtLength((lower + upper) / 2)
          return Math.hypot(nearest.x - x, nearest.y - y)
        }""")
        if error > 0.9:
            raise RuntimeError(f'Fitted section marker should lie on the visible response trace, observed {error}px separation')
        return x, y, fit, axis, plane, id_, float(measured) if measured is not None else None, float(residual) if residual is not None else None

    async def angles():
        result = await viewport.evaluate('canvas => [Number(canvas.dataset.yaw), Number(canvas.dataset.pitch)]')
        if not all(map(math.isfinite, result)):
            raise RuntimeError(f'Invalid response-surface camera state: {result}')
        return result

    async def image():
        return await viewport.evaluate("""async canvas => {
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
          return canvas.toDataURL()
        }""")

    def predict(x, y):
        u, v = (x - 70) / 30, (y - 32.5) / 27.5
        coefficients = [98.297022020586, -0.522681087942, -0.240539951291, -2.782882437407, -0.051321663937, -1.336001607748]
        return math.fsum(coefficient * predictor for coefficient, predictor in zip(coefficients, [1, u, v, u * u, u * v, v * v]))

    async def check_fit():
        result = await selection()
        x, y, fitted = result[:3]
        if not math.isclose(fitted, predict(x, y), abs_tol=1e-8):
            raise RuntimeError(f'Expected published-trial quadratic fit at {x}, {y}; observed {fitted}')
        return result

    async def pick(locator, point=None):
        if touch:
            await locator.tap(position=point)
        else:
            await locator.click(position=point)

    async def check_trial(id_, x, y, actual):
        result = await check_fit()
        if result[:2] != (x, y) or result[5] != id_ or result[6] != actual or not math.isclose(
            result[7], actual - predict(x, y), abs_tol=1e-8
        ):
            raise RuntimeError(f'Measured trial and signed residual should be linked to its fitted point: {result}')
        await expect(trial).to_have_value(id_)
        await expect(viewport).to_have_attribute('data-selected-trial', id_)
        point = section.locator(f'circle[data-response-trial][data-id="{id_}"]')
        await expect(point).to_have_attribute('data-measured', str(actual))
        if not math.isclose(float(await point.get_attribute('data-residual')), result[7], abs_tol=1e-8):
            raise RuntimeError('Section residual should match measured minus fitted')
        point_x, point_y = await point.evaluate('circle => [circle.cx.baseVal.value, circle.cy.baseVal.value]')
        fitted_y = float(await marker.get_attribute('cy'))
        if (point_y < fitted_y) != (result[7] > 0):
            raise RuntimeError('Trial marker should appear above the fit for positive residual and below for negative')
        segments = await section.locator('line[data-response-residual]').evaluate_all("""lines => lines.map(
          line => ['x1', 'x2', 'y1', 'y2'].map(key => line[key].baseVal.value)
        )""")
        expected_y = sorted([point_y, fitted_y])
        if not any(
            all(math.isclose(value, point_x, abs_tol=0.5) for value in line[:2])
            and all(math.isclose(value, expected, abs_tol=0.5) for value, expected in zip(sorted(line[2:]), expected_y))
            for line in segments
        ):
            raise RuntimeError('A rendered residual connector should span the fitted and measured points')
        return {
            'x': float(await viewport.get_attribute('data-trial-x')),
            'y': float(await viewport.get_attribute('data-trial-y')),
        }

    initial = await check_fit()
    if initial[:2] != (70, 32.5) or initial[3:] != ('x', 70, None, None, None):
        raise RuntimeError(f'Expected initial prediction at 70 °C and 32.5 min: {initial}')
    await check_response_map_geometry(contour_map, predict)
    await expect(map_probe).to_be_visible()
    await expect(map_pick).to_have_attribute('tabindex', '0')
    for dimension, lower, upper in [('x', '40', '100'), ('y', '5', '60')]:
        await expect(map_pick).to_have_attribute(f'data-{dimension}-min', lower)
        await expect(map_pick).to_have_attribute(f'data-{dimension}-max', upper)
    initial_angles = await angles()
    start_image = await image()
    await pick(rotate_right)
    yaw, pitch = await angles()
    if yaw == initial_angles[0] or pitch != initial_angles[1] or await check_fit() != initial or await image() == start_image:
        raise RuntimeError('Rotate right should redraw the 3D surface while preserving the fitted selection')
    await pick(rotate_left)
    restored = await angles()
    if any(not math.isclose(actual, expected, abs_tol=1e-8) for actual, expected in zip(restored, initial_angles)):
        raise RuntimeError('The two rotate buttons should undo each other')

    if not touch:
        await expect(viewport).to_have_attribute('tabindex', '0')
        await viewport.press('ArrowUp')
        yaw, pitch = await angles()
        if yaw != restored[0] or pitch == restored[1] or await check_fit() != initial:
            raise RuntimeError('ArrowUp should change only pitch and preserve the response')
        await viewport.press('ArrowDown')
        if not math.isclose((await angles())[1], restored[1], abs_tol=1e-8):
            raise RuntimeError('ArrowDown should reverse the pitch change')

    center_trace = await trace.get_attribute('d')
    await position.fill('60')
    moved = await check_fit()
    if moved[:2] != (60, 32.5) or moved[3] != 'x':
        raise RuntimeError(f'Changing section temperature should preserve heating time: {moved}')
    await expect(trace).not_to_have_attribute('d', center_trace)
    clipped_bounds = [float(await target.get_attribute(f'data-{end}')) for end in ('min', 'max')]
    expected_bounds = [5 + 8.1 * 10 / 21, 60 - 8 * 10 / 21]
    if any(not math.isclose(actual, expected, abs_tol=1e-8) for actual, expected in zip(clipped_bounds, expected_bounds)):
        raise RuntimeError(f'Fitted section should end at the sampled factor hull: {clipped_bounds}, expected {expected_bounds}')
    await fixed.select_option('y')
    await expect(section.get_by_text('Heating temperature (°C)', exact=True)).to_be_visible()
    await position.fill('25')
    linked = await check_fit()
    if linked[:2] != (60, 25) or linked[3] != 'y' or not math.isclose(linked[2], 98.12360406886233, abs_tol=1e-8):
        raise RuntimeError(f'Expected the fitted calibration point for 60 °C × 25 min: {linked}')

    await target.scroll_into_view_if_needed()
    box = await target.bounding_box()
    low, high = [float(await target.get_attribute(f'data-{end}')) for end in ('min', 'max')]
    expected_x = 75
    await pick(target, {'x': box['width'] * (expected_x - low) / (high - low), 'y': box['height'] * .5})
    projected = await check_fit()
    if not math.isclose(projected[0], expected_x, abs_tol=0.35) or projected[1] != 25 or projected[5] is not None:
        raise RuntimeError(f'Section click should vary temperature at a fixed heating time: {projected}')

    await trial.select_option('run-02')
    target_trial = await check_trial('run-02', 91, 13.1, 95.6)
    await trial.select_option('run-09')
    await check_trial('run-09', 70, 32.5, 98)
    await trial.select_option('run-11')
    await check_trial('run-11', 70, 32.5, 98.7)
    await pick(viewport, target_trial)
    await check_trial('run-02', 91, 13.1, 95.6)
    await pick(section.locator('circle[data-response-trial][data-id="run-01"]'))
    await check_trial('run-01', 49, 13.1, 96.6)
    await position.fill('25')
    prediction = await check_fit()
    if prediction[5:] != (None, None, None):
        raise RuntimeError('Moving off an observed trial should leave a model prediction without a measured value or residual')
    if not touch:
        await viewport.scroll_into_view_if_needed()
        box = await viewport.bounding_box()
        mouse = viewport.page.mouse
        x, y = box['x'] + box['width'] * .45, box['y'] + box['height'] * .45
        yaw, pitch = await angles()
        await mouse.move(x, y)
        await mouse.down()
        await mouse.move(x + 35, y - 20, steps=5)
        await mouse.up()
        next_yaw, next_pitch = await angles()
        if next_yaw <= yaw or next_pitch >= pitch or await check_fit() != prediction:
            raise RuntimeError('Dragging the surface should rotate both axes without changing the fitted point')

    async def map_offset(x, y):
        box = await map_pick.bounding_box()
        return {'x': box['width'] * (x - 40) / 60, 'y': box['height'] * (60 - y) / 55}

    async def map_section_points():
        return await contour_map.evaluate("""svg => {
          const frame = svg.querySelector('[data-response-map-frame]')
          const line = svg.querySelector('[data-response-map-section]')
          const [x, y, width, height] = ['x', 'y', 'width', 'height'].map(key => frame[key].baseVal.value)
          return [1, 2].map(index => [
            40 + 60 * (line['x' + index].baseVal.value - x) / width,
            60 - 55 * (line['y' + index].baseVal.value - y) / height,
          ])
        }""")

    await trial.select_option('run-11')
    await check_trial('run-11', 70, 32.5, 98.7)
    await expect(contour_map.locator('circle[data-response-map-trial]')).to_have_count(9)
    await expect(contour_map.locator('circle[data-response-map-trial][data-id="run-11"]')).to_be_visible()
    await pick(contour_map.locator('circle[data-response-map-trial][data-id="run-03"]'))
    await check_trial('run-03', 49, 52, 96.6)
    await pick(map_pick, await map_offset(60, 25))
    map_prediction = await check_fit()
    if map_prediction[3] != 'y' or map_prediction[5:] != (None, None, None) or not all(
        math.isclose(actual, expected, abs_tol=0.5) for actual, expected in zip(map_prediction[:2], [60, 25])
    ):
        raise RuntimeError(f'Picking a contour location must update both factors and leave trial mode: {map_prediction}')
    section_points = sorted(await map_section_points())
    lower, upper = [float(await target.get_attribute(f'data-{end}')) for end in ('min', 'max')]
    if any(
        not math.isclose(x, expected, abs_tol=0.01) or not math.isclose(y, map_prediction[1], abs_tol=0.01)
        for (x, y), expected in zip(section_points, [lower, upper])
    ):
        raise RuntimeError('The displayed section line must follow the fixed heating time within its sampled interval')
    await pick(map_pick, await map_offset(42, 7))
    if await check_fit() != map_prediction:
        raise RuntimeError('Picking an unsampled contour corner must leave the selection unchanged')

    await fixed.select_option('x')
    await map_pick.press('ArrowRight')
    await map_pick.press('ArrowUp')
    key_prediction = await check_fit()
    if key_prediction[3] != 'x' or not all(
        math.isclose(actual, expected, abs_tol=1e-8)
        for actual, expected in zip(key_prediction[:2], [map_prediction[0] + 0.6, map_prediction[1] + 0.55])
    ):
        raise RuntimeError(f'Contour keys must nudge both factors in their calibrated coordinates: {key_prediction}')
    section_points = sorted(await map_section_points())
    lower, upper = [float(await target.get_attribute(f'data-{end}')) for end in ('min', 'max')]
    if any(
        not math.isclose(y, expected, abs_tol=0.01) or not math.isclose(x, key_prediction[0], abs_tol=0.01)
        for (x, y), expected in zip(section_points, [lower, upper])
    ):
        raise RuntimeError('Changing fixed factor must rotate the linked section line and clip it to the new interval')

    if not touch:
        await map_pick.scroll_into_view_if_needed()
        box = await map_pick.bounding_box()
        start, end = await map_offset(61, 26), await map_offset(80, 42)
        mouse = map_pick.page.mouse
        await mouse.move(box['x'] + start['x'], box['y'] + start['y'])
        await mouse.down()
        await mouse.move(box['x'] + end['x'], box['y'] + end['y'], steps=5)
        try:
            dragged = await check_fit()
            if not all(math.isclose(actual, expected, abs_tol=0.5) for actual, expected in zip(dragged[:2], [80, 42])):
                raise RuntimeError(f'Dragging the contour map must continuously translate the section: {dragged}')
        finally:
            await mouse.up()


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


async def check_mirror_spectrum_plot(spectrum):
    await expect(spectrum).to_be_visible()
    await expect(spectrum.get_by_text('Mass-to-charge ratio, m/z', exact=True)).to_be_visible()
    await expect(spectrum.locator('[data-mirror-peak][data-spectrum="query"]')).to_have_count(23)
    await expect(spectrum.locator('[data-mirror-peak][data-spectrum="reference"]')).to_have_count(15)
    await expect(spectrum.locator('[data-mirror-pair]')).to_have_count(12)
    correct_geometry = await spectrum.evaluate("""svg => {
        const query = svg.querySelector('[data-mirror-peak][data-spectrum="query"][data-mz="109.0392"]');
        const reference = svg.querySelector('[data-mirror-peak][data-spectrum="reference"][data-mz="109.0392"]');
        return query.x1.baseVal.value === reference.x1.baseVal.value &&
            query.y2.baseVal.value < query.y1.baseVal.value &&
            query.y1.baseVal.value < reference.y1.baseVal.value &&
            reference.y1.baseVal.value < reference.y2.baseVal.value;
    }""")
    if not correct_geometry:
        raise RuntimeError('The mirror spectrum must align equal masses and draw opposing intensity sticks')


async def check_mass_spectrum_mirror(plot, touch):
    chart = plot.locator('figure[data-mass-spectrum-mirror]')
    spectrum = chart.locator('svg[data-mirror-spectrum-plot]')
    await check_mirror_spectrum_plot(spectrum)
    await expect(spectrum.get_by_text('Relative intensity (%)', exact=True)).to_be_visible()
    tolerance = chart.get_by_role('combobox', name='Fragment tolerance (m/z)', exact=True)
    fragment = chart.get_by_role('combobox', name='Inspect fragment', exact=True)
    readout = chart.locator('output[data-mirror-readout]')
    query_peak = spectrum.locator('[data-mirror-peak][data-spectrum="query"][data-mz="110.0718"]')
    reference_peak = spectrum.locator('[data-mirror-peak][data-spectrum="reference"][data-mz="110.0687"]')
    pair = spectrum.locator('[data-mirror-pair][data-query-mz="110.0718"][data-reference-mz="110.0687"]')

    async def check_pair(side):
        await expect(readout).to_have_attribute('data-active-spectrum', side)
        await expect(readout).to_have_attribute('data-status', 'paired')
        await expect(readout).to_have_attribute('data-query-mz', '110.0718')
        await expect(readout).to_have_attribute('data-reference-mz', '110.0687')
        await expect(readout).to_have_attribute('data-query-intensity', '22.6')
        await expect(readout).to_have_attribute('data-reference-intensity', '0.5')
        await expect(readout).to_contain_text('+0.0031 m/z')
        delta = float(await readout.get_attribute('data-delta-mz'))
        if not math.isclose(delta, 0.0031, abs_tol=1e-12):
            raise RuntimeError(f'Unexpected signed query minus reference m/z difference: {delta}')
        for mark in [query_peak, reference_peak, pair]:
            await expect(mark).to_have_attribute('data-selected', 'true')

    await expect(tolerance).to_have_value('0.02')
    await expect(readout).to_have_attribute('data-match-count', '12')
    await tolerance.focus()
    await tolerance.press('Tab')
    await expect(fragment).to_be_focused()
    await fragment.select_option('reference:110.0687')
    await check_pair('reference')
    await tolerance.select_option('0.002')
    await expect(readout).to_have_attribute('data-tolerance', '0.002')
    await expect(readout).to_have_attribute('data-match-count', '10')
    await expect(spectrum.locator('[data-mirror-pair]')).to_have_count(10)
    await expect(pair).to_have_count(0)
    await expect(reference_peak).to_have_attribute('data-selected', 'true')
    await expect(reference_peak).to_have_attribute('data-matched', 'false')
    await expect(query_peak).to_have_attribute('data-matched', 'false')
    await expect(readout).to_have_attribute('data-status', 'unmatched')
    await expect(readout).to_have_attribute('data-reference-mz', '110.0687')
    await expect(chart.locator('output[data-query-mz], output[data-delta-mz]')).to_have_count(0)

    pick = spectrum.locator('[data-mirror-pick="query"]')
    await pick.scroll_into_view_if_needed()
    position = await pick.evaluate("""rect => {
        const peak = rect.ownerSVGElement.querySelector('[data-spectrum="query"][data-mz="110.0718"]');
        const y = rect.y.baseVal.value + rect.height.baseVal.value / 2;
        const point = new DOMPoint(peak.x1.baseVal.value, y).matrixTransform(rect.getScreenCTM());
        const bounds = rect.getBoundingClientRect();
        return {x: point.x - bounds.left, y: point.y - bounds.top};
    }""")
    if touch:
        await pick.tap(position=position)
    else:
        await pick.click(position=position)
    await expect(fragment).to_have_value('query:110.0718')
    await expect(readout).to_have_attribute('data-status', 'unmatched')
    await expect(readout).to_have_attribute('data-query-mz', '110.0718')
    await expect(chart.locator('output[data-reference-mz], output[data-delta-mz]')).to_have_count(0)

    await tolerance.select_option('0.02')
    await expect(readout).to_have_attribute('data-match-count', '12')
    await expect(fragment).to_have_value('query:110.0718')
    await check_pair('query')


async def check_pca_plot(biplot):
    await expect(biplot).to_be_visible()
    await expect(biplot.locator('rect[data-pca-frame]')).to_be_visible()
    await expect(biplot.locator('[data-pca-row]')).to_have_count(214)
    await expect(biplot.locator('[data-pca-vector]')).to_have_count(9)
    await expect(biplot.get_by_text('PC1 scores (27.9%)', exact=True)).to_be_visible()
    await expect(biplot.get_by_text('PC2 scores (22.8%)', exact=True)).to_be_visible()


async def check_pca_biplot(plot, touch):
    chart = plot.locator('figure[data-pca-biplot]')
    biplot = chart.locator('svg[data-pca-plot]')
    await check_pca_plot(biplot)
    loading_axes = biplot.locator('[data-pca-loading-axes]')
    for label in ['PC1 loadings', 'PC2 loadings']:
        await expect(loading_axes.get_by_text(label, exact=True)).to_be_visible()
    projection = biplot.locator('[data-pca-projection]')
    await expect(projection).to_be_visible()
    cosine = await projection.evaluate("""group => {
        const [ray, drop] = Array.from(group.querySelectorAll('line'), line => [
            line.x2.baseVal.value - line.x1.baseVal.value,
            line.y2.baseVal.value - line.y1.baseVal.value,
        ]);
        return (ray[0] * drop[0] + ray[1] * drop[1]) / (Math.hypot(...ray) * Math.hypot(...drop));
    }""")
    if not math.isclose(cosine, 0, abs_tol=1e-6):
        raise RuntimeError(f'The specimen projection must meet the loading direction at a right angle: {cosine}')

    scaling = chart.get_by_role('combobox', name='Scaling', exact=True)
    variable = chart.get_by_role('combobox', name='Variable', exact=True)
    specimen = chart.get_by_role('combobox', name='Specimen', exact=True)
    readout = chart.locator('output[data-pca-readout]')
    source_rows = chart.locator('[data-pca-original-row]')
    row = biplot.locator('[data-pca-row="192"]')
    vector = biplot.locator('[data-pca-vector="mg"]')

    async def verify_readout(specimen_id, feature, observed, estimate, standardized):
        await expect(readout).to_have_attribute('data-pca-observation', specimen_id)
        await expect(readout).to_have_attribute('data-pca-variable', feature)
        await expect(readout).to_have_attribute('data-pca-observed', observed)
        await expect(source_rows).to_have_count(1)
        await expect(source_rows).to_have_attribute('data-pca-original-row', specimen_id)
        await expect(source_rows).to_have_attribute('data-pca-original-value', observed)
        expected = {'variance-x': 0.27901819179456444, 'variance-y': 0.22778579831670445,
                    'estimate': estimate, 'standardized': standardized}
        for metric, anchor in expected.items():
            measured = float(await readout.get_attribute(f'data-pca-{metric}'))
            if not math.isclose(measured, anchor, rel_tol=0, abs_tol=1e-8):
                raise RuntimeError(f'Unexpected PCA {metric} for specimen {specimen_id} and {feature}: {measured}')

    async def coordinates(mark, prefix):
        return [float(await mark.get_attribute(f'data-{prefix}-{axis}')) for axis in ['x', 'y']]

    await expect(scaling).to_have_value('scores')
    await expect(variable).to_have_value('mg')
    await expect(specimen).to_have_value('192')
    await scaling.focus()
    await scaling.press('Tab')
    await expect(variable).to_be_focused()
    await variable.press('Tab')
    await expect(specimen).to_be_focused()

    base_score = await coordinates(row, 'score')
    base_loading = await coordinates(vector, 'loading')
    singular_values = (23.127426870929245, 20.896539794260732)
    for mode, exponent in [('scores', 0), ('balanced', 0.5), ('loadings', 1)]:
        await scaling.select_option(mode)
        await expect(readout).to_have_attribute('data-pca-scaling', mode)
        await verify_readout('192', 'mg', '0', 0.38079808013727945, -1.5971451058975754)
        scores = await coordinates(row, 'score')
        loadings = await coordinates(vector, 'loading')
        length = float(await readout.get_attribute('data-pca-projection-length'))
        if not math.isclose(length, -1.5971451058975754 / math.hypot(*loadings), abs_tol=1e-8):
            raise RuntimeError(f'Unexpected signed projection length for {mode}: {length}')
        for score, loading, before_score, before_loading, singular in zip(scores, loadings, base_score, base_loading, singular_values):
            scale = singular ** exponent
            if not (math.isclose(score * scale, before_score, abs_tol=1e-8) and math.isclose(loading / scale, before_loading, abs_tol=1e-8)):
                raise RuntimeError(f'{mode} must scale specimen scores and loadings reciprocally')

    await variable.select_option('na')
    await verify_readout('192', 'na', '14.85', 14.365439543286799, 1.1726486730254957)
    await expect(biplot.locator('[data-pca-vector="na"]')).to_have_attribute('data-active', 'true')
    await variable.select_option('mg')
    await specimen.select_option('1')
    await verify_readout('1', 'mg', '4.49', 3.3204722719263553, 0.4408874812401634)

    if not touch:
        await scaling.select_option('scores')
        await biplot.locator('[data-pca-brush-target]').scroll_into_view_if_needed()
        isolated = biplot.locator('[data-pca-row="107"]')
        box = await isolated.bounding_box()
        x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
        mouse = chart.page.mouse
        await mouse.move(x - 7, y - 7)
        await mouse.down()
        try:
            await mouse.move(x + 7, y + 7, steps=4)
        finally:
            await mouse.up()
        await expect(biplot.locator('[data-pca-row][data-brushed="true"]')).to_have_count(1)
        await expect(isolated).to_have_attribute('data-brushed', 'true')
        await expect(specimen).to_have_value('107')
        await expect(source_rows).to_have_count(1)
        await expect(source_rows).to_have_attribute('data-pca-original-row', '107')
        await chart.get_by_role('button', name='Clear brush', exact=True).click()
        await expect(biplot.locator('[data-pca-row][data-brushed="true"]')).to_have_count(0)
        await expect(source_rows).to_have_attribute('data-pca-original-row', '107')


async def check_pareto_trials(plot, eligible, frontier):
    await expect(plot.locator('[data-pareto-trial]')).to_have_count(eligible)
    marks = plot.locator('[data-pareto-trial][data-frontier="true"]')
    await expect(marks).to_have_count(len(frontier))
    actual = await marks.evaluate_all('trials => trials.map(trial => trial.dataset.paretoTrial)')
    if set(actual) != set(frontier):
        raise RuntimeError(f'Unexpected nondominated trial IDs: {actual}, expected {frontier}')


async def check_initial_pareto_plot(plot, slug):
    turning = slug == 'pareto-frontier-turning'
    frontier = {'run-5', 'run-17', 'run-19', 'run-45', 'run-47'} if turning else {'rpm-11', 'rpm-16-5', 'rpm-22'}
    await expect(plot).to_have_attribute('data-view', 'boundary')
    await check_pareto_trials(plot, 54 if turning else 3, frontier)
    faces = await plot.locator('polygon[data-pareto-face]').evaluate_all("""polygons => polygons.map(face => [
        face.dataset.paretoFace, Array.from(face.points, ({x, y}) => [x, y]),
    ])""")
    if {axis for axis, _ in faces} != {'0', '1', '2'}:
        raise RuntimeError('The attainment boundary must render floors and both directions of risers')
    for _, vertices in faces:
        if len(vertices) != 4 or not all(map(math.isfinite, (value for vertex in vertices for value in vertex))):
            raise RuntimeError(f'Invalid attainment boundary facet: {vertices}')
        a, b, c, d = vertices
        if not all(math.isclose(a[axis] + c[axis], b[axis] + d[axis], abs_tol=0.002) for axis in (0, 1)):
            raise RuntimeError(f'Attainment boundary facet must project a rectangle: {vertices}')


async def check_pareto_frontier(preview, slug, touch):
    chart = preview.locator('figure[data-pareto-frontier]')
    plot = chart.locator('svg[data-pareto-plot]')
    await check_initial_pareto_plot(plot, slug)
    view = chart.get_by_role('combobox', name='View', exact=True)
    inspect = chart.get_by_role('combobox', name='Inspect trial', exact=True)
    counts = chart.locator('output[data-pareto-counts]')
    readout = chart.locator('output[data-pareto-readout]')
    cells = plot.locator('rect[data-pareto-section-cell]')

    async def count(eligible, nondominated, threshold):
        for name, value in [('eligible', eligible), ('nondominated', nondominated), ('threshold', threshold)]:
            await expect(counts).to_have_attribute(f'data-{name}', str(value))

    async def raw_trial(trial_id, values, frontier):
        await expect(readout).to_have_attribute('data-trial-id', trial_id)
        await expect(readout).to_have_attribute('data-frontier', 'true' if frontier else 'false')
        for axis, expected in zip('xyz', values):
            measured = float(await readout.get_attribute(f'data-value-{axis}'))
            if not math.isclose(measured, expected, rel_tol=0, abs_tol=1e-10):
                raise RuntimeError(f'Unexpected source value for {trial_id} objective {axis}: {measured}')

    if slug == 'pareto-frontier-oil-press':
        slider = chart.get_by_role('slider', name='Minimum feed oil removed', exact=True)
        labels = ['Feed rate ↑', 'Press energy ↓', 'Oil removed ↑'] if touch else [
            'Feed rate (kg/h) ↑', 'Specific press energy (kJ/kg feed) ↓', 'Feed oil removed (%) ↑',
        ]
        for label in labels:
            await expect(plot.get_by_text(label, exact=True)).to_be_visible()
        await count(3, 3, 34)
        await raw_trial('rpm-16-5', (1 / 0.65, 589, 43), True)
        await expect(readout).to_contain_text('589 kJ/kg feed')
        await view.select_option('section')
        await expect(plot).to_have_attribute('data-view', 'section')
        await expect(plot.get_by_text('Feed rate (kg/h) ↑', exact=True)).to_be_visible()
        await expect(plot.get_by_text('Specific press energy (kJ/kg feed) ↓', exact=True)).to_be_visible()
        await expect(cells.first).to_be_visible()
        await expect(plot.locator('[data-pareto-face]')).to_have_count(0)
        pick = plot.locator('[data-pareto-trial="rpm-22"] .pareto-hit')
        if touch:
            await pick.tap()
        else:
            await pick.click()
        await expect(inspect).to_have_value('rpm-22')
        await raw_trial('rpm-22', (1 / 0.60, 675, 34), True)
        await slider.press('ArrowRight')
        await expect(slider).to_be_focused()
        await count(2, 2, 43)
        await check_pareto_trials(plot, 2, {'rpm-11', 'rpm-16-5'})
        await slider.press('End')
        await count(1, 1, 55)
        await check_pareto_trials(plot, 1, {'rpm-11'})
        await raw_trial('rpm-11', (1 / 1.28, 992, 55), True)
        await expect(cells).to_have_count(1)
        snug_corner = await plot.evaluate("""svg => {
            const cell = svg.querySelector('[data-pareto-section-cell]');
            const frame = svg.querySelector('[data-pareto-section-frame]');
            const trial = svg.querySelector('[data-pareto-trial="rpm-11"] .pareto-hit');
            const {x, y, width, height} = cell.getBBox();
            const bounds = frame.getBBox();
            return Math.abs(x - trial.cx.baseVal.value) < 0.01 &&
                Math.abs(y + height - trial.cy.baseVal.value) < 0.01 &&
                Math.abs(x + width - bounds.x - bounds.width) < 0.01 && Math.abs(y - bounds.y) < 0.01;
        }""")
        if not snug_corner:
            raise RuntimeError('The one-trial section must extend only from its measured target corner toward worse objectives')
        return

    slider = chart.get_by_role('slider', name=re.compile(r'^Maximum surface roughness Ra$', re.I))
    group = chart.get_by_role('combobox', name='Trial group', exact=True)
    labels = ['Removal rate ↑', 'Cutting energy ↓', 'Roughness Ra ↓'] if touch else [
        'Material removal rate (cm³/min) ↑', 'Specific cutting energy (kWh/dm³) ↓', 'Surface roughness Ra (µm) ↓',
    ]
    for label in labels:
        await expect(plot.get_by_text(label, exact=True)).to_be_visible()
    await count(54, 5, 0.68)
    await inspect.select_option('run-1')
    await raw_trial('run-1', (30, 248.17 / 360, 0.30), False)
    await expect(readout).to_have_attribute('data-dominator', 'run-5')
    await inspect.select_option('run-5')
    await raw_trial('run-5', (30, 229.22 / 360, 0.30), True)
    await expect(chart.locator('output[data-pareto-readout][data-dominator]')).to_have_count(0)
    await slider.press('End')
    for _ in range(3):
        await slider.press('ArrowLeft')
    await count(7, 2, 0.30)
    await check_pareto_trials(plot, 7, {'run-5', 'run-17'})
    await slider.press('Home')

    await view.select_option('section')
    await expect(plot).to_have_attribute('data-view', 'section')
    await group.select_option('Dry')
    await count(27, 8, 0.68)
    await group.select_option('MQL')
    await count(27, 4, 0.68)
    await expect(cells.first).to_be_visible()
    await slider.press('End')
    await count(1, 1, 0.25)
    await check_pareto_trials(plot, 1, {'run-17'})
    await raw_trial('run-17', (20, 200.28 / 360, 0.25), True)

    await group.select_option('Dry')
    await count(0, 0, 0.25)
    await expect(chart.get_by_role('status').filter(has_text='No measured trial meets these filters.')).to_be_visible()
    await expect(readout).to_have_count(0)
    await expect(cells).to_have_count(0)


async def check_genealogy_plot(plot, orientation):
    await expect(plot).to_be_visible()
    await expect(plot).to_have_attribute('data-orientation', orientation)
    await expect(plot.locator('[data-genealogy-node][data-kind="lot"]')).to_have_count(11)
    await expect(plot.locator('[data-genealogy-node][data-kind="step"]')).to_have_count(5)
    await expect(plot.locator('[data-genealogy-edge]')).to_have_count(16)
    invalid_edges = await plot.evaluate("""svg => {
        const nodes = new Map(Array.from(svg.querySelectorAll('[data-genealogy-node]'), node =>
            [node.dataset.genealogyNode, node.dataset.kind]));
        const axis = svg.dataset.orientation === 'vertical' ? 'y' : 'x';
        return Array.from(svg.querySelectorAll('[data-genealogy-edge]')).flatMap(edge => {
            const {from, to} = edge.dataset;
            const start = edge.getPointAtLength(0);
            const end = edge.getPointAtLength(edge.getTotalLength());
            return nodes.has(from) && nodes.has(to) && nodes.get(from) !== nodes.get(to) && end[axis] > start[axis]
                ? [] : [[from, to]];
        });
    }""")
    if invalid_edges:
        raise RuntimeError(f'Material links must point forward between lots and process events: {invalid_edges}')


async def check_batch_genealogy(preview, touch):
    chart = preview.locator('figure[data-batch-genealogy]')
    plot = chart.locator('svg[data-genealogy-plot]')
    await check_genealogy_plot(plot, 'vertical' if touch else 'horizontal')
    root = chart.get_by_role('combobox', name='Trace from lot', exact=True)
    inspect = chart.get_by_role('combobox', name='Inspect record', exact=True)
    counts = chart.locator('output[data-genealogy-counts]')
    evidence = chart.locator('section[data-genealogy-evidence]')
    path = evidence.locator('[data-genealogy-path] [data-node-key]')
    context = evidence.locator('[data-genealogy-context]')

    def node(key):
        return plot.locator(f'[data-genealogy-node="{key}"]')

    def edge(start, end):
        return plot.locator(f'[data-genealogy-edge][data-from="{start}"][data-to="{end}"]')

    async def verify_counts(lot_id, upstream_lots, downstream_lots, upstream_steps, downstream_steps):
        await expect(counts).to_have_attribute('data-root', f'lot:{lot_id}')
        for name, expected in [('upstream-lots', upstream_lots), ('downstream-lots', downstream_lots),
                               ('upstream-steps', upstream_steps), ('downstream-steps', downstream_steps)]:
            await expect(counts).to_have_attribute(f'data-{name}', str(expected))

    async def verify_path(keys, direction):
        await expect(path).to_have_count(len(keys))
        actual = await path.evaluate_all('records => records.map(record => record.dataset.nodeKey)')
        if actual != keys:
            raise RuntimeError(f'Unexpected recorded {direction} path: {actual}, expected {keys}')
        await expect(plot.locator('[data-genealogy-edge][data-witness="true"]')).to_have_count(len(keys) - 1)
        for start, end in zip(keys, keys[1:]):
            record = edge(start, end)
            await expect(record).to_have_attribute('data-witness', 'true')
            await expect(record).to_have_attribute('data-relation', direction)

    await expect(root).to_have_value('HG-12-R2')
    await verify_counts('HG-12-R2', 3, 3, 2, 2)
    await expect(node('lot:HG-12-R2')).to_have_attribute('data-held', 'true')
    await expect(evidence.locator('[data-status="held"]')).to_have_text('Quality hold')
    await expect(node('lot:HG-12-R1')).to_have_attribute('data-relation', 'upstream')
    for key in ['lot:HG-13', 'lot:INS-04', 'lot:SE-09', 'lot:ASM-90', 'step:assemble-sibling']:
        await expect(node(key)).to_have_attribute('data-relation', 'context')
    await expect(edge('lot:INS-04', 'step:assemble')).to_have_attribute('data-relation', 'context')
    await root.press('Tab')
    await expect(inspect).to_be_focused()
    await inspect.select_option('lot:AL-17')
    await verify_path(['lot:AL-17', 'step:mill', 'lot:HG-12-R1', 'step:recoat', 'lot:HG-12-R2'], 'upstream')

    packed = node('lot:PK-31')
    await packed.evaluate("mark => mark.scrollIntoView({block: 'center', inline: 'nearest'})")
    if touch:
        await packed.tap(timeout=5000)
    else:
        await packed.click(timeout=5000)
    await expect(inspect).to_have_value('lot:PK-31')
    await expect(node('lot:PK-31')).to_have_attribute('data-inspected', 'true')
    await expect(evidence).to_have_attribute('data-genealogy-evidence', 'lot:PK-31')
    await verify_path(['lot:HG-12-R2', 'step:assemble', 'lot:ASM-26', 'step:pack', 'lot:PK-31'], 'downstream')

    assembly_time = '2026-10-14T10:05:00Z'
    await inspect.select_option('step:assemble')
    await expect(evidence.locator('time')).to_have_attribute('datetime', assembly_time)
    recorded_inputs = evidence.get_by_role('list', name='Recorded inputs', exact=True)
    recorded_outputs = evidence.get_by_role('list', name='Recorded outputs', exact=True)
    for ports, quantities in [(recorded_inputs, {'HG-12-R2': '64', 'INS-04': '64'}),
                              (recorded_outputs, {'ASM-26': '32', 'ASM-27': '32'})]:
        for lot_id, quantity in quantities.items():
            port = ports.locator(f'[data-genealogy-port="{lot_id}"]')
            await expect(port).to_have_attribute('data-quantity', quantity)
            await expect(port).to_have_attribute('data-unit', 'pcs')
    await recorded_inputs.get_by_role('button', name='INS-04', exact=True).press('Enter')
    await expect(evidence).to_have_attribute('data-genealogy-evidence', 'lot:INS-04')
    await expect(context).to_be_visible()
    await expect(path).to_have_count(0)
    await inspect.select_option('step:assemble-sibling')
    await expect(evidence.locator('time')).to_have_attribute('datetime', assembly_time)
    await expect(context).to_be_visible()
    await expect(evidence.locator('[data-genealogy-port="HG-13"]')).to_have_attribute('data-quantity', '32')

    await inspect.select_option('lot:ASM-90')
    await expect(evidence.locator('[data-status="released"]')).to_have_text('Released')
    await expect(context).to_be_visible()
    await evidence.get_by_role('button', name='Trace this lot', exact=True).press('Enter')
    await expect(root).to_have_value('ASM-90')
    await verify_counts('ASM-90', 3, 0, 2, 0)
    await expect(node('lot:HG-13')).to_have_attribute('data-relation', 'upstream')
    await expect(node('lot:HG-12-R2')).to_have_attribute('data-relation', 'context')
    await root.select_option('AL-17')
    await verify_counts('AL-17', 0, 7, 0, 5)
    for key in ['step:assemble', 'step:assemble-sibling', 'lot:ASM-26', 'lot:ASM-90', 'lot:PK-31']:
        await expect(node(key)).to_have_attribute('data-relation', 'downstream')


async def check_wafer_plot(wafer, slug):
    await expect(wafer).to_be_visible()
    measured = slug == 'spatial-defect-map-measured'
    await expect(wafer).to_have_attribute('data-row-direction', 'down' if measured else 'up')
    outline = wafer.locator('[data-wafer-outline]')
    await expect(outline).to_be_visible()
    await expect(outline).to_have_attribute('data-wafer-outline', 'observed' if measured else 'declared')
    await expect(outline).to_have_attribute('d', re.compile(r'^M'))
    clip = wafer.locator('clipPath path')
    if measured:
        await expect(clip).to_have_count(0)
    else:
        await expect(outline).to_have_attribute('data-notch-angle', '270')
        await expect(outline).to_have_attribute('d', re.compile(r'^M[^A]+A[^L]+L[^Z]+Z$'))
        await expect(clip).to_have_attribute('d', await outline.get_attribute('d'))


async def check_spatial_defect_map(preview, slug, touch):
    chart = preview.locator('figure[data-spatial-defect-map]')
    wafer = chart.locator('svg[data-wafer-plot]')
    await check_wafer_plot(wafer, slug)
    dies = wafer.locator('[data-wafer-die]')
    readout = chart.locator('output[data-wafer-readout]')
    counts = chart.locator('output[data-wafer-counts]')
    batch = chart.get_by_role('combobox', name='Batch', exact=True)
    wafer_choice = chart.get_by_role('combobox', name='Wafer', exact=True)
    keyboard = chart.get_by_role('group', name=re.compile(r'^Die map\b'))

    def die(row, column):
        return wafer.locator(f'[data-wafer-die="{row},{column}"]')

    async def count(wafer_id, pass_count, fail_count, untested=0, missing=0):
        tested = pass_count + fail_count
        total = tested + untested + missing
        expected = {'wafer-id': wafer_id, 'total': total, 'tested': tested, 'pass': pass_count,
                    'fail': fail_count, 'untested': untested, 'missing': missing}
        for name, value in expected.items():
            await expect(counts).to_have_attribute(f'data-{name}', str(value))
        await expect(dies).to_have_count(total)
        measured = float(await counts.get_attribute('data-yield'))
        if not math.isclose(measured, pass_count / tested * 100, abs_tol=1e-10):
            raise RuntimeError(f'Unexpected tested yield on {wafer_id}: {measured}')

    async def verify_site(row, column, x, y, status, cluster=None):
        await expect(readout).to_have_attribute('data-key', f'{row},{column}')
        await expect(wafer.locator('[data-wafer-cursor]')).to_have_attribute('data-wafer-cursor', f'{row},{column}')
        for mark in (die(row, column), readout):
            await expect(mark).to_have_attribute('data-row', str(row))
            await expect(mark).to_have_attribute('data-column', str(column))
            await expect(mark).to_have_attribute('data-status', status)
            for axis, value in [('x', x), ('y', y)]:
                measured = float(await mark.get_attribute(f'data-{axis}'))
                if not math.isclose(measured, value, rel_tol=0, abs_tol=1e-10):
                    raise RuntimeError(f'Die {row},{column} must retain physical {axis}={value}, observed {measured}')
        if cluster is not None:
            await expect(readout).to_have_attribute('data-cluster-size', str(cluster))
            await expect(wafer.locator('[data-wafer-cluster]')).to_have_attribute('data-wafer-cluster', str(cluster))

    async def pick(row, column):
        target = die(row, column)
        await target.evaluate("mark => mark.scrollIntoView({block: 'center', inline: 'nearest'})")
        if touch:
            await target.tap(timeout=5000)
        else:
            await target.click(timeout=5000)

    await expect(die(0, 0)).to_have_count(0)
    if slug == 'spatial-defect-map-measured':
        await expect(wafer.get_by_text('X (die pitch)', exact=True)).to_be_visible()
        await expect(wafer.get_by_text('Y (die pitch)', exact=True)).to_be_visible()
        await count('lot2-wafer20', 2145, 315)
        await expect(counts).to_have_attribute('data-wafer-pattern', 'Center')
        await verify_site(24, 29, 0, 2, 'fail', 80)
        await expect(readout).to_have_attribute('data-bin', 'electrical-fail')
        await expect(chart.get_by_role('combobox', name='Failure bin', exact=True)).to_have_count(0)
        await pick(0, 23)
        await verify_site(0, 23, -6, 26, 'fail')
        await keyboard.press('ArrowUp')
        await verify_site(0, 23, -6, 26, 'fail')
        await keyboard.press('ArrowDown')
        await verify_site(1, 23, -6, 25, 'fail')
        upper_svg_y = float(await die(0, 23).get_attribute('y'))
        lower_svg_y = float(await die(1, 23).get_attribute('y'))
        if upper_svg_y >= lower_svg_y:
            raise RuntimeError('Increasing raw measured row numbers must move down the plotted wafer')

        await batch.select_option('lot2')
        pattern = chart.get_by_role('combobox', name='Wafer pattern', exact=True)
        await pattern.select_option('Edge-Loc')
        await expect(wafer_choice).to_have_value('lot2-wafer12')
        await count('lot2-wafer12', 2241, 219)
        await verify_site(22, 55, 26, 4, 'fail', 50)
        await pick(0, 23)
        await verify_site(0, 23, -6, 26, 'pass')
        await batch.select_option('lot8')
        await expect(wafer_choice).to_have_value('lot8-wafer12')
        await expect(counts).to_have_attribute('data-wafer-pattern', 'Edge-Ring')
        await count('lot8-wafer12', 379, 154)
        await verify_site(24, 13, 0, -11, 'fail', 69)
        return

    await expect(wafer.get_by_text('X (mm)', exact=True)).to_be_visible()
    await expect(wafer.get_by_text('Y (mm)', exact=True)).to_be_visible()
    await count('sim-a-01', 204, 21, 5, 4)
    await verify_site(12, 16, 67.6, 37.8, 'fail', 12)
    await expect(wafer.locator('[data-status="untested"]')).to_have_count(5)
    await expect(wafer.locator('[data-status="missing"]')).to_have_count(4)
    footprint = await die(12, 16).evaluate('mark => mark.width.baseVal.value / mark.height.baseVal.value')
    if not math.isclose(footprint, 10.4 / 11.2, abs_tol=1e-6):
        raise RuntimeError(f'The die footprints must preserve the unequal physical pitches: {footprint}')
    await pick(4, 10)
    await verify_site(4, 10, 5.2, -51.8, 'missing')
    await expect(readout).to_contain_text('Missing record')
    await keyboard.press('ArrowUp')
    await verify_site(5, 10, 5.2, -40.6, 'pass')
    await keyboard.press('ArrowRight')
    await verify_site(5, 11, 15.6, -40.6, 'untested')
    await expect(readout).to_contain_text('Untested')

    outline = wafer.locator('[data-wafer-outline]')
    original_boundary = await outline.get_attribute('d')
    await chart.get_by_role('combobox', name='Failure bin', exact=True).select_option('bin:parametric-fail')
    await expect(counts).to_have_attribute('data-matching', '14')
    await expect(wafer.locator('[data-wafer-die][data-match="true"]')).to_have_count(14)
    await expect(wafer.locator('[data-wafer-die][data-bin="functional-fail"][data-dimmed="true"]')).to_have_count(7)
    await count('sim-a-01', 204, 21, 5, 4)
    await verify_site(5, 11, 15.6, -40.6, 'untested')
    await expect(outline).to_have_attribute('d', original_boundary)


async def chromatogram_geometry(svg, selector):
    return await svg.evaluate("""(plot, selector) => {
      const {timeMin, timeMax, signalMin, signalMax, plotLeft, plotRight, plotTop, plotBottom} = plot.dataset
      const time = x => +timeMin + (x - +plotLeft) * (+timeMax - +timeMin) / (+plotRight - +plotLeft)
      const signal = y => +signalMin + (+plotBottom - y) * (+signalMax - +signalMin) / (+plotBottom - +plotTop)
      return Array.from(plot.querySelectorAll(selector), path => ({
        sign: path.dataset.peakArea,
        vertices: Array.from(path.getAttribute('d').matchAll(/[ML]([-0-9e+.]+) ([-0-9e+.]+)/gi),
          ([, x, y]) => [time(+x), signal(+y)])
      }))
    }""", selector)


async def check_peak_integration_compact(preview):
    figure = preview.locator('figure[data-peak-integration][data-compact="true"]')
    overview = figure.locator('svg[data-peak-overview]')
    await expect(overview.locator('[data-integrated-peak]')).to_have_count(6)
    await expect(overview.locator('[data-integrated-peak]:has([data-peak-area="above"])')).to_have_count(6)
    await expect(overview.locator('[data-chromatogram-signal]')).to_have_attribute('d', re.compile(r'^M.*L'))
    await expect(figure.locator('[data-peak-handle], [data-peak-editor], button, input, select')).to_have_count(0)
    await check_compact_figure_bounds(overview, '[data-chromatogram-signal], [data-peak-area]')


async def check_peak_integration(preview, touch):
    figure = preview.locator('figure[data-peak-integration][data-compact="false"]')
    overview = figure.locator('svg[data-peak-overview]')
    editor = figure.locator('svg[data-peak-editor]')
    value = figure.locator('output[data-peak-value="peak-5"]')
    row = figure.locator('tr[data-peak-row="peak-5"]')
    await expect(overview.get_by_text('Retention time (min)', exact=True)).to_be_visible()
    await expect(overview.get_by_text('Detector response (source units)', exact=True)).to_be_visible()
    await expect(figure.get_by_role('link', name='Coffee LC–DAD dataset')).to_have_attribute(
        'href', 'https://doi.org/10.5281/zenodo.5412345'
    )
    await expect(figure.locator('[data-peak-row]')).to_have_count(6)
    await expect(editor.locator('[data-peak-handle]')).to_have_count(4)
    await expect(row).to_have_attribute('data-active', 'true')
    raw_signal = overview.locator('[data-chromatogram-signal]')
    await expect(raw_signal).to_have_attribute('d', re.compile(r'^M.*L'))
    original_signal = await raw_signal.get_attribute('d')
    [trace] = await chromatogram_geometry(overview, '[data-chromatogram-signal]')
    readings = [(round(time, 8), round(signal)) for time, signal in trace['vertices']]
    if len(readings) != 1501 or [readings[0], readings[750], readings[-1]] != [(12, 330072), (17, 235994), (22, 12730)]:
        raise RuntimeError('The chromatogram must retain the 1,501 native measurements and their minute scale')

    def close(actual, expected, description, tolerance=1e-5):
        if not math.isclose(actual, expected, rel_tol=0, abs_tol=tolerance):
            raise RuntimeError(f'{description}: expected {expected}, observed {actual}')

    def measured_at(time):
        for (a, ya), (b, yb) in zip(readings, readings[1:]):
            if time == a:
                return ya
            if time == b:
                return yb
            if a < time < b:
                return ya + (yb - ya) * (time - a) / (b - a)
        raise RuntimeError(f'Time {time} outside the measured chromatogram')

    async def check_area():
        keys = ['start', 'end', 'baseline-start', 'baseline-end', 'positive-area', 'negative-area',
                'signed-area', 'apex-time', 'apex-height']
        values = {key: float(await value.get_attribute('data-' + key)) for key in keys}
        start, end = values['start'], values['end']
        first, last = values['baseline-start'], values['baseline-end']
        def baseline(time):
            if time == start:
                return first
            if time == end:
                return last
            return first + (last - first) * (time - start) / (end - start)

        clipped = [(start, measured_at(start)), *[(t, y) for t, y in readings if start < t < end], (end, measured_at(end))]
        corrected = [(t, y - baseline(t)) for t, y in clipped]
        signed = sum((b - a) * (ya + yb) / 2 for (a, ya), (b, yb) in zip(corrected, corrected[1:]))
        close(values['signed-area'], signed, 'Independent signed trapezoidal area')
        apex_t, apex_height = max(corrected, key=lambda point: point[1])
        close(values['apex-time'], apex_t, 'Corrected apex retention')
        close(values['apex-height'], apex_height, 'Corrected apex height')

        fills = await chromatogram_geometry(editor, '[data-peak-area]')
        sums = {'above': 0, 'below': 0}
        for fill in fills:
            direction = 1 if fill['sign'] == 'above' else -1
            points = [(time - start, signal - baseline(time)) for time, signal in fill['vertices']]
            if any(direction * signal < -1e-6 for _, signal in points):
                raise RuntimeError(f'Integrated polygon crossed the stated {fill["sign"]} side of its baseline')
            sums[fill['sign']] += direction * abs(sum(a * yb - ya * b for (a, ya), (b, yb)
                in zip(points, points[1:] + points[:1])) / 2)
        close(sums['above'], values['positive-area'], 'Positive polygon area in data coordinates')
        close(sums['below'], values['negative-area'], 'Negative polygon area in data coordinates')
        for (a, ya), (b, yb) in zip(corrected, corrected[1:]):
            if min(abs(ya), abs(yb)) < 1e-7 or ya * yb >= 0:
                continue
            time = a + (b - a) * ya / (ya - yb)
            for sign in ('above', 'below'):
                if not any(abs(x - time) < 1e-8 and abs(y - baseline(time)) < 1e-5
                           for fill in fills if fill['sign'] == sign for x, y in fill['vertices']):
                    raise RuntimeError(f'{sign} polygon misses the interpolated baseline crossing at {time}')
        await expect(raw_signal).to_have_attribute('d', original_signal)
        return values

    async def drag(handle, coordinate, expected):
        await editor.evaluate("plot => plot.scrollIntoView({block: 'center'})")
        grip = editor.locator(f'[data-peak-handle="{handle}"]')
        position = await grip.evaluate("""(mark, [coordinate, value]) => {
          const plot = mark.ownerSVGElement
          const {timeMin, timeMax, signalMin, signalMax, plotLeft, plotRight, plotTop, plotBottom} = plot.dataset
          const matrix = plot.getScreenCTM()
          const start = new DOMPoint(0, 0).matrixTransform(mark.getScreenCTM())
          const x = +plotLeft + (value - +timeMin) * (+plotRight - +plotLeft) / (+timeMax - +timeMin)
          const y = +plotBottom - (value - +signalMin) * (+plotBottom - +plotTop) / (+signalMax - +signalMin)
          const end = new DOMPoint(x, y).matrixTransform(matrix)
          return {
            start: [start.x, start.y],
            end: coordinate === 'time' ? [end.x, start.y] : [start.x, end.y],
            tolerance: coordinate === 'time'
              ? 1.75 * (+timeMax - +timeMin) / ((+plotRight - +plotLeft) * matrix.a)
              : 1.75 * (+signalMax - +signalMin) / ((+plotBottom - +plotTop) * matrix.d)
          }
        }""", [coordinate, expected])
        page = editor.page
        start, end = position['start'], position['end']
        browser = page.context.browser
        if touch and browser and browser.browser_type.name == 'chromium':
            session = await page.context.new_cdp_session(page)
            try:
                await session.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': start[0], 'y': start[1]}]})
                await session.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': end[0], 'y': end[1]}]})
                await session.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
            finally:
                await session.detach()
        else:
            await page.mouse.move(*start)
            await page.mouse.down()
            await page.mouse.move(*end, steps=5)
            await page.mouse.up()
        close(float(await value.get_attribute('data-' + handle)), expected, 'Handle edit in physical plot units', position['tolerance'])

    initial = await check_area()
    for key, expected in {'start': 19.48666667, 'end': 19.96, 'baseline-start': 140742, 'baseline-end': 357436,
                          'apex-time': 19.78666667, 'apex-height': 112297.73142717523, 'positive-area': 23127.12714624097,
                          'negative-area': -1066.193451175666, 'signed-area': 22060.933695065305}.items():
        close(initial[key], expected, f'Measured Peak 5 {key}')
    await expect(value).to_have_attribute('data-area-mode', 'above')
    await expect(value).to_contain_text('source units × min')
    close(float(await row.get_attribute('data-area')), initial['positive-area'], 'Positive area in result table')

    await drag('start', 'time', 19.55)
    moved_boundary = await check_area()
    close(moved_boundary['baseline-start'], measured_at(moved_boundary['start']), 'Boundary follows measured signal')
    await drag('baseline-start', 'signal', 175000)
    manual = await check_area()
    close(manual['baseline-end'], moved_boundary['baseline-end'], 'Opposite anchor unchanged')
    finish = figure.get_by_role('spinbutton', name='End (min)', exact=True)
    await finish.fill('19.93')
    await finish.press('Enter')
    edited = await check_area()
    close(edited['end'], 19.93, 'Exact keyboard boundary')
    close(edited['baseline-start'], manual['baseline-start'], 'Manually fixed start anchor after boundary edit')

    await figure.get_by_role('combobox', name='Area measure', exact=True).select_option('signed')
    await expect(value).to_have_attribute('data-area-mode', 'signed')
    close(float(await row.get_attribute('data-area')), edited['signed-area'], 'Signed area in result table')
    await figure.get_by_role('button', name='Use signal endpoints', exact=True).click()
    endpoint = await check_area()
    close(endpoint['baseline-start'], measured_at(endpoint['start']), 'Use recorded start signal')
    close(endpoint['baseline-end'], measured_at(endpoint['end']), 'Use recorded end signal')

    await figure.get_by_role('button', name='Reset region', exact=True).click()
    reset = await check_area()
    if reset != initial:
        raise RuntimeError('Reset must restore the original interval, baseline, and measured areas')
    peak_two = figure.get_by_role('button', name='Peak 2', exact=True)
    await (peak_two.tap() if touch else peak_two.click())
    await expect(figure.locator('[data-peak-row="peak-2"]')).to_have_attribute('data-active', 'true')
    await expect(figure.locator('output[data-peak-value="peak-2"]')).to_have_attribute('data-start', '14.49333333')


async def check_gauge_rr_compact(preview):
    chart = preview.locator('figure[data-gauge-rr][data-compact="true"]')
    matrix = chart.locator('svg[data-gauge-matrix]')
    await expect(matrix.locator('[data-gauge-cell]')).to_have_count(30)
    await expect(matrix.locator('[data-gauge-reading]')).to_have_count(60)
    await expect(chart.locator('select, button, [data-gauge-cell-summary], [data-gauge-variance]')).to_have_count(0)
    await check_compact_figure_bounds(matrix, '.gauge-cell-background, [data-gauge-reading]')


async def check_gauge_rr(preview, slug, touch):
    corrected = slug == 'gauge-rr-thread-corrected'
    if corrected:
        initial = ('P4', 'O2', [0.5841, 0.5842], 0.5840833333333333)
        selected_readings = [0.5842, 0.5841]
        switched_readings = [0.5841, 0.584]
        switched_operator = [0.58405, 0.58395]
        sums_of_squares = [1.0104166666666667e-7, 5.833333333333333e-10, 5.6083333333333336e-8, 7.875e-8]
        raw_variances = [1.3518518518518518e-9, -1.412037037037037e-10, 2.4537037037037037e-10, 2.625e-9]
    else:
        initial = ('P2', 'O1', [0.58365, 0.58375], 0.5839)
        selected_readings = [0.5841, 0.58415]
        switched_readings = [0.58385, 0.5838]
        switched_operator = [0.5837, 0.58365]
        sums_of_squares = [1.053375e-6, 1.3258333333333333e-7, 2.6075e-7, 6.375e-8]
        raw_variances = [1.7092592592592593e-8, 2.590277777777778e-9, 6.180555555555556e-9, 2.125e-9]

    chart = preview.locator('figure[data-gauge-rr][data-compact="false"]')
    matrix = chart.locator('svg[data-gauge-matrix]')
    inspection = chart.get_by_role('region', name='Inspect crossed readings')
    cell_summary = inspection.locator('[data-gauge-cell-summary]')
    part_select = inspection.get_by_role('combobox', name='Part', exact=True)
    operator_select = inspection.get_by_role('combobox', name='Operator', exact=True)
    scale = chart.get_by_role('combobox', name='Scale', exact=True)
    variance = chart.locator('[data-gauge-variance]')
    variance_summary = variance.locator('[data-gauge-variance-summary]')

    def close(actual, expected, tolerance=1e-12):
        if not math.isclose(float(actual), expected, rel_tol=0, abs_tol=tolerance):
            raise RuntimeError(f'{slug}: expected {expected}, observed {actual}')

    async def check_cell(part, operator, values):
        await expect(part_select).to_have_value(part)
        await expect(operator_select).to_have_value(operator)
        await expect(cell_summary).to_have_attribute('data-part', part)
        await expect(cell_summary).to_have_attribute('data-operator', operator)
        await expect(matrix.locator(f'[data-gauge-cell][data-part="{part}"][data-operator="{operator}"]')).to_have_attribute(
            'data-active', 'true')
        await expect(matrix.locator('[data-gauge-cell][data-active="true"]')).to_have_count(1)
        await expect(inspection.locator('[data-gauge-trial]')).to_have_count(2)
        for trial, value in enumerate(values, start=1):
            row = inspection.locator(f'[data-gauge-trial="{trial}"]')
            await expect(row.get_by_role('rowheader', name=str(trial), exact=True)).to_be_visible()
            await expect(row.get_by_role('cell', name=str(value), exact=True)).to_be_visible()
            close(await row.get_attribute('data-recorded'), value)
            source = matrix.locator(f'[data-part="{part}"][data-operator="{operator}"] [data-gauge-reading="{trial}"]')
            close(await source.get_attribute('data-recorded'), value)
            part_mean = float(await cell_summary.get_attribute('data-part-mean'))
            close(await row.get_attribute('data-deviation'), value - part_mean)
        close(await cell_summary.get_attribute('data-mean'), math.fsum(values) / len(values))
        close(await cell_summary.get_attribute('data-range'), max(values) - min(values))

    async def check_matrix(mode):
        await expect(matrix).to_have_attribute('data-scale', mode)
        domain, cells = await matrix.evaluate("""svg => [
          [Number(svg.dataset.min), Number(svg.dataset.max)],
          [...svg.querySelectorAll('[data-gauge-cell]')].map(cell => ({
            part: cell.dataset.part, operator: cell.dataset.operator,
            xMin: Number(cell.dataset.xMin), xMax: Number(cell.dataset.xMax),
            readings: [...cell.querySelectorAll('[data-gauge-reading]')].map(mark => ({
              trial: mark.dataset.gaugeReading, value: Number(mark.dataset.recorded),
              plotted: Number(mark.dataset.plotted), x: Number(mark.getAttribute('cx')), y: Number(mark.getAttribute('cy')),
            })),
          })),
        ]""")
        values = {(cell['part'], cell['operator'], point['trial']): point['value']
                  for cell in cells for point in cell['readings']}
        if len(cells) != 30 or len(values) != 60 or sum(len(cell['readings']) for cell in cells) != 60:
            raise RuntimeError(f'{slug}: expected the complete 10 × 3 × 2 crossed study')
        part_means = {part: math.fsum(value for (part_id, _, _), value in values.items() if part_id == part) / 6
                      for part in {cell['part'] for cell in cells}}
        if mode == 'part-centered':
            close(domain[0], -domain[1])
            close(await matrix.get_attribute('data-reference'), 0)
        else:
            close(await matrix.get_attribute('data-reference'), math.fsum(values.values()) / len(values))
        for cell in cells:
            if [point['trial'] for point in cell['readings']] != ['1', '2']:
                raise RuntimeError(f'{slug}: trials lost their within-cell order')
            if cell['readings'][0]['y'] >= cell['readings'][1]['y']:
                raise RuntimeError(f'{slug}: repeat marks must occupy distinct trial lanes')
            for point in cell['readings']:
                expected = point['value'] - part_means[cell['part']] if mode == 'part-centered' else point['value']
                reading = domain[0] + (point['x'] - cell['xMin']) / (cell['xMax'] - cell['xMin']) * (domain[1] - domain[0])
                close(point['plotted'], expected)
                close(reading, expected)
        return values

    await expect(matrix.locator('[data-gauge-part]')).to_have_count(10)
    await expect(matrix.locator('[data-gauge-operator]')).to_have_count(3)
    await expect(chart.get_by_role('link', name='CC BY 4.0', exact=True)).to_have_attribute(
        'href', 'https://creativecommons.org/licenses/by/4.0/')
    await expect(chart.get_by_role('link', name='Published workbook', exact=True)).to_have_attribute(
        'href', 'https://www.mdpi.com/article/10.3390/metrology6040081/s1')
    await expect(chart.locator('figcaption a').first).to_have_attribute('href', 'https://doi.org/10.3390/metrology6040081')
    await check_cell(*initial[:3])
    close(await cell_summary.get_attribute('data-part-mean'), initial[3])
    raw = await check_matrix('part-centered')
    fraction = await variance_summary.get_attribute('data-fraction')
    await scale.select_option('measured')
    if await check_matrix('measured') != raw:
        raise RuntimeError(f'{slug}: changing display scale altered the recorded readings')
    await check_cell(*initial[:3])
    await expect(variance_summary).to_have_attribute('data-fraction', fraction)
    await scale.select_option('part-centered')
    await expect(matrix).to_have_attribute('data-scale', 'part-centered')

    target = matrix.locator('[data-gauge-cell][data-part="P8"][data-operator="O3"] .gauge-cell-background')
    await (target.tap(timeout=8000) if touch else target.click(timeout=8000))
    await check_cell('P8', 'O3', selected_readings)
    await part_select.select_option('P10')
    await check_cell('P10', 'O3', switched_readings)
    await operator_select.select_option('O2')
    await check_cell('P10', 'O2', switched_operator)

    components = dict(zip(['part', 'operator', 'interaction', 'repeatability'], map(lambda value: max(0, value), raw_variances)))
    gauge = math.fsum(components[term] for term in ['operator', 'interaction', 'repeatability'])
    total = math.fsum(components.values())
    for attribute, expected in [('measurement-variance', gauge), ('total-variance', total),
                                ('reproducibility-variance', components['operator'] + components['interaction'])]:
        close(await variance_summary.get_attribute(f'data-{attribute}'), expected, 1e-20)
    close(await variance_summary.get_attribute('data-gauge-sd'), math.sqrt(gauge))
    close(fraction, gauge / total)

    for mode, amounts in [
        ('total', {'part': components['part'], 'gauge': gauge}),
        ('gauge', {term: components[term] for term in ['repeatability', 'operator', 'interaction']}),
    ]:
        partition = variance.locator(f'[data-gauge-partition="{mode}"]')
        total_amount = math.fsum(amounts.values())
        close(await partition.get_attribute('data-denominator'), total_amount, 1e-20)
        await expect(partition.locator('[data-variance-segment]')).to_have_count(len(amounts))
        position = 0
        for term, amount in amounts.items():
            segment = partition.locator(f'[data-variance-segment="{term}"]')
            width = float(await segment.get_attribute('width'))
            close(await segment.get_attribute('data-variance'), amount, 1e-20)
            close(await segment.get_attribute('x'), position, 1e-8)
            close(width, 100 * amount / total_amount, 1e-8)
            position += width
        close(position, 100, 1e-8)

    await expect(variance.locator('[data-gauge-clamped]')).to_have_count(int(corrected))
    if corrected:
        await expect(variance.locator('[data-gauge-clamped]')).to_contain_text('Operator:')
    await variance.get_by_text('ANOVA table', exact=True).click(timeout=8000)
    for term, df, ss, raw_variance in zip(components, [9, 2, 18, 30], sums_of_squares, raw_variances):
        component = variance.locator(f'[data-gauge-term="{term}"]')
        close(await component.get_attribute('data-raw-variance'), raw_variance, 1e-20)
        close(await component.get_attribute('data-variance'), components[term], 1e-20)
        await expect(component).to_be_visible()
        row = variance.locator(f'[data-gauge-anova="{term}"]')
        await expect(row).to_be_visible()
        await expect(row).to_have_attribute('data-df', str(df))
        close(await row.get_attribute('data-ss'), ss, 1e-18)
        close(await row.get_attribute('data-ms'), ss / df, 1e-18)


# Independent NumPy covariance and SciPy F-quantile results for NASA Milling Wear, case 11.
HOTELLING_LIMIT = 56.9832811930556
HOTELLING_SCORES = (
    10.27786484847716, 6.436386282089163, 13.54188260763852, 26.610009611843438, 16.12406782322151,
    37.044669085277896, 64.27440858113651, 52.09463786314467, 122.43901743025754, 153.23749965754803,
    100.72157626395779, 296.92288070709265, 198.68150976162292, 336.6773260690498, 295.2420628826139,
)


def check_hotelling_number(actual, expected):
    assert math.isclose(float(actual), expected, rel_tol=2e-10, abs_tol=1e-9), (actual, expected)


async def check_hotelling_sequence(chart):
    sequence = chart.locator('svg[data-hotelling-sequence]')
    await expect(sequence.locator('[data-hotelling-run][data-flagged="true"]')).to_have_count(8)
    await expect(sequence.locator('.hotelling-stem')).to_have_count(15)
    await expect(sequence.locator('.hotelling-run-dot')).to_have_count(15)
    dimensions, ucl, marks = await sequence.evaluate('''svg => {
        const numbers = (el, ...names) => names.map(name => Number(el.getAttribute(name)));
        const dimensions = numbers(svg, 'data-plot-left', 'data-plot-right', 'data-plot-top', 'data-plot-bottom', 'data-y-max');
        const ucl = numbers(svg.querySelector('[data-hotelling-limit]'), 'data-hotelling-limit', 'x1', 'x2', 'y1', 'y2');
        const marks = [...svg.querySelectorAll('[data-hotelling-run]')].map(mark => [
            mark.dataset,
            numbers(mark.querySelector('.hotelling-stem'), 'x1', 'x2', 'y1', 'y2'),
            numbers(mark.querySelector('.hotelling-run-dot'), 'cx', 'cy'),
        ]);
        return [dimensions, ucl, marks];
    }''')
    left, right, top, bottom, y_max = dimensions
    await expect(sequence).to_have_attribute('data-scale', 'linear')

    def y(score):
        return bottom - (bottom - top) * score / y_max

    for actual, expected in zip(ucl, (HOTELLING_LIMIT, left, right, y(HOTELLING_LIMIT), y(HOTELLING_LIMIT))):
        check_hotelling_number(actual, expected)
    for index, ((data, stem, dot), score) in enumerate(zip(marks, HOTELLING_SCORES)):
        assert data['hotellingRun'] == f'Pass {index + 9:02}' and int(data['order']) == index + 1, data
        assert (data['flagged'] == 'true') == (score > HOTELLING_LIMIT), data
        check_hotelling_number(data['score'], score)
        x = left + (right - left) * (index + 0.5) / len(HOTELLING_SCORES)
        for actual, expected in zip(stem + dot, (x, x, bottom, y(score), x, y(score))):
            check_hotelling_number(actual, expected)
    return sequence


async def check_hotelling_compact(plot):
    chart = plot.locator('figure[data-hotelling-monitor][data-compact="true"]')
    await expect(chart).to_be_visible()
    sequence = await check_hotelling_sequence(chart)
    await check_compact_figure_bounds(sequence, '.hotelling-run-dot, .hotelling-stem, [data-hotelling-limit]')
    projection = chart.locator('svg[data-hotelling-projection]')
    await expect(projection.locator('[data-hotelling-reference]')).to_have_count(8)
    await expect(projection.locator('[data-hotelling-projected-run]')).to_have_attribute('data-hotelling-projected-run', 'Pass 15')
    await check_compact_figure_bounds(projection, '[data-hotelling-boundary], [data-hotelling-reference], [data-hotelling-projected-run]')
    await expect(chart.locator('button, select, .hotelling-target, [data-hotelling-readout]')).to_have_count(0)


async def check_hotelling_projection(projection, channel_x, channel_y, rho, z):
    await expect(projection).to_have_attribute('data-channel-x', channel_x)
    await expect(projection).to_have_attribute('data-channel-y', channel_y)
    check_hotelling_number(await projection.get_attribute('data-rho'), rho)
    left, right, top, bottom, extent = [float(await projection.get_attribute(f'data-{name}'))
                                       for name in ('plot-left', 'plot-right', 'plot-top', 'plot-bottom', 'extent')]
    check_hotelling_number(right - left, bottom - top)
    boundary = projection.locator('[data-hotelling-boundary]')
    check_hotelling_number(await boundary.get_attribute('data-hotelling-boundary'), HOTELLING_LIMIT)

    def to_data(x, y):
        return (-extent + (float(x) - left) * 2 * extent / (right - left),
                -extent + (bottom - float(y)) * 2 * extent / (bottom - top))

    def projected_score(x, y):
        return (x * x - 2 * rho * x * y + y * y) / (1 - rho * rho)

    path = await boundary.get_attribute('d')
    coordinates = re.findall(r'[ML]([-+.\deE]+) ([-+.\deE]+)', path)
    assert len(coordinates) == 96 and path.endswith('Z'), path
    for point in coordinates:
        check_hotelling_number(projected_score(*to_data(*point)), HOTELLING_LIMIT)
    selected = projection.locator('[data-hotelling-projected-run="Pass 15"][data-flagged="true"]')
    await expect(selected).to_be_visible()
    center = to_data(await selected.get_attribute('cx'), await selected.get_attribute('cy'))
    for actual, expected in zip(center, z):
        check_hotelling_number(actual, expected)
    reference = projection.locator('[data-hotelling-reference]')
    assert await reference.evaluate_all('marks => marks.map(mark => mark.dataset.hotellingReference)') == [
        f'Pass {index:02}' for index in range(1, 9)
    ]
    return projected_score(*center)


async def check_hotelling(plot, touch):
    chart = plot.locator('figure[data-hotelling-monitor][data-compact="false"]')
    sequence = await check_hotelling_sequence(chart)
    run = chart.get_by_role('combobox', name='Run', exact=True)
    await expect(run).to_have_value('Pass 15')
    await expect(run.locator('optgroup[label="Above limit"] option')).to_have_count(8)
    await expect(run.locator('optgroup[label="At or below limit"] option')).to_have_count(7)
    readout = chart.locator('[data-hotelling-readout="Pass 15"]')
    await expect(readout).to_contain_text('Above limit')
    check_hotelling_number(await readout.get_attribute('data-score'), HOTELLING_SCORES[6])
    check_hotelling_number(await readout.get_attribute('data-limit'), HOTELLING_LIMIT)
    check_hotelling_number(await readout.get_attribute('data-alpha'), .01)

    evidence = chart.locator('[data-hotelling-contributions="Pass 15"]')
    expected_rows = [
        ('AE_table', 64.25158739370939, .194369958948, .14147552207675002, 7.734482898128582),
        ('vib_spindle', 4.897323240135478, .273740641276, .29691246880412503, -2.4742509868996225),
        ('smcAC', -4.874502052708352, -.164986165365, -.173954038266875, 2.260235400282637),
    ]
    rows = evidence.locator('[data-hotelling-contribution]')
    await expect(rows).to_have_count(3)
    terms = []
    for index, (channel, *values) in enumerate(expected_rows):
        row = rows.nth(index)
        await expect(row).to_have_attribute('data-hotelling-contribution', channel)
        for key, expected in zip(('value', 'observed', 'baseline', 'z'), values):
            check_hotelling_number(await row.get_attribute(f'data-{key}'), expected)
        term = float(await row.get_attribute('data-value'))
        terms.append(term)
        bar = row.locator('[data-hotelling-bar]')
        await expect(bar).to_have_attribute('data-negative', str(term < 0).lower())
        width, start = await bar.evaluate('bar => [parseFloat(bar.style.inlineSize), parseFloat(bar.style.insetInlineStart)]')
        expected_width = 50 * abs(term) / abs(terms[0])
        # Browsers round serialized style percentages.
        assert math.isclose(width, expected_width, abs_tol=5e-5), (width, expected_width)
        expected_start = 50 - expected_width if term < 0 else 50
        assert math.isclose(start, expected_start, abs_tol=5e-5), (start, expected_start)
    check_hotelling_number(math.fsum(terms), HOTELLING_SCORES[6])
    check_hotelling_number(await evidence.get_attribute('data-sum'), HOTELLING_SCORES[6])

    projection = chart.locator('svg[data-hotelling-projection]')
    ae, vibration, current = [row[-1] for row in expected_rows]
    await check_hotelling_projection(projection, 'AE_table', 'vib_spindle', -.17478763219702326, (ae, vibration))
    x_axis = chart.get_by_role('combobox', name='Projection X', exact=True)
    y_axis = chart.get_by_role('combobox', name='Projection Y', exact=True)
    await x_axis.select_option('0')
    projected = await check_hotelling_projection(projection, 'smcAC', 'vib_spindle', -.4437716419622971, (current, vibration))
    check_hotelling_number(projected, 7.80395188330718)
    assert projected < HOTELLING_LIMIT < HOTELLING_SCORES[6], projected
    await y_axis.select_option('0')
    await expect(x_axis).to_have_value('1')
    await expect(y_axis).to_have_value('0')
    await expect(readout).to_have_attribute('data-flagged', 'true')
    check_hotelling_number(await readout.get_attribute('data-score'), HOTELLING_SCORES[6])

    await run.select_option('Pass 09')
    within = chart.locator('[data-hotelling-readout="Pass 09"]')
    await expect(within).to_contain_text('At or below limit')
    check_hotelling_number(await within.get_attribute('data-score'), HOTELLING_SCORES[0])
    await expect(projection.locator('[data-hotelling-projected-run="Pass 09"][data-flagged="false"]')).to_be_visible()
    await expect(chart.locator('[data-hotelling-contributions="Pass 09"]')).to_be_visible()
    last = sequence.locator('[data-hotelling-run="Pass 23"]')
    target = last.locator('.hotelling-target')
    await target.evaluate("mark => mark.scrollIntoView({block: 'center'})")
    await (target.tap(timeout=5000) if touch else target.click(timeout=5000))
    await expect(last).to_have_attribute('data-active', 'true')
    await expect(run).to_have_value('Pass 23')
    check_hotelling_number(await chart.locator('[data-hotelling-readout="Pass 23"]').get_attribute('data-score'), HOTELLING_SCORES[-1])
    sources = chart.locator('figcaption')
    for label, url in [
        ('NASA Milling Wear, Case 11', 'https://data.nasa.gov/dataset/milling-wear'),
        ('Measurement archive and readme', 'https://data.nasa.gov/docs/legacy/mill.zip'),
        ('NIST Phase II method', 'https://www.itl.nist.gov/div898/handbook/pmc/section5/pmc5434.htm'),
    ]:
        await expect(sources.get_by_role('link', name=label, exact=True)).to_have_attribute('href', url)
    page = plot.page
    provenance = 'licenses/NASA-Milling-Wear-Data.txt'
    notices = await page.request.get(urljoin(page.url, 'THIRD_PARTY_NOTICES.md'))
    assert notices.ok and f'({provenance})' in await notices.text()
    data_notice = await page.request.get(urljoin(page.url, provenance))
    assert data_notice.ok and 'https://www.usa.gov/government-copyright' in await data_notice.text()



def classifier_holdout_reference():
    fixture = CATALOG.parent / 'charts/scientific/classifier-threshold/fixture.ts'
    records = re.findall(r'^  \[(\d+), (\d+\.\d+), ([01])\],$', fixture.read_text(encoding='utf-8'), re.M)
    assert len(records) == 359 and len({row for row, _, _ in records}) == 359
    positives = [float(score) for _, score, failed in records if failed == '1']
    negatives = [float(score) for _, score, failed in records if failed == '0']
    assert (len(positives), len(negatives)) == (22, 337)

    thresholds = [math.inf, *sorted(set(positives + negatives), reverse=True)]
    # Recount directly at every cutoff instead of mirroring the component's incremental sweep.
    points = []
    for threshold in thresholds:
        tp = sum(score >= threshold for score in positives)
        fp = sum(score >= threshold for score in negatives)
        points.append((tp, fp, len(positives) - tp, len(negatives) - fp))
    roc_auc = math.fsum((a > b) + 0.5 * (a == b) for a in positives for b in negatives) / (22 * 337)
    average_precision = math.fsum(points[thresholds.index(score)][0] / sum(points[thresholds.index(score)][:2])
                                  for score in positives) / 22
    initial = sum(score >= 0.25 for score in thresholds[1:])
    return thresholds, points, roc_auc, average_precision, initial


async def check_classifier_threshold_compact(plot):
    chart = plot.locator('figure[data-classifier-threshold][data-compact="true"]')
    await expect(chart).to_be_visible()
    for kind in ('roc', 'pr'):
        curve = chart.locator(f'svg[data-classifier-curve="{kind}"]')
        await expect(curve.locator('[data-classifier-trace]')).to_have_attribute('d', re.compile(r'^M.+[LV]'))
        await expect(curve.locator('[data-classifier-marker] circle')).to_be_visible()
        await check_compact_figure_bounds(curve, '[data-classifier-trace], [data-classifier-marker] circle')
    matrix = chart.locator('svg.classifier-compact-matrix')
    await expect(matrix.locator('rect')).to_have_count(4)
    await check_compact_figure_bounds(matrix, 'rect')
    await expect(chart.locator('input, button, select, a, [role="slider"], [data-classifier-readout]')).to_have_count(0)


async def check_classifier_threshold(plot, touch):
    chart = plot.locator('figure[data-classifier-threshold][data-compact="false"]')
    cutoff = chart.get_by_role('slider', name='Decision threshold')
    roc, pr = [chart.locator(f'svg[data-classifier-curve="{kind}"]') for kind in ('roc', 'pr')]
    matrix = chart.get_by_role('table', name='Confusion matrix')
    readout = chart.locator('[data-classifier-readout]')
    thresholds, points, auc, ap, initial = classifier_holdout_reference()
    await expect(chart).to_have_attribute('data-positives', '22')
    await expect(chart).to_have_attribute('data-negatives', '337')
    await expect(cutoff).to_have_attribute('max', str(len(thresholds) - 1))
    for element, attribute, expected in [(chart, 'data-roc-auc', auc), (chart, 'data-average-precision', ap),
                                         (pr, 'data-baseline', 22 / 359)]:
        actual = float(await element.get_attribute(attribute))
        assert math.isclose(actual, expected, abs_tol=1e-12), (attribute, actual, expected)
    await expect(roc).to_have_attribute('data-baseline', 'diagonal')
    await expect(matrix.get_by_role('columnheader').first).to_have_text('Actual outcome')

    async def check_operating_point(index):
        tp, fp, fn, tn = points[index]
        recall, false_positive_rate = tp / 22, fp / 337
        precision = tp / (tp + fp) if tp + fp else None
        await expect(cutoff).to_have_value(str(index))
        for curve, x, y in [(roc, false_positive_rate, recall), (pr, recall, precision)]:
            await expect(curve).to_have_attribute('data-selected-index', str(index))
            marker = curve.locator('[data-classifier-marker]')
            if y is None:
                await expect(marker).to_have_count(0)
            else:
                await expect(marker.locator('circle')).to_be_visible()
                for attribute, expected in [('data-x', x), ('data-y', y)]:
                    actual = float(await marker.get_attribute(attribute))
                    assert math.isclose(actual, expected, abs_tol=1e-12), (attribute, actual, expected)
        values = await matrix.locator('[data-classifier-cell]').evaluate_all(
            'cells => Object.fromEntries(cells.map(cell => [cell.dataset.classifierCell, Number(cell.dataset.count)]))'
        )
        assert values == {'tp': tp, 'fp': fp, 'fn': fn, 'tn': tn}, (index, values)
        await expect(readout).to_have_attribute('data-classifier-readout', str(index))
        if index == 0:
            await expect(readout).to_have_attribute('data-threshold', 'none')
            await expect(readout).to_have_attribute('data-precision', 'undefined')
            await expect(readout).to_contain_text('Undefined')
        else:
            observed = float(await readout.get_attribute('data-threshold'))
            assert observed == thresholds[index], (observed, thresholds[index])

    await check_operating_point(initial)
    await cutoff.press('Home')
    await check_operating_point(0)
    await cutoff.press('End')
    await check_operating_point(len(points) - 1)
    await cutoff.press('ArrowLeft')
    await check_operating_point(len(points) - 2)

    if not touch:
        # Click the visible ROC vertex for the initial threshold, using axis endpoints from the SVG.
        await roc.scroll_into_view_if_needed()
        tp, fp, _, _ = points[initial]
        position = await roc.evaluate("""(svg, [fpr, tpr]) => {
          const axis = svg.querySelector('.classifier-axis')
          const start = axis.getPointAtLength(0)
          const end = axis.getPointAtLength(axis.getTotalLength())
          const marker = new DOMPoint(start.x + fpr * (end.x - start.x), end.y - tpr * (end.y - start.y))
          const screen = marker.matrixTransform(svg.getScreenCTM())
          return {x: screen.x, y: screen.y}
        }""", [fp / 337, tp / 22])
        await plot.page.mouse.click(position['x'], position['y'])
        await check_operating_point(initial)

    sources = chart.locator('figcaption')
    await expect(sources.locator('a[href="https://doi.org/10.24432/C54305"]')).to_be_visible()
    await expect(sources).to_contain_text(re.compile('October 2008', re.I))
    await expect(sources).to_contain_text(re.compile('uncalibrated', re.I))
    page = plot.page
    provenance = 'licenses/UCI-SECOM-CC-BY-4.0.txt'
    notices = await page.request.get(urljoin(page.url, 'THIRD_PARTY_NOTICES.md'))
    assert notices.ok and f'({provenance})' in await notices.text()
    data_notice = await page.request.get(urljoin(page.url, provenance))
    assert data_notice.ok and 'https://creativecommons.org/licenses/by/4.0/legalcode' in await data_notice.text()


async def check_fault_replay_compact(plot):
    chart = plot.locator('figure[data-fault-replay][data-compact="true"]')
    await expect(chart).to_be_visible()
    timeline = chart.locator('svg[data-replay-timeline]')
    for selector, count in [
        ('[data-replay-trace]', 3), ('[data-replay-state-mark]', 10),
        ('[data-replay-alarm-mark]', 5), ('[data-replay-action-mark]', 9),
    ]:
        await expect(timeline.locator(selector)).to_have_count(count)
    await expect(timeline.locator('[data-replay-cursor]')).to_have_attribute('data-time', '3540')
    await check_compact_figure_bounds(
        timeline, '[data-replay-trace], [data-replay-state-mark] rect, [data-replay-alarm-mark], '
        '[data-replay-action-mark], [data-replay-cursor]'
    )
    await expect(chart.locator('button, input, select, a, [data-replay-snapshot], .fault-replay-ledger')).to_have_count(0)


async def check_fault_replay(plot, touch):
    chart = plot.locator('figure[data-fault-replay][data-compact="false"]')
    timeline = chart.locator('svg[data-replay-timeline]')
    cursor = timeline.locator('[data-replay-cursor]')
    snapshot = chart.locator('[data-replay-snapshot]')
    slider = chart.get_by_role('slider', name='Replay time')
    previous = chart.get_by_role('button', name='Previous event')
    following = chart.get_by_role('button', name='Next event')
    play = chart.get_by_role('button', name='Play replay')
    pause = chart.get_by_role('button', name='Pause replay')
    clock = chart.locator('[data-replay-clock]')
    ledger = chart.get_by_role('region', name='Incident event log')
    raise_event = ledger.locator('[data-replay-event="raised:fic301-164"]')
    clear_event = ledger.locator('[data-replay-event="cleared:fic301-164"]')
    restores = ledger.locator('[data-replay-event="action:v11-169"]')

    async def check_cursor(time, state, sample_time, alarms=0):
        await expect(cursor).to_have_attribute('data-time', str(time))
        await expect(snapshot).to_have_attribute('data-time', str(time))
        await expect(snapshot).to_have_attribute('data-state', state)
        await expect(snapshot).to_have_attribute('data-alarm-count', str(alarms))
        for signal in ('air-pressure', 'air-flow', 'controller-output'):
            reading = snapshot.locator(f'[data-replay-reading="{signal}"]')
            await expect(reading).to_have_attribute('data-sample-time', str(sample_time))
            await expect(reading).to_have_attribute('data-status', 'recorded')
        left, right = [float(await timeline.get_attribute(f'data-{edge}')) for edge in ('left', 'right')]
        mark = float(await cursor.get_attribute('x1'))
        assert math.isclose(mark, left + time / 4200 * (right - left), abs_tol=1e-6), (time, mark)

    await expect(chart).to_have_attribute('data-playing', 'false')
    await check_cursor(3540, 'v11-state-3540', 3540)
    await expect(clock).to_have_text('59:00 / 1:10:00')
    await expect(snapshot.locator('[data-replay-last-action="v11-161"]')).to_be_visible()
    for signal, value in [('air-pressure', 6.8461), ('air-flow', 78.5436), ('controller-output', 100)]:
        reading = snapshot.locator(f'[data-replay-reading="{signal}"]')
        await expect(reading).to_have_attribute('data-value', str(value))
    await expect(ledger.locator('button[aria-current="time"]')).to_have_count(2)

    await previous.click()
    await check_cursor(3060, 'v11-state-3060', 3060)
    await following.click()
    await check_cursor(3540, 'v11-state-3540', 3540)
    await following.click()
    await check_cursor(4020, 'v11-state-4020', 4020)
    await expect(restores).to_have_attribute('aria-current', 'time')

    await raise_event.click()
    await check_cursor(993.725, 'v11-state-660', 990, alarms=1)
    await expect(snapshot.locator('[data-replay-active-alarm="fic301-164"]')).to_be_visible()
    await expect(raise_event).to_have_attribute('aria-current', 'time')
    await clear_event.click()
    await check_cursor(1153.724, 'v11-state-1140', 1150)
    await expect(snapshot.locator('[data-replay-active-alarm="fic301-164"]')).to_have_count(0)
    await expect(clear_event).to_have_attribute('aria-current', 'time')

    await slider.press('Home')
    await check_cursor(0, 'v11-state-0', 0)
    await expect(previous).to_be_disabled()
    await expect(snapshot.locator('[data-replay-last-action]')).to_have_count(0)
    await slider.press('End')
    await check_cursor(4200, 'v11-state-4020', 4200)
    await expect(following).to_be_disabled()

    if not touch:
        await timeline.scroll_into_view_if_needed()
        position = await timeline.evaluate("""svg => {
          const left = Number(svg.dataset.left)
          const right = Number(svg.dataset.right)
          const mark = new DOMPoint((left + right) / 2, 64).matrixTransform(svg.getScreenCTM())
          return {x: mark.x, y: mark.y}
        }""")
        await plot.page.mouse.click(position['x'], position['y'])
        time = float(await cursor.get_attribute('data-time'))
        assert abs(time - 2100) <= 5, time
        assert float(await snapshot.get_attribute('data-time')) == time

    await slider.press('Home')
    await chart.get_by_role('combobox', name=re.compile(r'^Speed')).select_option('600')
    await play.click()
    await expect(chart).to_have_attribute('data-playing', 'true')
    await expect(snapshot).not_to_have_attribute('data-time', '0')
    await pause.click()
    await expect(chart).to_have_attribute('data-playing', 'false')
    paused_time = await snapshot.get_attribute('data-time')
    await plot.page.wait_for_timeout(100)
    await expect(cursor).to_have_attribute('data-time', paused_time)
    await expect(snapshot).to_have_attribute('data-time', paused_time)
    await restores.click()
    await play.click()
    await check_cursor(4200, 'v11-state-4020', 4200)
    await expect(chart).to_have_attribute('data-playing', 'false')

    sources = chart.locator('figcaption')
    await expect(sources.locator('a[href="https://doi.org/10.5281/zenodo.1341583"]')).to_be_visible()
    await expect(sources).to_contain_text(re.compile('Cranfield.*Test 3', re.I))
    await expect(sources).to_contain_text(re.compile('minute-resolution operation log', re.I))
    page = plot.page
    provenance = 'licenses/PRONTO-CC-BY-4.0.txt'
    notices = await page.request.get(urljoin(page.url, 'THIRD_PARTY_NOTICES.md'))
    assert notices.ok and f'({provenance})' in await notices.text()
    data_notice = await page.request.get(urljoin(page.url, provenance))
    assert data_notice.ok and 'https://creativecommons.org/licenses/by/4.0/legalcode' in await data_notice.text()


async def check_startup_overlay_compact(plot):
    chart = plot.locator('figure[data-startup-overlay][data-compact="true"]')
    await expect(chart).to_be_visible()
    await expect(chart).to_have_attribute('data-count', '30')
    traces = chart.locator('svg[data-startup-traces]')
    readiness = chart.locator('svg[data-startup-readiness]')
    await expect(traces.locator('[data-startup-signal]')).to_have_count(2)
    await expect(traces.locator('[data-startup-band]')).to_have_count(4)
    await expect(traces.locator('[data-startup-median]')).to_have_count(4)
    await expect(traces.locator('[data-startup-selected="op001-test001"]')).to_have_count(2)
    await expect(traces.locator('[data-startup-individual]')).to_have_count(0)
    await expect(readiness.locator('circle.startup-readiness-mark')).to_have_count(30)
    await expect(readiness.locator('[data-startup-run="op001-test001"]')).to_have_attribute('data-selected', 'true')
    await check_compact_figure_bounds(
        traces, '[data-startup-band], [data-startup-selected], [data-startup-median], [data-startup-zero]'
    )
    await check_compact_figure_bounds(readiness, '.startup-readiness-mark, [data-startup-deadline]')
    await expect(chart.locator('button, input, select, a, .startup-hit, [data-startup-selection]')).to_have_count(0)


async def check_startup_overlay(plot, touch):
    chart = plot.locator('figure[data-startup-overlay][data-compact="false"]')
    deadline = chart.get_by_role('slider', name='Comparison deadline')
    selector = chart.get_by_role('combobox', name=re.compile('^Inspect a run'))
    counts = chart.get_by_role('list', name='Current outcome counts')
    traces = chart.locator('svg[data-startup-traces]')
    readiness = chart.locator('svg[data-startup-readiness]')
    selection = chart.locator('output[data-startup-selection]')
    initial = 'op001-test001'

    async def check_groups(seconds, on_time, late):
        await expect(chart).to_have_attribute('data-deadline', str(seconds))
        for outcome, number in [('on-time', on_time), ('late', late)]:
            await expect(readiness.locator(f'[data-startup-run][data-startup-outcome="{outcome}"]')).to_have_count(number)
            group = counts.locator(f'[data-startup-outcome="{outcome}"]')
            await expect(group).to_have_count(int(number > 0))
            if number:
                await expect(group).to_have_attribute('data-count', str(number))

    async def check_selected(run, seconds, outcome):
        await expect(selector).to_have_value(run)
        await expect(selection).to_have_attribute('data-startup-selection', run)
        await expect(selection).to_have_attribute('data-ready-after', str(seconds))
        await expect(selection).to_have_attribute('data-startup-outcome', outcome)
        mark = readiness.locator(f'[data-startup-run="{run}"]')
        await expect(mark).to_have_attribute('data-selected', 'true')
        await expect(mark).to_have_attribute('data-time', str(seconds))
        await expect(readiness.locator('[data-startup-run][data-selected="true"]')).to_have_count(1)
        left, right, horizon = [float(await readiness.get_attribute(f'data-{key}')) for key in ('left', 'right', 'horizon')]
        position = float(await mark.locator('circle.startup-readiness-mark').get_attribute('cx'))
        assert math.isclose(position, left + seconds / horizon * (right - left), abs_tol=1e-6), (run, position)
        paths = []
        for signal in ('T703', 'T705'):
            strip = traces.locator(f'[data-startup-signal="{signal}"]')
            individual = await strip.locator(f'[data-startup-individual="{run}"]').get_attribute('d')
            chosen = strip.locator(f'[data-startup-selected="{run}"]')
            assert individual and individual.startswith('M'), (run, signal)
            await expect(chosen).to_have_attribute('d', individual)
            paths.append(individual)
        return paths

    await expect(chart).to_have_attribute('data-count', '30')
    await expect(selector.locator('option')).to_have_count(30)
    await expect(readiness.locator('[data-startup-run][data-observed="true"]')).to_have_count(30)
    await expect(traces.locator('[data-startup-individual]')).to_have_count(60)
    await expect(traces).to_have_attribute('data-window-start', '0')
    await expect(traces).to_have_attribute('data-window-end', '6000')
    await expect(traces.locator('[data-startup-zero]')).to_have_count(2)
    left = await traces.get_attribute('data-left')
    for mark in await traces.locator('[data-startup-zero]').all():
        await expect(mark).to_have_attribute('x1', left)
    await expect(traces.get_by_text(re.compile('reboiler', re.I))).to_be_visible()
    await expect(traces.get_by_text(re.compile('column.top', re.I))).to_be_visible()
    await check_groups(2700, 16, 14)
    initial_paths = await check_selected(initial, 5783, 'late')

    await deadline.press('Home')
    await check_groups(0, 0, 30)
    assert await check_selected(initial, 5783, 'late') == initial_paths
    await expect(traces.locator('[data-startup-outcome="on-time"]')).to_have_count(0)

    await deadline.press('End')
    await check_groups(6000, 30, 0)
    assert await check_selected(initial, 5783, 'on-time') == initial_paths
    await expect(traces.locator('[data-startup-outcome="late"]')).to_have_count(0)

    early_run = 'op001-test003'
    await selector.select_option(early_run)
    assert await check_selected(early_run, 1640, 'on-time') != initial_paths

    gap_run = 'op001-test011'
    await selector.select_option(gap_run)
    gap_paths = await check_selected(gap_run, 3048, 'on-time')
    assert all(path.count('M') == 2 for path in gap_paths), 'The recorded gap must split each sensor trace'
    if not touch:
        latest = readiness.locator(f'[data-startup-run="{initial}"] .startup-hit')
        await latest.click()
        assert await check_selected(initial, 5783, 'on-time') == initial_paths

    sources = chart.locator('figcaption')
    await expect(sources.locator('a[href="https://zenodo.org/records/22250958"], a[href="https://doi.org/10.5281/zenodo.22250958"]')).to_be_visible()
    await expect(sources).to_contain_text(re.compile('CC BY 4.0', re.I))
    await expect(sources).to_contain_text('first archived startup timestamp')
    await expect(sources).to_contain_text('first archived operation timestamp')
    page = plot.page
    provenance = 'licenses/Arweiler-Batch-Distillation-CC-BY-4.0.txt'
    notices = await page.request.get(urljoin(page.url, 'THIRD_PARTY_NOTICES.md'))
    assert notices.ok and f'({provenance})' in await notices.text()
    data_notice = await page.request.get(urljoin(page.url, provenance))
    assert data_notice.ok and 'https://creativecommons.org/licenses/by/4.0/' in await data_notice.text()


async def check_cumulative_flow_compact(plot):
    chart = plot.locator('figure[data-cumulative-flow][data-compact="true"]')
    await expect(chart).to_be_visible()
    diagram = chart.locator('svg[data-flow-plot]')
    await expect(diagram.locator('[data-flow-band="completed"]')).to_have_count(1)
    await expect(diagram.locator('[data-flow-band="stage"]')).to_have_count(5)
    coordinates = r'[-+0-9.eE]+'
    closed_steps = re.compile(rf'^M{coordinates},{coordinates}(?:H{coordinates}V{coordinates})+V{coordinates}(?:V{coordinates}H{coordinates})+Z$')
    for band in await diagram.locator('[data-flow-band]').all():
        await expect(band).to_have_attribute('d', closed_steps)
    await expect(diagram.locator('[data-flow-cursor]')).to_have_attribute('data-time', '9.692904')
    await check_compact_figure_bounds(diagram, '[data-flow-band], [data-flow-cursor], .flow-aggregate-marker')
    await expect(chart.locator('button, input, select, a, [data-flow-readout]')).to_have_count(0)


async def check_cumulative_flow(plot, touch):
    chart = plot.locator('figure[data-cumulative-flow][data-compact="false"]')
    diagram = chart.locator('svg[data-flow-plot]')
    readout = chart.locator('[data-flow-readout]')
    slider = chart.get_by_role('slider', name='Flow event time')
    cursor = diagram.locator('[data-flow-cursor]')
    stages = ('unload-queue', 'material-prep', 'oven', 'finishing', 'inspection-storage')

    def pick(stage):
        return chart.locator(f'button[data-flow-pick="{stage}"]')

    async def check_state(time, stage, admitted, completed, wip, entered, exited, expected_jobs):
        await expect(cursor).to_have_attribute('data-time', str(time))
        for key, value in [('time', time), ('stage', stage), ('admitted', admitted), ('completed', completed),
                           ('entered', entered), ('exited', exited), ('wip', wip[stages.index(stage)])]:
            await expect(readout).to_have_attribute(f'data-{key}', str(value))
        for name, value in zip(stages, wip):
            await expect(pick(name)).to_have_attribute('data-wip', str(value))
            await expect(pick(name)).to_have_attribute('aria-pressed', str(name == stage).lower())
        lower = 0
        for name, thickness in [('', completed), *reversed(list(zip(stages, wip)))]:
            band = diagram.locator(f'[data-flow-band][data-flow-stage="{name}"]')
            await expect(band).to_have_attribute('data-lower', str(lower))
            lower += thickness
            await expect(band).to_have_attribute('data-upper', str(lower))
            await expect(band).to_have_attribute('data-highlighted', str(name == stage).lower())
        assert lower == admitted
        left, right, top, bottom, capacity = [
            float(await diagram.get_attribute(f'data-{side}')) for side in ('left', 'right', 'top', 'bottom', 'capacity')
        ]
        actual = float(await cursor.get_attribute('x1'))
        assert math.isclose(actual, left + time / 5420.66 * (right - left), abs_tol=1e-6), (time, actual)
        marker = float(await diagram.locator('.flow-aggregate-marker').get_attribute('cy'))
        assert math.isclose(marker, bottom - admitted / capacity * (bottom - top), abs_tol=1e-6), (time, marker)
        records = await readout.locator('[data-flow-job]').evaluate_all(
            'rows => rows.map(row => [row.dataset.flowJob, Number(row.dataset.age)])'
        )
        assert [job for job, _ in records] == list(expected_jobs), (time, stage, records)
        for job, age in records:
            assert math.isclose(age, time - expected_jobs[job], abs_tol=1e-9), (job, age)
        if expected_jobs:
            await expect(readout.get_by_role('table', name='Jobs in the selected stage')).to_be_visible()
        else:
            await expect(readout.get_by_text('No jobs in this stage at the selected time.')).to_be_visible()

    initial_jobs = {
        'WF_102_5': 3.851359, 'WF_103_7': 4.586021, 'WF_105_4': 6.195457,
        'WF_1107_1': 7.891973, 'WF_108_3': 8.736951, 'WF_109_2': 9.692904,
    }
    await check_state(9.692904, 'unload-queue', 7, 0, (6, 1, 0, 0, 0), 7, 1, initial_jobs)
    await pick('material-prep').click()
    await check_state(9.692904, 'material-prep', 7, 0, (6, 1, 0, 0, 0), 1, 0, {'WF_101_5': 4.835})
    await slider.press('ArrowRight')
    await check_state(155.794, 'material-prep', 7, 0, (5, 2, 0, 0, 0), 2, 0,
                      {'WF_101_5': 4.835, 'WF_102_5': 155.794})
    await slider.press('ArrowRight')
    await check_state(164.372, 'material-prep', 7, 0, (5, 1, 1, 0, 0), 2, 1, {'WF_102_5': 155.794})
    await pick('oven').click()
    await check_state(164.372, 'oven', 7, 0, (5, 1, 1, 0, 0), 1, 0, {'WF_101_5': 164.372})

    await slider.press('Home')
    await check_state(0, 'oven', 0, 0, (0, 0, 0, 0, 0), 0, 0, {})
    await slider.press('End')
    await check_state(5420.66, 'oven', 21, 21, (0, 0, 0, 0, 0), 21, 21, {})

    if not touch:
        await diagram.scroll_into_view_if_needed()
        position = await diagram.evaluate("""svg => {
          const {left, right, top, bottom, capacity} = svg.dataset
          const x = Number(left) + 100 / 5420.66 * (right - left)
          const y = bottom - 4 / capacity * (bottom - top)
          const mark = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM())
          return {x: mark.x, y: mark.y}
        }""")
        await plot.page.mouse.click(position['x'], position['y'])
        await check_state(9.692904, 'unload-queue', 7, 0, (6, 1, 0, 0, 0), 7, 1, initial_jobs)

    sources = chart.locator('figcaption')
    doi = 'https://doi.org/10.6084/m9.figshare.20130794.v6'
    await expect(sources.locator(f'a[href="{doi}"]')).to_be_visible()
    await expect(sources).to_contain_text('21 jobs from the 30 released')
    await expect(sources).to_contain_text('CC BY 4.0')
    page = plot.page
    provenance = 'licenses/Malburg-Smart-Factory-CC-BY-4.0.txt'
    notices = await page.request.get(urljoin(page.url, 'THIRD_PARTY_NOTICES.md'))
    assert notices.ok and f'({provenance})' in await notices.text()
    data_notice = await page.request.get(urljoin(page.url, provenance))
    assert data_notice.ok
    text = await data_notice.text()
    assert doi in text and 'https://creativecommons.org/licenses/by/4.0/' in text


async def check_takt_stack_geometry(chart, expected_loads):
    diagram = chart.locator('svg[data-takt-plot]')
    limit = diagram.locator('[data-takt-limit]')
    await expect(chart).to_have_attribute('data-takt', '10.5')
    await expect(limit).to_have_attribute('data-takt-limit', '10.5')
    expected_excess = sum(load > 10.5 for load in expected_loads)
    await expect(chart).to_have_attribute('data-overloaded', str(expected_excess))
    await expect(diagram.locator('[data-takt-excess]')).to_have_count(expected_excess)
    await expect(diagram.locator('[data-takt-segment]')).to_have_count(15)
    await expect(diagram.locator('[data-takt-station]')).to_have_count(3)

    top, bottom, domain = [
        float(await diagram.get_attribute(f'data-{key}')) for key in ('top', 'bottom', 'domain')
    ]
    scale = (bottom - top) / domain
    limit_y = bottom - scale * 10.5
    for axis in ('y1', 'y2'):
        assert math.isclose(float(await limit.get_attribute(axis)), limit_y, abs_tol=1e-7)
    assert math.isclose(float(await chart.get_attribute('data-work')), 30.9, abs_tol=1e-9)
    for index, load in enumerate(expected_loads, start=1):
        station = diagram.locator(f'[data-takt-station="operator-{index}"]')
        overloaded = load > 10.5
        await expect(station).to_have_attribute('data-overloaded', str(overloaded).lower())
        assert math.isclose(float(await station.get_attribute('data-load')), load, abs_tol=1e-9)
        segments = await station.locator('[data-takt-segment]').evaluate_all("""rects => rects.map(rect => [
          Number(rect.parentElement.dataset.seconds), Number(rect.getAttribute('y')), Number(rect.getAttribute('height'))
        ])""")
        assert math.isclose(math.fsum(seconds for seconds, _, _ in segments), load, abs_tol=1e-9)
        offset = 0
        for seconds, y, height in segments:
            offset += seconds
            assert math.isclose(y, bottom - scale * offset, abs_tol=1e-7), (index, seconds, y)
            assert math.isclose(height, scale * seconds, abs_tol=1e-7), (index, seconds, height)
        excess = station.locator('[data-takt-excess]')
        await expect(excess).to_have_count(int(overloaded))
        if overloaded:
            y, height = [float(await excess.get_attribute(key)) for key in ('y', 'height')]
            assert math.isclose(y, bottom - scale * load, abs_tol=1e-7)
            assert math.isclose(y + height, limit_y, abs_tol=1e-7)
            await expect(excess).to_have_attribute('fill', re.compile(r'^url\(#.+\)$'))


async def check_takt_balance_compact(plot):
    chart = plot.locator('figure[data-takt-balance][data-compact="true"]')
    await expect(chart).to_be_visible()
    await check_takt_stack_geometry(chart, (9.5, 10.2, 11.2))
    await check_compact_figure_bounds(
        chart.locator('svg[data-takt-plot]'), '[data-takt-segment], [data-takt-limit], [data-takt-excess]'
    )
    await expect(chart.locator('text, button, input, select, a, [data-takt-selection], table')).to_have_count(0)


async def check_takt_balance(plot, touch):
    chart = plot.locator('figure[data-takt-balance][data-compact="false"]')
    choice = chart.get_by_role('combobox', name='Task', exact=True)
    station_control = chart.get_by_role('combobox', name='Assigned station')
    assignment = chart.locator('[data-takt-selection]')
    diagram = chart.locator('svg[data-takt-plot]')
    table = chart.get_by_role('table', name='Workload by station')
    reset = chart.get_by_role('button', name='Reset assignments')
    process = 'operator-3-process-13'

    async def check_assignment(task, station, seconds):
        await expect(choice).to_have_value(task)
        await expect(station_control).to_have_value(station)
        await expect(assignment).to_have_attribute('data-takt-selection', task)
        await expect(assignment).to_have_attribute('data-current-station', station)
        await expect(assignment).to_have_attribute('data-task-seconds', str(seconds))
        selected = diagram.locator(f'[data-takt-station="{station}"] [data-takt-task="{task}"]')
        await expect(selected).to_have_attribute('data-selected', 'true')
        await expect(diagram.locator('[data-takt-task][data-selected="true"]')).to_have_count(1)

    async def check_loads(loads):
        await check_takt_stack_geometry(chart, loads)
        for index, expected in enumerate(loads, start=1):
            row = table.locator(f'[data-takt-load="operator-{index}"]')
            assert math.isclose(float(await row.get_attribute('data-seconds')), expected, abs_tol=1e-9)
            await expect(row).to_have_attribute('data-overloaded', str(expected > 10.5).lower())

    await expect(choice.locator('option')).to_have_count(15)
    await check_loads((9.5, 10.2, 11.2))
    await check_assignment(process, 'operator-3', 1)
    await expect(reset).to_be_disabled()

    await station_control.select_option('operator-1')
    await check_assignment(process, 'operator-1', 1)
    await check_loads((10.5, 10.2, 10.2))
    await expect(table.locator('[data-takt-load="operator-1"]')).to_contain_text('At takt')
    await expect(reset).to_be_enabled()

    await station_control.select_option('operator-2')
    await check_assignment(process, 'operator-2', 1)
    await check_loads((9.5, 11.2, 10.2))
    await reset.click()
    await check_assignment(process, 'operator-3', 1)
    await check_loads((9.5, 10.2, 11.2))
    await expect(reset).to_be_disabled()

    await choice.select_option('operator-1-walking')
    await check_assignment('operator-1-walking', 'operator-1', 1.9)
    await expect(station_control.locator('option[value="operator-1"]')).to_be_enabled()
    for station in ('operator-2', 'operator-3'):
        await expect(station_control.locator(f'option[value="{station}"]')).to_be_disabled()
    await expect(assignment).to_contain_text('stays at its current station')
    if not touch:
        await diagram.locator(f'[data-takt-task="{process}"]').click()
        await check_assignment(process, 'operator-3', 1)

    sources = chart.locator('figcaption')
    doi = 'https://doi.org/10.5281/zenodo.22734493'
    await expect(sources.locator(f'a[href="{doi}"]')).to_be_visible()
    await expect(sources).to_contain_text('CC BY 4.0')
    await expect(sources).to_contain_text('scenario assumptions')
    page = plot.page
    provenance = 'licenses/Nugraha-Automotive-Yamazumi-CC-BY-4.0.txt'
    notices = await page.request.get(urljoin(page.url, 'THIRD_PARTY_NOTICES.md'))
    assert notices.ok and f'({provenance})' in await notices.text()
    data_notice = await page.request.get(urljoin(page.url, provenance))
    assert data_notice.ok
    text = await data_notice.text()
    assert doi in text and 'https://creativecommons.org/licenses/by/4.0/' in text


async def check_energy_map_settings(chart):
    diagram = chart.locator('svg[data-energy-map]')
    groups = diagram.locator('[data-energy-group]')
    await expect(chart).to_have_attribute('data-run-count', '16')
    await expect(groups).to_have_count(8)
    readings = await groups.evaluate_all("""groups => groups.map(group => {
      const mark = group.querySelector('circle[data-energy-mark]')
      return {...group.dataset, x: Number(mark.getAttribute('cx')), y: Number(mark.getAttribute('cy'))}
    })""")
    # Reference integrals independently reconstructed from the two publisher CSV files.
    medians = (
        (1.8637285411522084 + 1.7869418639109722) / 2,
        (2.1452000509078055 + 2.2417599147062712) / 2,
        (1.94840233771075 + 1.8631521405574032) / 2,
        (2.4243300257277083 + 2.1049426170475276) / 2,
        2.2578580492442777,
        (3.435653201335722 + 3.6251811924059445) / 2,
        (2.103571499346236 + 1.6883227611170972) / 2,
        (2.522883913225264 + 2.27240035076125) / 2,
    )
    measured_coordinates = [(speed, load) for speed in (8500, 9500, 10500, 11500) for load in (.1016, .508)]
    assert [(float(group['speed']), float(group['load'])) for group in readings] == measured_coordinates
    for i, (group, median) in enumerate(zip(readings, medians)):
        assert group['count'] == '2' and group['energyGroup'] == str(i), group
        assert math.isclose(float(group['median']), median, abs_tol=1e-9), group
        x = readings[0]['x'] + (readings[6]['x'] - readings[0]['x']) * (i // 2) / 3
        assert math.isclose(group['x'], x, abs_tol=1e-7), group
        assert group['y'] == readings[i % 2]['y'], group
    assert readings[0]['y'] > readings[1]['y']


async def check_energy_trace(trace, run, start, end, segment_end):
    await expect(trace).to_have_attribute('data-run', run)
    for name, expected in [('start', start), ('end', end)]:
        assert math.isclose(float(await trace.get_attribute(f'data-{name}')), expected, abs_tol=1e-8)
    segments = trace.locator('[data-energy-power-segment]')
    await expect(segments).to_have_count(1)
    for name, expected in [('start', start), ('end', segment_end)]:
        assert math.isclose(float(await segments.get_attribute(f'data-{name}')), expected, abs_tol=1e-8)
    left, right = [float(await trace.get_attribute(f'data-{side}')) for side in ('left', 'right')]
    line = await segments.locator('.energy-power-line').get_attribute('d')
    coordinates = [float(x) for x in re.findall(r'[ML]([-+0-9.eE]+),', line)]
    assert len(coordinates) > 2, (run, line)
    assert math.isclose(coordinates[0], left, abs_tol=.001), run
    expected_right = left + (segment_end - start) / (end - start) * (right - left)
    assert math.isclose(coordinates[-1], expected_right, abs_tol=.001), run
    assert all(a <= b for a, b in zip(coordinates, coordinates[1:])), run
    area = await segments.locator('.energy-power-area').get_attribute('d')
    assert area.startswith(line) and area.endswith('Z'), run
    return line


async def check_energy_operating_map_compact(plot):
    chart = plot.locator('figure[data-energy-operating-map][data-compact="true"]')
    await expect(chart).to_be_visible()
    await check_energy_map_settings(chart)
    diagram = chart.locator('svg[data-energy-map]')
    await expect(diagram.locator('[data-energy-group="5"]')).to_have_attribute('data-selected', 'true')
    trace = chart.locator('svg[data-energy-trace]')
    await check_energy_trace(trace, 'pass-20', 127.019, 129.963, 129.963)
    await check_compact_figure_bounds(diagram, '[data-energy-mark], .energy-selection-ring')
    await check_compact_figure_bounds(trace, '.energy-power-line, .energy-power-area')
    await expect(chart.locator('text, button, input, select, a, .energy-map-hit, [data-energy-readout]')).to_have_count(0)


async def check_energy_operating_map(plot, touch):
    chart = plot.locator('figure[data-energy-operating-map][data-compact="false"]')
    diagram = chart.locator('svg[data-energy-map]')
    setting = chart.get_by_role('combobox', name='Operating setting')
    trial = chart.get_by_role('combobox', name='Trial')
    readout = chart.locator('[data-energy-readout]')
    trace = chart.locator('svg[data-energy-trace]')

    async def check_trial(group, run, start, end, segment_end, energy):
        await expect(setting).to_have_value(str(group))
        await expect(trial).to_have_value(run)
        await expect(trial.locator('option')).to_have_count(2)
        await expect(diagram.locator(f'[data-energy-group="{group}"]')).to_have_attribute('data-selected', 'true')
        await expect(diagram.locator('[data-energy-group][data-selected="true"]')).to_have_count(1)
        await expect(readout).to_have_attribute('data-energy-readout', run)
        await expect(readout).to_have_attribute('data-units', '1')
        assert math.isclose(float(await readout.get_attribute('data-observed-wh')), energy, abs_tol=1e-9)
        assert math.isclose(float(await readout.get_attribute('data-covered-seconds')), segment_end - start, abs_tol=1e-8)
        if end == segment_end:
            assert math.isclose(float(await readout.get_attribute('data-energy-per-unit')), energy, abs_tol=1e-9)
            await expect(readout.get_by_text('100%', exact=True)).to_be_visible()
        else:
            await expect(readout).to_have_attribute('data-energy-per-unit', 'unavailable')
            await expect(readout.get_by_text('Unavailable', exact=True)).to_be_visible()
            await expect(readout.get_by_text('95.5%', exact=True)).to_be_visible()
        return await check_energy_trace(trace, run, start, end, segment_end)

    await check_energy_map_settings(chart)
    await expect(setting.locator('option')).to_have_count(8)
    initial = await check_trial(5, 'pass-20', 127.019, 129.963, 129.963, 3.6251811924059445)
    await setting.select_option('4')
    paired = await check_trial(4, 'pass-51', 315.371, 317.461, 317.461, 2.2578580492442777)
    assert paired != initial
    await trial.select_option('pass-52')
    gap = await check_trial(4, 'pass-52', 320.341, 322.667, 322.562861, 2.4816882447856945)
    assert gap != paired
    await expect(chart.get_by_text('Median 2.2579 Wh / cut · 1 of 2 with full coverage', exact=True)).to_be_visible()
    await check_energy_map_settings(chart)
    if not touch:
        await diagram.locator('[data-energy-group="0"] .energy-map-hit').click()
        await check_trial(0, 'pass-35', 219.221, 221.056, 221.056, 1.8637285411522084)

    sources = chart.locator('figcaption')
    doi = 'https://doi.org/10.34740/kaggle/ds/8392825'
    await expect(sources.locator(f'a[href="{doi}"]')).to_be_visible()
    await expect(sources).to_contain_text('CC BY 4.0')
    await expect(sources).to_contain_text('logged main-supply watts')
    await expect(sources).to_contain_text('energy is omitted from the setting median')
    page = plot.page
    provenance = 'licenses/Kim-MSM-CNC-CC-BY-4.0.txt'
    notices = await page.request.get(urljoin(page.url, 'THIRD_PARTY_NOTICES.md'))
    assert notices.ok and f'({provenance})' in await notices.text()
    data_notice = await page.request.get(urljoin(page.url, provenance))
    assert data_notice.ok
    text = await data_notice.text()
    assert doi in text and 'https://creativecommons.org/licenses/by/4.0/' in text


def weibull_fixture_anchors(slug):
    if slug == 'weibull-probability-suppliers':
        return {
            'supplier-a': (8, 4, 'A-01', 180, 1600, 2.2069557599972693, 1592.2040700236585),
            'supplier-b': (8, 4, 'B-01', 535, 1600, 2.595725410993263, 1500.5653795515436),
        }
    return {
        'ep0': (21, 0, 'T-13', 1677, 7652, 2.4128953580426886, 4547.852784300926),
        'ep00': (21, 0, 'T-06', 3220, 7352, 5.95449562862727, 6171.273026117448),
        'ep000': (21, 0, 'T-16', 2263, 8822, 2.3032213639000765, 5754.36166282265),
    }


def check_weibull_number(actual, expected, description):
    if not math.isclose(float(actual), expected, rel_tol=1e-10, abs_tol=1e-8):
        raise RuntimeError(f'{description}: expected {expected}, observed {actual}')


async def check_weibull_paper(paper, anchors, *, compact, guide=.1):
    # Recover the linear plotting coordinates from SVG attributes. Independently reconstruct the
    # two axis transforms and the straight-line Weibull relationship from time, probability, and fit.
    geometry = await paper.evaluate("""svg => {
      const pair = (node, first, second) => [Number(node.getAttribute(first)), Number(node.getAttribute(second))]
      return {
        ...svg.dataset,
        ticksX: [...svg.querySelectorAll('[data-time-tick]')].map(node => [Number(node.dataset.timeTick), Number(node.getAttribute('x'))]),
        ticksY: [...svg.querySelectorAll('[data-probability-tick]')].map(node => [Number(node.dataset.probabilityTick), Number(node.getAttribute('y'))]),
        guide: svg.querySelector('[data-weibull-guide]')?.getAttribute('y1'),
        groups: [...svg.querySelectorAll('[data-weibull-cohort]')].map(group => ({
          id: group.dataset.weibullCohort,
          marks: [...group.querySelectorAll('[data-weibull-mark]')].map(mark => {
            const box = mark.querySelector('.weibull-dot').getBBox()
            return {id: mark.dataset.weibullMark, time: Number(mark.dataset.time), p: Number(mark.dataset.probability),
              risk: Number(mark.dataset.atRisk), x: box.x + box.width / 2, y: box.y + box.height / 2}
          }),
          fits: [...group.querySelectorAll('[data-weibull-fit]')].map(line => ({
            kind: line.dataset.weibullFit,
            times: [Number(line.dataset.start), Number(line.dataset.end)],
            x: pair(line, 'x1', 'x2'), y: pair(line, 'y1', 'y2'),
            dash: getComputedStyle(line).strokeDasharray,
          })),
          quantiles: [...group.querySelectorAll('[data-weibull-quantile]')].map(mark => ({
            probability: Number(mark.dataset.weibullQuantile),
            time: Number(mark.dataset.time),
            center: pair(mark.querySelector('circle'), 'cx', 'cy'),
          })),
        })),
        censors: [...svg.querySelectorAll('[data-weibull-censor]')].map(node => ({
          id: node.dataset.weibullCensor, time: Number(node.dataset.time), cohort: node.parentElement.dataset.weibullCensors,
          x: Number(node.getAttribute('x1')), y: Number(node.getAttribute('y1')), end: Number(node.getAttribute('y2')),
        })),
      }
    }""")
    left, right, top, bottom = (float(geometry[key]) for key in ('plotLeft', 'plotRight', 'plotTop', 'plotBottom'))
    lo, hi = (math.log(float(geometry[key])) for key in ('xMin', 'xMax'))
    paper_min, paper_max = (float(geometry[key]) for key in ('paperMin', 'paperMax'))
    x = lambda time: left + (math.log(time) - lo) * (right - left) / (hi - lo)
    y = lambda ordinate: bottom - (ordinate - paper_min) * (bottom - top) / (paper_max - paper_min)
    ordinate = lambda probability: math.log(-math.log1p(-probability))

    if [cohort['id'] for cohort in geometry['groups']] != list(anchors):
        raise RuntimeError('Weibull paper lost the fixture’s original cohort order')
    if compact:
        if geometry['ticksX'] or geometry['ticksY'] or geometry.get('guide') is not None:
            raise RuntimeError('The compact probability paper must omit tick labels and the lifetime guide')
    else:
        if len(geometry['ticksX']) < 2 or len(geometry['ticksY']) < 4:
            raise RuntimeError('The probability paper needs visible calibrated axes')
        for time, position in geometry['ticksX']:
            check_weibull_number(position, x(time), 'Log-time axis tick')
        for probability, position in geometry['ticksY']:
            check_weibull_number(position, y(ordinate(probability)), 'Weibull probability axis tick')
        check_weibull_number(geometry['guide'], y(ordinate(guide)), 'Lifetime guide probability')

    for group in geometry['groups']:
        failures, censors, first_id, first_time, last_time, shape, scale = anchors[group['id']]
        marks, fits, quantiles = group['marks'], group['fits'], group['quantiles']
        if len(marks) != failures or marks[0]['time'] != first_time or marks[0]['id'] != first_id:
            raise RuntimeError(f'{group["id"]} does not preserve the observed failures')
        if len({mark['id'] for mark in marks}) != failures:
            raise RuntimeError(f'{group["id"]} duplicated source observation identities')
        for index, mark in enumerate(marks):
            # The fixture failures are distinct and the censors are tied at the final cutoff.
            check_weibull_number(mark['p'], (index + .5) / (failures + censors), 'Failure-step midpoint')
            check_weibull_number(mark['risk'], failures + censors - index, 'Pre-failure risk set')
            if abs(mark['x'] - x(mark['time'])) > .0001 or abs(mark['y'] - y(ordinate(mark['p']))) > .0001:
                raise RuntimeError(f'{group["id"]} observation {mark["id"]} was displaced on the probability paper')
        if sum(line['kind'] == 'observed' for line in fits) != 1:
            raise RuntimeError(f'{group["id"]} is missing its fitted line within the observed time extent')
        for line in fits:
            start, end = line['times']
            in_extent = start >= first_time - 1e-8 and end <= last_time + 1e-8
            separated_tail = end <= first_time + 1e-8 or start >= last_time - 1e-8
            if line['kind'] == 'observed':
                if not in_extent or line['dash'] != 'none':
                    raise RuntimeError('The fitted line within the recorded time extent must be solid')
            elif not separated_tail or line['dash'] == 'none':
                raise RuntimeError('Extrapolated segments must be clearly dashed and outside observed time extent')
            for time, px, py in zip(line['times'], line['x'], line['y']):
                check_weibull_number(px, x(time), 'Fitted line log-time coordinate')
                check_weibull_number(py, y(shape * math.log(time / scale)), 'Fitted Weibull line ordinate')

        if compact:
            if quantiles:
                raise RuntimeError('The compact probability paper must omit lifetime guide intersections')
        else:
            if len(quantiles) != 1:
                raise RuntimeError(f'{group["id"]} needs one fitted lifetime at the guide probability')
            quantile = quantiles[0]
            expected = scale * (-math.log1p(-guide)) ** (1 / shape)
            check_weibull_number(quantile['probability'], guide, 'Lifetime guide probability at intersection')
            check_weibull_number(quantile['time'], expected, 'Fitted lifetime at intersection')
            check_weibull_number(quantile['center'][0], x(expected), 'Fitted lifetime x coordinate')
            check_weibull_number(quantile['center'][1], y(ordinate(guide)), 'Fitted lifetime y coordinate')

    expected_censors = [] if len(anchors) == 3 else [f'{supplier}-{trial:02}' for supplier in ('A', 'B') for trial in range(9, 13)]
    if [mark['id'] for mark in geometry['censors']] != expected_censors:
        raise RuntimeError('The censor rug must preserve censor identities and remain separate from failed specimens')
    for mark in geometry['censors']:
        check_weibull_number(mark['time'], 1600, 'Right-censor cutoff')
        check_weibull_number(mark['x'], x(1600), 'Censor rug log-time coordinate')
        if mark['y'] <= bottom:
            raise RuntimeError('Right-censored specimens must stay in their own rug beneath the probability paper')
    if expected_censors and not compact:
        prior_end = bottom
        for identifier in anchors:
            row = [mark for mark in geometry['censors'] if mark['cohort'] == identifier]
            for mark in row:
                if mark['y'] <= prior_end or mark['end'] <= mark['y']:
                    raise RuntimeError('Tied censors must occupy distinct marks on separate cohort rows')
                prior_end = mark['end']
            count = paper.locator(f'[data-weibull-censors="{identifier}"] [data-weibull-censor-count="4"]')
            await expect(count).to_have_text('×4')


async def check_weibull_compact(preview, slug):
    chart = preview.locator('figure[data-weibull-probability][data-compact="true"]')
    paper = chart.locator('svg[data-weibull-paper]')
    await expect(paper).to_be_visible()
    await expect(chart.locator('select, button, [data-weibull-inspection], [data-weibull-fit-row]')).to_have_count(0)
    await check_compact_figure_bounds(paper, '[data-weibull-mark], [data-weibull-fit], [data-weibull-censor]')
    await check_weibull_paper(paper, weibull_fixture_anchors(slug), compact=True)


async def check_weibull_probability(preview, slug, touch):
    anchors = weibull_fixture_anchors(slug)
    measured = slug == 'weibull-probability-bearing-greases'
    chart = preview.locator('figure[data-weibull-probability][data-compact="false"]')
    paper = chart.locator('svg[data-weibull-paper]')
    await expect(paper.get_by_text('Failure probability', exact=True)).to_be_visible()
    await expect(paper.get_by_text(f'Test time ({"s" if measured else "h"}, log scale)', exact=True)).to_be_visible()
    source = 'https://doi.org/10.17632/d5n3zgvs7p.3' if measured else 'https://www.itl.nist.gov/div898/handbook/apr/section2/apr221.htm'
    await expect(chart.locator('figcaption a').first).to_have_attribute('href', source)
    if measured:
        await expect(chart.locator('figcaption a[href="https://creativecommons.org/licenses/by/4.0/"]')).to_be_visible()
    else:
        await expect(chart.locator('figcaption')).to_contain_text('Illustrative observations for two fictional suppliers')

    readout = chart.locator('[data-weibull-inspection]')
    async def check_selected(cohort, identifier, time, probability):
        await expect(readout).to_have_attribute('data-weibull-inspection', identifier)
        await expect(readout).to_have_attribute('data-cohort', cohort)
        shape, scale = anchors[cohort][-2:]
        expected = scale * (-math.log1p(-probability)) ** (1 / shape)
        for attr, value in [('time', time), ('probability', probability), ('fitted', expected),
                            ('ratio', time / expected), ('log-residual', math.log(time / expected))]:
            check_weibull_number(await readout.get_attribute(f'data-{attr}'), value, f'Failure inspection {attr}')
        await expect(paper.locator(f'[data-weibull-cohort="{cohort}"] [data-weibull-mark="{identifier}"]')).to_have_attribute('data-active', 'true')
        residual = paper.locator('[data-weibull-residual]')
        await expect(residual).to_have_attribute('data-weibull-residual', identifier)
        residual_points = await residual.locator('line').evaluate("""line => {
          const d = line.ownerSVGElement.dataset
          const xToTime = x => Math.exp(Math.log(+d.xMin) + (x - +d.plotLeft) *
            (Math.log(+d.xMax) - Math.log(+d.xMin)) / (+d.plotRight - +d.plotLeft))
          const yToPaper = y => +d.paperMin + (+d.plotBottom - y) *
            (+d.paperMax - +d.paperMin) / (+d.plotBottom - +d.plotTop)
          return [xToTime(+line.getAttribute('x1')), xToTime(+line.getAttribute('x2')),
            yToPaper(+line.getAttribute('y1')), yToPaper(+line.getAttribute('y2'))]
        }""")
        position = math.log(-math.log1p(-probability))
        for actual, value in zip(residual_points, (time, expected, position, position)):
            check_weibull_number(actual, value, 'Observed-to-fitted residual segment')

    first, *_, alternative = anchors
    size = sum(anchors[first][:2])
    await check_selected(first, anchors[first][2], anchors[first][3], .5 / size)
    fit_table = chart.locator('[data-weibull-fit-row]')
    fits = await fit_table.evaluate_all('rows => rows.map(({dataset: d}) => [d.weibullFitRow, +d.shape, +d.scale, +d.b10, +d.b50, +d.failures, +d.censored])')
    for identifier, shape, scale, b10, b50, failures, censored in fits:
        n_fail, n_censor, _, _, _, expected_shape, expected_scale = anchors[identifier]
        assert (failures, censored) == (n_fail, n_censor)
        for value, expected in [
            (shape, expected_shape), (scale, expected_scale),
            (b10, expected_scale * (-math.log(.9)) ** (1 / expected_shape)),
            (b50, expected_scale * math.log(2) ** (1 / expected_shape)),
        ]:
            check_weibull_number(value, expected, 'Censored or complete maximum-likelihood summary')
    await check_weibull_paper(paper, anchors, compact=False, guide=.1)
    await chart.get_by_role('combobox', name='Lifetime guide', exact=True).select_option('0.5')
    await check_weibull_paper(paper, anchors, compact=False, guide=.5)
    await check_selected(first, anchors[first][2], anchors[first][3], .5 / size)
    after = await fit_table.evaluate_all('rows => rows.map(({dataset: d}) => [d.weibullFitRow, +d.shape, +d.scale, +d.b10, +d.b50, +d.failures, +d.censored])')
    assert after == fits

    await chart.get_by_role('combobox', name='Failure', exact=True).select_option('T-14' if measured else 'A-08')
    await check_selected(first, 'T-14' if measured else 'A-08', anchors[first][4], (anchors[first][0] - .5) / size)
    await chart.get_by_role('combobox', name='Cohort', exact=True).select_option(alternative)
    await check_selected(alternative, anchors[alternative][2], anchors[alternative][3], .5 / sum(anchors[alternative][:2]))

    point = paper.locator(f'[data-weibull-cohort="{first}"] [data-weibull-mark="{anchors[first][2]}"] .weibull-mark-target')
    await point.evaluate("mark => mark.scrollIntoView({block: 'center', inline: 'nearest'})")
    if touch:
        await point.tap(timeout=5000)
    else:
        await point.click(timeout=5000)
    await check_selected(first, anchors[first][2], anchors[first][3], .5 / size)


async def check_kaplan_meier_curves(plot):
    failure_times = {
        '200v': (439, 904, 1092, 1105),
        '300v': (315, 315, 439, 628),
        '350v': (258, 258, 347, 588),
    }
    await expect(plot.locator('[data-km-curve]')).to_have_count(3)
    await expect(plot.locator('[data-km-censor]')).to_have_count(3)
    domain = await plot.evaluate("""node => Object.fromEntries(
      ['timeMax', 'plotLeft', 'plotRight', 'plotTop', 'plotBottom'].map(key => [key, Number(node.dataset[key])]))""")
    if domain['timeMax'] != 1105:
        raise RuntimeError(f'Expected the measured follow-up domain to end at 1105 h, observed {domain["timeMax"]}')

    def x(time):
        return domain['plotLeft'] + (domain['plotRight'] - domain['plotLeft']) * time / domain['timeMax']

    def y(survival):
        return domain['plotBottom'] - (domain['plotBottom'] - domain['plotTop']) * survival

    for cohort, times in failure_times.items():
        trace = plot.locator(f'[data-km-cohort="{cohort}"]')
        curve = trace.locator('[data-km-curve]')
        await expect(curve).to_have_attribute('data-cohort-end', str(times[-1]))
        commands = re.findall(r'([MHV])([^MHV]+)', await curve.get_attribute('d'))
        expected = [('M', (x(0), y(1)))]
        for time in sorted(set(times)):
            survival = (8 - sum(item <= time for item in times)) / 8
            expected.extend([('H', (x(time),)), ('V', (y(survival),))])
        if len(commands) != len(expected):
            raise RuntimeError(f'{cohort} must have one step per distinct failure time and stop at its last observation')
        for (command, raw), (kind, coords) in zip(commands, expected):
            values = tuple(map(float, raw.split()))
            if command != kind or len(values) != len(coords) or any(
                not math.isclose(a, b, rel_tol=0, abs_tol=1e-8) for a, b in zip(values, coords)
            ):
                raise RuntimeError(f'{cohort} reliability path differs from the measured weighted risk steps')
        marker = trace.locator('[data-km-censor]')
        await expect(marker).to_have_attribute('data-km-censor', str(times[-1]))
        await expect(marker).to_have_attribute('data-count', '4')
        await expect(marker).to_have_attribute('data-survival', '0.5')

    risks = await plot.locator('[data-km-risk-at]').evaluate_all("""cells => cells.map(cell => ({
      cohort: cell.dataset.cohort, time: Number(cell.dataset.kmRiskAt),
      count: Number(cell.dataset.atRisk), text: cell.textContent, x: Number(cell.getAttribute('x'))
    }))""")
    for cell in risks:
        times = failure_times[cell['cohort']]
        at_risk = sum(time >= cell['time'] for time in times + (times[-1],) * 4)
        if cell['count'] != at_risk or cell['text'] != str(at_risk) or not math.isclose(cell['x'], x(cell['time']), abs_tol=1e-8):
            raise RuntimeError(f'Incorrect risk count or shared tick position for {cell}')
    return risks


async def check_kaplan_meier_compact(preview):
    chart = preview.locator('figure[data-km-reliability][data-compact="true"]')
    plot = chart.locator('svg[data-km-plot]')
    await expect(plot).to_be_visible()
    await check_kaplan_meier_curves(plot)
    await check_compact_figure_bounds(plot, '[data-km-curve], [data-km-censor]')
    controls = 'select, input, button, [data-km-hit], [data-km-risk-at], [data-km-event-row], [data-km-specimens]'
    await expect(chart.locator(controls)).to_have_count(0)


async def check_kaplan_meier(preview, touch):
    chart = preview.locator('figure[data-km-reliability][data-compact="false"]')
    plot = chart.locator('svg[data-km-plot]')
    risks = await check_kaplan_meier_curves(plot)
    times = {cell['time'] for cell in risks}
    ticks = await plot.locator('.km-axes text[text-anchor="middle"]:not(.scientific-axis-label)').evaluate_all("""labels => labels.map(label => [
      Number(label.textContent.replaceAll(',', '')), Number(label.getAttribute('x'))
    ])""")
    tick_positions = dict(ticks)
    if 0 not in times or len(times) < 3 or len(risks) != len(times) * 3 or times != set(tick_positions):
        raise RuntimeError('The aligned at-risk table must have a row for every cohort at the plot ticks')
    if any(not math.isclose(cell['x'], tick_positions[cell['time']], abs_tol=1e-8) for cell in risks):
        raise RuntimeError('At-risk table values must align with the time-axis labels')
    await expect(chart.locator('figcaption a').first).to_have_attribute('href', 'https://doi.org/10.1080/00401706.1959.10489862')
    slider = chart.get_by_role('slider', name='Event time', exact=True)
    cohort_select = chart.get_by_role('combobox', name='Cohort', exact=True)
    specimen_select = chart.get_by_role('combobox', name='Specimen', exact=True)
    detail = chart.locator('[data-km-specimen-detail]')

    async def expect_time(time):
        await expect(chart.locator('[data-km-time]')).to_have_attribute('data-km-time', str(time))
        await expect(plot.locator('[data-km-cursor]')).to_have_attribute('data-km-cursor', str(time))
        await expect(slider).to_have_attribute('aria-valuetext', f'{time} h')

    async def event(cohort, at_risk, failed, censored, after, survival):
        row = chart.locator(f'[data-km-event-row="{cohort}"]')
        for key, count in [('at-risk', at_risk), ('failures', failed), ('censored', censored), ('after', after)]:
            await expect(row).to_have_attribute(f'data-{key}', str(count))
        value = await row.get_attribute('data-survival')
        if survival is None:
            if value is not None:
                raise RuntimeError(f'{cohort} has no reliability estimate beyond its last observation')
            await expect(plot.locator(f'[data-km-cohort="{cohort}"] [data-km-selected-survival]')).to_have_count(0)
        elif value is None or not math.isclose(float(value), survival, abs_tol=1e-12):
            raise RuntimeError(f'{cohort} expected reliability {survival}, observed {value}')
        return row

    await expect_time(628)
    await expect(cohort_select).to_have_value('300v')
    terminal = await event('300v', 5, 1, 4, 0, .5)
    await event('200v', 7, 0, 0, 7, .875)
    await event('350v', 0, 0, 0, 0, None)
    for side, expected in [('lower', .1520358902990239), ('upper', .7748650120668888)]:
        bound = float(await terminal.get_attribute(f'data-{side}'))
        if not math.isclose(bound, expected, abs_tol=1e-12):
            raise RuntimeError(f'The measured terminal Greenwood 95% {side} bound differs: {bound}')
    await expect(plot.locator('[data-km-confidence]')).to_have_count(2)
    await expect(plot.locator('[data-km-cohort="300v"] [data-km-confidence]')).to_have_count(2)
    await expect(chart.locator('[data-km-cohort-summary]')).to_have_attribute('data-median', '628')

    await slider.press('Home')
    await expect_time(0)
    await event('300v', 8, 0, 0, 8, 1)
    await slider.press('ArrowRight')
    await slider.press('ArrowRight')
    await expect_time(315)
    await event('300v', 8, 2, 0, 6, .75)
    timeline = chart.locator('[data-km-specimens="300v"]')
    await expect(timeline.locator('[data-time="315"][data-status="failed"]')).to_have_count(2)
    await expect(timeline.locator('[data-at-risk="true"]')).to_have_count(8)
    await slider.press('ArrowRight')
    await expect_time(347)
    await event('300v', 6, 0, 0, 6, .75)
    await expect(timeline.locator('[data-at-risk="true"]')).to_have_count(6)

    await expect(timeline.locator('[data-km-specimen]')).to_have_count(8)
    await expect(timeline.locator('[data-km-outcome="failed"]')).to_have_count(4)
    await expect(timeline.locator('[data-km-outcome="censored"]')).to_have_count(4)
    specimen = timeline.locator('[data-km-specimen="300v-07"]')
    await specimen.evaluate("row => row.scrollIntoView({block: 'center', inline: 'nearest'})")
    await (specimen.tap(timeout=8000) if touch else specimen.click(timeout=8000))
    await expect_time(628)
    await expect(timeline.locator('[data-at-risk="true"]')).to_have_count(5)
    await expect(specimen_select).to_have_value('300v-07')
    await expect(detail).to_have_attribute('data-status', 'censored')
    await expect(detail).to_have_attribute('data-time', '628')
    await expect(detail).to_contain_text('Right-censored')

    await cohort_select.select_option('350v')
    await expect(chart.locator('[data-km-specimens]')).to_have_attribute('data-km-specimens', '350v')
    await expect(detail).to_have_count(0)
    await specimen_select.select_option('350v-02')
    await expect_time(258)
    await expect(detail).to_have_attribute('data-km-specimen-detail', '350v-02')
    await expect(detail).to_have_attribute('data-status', 'failed')
    await event('350v', 8, 2, 0, 6, .75)

    hit = plot.locator('[data-km-hit]')
    await hit.evaluate("region => region.scrollIntoView({block: 'center', inline: 'nearest'})")
    box = await hit.bounding_box()
    position = {'x': box['width'] * 904 / 1105, 'y': box['height'] / 2}
    await (hit.tap(position=position, timeout=8000) if touch else hit.click(position=position, timeout=8000))
    await expect_time(904)
    await event('200v', 7, 1, 0, 6, .75)
    await event('300v', 0, 0, 0, 0, None)
    await event('350v', 0, 0, 0, 0, None)


async def check_lcms_compact(preview):
    chart = preview.locator('figure[data-lcms-map][data-compact="true"]')
    footprints = chart.locator('svg[data-lcms-trace-detail]')
    chromatogram = chart.locator('svg[data-lcms-chromatogram]')
    await expect(footprints).to_have_attribute('data-reference-mz', '427.30320051521875')
    await expect(footprints.locator('[data-lcms-hull]')).to_have_count(1)
    hull = footprints.locator('path[data-lcms-hull="M+0"]')
    await expect(hull).to_have_attribute('data-vertices', '7')
    await expect(hull).to_have_attribute('d', re.compile(r'^M(?:[^MLZ]+L){6}[^MLZ]+Z$'))
    await expect(chromatogram.locator('path[data-lcms-ion-path]')).to_have_attribute('d', re.compile(r'^M.*L'))
    await check_compact_figure_bounds(footprints, '[data-lcms-hull]')
    await check_compact_figure_bounds(chromatogram, '[data-lcms-ion-path]')
    await expect(chart.locator('select, input, button, [data-lcms-scan-evidence], [data-lcms-chromatogram-target]')).to_have_count(0)


async def check_lcms_feature_map(preview, touch):
    chart = preview.locator('figure[data-lcms-map][data-compact="false"]')
    overview = chart.locator('svg[data-lcms-overview]')
    footprints = chart.locator('svg[data-lcms-footprints]')
    detail = chart.locator('svg[data-lcms-trace-detail]')
    chromatogram = chart.locator('svg[data-lcms-chromatogram]')
    summary = chart.locator('output[data-lcms-feature-summary]')
    evidence = chart.locator('output[data-lcms-scan-evidence]')
    feature = chart.get_by_role('combobox', name='Detected feature', exact=True)
    ion_trace = chart.get_by_role('combobox', name='Ion trace', exact=True)
    scan = chart.get_by_role('slider', name='Scan', exact=True)
    target = chromatogram.locator('[data-lcms-chromatogram-target]')
    native_prefix = 'controllerType=0 controllerNumber=1 scan='

    async def check_scan(number, rt, intensity, trace):
        scan_id = f'{native_prefix}{number}'
        await expect(evidence).to_have_attribute('data-lcms-scan-evidence', scan_id)
        await expect(evidence).to_have_attribute('data-scan-rt', rt)
        await expect(evidence).to_have_attribute('data-scan-intensity', intensity)
        await expect(evidence).to_have_attribute('data-scan-state', 'measured')
        await expect(evidence).to_have_attribute('data-trace', trace)
        await expect(evidence).to_contain_text(scan_id)
        await expect(scan).to_have_attribute('aria-valuetext', re.compile(r'^' + re.escape(scan_id) + ', '))
        marker = chromatogram.locator(f'circle[data-lcms-scan="{scan_id}"]')
        await expect(marker).to_have_attribute('data-rt', rt)
        await expect(marker).to_have_attribute('data-intensity', intensity)
        await expect(chromatogram.locator('[data-lcms-selected-scan]')).to_have_attribute('data-lcms-selected-scan', scan_id)
        positions = [
            (footprints, 'line[data-lcms-footprint-scan]', 'x1'),
            (detail, 'line[data-lcms-footprint-scan]', 'x1'),
            (chromatogram, f'circle[data-lcms-scan="{scan_id}"]', 'cx'),
        ]
        for pane, selector, coordinate in positions:
            time = await pane.evaluate("""(panel, [selector, coordinate]) => {
              const ticks = Array.from(panel.querySelectorAll('text[text-anchor="middle"][x]'))
                .map(tick => [Number(tick.getAttribute('x')), Number(tick.textContent)])
                .filter(([, value]) => Number.isFinite(value))
              const [[x1, t1], [x2, t2]] = ticks
              const markX = Number(panel.querySelector(selector).getAttribute(coordinate))
              return t1 + (markX - x1) * (t2 - t1) / (x2 - x1)
            }""", [selector, coordinate])
            if not math.isclose(time, float(rt), rel_tol=0, abs_tol=1e-6):
                raise RuntimeError(f'{scan_id}: all three panels must project the same retention time, observed {time}')

    async def check_window(trace, center_mz, min_mz, max_mz, hull_bounds):
        await expect(detail).to_have_attribute('data-reference-mz', str(center_mz))
        await expect(detail.locator('[data-lcms-hull]')).to_have_count(1)
        for key, value in [('data-mz-min', min_mz), ('data-mz-max', max_mz)]:
            await expect(evidence).to_have_attribute(key, str(value))
        for pane, ppm in [(footprints, False), (detail, True)]:
            rendered = await pane.evaluate("""(panel, { trace, ppm, center }) => {
              const ticks = Array.from(panel.querySelectorAll('text[text-anchor="end"]')).map(tick =>
                [Number(tick.getAttribute('y')), Number(tick.textContent.replaceAll(',', ''))])
              const [[y1, v1], [y2, v2]] = ticks
              const mz = y => {
                const value = v1 + (y - y1) * (v2 - v1) / (y2 - y1)
                return ppm ? center * (1 + value * 1e-6) : value
              }
              const rect = panel.querySelector('rect[data-lcms-extraction-window]')
              const low = Number(rect.getAttribute('y'))
              const high = low + Number(rect.getAttribute('height'))
              const path = panel.querySelector(`path[data-lcms-hull="${trace}"]`).getAttribute('d')
              const vertices = Array.from(path.matchAll(/[ML]([0-9.eE+-]+) ([0-9.eE+-]+)/g), match =>
                [Number(match[1]), Number(match[2])])
              const xTicks = Array.from(panel.querySelectorAll('text[text-anchor="middle"][x]'))
                .map(tick => [Number(tick.getAttribute('x')), Number(tick.textContent)])
                .filter(([, value]) => Number.isFinite(value))
              const [[x1, t1], [x2, t2]] = xTicks
              const rt = x => t1 + (x - x1) * (t2 - t1) / (x2 - x1)
              const times = vertices.map(([x]) => rt(x))
              const masses = vertices.map(([, y]) => mz(y))
              return [mz(high), mz(low), Math.min(...times), Math.max(...times), Math.min(...masses), Math.max(...masses)]
            }""", {'trace': trace, 'ppm': ppm, 'center': center_mz})
            expected = [min_mz, max_mz, *hull_bounds]
            if any(not math.isclose(a, b, rel_tol=0, abs_tol=1e-6) for a, b in zip(rendered, expected)):
                raise RuntimeError(f'F29 {trace} hull or extraction bounds were altered: {rendered}')

    await expect(overview.locator('[data-lcms-feature]')).to_have_count(75)
    await expect(overview.locator('[data-lcms-hull]')).to_have_count(183)
    await expect(overview.get_by_text('Retention time (min)', exact=True)).to_be_visible()
    await expect(footprints.get_by_text('Retention time (s)', exact=True)).to_be_visible()
    await expect(detail.get_by_text('Mass offset (ppm)', exact=True)).to_be_visible()
    await expect(chromatogram.get_by_text('Ion intensity', exact=True)).to_be_visible()
    await expect(chart.get_by_role('link', name='OpenMS Metabolomics_1.mzML', exact=True)).to_have_attribute(
        'href', re.compile(r'/blob/01540e638431426a39b4d7acce41a5e2c738b235/.+/Metabolomics_1\.mzML$')
    )
    await expect(summary).to_have_attribute('data-lcms-feature-summary', 'F29')
    await expect(summary).to_have_attribute('data-feature-rt', '298.998983887')
    await expect(summary).to_have_attribute('data-feature-mz', '427.30320051521875')
    await expect(summary).to_have_attribute('data-feature-intensity', '11692402688')
    await expect(summary).to_have_attribute('data-feature-charge', '1')
    await expect(summary).to_have_attribute('data-feature-traces', '4')
    await expect(footprints.locator('[data-lcms-hull]')).to_have_count(4)
    await expect(chromatogram.locator('[data-lcms-scan]')).to_have_count(35)
    await expect(feature).to_have_value('F29')
    await expect(ion_trace).to_have_value('M+0')
    await check_scan(1210, '298.998983887', '3163138048', 'M+0')
    await check_window('M+0', 427.30320051521875, 427.2989274832136, 427.3074735472239,
                       [288.919154559, 309.036977023, 427.3028869628906, 427.3040466308594])

    await scan.press('ArrowRight')
    await check_scan(1215, '300.234997455', '1919350784', 'M+0')
    await ion_trace.select_option('M+1')
    await expect(footprints.locator('[data-lcms-trace="M+1"]')).to_have_attribute('data-active', 'true')
    await check_scan(1215, '300.234997455', '465397024', 'M+1')
    await check_window('M+1', 428.3042675160236, 428.2999844733484, 428.30855055869876,
                       [296.838789231, 309.036977023, 428.3023986816406, 428.3056335449219])

    # Click/tap the real scan's projected x-coordinate on the interaction overlay.
    previous_scan = chromatogram.locator(f'circle[data-lcms-scan="{native_prefix}1205"]')
    position = await previous_scan.evaluate("""mark => {
      const point = new DOMPoint(mark.cx.baseVal.value, mark.cy.baseVal.value).matrixTransform(mark.getScreenCTM())
      const area = mark.ownerSVGElement.querySelector('[data-lcms-chromatogram-target]').getBoundingClientRect()
      return { x: point.x - area.left, y: area.height / 2 }
    }""")
    await (target.tap(position=position) if touch else target.click(position=position))
    await check_scan(1205, '297.892759679', '354141824', 'M+1')

    await ion_trace.select_option('M+2')
    await scan.press('Home')
    await scan.press('ArrowRight')
    await check_scan(1145, '284.390818879', '0', 'M+2')
    await expect(chromatogram.locator('[data-lcms-scan][data-missing]')).to_have_count(0)

    # A separated feature tests direct map selection at both viewport sizes.
    feature_target = overview.locator('[data-lcms-feature="F75"] [data-lcms-feature-target]')
    await (feature_target.tap() if touch else feature_target.click())
    await expect(feature).to_have_value('F75')
    await expect(summary).to_have_attribute('data-lcms-feature-summary', 'F75')
    await expect(overview.locator('[data-lcms-feature="F75"]')).to_have_attribute('data-active', 'true')
    await expect(footprints.locator('[data-lcms-hull]')).to_have_count(2)
    await check_scan(2218, '544.292637967', '223234.046875', 'M+0')
    await feature.select_option('F29')
    await check_scan(1210, '298.998983887', '3163138048', 'M+0')


async def check_spectral_waterfall(plot, slug, touch=False):
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
    if slug == 'spectral-waterfall-xrd':
        await check_xrd_waterfall_fit(plot, readout, touch)
    else:
        await expect(plot.locator('[data-xrd-waterfall-fit]')).to_have_count(0)


async def check_xrd_waterfall_fit(plot, measurement, touch):
    fixture = CATALOG.parent / 'charts/scientific/waterfall/xrd-measurements.json'
    data = json.loads(fixture.read_text())
    bins, scans = data['spectralBins'], data['scanValues']
    panel = plot.locator('[data-xrd-waterfall-fit]')
    tracker = panel.locator('[data-xrd-peak-tracker]')
    empty = panel.locator('[data-xrd-waterfall-empty]')

    async def check_measurement(scan_index, bin_index, bin_tolerance=0):
        await expect(measurement).to_have_attribute('data-scan-index', str(scan_index))
        accepted_bins = '|'.join(str(index) for index in range(bin_index - bin_tolerance, bin_index + bin_tolerance + 1))
        await expect(measurement).to_have_attribute('data-bin-index', re.compile(f'^(?:{accepted_bins})$'))
        selected_bin = int(await measurement.get_attribute('data-bin-index'))
        expected_intensity = data['intensityRows'][scan_index][selected_bin]
        actual_intensity = float(await measurement.get_attribute('data-intensity'))
        if not math.isclose(actual_intensity, expected_intensity, rel_tol=0, abs_tol=1e-9):
            raise RuntimeError(f'Unexpected measured XRD intensity for scan {scan_index}, bin {selected_bin}: {actual_intensity}')
        return selected_bin

    async def check_fit(peak, temperature, center, fwhm, height):
        await expect(empty).to_have_count(0)
        await expect(tracker).to_have_attribute('data-peak', peak)
        await expect(tracker.locator('select, input, .xrd-profile-pick, .xrd-trend-pick')).to_have_count(0)
        readout = tracker.locator('output[data-xrd-readout]')
        await expect(readout).to_have_attribute('data-temperature', temperature)
        for metric, value in [('center', center), ('fwhm', fwhm), ('height', height)]:
            await expect(readout).to_have_attribute(f'data-{metric}', value)
            cursor = tracker.locator(f'[data-xrd-trend][data-metric="{metric}"] [data-xrd-trend-cursor]')
            await expect(cursor).to_have_attribute('data-temperature', temperature)
            await expect(cursor).to_have_attribute('data-value', value)

    async def pick(view, frame, horizontal, vertical):
        await view.scroll_into_view_if_needed()
        position = await view.evaluate("""(svg, [frame, horizontal, vertical]) => {
            const bounds = svg.querySelector(frame).getBBox();
            const point = new DOMPoint(bounds.x + horizontal * bounds.width, bounds.y + vertical * bounds.height)
                .matrixTransform(svg.getScreenCTM());
            const viewport = svg.getBoundingClientRect();
            return {x: point.x - viewport.left, y: point.y - viewport.top};
        }""", [frame, horizontal, vertical])
        if touch:
            await view.tap(position=position)
        else:
            await view.click(position=position)

    await expect(empty).to_be_visible()
    await expect(tracker).to_have_count(0)
    spectral_bin = plot.get_by_role('slider', name='Spectral bin')
    await expect(spectral_bin).to_have_attribute('max', str(len(bins) - 1))
    await expect(plot.get_by_role('slider', name='Scan', exact=True)).to_have_attribute('max', str(len(scans) - 1))
    await spectral_bin.fill('64')
    await check_measurement(0, 64)
    await check_fit('peak-low', '10.91', '5.200343275', '0.0250630084', '90.96446705')
    profile = tracker.locator('svg[data-xrd-profile]')
    await check_xrd_profile(profile)
    fit_path = profile.locator('path[data-xrd-fit]')
    initial_path = await fit_path.get_attribute('d')

    await plot.get_by_role('group', name='Spectral waterfall', exact=True).press('ArrowDown')
    await expect(plot.locator('[data-waterfall-selected-scan="1"][data-waterfall-selected-bin="64"]')).to_be_visible()
    await check_measurement(1, 64)
    await check_fit('peak-low', '29.019', '5.197808971', '0.02577902814', '135.2612876')
    await expect(fit_path).not_to_have_attribute('d', initial_path)

    await spectral_bin.fill('80')
    await check_measurement(1, 80)
    await expect(empty).to_be_visible()
    await expect(tracker).to_have_count(0)

    await plot.get_by_role('tab', name='Heatmap').click()
    heatmap = plot.locator('[data-spectral-view="heatmap"] svg')
    bin_min = bins[0] - (bins[1] - bins[0]) / 2
    bin_max = bins[-1] + (bins[-1] - bins[-2]) / 2
    scan_min = scans[0] - (scans[1] - scans[0]) / 2
    scan_max = scans[-1] + (scans[-1] - scans[-2]) / 2
    await pick(heatmap, '.spectral-heatmap-missing', (bins[96] - bin_min) / (bin_max - bin_min),
               (scan_max - scans[7]) / (scan_max - scan_min))
    # A browser may round the pick to the neighboring measured bin on a narrow plot.
    middle_bin = await check_measurement(7, 96, bin_tolerance=1)
    await check_fit('peak-middle', '144.29', '5.295454796', '0.02075437752', '108.6561838')

    await plot.get_by_role('tab', name='Spectrum', exact=True).click()
    spectrum = plot.locator('[data-spectral-view="spectrum"] svg')
    await check_measurement(7, middle_bin)
    await check_fit('peak-middle', '144.29', '5.295454796', '0.02075437752', '108.6561838')
    await pick(spectrum, '.spectral-view-axis', (bins[115] - bins[0]) / (bins[-1] - bins[0]), 0.5)
    await check_measurement(7, 115, bin_tolerance=1)
    await check_fit('peak-high', '144.29', '5.358128979', '0.02017690145', '63.56737184')

    await spectrum.press('End')
    await check_measurement(7, len(bins) - 1)
    await expect(empty).to_be_visible()
    await expect(tracker).to_have_count(0)


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
