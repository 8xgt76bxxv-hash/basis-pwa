# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Basis is a static, installable portfolio PWA hosted on GitHub Pages (`.nojekyll`). It has no build step, no package.json, no dependencies to install and no test suite. The files in the repo root are exactly what ships. Holdings live in `localStorage` on the device. The example portfolio, price history and market quotes are illustrative. The price history is generated deterministically from seeded random walks anchored to a fixed `TODAY`.

## Running it

Serve the repo root over HTTP. The service worker and the manifest need a real origin, not `file://`:

```sh
python3 -m http.server 8000          # or: npx http-server -c-1 -p 8000
```

The service worker is network-first, so a reload picks up edits. If something looks stale, use DevTools → Application → "Update on reload" or unregister the worker.

Before shipping, check:
- `node --check app.js && node --check sw.js` (syntax).
- Lighthouse (`npx lighthouse http://localhost:8000/`) for Performance, Accessibility, Best Practices and SEO. Installability is not a Lighthouse category any more. Check it in DevTools → Application → Manifest.
- The browser console must show no CSP violations.

## Layout

- `index.html` has the markup for all four views (Portfolio, Breakdown, Markets, Settings), all CSS inline, the CSP meta tag, and `<script src="app.js" defer>`.
- `app.js` is all behaviour, in one ES5-style IIFE (`var`, `function`, no arrow functions or modules). Keep that style.
- `sw.js` is the service worker: network-first, falling back to cache.
- `manifest.webmanifest` and `icon-*.png` cover install.

## Architecture (app.js)

- **Data model.** `ACCOUNTS` (`{id,name,firm,color,off?}`) and `HOLDINGS` (`{acct,tick,name,cls,shares,price,cost,day,yield,mix?,region?,cat?,bought?,held?}`) are seeded from `SEED_*`, persisted by `save()` under `localStorage["basis.v2"]` and read by `load()`.
  - The `cls` values `property / vehicle / collectible / other / loan` (the `OFF` set) count towards net worth only, never towards the portfolio total or the chart.
- **Load-time validation.** `load()` rebuilds every record through `cleanAccount` / `cleanHolding`, a field-by-field allowlist.
  - **If you add a field to a holding or account, add it there too, or it is silently dropped on the next load.**
- **Rendering.** `renderAll()` calls one `render*()` per view. Each builds HTML strings and assigns them to `innerHTML`.
  - Every user- or storage-derived string must go through `esc()`. Numbers go through the `usd` / `pct` / `signed` helpers.
- **Events.** One delegated `document` click listener dispatches on `data-*` attributes (`data-tab`, `data-acct`, `data-sheet`, `data-hold`, …). New controls get a `data-` attribute and a branch there; don't attach per-element listeners on re-rendered markup.
- **Sheets.** All modal UI is one bottom sheet (`#sheet`), filled by `openSheet(title, html, after)`. Wire up the sheet's own controls inside `after`.
  - `closeSheet()` and `unstick()` undo the body scroll-lock. That works around iOS taps being swallowed after a sheet, so keep both paths in sync.
  - Never focus a text field when a sheet opens: on iOS that raises the keyboard and breaks later taps.
- **Import pipeline.** A pasted list, a scanned screenshot (OCR) and an import all take the same path: `parseRows(text)` → `buildPlan(rows, acct)` → the `sheetReview` confirmation → `applyPlan`. Nothing is written before the review is confirmed.
- **OCR.** `tesseract.js` is lazy-loaded from jsDelivr, pinned by version *and* by the `OCR_SRI` hash.
  - Upgrading it means updating `OCR_SRC`, recomputing `OCR_SRI` (`openssl dgst -sha384 -binary tesseract.min.js | base64 -w0`), and re-testing under the CSP. The worker, the wasm core and the language data also come from cdn.jsdelivr.net.
- **Boot.** `#app` stays `visibility:hidden` until the first `renderAll()` adds `.ready`, which prevents layout shift from the deferred script.

## Things that must change together

- **CSP** (meta tag in `index.html`): any new script, connect, image or worker origin, or any inline `<script>`, needs a policy change. Inline scripts are not allowed. Inline `style=""` attributes are.
- **Service worker**: when you add or rename a shell file, update `SHELL` and bump `CACHE` in `sw.js`.
- **Paths** stay relative (`./`, `app.js`), because the site is served from a `/<repo>/` subpath.

## UI conventions

The CSS header comments define the design system, and new UI should stay inside it:
- Eight type steps (`--t-*`), each an iOS text style.
- A 4pt spacing grid (`--s-*`).
- Five radii.
- Exactly two text rails (`--rail`, `--rail-dot`).
- Green and red are reserved for gain and loss, never used as category colours.
- Inputs are ≥17px so iOS Safari doesn't zoom.
- Compact controls get a 44pt hit area via `::before` overlays (`.tap44`).
