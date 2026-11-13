/**
 * Browser-only js-dos 6.22 bundle import.
 * The selected ZIP remains local; js-dos extracts it from a temporary blob URL.
 */
import {startR05Diagnostics} from './r05-diagnostics.mjs';

const MAX_BUNDLE_BYTES = 512 * 1024 * 1024;
const ZIP_HEADER = [0x50, 0x4b, 0x03, 0x04];

export async function validateLocalBundle(file) {
  if (!file || typeof file.name !== 'string' || typeof file.size !== 'number' ||
      typeof file.slice !== 'function') {
    throw new Error('Select a local .jsdos bundle.');
  }
  if (!/\.jsdos$/i.test(file.name)) {
    throw new Error('Choose a .jsdos game bundle.');
  }
  if (file.size < 4) {
    throw new Error('The selected bundle is empty or truncated.');
  }
  if (file.size > MAX_BUNDLE_BYTES) {
    throw new Error('The bundle exceeds the 512 MiB browser import limit.');
  }
  const prefix = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (prefix.length !== 4 || !ZIP_HEADER.every((byte, i) => prefix[i] === byte)) {
    throw new Error('The selected bundle is not a valid ZIP-based .jsdos file.');
  }
}

/**
 * fs.extract() in the bundled js-dos 6.22 accepts a URL.
 * A blob URL makes the visitor-selected File available to its XHR ZIP loader.
 */
export async function extractLocalBundle(fs, file, urlApi = URL) {
  await validateLocalBundle(file);
  if (!fs || typeof fs.extract !== 'function') {
    throw new Error('The js-dos filesystem is unavailable.');
  }
  const url = urlApi.createObjectURL(file);
  try {
    await fs.extract(url);
    if (typeof fs.fs?.analyzePath !== 'function') {
      throw new Error('The js-dos filesystem cannot verify extracted game files.');
    }
    for (const name of ['RELENT.EXE', 'LBA.ISO']) {
      if (!fs.fs.analyzePath('/' + name).exists) {
        throw new Error('Bundle is missing ' + name + ' at its root.');
      }
    }
  } finally {
    urlApi.revokeObjectURL(url);
  }
}

function bindImporter(doc, host) {
  const diagnostics = startR05Diagnostics(doc, host);
  const input = doc.getElementById('bundle-file');
  const button = doc.getElementById('launch-btn');
  const panel = doc.getElementById('bundle-import');
  const status = doc.getElementById('bundle-status');
  const overlay = doc.getElementById('game-overlay');
  const loading = doc.getElementById('loading-overlay');
  const loadingText = doc.getElementById('loading-message');
  const canvas = doc.getElementById('jsdos');
  const close = doc.getElementById('close-btn');
  if (![input, button, panel, status, overlay, loading, loadingText, canvas, close].every(Boolean)) {
    return;
  }

  let busy = false;
  const message = text => { status.textContent = text; loadingText.textContent = text; diagnostics.mark('status', text); };
  button.addEventListener('click', () => { if (!busy) input.click(); });
  close.addEventListener('click', () => host.location.reload());
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file || busy) return;
    busy = true;
    button.disabled = true;
    message('Validating local bundle…');
    try {
      await validateLocalBundle(file);
      if (typeof host.Dos !== 'function') {
        throw new Error('The js-dos runtime could not be loaded.');
      }
      overlay.classList.add('active');
      loading.classList.remove('hidden');
      message('Preparing the DOS emulator…');
      await new Promise((resolve, reject) => {
        try {
          host.Dos(canvas, {wdosboxUrl: './vendor/jsdos622/wdosbox.js'}).ready((fs, main) => {
            message('Extracting local game files…');
            extractLocalBundle(fs, file).then(() => {
              panel.hidden = true;
              message('Starting the DOS game…');
              try {
                main(['-c', 'imgmount d LBA.ISO -t iso', '-c', 'RELENT.EXE']);
                loading.classList.add('hidden');
                diagnostics.mark('dos-main-dispatched');
                canvas.focus();
                resolve();
              } catch (error) {
                reject(error);
              }
            }, reject);
          });
        } catch (error) {
          reject(error);
        }
      });
    } catch (error) {
      diagnostics.mark('import-failed', error?.message || String(error));
      overlay.classList.remove('active');
      panel.hidden = false;
      message('Import failed: ' + (error?.message || String(error)) + ' Select a file to retry.');
    } finally {
      busy = false;
      button.disabled = false;
    }
  });
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  bindImporter(document, window);
}
