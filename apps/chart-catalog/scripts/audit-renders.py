"""Render every local example or reference preview at four profiles."""

import argparse
import asyncio
import json
import os
from pathlib import Path
from urllib.parse import urlencode

from playwright.async_api import async_playwright


CATALOG = Path(__file__).resolve().parents[1] / 'src/catalog-data.json'
REFERENCE = 'https://www.shadcn.io/charts-preview/react/index.html'
PROFILES = [
    (f'{size}-{theme}', width, height, theme)
    for size, width, height in [('desktop', 1440, 900), ('mobile', 390, 844)]
    for theme in ['light', 'dark']
]


async def run(browser, queue, results, local_url):
    while not queue.empty():
        try:
            profile, examples = queue.get_nowait()
        except asyncio.QueueEmpty:
            return
        name, width, height, theme = profile
        page = await browser.new_page(viewport={'width': width, 'height': height})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        if local_url:
            await page.add_init_script(f'''(() => {{
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
                    await page.evaluate('(id) => { location.hash = "example=" + id }', slug)
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
    results = {name: {} for name, *_ in PROFILES}
    queue = asyncio.Queue()
    for profile in PROFILES:
        for start in range(0, len(examples), 56):
            queue.put_nowait((profile, examples[start:start + 56]))
    async with async_playwright() as playwright:
        if args.browser == 'edge':
            browser = await playwright.chromium.launch(channel='msedge')
        elif args.browser == 'chromium':
            browser = await playwright.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH'))
        elif args.browser == 'firefox':
            browser = await playwright.firefox.launch()
        else:
            browser = await playwright.webkit.launch()
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
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument('--local', help='URL of the running gallery')
    target.add_argument('--reference', action='store_true', help='Use the live shadcn.io React preview')
    parser.add_argument('--browser', choices=['chromium', 'firefox', 'webkit', 'edge'], default='chromium')
    parser.add_argument('--workers', type=int, default=4, choices=range(1, 9))
    parser.add_argument('--report', type=Path, help='Optional JSON output with all results')
    raise SystemExit(asyncio.run(audit(parser.parse_args())))
