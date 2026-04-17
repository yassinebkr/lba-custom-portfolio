/**
 * Test harness for the LBA1 sprite pipeline.
 *
 *   node test-sprites.js
 *
 * Four suites, zero runtime deps beyond the codec and the extract output:
 *
 *   1. roundtrip           Every non-empty entry in base_game/SPRITES.HQR
 *                          decodes → re-encodes → decodes again to the same
 *                          (width, height, pixels). Catches encoder drift.
 *
 *   2. palette hygiene     Every pixel in modded_assets/sprites/*.png maps
 *                          1:1 to the LBA palette. Detects GIMP exports that
 *                          left indexed mode and introduced off-palette RGB.
 *
 *   3. metadata consistency  _metadata.json entries match PNGs on disk: same
 *                          filename, same width × height, no orphans.
 *
 *   4. encoder fuzz        Random indexed buffers (including edge cases —
 *                          all-transparent, all-one-color, 1×1, 255×255,
 *                          long RLE and literal runs) survive encode→decode.
 *
 * Exit code 0 = all pass; non-zero = at least one suite failed. Output is
 * loud on failure, terse on success so CI logs stay scannable.
 */

const { HQR } = require('@lbalab/hqr');
const { PNG } = require('pngjs');
const fs   = require('fs');
const path = require('path');

const codec = require('./lib/sprite-codec');

const ROOT = path.resolve(__dirname, '../..');
const BASE = path.join(ROOT, 'base_game');
const MOD  = path.join(ROOT, 'modded_assets', 'sprites');

const results = [];
function suite(name, fn) {
    process.stdout.write(`▸ ${name}... `);
    const start = Date.now();
    try {
        const detail = fn() || '';
        const ms = Date.now() - start;
        results.push({ name, pass: true, ms, detail });
        console.log(`PASS  (${ms} ms) ${detail}`);
    } catch (e) {
        const ms = Date.now() - start;
        results.push({ name, pass: false, ms, error: e });
        console.log(`FAIL  (${ms} ms)`);
        console.log('    ' + (e.stack || e.message).replace(/\n/g, '\n    '));
    }
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

function pixelsEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}

// ── 1. round-trip every sprite in base SPRITES.HQR ──────────────────────────
suite('roundtrip: every base sprite re-encodes losslessly', () => {
    const buf = fs.readFileSync(path.join(BASE, 'SPRITES.HQR'));
    const ab  = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const hqr = HQR.fromArrayBuffer(ab);

    let checked = 0, skipped = 0;
    const failures = [];

    for (let i = 0; i < hqr.entries.length; i++) {
        const entry = hqr.entries[i];
        if (!entry || !entry.content || entry.content.byteLength < 8) { skipped++; continue; }

        const data = Buffer.from(entry.content);
        const original = codec.decodeSpriteFrame(data, 0);
        if (!original) { skipped++; continue; }

        const reencoded = codec.encodeSprite(
            original.width, original.height, original.offsetX, original.offsetY, original.pixels
        );
        const redecoded = codec.decodeSpriteFrame(reencoded, 0);

        if (!redecoded) {
            failures.push(`entry ${i}: re-decode returned null`);
            continue;
        }
        if (redecoded.width !== original.width || redecoded.height !== original.height) {
            failures.push(`entry ${i}: dims drift ${original.width}×${original.height} → ${redecoded.width}×${redecoded.height}`);
            continue;
        }
        if (!pixelsEqual(redecoded.pixels, original.pixels)) {
            let firstDiff = -1;
            for (let j = 0; j < original.pixels.length; j++) {
                if (redecoded.pixels[j] !== original.pixels[j]) { firstDiff = j; break; }
            }
            failures.push(`entry ${i}: pixel drift at offset ${firstDiff} (${original.pixels[firstDiff]} → ${redecoded.pixels[firstDiff]})`);
            continue;
        }
        checked++;
    }

    if (failures.length) {
        throw new Error(`${failures.length} failure(s). First 5:\n  ` + failures.slice(0, 5).join('\n  '));
    }
    return `${checked} sprites round-tripped, ${skipped} skipped (empty/invalid)`;
});

// ── 2. palette hygiene on modded_assets PNGs ────────────────────────────────
suite('palette hygiene: modded PNGs use only LBA palette colors', () => {
    if (!fs.existsSync(MOD) || !fs.existsSync(path.join(MOD, '_metadata.json'))) {
        return 'SKIP — no modded_assets/sprites (run extract-sprites.js first)';
    }

    const palette = codec.loadPalette(BASE);
    const exact   = codec.buildExactPaletteLUT(palette);

    const pngs = fs.readdirSync(MOD).filter(f => f.endsWith('.png') && !f.startsWith('_'));
    const offenders = [];
    let totalPixels = 0, offPixels = 0;

    for (const name of pngs) {
        const data = fs.readFileSync(path.join(MOD, name));
        const png  = PNG.sync.read(data);
        let fileOff = 0;
        for (let i = 0; i < png.width * png.height; i++) {
            const r = png.data[i * 4 + 0];
            const g = png.data[i * 4 + 1];
            const b = png.data[i * 4 + 2];
            const a = png.data[i * 4 + 3];
            totalPixels++;
            if (a === 0) continue;
            if (a > 0 && a < 255) fileOff++;
            else if (exact(r, g, b) < 0) fileOff++;
        }
        if (fileOff > 0) offenders.push(`${name}: ${fileOff} off-palette or partially-transparent px`);
        offPixels += fileOff;
    }

    if (offenders.length) {
        throw new Error(`${offenders.length} file(s), ${offPixels} total px. First 5:\n  ` + offenders.slice(0, 5).join('\n  '));
    }
    return `${pngs.length} PNGs, ${totalPixels} pixels, 0 off-palette`;
});

// ── 3. metadata <-> disk consistency ────────────────────────────────────────
suite('metadata consistency: _metadata.json matches PNGs on disk', () => {
    const metaPath = path.join(MOD, '_metadata.json');
    if (!fs.existsSync(metaPath)) return 'SKIP — no modded_assets/sprites';

    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const pngsOnDisk = new Set(
        fs.readdirSync(MOD).filter(f => f.endsWith('.png') && !f.startsWith('_'))
    );

    const issues = [];
    const claimedPngs = new Set();

    for (const entry of meta.entries) {
        if (entry.empty || !entry.filename) continue;
        claimedPngs.add(entry.filename);
        const pngPath = path.join(MOD, entry.filename);
        if (!fs.existsSync(pngPath)) {
            issues.push(`entry ${entry.index}: metadata claims ${entry.filename} but file is missing`);
            continue;
        }
        const png = PNG.sync.read(fs.readFileSync(pngPath));
        if (png.width !== entry.width || png.height !== entry.height) {
            issues.push(`entry ${entry.index} (${entry.filename}): dims ${png.width}×${png.height} ≠ metadata ${entry.width}×${entry.height}`);
        }
    }
    for (const png of pngsOnDisk) {
        if (!claimedPngs.has(png)) issues.push(`orphan PNG on disk (no metadata entry): ${png}`);
    }

    if (issues.length) {
        throw new Error(`${issues.length} issue(s). First 5:\n  ` + issues.slice(0, 5).join('\n  '));
    }
    return `${claimedPngs.size} entries × PNGs agree`;
});

// ── 4. encoder fuzz / edge cases ────────────────────────────────────────────
suite('encoder fuzz: random and edge-case buffers survive encode→decode', () => {
    function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000; }
    const rand = rng(0xdeadbeef);

    function roundTrip(w, h, pixels, label) {
        const enc = codec.encodeSprite(w, h, 0, 0, pixels);
        const dec = codec.decodeSpriteFrame(enc, 0);
        assert(dec, `${label}: decode returned null`);
        assert(dec.width === w && dec.height === h, `${label}: dims drift`);
        assert(pixelsEqual(dec.pixels, pixels), `${label}: pixels drift`);
    }

    // Edge dimensions
    roundTrip(1, 1, new Uint8Array([5]), '1×1 single pixel');
    roundTrip(1, 1, new Uint8Array([0]), '1×1 transparent pixel');
    roundTrip(255, 1, new Uint8Array(255).fill(7), '255×1 all-RLE');
    roundTrip(1, 255, new Uint8Array(255).fill(0), '1×255 all-transparent column');

    // Max dims (255×255)
    {
        const w = 255, h = 255;
        const px = new Uint8Array(w * h);
        for (let i = 0; i < px.length; i++) px[i] = 1 + (i % 200);
        roundTrip(w, h, px, '255×255 dense gradient');
    }

    // All-one-color
    {
        const px = new Uint8Array(64 * 64).fill(42);
        roundTrip(64, 64, px, '64×64 all color 42');
    }

    // Long transparent run longer than MAX_RUN (forces skip chaining)
    {
        const w = 200, h = 1;
        const px = new Uint8Array(w); // all zero
        px[0] = 3; px[w - 1] = 3;
        roundTrip(w, h, px, '200×1 long transparent with endpoints');
    }

    // Long RLE run crossing MAX_RUN boundary
    {
        const w = 200, h = 1;
        const px = new Uint8Array(w).fill(9);
        roundTrip(w, h, px, '200×1 long RLE');
    }

    // Alternating pixels — literal-heavy
    {
        const w = 64, h = 1;
        const px = new Uint8Array(w);
        for (let i = 0; i < w; i++) px[i] = 1 + (i & 0x7F);
        roundTrip(w, h, px, '64×1 alternating (literals)');
    }

    // 20 random sprites across size / sparsity space
    for (let t = 0; t < 20; t++) {
        const w = 1 + Math.floor(rand() * 120);
        const h = 1 + Math.floor(rand() * 120);
        const sparsity = rand();
        const px = new Uint8Array(w * h);
        for (let i = 0; i < px.length; i++) {
            px[i] = rand() < sparsity ? 0 : 1 + Math.floor(rand() * 254);
        }
        roundTrip(w, h, px, `random #${t} ${w}×${h} sparsity=${sparsity.toFixed(2)}`);
    }

    return '8 edge-case + 20 random buffers';
});

// ── summary ─────────────────────────────────────────────────────────────────
const pass = results.filter(r => r.pass).length;
const fail = results.filter(r => !r.pass).length;
console.log('');
console.log(`${pass} pass  ${fail} fail  (${results.length} suites)`);
process.exit(fail > 0 ? 1 : 0);
