# Original photo/model → sprite production (J4 WIP)

This folder contains a **working deterministic local preparation tool** and a **Blender multi-view renderer adapter**, not a one-click AI reconstruction system.

## Separate truthful source routes

| Input | Output | Limitation |
| --- | --- | --- |
| Transparent PNG / photo prepared as PNG | One angle, pixelized transparent sprite | Hidden/back faces cannot be inferred from one photo |
| Multiple ordered PNG frames | Shared-palette sprite atlas and frame manifest | All frames must have consistent perspective, dimensions and pivot |
| Original GLB / glTF model | Four genuine isometric angles rendered in Blender | Needs Blender 4.x, working glTF geometry and separate review |
| Scene photograph or artwork | Visual reference for editable scene composition | A flattened image is NOT a scene model |

## Use

Install the only image-processing dependency:

\`\`\`bash
python3 -m pip install Pillow
python3 pipeline/asset_factory.py \
  --input input/original-camera.png \
  --out output/sprites --id camera-rig --kind prop \
  --creator "project-owner" --size 64x64 --colors 64
\`\`\`

Optional solid backdrop removal: \`--background '#ffffff' --tolerance 10\`. This is simple background-key removal, **not semantic segmentation**. It requires a clean contrast background and should be visually checked.

To render real 3D angles, export an original GLB model then run:

\`\`\`bash
blender -b --python pipeline/blender/render_iso.py -- \
  --input models/original-asset.glb --output output/views --size 256
\`\`\`

Pack those independently rendered views using \`--input output/views/ne.png output/views/nw.png output/views/sw.png output/views/se.png --method blender-3d\`. They remain separate ordered frames; the exporter does **not** yet store a typed direction→frame map and so J4 remains open.

For public use the generated manifest defaults to \`reviewStatus=pending\` and \`allowedForPublicBuild=false\`. \`--approve\` is an explicit opt-in **after** verifying original/licensed content and visual quality. The manifest contains hash, pivot, frame dimensions and loop timing.

## Test

\`\`\`bash
python3 -m unittest discover -s pipeline/tests -v
\`\`\`

The test sources are procedurally generated in memory. No original LBA image is used.

## Remaining before J4 completion

Compare segmentation candidates on real rights-cleared photographs; evaluate existing open-source generators with reproducible GPU/Blender setups; retain UV/rigger sources; implement typed directional frame mapping, batch job queue and scene reference images; verify with an actual character and three distinct props, including screenshots.
