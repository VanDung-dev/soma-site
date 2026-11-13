# Soma Site

A standalone, scroll-driven presentation of Soma's 3D anatomy viewer. This is a separate site project, not the full Soma web application.

- **Main Soma repository:** [VanDung-dev/soma](https://github.com/VanDung-dev/soma)
- **Upstream snapshot and file hashes:** [`UPSTREAM.json`](UPSTREAM.json)

The site was adapted from the main repository revision recorded in `UPSTREAM.json`. Changes in either repository do not automatically sync to the other.

## Requirements

- Node.js 24 or newer
- Rust 1.96 or newer and Cargo
- `wasm32-unknown-unknown` target and `wasm-pack`

```sh
rustup target add wasm32-unknown-unknown
cargo install wasm-pack --locked
npm ci
```

## Development

```sh
npm run dev
```

The development server runs at <http://127.0.0.1:5180>. The `predev` script builds the Rust/WASM modules first.

## Build and preview

```sh
npm run build
npm run preview
```

The build runs the TypeScript check, rebuilds the Rust/WASM modules, and writes the site to `dist/`. Preview serves the built site at <http://127.0.0.1:4180>.

## Manual GitHub Actions build

Open **Actions → Manual build → Run workflow** in the repository to build on demand. The workflow has no push or pull-request trigger and publishes `dist/` to the `gh-pages` branch. Configure GitHub Pages to serve the root of `gh-pages`.

## Checks

```sh
npm run check
npm test
```

`npm test` runs the TypeScript asset tests and the Rust workspace tests.

## Attribution and licensing

The main Soma source repository is the upstream project; this site's snapshot and adaptations are tracked in [`UPSTREAM.json`](UPSTREAM.json). See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE) for source and third-party license information. Model, image, icon, font, and dependency attributions are kept with their assets under `public/`.
