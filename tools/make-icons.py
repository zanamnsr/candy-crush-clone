"""Export the app icons from tools/icon.html into /icons.

Needs Python Playwright and a Chrome/Chromium build:
    pip install playwright && python -m playwright install chromium
    python tools/make-icons.py
"""
import asyncio, base64, pathlib, shutil
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "icons"
SIZES = [  # (file name, pixel size, maskable)
    ("icon-192.png", 192, False),
    ("icon-512.png", 512, False),
    ("maskable-192.png", 192, True),
    ("maskable-512.png", 512, True),
    ("apple-touch-icon.png", 180, False),
    ("favicon-32.png", 32, False),
]

async def main():
    OUT.mkdir(exist_ok=True)
    chrome = shutil.which("google-chrome") or shutil.which("chromium")
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=chrome) if chrome else await p.chromium.launch()
        page = await browser.new_page()
        await page.goto((ROOT / "tools" / "icon.html").as_uri())
        for name, size, maskable in SIZES:
            # Draw at 2x and let the browser downscale, for cleaner edges at small sizes.
            data = await page.evaluate(
                """([s, m]) => { const big = render(s * 2, m), c = document.createElement('canvas');
                     c.width = c.height = s; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
                     x.drawImage(big, 0, 0, s, s); return c.toDataURL('image/png'); }""",
                [size, maskable],
            )
            (OUT / name).write_bytes(base64.b64decode(data.split(",", 1)[1]))
            print("wrote", OUT / name)
        await browser.close()

asyncio.run(main())
