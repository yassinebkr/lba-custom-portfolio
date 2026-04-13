/**
 * LBA1 HQR Repacking Script
 *
 * Rebuilds HQR archives from extracted/modified files.
 *
 * Usage:
 *   node repack-hqr.js <subdir_name>
 *
 * Example:
 *   node repack-hqr.js text   # Repacks modded_assets/text/ -> output/TEXT.HQR
 */

const { HQR, HQREntry, CompressionType } = require('@lbalab/hqr');
const fs = require('fs');
const path = require('path');

const MODDED_DIR = path.join(__dirname, '../../modded_assets');
const OUTPUT_DIR = path.join(__dirname, '../../output');

// Reverse mapping: subdir -> original filename
const SUBDIR_TO_HQR = {
    'core': 'LBA.HQR',
    'resources': 'RESS.HQR',
    'bodies': 'BODY.HQR',
    'animations': 'ANIM.HQR',
    'sprites': 'SPRITES.HQR',
    'scenes': 'SCENE.HQR',
    'text': 'TEXT.HQR',
    'audio': 'SAMPLES.HQR',
    'voice_en': 'VOX000.HQR',
    'models_3d': 'FILE3D.HQR',
    'inventory': 'INVOBJ.HQR',
};

async function repackHQR(subdirName) {
    const subdirPath = path.join(MODDED_DIR, subdirName);
    const metadataPath = path.join(subdirPath, '_metadata.json');

    if (!fs.existsSync(subdirPath)) {
        console.error(`ERROR: Directory ${subdirPath} does not exist.`);
        process.exit(1);
    }

    if (!fs.existsSync(metadataPath)) {
        console.error(`ERROR: Metadata file ${metadataPath} not found.`);
        console.error('This file is required to preserve entry order.');
        process.exit(1);
    }

    // Load metadata
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    const outputFilename = SUBDIR_TO_HQR[subdirName] || `${subdirName.toUpperCase()}.HQR`;
    const outputPath = path.join(OUTPUT_DIR, outputFilename);

    console.log(`[REPACKING] ${subdirName}/ -> ${outputFilename}`);

    // Create output directory
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    // Create new HQR
    const hqr = new HQR();

    for (const entryMeta of metadata.entries) {
        if (entryMeta.empty) {
            // Add null/empty entry to preserve index
            hqr.entries.push(null);
            continue;
        }

        const entryPath = path.join(subdirPath, entryMeta.filename);

        if (!fs.existsSync(entryPath)) {
            console.warn(`[WARN] Missing file: ${entryMeta.filename}, adding empty entry`);
            hqr.entries.push(null);
            continue;
        }

        // Read the (potentially modified) file
        const content = fs.readFileSync(entryPath);
        const arrayBuffer = content.buffer.slice(
            content.byteOffset,
            content.byteOffset + content.byteLength
        );

        // Create entry with appropriate compression
        const compressionType = entryMeta.compressed
            ? CompressionType.LZSS1
            : CompressionType.NONE;

        const entry = new HQREntry(arrayBuffer, compressionType);

        // Handle hidden entries if present
        if (entryMeta.hiddenEntries) {
            for (const hiddenMeta of entryMeta.hiddenEntries) {
                const hiddenPath = path.join(subdirPath, hiddenMeta.filename);
                if (fs.existsSync(hiddenPath)) {
                    const hiddenContent = fs.readFileSync(hiddenPath);
                    const hiddenArrayBuffer = hiddenContent.buffer.slice(
                        hiddenContent.byteOffset,
                        hiddenContent.byteOffset + hiddenContent.byteLength
                    );
                    entry.hiddenEntries = entry.hiddenEntries || [];
                    entry.hiddenEntries.push(new HQREntry(hiddenArrayBuffer, CompressionType.NONE));
                }
            }
        }

        hqr.entries.push(entry);
    }

    // Write the repacked HQR
    const packedBuffer = hqr.toArrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(packedBuffer));

    console.log(`[DONE] Created ${outputPath} (${(packedBuffer.byteLength / 1024).toFixed(2)} KB)`);
}

// Main
const subdirArg = process.argv[2];

if (!subdirArg) {
    console.log('Usage: node repack-hqr.js <subdir_name>');
    console.log('');
    console.log('Available subdirectories:');
    console.log('  text      - Dialogue and text strings (TEXT.HQR)');
    console.log('  scenes    - Scene/level data (SCENE.HQR)');
    console.log('  sprites   - 2D sprites (SPRITES.HQR)');
    console.log('  bodies    - 3D character models (BODY.HQR)');
    console.log('  audio     - Sound effects (SAMPLES.HQR)');
    console.log('');
    console.log('Or use "all" to repack all modified assets.');
    process.exit(0);
}

if (subdirArg === 'all') {
    // Repack all directories with _metadata.json
    const subdirs = fs.readdirSync(MODDED_DIR)
        .filter(d => fs.existsSync(path.join(MODDED_DIR, d, '_metadata.json')));

    for (const subdir of subdirs) {
        repackHQR(subdir);
    }
} else {
    repackHQR(subdirArg);
}
