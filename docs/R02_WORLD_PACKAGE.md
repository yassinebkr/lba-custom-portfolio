# R02 — Portable world package contract

The world package is a versioned JSON document consumed by editing tools and runtime adapters. The authoring project owns image generation. Each runtime adapter translates the exported data into its execution format.

~~~mermaid
flowchart LR
  STUDIO["Creator and Blender pipeline"] --> PACKAGE["WorldPackage v1"]
  PACKAGE --> CHECKS["Validation and provenance"]
  CHECKS --> DOS["LBA DOS adapter"]
  CHECKS --> WEB["Independent browser runtime"]
  DOS --> EMU["DOS engine via js-dos"]
  WEB --> STATIC["Static Web runtime"]
~~~

## Document structure

~~~json
{
  "schemaVersion": 1,
  "id": "example-world",
  "name": "Example workshop",
  "entrySceneId": "workshop",
  "assets": [],
  "scenes": []
}
~~~

An asset records authorship, license, sprite atlas, global frame size, pivot, footprint and four camera-direction frames. A scene records its dimensions, independent instances, original background image and interaction labels. The package uses creator-defined spatial coordinates in X/Z grid cells. Renderer-specific palette indices and binary archive offsets belong in export adapters.

The reusable contract lives in `packages/world-package/` with type declarations in `index.d.mts`. It relies on the existing `packages/asset-schema/` validation rules.

## Accepted image sources

R02 accepts PNGs with bounded dimensions. File paths are package-root relative and validated against traversal. Asset approval is explicit. Review-pending art remains usable in local compatibility experiments.

### Relationship constraints

- Every instance references a declared asset ID.
- Every scene has a distinct ID.
- Every sprite has exactly four standard viewing directions.
- Each frame rectangle fits its atlas.
- Sprites maintain an independent draw pivot and collision footprint.
- The entry scene refers to an existing scene.
- Images are inspected for PNG signature, file size and declared atlas dimensions.

## Example and verification

`examples/world-package/telemetry.json` references the actual original V5 192px telemetry atlas and the original V7 workshop background already in this repository. Its source artwork remains in review.

~~~bash
node scripts/runtime/validate-world.mjs examples/world-package/telemetry.json --root .
node --test tests/runtime-world.test.mjs tests/runtime-files.test.mjs
~~~

The `--require-approved` option enables the public distribution gate. The example is expected to fail that gate until the rights and artistic review has been explicitly completed.

R03 will use the same world JSON to produce DOS-compatible resources. The schema stays free of HQR structures, palette restrictions and js-dos launch settings.
