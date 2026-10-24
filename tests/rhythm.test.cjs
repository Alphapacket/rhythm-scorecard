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
  ({ blank, validateData, stats, score, won, weeklySummary, weekStart, shift, serial,
     parseTaskCard, resolveTaskDay, matchBlock, pastedDay, taskDone, scoredCheck });`);
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
    assert.deepEqual(plain(migrated.days[key].taskCards), {});
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

test('task cards accept case, Markdown, whitespace, and multiline Context', () => {
  const card = api.parseTaskCard('```text\n# RHYTHM TASK\n- **dAy:** **mOnDay**\n**BLOCK** : bLoCk   1\n_Task:_ Write a short checklist.\n**Done   when:** Every item has a clear next action.\nTIME: 75 MINUTES\nContext: Open REPORT_CHECK_20.xlsx.\n  Keep the original file names.\n\nSecond paragraph.\n```', '2026-10-24');
  assert.deepEqual(plain(card), {
    key: '2026-10-26', block: 'block1', blockName: 'bLoCk   1', task: 'Write a short checklist.',
    doneWhen: 'Every item has a clear next action.', time: '75 minutes',
    context: 'Open REPORT_CHECK_20.xlsx.\nKeep the original file names.\n\nSecond paragraph.'
  });
});

test('weekdays resolve once from the local date, including today, with explicit date support', () => {
  assert.equal(api.resolveTaskDay('Monday', '2026-10-24'), '2026-10-26');
  assert.equal(api.resolveTaskDay('Monday', '2026-10-26'), '2026-10-26');
  assert.equal(api.resolveTaskDay('Mon', '2026-10-27'), '2026-11-02');
  assert.equal(api.resolveTaskDay('Monday', '2026-12-31'), '2027-01-04');
  for (const value of ['2026-10-26', '26/10/2026', '26 October 2026', '26th Oct 2026']) {
    assert.equal(api.resolveTaskDay(value, '2026-10-24'), '2026-10-26');
  }
  assert.throws(() => api.resolveTaskDay('2026-02-30', '2026-10-24'));
  assert.throws(() => api.resolveTaskDay('32/10/2026', '2026-10-24'));
});

test('Context continuations can contain words that look like field labels', () => {
  const card = api.parseTaskCard('Day: Monday\nTask: Write a plan\nContext: Keep these notes.\nTime: a reminder, not a duration\nTask: quoted example', '2026-10-24');
  assert.equal(card.task, 'Write a plan'); assert.equal(card.time, '');
  assert.equal(card.context, 'Keep these notes.\nTime: a reminder, not a duration\nTask: quoted example');
});

test('missing required fields fail clearly; unmatched blocks remain available for a picker', () => {
  assert.throws(() => api.parseTaskCard('Task: Make a draft', '2026-10-24'), /Day is missing/);
  assert.throws(() => api.parseTaskCard('Day: Monday\nTask: ** **', '2026-10-24'), /Task is missing/);
  assert.throws(() => api.parseTaskCard('Day: Monday\nTask: Draft\nTime: soon', '2026-10-24'), /positive number of minutes/);
  assert.throws(() => api.parseTaskCard('Day: Monday\nTask: Draft\nTask: Other', '2026-10-24'), /more than once/);
  assert.equal(api.parseTaskCard('Day: Monday\nBlock: Morning\nTask: Draft', '2026-10-24').block, '');
  assert.equal(api.matchBlock('SATURDAY BIG BUILD'), 'bigBuild');
  assert.equal(api.matchBlock('block 2'), 'block2');
  assert.equal(api.matchBlock('constructor'), '');
});

test('pasting only fills an empty existing block and preserves all other data and checks', () => {
  const day = api.blank('2026-10-26'); day.block2 = { task: 'Keep this task', project: 'Learning' };
  day.pulse.forward = 'Keep this note'; day.checks[0] = true; day.block1Project = 'Career';
  const data = { days: { '2026-10-26': day } }, original = JSON.stringify(data);
  const card = api.parseTaskCard('Day: Monday\nBlock: Block 1\nTask: Write a checklist\nDone when: Five actions written\nTime: 60\nContext: One clear output', '2026-10-24');
  const updated = api.pastedDay(data, card);
  assert.equal(JSON.stringify(data), original);
  assert.equal(updated.block1, 'Write a checklist');
  assert.equal(updated.block1Project, 'Career');
  assert.deepEqual(plain(updated.block2), plain(day.block2));
  assert.deepEqual(plain(updated.checks), plain(day.checks));
  assert.deepEqual(plain(updated.pulse), plain(day.pulse));
  assert.deepEqual(plain(updated.taskCards.block1), { doneWhen: 'Five actions written', time: '60 minutes', context: 'One clear output', completed: false });
  assert.deepEqual(plain(api.validateData({ days: { '2026-10-26': updated } }).days['2026-10-26']), plain(updated));
  assert.throws(() => api.pastedDay({ days: { '2026-10-26': updated } }, card), /already has a task/);
  assert.throws(() => api.pastedDay(data, { ...plain(card), block: 'bigBuild' }), /only on Saturdays/);
});

test('task completion uses existing scored checks, with no points for an unscored block', () => {
  const card = api.parseTaskCard('Day: Monday\nBlock: Block 1\nTask: Draft one page', '2026-10-24');
  const day = api.pastedDay({ days: {} }, card), data = { days: { [card.key]: day } };
  assert.equal(api.scoredCheck(card.key, 'block1'), 1);
  assert.equal(api.taskDone(day, card.key, 'block1'), false);
  day.checks[1] = true;
  assert.equal(api.taskDone(day, card.key, 'block1'), true);
  assert.equal(api.score(data, card.key), 1);
  const before = plain(api.stats(data, card.key));
  day.taskCards.block2 = { doneWhen: '', time: '', context: '', completed: true };
  assert.equal(api.scoredCheck(card.key, 'block2'), null);
  assert.equal(api.taskDone(day, card.key, 'block2'), true);
  assert.deepEqual(plain(api.stats(data, card.key)), before);
  assert.equal(api.scoredCheck('2026-10-24', 'bigBuild'), 1);
  assert.equal(api.scoredCheck('2026-10-25', 'block1'), null);
});
