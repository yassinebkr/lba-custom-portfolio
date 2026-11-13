import test from 'node:test';
import assert from 'node:assert/strict';
import {startR05Diagnostics} from './r05-diagnostics.mjs';

function fixture(search) {
  const listeners = {};
  const activeCanvas = {width: 640, height: 480, clientWidth: 640, clientHeight: 480};
  const elements = {
    jsdos: activeCanvas,
    'game-overlay': {classList: {contains: value => value === 'active'}},
    'loading-overlay': {classList: {contains: value => value === 'hidden'}},
    'bundle-import': {hidden: true},
  };
  const doc = {
    visibilityState: 'visible', activeElement: activeCanvas,
    getElementById: id => elements[id] || null,
  };
  const host = {
    location: {search}, performance: {now: () => 1250},
    addEventListener: (name, fn) => {listeners[name] = fn;},
  };
  return {doc, host, listeners};
}

test('diagnostics remain entirely inactive without opt-in', () => {
  const {doc, host, listeners} = fixture('');
  const diagnostics = startR05Diagnostics(doc, host);
  diagnostics.mark('status', 'test');
  assert.equal(host.lbaR05DiagnosticReport, undefined);
  assert.deepEqual(listeners, {});
});

test('opt-in report collects lifecycle errors and canvas visibility without local file bytes', () => {
  const {doc, host, listeners} = fixture('?r05debug=1');
  const diagnostics = startR05Diagnostics(doc, host);
  diagnostics.mark('status', 'Starting DOS game');
  listeners.error({message: 'Synthetic browser error'});
  listeners.unhandledrejection({reason: Error('Synthetic rejection')});
  const report = host.lbaR05DiagnosticReport();
  assert.equal(report.gameOverlayActive, true);
  assert.equal(report.loadingOverlayHidden, true);
  assert.equal(report.importPanelHidden, true);
  assert.equal(report.canvas.width, 640);
  assert.equal(report.canvas.hasFocus, true);
  assert.deepEqual(report.events.map(e => e.type), [
    'diagnostics-enabled', 'status', 'browser-error', 'unhandled-rejection',
  ]);
  assert.match(report.limits, /Browser observations only/);
  assert.equal(JSON.stringify(report).includes('ZIP'), false);
});

test('diagnostics cap the event log to prevent unbounded growth', () => {
  const {doc, host} = fixture('?r05debug=1');
  const diagnostics = startR05Diagnostics(doc, host);
  for (let i = 0; i < 120; i++) diagnostics.mark('status', 'step ' + i);
  const events = host.lbaR05DiagnosticReport().events;
  assert.equal(events.length, 60);
  assert.equal(events.at(-1).detail, 'step 119');
});
