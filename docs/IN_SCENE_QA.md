# V7 — In-scene visual evaluation

The first original electronics workshop is a **bounded visual-quality environment**, not a seventh production portfolio room and not a completed game. It deliberately reuses the actual V5 telemetry sprite without modifying its pixels, orientations or perceived proportions.

~~~mermaid
flowchart LR
  BLENDER["Original Blender room and studio lighting"] --> BACK["960×640 RGBA background"]
  BLENDER --> FRONT["960×640 RGBA foreground desk lip"]
  V5["Verified V5 256px sprite sheet"] --> COMPOSITOR["Canvas image composition"]
  BACK --> COMPOSITOR
  FRONT --> COMPOSITOR
  META["3D-projected tabletop anchor + layout.json"] --> COMPOSITOR
  COMPOSITOR --> REVIEW["Scale / color / depth / tabletop review"]
~~~

The background geometry contains two modeled walls, detailed floor, workbench, drawers, bench supply, antenna tools, instrument shelf and original materials. Both Blender passes share one orthographic camera, light rig, color transform and coordinates.

- **Background:** original scene with equipment, complete shadows and room surfaces.
- **Sprite:** V5 source atlas, NE/NW/SW/SE; 160-color or truecolor, rendered between the two Blender passes. The default is 75% of the 256px frame on the 960px test canvas.
- **Foreground:** transparent mask composed from original desk edging, enabling a meaningful front-of-sprite depth test. The rest of the room stays in the background.
- **Placement:** tabletop position is projected from a real Blender world point, recorded in layout.json as [477.41,355.54], not guessed solely from a screenshot.
- **Interaction:** inspect, change direction/color, change visual scale, switch foreground or shadow on/off, inspect anchor and drag within deliberately narrow tabletop bounds. A mouse, touch pointer or keyboard can move the receiver.

### Independent image and rights verification

The scene is authored by \`pipeline/blender/render_workshop.py\`. Headless Blender generates \`background.png\`, \`foreground.png\`, and \`layout.json\`. The workflow records PNG tests for dimensions, nonempty alpha, edge coverage and occlusion footprint. Both PNG files and the scene layout are SHA-256 pinned in the public builder. The builder publishes only the two PNG images, one layout JSON and the separate review page; Blender/Python, source assets and any LBA archives are excluded.

| File | SHA-256 |
| --- | --- |
| background.png | \`eca5acca67862051651c0698665a0af11288aa6266f9da5e960fea50835c1dd3\` |
| foreground.png | \`5c8a3b3ae29835cd542caff09c2d855128f317dbd539fe3420f8fa0714c47d59\` |
| layout.json | \`3bee5d7e5cb427ae903a09fac7d6e3447b90b22eac19721fa1ae06f278561d44\` |

### Acceptance and outstanding issues

The page loads through the real GitHub Pages subpath with controls working in Chromium desktop and mobile tests. Manual review of screenshots shows a readable instrument on a physically modeled workbench, a consistent light direction and a correct desk-edge foreground layer. These checks support **technical V7 completion**, not artistic sign-off.

The contact shadow under the sprite is still an *approximated* Canvas ellipse; full geometry-derived radio shadow casting is not available. The radio's scale and grounding still need a final human determination. Static room rendering is not a complete depth-sorting/collision system and does not replace the game's six main rooms. The difference in proportions noticed by the maintainer between stages 2 and 3 of V6 is **explicitly deferred**, and this work does not attempt to change the original atlas.

**V8 production preset and full-room asset library remain unstarted.** The V7 room and sprite do not enter \`assets/approved-worlds.json\`. Approval of gameplay art must be explicit and independent.

Live scene review: https://yassinebkr.github.io/lba-custom-portfolio/sprite-demo/scene-lab.html
