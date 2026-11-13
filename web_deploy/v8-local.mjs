/**
 * R05 isolated js-dos 8.5.4 comparison. No game assets are uploaded or hosted.
 * This page is intentionally independent of the 6.22 launcher.
 */
import {validateLocalBundle} from './local-bundle.mjs';

export function comparisonOptions(url, onEvent) {
  if (typeof url !== 'string' || !url.startsWith('blob:')) {
    throw new Error('v8 comparison requires an owner-selected blob URL');
  }
  return {
    url,
    backend: 'dosbox',
    backendLocked: true,
    workerThread: true,
    offscreenCanvas: false,
    mouseCapture: false,
    // Upstream Play component only invokes onPlay when countDownStart > 0.
    autoStart: true,
    countDownStart: 1,
    autoSave: false,
    fsChanges: {local: false},
    pathPrefix: './vendor/jsdos854/emulators/',
    onEvent
  };
}

export function setupV8Test(doc, host) {
  const choose = doc.getElementById('import');
  const input = doc.getElementById('bundle');
  const stop = doc.getElementById('stop');
  const copy = doc.getElementById('copy-report');
  const status = doc.getElementById('status');
  const player = doc.getElementById('player');
  if (![choose, input, stop, copy, status, player].every(Boolean)) return;
  const report = {runtime: 'js-dos@8.5.4', backend: 'dosbox', events: [], errors: [], warnings: [], comparison: 'manual'};
  let props = null;
  let url = null;
  let busy = false;
  const mark = (type, value=null) => {
    report.events.push({type, value});
    if (report.events.length > 100) report.events.shift();
  };
  const say = (value) => { status.textContent = value; mark('status', value); };
  host.r05V8DiagnosticReport = () => JSON.parse(JSON.stringify(report));
  host.addEventListener('error', (event) => {
    report.errors.push(String(event.message || 'Unknown script error'));
  });
  host.addEventListener('unhandledrejection', (event) => {
    const message = String(event.reason?.message || event.reason || 'Unknown rejection');
    // js-dos 8.5.4 upstream calls document.exitFullscreen() when already
    // windowed. Some browsers reject it with "Document not active".
    // It is an unrelated player UI warning, not a DOSBox audio failure.
    if (message.includes('exitFullscreen') && message.includes('Document not active')) {
      report.warnings.push(message);
      event.preventDefault();
      return;
    }
    report.errors.push(message);
  });

  async function dispose() {
    if (props?.stop) {
      try { await props.stop(); }
      catch (err) { report.errors.push('Stop: ' + String(err)); }
    }
    props = null;
    if (url) host.URL.revokeObjectURL(url);
    url = null;
    player.replaceChildren();
    stop.disabled = true;
    choose.disabled = false;
  }

  choose.addEventListener('click', () => input.click());
  stop.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    await dispose();
    say('Emulator stopped. The private archive remains only on your computer.');
    busy = false;
  });
  copy.addEventListener('click', async () => {
    const serialized = JSON.stringify(report, null, 2);
    try {
      await host.navigator.clipboard.writeText(serialized);
      say('Diagnostic report copied.');
    } catch {
      say('Clipboard unavailable; run JSON.stringify(window.r05V8DiagnosticReport(), null, 2) in the console.');
    }
  });

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file || busy) return;
    busy = true;
    choose.disabled = true;
    try {
      await validateLocalBundle(file);
      if (!/r05-v8-/i.test(file.name)) {
        throw new Error('Choose the converted r05-v8-*.jsdos comparison bundle, not the 6.22 archive');
      }
      if (typeof host.Dos !== 'function') {
        throw new Error('Pinned js-dos 8.5.4 frontend missing: run install-jsdos8.py');
      }
      if (props) await dispose();
      report.bundle = {name: file.name, bytes: file.size};
      url = host.URL.createObjectURL(file);
      say('Loading js-dos 8.5.4 DOSBox worker. Game data stays local…');
      const onEvent = async (event, ci) => {
        mark('emulator-event', event);
        if (event === 'ci-ready') {
          try {
            report.soundFrequency = ci?.soundFrequency?.();
            report.runningProgram = await ci?.getRunningProgram?.();
          } catch (err) {
            report.errors.push('Runtime probe: ' + String(err));
          }
          say('DOSBox backend initialized. Choose Museum S003 and test footsteps.');
        } else if (event === 'emu-ready') {
          say('Emulation runtime ready; starting private DOS bundle…');
        }
      };
      props = host.Dos(player, comparisonOptions(url, onEvent));
      const version = props?.getVersion?.();
      report.version = version || null;
      if (version && !JSON.stringify(version).includes('8.5.4')) {
        throw new Error('Unexpected js-dos frontend version; expected 8.5.4, got ' + JSON.stringify(version));
      }
      props?.setNoCloud?.(true);
      stop.disabled = false;
      mark('player-created', version);
    } catch (err) {
      report.errors.push(String(err?.message || err));
      await dispose();
      say('v8 startup failed: ' + String(err?.message || err));
    } finally {
      busy = false;
      choose.disabled = false;
    }
  });
  say(typeof host.Dos === 'function' ?
      'Pinned runtime found. Select a locally converted v8 test bundle.' :
      'Pinned runtime not found. First run: python3 scripts/runtime/install-jsdos8.py');
}

if (typeof document !== 'undefined' && typeof window !== 'undefined' &&
    document.getElementById('player')) {
  setupV8Test(document, window);
}
