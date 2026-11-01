# Blender look-development lighting — V4

Render **only original models**. The V3 golden-sample generator remains a local engineering source, not portfolio-approved artwork.

Lighting is intentionally shared across the four isometric views: warm upper-left large area key, gentle cool front fill, warm rear rim, and a neutral world with restrained ambient contribution. Materials are physically differentiated through roughness, metalness and emissive display properties rather than a flat palette. Geometry has chamfers, housing seams, real extruded controls, metal ports, rubber, and branded-neutral non-text labels.

The Cycles CPU workflow uses 56 samples, denoising, 16-bit RGBA PNGs at 768x768 source, Standard color management with Medium High Contrast. The entire object is framed with a common orthographic lens, fixed pivot and camera angles.

Run the original model through:

~~~bash
blender -b --python pipeline/blender/tests/build_original_fixture.py -- /tmp/atlas-golden.glb
blender -b --python pipeline/blender/render_iso.py -- --input /tmp/atlas-golden.glb --output /tmp/atlas-golden-renders --size 768
~~~

Source renders are deliberately not modified/overwritten by quantization. Do not publish original GLB, Blender scripts or unreviewed sprites in GitHub Pages; CI publishes only QA artifacts. The release scene needs an independent approved-art gate.

Blender headless support and image-quality evaluation are checked in GitHub Actions. Renderer and material parameters can be tuned in V5 comparison, but art approval remains a human decision.


## V5 — reversible comparison matrix

The V1 binary-alpha problem is fixed **in this independent experiment**, without silently changing legacy production exports. The script reads unchanged four-direction Blender RGBA images and resizes each *full canvas* at a common origin, never cropping orientations individually.

    python pipeline/visual_matrix.py /tmp/atlas-golden/animation.json --out /tmp/atlas-v5

Compare the 24 actual PNG sheets in /tmp/atlas-v5/index.html (3 output sizes x 2 reduction filters x 4 color variants) and the machine-readable matrix.json. A truecolor version at each resolution is always kept, as are 96/160/256-color quantized variants. Alpha coverage is preserved byte-for-byte through quantization, unlike the previous threshold-based exporter.

Dark/light RMSE measures pixel deviation versus the corresponding same-filter truecolor candidate, *not artistic quality*. Reviewer approval is required to choose a preset; V6–V8 are not part of this autonomous scope.
