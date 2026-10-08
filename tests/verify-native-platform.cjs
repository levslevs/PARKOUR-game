'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const {loadGame, clone} = require('./level-harness.cjs');
const html = path.resolve(__dirname, '../parkour-enemies.html');
const saved = {coins:24, owned:['blue','fox'], skin:'fox', best:3};
const game = loadGame(html, null, {
  parkourEnemies: JSON.stringify(saved), parkourEnemiesSound: 'on'
});
assert.deepEqual(clone(game.save), saved);
assert.equal(game.skinById('fox').name, 'Dash');
game.save.coins = 29;
game.store();
assert.equal(game.storage.size, 0, 'native progress must not depend on file-origin localStorage');
assert.deepEqual(game.nativeMessages[0], {
  action:'save', key:'parkourEnemies', value:JSON.stringify({...saved,coins:29})
});
const reopened = loadGame(html, null, game.sandbox.parkourNative.values);
assert.equal(reopened.save.coins, 29);
assert.equal(reopened.save.skin, 'fox');
assert.equal(reopened.save.best, 3);
console.log('PASS native progress uses the host snapshot, preserves unlocks and restores saved changes');

game.nodes.get('btnSound').onclick();
assert.deepEqual(game.nativeMessages.at(-1), {action:'save', key:'parkourEnemiesSound', value:'off'});
console.log('PASS sound setting uses native persistence');

game.startRound(1);
game.keys.right = true;
for (const listener of game.sandbox.listeners.parkourPause) listener();
assert(game.gameInputBlocked());
assert.equal(game.keys.right, false);
const paused = clone(game.G);
game.update();
assert.deepEqual(clone(game.G), paused);
console.log('PASS native lifecycle event pauses gameplay and releases controls');

assert.equal(game.nodes.get('btnAbout').hidden, false);
game.nodes.get('btnAbout').onclick();
assert.deepEqual(game.nativeMessages.at(-1), {action:'about'});
assert.equal(game.nodes.get('btnFullscreen').hidden, true);
console.log('PASS native About action and fullscreen chrome');
