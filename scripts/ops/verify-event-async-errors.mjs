import assert from 'node:assert/strict';

const events = await import('../../src/core/events.js');

events.clear();

const originalConsoleError = console.error;
const loggedErrors = [];
console.error = (...args) => {
  loggedErrors.push(args.map(arg => String(arg)).join(' '));
};

let unhandled = false;
const onUnhandledRejection = () => {
  unhandled = true;
};
process.once('unhandledRejection', onUnhandledRejection);

try {
  events.on('async:test', async () => {
    await Promise.resolve();
    throw new Error('async listener failed');
  });

  events.emit('async:test', { ok: true });
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.equal(
    unhandled,
    false,
    'event bus should handle rejected async listeners instead of leaking unhandled rejections'
  );
  assert.equal(
    loggedErrors.some(line => line.includes('Error in event listener for "async:test"')),
    true,
    'event bus should log rejected async listener failures with the event name'
  );

  loggedErrors.length = 0;
  unhandled = false;

  events.once('async:once', async () => {
    await Promise.resolve();
    throw new Error('async once listener failed');
  });

  events.emit('async:once');
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.equal(
    unhandled,
    false,
    'event bus should handle rejected async once listeners instead of leaking unhandled rejections'
  );
  assert.equal(
    loggedErrors.some(line => line.includes('Error in event listener for "async:once"')),
    true,
    'event bus should log rejected async once listener failures with the event name'
  );
  assert.equal(
    events.listenerCount('async:once'),
    0,
    'once listeners should be removed after their first invocation even when they fail'
  );

  events.once('sync:once', () => {
    throw new Error('sync once listener failed');
  });

  events.emit('sync:once');
  assert.equal(
    events.listenerCount('sync:once'),
    0,
    'once listeners should be removed after synchronous failures'
  );
} finally {
  process.removeListener('unhandledRejection', onUnhandledRejection);
  console.error = originalConsoleError;
  events.clear();
}

console.log('event async error checks passed');
