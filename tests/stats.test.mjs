import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ranges, anchor, dataEnd, isoWeek, periodEnd, pct, degreeDays, analyzeStats, statBars, bucketCount, chipLabels, rangeLabel, explainText,
  fetchStats, fetchStatsSet, statIds, statsHtml, statsParts, normalizeConfig, COMPARE, hourFloor, savingsView,
} from '../dist/heating-card.js';

const at = (y, m, d, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi);
const rng = (r) => r.map(Number);
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

// 2026-11-08 is a Sunday, 2026-11-04 a Wednesday.
test('week ranges: Monday start, previous week cut at the same weekday and time', () => {
  const r = ranges(at(2026, 11, 4, 14, 30), 'week');
  assert.deepEqual(rng(r.cur), rng([at(2026, 11, 2), at(2026, 11, 4, 14, 30)]));
  assert.deepEqual(rng(r.prev), rng([at(2026, 10, 26), at(2026, 10, 28, 14, 30)]));
  // the same ISO week (45) of last year
  assert.deepEqual(isoWeek(at(2026, 11, 4)), { year: 2026, week: 45 });
  assert.deepEqual(rng(r.yoy), rng([at(2025, 11, 3), at(2025, 11, 5, 14, 30)]));
  assert.equal(r.month, undefined);
  // a Sunday belongs to the week that started on Monday
  assert.equal(+ranges(at(2026, 11, 8, 9), 'week').cur[0], +at(2026, 11, 2));
});

test('week ranges: week 53 falls back to 52 in a year without one', () => {
  assert.deepEqual(isoWeek(at(2026, 12, 30)), { year: 2026, week: 53 });
  const r = ranges(at(2026, 12, 30, 10), 'week');
  assert.deepEqual(rng(r.yoy), rng([at(2025, 12, 22), at(2025, 12, 24, 10)])); // 2025 has 52 weeks
  // 2020 had a week 53: 2021 week 53 does not exist, 2026 week 53 -> 2025 week 52 above; 2021 week 52 -> 2020 week 52
  assert.deepEqual(rng(ranges(at(2021, 12, 29, 8), 'week').yoy), rng([at(2020, 12, 21), at(2020, 12, 23, 8)]));
});

test('day ranges: previous, same day last month (clamped), same date last year', () => {
  const r = ranges(at(2026, 3, 31, 14), 'day');
  assert.deepEqual(rng(r.prev), rng([at(2026, 3, 30), at(2026, 3, 30, 14)]));
  assert.deepEqual(rng(r.month), rng([at(2026, 2, 28), at(2026, 2, 28, 14)]));
  assert.deepEqual(rng(r.yoy), rng([at(2025, 3, 31), at(2025, 3, 31, 14)]));
  assert.deepEqual(rng(ranges(at(2028, 3, 31, 9), 'day').month), rng([at(2028, 2, 29), at(2028, 2, 29, 9)]));
  assert.deepEqual(rng(ranges(at(2028, 2, 29, 10), 'day').yoy), rng([at(2027, 2, 28), at(2027, 2, 28, 10)]));
  assert.deepEqual(rng(ranges(at(2026, 1, 15, 8), 'day').month), rng([at(2025, 12, 15), at(2025, 12, 15, 8)]));
});

test('month and year ranges: like-for-like', () => {
  const m = ranges(at(2026, 3, 31, 14), 'month');
  assert.deepEqual(rng(m.cur), rng([at(2026, 3, 1), at(2026, 3, 31, 14)]));
  assert.deepEqual(rng(m.prev), rng([at(2026, 2, 1), at(2026, 2, 28, 14)]));
  assert.deepEqual(rng(m.yoy), rng([at(2025, 3, 1), at(2025, 3, 31, 14)]));
  const y = ranges(at(2028, 2, 29, 10), 'year');
  assert.deepEqual(rng(y.prev), rng([at(2027, 1, 1), at(2027, 2, 28, 10)]));
  assert.equal(y.yoy, undefined);
  assert.deepEqual(COMPARE, { day: ['prev', 'month', 'yoy'], week: ['prev', 'yoy'], month: ['prev', 'yoy'], year: ['prev'] });
});

test('anchor: the last millisecond of a past period; comparisons of a whole period are whole', () => {
  const now = at(2026, 11, 4, 14, 20);
  assert.equal(anchor(now, 'week', 0), now);
  assert.equal(+anchor(now, 'week', -1), +at(2026, 11, 2) - 1);
  assert.equal(+anchor(now, 'week', -2), +at(2026, 10, 26) - 1);
  assert.equal(+anchor(now, 'day', -1), +at(2026, 11, 4) - 1);
  assert.equal(+anchor(now, 'month', -1), +at(2026, 11, 1) - 1);
  assert.equal(+anchor(now, 'year', -1), +at(2026, 1, 1) - 1);
  const w = ranges(anchor(now, 'week', -1), 'week'); // week 26. 10.–1. 11.
  assert.deepEqual(rng(w.prev), rng([at(2026, 10, 19), new Date(+at(2026, 10, 26) - 1)]));
  assert.equal(+periodEnd('week', at(2026, 11, 2)), +at(2026, 11, 9));
});

test('dataEnd: the end of the last row, never past the current full hour or before the start', () => {
  const start = at(2026, 11, 10);
  const row = (h) => ({ start: at(2026, 11, 10, h) });
  assert.equal(+dataEnd([row(14)], start, at(2026, 11, 10, 14, 30)), +at(2026, 11, 10, 14));
  assert.equal(+dataEnd([row(10)], start, at(2026, 11, 10, 14, 30)), +at(2026, 11, 10, 11));
  assert.equal(+dataEnd([], start, at(2026, 11, 10, 9)), +start);
  // a daily row ends tomorrow: clamped to the current hour
  assert.equal(+dataEnd([{ start, end: at(2026, 11, 11) }], start, at(2026, 11, 10, 9, 5), 'day'), +at(2026, 11, 10, 9));
});

test('pct', () => {
  close(pct(6, 5), 20);
  assert.equal(pct(1, 0), null);
});

test('degreeDays: hour, day and month rows; warm rows count 0', () => {
  const h = (i, mean) => ({ start: at(2026, 11, 8, i), mean });
  close(degreeDays([h(0, 8), h(1, 8)], 'hour'), (10 / 24) * 2);
  close(degreeDays([h(0, 20), h(1, 18), h(2, 30)], 'hour'), 0);
  close(degreeDays([{ start: at(2026, 11, 7), mean: 4 }, { start: at(2026, 11, 6), mean: 25 }], 'day'), 14);
  // a month row: all its days, or only the days until the range end
  const nov = { start: at(2026, 11, 1), mean: 6 };
  close(degreeDays([nov], 'month'), 12 * 30);
  close(degreeDays([nov], 'month', at(2026, 11, 8)), 12 * 7);
  close(degreeDays([{ start: at(2026, 10, 1), mean: 10 }], 'month'), 8 * 31);
  close(degreeDays([{ start: at(2026, 11, 8, 0), mean: null }], 'hour'), 0);
});

// hourly rows of one day: boiler `per` h each, outdoor `temp`
const day = (y, m, d, hrs, per, temp) => ({
  boiler: Array.from({ length: hrs }, (_, i) => ({ start: at(y, m, d, i), end: at(y, m, d, i + 1), change: per, mean: null })),
  windowBoiler: Array.from({ length: hrs }, (_, i) => ({ start: at(y, m, d, i), end: at(y, m, d, i + 1), change: 0.02, mean: null })),
  windowValves: [],
  outdoor: Array.from({ length: hrs }, (_, i) => ({ start: at(y, m, d, i), end: at(y, m, d, i + 1), change: 0, mean: temp })),
});

test('analyzeStats: like-for-like cut, delta and degree-day delta signs', () => {
  const now = at(2026, 11, 8, 21, 30);
  // today: 21 complete hours, colder and the boiler ran more; yesterday: all 24 hours, warmer
  const a = analyzeStats('day', 'prev', now, day(2026, 11, 8, 21, 0.3, 0), day(2026, 11, 7, 24, 0.25, 12));
  assert.equal(+a.end, +at(2026, 11, 8, 21));
  close(a.cur.boiler, 6.3);
  close(a.cmp.boiler, 5.25); // cut at 21:00, not 24 rows
  close(a.delta, 20);
  close(a.diff, 1.05);
  close(a.cur.hdd, (18 * 21) / 24);
  close(a.cmp.hdd, (6 * 21) / 24);
  close(a.cur.outdoorMean, 0);
  close(a.cmp.outdoorMean, 12);
  assert.ok(a.delta > 0 && a.normDelta < 0); // more hours, but fewer per degree day
  close(a.normDelta, ((6.3 / 15.75 - 5.25 / 5.25) / (5.25 / 5.25)) * 100);
  // the other way round: warmer today, more per degree day
  const b = analyzeStats('day', 'prev', now, day(2026, 11, 8, 21, 0.3, 12), day(2026, 11, 7, 24, 0.25, 0));
  assert.ok(b.normDelta > 0);
  // no degree days (a warm day): per degree day and its delta are null
  const w = analyzeStats('day', 'prev', now, day(2026, 11, 8, 21, 0.3, 22), day(2026, 11, 7, 24, 0.25, 0));
  assert.equal(w.cur.perHdd, null);
  assert.equal(w.normDelta, null);
  // no comparison data: no delta, no cmp side; no current data: no cur side
  const n = analyzeStats('day', 'prev', now, day(2026, 11, 8, 21, 0.3, 4), null);
  assert.deepEqual([n.cmp, n.delta, n.diff, n.normDelta], [null, null, null, null]);
  const e = analyzeStats('day', 'prev', now, { boiler: [], windowBoiler: [], windowValves: [], outdoor: [] }, null);
  assert.equal(e.cur, null);
  close(a.cur.windowBoiler, 0.42);
});

test('analyzeStats: a whole past day compares whole; data ending early is like-for-like up to there', () => {
  const now = at(2026, 11, 8, 12);
  const a = anchor(now, 'day', -1);
  const whole = analyzeStats('day', 'prev', a, day(2026, 11, 7, 24, 0.5, 4), day(2026, 11, 6, 24, 0.25, 4));
  close(whole.cur.boiler, 12);
  close(whole.cmp.boiler, 6);
  const cut = analyzeStats('day', 'prev', a, day(2026, 11, 7, 18, 0.5, 4), day(2026, 11, 6, 24, 0.25, 4));
  assert.equal(+cut.end, +at(2026, 11, 7, 18));
  close(cut.cmp.boiler, 4.5);
});

test('analyzeStats: month rows (days) cut at the day, outdoor mean weighted by row length', () => {
  const now = at(2026, 11, 8, 21);
  const rows = (mon, n, per, t) => Array.from({ length: n }, (_, i) => ({ start: at(2026, mon, 1 + i), end: at(2026, mon, 2 + i), change: per, mean: t }));
  const cur = { boiler: rows(11, 8, 4, 5), windowBoiler: [], windowValves: [], outdoor: rows(11, 8, 4, 5) };
  const cmp = { boiler: rows(10, 31, 3, 9), windowBoiler: [], windowValves: [], outdoor: rows(10, 31, 3, 9) };
  const a = analyzeStats('month', 'prev', now, cur, cmp);
  close(a.cur.boiler, 32);
  close(a.cmp.boiler, 24); // Oct 1-8 (the 8th whole)
  close(a.cur.outdoorMean, 5);
  close(a.cur.hdd, 13 * (7 + 21 / 24)); // 7 whole days + the 8th until 21:00
});

test('statBars: bucket counts, minutes for a day, weekdays, outdoor mean per bucket', () => {
  const hr = (d, h, change, mean = null) => ({ start: at(2026, 11, d, h), end: at(2026, 11, d, h + 1), change, mean });
  assert.deepEqual([bucketCount('day', at(2026, 11, 8)), bucketCount('week', at(2026, 11, 2)), bucketCount('month', at(2026, 11, 1)), bucketCount('month', at(2028, 2, 1)), bucketCount('year', at(2026, 1, 1))], [24, 7, 30, 29, 12]);
  const d = statBars('day', [hr(8, 6, 0.5), hr(8, 6, 0.25), hr(8, 23, -1)], 24, [hr(8, 6, 0, 2)]);
  assert.equal(d.length, 24);
  close(d[6].v, 45); // minutes
  assert.equal(d[23].v, 0); // a reset
  assert.equal(d[6].t, 2);
  assert.equal(d[7].t, null);
  // a week: 8. 11. is a Sunday = the last bucket; 2. 11. a Monday = the first; hours; outdoor = mean of the day's hours
  const w = statBars('week', [hr(8, 1, 0.5), hr(8, 2, 0.5), hr(2, 5, 1)], 7, [hr(8, 1, 0, 2), hr(8, 2, 0, 4)]);
  assert.deepEqual([w.length, w[6].v, w[0].v, w[6].t], [7, 1, 1, 3]);
  const y = statBars('year', [{ start: at(2026, 11, 1), end: at(2026, 12, 1), change: 40 }], 12);
  assert.deepEqual([y.length, y[10].v], [12, 40]);
  assert.equal(statBars('month', [{ start: at(2026, 11, 30), change: 1 }], 30)[29].v, 1);
  assert.equal(statBars('windows-hours', [], 3, [], false).length, 3);
});

test('chip and range labels', () => {
  const now = at(2026, 11, 8, 21);
  assert.deepEqual(chipLabels(now, 'day', 0), { prev: 'včera', month: '8. 10.', yoy: '8. 11. 2025' });
  assert.deepEqual(chipLabels(at(2026, 11, 4, 12), 'week', 0), { prev: 'minulý týden', yoy: 'týden 45/2025' });
  assert.deepEqual(chipLabels(now, 'month', 0), { prev: 'říjen', yoy: 'listopad 2025' });
  assert.deepEqual(chipLabels(now, 'year', 0), { prev: '2025' });
  // a past day names its neighbour by date; last January's December carries the year
  assert.equal(chipLabels(anchor(now, 'day', -1), 'day', -1, now).prev, '6. 11.');
  assert.equal(chipLabels(at(2026, 1, 20), 'month', 0, at(2026, 1, 20)).prev, 'prosinec 2025');
  assert.equal(rangeLabel(now, 'day', 0), 'Dnes 8. 11.');
  assert.equal(rangeLabel(anchor(now, 'day', -1), 'day', -1, now), '7. 11.');
  assert.equal(rangeLabel(at(2026, 11, 4), 'week', 0), '2.–8. 11.');
  assert.equal(rangeLabel(at(2026, 11, 11), 'week', 0), '9.–15. 11.');
  assert.equal(rangeLabel(at(2026, 11, 1), 'week', 0), '26. 10.–1. 11.');
  assert.equal(rangeLabel(now, 'month', 0), 'Listopad 2026');
  assert.equal(rangeLabel(now, 'year', 0), '2026');
  assert.equal(rangeLabel(anchor(now, 'year', -1), 'year', -1, now), '2025');
});

test('explainText: colder / warmer and better / worse', () => {
  const a = (cur, cmp, nd) => ({ cur: { outdoorMean: cur }, cmp: { outdoorMean: cmp }, normDelta: nd });
  assert.equal(explainText(a(4.1, 6.3, -3), 'Dnes', 'včera'), 'Dnes bylo chladněji (Ø 4,1 °C, včera 6,3 °C). Na 1 °C zimy kotel běžel o 3 % méně – topení je úspornější, ne horší.');
  assert.match(explainText(a(8, 6, 5), 'Dnes', 'včera'), /^Dnes bylo tepleji .* o 5 % více – topení je méně úsporné\.$/);
  assert.match(explainText(a(8, 6, 0.2), 'Dnes', 'včera'), /stejně dlouho/);
  assert.equal(explainText(a(8, 6, null), 'Dnes', 'včera'), '');
});

test('fetchStats: one call for several ids, rows normalised; fetchStatsSet: current + whole comparison', async () => {
  const calls = [];
  const hass = { callWS: async (m) => { calls.push(m); return { 'sensor.a': [{ start: +at(2026, 11, 8, 1), end: +at(2026, 11, 8, 2), change: '0.5', mean: null }, { start: 'x' }], 'sensor.t': [{ start: +at(2026, 11, 8, 1), mean: 4.5 }] }; } };
  const res = await fetchStats(hass, ['sensor.a', 'sensor.t', 'sensor.none'], at(2026, 11, 8), at(2026, 11, 9), 'hour');
  assert.deepEqual({ type: calls[0].type, ids: calls[0].statistic_ids, period: calls[0].period, types: calls[0].types }, { type: 'recorder/statistics_during_period', ids: ['sensor.a', 'sensor.t', 'sensor.none'], period: 'hour', types: ['change', 'mean'] });
  assert.deepEqual([res['sensor.a'].length, res['sensor.a'][0].change, res['sensor.t'][0].mean, res['sensor.t'][0].change, res['sensor.none']], [1, 0.5, 4.5, 0, []]);
  const cfg = normalizeConfig({ circuit: 'c1', valves: ['climate.k'] });
  assert.deepEqual(statIds(cfg), { boiler: 'sensor.heating_stats_boiler_total_c1', windowBoiler: 'sensor.heating_stats_window_boiler_total_c1', windowValves: 'sensor.heating_stats_window_valves_total_c1', outdoor: 'sensor.heating_outdoor_temperature_c1' });
  calls.length = 0;
  const real = at(2026, 11, 8, 21, 37);
  const set = await fetchStatsSet(hass, cfg, { gran: 'day', offset: 0, cmp: 'prev' }, real);
  assert.equal(calls.length, 2);
  assert.deepEqual([calls[0].start_time, calls[0].end_time, calls[0].period], [at(2026, 11, 8).toISOString(), at(2026, 11, 8, 21).toISOString(), 'hour']);
  assert.deepEqual([calls[1].start_time, calls[1].end_time], [at(2026, 11, 7).toISOString(), at(2026, 11, 8).toISOString()]); // the whole previous day
  assert.deepEqual(Object.keys(set.cur), ['boiler', 'windowBoiler', 'windowValves', 'outdoor', 'tail']);
  assert.equal(set.cur.tail, null); // a day is hourly already
  // rows by granularity; a past period ends at its end
  calls.length = 0;
  await fetchStatsSet(hass, cfg, { gran: 'year', offset: -1, cmp: 'prev' }, real);
  assert.deepEqual([calls[0].period, calls[0].start_time, calls[0].end_time], ['month', at(2025, 1, 1).toISOString(), at(2026, 1, 1).toISOString()]);
  calls.length = 0;
  await fetchStatsSet(hass, cfg, { gran: 'week', offset: 0, cmp: 'yoy' }, real);
  assert.equal(calls[0].period, 'hour');
  calls.length = 0;
  await fetchStatsSet(hass, cfg, { gran: 'month', offset: 0, cmp: 'prev' }, real);
  assert.equal(calls[0].period, 'day');
  // the partial day at the cut: hourly rows from its start to the cut, for both sides (Nov 8 00:00-21:00, Oct 8 00:00-21:00)
  assert.deepEqual(calls.slice(2).map((m) => [m.period, m.start_time, m.end_time]), [
    ['hour', at(2026, 11, 8).toISOString(), at(2026, 11, 8, 21).toISOString()], ['hour', at(2026, 10, 8).toISOString(), at(2026, 10, 8, 21).toISOString()]]);
  calls.length = 0;
  await fetchStatsSet(hass, cfg, { gran: 'year', offset: 0, cmp: 'prev' }, real); // the partial month
  assert.deepEqual(calls.slice(2).map((m) => [m.period, m.start_time]), [['hour', at(2026, 11, 1).toISOString()], ['hour', at(2025, 11, 1).toISOString()]]);
  calls.length = 0;
  await fetchStatsSet(hass, cfg, { gran: 'month', offset: -1, cmp: 'prev' }, real);
  assert.equal(calls.length, 2); // a whole past period needs no tail
});

const stView = (over = {}, data = null) => ({ title: 'Topení přízemí', st: { metric: 'boiler', gran: 'day', offset: 0, cmp: 'prev', norm: true, ...over }, data, real: at(2026, 11, 8, 21, 37) });
const dataset = (cur, cmp) => ({ cur, cmp });

test('statsHtml: loading, failed, empty; controls and navigation', () => {
  assert.match(statsHtml(stView()), /Načítám…/);
  assert.match(statsHtml(stView({}, 'none')), /Statistiky nejsou k dispozici\./);
  const empty = { boiler: [], windowBoiler: [], windowValves: [], outdoor: [] };
  assert.match(statsHtml(stView({}, dataset(empty, empty))), /Zatím tu nejsou žádná data\./);
  const h = statsHtml(stView());
  assert.match(h, /Dnes 8\. 11\./);
  assert.match(h, /data-act="nav" data-d="1"[^>]*disabled/); // ▶ disabled at offset 0
  assert.doesNotMatch(h, /data-act="nav" data-d="-1"[^>]*disabled/);
  assert.match(statsHtml(stView({ offset: -1 })), /data-act="nav" data-d="1" data-k="nav:1" aria-label="Další den">/);
  assert.match(statsHtml(stView({ offset: -1 })), /7\. 11\./);
  assert.deepEqual([...h.matchAll(/data-act="gran" data-val="(\w+)"/g)].map((m) => m[1]), ['day', 'week', 'month', 'year']);
  assert.deepEqual([...h.matchAll(/data-act="cmp" data-val="(\w+)"/g)].map((m) => m[1]), ['prev', 'month', 'yoy']);
  assert.match(h, /class="chip cmp on"[^>]*>včera</);
  assert.deepEqual([...statsHtml(stView({ gran: 'year', cmp: 'prev' })).matchAll(/data-act="cmp" data-val="(\w+)"/g)].map((m) => m[1]), ['prev']);
  assert.match(statsParts(stView()).head, /Statistiky/);
});

test('statsHtml: Kotel hero, chips, switch and tiles', () => {
  const cur = day(2026, 11, 8, 21, 0.3, 0), cmp = day(2026, 11, 7, 24, 0.25, 12);
  const h = statsHtml(stView({}, dataset(cur, cmp)));
  assert.match(h, /Kotel běžel dnes · do 21:00/);
  assert.match(h, /<span class="hero">6,3<\/span>/);
  assert.match(h, /Včera do 21:00/);
  assert.match(h, /5,3 h/);
  assert.match(h, /delta up">▲ \+20 % \(\+1,[01] h\)/);
  assert.match(h, /delta down">▼ −60 % na denostupeň/);
  assert.match(h, /Dnes bylo chladněji \(Ø 0,0 °C, včera 12,0 °C\)/);
  assert.match(h, /aria-checked="true"/);
  assert.match(h, /<polyline /);
  assert.match(h, /Denostupně/);
  assert.match(h, /0,40 h/);
  assert.equal([...h.matchAll(/class="bk"/g)].length, 24);
  // the switch off: no degree-day chip, no explanation
  const off = statsHtml(stView({ norm: false }, dataset(cur, cmp)));
  assert.doesNotMatch(off, /na denostupeň<\/span>|bylo chladněji/);
  assert.match(off, /aria-checked="false"/);
  assert.match(off, /▲ \+20 %/);
});

test('statsHtml: Okna hero is the boiler hours the windows saved; bars are valve hours', () => {
  const cur = day(2026, 11, 8, 21, 0.3, 4), cmp = day(2026, 11, 7, 24, 0.25, 4);
  cur.windowBoiler.forEach((r) => { r.change = 0.04; }); // 21 h x 0.04 = 0.84 saved today, 0.42 yesterday (cut at 21:00)
  cur.windowValves = [{ start: at(2026, 11, 8, 7), end: at(2026, 11, 8, 8), change: 2, mean: null }];
  const h = statsHtml(stView({ metric: 'windows' }, dataset(cur, cmp)));
  assert.match(h, /Kotel stál kvůli oknům · dnes/);
  assert.match(h, /<span class="hero">0,8<\/span>/);
  assert.match(h, /<div class="sv">0,4 h<\/div>/);
  assert.match(h, /delta down">▲ \+0,4 h ušetřeno/); // more saved = green
  assert.match(statsHtml(stView({ metric: 'windows' }, dataset(day(2026, 11, 8, 21, 0.3, 4), Object.assign(day(2026, 11, 7, 24, 0.25, 4), { windowBoiler: cmp.windowBoiler.map((r) => ({ ...r, change: 0.04 })) })))), /delta up">▼ −0,4 h ušetřeno/);
  assert.match(h, /Hlavice-hodiny bez topení/);
  assert.match(h, /2,0 h/);
  assert.doesNotMatch(h, /<polyline/);
  assert.match(h, /aria-pressed="true" class="on"><svg[^>]*><path[^>]*><\/path><\/svg>Okna/);
});

test('statsHtml: a week and a month render their buckets', () => {
  const row = (d, per) => ({ start: at(2026, 11, d), end: at(2026, 11, d + 1), change: per, mean: 5 });
  const mk = (n, per) => ({ boiler: Array.from({ length: n }, (_, i) => row(1 + i, per)), windowBoiler: [], windowValves: [], outdoor: Array.from({ length: n }, (_, i) => row(1 + i, per)) });
  const m = statsHtml({ ...stView({ gran: 'month' }, dataset(mk(8, 4), mk(8, 3))), real: at(2026, 11, 8, 21) });
  assert.equal([...m.matchAll(/class="bk"/g)].length, 31); // November has 30, October 31: the longer of both
  assert.match(m, /Kotel běžel tento měsíc · do 8\. 11\./);
  const w = statsHtml(stView({ gran: 'week' }, dataset(mk(8, 4), mk(8, 3))));
  assert.equal([...w.matchAll(/class="bk"/g)].length, 7);
  assert.match(w, />Po<.*>Ne</s);
});

// Identical usage in every hour (0.1 h, 5 °C) of the period and its comparison, as the recorder would return it: coarse rows
// per `gran`, plus the hourly tail of the partial day / month at the cut (what fetchStatsSet fetches).
function steady(gran, key, real) {
  const hourly = (from, to) => { const o = []; for (let h = new Date(+from); h < to; h = new Date(+h + 3600000)) o.push({ start: h, end: new Date(+h + 3600000), change: 0.1, mean: 5, p: 'hour' }); return o; };
  const coarse = (rows) => {
    if (gran === 'day' || gran === 'week') return rows;
    const m = new Map();
    for (const r of rows) {
      const k = gran === 'month' ? +at(r.start.getFullYear(), r.start.getMonth() + 1, r.start.getDate()) : +at(r.start.getFullYear(), r.start.getMonth() + 1, 1);
      const g = m.get(k) ?? { start: new Date(gran === 'month' ? new Date(r.start.getFullYear(), r.start.getMonth(), r.start.getDate()) : new Date(r.start.getFullYear(), r.start.getMonth(), 1)), change: 0, n: 0, p: gran === 'month' ? 'day' : 'month' };
      g.change += r.change; g.n++; m.set(k, g);
    }
    return [...m.values()].map((g) => ({ ...g, mean: 5 }));
  };
  const kinds = (rows, tail) => ({ boiler: rows, windowBoiler: rows.map((r) => ({ ...r, change: r.change / 5 })), windowValves: [], outdoor: rows, tail });
  const fl = hourFloor(real), r = ranges(fl, gran);
  const span = (rg) => (gran === 'month' || gran === 'year' ? [gran === 'month' ? new Date(rg[1].getFullYear(), rg[1].getMonth(), rg[1].getDate()) : new Date(rg[1].getFullYear(), rg[1].getMonth(), 1), rg[1]] : null);
  const tail = (rg) => { const sp = span(rg); const rows = sp && +sp[0] < +sp[1] ? hourly(...sp) : null; return rows && kinds(rows, null); };
  const cmpRg = r[key];
  const whole = [cmpRg[0], periodEnd(gran, cmpRg[0])];
  const mk = (rg, rows, tl) => ({ ...kinds(coarse(rows), null), tail: tl });
  return { cur: mk(r.cur, hourly(...r.cur), tail(r.cur)), cmp: mk(cmpRg, hourly(...whole), tail(cmpRg)) };
}

test('like-for-like: identical usage compares equal at awkward times (day, week, month, year)', () => {
  const times = [at(2026, 11, 8, 0, 30), at(2026, 11, 2, 1, 30), at(2026, 11, 9, 0, 30), at(2026, 12, 1, 0, 30), at(2026, 11, 8, 21, 37), at(2027, 1, 1, 0, 30), at(2027, 1, 2, 1, 30), at(2026, 11, 2, 0, 5)];
  for (const real of times) {
    for (const gran of ['day', 'week', 'month', 'year']) {
      for (const key of COMPARE[gran]) {
        const d = steady(gran, key, real);
        const a = analyzeStats(gran, key, real, d.cur, d.cmp);
        const label = `${gran}/${key} at ${real.toISOString()}`;
        assert.ok(a.cur && a.cmp, label);
        close(a.cur.boiler, a.cmp.boiler);
        close(a.cur.windowBoiler, a.cmp.windowBoiler);
        close(a.cur.hdd, a.cmp.hdd);
        assert.ok(a.delta === null || Math.abs(a.delta) < 1e-6, `${label}: delta ${a.delta}`);
        assert.ok(a.normDelta === null || Math.abs(a.normDelta) < 1e-6, `${label}: normDelta ${a.normDelta}`);
        // the bars add up to the side numbers
        close(statBars(gran, a.rows.cur.boiler, bucketCount(gran, a.r.cur[0]) + 7, [], false).reduce((s, b) => s + b.v, 0), a.cur.boiler);
        close(statBars(gran, a.rows.cmp.boiler, bucketCount(gran, a.r.cur[0]) + 7, [], false).reduce((s, b) => s + b.v, 0), a.cmp.boiler);
      }
    }
  }
});

test('like-for-like: the partial row is cut exactly (Rok on 2. 11. 01:30)', () => {
  const d = steady('year', 'prev', at(2026, 11, 2, 1, 30));
  const a = analyzeStats('year', 'prev', at(2026, 11, 2, 1, 30), d.cur, d.cmp);
  close(a.cur.boiler, a.cmp.boiler);
  assert.ok(a.cur.boiler > 0);
  // without the hourly tail the partial month counts whole (the old skew): that is what the tail fixes
  const coarse = analyzeStats('year', 'prev', at(2026, 11, 2, 1, 30), { ...d.cur, tail: null }, { ...d.cmp, tail: null });
  assert.ok(Math.abs(coarse.delta) > 1);
});

test('the first hour of a period: 0 h against 0 h, not an empty state; no rows at all is empty', () => {
  const real = at(2026, 11, 8, 0, 30);
  const d = steady('day', 'prev', real);
  assert.equal(d.cur.boiler.length, 0);
  const a = analyzeStats('day', 'prev', real, d.cur, d.cmp);
  assert.deepEqual([a.cur.boiler, a.cmp.boiler, a.diff, a.delta], [0, 0, 0, null]);
  const v = { title: 'T', st: { metric: 'boiler', gran: 'day', offset: 0, cmp: 'prev', norm: true }, data: d, real };
  assert.match(statsHtml(v), /<span class="hero">0,0<\/span>/);
  const none = { boiler: [], windowBoiler: [], windowValves: [], outdoor: [], tail: null };
  assert.match(statsHtml({ ...v, data: { cur: none, cmp: none } }), /Zatím tu nejsou žádná data\./);
});

test('Den chart: a 25-hour DST day grows the axis instead of overflowing', () => {
  const rows = Array.from({ length: 25 }, (_, i) => ({ start: new Date(Date.UTC(2026, 9, 24, 22) + i * 3600000), end: new Date(Date.UTC(2026, 9, 24, 23) + i * 3600000), change: 1, mean: 5, p: 'hour' }));
  const dup = rows.concat([{ ...rows[3], start: rows[3].start, change: 0.5 }]); // an hour with 1.5 h = 90 min
  const real = at(2026, 10, 26, 3);
  const h = statsHtml({ title: 'T', st: { metric: 'boiler', gran: 'day', offset: -1, cmp: 'prev', norm: true }, data: { cur: { boiler: dup, windowBoiler: [], windowValves: [], outdoor: [], tail: null }, cmp: null }, real });
  const px = [...h.matchAll(/class="bk"><i style="height:([\d.]+)px/g)].map((m) => Number(m[1]));
  assert.ok(Math.max(...px) <= 134);
});

test('window savings (#26): kWh / Kč tiles by power_max_kw, the entities, the price and source_type', () => {
  const cfgOf = (o = {}) => normalizeConfig({ circuit: 'c1', valves: ['climate.k'], ...o });
  // power_max_kw is a string from HFB; "" and 0 are unset
  assert.deepEqual(['24', '', '0', 0, undefined, 'x'].map((p) => cfgOf({ power_max_kw: p }).power_max_kw), [24, null, null, null, null, null]);
  assert.deepEqual(['electric', 'heat_pump', 'coal', undefined].map((t) => cfgOf({ source_type: t }).source_type), ['electric', 'heat_pump', 'gas', 'gas']);
  assert.deepEqual(Object.keys(statIds(cfgOf({ power_max_kw: '24' }))).slice(4), ['windowEnergy', 'windowCost']);
  assert.deepEqual(Object.keys(statIds(cfgOf({ power_max_kw: '24', source_type: 'heat_pump' }))).slice(4), ['windowEnergy']);
  const E = 'sensor.heating_stats_window_energy_total_c1', K = 'sensor.heating_stats_window_cost_total_c1', P = 'input_number.heating_stats_price_c1';
  const hass = (price = '1.8', extra = {}) => ({ states: { [E]: { state: '12' }, [K]: { state: '21' }, [P]: { state: price }, ...extra } });
  assert.deepEqual(savingsView(hass(), cfgOf({ power_max_kw: '24' })), { energy: 'kWh plynu; horní odhad: hodiny kotle × jmenovitý výkon (kotel moduluje)', cost: true });
  assert.deepEqual(savingsView(hass('0'), cfgOf({ power_max_kw: '24' })), { energy: 'kWh plynu; horní odhad: hodiny kotle × jmenovitý výkon (kotel moduluje)', cost: false });
  assert.deepEqual(savingsView(hass(), cfgOf({ power_max_kw: '24', source_type: 'heat_pump' })), { energy: 'kWh tepla; horní odhad: hodiny × jmenovitý výkon', cost: false });
  assert.deepEqual(savingsView(hass(), cfgOf({ power_max_kw: '' })), { energy: null, cost: false });
  assert.deepEqual(savingsView({ states: {} }, cfgOf({ power_max_kw: '24' })), { energy: null, cost: false }); // no entity yet

  const rows = (d, kwh, czk) => Object.assign(day(2026, 11, d, d === 8 ? 21 : 24, 0.3, 4), {
    windowEnergy: [{ start: at(2026, 11, d, 7), end: at(2026, 11, d, 8), change: kwh, mean: null }],
    windowCost: [{ start: at(2026, 11, d, 7), end: at(2026, 11, d, 8), change: czk, mean: null }],
  });
  const view = (savings) => ({ ...stView({ metric: 'windows' }, dataset(rows(8, 4.8, 8.6), rows(7, 2.4, 4.3))), savings });
  const h = statsHtml(view({ energy: 'kWh elektřiny; horní odhad: hodiny kotle × jmenovitý výkon', cost: true }));
  assert.match(h, /<div class="lbl">Ušetřená energie<\/div><div class="fv">4,8 kWh<\/div><div class="cap">včera 2,4 kWh<\/div>/);
  assert.match(h, /<div class="lbl">Ušetřeno<\/div><div class="fv">9 Kč<\/div><div class="cap">včera 4 Kč<\/div>/);
  assert.match(h, /Ušetřená energie: kWh elektřiny; horní odhad: hodiny kotle × jmenovitý výkon\. Ušetřeno: Kč = /);
  const noKc = statsHtml(view({ energy: 'kWh tepla; horní odhad: hodiny × jmenovitý výkon', cost: false }));
  assert.match(noKc, /4,8 kWh/); assert.doesNotMatch(noKc, /Ušetřeno|Kč/);
  const none = statsHtml(view(undefined));
  assert.doesNotMatch(none, /Ušetřená energie|kWh/);
  // without the new rows (no power) nothing breaks
  assert.match(statsHtml(stView({ metric: 'windows' }, dataset(day(2026, 11, 8, 21, 0.3, 4), null))), /Kotel ušetřil/);
});
