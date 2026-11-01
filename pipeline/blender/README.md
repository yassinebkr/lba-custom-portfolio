# M3 Blender isometric export

The original main branch contains scene projection logic but no complete game-independent rigged character exporter. This Blender adapter renders a creator-supplied original GLB/glTF from four orthographic directions at one stable world scale. When rendering multiple animation frames it **requires** a named armature action. Frame images and an animation.json manifest have matching paths and fixed timing.

Example:

    blender -b --python pipeline/blender/render_iso.py -- --input originals/guide.glb --output output/guide --size 256 --frames 0,4,8,12 --clip walk --fps 12 --action Walk

Single static model:

    blender -b --python pipeline/blender/render_iso.py -- --input originals/chair.glb --output output/chair --size 256

Inspect actual images, silhouettes and material rendering at the final game scale; **no original rigged GLB is committed and Blender image rendering has not yet been run in CI**. Python export planning has independent unit tests. This is a technical M3 slice, not artistic acceptance.
