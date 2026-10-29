# Rust computation ownership

- Put project-owned CPU-intensive algorithms in Rust: geometry processing, camera and structure transforms, animation interpolation, gesture interpretation, and bulk numerical work. Keep portable algorithms in `crates/renderer` and expose browser commands through `crates/wasm`.
- Keep TypeScript responsible for React UI, study navigation, DOM measurements, input capture, networking, browser resource lifecycle, and scheduling. Forward commands and display results instead of reproducing Rust algorithms.
- Keep large numerical buffers and intermediate animation state in Rust. Batch commands across the WASM boundary; avoid transferring per-structure offsets or rebuilding numerical arrays every frame.
- Run long independent CPU jobs in Workers when they would block the UI. Reuse existing workers and transferable buffers. Rust/WASM on the main thread is not automatically asynchronous or parallel.
- Keep GPU rendering in WebGL/GLSL and landmark inference in the existing MediaPipe worker. Rust owns the interpretation of those landmarks; language ownership alone is not a reason to replace specialized engines.
- Preserve the shared browser/Tauri path, stable source IDs, validation, cancellation, reduced motion, and cleanup when moving ownership.
- Cover moved algorithms with Rust tests and verify their real WASM/runtime integration. Measure CPU/GPU work before claiming a speedup or moving additional hotspots; ordinary UI loops do not require a Rust migration.
