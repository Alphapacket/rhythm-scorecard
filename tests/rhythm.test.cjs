'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

process.env.TZ = 'Australia/Sydney';
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const boundary = script.indexOf('    let writable = true;');
assert(boundary > 0, 'The pure data helpers must precede browser storage setup.');
const api = vm.runInNewContext(`${script.slice(0, boundary)}
  ({ blank, validateData, stats, score, won, weeklySummary, weekStart, shift, serial });`);
const plain = value => JSON.parse(JSON.stringify(value));
const win = key => { const day = api.blank(key); day.checks.fill(true); return day; };

test('the complete inline script passes a syntax check', () => {
  assert.doesNotThrow(() => new vm.Script(script));
});

test('legacy records migrate without changing checks, text, or the input object', () => {
  const legacy = { days: {
    '2026-10-19': { checks: [true, false, true, false, true, true], block1: 'Keep this task exactly.\nSecond line.' },
    '2026-10-24': { checks: [true, false, false, true, false], block1: '' }
  } };
  const original = JSON.stringify(legacy);
  const migrated = api.validateData(legacy);
  for (const key of Object.keys(legacy.days)) {
    assert.deepEqual(plain(migrated.days[key].checks), legacy.days[key].checks);
    assert.equal(migrated.days[key].block1, legacy.days[key].block1);
    assert.equal(migrated.days[key].block1Project, '');
    assert.deepEqual(plain(migrated.days[key].block2), { task: '', project: '' });
    assert.deepEqual(plain(migrated.days[key].bigBuild), { task: '', project: '' });
    assert.deepEqual(plain(migrated.days[key].pulse), { forward: '', backwards: '', priority: '', anything: '' });
    assert.equal(migrated.days[key].evBotNight, false);
  }
  assert.equal(JSON.stringify(legacy), original);
  assert.deepEqual(plain(api.stats(migrated, '2026-10-24')), plain(api.stats(legacy, '2026-10-24')));
});

test('new backups preserve every optional field through export and import', () => {
  const day = api.blank('2026-10-24');
  day.block1 = 'Write a short plan'; day.block1Project = 'Career';
  day.block2 = { task: 'Read a chapter', project: 'Learning' };
  day.bigBuild = { task: 'Make a prototype', project: 'Other' };
  day.pulse = { forward: 'Made a draft', backwards: 'Distractions', priority: 'Finish one page', anything: 'Line one.\nLine two. <b>Literal text</b>' };
  day.evBotNight = true;
  const backup = { days: { '2026-10-24': day } };
  assert.deepEqual(plain(api.validateData(JSON.parse(JSON.stringify(backup)))), plain(backup));
});

test('invalid optional fields, dates, and checks are rejected instead of discarded', () => {
  const check = day => api.validateData({ days: { '2026-10-24': day } });
  for (const field of [
    { block1Project: 'Unknown' }, { evBotNight: 1 }, { pulse: { forward: 'Incomplete' } },
    { block2: { task: '', project: null } }, { extraField: 'Do not silently discard' }
  ]) assert.throws(() => check({ ...plain(api.blank('2026-10-24')), ...field }));
  assert.throws(() => check({ checks: [true], block1: '' }));
  assert.throws(() => api.validateData({ days: { '2026-02-30': { checks: [], block1: '' } } }));
});

test('notes, tags, tasks, and nights never alter checks or streak calculations', () => {
  const data = { days: { '2026-10-19': win('2026-10-19'), '2026-10-20': win('2026-10-20') } };
  const before = plain(api.stats(data, '2026-10-21'));
  const checks = plain(data.days['2026-10-20'].checks);
  Object.assign(data.days['2026-10-20'], {
    pulse: { forward: 'Progress', backwards: '', priority: '', anything: '' },
    block1Project: 'Greyhound', block2: { task: 'Read', project: 'Learning' }, evBotNight: true
  });
  assert.deepEqual(plain(api.stats(data, '2026-10-21')), before);
  assert.deepEqual(plain(data.days['2026-10-20'].checks), checks);
  assert.equal(api.stats(data, '2026-10-21').streak, 2);
});

test('week percentages count elapsed days only and streaks still cross gaps correctly', () => {
  const data = { days: { '2026-10-19': win('2026-10-19') } };
  assert.deepEqual(plain(api.stats(data, '2026-10-19')), { streak: 1, best: 1, ticked: 6, possible: 6, percent: 100 });
  for (const key of ['2026-10-20', '2026-10-21', '2026-10-23', '2026-10-24']) data.days[key] = win(key);
  assert.deepEqual(plain(api.stats(data, '2026-10-25')), { streak: 2, best: 3, ticked: 29, possible: 40, percent: 73 });
});

test('weekly review counts one tagged task per block, skips empty notes and future days', () => {
  const data = { days: {} };
  for (const key of ['2026-10-19', '2026-10-20', '2026-10-24', '2026-10-25', '2026-10-26']) data.days[key] = api.blank(key);
  const monday = data.days['2026-10-19'], saturday = data.days['2026-10-24'];
  monday.block1 = 'Draft'; monday.block1Project = 'Greyhound';
  monday.block2 = { task: 'Read', project: 'Learning' };
  monday.bigBuild = { task: 'Not a Saturday block', project: 'Finance' };
  monday.pulse.forward = 'Finished a draft'; monday.evBotNight = true;
  data.days['2026-10-20'].block1Project = 'Career';
  data.days['2026-10-20'].pulse.anything = ' \n ';
  saturday.block1 = 'Review'; saturday.block1Project = 'Greyhound';
  saturday.block2 = { task: 'Admin', project: '' };
  saturday.bigBuild = { task: 'Prototype', project: 'Other' };
  saturday.pulse.anything = 'One small output'; saturday.evBotNight = true;
  for (const key of ['2026-10-25', '2026-10-26']) {
    data.days[key].block1 = 'Future task'; data.days[key].block1Project = 'Finance';
    data.days[key].pulse.forward = 'Future note'; data.days[key].evBotNight = true;
  }
  const summary = api.weeklySummary(data, '2026-10-24', '2026-10-24');
  assert.deepEqual(plain(summary.counts), { Greyhound: 2, Career: 0, Finance: 0, Learning: 1, Other: 1 });
  assert.deepEqual(plain(summary.notes.map(note => note.key)), ['2026-10-19', '2026-10-24']);
  assert.deepEqual(plain(summary.nights), ['2026-10-19', '2026-10-24']);
  assert.equal(api.weeklySummary(data, '2026-10-26', '2026-10-26').counts.Finance, 1);
});

test('local week boundaries and Sydney daylight saving use calendar dates', () => {
  assert.equal(api.weekStart('2026-10-25'), '2026-10-19');
  assert.equal(api.weekStart('2027-01-01'), '2026-12-28');
  assert.equal(api.shift('2026-10-03', 1), '2026-10-04');
  assert.equal(api.shift('2026-10-04', 1), '2026-10-05');
  assert.equal(api.serial('2026-10-05') - api.serial('2026-10-03'), 2);
});
