# Asset Core (M1)

This dependency-free ESM module extracts the **generic algorithms** from the existing main-branch LBA1 tools, retaining their tests' spirit but removing all archive and game-data dependencies.

| Primitive | Origin in \`main\` | Independent contract |
| --- | --- | --- |
| Row RLE, encoded sprite/brick headers | \`scripts/hqr-tools/lib/sprite-codec.js\` | \`encodeRow\`, \`encodeBrick\`, \`encodeSprite\`, \`decodeBrick\`, \`decodeSprite\` |
| PNG→palette nearest/exact conversion | \`inject-sprite.js\`, \`inject-brick.js\` | \`rgbaToIndexed\`, \`indexedToRGBA\` accept **caller-supplied** RGB palette |
| Dimetric coordinates and painter's ordering | \`render-scene.js\` | \`projectIso\`, \`painterSort\` on arbitrary owned placements |

The legacy HQR tools are **not modified** and remain under \`scripts/hqr-tools/\`. The new primitives do not read \`base_game/\`, \`RESS.HQR\`, \`GRI\`, \`BLL\`, or the game palette. This optional RLE format can be used for compatibility testing, but **PNG/JSON remains the public runtime format**.

The 1994-era sprite format uses 8-bit width, height and signed offsets; the codecs explicitly reject overflows, truncation and invalid run segments rather than assuming trusted game data. Index zero is transparent. Do not feed game-derived graphics or palettes into a public asset.

Run locally: \`node --test packages/asset-core/index.test.mjs\`.

The next gate (M2) is to connect these primitives to a wholly original PNG export with a palette created by the project, including proof of alpha, offsets and round-trip integrity.
