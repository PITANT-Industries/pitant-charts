"""Render every catalog example in desktop and mobile light and dark profiles."""

import argparse
import asyncio
import json
import os
import re
from pathlib import Path
from urllib.parse import urlencode, urlsplit

from playwright.async_api import async_playwright, expect


CATALOG = Path(__file__).resolve().parents[1] / 'src/catalog-data.json'
PROFILES = [
    (f'{size}-{theme}', width, height, theme)
    for size, width, height in [('desktop', 1440, 900), ('mobile', 390, 844)]
    for theme in ['light', 'dark']
]


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
        await preview.locator(f'.docs-example-plot[data-example-id="{slug}"]').wait_for(timeout=8000)
        await preview.get_by_role('tab', name='Code', exact=True).click(timeout=8000)
        await expect(preview.locator('pre code')).to_contain_text(f"getExample('{slug}')", timeout=8000)
        await expect(preview.get_by_role('button', name='Copy code', exact=True)).to_be_visible()
    finally:
        await page.close()


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
    args = parser.parse_args()
    raise SystemExit(asyncio.run(audit(args)))
