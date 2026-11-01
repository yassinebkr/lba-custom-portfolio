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
