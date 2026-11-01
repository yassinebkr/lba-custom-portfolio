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
