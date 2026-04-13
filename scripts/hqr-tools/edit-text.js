/**
 * LBA1 Text/Dialogue Editor
 *
 * Extracts text strings to editable JSON and repacks them.
 *
 * LBA1 text format:
 *   - TEXT.HQR contains multiple language banks
 *   - Each bank contains null-terminated strings
 *   - Entry 0 = English, Entry 1 = French, etc.
 *
 * Usage:
 *   node edit-text.js extract   # Extract strings to JSON
 *   node edit-text.js repack    # Rebuild TEXT.HQR from JSON
 */

const { HQR, HQREntry, CompressionType } = require('@lbalab/hqr');
const fs = require('fs');
const path = require('path');

const BASE_GAME_DIR = path.join(__dirname, '../../base_game');
const MODDED_DIR = path.join(__dirname, '../../modded_assets/text');
const TEXT_JSON_PATH = path.join(MODDED_DIR, 'dialogue_strings.json');

// Language indices in TEXT.HQR (LBA1)
const LANGUAGES = {
    0: 'english',
    1: 'french',
    2: 'german',
    3: 'spanish',
    4: 'italian',
    // LBA1 typically has 5 languages
};

/**
 * Decode text strings from a buffer
 * LBA uses null-terminated strings, packed sequentially
 */
function decodeTextBuffer(buffer) {
    const strings = [];
    let current = '';
    const decoder = new TextDecoder('latin1'); // LBA uses Latin-1 encoding

    for (let i = 0; i < buffer.length; i++) {
        if (buffer[i] === 0) {
            // Null terminator - end of string
            if (current.length > 0 || strings.length > 0) {
                strings.push(current);
            }
            current = '';
        } else {
            current += decoder.decode(new Uint8Array([buffer[i]]));
        }
    }

    // Don't forget last string if no terminator
    if (current.length > 0) {
        strings.push(current);
    }

    return strings;
}

/**
 * Encode strings back to buffer format
 */
function encodeStringsToBuffer(strings) {
    const encoder = new TextEncoder();
    const parts = [];

    for (const str of strings) {
        // Encode string and add null terminator
        const encoded = encoder.encode(str);
        parts.push(encoded);
        parts.push(new Uint8Array([0]));
    }

    // Concatenate all parts
    const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
        result.set(part, offset);
        offset += part.length;
    }

    return result;
}

async function extractText() {
    const textHqrPath = path.join(BASE_GAME_DIR, 'TEXT.HQR');

    if (!fs.existsSync(textHqrPath)) {
        console.error('ERROR: TEXT.HQR not found in base_game/');
        process.exit(1);
    }

    console.log('Extracting text strings from TEXT.HQR...\n');

    const buffer = fs.readFileSync(textHqrPath);
    const hqr = HQR.fromArrayBuffer(buffer.buffer);

    const textData = {
        _info: 'Edit strings below. Keep indices intact. Run "node edit-text.js repack" to rebuild.',
        languages: {}
    };

    for (let i = 0; i < hqr.entries.length; i++) {
        const entry = hqr.entries[i];
        if (!entry || !entry.content) continue;

        const langName = LANGUAGES[i] || `language_${i}`;
        const strings = decodeTextBuffer(Buffer.from(entry.content));

        console.log(`[${langName}] ${strings.length} strings`);

        textData.languages[langName] = {
            index: i,
            strings: strings.map((str, idx) => ({
                id: idx,
                original: str,
                modified: str  // User edits this field
            }))
        };
    }

    // Write JSON
    fs.mkdirSync(MODDED_DIR, { recursive: true });
    fs.writeFileSync(TEXT_JSON_PATH, JSON.stringify(textData, null, 2));

    console.log(`\nExtracted to: ${TEXT_JSON_PATH}`);
    console.log('Edit the "modified" field for each string, then run: node edit-text.js repack');
}

async function repackText() {
    if (!fs.existsSync(TEXT_JSON_PATH)) {
        console.error('ERROR: dialogue_strings.json not found.');
        console.error('Run "node edit-text.js extract" first.');
        process.exit(1);
    }

    console.log('Repacking text strings to TEXT.HQR...\n');

    const textData = JSON.parse(fs.readFileSync(TEXT_JSON_PATH, 'utf8'));
    const hqr = new HQR();

    // Determine max index
    let maxIndex = 0;
    for (const lang of Object.values(textData.languages)) {
        if (lang.index > maxIndex) maxIndex = lang.index;
    }

    // Fill with null entries up to maxIndex
    for (let i = 0; i <= maxIndex; i++) {
        hqr.entries.push(null);
    }

    // Populate with actual data
    for (const [langName, lang] of Object.entries(textData.languages)) {
        const strings = lang.strings.map(s => s.modified);
        const encoded = encodeStringsToBuffer(strings);

        console.log(`[${langName}] ${strings.length} strings, ${encoded.length} bytes`);

        hqr.entries[lang.index] = new HQREntry(
            encoded.buffer,
            CompressionType.NONE
        );
    }

    // Write HQR
    const outputDir = path.join(__dirname, '../../output');
    fs.mkdirSync(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, 'TEXT.HQR');
    const packedBuffer = hqr.toArrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(packedBuffer));

    console.log(`\nCreated: ${outputPath} (${(packedBuffer.byteLength / 1024).toFixed(2)} KB)`);
}

// Main
const command = process.argv[2];

if (command === 'extract') {
    extractText();
} else if (command === 'repack') {
    repackText();
} else {
    console.log('LBA1 Text/Dialogue Editor');
    console.log('');
    console.log('Usage:');
    console.log('  node edit-text.js extract   Extract strings to JSON for editing');
    console.log('  node edit-text.js repack    Rebuild TEXT.HQR from edited JSON');
    console.log('');
    console.log('Workflow:');
    console.log('  1. Place TEXT.HQR in base_game/');
    console.log('  2. Run: node edit-text.js extract');
    console.log('  3. Edit modded_assets/text/dialogue_strings.json');
    console.log('  4. Run: node edit-text.js repack');
    console.log('  5. Copy output/TEXT.HQR to your game folder');
}
