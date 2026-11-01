# From reviewed sprites to the browser

The original main branch had useful sprite/brick encoding and scene projection but depended on LBA archives. The new pipeline closes the path from user-owned PNG through an approved asset catalog to the public renderer:

1. Produce PNGs with Blender or your own 2D art. Process with pipeline/asset_batch.py and visually inspect the generated contact sheets.
2. **Explicitly review** creator, license, attribution and quality in the source manifest: source.reviewStatus must be approved and source.allowedForPublicBuild true. No script makes this decision automatically.
3. Author one or more independent isometric scenes as a JSON object with scenes:[{id,width,depth,instances:[{id,assetId,x,z}]}]. A scene may provide playerAssetId.
4. Compile the approved set in one command:

    node pipeline/compile-approved.mjs --assets /tmp/workshop-atlases/assets.json --scenes authored-scenes.json --out apps/portfolio/assets

5. Test the **actual public** artifact with node scripts/build-portfolio.mjs. The public catalog will contain only original approved atlas files and JSON, never GLB source, the builders, or original LBA files.

This step is **deliberately fail-closed**. The existing synthetic fixture manifest is pending and cannot be published. Tests use a generated one-pixel local fixture to exercise the complete conversion, not to establish graphic quality. No completed original art or scene has been approved yet.
