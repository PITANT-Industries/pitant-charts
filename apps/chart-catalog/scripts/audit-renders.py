"""Check the public documentation and render every catalog example across viewport and theme profiles."""

import argparse
import asyncio
import json
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
    families = {'spectrum', 'spectrogram', 'spectral-waterfall', 'correlation-matrix', 'process-control'}
    examples = [example for family in catalog if family['id'] in families for example in family['examples']]
    page = await browser.new_page(viewport={'width': 390, 'height': 844}, reduced_motion='reduce')
    try:
        await page.goto(local_url, wait_until='domcontentloaded', timeout=20000)
        rail = page.get_by_role('navigation', name='Popular chart families')
        await rail.get_by_role('button', name='Scientific analysis').click(timeout=8000)
        await page.wait_for_url(f'{local_url}#category=scientific', timeout=8000)
        await expect(page.locator('.example-grid .example-card-link')).to_have_count(len(examples))
        await page.get_by_role('link', name=f'Documentation for {examples[0]["title"]}', exact=True).click(timeout=8000)

        for index, example in enumerate(examples):
            slug = example['id']
            fragment = urlencode({'docs': example['family'], 'variant': slug})
            if index:
                await page.goto(f'{local_url}#{fragment}', wait_until='domcontentloaded', timeout=20000)
            await page.wait_for_url(f'{local_url}#{fragment}', timeout=8000)
            preview = page.locator('#docs-preview')
            plot = preview.locator(f'.docs-example-plot[data-example-id="{slug}"]')
            waterfall = example['family'] == 'spectral-waterfall'
            if waterfall:
                await check_spectral_waterfall(plot, slug)
            else:
                await plot.locator('canvas').first.wait_for(state='visible', timeout=8000)
                await expect(plot.locator('[data-scientific-ready]')).to_have_count(1, timeout=8000)
            await expect(page.get_by_role('list', name='Data sources')).to_be_visible()
            if slug == 'spectrum-measured':
                await plot.get_by_role('slider', name='Frequency bin').press('Home')
                await expect(plot.locator('output')).to_contain_text('0.025 cycles/year')
            elif slug == 'correlation-matrix-measured':
                await plot.get_by_role('combobox', name='Column variable').select_option('0')
                await expect(plot.locator('output')).to_contain_text('Pearson r = 1')
            await preview.get_by_role('tab', name='Code', exact=True).click(timeout=8000)
            await expect(preview.locator('pre code')).to_contain_text('SpectralWaterfall' if waterfall else '@pitant/charts-react')
            await expect(preview.get_by_role('button', name='Copy code', exact=True)).to_be_visible()
    finally:
        await page.close()


async def check_spectral_waterfall(plot, slug):
    ridges = plot.locator('[data-waterfall-ridge]')
    await ridges.first.wait_for(state='attached', timeout=8000)
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
    catalog = json.loads(CATALOG.read_text())
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
