/**
 * R05 opt-in browser diagnostics.
 *
 * Enable by opening the loader with ?r05debug=1. In DevTools, call
 * lbaR05DiagnosticReport() before and after the black-screen event.
 * This records browser-side lifecycle/errors only; it cannot inspect the
 * original DOS program counter or prove that the guest is still running.
 * No game bytes, private paths, ZIP contents or keystrokes are collected.
 */
export function startR05Diagnostics(doc, host) {
  const params = new URLSearchParams(host.location?.search || '');
  if (params.get('r05debug') !== '1') {
    return {mark() {}};
  }

  const startedAt = typeof host.performance?.now === 'function' ? host.performance.now() : 0;
  const events = [];
  const now = () => (typeof host.performance?.now === 'function' ?
    Math.round(host.performance.now() - startedAt) : null);
  const mark = (type, detail = '') => {
    events.push({elapsedMs: now(), type: String(type).slice(0, 40),
      detail: String(detail).slice(0, 300)});
    if (events.length > 60) events.shift();
  };
  const errorText = item => {
    if (typeof item === 'string') return item;
    return item?.message || String(item);
  };
  host.addEventListener?.('error', event => mark('browser-error', errorText(event.error || event.message)));
  host.addEventListener?.('unhandledrejection', event =>
    mark('unhandled-rejection', errorText(event.reason)));

  host.lbaR05DiagnosticReport = () => {
    const canvas = doc.getElementById('jsdos');
    const overlay = doc.getElementById('game-overlay');
    const loading = doc.getElementById('loading-overlay');
    const panel = doc.getElementById('bundle-import');
    const state = {
      elapsedMs: now(),
      visibility: doc.visibilityState || 'unknown',
      canvas: canvas ? {
        width: canvas.width, height: canvas.height,
        displayedWidth: canvas.clientWidth, displayedHeight: canvas.clientHeight,
        hasFocus: doc.activeElement === canvas,
      } : null,
      gameOverlayActive: !!overlay?.classList.contains('active'),
      loadingOverlayHidden: !!loading?.classList.contains('hidden'),
      importPanelHidden: !!panel?.hidden,
      events: events.map(event => ({...event})),
      limits: 'Browser observations only: no guest CPU, frame rendering or DOS state telemetry',
    };
    return state;
  };
  mark('diagnostics-enabled');
  return {mark};
}
