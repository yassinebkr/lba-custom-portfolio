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
 * The two R05 test pages use different bundle startup contracts.
 * v8 archives carry [autoexec] and must not be imported into the 6.22 player.
 * Keep this check outside validateLocalBundle, which is also reused by v8.
 */
export function assertDos622BundleName(filename) {
  if (/^r05-v8-.*\.jsdos$/i.test(filename || '')) {
    throw new Error(
      'This archive was built for js-dos 8.5.4. Open / and import it in the main player.'
    );
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

/**
 * js-dos 6.22 does not automatically consume .jsdos/dosbox.conf.
 * Explicitly pass -conf. Leave old invocation available for strict A/B.
 */
export function buildDos622Arguments({legacyConfig=false, cdImage='LBA.ISO'}={}) {
  if (!['LBA.ISO', 'LBA.CUE'].includes(cdImage)) {
    throw new Error('Unsupported private CD image');
  }
  return [
    ...(legacyConfig ? [] : ['-conf', '.jsdos/dosbox.conf']),
    '-c', 'imgmount d ' + cdImage + ' -t iso',
    '-c', 'RELENT.EXE'
  ];
}

function bindImporter(doc, host) {
  const params = new URLSearchParams(host.location?.search || '');
  const legacyConfig = params.get('r05config') === 'legacy';
  const cdImage = params.get('r05cdda') === '1' ? 'LBA.CUE' : 'LBA.ISO';
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
      assertDos622BundleName(file.name);
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
              if (cdImage === 'LBA.CUE' && !fs.fs.analyzePath('/LBA.CUE').exists) {
                reject(new Error('CD audio test requested, but bundle has no LBA.CUE'));
                return;
              }
              panel.hidden = true;
              message('Starting the DOS game…');
              try {
                const args = buildDos622Arguments({legacyConfig, cdImage});
                diagnostics.mark('dosbox-launch-args', JSON.stringify(args));
                main(args);
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
