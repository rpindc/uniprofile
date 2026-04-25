# Legacy React App

This folder contains a React/Vite scaffold that was built in parallel with the
static `index.html` at the repo root. It is **not deployed** and is kept here
for archaeology and as a potential starting point for a future migration.

## Why it's here

The React app (`src/App.jsx`) uses different API paths and a different design
system than the live app. It was superseded by the static `index.html` which
is the canonical deployment target served by Amplify.

Last touched: 2026-04-24 (commit e307ab45 — "Switch to AccessToken for API auth")

## To run locally (if needed)

From the repo root, `node_modules/` is already installed:

```
cd ..
npx vite --config _legacy-react-app/vite.config.js --root _legacy-react-app
```

## Do not deploy

`amplify.yml` serves `index.html` from the repo root — not this folder.
