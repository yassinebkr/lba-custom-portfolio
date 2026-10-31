# Asset schema v1

Pure ESM validation used for the future shared Studio/runtime contract. No dependencies and no proprietary game resources.

- \`index.mjs\`: versioned scene and asset validation with structured issues \`{path,code,message}\`.
- \`index.d.mts\`: TypeScript declaration surface.
- \`index.test.mjs\`: reference/collision/rights/path/animation edge-case checks.

Run \`node --test packages/asset-schema/index.test.mjs\` from the repository root. Validated rights are mandatory: default deny, attribution for CC-BY and explicit approval before public export. Validation does not prove copyright ownership; it enforces declared provenance and a review gate.

The Studio currently has its own procedural source library and is progressively adopting this schema; no raw game assets are migrated from the legacy LBA mod. J3 is **in progress**, not accepted until the shared export/import pathway and runtime assets are tested end to end.
