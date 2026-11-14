/**
 * Maintained js-dos 8.5.4 browser player for / and the v8-local.html regression route.
 * No owner game assets are uploaded or hosted; legacy 6.22 lives at /v6-local.html.
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
  const choose = doc.getElementById('import') || doc.getElementById('launch-btn');
  const input = doc.getElementById('bundle') || doc.getElementById('bundle-file');
  const stop = doc.getElementById('stop');
  const copy = doc.getElementById('copy-report');
  const status = doc.getElementById('status') || doc.getElementById('bundle-status');
  const player = doc.getElementById('player');
  const overlay = doc.getElementById('game-overlay');
  const close = doc.getElementById('close-btn');
  const playerStatus = doc.getElementById('player-status');
  if (![choose, input, stop, copy, status, player].every(Boolean)) return;
  const report = {runtime: 'js-dos@8.5.4', backend: 'dosbox', events: [], errors: [], warnings: [], comparison: 'manual'};
  let props = null;
  let url = null;
  let busy = false;
  let pendingWatchdog = null;
  let importStartedAt = null;
  const now = () => host.performance?.now?.() ?? Date.now();
  const clearWatchdog = () => {
    if (pendingWatchdog !== null) host.clearTimeout?.(pendingWatchdog);
    pendingWatchdog = null;
  };
  const mark = (type, value=null) => {
    report.events.push({type, value, elapsedMs: importStartedAt === null ? null : Math.round(now() - importStartedAt)});
    if (report.events.length > 100) report.events.shift();
  };
  const say = (value) => {
    status.textContent = value;
    if (playerStatus) playerStatus.textContent = value;
    mark('status', value);
  };
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
    clearWatchdog();
    if (props?.stop) {
      try { await props.stop(); }
      catch (err) { report.errors.push('Stop: ' + String(err)); }
    }
    props = null;
    if (url) host.URL.revokeObjectURL(url);
    url = null;
    player.replaceChildren();
    overlay?.classList.remove('active');
    stop.disabled = true;
    choose.disabled = false;
  }

  choose.addEventListener('click', () => input.click());
  close?.addEventListener('click', () => {
    if (busy) return;
    busy = true;
    void dispose().then(() => say('Emulator closed. Import another private bundle to resume.'))
      .finally(() => { busy = false; });
  });
  stop.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    await dispose();
    report.phase = 'emulator stopped';
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
    importStartedAt = now();
    report.phase = 'validating local bundle';
    choose.disabled = true;
    try {
      await validateLocalBundle(file);
      if (!/^r05-v8-.*\.jsdos$/i.test(file.name)) {
        throw new Error('Choose a converted r05-v8-*.jsdos bundle; 6.22 archives are incompatible with v8 startup');
      }
      if (typeof host.Dos !== 'function') {
        throw new Error('Pinned js-dos 8.5.4 frontend missing: run install-jsdos8.py');
      }
      if (props) await dispose();
      report.bundle = {name: file.name, bytes: file.size};
      report.phase = 'loading archive and starting backend';
      url = host.URL.createObjectURL(file);
      overlay?.classList.add('active');
      say('Loading js-dos 8.5.4 DOSBox worker. Game data stays local…');
      pendingWatchdog = host.setTimeout?.(() => {
        if (report.phase !== 'backend ready' && report.phase !== 'emulator stopped') {
          report.warnings.push('Backend not ready after 30 seconds; extraction or initialization may be stalled');
          report.phase = 'slow or stalled archive startup';
          say('DOSBox still loading. Check browser memory/F12 and copy diagnostics; do not reimport repeatedly.');
        }
        pendingWatchdog = null;
      }, 30000) ?? null;
      const onEvent = (event, ci) => {
        mark('emulator-event', event);
        if (event === 'ci-ready') {
          clearWatchdog();
          report.phase = 'backend ready';
          say('DOSBox backend initialized. Choose Museum S003 and test footsteps.');
          try {
            report.soundFrequency = ci?.soundFrequency?.();
            Promise.resolve(ci?.getRunningProgram?.())
              .then(program => { report.runningProgram = program ?? null; })
              .catch(err => { report.warnings.push('Runtime program probe: ' + String(err)); });
          } catch (err) {
            report.warnings.push('Runtime probe: ' + String(err));
          }
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
      report.phase = 'failed';
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
