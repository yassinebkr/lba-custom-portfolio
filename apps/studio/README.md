# Atlas Asset Studio — J2 work in progress

An original, local-first React/TypeScript/Vite creative editor. The current functional slice has a visual asset library, keyboard-focusable isometric viewport, canvas placement and selection, per-instance property inspector, scene JSON import/export, local draft storage, undo/redo and a frame-preview timeline. Artwork in this prototype is programmatically drawn and does not contain game-derived LBA resources.

Run locally:

\`\`\`bash
cd apps/studio
npm install
npm run build
npm run dev
\`\`\`

Open http://127.0.0.1:5174/ . **The Studio is not part of the public Pages deployment.**

This is a first interface implementation, NOT the full J2 acceptance gate. Before accepting J2, verify actual desktop/mobile screenshots, keyboard and drag interactions, import/export behavior, accessible labels and user experience. The prototype uses a temporary local TypeScript scene model; J3 will introduce a shared schema and proper provenance validation. Animation frames are only previews; editable state timelines are planned for J6. Source art is currently procedural; photo-to-sprite production begins at J4.

## J5: scene authoring slice

The Studio now includes six **original** scene fixtures in `src/scenes.ts` that can be opened from the scene selector. Asset instances remain separate, placeable and editable. Local drafts are isolated per scene, and switching with unsaved edits requires confirmation. Every exported scene uses the J3 v1 schema.

This is **not yet a complete J5 deliverable**: export to the public game bundle and precise runtime/editor rendering parity need validation. Scene placement uses a simple single-tile footprint until collider editing is added.
