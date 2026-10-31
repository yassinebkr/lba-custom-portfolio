# Source photo / model to isometric game assets — pipeline design

Status: **J0 design and research; not implemented (J3/J4/J5/J6 later)**.
The workflow covers **characters, furniture, electronics, props, whole rooms, and interaction animations**, not characters alone.

## Ingest and provenance (common to all asset kinds)

Input: one or more photos, 3D files (GLB/GLTF/OBJ/FBX), an original drawing, a reference board or an existing master.
Store source hash, author/permission, license, link, any AI/model-use restrictions, scene intent, model/tool version and edit history. Never automatically mark web-scraped or AI-generated material as cleared for redistribution.

A photo has no reliable hidden-face geometry. Offer **reference-guided 2D painting** or **photo → approximate 3D mesh → manual shape/UV cleanup**; visually show uncertainty and require human review for hero props and characters.

## Canonical flow

\`\`\`text
Reference(s) + provenance / license approval
             |
      Segment / clean / crop
             |
  Editable 2D master or modeled/rigged 3D master
             |
  Deterministic isometric camera + light + scale + orientation
             |
  Render raw frames / material ID / optional occlusion shadows
             |
  Silhouette cleanup + downsample + palette quantization + dithering policy
             |
  Pivot normalization + consistent per-action frame bounding boxes
             |
  Contact sheet + turntable + diff preview + human approval
             |
  Atlas PNG/WebP + versioned JSON manifests + QA report
             |
  Asset Studio viewport -> static Portfolio Runtime
\`\`\`

Segmentation candidates must be compared to simple manual masking. Model reconstruction is optional, not an invisible required cloud API. Heavy AI inference / Blender are local; visitor's site is **purely static**.

## Output by kind

- **Character:** 4 or 8 orientations with a fixed named convention; idle/talk/walk/interact states; consistent ground pivot and frame duration. Rig source preserved, editable, with root-motion policy recorded.
- **Furniture and props:** one or more allowed rotations; separate visual sprite, ground footprint/collider, shadow, depth pivot, possible variants \`off/on/open/closed\`; optional animation.
- **Structure and rooms:** tile or mesh-derived floors, walls and static decoration; independent furniture/interactables/actors; explicit depth masks, navigation and trigger rectangles. The preview must render real per-asset layers, **not a single flattened concept image masquerading as an editable room**.
- **Interactions:** stable event/action IDs, trigger condition, timeline/state transition, frame timing, optional audio, fallback for reduced motion and pointer/keyboard.
- **All:** display size in pixels and world-grid units, separate draw pivot and collision area, source license/provenance, transparent margin diagnostics, missing direction/frame detection.

## Scene assembly & lesson from legacy

The historical \`render-scene.js\` / \`inject-scene-image.js\` inverse-map paintings onto shared bricks and use mode-pick across repeated instances. This loses unique per-cell detail; it is a useful technique, **not the data model of the new scene editor**. New scenes store per-instance placements and independent asset references (no 256-layout cap). An optional scene concept image guides composition, but independent furniture, actors and animations remain editable.

Target six narrative roles: main showroom/hub, personal intro, electronics lab, workshop, maker space, and research/AI space. Names, layouts and characters must be original rather than copying the LBA locations.

## Example manifest contract (provisional; type-check at J3)

\`\`\`json
{
  "schemaVersion": 1,
  "id": "electronics.camera-bench",
  "kind": "prop",
  "source": {
    "origin": "original-photo",
    "creator": "project-owner",
    "sourceUrl": null,
    "license": "owned",
    "attribution": null,
    "reviewStatus": "approved",
    "allowedForPublicBuild": true
  },
  "image": {
    "path": "atlas/props.webp",
    "frameWidthPx": 64,
    "frameHeightPx": 64,
    "pivotPx": { "x": 32, "y": 52 }
  },
  "footprint": {
    "widthCells": 1,
    "depthCells": 1,
    "heightCells": 1
  },
  "states": {
    "idle": {"fps": 1, "frames": [0], "loop": true},
    "active": {"fps": 6, "frames": [1, 2, 3, 2], "loop": true}
  },
  "tags": ["workbench", "interactive", "electronics"]
}
\`\`\`

This is a **design sample**, not a validated implementation. A scene manifest additionally references object IDs/instance coordinates, collision polygons, layer ordering, camera and trigger-to-action links. Prefer JSON Schema with runtime validation and TS types derived from the same definition; validate cross-asset references, not only syntax. Do not invent unexplained 'ISO depth' fields and assume renderers interpret them the same way.

## Existing repositories — candidates for spike, **not yet dependencies**

| Project | Potential reuse | Integration/licensing caveat |
| --- | --- | --- |
| https://github.com/craigrusselltiu/pseudo-pixel | Image → 3D / Blender → multi-direction character animations and Aseprite-style frame metadata | MIT code; model weights/services and generated-content rights must be checked independently; GPU cost |
| https://github.com/craigrmccown/iso-render-pipeline | Blender addon for animated isometric renders, output manifest and downsampling | Evaluate maintenance/API compatibility with installed Blender; verify code license before vendoring |
| https://github.com/MangasMango/BTRSpriteStudio | Batch model → static/animated sprites; excellent reference for inspector, timeline, queue, comparison | GPL-3.0-or-later project: do not copy code into a differently licensed repo without review |
| https://github.com/HardRockTech/3d-to-2d-sprite-pipeline | Blender multidirectional sprite export, optional normal/height/shadow maps, JSON frame metadata | MIT project; profile perf, texture sizes and source asset rights |
| https://www.mapeditor.org/ (Tiled) | Isometric scene authoring and import/export reference | Evaluate Tiled JSON format mapping; do not make external editor mandatory |

## Suggested evaluation matrix at J0/J4

Rate each candidate on: licensing and attribution; Linux/Blender compatibility; deterministic outputs; footprint and crop quality; 4/8-direction alignment; rig and non-rig props; frame metadata; batch throughput; cancellation/resume; tests; ease of embedding in local studio. Run an actual shared fixture before choosing an integration. Record decision in ADR with benchmark files and compare previews.

## Verification gates

- Provenance-check report is mandatory and fails closed for public export.
- Re-import/export of a reference asset preserves image, anchors, animation timings and manifest semantics.
- Multi-direction rendered contact sheet: orientation consistent, foot anchors stable, no transparent-fringe halos, no accidental frame cropping.
- Visual regression on sprites and scene in common zoom levels; check palette loss metrics and prevent silently discarding minority visual detail.
- Automated malformed-image, missing-file, big-input, nested path, frame-index, zero-duration, duplicate-id and invalid-collider tests.
- Pipeline outputs deterministic for fixed source/tool version and render settings, or records nondeterministic seeds/model parameters.
