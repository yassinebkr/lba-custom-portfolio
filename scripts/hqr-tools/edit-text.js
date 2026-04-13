/**
 * LBA1 Text/Dialogue Editor - Proper Format
 *
 * LBA TEXT.HQR format:
 *   - Each entry is a "text bank" with offset table + null-terminated strings
 *   - Entries are grouped by language (EN: 1-27, FR: 29-55, DE: 57-83, ES: 85-111, IT: 113-139)
 *   - Key dialogue entries: 7 (EN), 35 (FR), 63 (DE), 91 (ES), 119 (IT)
 *
 * Usage:
 *   node edit-text.js extract   # Extract to JSON
 *   node edit-text.js repack    # Rebuild TEXT.HQR
 */

const { HQR, HQREntry, CompressionType } = require('@lbalab/hqr');
const fs = require('fs');
const path = require('path');

const BASE_GAME_DIR = path.join(__dirname, '../../base_game');
const MODDED_DIR = path.join(__dirname, '../../modded_assets/text');
const TEXT_JSON_PATH = path.join(MODDED_DIR, 'dialogue_strings.json');

// Language configuration
const LANGUAGES = {
    english: { start: 1, end: 27, dialogueEntry: 7 },
    french: { start: 29, end: 55, dialogueEntry: 35 },
    german: { start: 57, end: 83, dialogueEntry: 63 },
    spanish: { start: 85, end: 111, dialogueEntry: 91 },
    italian: { start: 113, end: 139, dialogueEntry: 119 }
};

// Text bank names (based on content analysis)
const BANK_NAMES = {
    1: 'ui_menu',
    3: 'credits',
    5: 'game_tips',
    7: 'dialogue_main',      // Main NPC dialogue
    9: 'dialogue_extended',  // More dialogue
    11: 'dialogue_quest',
    13: 'signs_labels',
    15: 'rebellion_dialogue',
    17: 'military_dialogue',
    19: 'factory_dialogue',
    21: 'misc_dialogue',
    23: 'guards_dialogue',
    25: 'funfrock_dialogue',
    27: 'ending_dialogue'
};

/**
 * Read strings from LBA text bank format
 */
function readTextBank(buffer) {
    const strings = [];
    if (buffer.length < 2) return strings;

    const firstOffset = buffer.readUInt16LE(0);
    if (firstOffset >= buffer.length) return strings;

    let pos = firstOffset;
    let id = 0;

    while (pos < buffer.length) {
        let end = pos;
        while (end < buffer.length && buffer[end] !== 0) end++;

        if (end > pos) {
            const str = buffer.slice(pos, end).toString('latin1');
            strings.push({ id: id++, text: str });
        } else if (end === pos && buffer[end] === 0) {
            // Empty string
            strings.push({ id: id++, text: '' });
        }
        pos = end + 1;
    }

    return strings;
}

/**
 * Write strings to LBA text bank format
 */
function writeTextBank(strings) {
    // Calculate offsets
    const numStrings = strings.length;
    const offsetTableSize = numStrings * 2;

    // Build string data
    const stringBuffers = strings.map(s => {
        const encoded = Buffer.from(s.text || s.modified || '', 'latin1');
        return Buffer.concat([encoded, Buffer.from([0])]); // null terminator
    });

    const totalStringSize = stringBuffers.reduce((sum, b) => sum + b.length, 0);
    const totalSize = offsetTableSize + totalStringSize;

    const result = Buffer.alloc(totalSize);

    // Write offset table
    let stringOffset = offsetTableSize;
    for (let i = 0; i < numStrings; i++) {
        result.writeUInt16LE(stringOffset, i * 2);
        stringOffset += stringBuffers[i].length;
    }

    // Write strings
    let writePos = offsetTableSize;
    for (const buf of stringBuffers) {
        buf.copy(result, writePos);
        writePos += buf.length;
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
        _info: 'Edit the "modified" field for each string. Run "node edit-text.js repack" to rebuild.',
        _format: 'LBA TEXT.HQR - Each language has identical bank structure',
        languages: {}
    };

    // Extract each language
    for (const [langName, config] of Object.entries(LANGUAGES)) {
        console.log(`\n=== ${langName.toUpperCase()} (entries ${config.start}-${config.end}) ===`);

        textData.languages[langName] = {
            config: config,
            banks: {}
        };

        for (let i = config.start; i <= config.end; i += 2) {
            const entry = hqr.entries[i];
            if (!entry || !entry.content) continue;

            const buf = Buffer.from(entry.content);
            const strings = readTextBank(buf);

            if (strings.length === 0) continue;

            const bankIndex = i - config.start + 1;
            const bankName = BANK_NAMES[bankIndex] || `bank_${bankIndex}`;

            console.log(`  [${i}] ${bankName}: ${strings.length} strings`);

            textData.languages[langName].banks[i] = {
                name: bankName,
                entryIndex: i,
                strings: strings.map(s => ({
                    id: s.id,
                    original: s.text,
                    modified: s.text
                }))
            };
        }
    }

    // Write JSON
    fs.mkdirSync(MODDED_DIR, { recursive: true });
    fs.writeFileSync(TEXT_JSON_PATH, JSON.stringify(textData, null, 2));

    console.log(`\n\nExtracted to: ${TEXT_JSON_PATH}`);
    console.log('\nKey dialogue banks to edit:');
    console.log('  - Entry 7 (English dialogue_main)');
    console.log('  - Entry 35 (French dialogue_main)');
    console.log('\nEdit the "modified" field, then run: node edit-text.js repack');
}

async function repackText() {
    if (!fs.existsSync(TEXT_JSON_PATH)) {
        console.error('ERROR: dialogue_strings.json not found.');
        console.error('Run "node edit-text.js extract" first.');
        process.exit(1);
    }

    const textHqrPath = path.join(BASE_GAME_DIR, 'TEXT.HQR');
    if (!fs.existsSync(textHqrPath)) {
        console.error('ERROR: Original TEXT.HQR not found in base_game/');
        process.exit(1);
    }

    console.log('Repacking text strings to TEXT.HQR...\n');

    // Load original HQR as base
    const origBuffer = fs.readFileSync(textHqrPath);
    const hqr = HQR.fromArrayBuffer(origBuffer.buffer);

    // Load modified text
    const textData = JSON.parse(fs.readFileSync(TEXT_JSON_PATH, 'utf8'));

    let modifiedCount = 0;

    // Apply modifications
    for (const [langName, langData] of Object.entries(textData.languages)) {
        for (const [entryIndexStr, bankData] of Object.entries(langData.banks)) {
            const entryIndex = parseInt(entryIndexStr);

            // Check if any strings were modified
            const hasModifications = bankData.strings.some(s => s.modified !== s.original);

            if (hasModifications) {
                console.log(`[${langName}] Entry ${entryIndex} (${bankData.name}): rebuilding...`);

                const newStrings = bankData.strings.map(s => ({
                    text: s.modified
                }));

                const newBuffer = writeTextBank(newStrings);

                hqr.entries[entryIndex] = new HQREntry(
                    newBuffer.buffer.slice(newBuffer.byteOffset, newBuffer.byteOffset + newBuffer.byteLength),
                    CompressionType.NONE
                );

                modifiedCount++;
            }
        }
    }

    if (modifiedCount === 0) {
        console.log('No modifications detected. TEXT.HQR unchanged.');
        return;
    }

    // Write new HQR
    const outputDir = path.join(__dirname, '../../output');
    fs.mkdirSync(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, 'TEXT.HQR');
    const packedBuffer = hqr.toArrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(packedBuffer));

    console.log(`\n${modifiedCount} bank(s) modified.`);
    console.log(`Created: ${outputPath} (${(packedBuffer.byteLength / 1024).toFixed(2)} KB)`);
}

// List command - show sample dialogue
async function listDialogue() {
    const textHqrPath = path.join(BASE_GAME_DIR, 'TEXT.HQR');
    if (!fs.existsSync(textHqrPath)) {
        console.error('ERROR: TEXT.HQR not found in base_game/');
        process.exit(1);
    }

    const buffer = fs.readFileSync(textHqrPath);
    const hqr = HQR.fromArrayBuffer(buffer.buffer);

    console.log('=== Sample Dialogue from TEXT.HQR ===\n');

    // Show English dialogue (entry 7)
    const entry = hqr.entries[7];
    const buf = Buffer.from(entry.content);
    const strings = readTextBank(buf);

    console.log('Entry 7 - Main English Dialogue:\n');
    strings.slice(0, 20).forEach((s, i) => {
        if (s.text.length > 10) {
            console.log(`  [${i}] ${s.text.substring(0, 100)}${s.text.length > 100 ? '...' : ''}`);
        }
    });
}

// Main
const command = process.argv[2];

if (command === 'extract') {
    extractText();
} else if (command === 'repack') {
    repackText();
} else if (command === 'list') {
    listDialogue();
} else {
    console.log('LBA1 Text/Dialogue Editor');
    console.log('');
    console.log('Usage:');
    console.log('  node edit-text.js extract   Extract text to JSON');
    console.log('  node edit-text.js repack    Rebuild TEXT.HQR from JSON');
    console.log('  node edit-text.js list      Show sample dialogue');
    console.log('');
    console.log('Workflow:');
    console.log('  1. Run: node edit-text.js extract');
    console.log('  2. Edit: modded_assets/text/dialogue_strings.json');
    console.log('  3. Run: node edit-text.js repack');
    console.log('  4. Copy output/TEXT.HQR to test');
}
