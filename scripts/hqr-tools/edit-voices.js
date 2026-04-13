/**
 * LBA1 Voice Editor
 *
 * Extract, replace, and repack voice files (VOX format).
 * VOX files are HQR archives containing Creative VOC audio.
 *
 * Usage:
 *   node edit-voices.js list <lang>           List voice entries
 *   node edit-voices.js extract <lang> <idx>  Extract single voice to WAV
 *   node edit-voices.js extract-all <lang>    Extract all voices
 *   node edit-voices.js replace <lang> <idx> <wav>  Replace voice from WAV
 *   node edit-voices.js repack <lang>         Rebuild VOX file
 */

const { HQR, HQREntry, CompressionType } = require('@lbalab/hqr');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE_VOX_DIR = path.join(__dirname, '../../base_game/VOX');
const MODDED_DIR = path.join(__dirname, '../../modded_assets/voices');
const OUTPUT_DIR = path.join(__dirname, '../../output/VOX');

// VOX file mapping
const VOX_FILES = {
    'en': ['EN_000.VOX', 'EN_001.VOX', 'EN_GAM.VOX'],
    'fr': ['FR_000.VOX', 'FR_001.VOX', 'FR_GAM.VOX'],
    'de': ['DE_000.VOX', 'DE_001.VOX', 'DE_GAM.VOX']
};

/**
 * Parse Creative VOC file header
 * Returns audio data info (sample rate, etc.)
 */
function parseVOC(buffer) {
    // VOC header: "Creative Voice File\x1A\x1A" + version + offset
    const magic = buffer.slice(0, 19).toString('ascii');
    if (!magic.startsWith('Creative Voice File')) {
        // Might be raw PCM or different format
        return { raw: true, data: buffer, sampleRate: 22050, bits: 8 };
    }

    const headerSize = buffer.readUInt16LE(20);
    const version = buffer.readUInt16LE(22);

    // Parse data blocks
    let pos = headerSize;
    let audioData = [];
    let sampleRate = 22050;

    while (pos < buffer.length) {
        const blockType = buffer[pos];
        if (blockType === 0) break; // Terminator

        const blockSize = buffer.readUInt16LE(pos + 1) | (buffer[pos + 3] << 16);
        pos += 4;

        if (blockType === 1) {
            // Sound data block
            const freqDiv = buffer[pos];
            sampleRate = Math.round(1000000 / (256 - freqDiv));
            const codec = buffer[pos + 1];
            audioData.push(buffer.slice(pos + 2, pos + blockSize - 2));
        } else if (blockType === 9) {
            // Extended sound data (newer format)
            sampleRate = buffer.readUInt32LE(pos);
            const bits = buffer[pos + 4];
            const channels = buffer[pos + 5];
            audioData.push(buffer.slice(pos + 12, pos + blockSize - 12));
        }

        pos += blockSize;
    }

    return {
        raw: false,
        data: Buffer.concat(audioData),
        sampleRate,
        bits: 8
    };
}

/**
 * Create VOC file from raw audio data
 */
function createVOC(audioData, sampleRate = 22050) {
    // VOC header
    const header = Buffer.from('Creative Voice File\x1A\x1A');
    const headerInfo = Buffer.alloc(6);
    headerInfo.writeUInt16LE(0x1A, 0); // Header size offset
    headerInfo.writeUInt16LE(0x010A, 2); // Version 1.10
    headerInfo.writeUInt16LE(0x1129, 4); // Version check

    // Sound data block (type 1)
    const freqDiv = Math.round(256 - (1000000 / sampleRate));
    const blockHeader = Buffer.alloc(6);
    blockHeader[0] = 1; // Block type: sound data
    const blockSize = audioData.length + 2;
    blockHeader.writeUInt16LE(blockSize & 0xFFFF, 1);
    blockHeader[3] = (blockSize >> 16) & 0xFF;
    blockHeader[4] = freqDiv;
    blockHeader[5] = 0; // Codec: unsigned 8-bit PCM

    // Terminator
    const terminator = Buffer.from([0]);

    return Buffer.concat([header, headerInfo, blockHeader, audioData, terminator]);
}

/**
 * Convert VOC to WAV
 */
function vocToWav(vocBuffer) {
    const { data, sampleRate, bits } = parseVOC(vocBuffer);

    // WAV header for 8-bit mono
    const header = Buffer.alloc(44);
    const dataSize = data.length;
    const fileSize = 36 + dataSize;

    // RIFF header
    header.write('RIFF', 0);
    header.writeUInt32LE(fileSize, 4);
    header.write('WAVE', 8);

    // fmt chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // Chunk size
    header.writeUInt16LE(1, 20); // Audio format (PCM)
    header.writeUInt16LE(1, 22); // Channels
    header.writeUInt32LE(sampleRate, 24); // Sample rate
    header.writeUInt32LE(sampleRate, 28); // Byte rate
    header.writeUInt16LE(1, 32); // Block align
    header.writeUInt16LE(8, 34); // Bits per sample

    // data chunk
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, data]);
}

/**
 * Convert WAV to raw PCM for VOC
 */
function wavToRawPCM(wavBuffer) {
    // Parse WAV header
    const riff = wavBuffer.slice(0, 4).toString('ascii');
    if (riff !== 'RIFF') throw new Error('Not a valid WAV file');

    // Find data chunk
    let pos = 12;
    while (pos < wavBuffer.length - 8) {
        const chunkId = wavBuffer.slice(pos, pos + 4).toString('ascii');
        const chunkSize = wavBuffer.readUInt32LE(pos + 4);

        if (chunkId === 'fmt ') {
            const audioFormat = wavBuffer.readUInt16LE(pos + 8);
            const channels = wavBuffer.readUInt16LE(pos + 10);
            const sampleRate = wavBuffer.readUInt32LE(pos + 12);
            const bitsPerSample = wavBuffer.readUInt16LE(pos + 22);

            console.log(`  WAV: ${sampleRate}Hz, ${channels}ch, ${bitsPerSample}bit`);

            if (channels !== 1 || bitsPerSample !== 8) {
                console.log('  WARNING: LBA expects 8-bit mono. Convert your WAV first.');
                console.log('  Use: ffmpeg -i input.wav -ar 22050 -ac 1 -c:a pcm_u8 output.wav');
            }
        }

        if (chunkId === 'data') {
            return {
                data: wavBuffer.slice(pos + 8, pos + 8 + chunkSize),
                sampleRate: 22050
            };
        }

        pos += 8 + chunkSize;
    }

    throw new Error('No data chunk found in WAV');
}

// List voices in a language
async function listVoices(lang) {
    const voxFiles = VOX_FILES[lang];
    if (!voxFiles) {
        console.error('Unknown language:', lang);
        console.error('Available:', Object.keys(VOX_FILES).join(', '));
        return;
    }

    for (const voxFile of voxFiles) {
        const voxPath = path.join(BASE_VOX_DIR, voxFile);
        if (!fs.existsSync(voxPath)) continue;

        const buffer = fs.readFileSync(voxPath);
        const hqr = HQR.fromArrayBuffer(buffer.buffer);

        console.log(`\n=== ${voxFile} (${hqr.entries.length} entries) ===`);

        for (let i = 0; i < Math.min(20, hqr.entries.length); i++) {
            const entry = hqr.entries[i];
            if (!entry || !entry.content) continue;

            const vocData = parseVOC(Buffer.from(entry.content));
            const duration = (vocData.data.length / vocData.sampleRate).toFixed(2);

            console.log(`  [${i}] ${entry.content.byteLength} bytes, ~${duration}s`);
        }

        if (hqr.entries.length > 20) {
            console.log(`  ... and ${hqr.entries.length - 20} more entries`);
        }
    }
}

// Extract single voice
async function extractVoice(lang, voxIndex, entryIndex) {
    const voxFiles = VOX_FILES[lang];
    const voxFile = voxFiles[voxIndex] || voxFiles[0];
    const voxPath = path.join(BASE_VOX_DIR, voxFile);

    if (!fs.existsSync(voxPath)) {
        console.error('VOX file not found:', voxPath);
        return;
    }

    const buffer = fs.readFileSync(voxPath);
    const hqr = HQR.fromArrayBuffer(buffer.buffer);

    if (entryIndex >= hqr.entries.length) {
        console.error(`Entry ${entryIndex} not found. Max: ${hqr.entries.length - 1}`);
        return;
    }

    const entry = hqr.entries[entryIndex];
    const vocBuffer = Buffer.from(entry.content);
    const wavBuffer = vocToWav(vocBuffer);

    const outDir = path.join(MODDED_DIR, lang);
    fs.mkdirSync(outDir, { recursive: true });

    const outPath = path.join(outDir, `${voxFile.replace('.VOX', '')}_${entryIndex}.wav`);
    fs.writeFileSync(outPath, wavBuffer);

    console.log(`Extracted: ${outPath}`);
}

// Extract all voices for a language
async function extractAll(lang) {
    const voxFiles = VOX_FILES[lang];
    if (!voxFiles) {
        console.error('Unknown language:', lang);
        return;
    }

    const outDir = path.join(MODDED_DIR, lang);
    fs.mkdirSync(outDir, { recursive: true });

    let totalExtracted = 0;

    for (const voxFile of voxFiles) {
        const voxPath = path.join(BASE_VOX_DIR, voxFile);
        if (!fs.existsSync(voxPath)) continue;

        const buffer = fs.readFileSync(voxPath);
        const hqr = HQR.fromArrayBuffer(buffer.buffer);

        console.log(`\nExtracting ${voxFile}...`);

        for (let i = 0; i < hqr.entries.length; i++) {
            const entry = hqr.entries[i];
            if (!entry || !entry.content) continue;

            try {
                const vocBuffer = Buffer.from(entry.content);
                const wavBuffer = vocToWav(vocBuffer);

                const outPath = path.join(outDir, `${voxFile.replace('.VOX', '')}_${String(i).padStart(3, '0')}.wav`);
                fs.writeFileSync(outPath, wavBuffer);
                totalExtracted++;
            } catch (e) {
                console.log(`  [${i}] Failed: ${e.message}`);
            }
        }
    }

    console.log(`\nExtracted ${totalExtracted} voice files to: ${outDir}`);
}

// Replace a voice entry
async function replaceVoice(lang, voxFileIndex, entryIndex, wavPath) {
    const voxFiles = VOX_FILES[lang];
    const voxFile = voxFiles[voxFileIndex] || voxFiles[0];
    const voxPath = path.join(BASE_VOX_DIR, voxFile);

    if (!fs.existsSync(voxPath)) {
        console.error('VOX file not found:', voxPath);
        return;
    }

    if (!fs.existsSync(wavPath)) {
        console.error('WAV file not found:', wavPath);
        return;
    }

    // Read VOX
    const buffer = fs.readFileSync(voxPath);
    const hqr = HQR.fromArrayBuffer(buffer.buffer);

    // Read and convert WAV
    console.log(`Converting: ${wavPath}`);
    const wavBuffer = fs.readFileSync(wavPath);
    const { data, sampleRate } = wavToRawPCM(wavBuffer);
    const vocBuffer = createVOC(data, sampleRate);

    console.log(`  VOC size: ${vocBuffer.length} bytes`);

    // Replace entry
    hqr.entries[entryIndex] = new HQREntry(
        vocBuffer.buffer.slice(vocBuffer.byteOffset, vocBuffer.byteOffset + vocBuffer.byteLength),
        CompressionType.NONE
    );

    // Save to modded directory
    const outDir = path.join(MODDED_DIR, lang, 'modified');
    fs.mkdirSync(outDir, { recursive: true });

    // Save the modified HQR
    const outPath = path.join(outDir, voxFile);
    const packedBuffer = hqr.toArrayBuffer();
    fs.writeFileSync(outPath, Buffer.from(packedBuffer));

    console.log(`\nReplaced entry ${entryIndex} in ${outPath}`);
}

// Main
const [,, command, ...args] = process.argv;

switch (command) {
    case 'list':
        listVoices(args[0] || 'en');
        break;
    case 'extract':
        extractVoice(args[0] || 'en', parseInt(args[1]) || 0, parseInt(args[2]) || 0);
        break;
    case 'extract-all':
        extractAll(args[0] || 'en');
        break;
    case 'replace':
        replaceVoice(args[0], parseInt(args[1]) || 0, parseInt(args[2]) || 0, args[3]);
        break;
    default:
        console.log('LBA1 Voice Editor');
        console.log('');
        console.log('Usage:');
        console.log('  node edit-voices.js list <lang>              List voice entries');
        console.log('  node edit-voices.js extract <lang> <vox#> <entry#>   Extract to WAV');
        console.log('  node edit-voices.js extract-all <lang>       Extract all to WAV');
        console.log('  node edit-voices.js replace <lang> <vox#> <entry#> <wav>  Replace from WAV');
        console.log('');
        console.log('Languages: en, fr, de');
        console.log('');
        console.log('Example workflow:');
        console.log('  1. node edit-voices.js list en');
        console.log('  2. node edit-voices.js extract en 0 5  # Extract EN_000.VOX entry 5');
        console.log('  3. Record your replacement as WAV (22050Hz, mono, 8-bit)');
        console.log('  4. node edit-voices.js replace en 0 5 my_voice.wav');
        console.log('');
        console.log('WAV conversion (if not 22050Hz mono 8-bit):');
        console.log('  ffmpeg -i input.wav -ar 22050 -ac 1 -c:a pcm_u8 output.wav');
}
