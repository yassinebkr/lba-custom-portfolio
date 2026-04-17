/**
 * Build the jsdos web bundle with canonical js-dos 6.22 structure:
 *   .jsdos/                 (directory entry — required by libzip wrapper)
 *   .jsdos/dosbox.conf      (js-dos picks this up as the user config)
 *   *.HQR *.EXE *.CFG *.S0x (game files flat at root; C: is mounted to /)
 *   LBA.ISO                 (ISO9660 CD image with label ADELINE)
 *
 * The "No CD" check in RELENT.EXE is a three-part probe, verified against
 * the real GOG LBA.DOT BIN at Speedrun/Windows/LBA.DOT:
 *   1. CD-ROM volume label must be "ADELINE" (NOT "CD_LBA" — that trap
 *      is what my earlier build had. "CD_LBA" is a FILENAME, not the
 *      volume label. RELENT.EXE strings contain both, but the label
 *      string is at 0x33578 and the file name is at 0x3315c).
 *   2. A file named CD_LBA (no extension — stored in ISO9660 8.3 as
 *      "CD_LBA.") must exist at the CD root. The real CD holds 22 bytes:
 *      '"15/08/94 Lba Demo" \r\n'. Presence check — content is an ID
 *      string the game reads but doesn't strictly validate.
 *   3. \LBA\FLA\INTROD.FLA must exist (15 MB) — used for the prologue.
 *      RELENT.EXE hardcodes path "c\LBA\FLA\" at 0x33167.
 *
 * DOSBox's `imgmount d LBA.ISO -t iso` gives real MSCDEX semantics (volume
 * label via ioctl + ISO9660 file I/O). Plain `mount -t cdrom <dir>` only
 * fakes part of MSCDEX and the volume-label probe fails under js-dos.
 *
 * IMAPI2 gotcha: ChooseImageDefaultsForMediaType(13) enables UDF by
 * default, which produces a UDF image with NO CD001 PVD that DOSBox
 * cannot read. We must set FileSystemsToCreate = 1 (ISO9660 only) AFTER
 * ChooseImageDefaultsForMediaType or the default overrides us.
 */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT  = path.resolve(__dirname, '../..');
const BASE  = path.join(ROOT, 'base_game');
const OUT   = path.join(ROOT, 'output');
const WEB   = path.join(ROOT, 'web_deploy');
const TMP     = path.join(WEB, '_tmp');      // bundle staging (C: content)
const META    = path.join(TMP, '.jsdos');
const CDTMP   = path.join(WEB, '_cdtmp');    // ISO staging (D: content)
const CD_FLA  = path.join(CDTMP, 'LBA', 'FLA');
const LBA_ISO = path.join(TMP, 'LBA.ISO');   // shipped inside the .jsdos
const JSDOS   = path.join(WEB, 'lba1_portfolio.jsdos');
const PS1     = path.join(WEB, '_pack.ps1');
const ISO_PS1 = path.join(WEB, '_mkiso.ps1');

// Source for the CD-only FLA videos. GOG installs them here.
const GOG_FLA = 'E:/Program Files (x86)/GOG Galaxy/Games/tlba-classic/Common/Fla';

// ── Assemble files ────────────────────────────────────────────
if (fs.existsSync(TMP))   fs.rmSync(TMP,   { recursive: true });
if (fs.existsSync(CDTMP)) fs.rmSync(CDTMP, { recursive: true });
fs.mkdirSync(TMP,    { recursive: true });
fs.mkdirSync(META,   { recursive: true });
fs.mkdirSync(CD_FLA, { recursive: true });

function copyMatch(src, dest, pattern) {
    fs.readdirSync(src)
      .filter(f => new RegExp(pattern, 'i').test(f))
      .forEach(f => fs.copyFileSync(path.join(src, f), path.join(dest, f)));
}

// Game files go straight at the bundle root — DOSBox mounts C: to this.
copyMatch(BASE, TMP, '\\.(hqr|exe|cfg)$');
console.log('[OK] base game files');

// Overlay any modded HQR files from output/ on top of base_game originals
const modHQRs = fs.readdirSync(OUT).filter(f => /\.hqr$/i.test(f));
for (const hqr of modHQRs) {
    fs.copyFileSync(path.join(OUT, hqr), path.join(TMP, hqr));
    console.log('[OK] modded ' + hqr);
}

// Patched RELENT.EXE that skips the "No CD" check — see
// scripts/hqr-tools/patch-relent.js for the two byte-patches and
// memory/lba1_no_cd_probe.md for why this was necessary.
const patchedRelent = path.join(OUT, 'RELENT.EXE');
if (fs.existsSync(patchedRelent)) {
    fs.copyFileSync(patchedRelent, path.join(TMP, 'RELENT.EXE'));
    console.log('[OK] patched RELENT.EXE (No CD bypass)');
}

const dosDir = path.join(OUT, 'saves', 'dos');
if (fs.existsSync(dosDir)) {
    copyMatch(dosDir, TMP, '\\.LBA$');
    console.log('[OK] DOS saves');
}

// VOX files excluded: ~33MB uncompressed, exceeds js-dos 6.22 WASM heap (~32MB)
// FlagKeepVoice: OFF in LBA.CFG so the game won't look for them
console.log('[SKIP] VOX files (too large for WASM heap)');

// FLA videos live on the CD-ROM (D:) in stock LBA1. RELENT.EXE hardcodes
// the path "\LBA\FLA\*.FLA" and opens files on D:. We stage those files in
// CDTMP and build a real ISO from them below.
const realFla = path.join(GOG_FLA, 'INTROD.FLA');
if (fs.existsSync(realFla)) {
    fs.copyFileSync(realFla, path.join(CD_FLA, 'INTROD.FLA'));
    var flaMb = (fs.statSync(realFla).size / 1024 / 1024).toFixed(1);
    console.log('[OK] stage LBA/FLA/INTROD.FLA (' + flaMb + ' MB)');
} else {
    console.warn('[WARN] INTROD.FLA not found at', realFla);
}

// The game also hardcodes "D:samples.hqr" in RELENT.EXE — visible at
// 0x33220 in the data section. Stage SAMPLES.HQR at the CD root so the
// engine's D:samples.hqr probe finds it.
const rootSamples = path.join(BASE, 'SAMPLES.HQR');
if (fs.existsSync(rootSamples)) {
    fs.copyFileSync(rootSamples, path.join(CDTMP, 'SAMPLES.HQR'));
    console.log('[OK] stage SAMPLES.HQR at CD root');
}

// CD_LBA file — presence check at CD root. ISO9660 stores this as
// "CD_LBA." (8.3 with empty extension). Content is 22 bytes lifted
// verbatim from the real GOG CD so any byte-level check passes.
fs.writeFileSync(path.join(CDTMP, 'CD_LBA'), '"15/08/94 Lba Demo" \r\n');
console.log('[OK] stage CD_LBA stub at CD root (22 bytes)');

// ── Build the CD ISO9660 image via Windows IMAPI2 ─────────────
// IMAPI2FS.MsftFileSystemImage can emit a plain ISO9660 (Joliet off by
// setting FileSystemsToCreate=1) with a volume label. We drop the result
// straight into the bundle root as LBA.ISO so autoexec can imgmount it.
const cdTmpWin = CDTMP.replace(/\//g, '\\');
const isoWin   = LBA_ISO.replace(/\//g, '\\');
fs.writeFileSync(ISO_PS1, [
    '$ErrorActionPreference = "Stop"',
    '$cp = New-Object System.CodeDom.Compiler.CompilerParameters',
    '$cp.CompilerOptions = "/unsafe"',
    'Add-Type -CompilerParameters $cp -TypeDefinition @"',
    'using System;',
    'using System.IO;',
    'using System.Runtime.InteropServices.ComTypes;',
    'public class ISOFile {',
    '    public unsafe static void Create(string Path, object Stream, int BlockSize, int TotalBlocks) {',
    '        int bytes = 0;',
    '        byte[] buf = new byte[BlockSize];',
    '        IntPtr ptr = (IntPtr)(&bytes);',
    '        var fs = new FileStream(Path, FileMode.Create);',
    '        var i  = Stream as IStream;',
    '        while (TotalBlocks-- > 0) { i.Read(buf, BlockSize, ptr); fs.Write(buf, 0, bytes); }',
    '        fs.Flush(); fs.Close();',
    '    }',
    '}',
    '"@',
    '$image = New-Object -ComObject IMAPI2FS.MsftFileSystemImage',
    '$image.ChooseImageDefaultsForMediaType(13)  # MEDIA_CDROM (sets defaults incl. UDF — must override after)',
    '$image.VolumeName = "ADELINE"',
    '# 1 = ISO9660 only. MUST be set AFTER ChooseImageDefaultsForMediaType, which',
    '# otherwise forces UDF on top and produces a pure-UDF image that DOSBox cannot',
    '# read via imgmount -t iso (needs CD001 PVD at sector 16).',
    '$image.FileSystemsToCreate = 1',
    '$image.ISO9660InterchangeLevel = 1  # 8.3 filenames only, what DOS/MSCDEX expects',
    '$image.Root.AddTree("' + cdTmpWin + '", $false)',
    '$result = $image.CreateResultImage()',
    '[ISOFile]::Create("' + isoWin + '", $result.ImageStream, $result.BlockSize, $result.TotalBlocks)',
    '$mb = [math]::Round((Get-Item "' + isoWin + '").Length / 1MB, 2)',
    'Write-Host "ISO: $mb MB  label=CD_LBA"',
].join('\r\n'));
execSync('powershell -ExecutionPolicy Bypass -File "' + ISO_PS1.replace(/\//g, '\\') + '"',
    { stdio: 'inherit' });
fs.unlinkSync(ISO_PS1);
console.log('[OK] LBA.ISO built');

// dosbox.conf lives inside .jsdos/ — js-dos 6.22 convention. The launcher
// passes the real autoexec via main([-c, ...]) since js-dos ignores this
// file's [autoexec] section (see jsdos_bundle_format memory).
fs.writeFileSync(path.join(META, 'dosbox.conf'), [
    '[sdl]',
    '',
    '[dosbox]',
    'machine=svga_s3',
    'memsize=16',
    '',
    '[cpu]',
    'core=auto',
    'cputype=auto',
    'cycles=auto',
    '',
    '[sblaster]',
    'sbtype=sb16',
    'sbbase=220',
    'irq=7',
    'dma=1',
    'hdma=5',
    'sbmixer=true',
    'oplmode=auto',
    '',
    '[midi]',
    'mididevice=none',
    '',
].join('\r\n'));
console.log('[OK] .jsdos/dosbox.conf');

// LBA.CFG — use VESA instead of S3.DLL (GOG Classic install doesn't
// ship the original DOS video-driver .DLLs). VESA is a LBA1 built-in
// that talks to the BIOS directly; DOSBox emulates a VESA BIOS so no
// driver file is needed. Sound fully disabled to isolate from video.
fs.writeFileSync(path.join(TMP, 'LBA.CFG'), [
    '; LBA web config — VESA BIOS mode, no sound',
    'Language: English',
    'LanguageCD: English',
    'FlagKeepVoice: OFF',
    'FlagDisplayText: ON',
    'SvgaDriver: VESA',
    'MidiDriver: NoMidi',
    'MidiExec: NoExec',
    'MidiBase: 330h',
    'MidiIRQ: ',
    'MidiDMA: ',
    'MidiType: Fm',
    'WaveDriver: NoWave',
    'WaveExec: NoExec',
    'WaveBase: 220h',
    'WaveIRQ: 7',
    'WaveDMA: 1',
    'WaveRate: 22000',
    'MixerDriver: NoMixer',
    'MixerBase: 220h',
    'WaveVolume: 163',
    'MusicVolume: 100',
    'CDVolume: 0',
    'LineVolume: 0',
    'MasterVolume: 128',
    ''
].join('\r\n'));
console.log('[OK] LBA.CFG (VESA, no sound)');

// ── Write PowerShell packer ───────────────────────────────────
const tmpWin  = TMP.replace(/\//g, '\\');
const jsdoWin = JSDOS.replace(/\//g, '\\');

// NOTE: we emit an explicit directory entry for ".jsdos/" AND every sub-
// directory of TMP. js-dos 6.22's extract-zip C wrapper calls exit(101) if
// a file lives in a sub-folder that lacks its own directory entry.
// CreateEntry (no file arg) produces a zero-byte directory marker identical
// to what canonical .jsdos bundles ship.
const ps1Content = [
    'Add-Type -Assembly "System.IO.Compression.FileSystem"',
    'if (Test-Path "' + jsdoWin + '") { Remove-Item "' + jsdoWin + '" }',
    '$zip = [System.IO.Compression.ZipFile]::Open("' + jsdoWin + '", "Create")',
    '# Directory entries first — order matters for the C wrapper.',
    '$zip.CreateEntry(".jsdos/") | Out-Null',
    'Get-ChildItem "' + tmpWin + '" -Recurse -Directory | ForEach-Object {',
    '    $rel = $_.FullName.Substring(' + (tmpWin.length + 1) + ').Replace("\\", "/") + "/"',
    '    if ($rel -ne ".jsdos/") { $zip.CreateEntry($rel) | Out-Null }',
    '}',
    'Get-ChildItem "' + tmpWin + '" -Recurse -File | ForEach-Object {',
    '    $rel = $_.FullName.Substring(' + (tmpWin.length + 1) + ').Replace("\\", "/")',
    '    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel) | Out-Null',
    '}',
    '$zip.Dispose()',
    '$mb = [math]::Round((Get-Item "' + jsdoWin + '").Length / 1MB, 1)',
    'Write-Host "Bundle: $mb MB"',
].join('\n');

fs.writeFileSync(PS1, ps1Content);
execSync('powershell -ExecutionPolicy Bypass -File "' + PS1.replace(/\//g, '\\') + '"', { stdio: 'inherit' });
fs.unlinkSync(PS1);
fs.rmSync(TMP,   { recursive: true });
fs.rmSync(CDTMP, { recursive: true });

// ── Verify structure ──────────────────────────────────────────
const vPS1 = path.join(WEB, '_verify.ps1');
fs.writeFileSync(vPS1, [
    'Add-Type -Assembly "System.IO.Compression.FileSystem"',
    '$z = [System.IO.Compression.ZipFile]::OpenRead("' + jsdoWin + '")',
    '$z.Entries | Select-Object -First 12 | ForEach-Object { $_.FullName }',
    '$z.Dispose()',
].join('\n'));
const result = execSync('powershell -ExecutionPolicy Bypass -File "' + vPS1.replace(/\//g, '\\') + '"').toString();
fs.unlinkSync(vPS1);
console.log('\nZIP root entries:');
console.log(result.trim());
