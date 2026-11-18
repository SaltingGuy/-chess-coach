# Stockfish (bundled copy)

The app looks for `stockfish.js` + `stockfish.wasm` in this folder first, then downloads Stockfish 19 Lite
(nmrugg/stockfish.js, the "lite single-threaded" NNUE build) from the jsDelivr CDN, and only as a last resort
the old Stockfish 10. If nothing loads, it falls back to its small built-in engine and says so.

On the website (repo SaltingGuy/-chess-coach) the bundled files are fetched by the GitHub job
`.github/workflows/stockfish.yml`, which downloads the `stockfish` npm package, copies the lite single-threaded
build here and records the version and checksums in `SOURCE.txt`. To update, change `VERSION` there.

The single-threaded build is used because GitHub Pages cannot send the headers that multi-threaded
WebAssembly needs. Browsers do not start engines from a page opened as a file (file://).

Stockfish is licensed under the GNU GPL v3 (see https://stockfishchess.org).
