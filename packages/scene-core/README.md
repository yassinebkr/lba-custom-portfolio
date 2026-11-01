# M4 — Scene composition independent from LBA archives

This module extracts the actual valuable logic from main/scripts/hqr-tools/render-scene.js: dimetric projection, painter-order drawing, offsets and per-instance placement. It accepts **only user-authored original scene objects and sprites**. No GRI/BLL/HQR import or reused game rooms.

Each instance retains an ID, grid coordinates, height, action and direction. Collidable objects use explicit footprints. Sprites and bricks use their PNG atlas rectangles, not primitive rectangles. drawScene renders actual loaded images and fails when the referenced asset is absent. It never averages repeated bricks or fuses distinct occurrences into a single flattened tile.

The schema is a compositing contract. The existing browser game currently still uses procedural fallbacks; connecting it to approved PNGs is M5. **M4 does not produce final art and is not artistic acceptance.**

Test: node --test packages/scene-core/scene.test.mjs
