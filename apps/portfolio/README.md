# Project Atlas — J1 static proof

This independent and original isometric portfolio prototype is deliberately isolated from the historical LBA/js-dos mod. It contains no original game binaries, scenes, extracted images or textures.

From the repository root run \`python3 -m http.server 8765\`, then browse \`http://localhost:8765/apps/portfolio/\`. For GitHub Pages the \`apps/portfolio/\` directory must be the **only published artifact**, at \`https://yassinebkr.github.io/lba-custom-portfolio/\`. All module URLs are relative. Do not publish \`web_deploy/\`.

Controls: WASD/arrows to move, E/Inspect to examine a nearby exhibit, Escape to clear; on-screen buttons are available for touch. The HTML project list is always accessible without canvas interaction.

Tests: \`node --test apps/portfolio/rules.test.mjs\` (requires Node 20+).

Important: this is an early technical prototype, NOT the complete J1 milestone until verified against an actual GitHub Pages URL and tested on desktop/mobile. It uses procedural placeholder art and a zero-dependency Canvas2D renderer. The final asset pipeline, Studio UI and Phaser suitability remain later milestones.

## J7: original room navigation slice

A separate `rooms.mjs` now defines six original, gameplay-compatible rooms (Showroom, Origin, Imaging, Fabrication, Field Lab, and Interfaces). Each has four informational exhibits, independent local map data, HTML directory fallback and keyboard/touch movement. This is **not the completed J7 art/content gate**: most stations still use the original prototype's procedural placeholders, and Studio exports are not yet automatically compiled into runtime rooms.
