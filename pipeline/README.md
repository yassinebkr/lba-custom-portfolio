# Asset pipeline — start here

**One recipe, one command.** This is a local authoring tool, not a game builder or a complex creative GUI.

\`\`\`bash
python3 -m pip install Pillow==11.3.0

# Make seven ORIGINAL synthetic source fixtures for QA
python3 pipeline/fixtures/generate_samples.py --out /tmp/workshop-sources

# Convert the actual PNG inputs to atlases, contact sheets, rights manifests
python3 pipeline/asset_batch.py /tmp/workshop-sources/recipe.json --out /tmp/workshop-atlases

# Inspect /tmp/workshop-atlases/index.html in a browser
# Run the tests
python3 -m unittest discover -s pipeline/tests -v
\`\`\`

For **your own photographs**, place PNG/JPEG/WebP images beside a JSON recipe with local relative \`frames[].path\`. Name a direction explicitly (e.g. SE) and an action (e.g. idle). A photographed object only supplies the view you photographed; to get the other sides, add more photos or render original geometry via \`pipeline/blender/render_iso.py\`.

Output structure:

\`\`\`text
/tmp/workshop-atlases/
  index.html                # real contact-sheet review gallery, no cloud required
  assets.json               # rights + orientation + action + source SHA-256 + frame rectangles
  atlases/*.png             # fixed-scale sprite atlases
  previews/*.png            # checkerboard, nearest-neighbor contact sheets
\`\`\`

The **seven sample assets** consist of one four-direction character, two furniture assets (bench and chair), two technical objects (cinema camera and radio console), one architectural object (door) and one blinking lamp (four animation frames). They are **synthetic original fixture illustrations**, not an approved final art style and not evidence of photo-to-3D reconstruction.

The current \`asset_factory.py\` remains as the low-level single-asset converter for backwards compatibility. The \`asset_batch.py\` recipe interface is the intended simple front door. Blender is optional.

- [Pipeline design and evaluated tools](ASSET_FIRST.md)
- [Overall architecture](../docs/ARCHITECTURE_TARGET.md)
- [Milestone acceptance ledger](../docs/MILESTONES.md)

**Important:** no proprietary Little Big Adventure art, data or sprites enter this pipeline. The outputs default to \`pending\` rights review and must **never be shipped automatically** to the public Pages runtime.
