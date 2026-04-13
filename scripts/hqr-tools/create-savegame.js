/**
 * LBA1 Save Game Generator (remaster-compatible)
 *
 * Creates .LBA save files that place Twinsen at specific portfolio locations.
 * Compatible with the GOG remaster (TLBA1C.exe / 2point21).
 *
 * Save path: C:\Users\<user>\Saved Games\2point21\tlba-classic\Save\S{id}.LBA
 *
 * Format: [0x03][title bytes][0x00][data section (0x1CA bytes)]
 *   All data offsets are relative to titleEnd (byte after the null terminator).
 *   Real saves use very short titles (1-2 chars). We do the same.
 *
 * Usage:
 *   node create-savegame.js              Create all saves + deploy to game
 *   node create-savegame.js citadel      Single save, deploy to game
 *   node create-savegame.js list         List available locations
 *   node create-savegame.js --no-deploy  Create only, don't copy to game
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

// Size of the DATA section (everything after titleEnd). Fixed at 0x1CA = 458 bytes.
const DATA_SIZE = 0x1CA;

// Deploy path — where TLBA1C.exe reads/writes saves
const SAVE_DIR = path.join(
    os.homedir(),
    'Saved Games', '2point21', 'tlba-classic', 'Save'
);

// Area codes from lbafileinfo.kaziq.net/index.php/LBA1:Savegame
const AREA = {
    prison:             0x00,
    citadel_outside:    0x01,  // Citadel Island exterior — main NPC hub
    citadel_tavern:     0x02,
    citadel_pharmacy:   0x03,
    citadel_houses:     0x04,
    twinsen_house:      0x05,
    citadel_harbor:     0x06,
    pharmacy:           0x07,
    library:            0x0A,
    principal_harbor:   0x0B,
    lupin_burg:         0x0D,  // Old Burg — AI Workshop
    tavern:             0x0E,
    proxim_city:        0x2A,  // Proxima City — Electronics Lab
    museum:             0x2B,  // Maritime Museum — Portfolio Showroom
    rebel_camp:         0x3C,  // Rebellion Base — Maker Space
};

// Portfolio locations.
// Coordinates are in LBA1 world units (16-bit). Y = height (higher = up).
// These will likely need calibration on first test — adjust x/z until Twinsen
// lands in open space. Chapter 0x01 = post-prison escape (NPCs neutral/friendly).
const LOCATIONS = {
    citadel: {
        name: 'Portfolio Hub',       // short title written to save file
        area: AREA.citadel_outside,
        chapter: 0x02,
        x: 0x4910, y: 0x0300, z: 0x1d5f,  // from scene 1 hero start
        angle: 0x0000,
        outfit: 0x00,
    },
    house: {
        name: 'Home',
        area: AREA.twinsen_house,
        chapter: 0x02,
        x: 0x6a00, y: 0x0800, z: 0x3c00,  // from scene 5 hero start
        angle: 0x0000,
        outfit: 0x00,
    },
    museum: {
        name: 'Museum',
        area: AREA.museum,
        chapter: 0x02,
        x: 0x5c00, y: 0x0700, z: 0x3c00,  // from scene 43 hero start
        angle: 0x0000,
        outfit: 0x00,
    },
    old_burg: {
        name: 'OldBurg',
        area: AREA.lupin_burg,
        chapter: 0x02,
        x: 0x7600, y: 0x0100, z: 0x7c00,  // from scene 13 hero start
        angle: 0x0000,
        outfit: 0x00,
    },
    proxima: {
        name: 'Proxima',
        area: AREA.proxim_city,
        chapter: 0x02,
        x: 0x34ae, y: 0x0200, z: 0x65fc,  // from scene 42 hero start
        angle: 0x0000,
        outfit: 0x00,
    },
    rebellion: {
        name: 'Rebel',
        area: AREA.rebel_camp,
        chapter: 0x02,
        x: 0x6600, y: 0x0100, z: 0x6e00,  // from scene 60 hero start
        angle: 0x0000,
        outfit: 0x00,
    },
    harbor: {
        name: 'Harbor',
        area: AREA.citadel_harbor,
        chapter: 0x02,
        x: 0x2a43, y: 0x0500, z: 0x50e6,  // from scene 6 hero start
        angle: 0x0000,
        outfit: 0x00,
    },
};

/**
 * Build a save game Buffer for the given location.
 *
 * Layout:
 *   [0x03][title][0x00] = header (variable, 2 + title.length bytes)
 *   [data section]      = DATA_SIZE bytes, offsets relative to titleEnd
 */
function buildSave(loc) {
    const titleBytes = Buffer.from(loc.name, 'ascii');
    const headerSize = 1 + titleBytes.length + 1; // ident + title + null
    const totalSize  = headerSize + DATA_SIZE;
    const buf        = Buffer.alloc(totalSize, 0x00);

    let off = 0;
    buf[off++] = 0x03;                      // ident
    titleBytes.copy(buf, off);
    off += titleBytes.length;
    buf[off++] = 0x00;                      // null terminator
    const T = off;                          // titleEnd — base for all data offsets

    // ── Inventory ────────────────────────────────────────────────────────────
    buf[T + 0x00] = 0xFF;   // number of game flags
    buf[T + 0x01] = 0x01;   // holomap
    buf[T + 0x02] = 0x01;   // magic ball
    buf[T + 0x0B] = 0x01;   // ID card
    buf[T + 0x18] = 0x01;   // ferry ticket

    // ── Quest flags ──────────────────────────────────────────────────────────
    // Mark prologue/intro as done so the game never re-triggers it.
    // Flag indices from lbafileinfo.kaziq.net/index.php/LBA1:Savegame
    buf[T + 0x01] = 0x01;   // flag 0: prison intro watched / Twinsen woke up
    buf[T + 0x02] = 0x01;   // flag 1: dream sequence done
    buf[T + 0x03] = 0x01;   // flag 2: guardian / platform encounter done
    buf[T + 0x04] = 0x01;   // flag 3: chimney escape done
    buf[T + 0x20] = 0x01;   // tavern cellar open
    buf[T + 0x21] = 0x01;   // bar re-opened
    buf[T + 0x24] = 0x01;   // escaped through chimney (duplicate safety)
    buf[T + 0x25] = 0x01;   // Twinsen's house intro done

    // ── Game state (at titleEnd + 0x100) ─────────────────────────────────────
    buf[T + 0x100] = loc.area;
    buf[T + 0x101] = loc.chapter;
    buf[T + 0x102] = 0x00;              // behavior (normal)
    buf[T + 0x103] = 0x32;              // life = 50 (max)
    buf.writeUInt16LE(100, T + 0x104);  // kashes = 100
    buf[T + 0x106] = 0x02;             // magic level
    buf[T + 0x107] = 0x28;             // magic power = 40
    buf[T + 0x108] = 0x02;             // clover boxes

    buf.writeUInt16LE(loc.x,     T + 0x109);
    buf.writeUInt16LE(loc.y,     T + 0x10B);
    buf.writeUInt16LE(loc.z,     T + 0x10D);
    buf.writeUInt16LE(loc.angle, T + 0x10F);
    buf[T + 0x111] = loc.outfit;

    // ── Holomap (150 entries starting at T+0x112) ─────────────────────────────
    buf[T + 0x112] = 0x96; // 150 entries
    for (let i = 0; i < 0x96; i++) {
        buf[T + 0x113 + i] = 0x40; // "visited"
    }

    // ── Miscellaneous tail ────────────────────────────────────────────────────
    buf[T + 0x1A9] = 0x63; // gas = 99
    buf[T + 0x1AA] = 0x1C; // used inventory flags count
    buf[T + 0x1AB] = 0x01; // holomap used
    buf[T + 0x1AC] = 0x01; // magic ball used
    buf[T + 0x1C7] = 0x02; // clover leaves
    buf[T + 0x1C8] = 0x00; // selected weapon
    buf[T + 0x1C9] = 0x00; // always 0

    return buf;
}

function writeSave(key, loc, outputDir, deploy, dosMode) {
    const ids = Object.keys(LOCATIONS);
    const slotIndex = ids.indexOf(key);  // 0-based slot number
    const buf = buildSave(loc);

    fs.mkdirSync(outputDir, { recursive: true });

    // Remaster format: S{id}.LBA
    const remasterId = 9000 + slotIndex + 1;
    const remasterFile = `S${remasterId}.LBA`;
    const localPath = path.join(outputDir, remasterFile);
    fs.writeFileSync(localPath, buf);
    console.log(`  [local] ${localPath} (${buf.length}b, area 0x${loc.area.toString(16).padStart(2,'0')})`);

    if (deploy) {
        try {
            fs.mkdirSync(SAVE_DIR, { recursive: true });
            const gamePath = path.join(SAVE_DIR, remasterFile);
            fs.copyFileSync(localPath, gamePath);
            console.log(`  [game]  ${gamePath}`);
        } catch (e) {
            console.warn(`  [warn]  Could not deploy to game dir: ${e.message}`);
        }
    }

    // DOS format: LBA.S0x (for js-dos web bundle)
    if (dosMode) {
        const dosFile = `LBA.S${String(slotIndex).padStart(2, '0')}`;
        const dosDir  = path.join(outputDir, 'dos');
        fs.mkdirSync(dosDir, { recursive: true });
        const dosPath = path.join(dosDir, dosFile);
        fs.writeFileSync(dosPath, buf);
        console.log(`  [dos]   ${dosPath}`);
    }
}

// ── CLI ───────────────────────────────────────────────────────────────────────

const args       = process.argv.slice(2).filter(a => !a.startsWith('--'));
const noDeploy   = process.argv.includes('--no-deploy');
const dosDeploy  = process.argv.includes('--dos');  // also write DOS LBA.S0x saves
const deploy     = !noDeploy;
const command    = args[0];
const OUTPUT_DIR = path.join(__dirname, '../../output/saves');

switch (command) {
    case 'list':
        console.log('Available portfolio locations:\n');
        for (const [key, loc] of Object.entries(LOCATIONS)) {
            console.log(`  ${key.padEnd(12)} area 0x${loc.area.toString(16).padStart(2,'0')}  "${loc.name}"`);
        }
        console.log(`\nGame save dir: ${SAVE_DIR}`);
        break;

    case undefined:
        console.log(`Creating all portfolio saves${deploy ? ' + deploying to game' : ''}${dosDeploy ? ' + DOS format' : ''}...\n`);
        for (const [key, loc] of Object.entries(LOCATIONS)) {
            writeSave(key, loc, OUTPUT_DIR, deploy, dosDeploy);
        }
        console.log('\nDone. Launch the game and use "Continue Saved Game" to test.');
        break;

    default:
        if (!LOCATIONS[command]) {
            console.error(`Unknown location: ${command}`);
            console.error('Run with "list" to see options.');
            process.exit(1);
        }
        console.log(`Creating save for: ${command}${deploy ? ' (deploying)' : ''}\n`);
        writeSave(command, LOCATIONS[command], OUTPUT_DIR, deploy, dosDeploy);
        break;
}
