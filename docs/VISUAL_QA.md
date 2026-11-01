# Visual QA — V1 baseline and loss audit

This baseline measures **actual produced files**, not a mock-up or an AI concept image. The four real 512px Blender views and packed 256px atlas from the last successful GH Actions job were inspected and the following exact observations recorded on 2026-11-01.

| Direction | Source RGBA content bbox (512px) | Packed bbox (256px) | Width of object / frame | Height / frame | Opaque RGB colors | Alpha values |
| --- | --- | --- | --- | --- | --- | --- |
| NE | [181,114,371,347] | [37,29,218,252] | 70.7% | 87.1% | 136 | 2 |
| NW | [162,168,353,359] | [37,69,218,251] | 70.7% | 71.1% | 119 | 2 |
| SW | [141,133,331,349] | [38,46,219,251] | 70.7% | 80.1% | 147 | 2 |
| SE | [159,79,350,337] | [37,5,218,251] | 70.7% | 96.1% | 136 | 2 |

**Measured limitations:**
- The prior palette conversion thresholds alpha to 0/255, losing Blender's edge coverage and producing visible jaggies/halos.
- Every direction is cropped to its own bounding box and placed on a uniform bottom baseline. This preserves an approximate foot anchor but can lose the spatial relation to the model's shared origin and moves details across views.
- Color counts here represent measured visible unique RGB colors, not a claim that a nominal palette produces exactly 160 colors.
- Source screenshots also show lighting and form ambiguity. Adding pixel resolution alone cannot repair unreadable geometry or missing roughness/material separation.

**Reproduce** on your own rendered PNG atlas:

~~~bash
python3 pipeline/visual_audit.py /tmp/atlas/atlases/telemetry-receiver.png --frame-width 256 --frame-height 256 --output /tmp/atlas/v1-audit.json
python3 -m unittest discover -s pipeline/tests -p test_visual_audit.py -v
~~~

These measurements are *geometry and output-integrity indicators*, not a scoring system for beauty. V2 defines look-development targets. V3 and V4 improve the upstream source, and V5 compares objective quality/palette/alpha under equal inputs. V6-V8 are **not authorized** in this execution.

Visual reference intent: rich readable 1990s isometric pre-rendering; no game-derived palette, sprite, model, room or textures from LBA1 are used.


## V5 QA metrics and limitations

The matrix script independently retains 24 PNG candidates. The source geometry/lighting is held constant, so relative RMSE compares only palette conversion at matching resolution and downscaler. The truecolor zero-loss reference is not automatically a winner; detail readability, alpha halos, clipping and material differentiation must be checked by humans.

The old asset_batch pipeline still has thresholded binary alpha. The new experimental visual_matrix pipeline corrects that and does **not** silently overwrite the production encoder. A final migration is a later approval decision. The new tests explicitly reject traversal, verify 24 candidates and require fractional alpha preservation.

## Verified V5 result — 2026-11-01

[Headless Blender + 24 real exports, CI successful](https://github.com/yassinebkr/lba-custom-portfolio/actions/runs/41267195377). The downloadable GitHub Actions artifact contains source PNGs, actual atlases, matrix.json, and the local HTML contact sheet. All art in this test derives from original Blender geometry and not LBA1 resources.

One shared 768px source crop **[103, 35, 665, 597]** is applied to all four orientations. This increases the 256px NE object's visible width from **113px to 154px**, around 36%, while preserving common view scale and spatial relationships.

| 256px Lanczos option | Bytes | RMSE dark/light vs truecolor | Alpha levels |
| --- | ---: | ---: | ---: |
| Truecolor | 137,088 | 0 / 0 | 256 |
| 96 colors | 106,596 | 3.693 / 3.694 | 256 |
| 160 colors | 117,976 | 2.823 / 2.824 | 256 |
| 256 colors | 123,530 | 2.397 / 2.398 | 256 |

RMSE measures palette error only, not aesthetics. Truecolor at 256px/Lanczos is the provisional fidelity benchmark; the 160-color variant saves about 14% of bytes. Neither is a finalized release preset.

V3 original model and V4 three-point PBR lighting rendered successfully at 768px. A real source render and the 24-option matrix were inspected. The test object is still a **technical golden sample** pending artistic review, and no new art was published on GitHub Pages. The old asset_batch converter still thresholds alpha; V5 safely demonstrates a better, separate exporter rather than silently changing legacy behavior.


## V6 — actual interactive comparison, 2026-11-01

[Review on GitHub Pages](https://yassinebkr.github.io/lba-custom-portfolio/sprite-demo/compare.html) once the approved branch Actions publishing workflow is complete. The comparator is intentionally *separate* from the final gameplay runtime.

~~~mermaid
flowchart LR
  SOURCE["Original 768px Blender PNG"] --> CROP["Single shared crop"]
  CROP --> TRUE["RGBA source / truecolor"]
  TRUE --> FILTER["192 / 224 / 256; BOX / Lanczos"]
  FILTER --> PALETTE["96 / 160 / 256 / RGBA"]
  PALETTE --> MATRIX["Actual V5 PNG atlas and JSON"]
  MATRIX --> VIEWER["Static V6 three-stage comparison on GitHub Pages"]
~~~

**Implementation details:** The 24 sprite atlases and four source PNGs are copied from the successful [V5 Actions artifact](https://github.com/yassinebkr/lba-custom-portfolio/actions/runs/41267195377). The importer checks all atlas SHA-256 digests, dimensions, and the pinned shared crop [103,35,665,597] before committing. The public builder repeats the validation before emitting the exact PNG/JSON files in dist. The page itself has no external dependencies; it uses same-origin PNGs.

**Browser acceptance:** Check all four orientations, two resampling filters, three sprite sizes, truecolor and the three limited palettes, actual source/truecolor/quantized canvases, changing metric values and 256 alpha levels, keyboard-accessible native selects, zoom 100/150/200%, pixelated option, background choices, nested Pages URL, and 390px mobile viewport without horizontal document overflow. Full-page desktop/mobile screenshot evidence is collected automatically.

The first interactive review used actual captures and confirms that the source and unquantized export are very similar, while palette-limited images have measurable but modest differences. No numerical score establishes whether the result meets the LBA1-inspired artistic standard. V7 scene integration and V8 final preset remain unstarted. No final gameplay asset is marked approved.

## V6 product acceptance and deferred follow-up

On 2026-11-01, the maintainer **accepted V6 as functionally sufficient** and authorized V7. A small perceived difference between views/stages 2 and 3, particularly in proportions, is expressly **deferred for investigation after V7**. Do not claim it is solved or silently adjust sprite geometry, scene pivots or the V5 atlas. Preserve the V6 comparison and its original evidence unchanged.
