"""Render every local example or reference preview at four profiles."""

import argparse
import asyncio
import json
import os
from pathlib import Path
from urllib.parse import urlencode, urlsplit

from playwright.async_api import async_playwright


CATALOG = Path(__file__).resolve().parents[1] / 'src/catalog-data.json'
REFERENCE = 'https://www.shadcn.io/charts-preview/react/index.html'
PROFILES = [
    (f'{size}-{theme}', width, height, theme)
    for size, width, height in [('desktop', 1440, 900), ('mobile', 390, 844)]
    for theme in ['light', 'dark']
]
COMPARE_PROFILES = [('desktop-light', 1320, 900, 'light'), ('mobile-dark', 390, 900, 'dark')]
NARROW_CIRCLES = {
    'ring-default', 'ring-arc', 'ring-grid', 'ring-semicircle', 'pie-half-donut',
    'gauge-default', 'gauge-semicircle', 'gauge-interactive',
}
PLOT = 'svg.recharts-surface, svg[role=img], svg:has([data-mark]), svg:has([data-slice]), svg:has([data-live-line]), svg:has([data-live-skeleton]), .scatter-plot'
REFERENCE_PLOT = '#chart svg.ts-chart, #chart svg[role=img]'


async def compare_dimensions(page, slug):
    dialog = page.get_by_role('dialog')
    local = dialog.locator('.comparison-measured')
    iframe = dialog.locator(f'iframe[src*="c={slug}&"]')
    handle = await iframe.element_handle(timeout=15000)
    frame = await handle.content_frame()
    if frame is None:
        raise RuntimeError('Reference iframe unavailable')
    await frame.wait_for_url(await iframe.get_attribute('src'), wait_until='domcontentloaded', timeout=18000)
    await frame.locator('html[data-chart-ready]').wait_for(state='attached', timeout=15000)
    reference = frame.locator(REFERENCE_PLOT).first
    left, right = local.locator(PLOT).first, reference
    if slug.startswith('sparkline-'):
        left = local.locator('[data-spark-kind]')
        right = frame.locator('[data-bkm-spark] > svg')
    elif slug == 'heatmap-scroll':
        left = local.locator('.stat-heatmap-track')
    elif slug.startswith('choropleth-'):
        left = local.locator('.choropleth-stage')

    await left.first.wait_for(state='visible', timeout=10000)
    await right.first.wait_for(state='visible', timeout=10000)
    await page.evaluate("""document.fonts.load('14px "Hanken Grotesk Variable"')""")
    count = await left.count()
    if count != await right.count():
        raise RuntimeError('Plot counts differ')
    for index in range(count):
        actual = await left.nth(index).evaluate('e => [e.getBoundingClientRect().width, e.getBoundingClientRect().height]')
        expected = await right.nth(index).evaluate('e => [e.getBoundingClientRect().width, e.getBoundingClientRect().height]')
        if slug.startswith(('tree-', 'network-', 'choropleth-')):
            view_box = await right.nth(index).get_attribute('viewBox')
            if view_box:
                expected = [float(value) for value in view_box.split()[2:4]]
        if slug in NARROW_CIRCLES and expected[0] == 300 and actual[0] == 286:
            expected = [286, expected[1] * 286 / 300]
        if any(abs(a - b) > .61 for a, b in zip(actual, expected)):
            raise RuntimeError(f'Plot dimensions differ, library {actual}, reference {expected}')
    if not await dialog.evaluate('element => element.clientWidth === element.scrollWidth'):
        raise RuntimeError('Comparison dialog overflows horizontally')


async def run(browser, queue, results, local_url, compare):
    while not queue.empty():
        try:
            profile, examples = queue.get_nowait()
        except asyncio.QueueEmpty:
            return
        name, width, height, theme = profile
        page = await browser.new_page(viewport={'width': width, 'height': height}, reduced_motion='reduce')
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        if local_url:
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
                if local_url:
                    params = {'example': slug}
                    if compare:
                        params['view'] = 'compare'
                    await page.evaluate('(hash) => { location.hash = hash }', urlencode(params))
                    await page.get_by_role('heading', name=example['title'], exact=True).wait_for(timeout=8000)
                    await page.locator(f'html[data-theme="{theme}"]').wait_for(state='attached', timeout=8000)
                    plot = page.locator('.detail-plot')
                else:
                    params = urlencode({'c': slug, 'theme': theme})
                    response = await page.goto(f'{REFERENCE}?{params}', wait_until='domcontentloaded', timeout=18000)
                    if response is None or response.status != 200:
                        raise RuntimeError(f'HTTP {response.status if response else "unavailable"}')
                    selector = 'html[data-chart-ready]' + ('.dark' if theme == 'dark' else ':not(.dark)')
                    await page.locator(selector).wait_for(state='attached', timeout=12000)
                    plot = page.locator('#chart')
                if compare:
                    await compare_dimensions(page, slug)
                else:
                    output = plot.locator('svg path, svg circle, svg rect, svg polygon, svg polyline, canvas, table').first
                    await output.wait_for(state='attached', timeout=8000)
                    visible_output = await plot.evaluate('''plot => [...plot.querySelectorAll('svg, canvas, table')].some(mark => {
                        const { width, height } = mark.getBoundingClientRect();
                        return width > 0 && height > 0;
                    })''')
                    if not visible_output or await page.locator('.detail-plot [role=alert], [data-chart-error]').count():
                        errors.append('Chart output missing or error state displayed')
            except Exception as error:
                errors.append(str(error).splitlines()[0])
            results[name][slug] = list(errors)
            if errors:
                print(f'{name} {slug}: {errors[0]}', flush=True)
        await page.close()


async def audit(args):
    catalog = json.loads(CATALOG.read_text())
    examples = [example for family in catalog for example in family['examples']]
    profiles = COMPARE_PROFILES if args.compare else PROFILES
    results = {name: {} for name, *_ in profiles}
    queue = asyncio.Queue()
    for profile in profiles:
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
        await asyncio.gather(*(run(browser, queue, results, args.local, args.compare) for _ in range(args.workers)))
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
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument('--local', help='URL of the running gallery')
    target.add_argument('--reference', action='store_true', help='Use the live shadcn.io React preview')
    parser.add_argument('--browser', choices=['chromium', 'firefox', 'webkit', 'edge'], default='chromium')
    parser.add_argument('--compare', action='store_true', help='Compare local plot dimensions with the live reference')
    parser.add_argument('--workers', type=int, default=4, choices=range(1, 9))
    parser.add_argument('--report', type=Path, help='Optional JSON output with all results')
    args = parser.parse_args()
    if args.compare and not args.local:
        parser.error('--compare requires --local')
    raise SystemExit(asyncio.run(audit(args)))
