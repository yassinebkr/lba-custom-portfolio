/**
 * Parse SCENE.HQR and build a scene -> sprite index map.
 *
 * Binary layout is derived from twin-e/src/scene.c loadScene().
 * Per-actor sprite field is always present (u16 at offset +6 within the
 * fixed actor record), regardless of whether the actor is a sprite actor
 * or a 3D entity. We only collect the sprite index when
 * staticFlags & 0x400 (bIsSpriteActor) is set — otherwise the field is
 * garbage relative to sprites.
 *
 * Output:
 *   metadata-ui/public/scene-sprites.json
 *
 * Usage:
 *   node extract-scene-sprites.js
 */

const { HQR } = require('@lbalab/hqr');
const fs   = require('fs');
const path = require('path');

const ROOT   = path.resolve(__dirname, '../..');
const BASE   = path.join(ROOT, 'base_game');
const OUT    = path.join(ROOT, 'metadata-ui', 'public', 'scene-sprites.json');
const META   = path.join(ROOT, 'tools', 'metadata', 'LBA1', 'HQR', 'SCENE.HQR.json');

function parseScene(buf) {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let p = 0;
    const u8  = () => { const v = view.getUint8(p); p += 1; return v; };
    const u16 = () => { const v = view.getUint16(p, true); p += 2; return v; };

    u8(); u8();                // textBank, gameOverScene
    p += 4;                    // unused
    u16(); u16();              // alphaLight, betaLight
    for (let i = 0; i < 4; i++) { u16(); u16(); u16(); }  // 4× ambiance triple
    u16(); u16();              // sampleMinDelay, sampleMinDelayRnd
    u8();                      // sceneMusic
    u16(); u16(); u16();       // hero X, Y, Z

    const heroMoveSize = u16(); p += heroMoveSize;
    const heroLifeSize = u16(); p += heroLifeSize;

    const numActors = u16();
    const spritesUsed = new Set();

    for (let i = 1; i < numActors; i++) {
        if (p + 34 > view.byteLength) return { numActors, sprites: [...spritesUsed], truncated: true };
        const staticFlags = u16();
        u16();                 // entity
        u8(); u8();            // body, anim
        const sprite = u16();
        u16(); u16(); u16();   // X, Y, Z
        u8();                  // strengthOfHit
        u16();                 // bonusParameter
        u16(); u16(); u16();   // angle, speed, controlMode
        u16(); u16(); u16(); u16(); // info0..3
        u8(); u8(); u8(); u8();     // bonusAmount, talkColor, armor, life

        const moveSize = u16(); p += moveSize;
        const lifeSize = u16(); p += lifeSize;

        if (staticFlags & 0x400) spritesUsed.add(sprite);
    }

    return { numActors, sprites: [...spritesUsed].sort((a, b) => a - b) };
}

const meta = JSON.parse(fs.readFileSync(META, 'utf8'));
const sceneBuf = fs.readFileSync(path.join(BASE, 'SCENE.HQR'));
const sceneAB  = sceneBuf.buffer.slice(sceneBuf.byteOffset, sceneBuf.byteOffset + sceneBuf.byteLength);
const sceneHQR = HQR.fromArrayBuffer(sceneAB);

// Entry 0 is the scene list / index; actual scene binaries start at entry 1.
const scenes = {};
let parsed = 0;
let failed = 0;

for (let i = 1; i < sceneHQR.entries.length; i++) {
    const entry = sceneHQR.entries[i];
    if (!entry || !entry.content) continue;

    const buf = Buffer.from(entry.content);
    let result;
    try {
        result = parseScene(buf);
        parsed++;
    } catch (err) {
        failed++;
        result = { error: err.message, sprites: [] };
    }

    const sceneIndex = i - 1;
    const description = meta.entries[sceneIndex]?.description || `Scene ${sceneIndex}`;
    scenes[sceneIndex] = {
        description,
        numActors: result.numActors,
        sprites: result.sprites,
        ...(result.error ? { error: result.error } : {}),
        ...(result.truncated ? { truncated: true } : {}),
    };
}

// Build reverse map: sprite -> [sceneIds]
const spriteToScenes = {};
for (const [sceneId, info] of Object.entries(scenes)) {
    for (const spriteIdx of info.sprites) {
        (spriteToScenes[spriteIdx] ??= []).push(Number(sceneId));
    }
}

fs.writeFileSync(OUT, JSON.stringify({
    source:        'SCENE.HQR',
    parsedScenes:  parsed,
    failedScenes:  failed,
    scenes,
    spriteToScenes,
}, null, 2));

const withSprites = Object.values(scenes).filter(s => s.sprites.length).length;
const totalRefs = Object.values(scenes).reduce((n, s) => n + s.sprites.length, 0);
console.log(`[DONE] Parsed ${parsed} scenes, ${failed} failed`);
console.log(`       ${withSprites} scenes reference sprites, ${totalRefs} total references`);
console.log(`       ${Object.keys(spriteToScenes).length} distinct sprites used in scenes`);
console.log(`       -> ${path.relative(ROOT, OUT)}`);
