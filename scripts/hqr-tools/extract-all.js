/**
 * LBA1 HQR Asset Extraction Script
 *
 * Uses @lbalab/hqr library to extract all entries from HQR archives.
 *
 * Usage:
 *   node extract-all.js
 *
 * Prerequisites:
 *   - Place LBA1 .HQR files in ../../base_game/
 *   - npm install @lbalab/hqr
 */

const { HQR } = require('@lbalab/hqr');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_GAME_DIR = path.join(__dirname, '../../base_game');
const OUTPUT_DIR = path.join(__dirname, '../../modded_assets');

// LBA1 HQR files and their contents
const HQR_FILES = {
    'LBA.HQR': 'core',           // Main game data
    'RESS.HQR': 'resources',     // Resources
    'BODY.HQR': 'bodies',        // 3D character models
    'ANIM.HQR': 'animations',    // Character animations
    'SPRITES.HQR': 'sprites',    // 2D sprites
    'SCENE.HQR': 'scenes',       // Scene/level data (grids, scripts)
    'TEXT.HQR': 'text',          // Dialogue and text strings
    'SAMPLES.HQR': 'audio',      // Sound effects
    'VOX000.HQR': 'voice_en',    // English voice acting
    'FILE3D.HQR': 'models_3d',   // 3D static models
    'INVOBJ.HQR': 'inventory',   // Inventory object graphics
};

async function extractHQR(hqrFilename, outputSubdir) {
    const hqrPath = path.join(BASE_GAME_DIR, hqrFilename);
    const outputPath = path.join(OUTPUT_DIR, outputSubdir);

    if (!fs.existsSync(hqrPath)) {
        console.log(`[SKIP] ${hqrFilename} not found`);
        return;
    }

    console.log(`[EXTRACTING] ${hqrFilename} -> ${outputSubdir}/`);

    // Create output directory
    fs.mkdirSync(outputPath, { recursive: true });

    // Read HQR file
    const buffer = fs.readFileSync(hqrPath);
    const hqr = HQR.fromArrayBuffer(buffer.buffer);

    // Extract metadata
    const metadata = {
        filename: hqrFilename,
        entryCount: hqr.entries.length,
        entries: []
    };

    // Extract each entry
    for (let i = 0; i < hqr.entries.length; i++) {
        const entry = hqr.entries[i];

        if (!entry) {
            metadata.entries.push({ index: i, empty: true });
            continue;
        }

        const content = entry.content;
        if (!content || content.byteLength === 0) {
            metadata.entries.push({ index: i, empty: true });
            continue;
        }

        // Determine file extension based on content analysis
        const ext = detectFileType(Buffer.from(content));
        const entryFilename = `entry_${String(i).padStart(4, '0')}${ext}`;
        const entryPath = path.join(outputPath, entryFilename);

        // Write entry to file
        fs.writeFileSync(entryPath, Buffer.from(content));

        metadata.entries.push({
            index: i,
            filename: entryFilename,
            size: content.byteLength,
            compressed: entry.compressed || false
        });

        // Extract hidden entries if present
        if (entry.hiddenEntries && entry.hiddenEntries.length > 0) {
            for (let h = 0; h < entry.hiddenEntries.length; h++) {
                const hidden = entry.hiddenEntries[h];
                if (hidden && hidden.content) {
                    const hiddenExt = detectFileType(Buffer.from(hidden.content));
                    const hiddenFilename = `entry_${String(i).padStart(4, '0')}_hidden_${h}${hiddenExt}`;
                    fs.writeFileSync(path.join(outputPath, hiddenFilename), Buffer.from(hidden.content));

                    metadata.entries[metadata.entries.length - 1].hiddenEntries =
                        metadata.entries[metadata.entries.length - 1].hiddenEntries || [];
                    metadata.entries[metadata.entries.length - 1].hiddenEntries.push({
                        index: h,
                        filename: hiddenFilename,
                        size: hidden.content.byteLength
                    });
                }
            }
        }
    }

    // Write metadata JSON
    fs.writeFileSync(
        path.join(outputPath, '_metadata.json'),
        JSON.stringify(metadata, null, 2)
    );

    console.log(`[DONE] Extracted ${metadata.entries.filter(e => !e.empty).length} entries`);
}

function detectFileType(buffer) {
    if (buffer.length < 4) return '.bin';

    // Check for common magic bytes
    const magic = buffer.slice(0, 4);

    // BMP
    if (magic[0] === 0x42 && magic[1] === 0x4D) return '.bmp';

    // PNG
    if (magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4E && magic[3] === 0x47) return '.png';

    // WAV/RIFF
    if (magic.toString('ascii').startsWith('RIFF')) return '.wav';

    // VOC (Creative Voice)
    if (magic.toString('ascii').startsWith('Crea')) return '.voc';

    // Default to .bin for unknown binary data
    return '.bin';
}

async function main() {
    console.log('=== LBA1 HQR Asset Extraction ===\n');

    // Check base_game directory
    if (!fs.existsSync(BASE_GAME_DIR)) {
        console.error(`ERROR: ${BASE_GAME_DIR} does not exist.`);
        console.error('Please create it and place your LBA1 .HQR files there.');
        process.exit(1);
    }

    // List available HQR files
    const availableFiles = fs.readdirSync(BASE_GAME_DIR)
        .filter(f => f.toUpperCase().endsWith('.HQR'));

    console.log(`Found ${availableFiles.length} HQR files in base_game/:\n`);
    availableFiles.forEach(f => console.log(`  - ${f}`));
    console.log('');

    // Extract each HQR
    for (const [filename, subdir] of Object.entries(HQR_FILES)) {
        await extractHQR(filename, subdir);
    }

    // Also extract any HQR files not in our known list
    for (const file of availableFiles) {
        const upper = file.toUpperCase();
        if (!Object.keys(HQR_FILES).includes(upper)) {
            await extractHQR(file, `misc_${path.basename(file, '.HQR').toLowerCase()}`);
        }
    }

    console.log('\n=== Extraction Complete ===');
    console.log(`Output directory: ${OUTPUT_DIR}`);
}

main().catch(err => {
    console.error('Extraction failed:', err);
    process.exit(1);
});
