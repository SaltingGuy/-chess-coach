# Optional: a bundled copy of Stockfish

By default the app downloads Stockfish (the browser build by nmrugg, "stockfish.js") from a public
CDN the first time you analyse a game. Your browser then caches it.

If you host the app on a web address (for example GitHub Pages) and want it to work fully offline,
put these two files in this folder:

- `stockfish.js`
- `stockfish.wasm`

You can get them from https://github.com/nmrugg/stockfish.js (the `Stockfish11` branch, `src/` folder).
The app tries this folder first, then the CDN, and finally falls back to its small built-in engine.

Stockfish is licensed under the GNU GPL v3 (see https://stockfishchess.org).
Note: browsers do not allow engines to start from a page opened directly as a file (file://),
so the bundled copy is only used when the app is served from a web address.
