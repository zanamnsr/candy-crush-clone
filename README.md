# Jewel Cascade

A gem-matching puzzle game inspired by Candy Crush, built as an installable Progressive Web App. Swap jewels, set off cascades and crack the frost, on your phone or in a browser, online or offline.

- **36 levels** across six chapters, with score, frost-clearing and gem-collecting goals, move limits and 1–3 stars
- **Endless** mode with no move limit, and **Time attack** (90 seconds)
- **Special gems:** Line gem (match 4), Set gem (L or T match), Prism (match 5), plus combos when two specials are swapped together
- **9×9 board** with 5–7 gem colours as levels get harder; every gem has its own shape as well as its own colour
- Swipe or tap-tap controls, synthesised sound effects, vibration on Android, idle hints, and progress saved on the device

## Install it on your phone

1. Open the deployed site on your phone.
2. **Android (Chrome):** tap **Install app** on the home screen of the game (or use Chrome's menu → *Install app*).
3. **iPhone (Safari):** tap **Install app** for the steps, or tap **Share** → **Add to Home Screen**.

Once installed, it opens full screen with its own icon and plays offline.

## Deploy on Vercel

It's a static site with no build step.

1. In Vercel, choose **Add New → Project** and import this repository.
2. Leave **Framework Preset** as *Other*, with no build command and the output directory as the project root.
3. Click **Deploy**. Every push to `main` redeploys.

`vercel.json` sets the headers the PWA needs: the service worker and manifest are never cached stale, and icons are cached for a week.

## Run it locally

Service workers need `http://`, so serve the folder rather than opening the file:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Project layout

```
index.html             App shell and screens
css/styles.css         All styling
js/engine.js           Game logic: matching, specials, combos, frost, gravity, levels (no DOM; runs in Node too)
js/gems.js             Canvas artwork for the gems, frost and Prism
js/game.js             Screens, touch input, animation, sound, haptics, saving, install prompt
sw.js                  Service worker: offline caching
manifest.webmanifest   PWA manifest (name, colours, icons)
icons/                 App icons (standard, maskable, Apple touch, favicon)
tools/icon.html        Draws the app icon from the game's own gem artwork
tools/make-icons.py    Exports every icon size from tools/icon.html
tools/simulate.js      Bot that plays each level, for balancing difficulty
```

## Making changes

- **Shipping an update:** bump `VERSION` in `sw.js` whenever you change a file, so installed copies fetch the new version. Players get it the next time they open the game.
- **Regenerating icons:** `pip install playwright && python -m playwright install chromium`, then `python tools/make-icons.py`.
- **Tuning levels:** edit `LEVEL_DEFS` in `js/engine.js` (moves, score target, frost pattern, collect goals), then check balance with `node tools/simulate.js 30` (30 runs per level) or `node tools/simulate.js 30 12,24` for specific levels.
