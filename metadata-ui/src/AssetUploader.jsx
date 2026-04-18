import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Upload, Check, AlertTriangle, RefreshCw, Download } from 'lucide-react';

/**
 * Drop-in replacer for a sprite or brick PNG.
 *
 * Flow:
 *   1. User drops / selects a PNG.
 *   2. We load it to a canvas, per-pixel snap RGB → nearest LBA palette index
 *      (alpha < 128 → transparent index 0), rebuild an RGBA PNG in-memory.
 *   3. Render before/after side-by-side at matching zoom with diff stats.
 *   4. PUT the palette-snapped PNG to /api/save-asset/<kind>/<filename>
 *      (Vite middleware writes it to modded_assets/<kind>/ AND public/<kind>/).
 *
 * Dimensions ≠ original are allowed but warned — LBA sprites have fixed
 * bounding boxes referenced by offsetX/offsetY; changing size without
 * re-anchoring the offsets in the injector will draw misaligned in-game.
 */

let cachedPalette = null;

async function loadPalette() {
  if (cachedPalette) return cachedPalette;
  const res = await fetch('/_palette.bin');
  const buf = new Uint8Array(await res.arrayBuffer());
  cachedPalette = buf;
  return buf;
}

function buildSnapper(palette) {
  // Skip index 0 — that's transparent only.
  const cache = new Map();
  return function nearest(r, g, b) {
    const key = (r << 16) | (g << 8) | b;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    let best = 1, bestDist = Infinity;
    for (let i = 1; i < 256; i++) {
      const dr = palette[i * 3]     - r;
      const dg = palette[i * 3 + 1] - g;
      const db = palette[i * 3 + 2] - b;
      const d  = dr * dr + dg * dg + db * db;
      if (d < bestDist) { bestDist = d; best = i; if (d === 0) break; }
    }
    cache.set(key, best);
    return best;
  };
}

async function fileToImageData(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width  = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
}

function snapToLbaPalette(imageData, palette, nearest) {
  const { width, height, data } = imageData;
  const out = new Uint8ClampedArray(data.length);
  let exact = 0, snapped = 0, transparent = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 128) {
      out[i + 3] = 0;
      transparent++;
      continue;
    }
    const idx = nearest(r, g, b);
    const pr = palette[idx * 3], pg = palette[idx * 3 + 1], pb = palette[idx * 3 + 2];
    out[i]     = pr;
    out[i + 1] = pg;
    out[i + 2] = pb;
    out[i + 3] = 255;
    if (pr === r && pg === g && pb === b) exact++;
    else snapped++;
  }

  const outCanvas = document.createElement('canvas');
  outCanvas.width  = width;
  outCanvas.height = height;
  const ctx = outCanvas.getContext('2d');
  ctx.putImageData(new ImageData(out, width, height), 0, 0);
  return { canvas: outCanvas, exact, snapped, transparent };
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
  });
}

export function AssetUploader({ kind, filename, expectedWidth, expectedHeight, originalSrc, onSaved }) {
  const [palette, setPalette] = useState(null);
  const [original, setOriginal] = useState(null);  // { width, height, dataUrl }
  const [snapped, setSnapped] = useState(null);    // { canvas, exact, snapped, transparent, dataUrl, width, height }
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => { loadPalette().then(setPalette).catch(e => setError(String(e))); }, []);

  const snapper = useMemo(() => palette ? buildSnapper(palette) : null, [palette]);

  const processFile = async (file) => {
    setError(null);
    setSaveResult(null);
    if (!file) return;
    if (!file.type.includes('png') && !file.name.toLowerCase().endsWith('.png')) {
      setError('PNG only — convert your file first.');
      return;
    }
    try {
      const imgData = await fileToImageData(file);
      const origUrl = URL.createObjectURL(file);
      setOriginal({ width: imgData.width, height: imgData.height, dataUrl: origUrl });

      const result = snapToLbaPalette(imgData, palette, snapper);
      const dataUrl = result.canvas.toDataURL('image/png');
      setSnapped({ ...result, dataUrl, width: imgData.width, height: imgData.height });
    } catch (e) {
      setError(String(e));
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const onPick = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const reset = () => {
    setOriginal(null);
    setSnapped(null);
    setSaveResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const save = async () => {
    if (!snapped) return;
    setSaving(true);
    setError(null);
    try {
      const blob = await canvasToBlob(snapped.canvas);
      const res  = await fetch(`/api/save-asset/${kind}/${filename}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/png' },
        body: blob,
      });
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch {}
      if (!res.ok || !json?.ok) {
        throw new Error(`save failed: ${res.status} ${text}`);
      }
      setSaveResult({ bytes: json.bytes, savedAt: new Date() });
      onSaved?.({ filename, bytes: json.bytes });
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const download = async () => {
    if (!snapped) return;
    const blob = await canvasToBlob(snapped.canvas);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sizeMismatch = snapped && (snapped.width !== expectedWidth || snapped.height !== expectedHeight);

  return (
    <div className="asset-uploader">
      <h3 className="asset-uploader-title">Replace this {kind === 'bricks' ? 'brick' : 'sprite'}</h3>
      <p className="asset-uploader-hint">
        Drop a PNG in. It'll snap to the LBA palette automatically. Keep dimensions at <strong>{expectedWidth}×{expectedHeight}</strong> for the injector to round-trip cleanly.
      </p>

      {!snapped ? (
        <div
          className="uploader-drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={32} />
          <div>Drop a PNG here or click to pick</div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png"
            style={{ display: 'none' }}
            onChange={onPick}
          />
        </div>
      ) : (
        <>
          <div className="uploader-diff">
            <div className="uploader-diff-col">
              <div className="uploader-diff-label">Current</div>
              <img src={originalSrc} alt="current" className="uploader-diff-img" />
            </div>
            <div className="uploader-diff-col">
              <div className="uploader-diff-label">Your upload (palette-snapped)</div>
              <img src={snapped.dataUrl} alt="snapped" className="uploader-diff-img" />
            </div>
          </div>

          <div className="uploader-stats">
            <div><strong>{snapped.exact}</strong> exact</div>
            <div><strong>{snapped.snapped}</strong> snapped</div>
            <div><strong>{snapped.transparent}</strong> transparent</div>
            <div>size: <strong>{snapped.width}×{snapped.height}</strong></div>
          </div>

          {sizeMismatch && (
            <div className="uploader-warn">
              <AlertTriangle size={14} /> Dimensions don't match original ({expectedWidth}×{expectedHeight}).
              The injector will accept it but the in-game offset will be off unless you update offsetX/offsetY.
            </div>
          )}

          <div className="uploader-actions">
            <button className="chip chip-active" onClick={save} disabled={saving || !!saveResult}>
              {saving ? <RefreshCw size={14} className="spin" /> : <Check size={14} />}
              {saveResult ? 'Saved' : (saving ? 'Saving…' : `Save to modded_assets/${kind}/`)}
            </button>
            <button className="chip" onClick={download}>
              <Download size={14} /> Download PNG
            </button>
            <button className="chip" onClick={reset}>Reset</button>
          </div>

          {saveResult && (
            <div className="uploader-success">
              <Check size={14} /> Wrote {saveResult.bytes} bytes. Now run:
              <pre>node scripts/hqr-tools/inject-{kind === 'bricks' ? 'brick' : 'sprite'}.js {filename.replace(/\..*/, '').replace(/^0+/, '')}</pre>
              then <code>bash scripts/build-web-bundle.sh</code> to rebuild the game.
            </div>
          )}

          {error && (
            <div className="uploader-warn">
              <AlertTriangle size={14} /> {error}
            </div>
          )}
        </>
      )}

      {error && !snapped && (
        <div className="uploader-warn">
          <AlertTriangle size={14} /> {error}
        </div>
      )}
    </div>
  );
}
