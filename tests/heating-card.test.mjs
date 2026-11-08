import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { programView, programParts, programHtml, whenText, programId, normalizeConfig, valveView, circuitView, valvesSummary, gestureMap, zoneHandlers, nextTarget, cardHtml, valveDetail, chartModel, detailHtml, batteryText, fmt, plural } from '../dist/heating-card.js';

const FIXTURE = JSON.parse(readFileSync(new URL('./fixtures/states.json', import.meta.url), 'utf8'));
const C = 'circuit_demo';
const K = 'climate.kitchen_valve';
const B = 'climate.bedroom_valve';
const O = 'climate.office_valve';
const CFG = normalizeConfig({ circuit: C, valves: [K, B, O] });

// The fixture (real dev HA entity shapes) with patches: id -> {state?, attributes?} (attributes merge).
const world = (patch = {}) => {
  const states = structuredClone(FIXTURE);
  for (const [id, p] of Object.entries(patch)) {
    states[id] = { state: p.state ?? states[id]?.state, attributes: { ...states[id]?.attributes, ...p.attributes } };
  }
  return { states };
};
const valves = (attributes) => ({ [`sensor.heating_valves_${C}`]: { attributes } });
const view = (patch, climate = K) => valveView(world(patch), CFG, climate);

test('normalizeConfig', () => {
  assert.throws(() => normalizeConfig({ valves: [K] }), /heating-card: circuit is required/);
  assert.throws(() => normalizeConfig({ circuit: C }), /heating-card: valves/);
  assert.throws(() => normalizeConfig({ circuit: C, valves: [] }), /heating-card: valves/);
  assert.throws(() => normalizeConfig({ circuit: C, valves: ['sensor.x'] }), /climate/);
  assert.throws(() => normalizeConfig({ circuit: C, valves: [K], schedule_gesture: 'hold', info_gesture: 'hold' }), /must differ/);
  assert.throws(() => normalizeConfig({ circuit: C, valves: [K], info_gesture: 'swipe' }), /info_gesture/);
  const c = normalizeConfig({ circuit: C, valves: [K] });
  assert.equal(c.schedule_gesture, 'tap');
  assert.equal(c.info_gesture, 'icon_tap');
  // two "none" are fine
  normalizeConfig({ circuit: C, valves: [K], schedule_gesture: 'none', info_gesture: 'none' });
});

test('gestureMap: zones and the icon fallback', () => {
  assert.deepEqual(gestureMap(CFG), { body: { tap: 'schedule' }, icon: { tap: 'info' } });
  assert.deepEqual(gestureMap(normalizeConfig({ circuit: C, valves: [K], schedule_gesture: 'hold', info_gesture: 'none' })), { body: { hold: 'schedule' }, icon: {} });
});

test('fmt and plural', () => {
  assert.equal(fmt(21, 1), '21,0');
  assert.equal(fmt(20.44, 1), '20,4');
  assert.equal(fmt(1460).replace(/\s/g, ' '), '1 460');
  assert.equal(plural(1, 'okno', 'okna', 'oken'), '1 okno');
  assert.equal(plural(3, 'baterie', 'baterie', 'baterií'), '3 baterie');
  assert.equal(plural(5, 'okno', 'okna', 'oken'), '5 oken');
});

test('valveView: phases', () => {
  const idle = view({});
  assert.equal(idle.phase, 'idle');
  assert.equal(idle.state, 'Nečinný · 15,6 °C');
  assert.equal(idle.target, 21);
  assert.equal(idle.name, 'kitchen_valve');
  assert.equal(idle.off, false);
  assert.equal(view(valves({ demand: [K] })).phase, 'heat');
  assert.equal(view(valves({ demand: [K] })).state, 'Topí · 15,6 °C');
  assert.equal(view(valves({ phases: { [K]: ['fast'] }, demand: [K] })).phase, 'fast');
  assert.equal(view(valves({ phases: { [K]: ['fast'] } })).state, 'Rychlý start · 15,6 °C');
  assert.equal(view(valves({ phases: { [K]: ['run'] } })).phase, 'run');
  assert.equal(view(valves({ phases: { [K]: ['overrun'] } })).phase, 'run');
  assert.equal(view(valves({ phases: { [K]: ['overrun'] } })).state, 'Doběh · 15,6 °C');
  assert.equal(view(valves({ phases: { [K]: ['closed'] }, demand: [K] })).phase, 'closed');
  // the first item of a phase row is the phase; a missing valve is `normal`
  assert.equal(view(valves({ phases: { [K]: ['normal', 'since', 21, false] }, demand: [K] })).phase, 'heat');
  assert.equal(view(valves({ phases: {}, demand: [] })).phase, 'idle');
});

test('valveView: window and circuit off are disabled', () => {
  const w = view({ [`sensor.heating_off_schedule_${C}`]: { attributes: { window_open_climates: [K] } }, ...valves({ demand: [K], phases: { [K]: ['fast'] } }) });
  assert.equal(w.phase, 'window');
  assert.equal(w.off, true);
  assert.equal(w.state, 'Okno otevřené · 15,6 °C');
  const off = view({ [`binary_sensor.heating_active_${C}`]: { state: 'off' }, ...valves({ demand: [K] }) });
  assert.equal(off.phase, 'off');
  assert.equal(off.off, true);
  assert.equal(off.state, 'Vypnuto · 15,6 °C');
  // window beats off
  assert.equal(view({ [`binary_sensor.heating_active_${C}`]: { state: 'off' }, [`sensor.heating_off_schedule_${C}`]: { attributes: { window_open_climates: [K] } } }).phase, 'window');
});

test('valveView: low batteries replace the state line', () => {
  const low = (rows) => ({ [`sensor.heating_low_batteries_${C}`]: { attributes: { low_battery: rows } } });
  const one = view(low([{ climate: K, source: 'valve', state: 9 }]));
  assert.equal(one.state, 'Baterie 9 %');
  assert.deepEqual(one.lowBattery, [{ source: 'valve', state: 9 }]);
  const two = view(low([{ climate: K, source: 'valve', state: 14 }, { climate: K, source: 'window', state: 8 }, { climate: B, source: 'valve', state: 3 }]));
  assert.equal(two.state, 'Hlavice 14 % · okno 8 %');
  assert.equal(view(low([{ climate: K, source: 'sensor', state: 5 }, { climate: K, source: 'valve', state: 6 }])).state, 'Čidlo 5 % · hlavice 6 %');
  assert.equal(view(low([{ climate: B, source: 'valve', state: 3 }])).lowBattery.length, 0);
});

test('circuitView: subtitle variants', () => {
  const sub = (p) => circuitView(world(p), CFG).subtitle;
  assert.equal(sub({}), 'Kotel topí · žádná hlavice netopí');
  assert.equal(sub(valves({ demand: [K] })), 'Kotel topí · 1 hlavice chce teplo');
  assert.equal(sub(valves({ demand: [K, B] })), 'Kotel topí · 2 hlavice chtějí teplo');
  assert.equal(sub({ [`switch.boiler_${C}`]: { state: 'off' } }), 'Kotel netopí');
  assert.equal(sub({ [`switch.boiler_${C}`]: { state: 'off' }, ...valves({ left: 7 }) }), 'Kotel netopí · doběh čerpadla, ještě 7 min');
  assert.equal(sub({ [`input_select.heating_mode_${C}`]: { state: 'off' } }), 'Vypnuto · hlavice na 5 °C');
  const five = Array.from({ length: 5 }, (_, i) => `climate.v${i}`);
  const cfg5 = normalizeConfig({ circuit: C, valves: five });
  assert.equal(circuitView(world(valves({ demand: five })), cfg5).subtitle, 'Kotel topí · 5 hlavic chce teplo');
});

test('circuitView: mode hint, status, program, applying, outdoor, title', () => {
  const c = (p) => circuitView(world(p), CFG);
  assert.equal(c({}).mode, 'on');
  assert.equal(c({}).hint, 'podle rozvrhu');
  const bw = { [`input_select.heating_mode_${C}`]: { state: 'by_weather' } };
  assert.equal(c(bw).hint, 'pod 15 °C venku');
  assert.equal(c({ ...bw, [`input_number.heating_weather_threshold_${C}`]: { state: '15.5' } }).hint, 'pod 15,5 °C venku');
  const time = { ...bw, [`input_select.heating_auto_rule_${C}`]: { state: 'time' } };
  assert.equal(c({ ...time, [`input_datetime.heating_time_from_${C}`]: { state: '06:00:00' }, [`input_datetime.heating_time_to_${C}`]: { state: '22:30:00' } }).hint, '06:00–22:30 každý den');
  assert.equal(c({ ...time, [`input_datetime.heating_time_from_${C}`]: { state: 'unknown' } }).hint, 'nastav čas od–do');

  const status = (s) => c({ [`input_text.heating_status_${C}`]: { state: s } }).status;
  assert.equal(status(''), null);
  assert.deepEqual(status('success|Hotovo'), { level: 'success', text: 'Hotovo' });
  assert.deepEqual(status('error|Chyba | s čarou'), { level: 'error', text: 'Chyba | s čarou' });
  assert.deepEqual(status('Jen text'), { level: 'info', text: 'Jen text' });

  assert.equal(c({}).programName, 'Výchozí');
  assert.equal(c({ [`sensor.heating_program_${C}`]: { state: 'vacation' } }).programName, 'Dovolená');
  assert.equal(c({ [`sensor.heating_program_${C}`]: { state: 'weekend' } }).programName, 'weekend');
  assert.equal(c({}).offSchedule, 0);
  assert.deepEqual(c({}).applying, { on: false, trigger: 'program', left: 0 });
  assert.deepEqual(c({ [`sensor.heating_applying_${C}`]: { state: 'applying', attributes: { trigger: 'sync', left: 3 } } }).applying, { on: true, trigger: 'sync', left: 3 });
  assert.equal(c({}).outdoor, -24.4);
  assert.equal(c({ [`sensor.heating_outdoor_temperature_${C}`]: { state: 'unavailable' } }).outdoor, null);
  assert.equal(c({}).title, 'Přízemí');
  assert.equal(circuitView(world(), normalizeConfig({ circuit: C, valves: [K], heading: 'Dům' })).title, 'Dům');
  assert.equal(circuitView({ states: {} }, CFG).title, C);
});

test('valvesSummary', () => {
  const v = (phase, bat = 0) => ({ phase, lowBattery: Array(bat).fill({}) });
  assert.equal(valvesSummary([v('heat'), v('fast'), v('window'), v('idle', 1), v('heat', 1)]), '3 topí · 1 okno · 2 baterie');
  assert.equal(valvesSummary([v('idle')]), '0 topí');
});

test('cardHtml renders both boxes and the pieces by state', () => {
  const html = cardHtml(world(valves({ demand: [K] })), CFG);
  assert.equal((html.match(/class="card"/g) ?? []).length, 2);
  assert.equal((html.match(/class="tile/g) ?? []).length, 3);
  assert.match(html, /Přízemí/);
  assert.match(html, /aria-pressed="true"( title="[^"]*")? class="on"/);
  assert.ok(!html.includes('class="alert')); // no status
  const msg = cardHtml(world({ [`input_text.heating_status_${C}`]: { state: 'warning|<b>x</b>' } }), CFG);
  assert.match(msg, /alert warning/);
  assert.ok(!msg.includes('<b>x</b>')); // escaped
  const sync = cardHtml(world({ [`sensor.heating_applying_${C}`]: { state: 'applying', attributes: { trigger: 'sync', left: 2 } } }), CFG);
  assert.match(sync, /class="spin"/);
  assert.match(sync, /data-act="sync" data-k="sync" disabled/);
  const prog = cardHtml(world({ [`sensor.heating_applying_${C}`]: { state: 'applying', attributes: { trigger: 'program', left: 2 } } }), CFG);
  assert.match(prog, /Nastavuji… 2/);
});

test('nextTarget: quick taps add up from the pending value until hass reports it', () => {
  const v = { climate: K, target: 21, min: 5, max: 30 };
  const now = 1000;
  assert.equal(nextTarget(v, {}, 1, now), 21.5);
  const p = { [K]: { t: 21.5, at: now } };
  assert.equal(nextTarget(v, p, 1, now + 100), 22); // second tap, hass still says 21
  assert.equal(nextTarget(v, { [K]: { t: 22, at: now } }, -1, now + 100), 21.5);
  assert.equal(nextTarget({ ...v, target: 21.5 }, p, 1, now + 100), 22); // hass caught up: from its value
  assert.equal(nextTarget(v, p, 1, now + 5001), 21.5); // pending expired
  assert.equal(nextTarget({ ...v, target: 30 }, {}, 1), 30); // clamped
  assert.equal(nextTarget({ ...v, target: null }, {}, 1), null);
});

test('program: unavailable sensor falls back to the select, else a dash; Czech names', () => {
  const prog = (p) => circuitView(world(p), CFG).programName;
  const sensor = (state, attributes) => ({ [`sensor.heating_program_${C}`]: { state, attributes } });
  assert.equal(prog(sensor('unavailable')), 'Výchozí'); // select says auto
  assert.equal(prog({ ...sensor('unknown'), [`select.heating_program_${C}`]: { state: 'vacation' } }), 'Dovolená');
  assert.equal(prog({ ...sensor('unavailable'), [`select.heating_program_${C}`]: { state: 'unavailable' } }), '—');
  assert.equal(prog({ ...sensor('unavailable'), [`select.heating_program_${C}`]: { state: 'bogus' } }), '—');
  // program_names -> texts of the mushroom dashboard -> the id
  assert.equal(prog(sensor('auto', { program_names: {} })), 'Výchozí');
  assert.equal(prog(sensor('vacation', { program_names: { vacation: 'Prázdniny' } })), 'Prázdniny');
  assert.equal(prog(sensor('weekend', { program_names: {} })), 'weekend');
});

test('zoneHandlers: the icon falls back to the body per gesture', () => {
  const z = gestureMap(normalizeConfig({ circuit: C, valves: [K], schedule_gesture: 'hold', info_gesture: 'icon_tap' }));
  assert.deepEqual(zoneHandlers(z, 'icon'), { hold: 'schedule', tap: 'info' });
  assert.deepEqual(zoneHandlers(z, 'body'), { hold: 'schedule' });
});

test('tile controls: icon button = info, text button = schedule, each only when not none', () => {
  const html = (o) => cardHtml(world(), normalizeConfig({ circuit: C, valves: [K], ...o }));
  const h = html({});
  assert.match(h, /<button class="dot [a-z]+" data-zone="icon"[^>]*aria-label="Detail kitchen_valve"/);
  assert.match(h, /class="txt" data-zone="body" role="button" tabindex="0"/);
  const none = html({ info_gesture: 'none', schedule_gesture: 'none' });
  assert.ok(!none.includes('aria-label="Detail') && !none.includes('role="button"'));
});

test('circuit active only when exactly on; unknown is shown as unknown', () => {
  const unk = (state) => ({ [`binary_sensor.heating_active_${C}`]: { state } });
  for (const s of ['unavailable', 'unknown']) {
    const v = view(unk(s));
    assert.equal(v.phase, 'off');
    assert.equal(v.off, true);
    assert.equal(v.state, 'Stav neznámý · 15,6 °C');
    assert.equal(circuitView(world(unk(s)), CFG).subtitle, 'Stav neznámý');
  }
  assert.equal(view(unk('on')).off, false);
  // a missing sensor too; mode off keeps its own text
  const gone = world();
  delete gone.states[`binary_sensor.heating_active_${C}`];
  assert.equal(valveView(gone, CFG, K).state, 'Stav neznámý · 15,6 °C');
  const modeOff = { ...unk('unavailable'), [`input_select.heating_mode_${C}`]: { state: 'off' } };
  assert.equal(view(modeOff).state, 'Vypnuto · 15,6 °C');
  assert.equal(circuitView(world(modeOff), CFG).subtitle, 'Vypnuto · hlavice na 5 °C');
  assert.equal(view(unk('off')).state, 'Vypnuto · 15,6 °C');
});

// ---- valve dialog ----
const NOW = Date.parse('2026-11-08T12:00:00Z');
// the valve's device: battery, signal, position, calibration (+ a window sensor device with its own battery)
const device = () => ({
  states: {
    'sensor.k_battery': { state: '82', attributes: { device_class: 'battery' } },
    'sensor.k_signal': { state: '-71', attributes: { device_class: 'signal_strength' } },
    'sensor.k_valve_position': { state: '12', attributes: {} },
    'binary_sensor.k_calibration': { state: 'off', attributes: {} },
    'sensor.balkon_battery': { state: '8', attributes: { device_class: 'battery' } },
    'sensor.kuchyn_battery': { state: '85', attributes: { device_class: 'battery' } },
  },
  entities: Object.fromEntries([K, 'sensor.k_battery', 'sensor.k_signal', 'sensor.k_valve_position', 'binary_sensor.k_calibration', 'sensor.other'].map((id) => [id, { device_id: 'dk' }])),
});
const wins = [
  { entity_id: 'binary_sensor.balkon', name: 'Okno balkon', state: 'off', open: false, since: '2026-11-08T08:00:00Z', battery: 'sensor.balkon_battery' },
  { entity_id: 'binary_sensor.kuchyn', name: 'Okno kuchyň', state: 'off', open: false, since: '2026-11-08T08:00:00Z', battery: 'sensor.kuchyn_battery' },
];
const detail = (patch, now = NOW) => {
  const w = world(patch);
  const d = device();
  Object.assign(w.states, d.states);
  for (const [id, p] of Object.entries(patch)) if (id.startsWith('sensor.') || id.startsWith('input_')) w.states[id] = { state: p.state ?? w.states[id]?.state, attributes: { ...w.states[id]?.attributes, ...p.attributes } };
  w.entities = d.entities;
  return valveDetail(w, CFG, K, now);
};
const offs = (windows) => ({ [`sensor.heating_off_schedule_${C}`]: { attributes: { windows: { [K]: windows } } } });

test('valveDetail: V4-Valve board (low batteries, two window sensors)', () => {
  const d = detail({
    ...offs(wins),
    [`sensor.heating_low_batteries_${C}`]: { attributes: {
      low_battery: [{ climate: K, source: 'valve', state: 14 }, { climate: K, source: 'window', state: 8 }],
      list_low: [{ name: 'Šatna', source: 'valve', state: 14, climates: [K] }, { name: 'Okno balkon', source: 'window', state: 8, climates: [K] }] } },
    'sensor.k_battery': { state: '14', attributes: { device_class: 'battery' } },
  });
  assert.deepEqual(d.alert, { kind: 'battery', title: 'Vyměň baterie (2)', text: ' · hlavice 14 %, okno balkon 8 %' });
  assert.deepEqual(d.battery, { value: 14, low: true });
  assert.equal(d.signal, -71);
  assert.equal(d.position, 12);
  assert.equal(d.calibration, 'ok');
  assert.deepEqual(d.windows.map((w) => [w.name, w.state, w.battery, w.lowBattery]), [['Okno balkon', 'Zavřené', 8, true], ['Okno kuchyň', 'Zavřené', 85, false]]);
  const html = detailHtml(d);
  assert.match(html, /Vyměň baterie \(2\)/);
  assert.match(html, /Okna \(2\)/);
  assert.match(html, /vd-tile low/);
});

test('valveDetail: V4-ValveWindow board (window open 12 min, reminder 30 -> 18)', () => {
  const open = [{ ...wins[0], state: 'on', open: true, since: '2026-11-08T11:48:00Z', battery: 'sensor.balkon_battery' }, wins[1]];
  const d = detail({ ...offs(open), [`sensor.heating_off_schedule_${C}`]: { attributes: { windows: { [K]: open }, window_open_climates: [K] } },
    [`input_number.heating_window_reminder_${C}`]: { state: '30' } });
  assert.equal(d.view.phase, 'window');
  assert.equal(d.alert.kind, 'window');
  assert.equal(d.alert.title, 'Okno balkon otevřené 12 min');
  assert.equal(d.alert.text, ' · hlavice netopí, dokud se okno nezavře. Připomenu za 18 min.');
  assert.equal(d.windows[0].state, 'Otevřené · 12 min');
  const html = detailHtml(d);
  assert.match(html, /Cíl · platí po zavření okna/);
  assert.equal((html.match(/data-act="step"[^>]* disabled/g) || []).length, 2);
});

test('valveDetail: reminder 0 or used up, unavailable sensor, no windows', () => {
  const open = [{ ...wins[0], state: 'on', open: true, since: '2026-11-08T11:48:00Z' }];
  const base = { [`sensor.heating_off_schedule_${C}`]: { attributes: { windows: { [K]: open }, window_open_climates: [K] } } };
  assert.equal(detail(base).alert.text, ' · hlavice netopí, dokud se okno nezavře.');
  assert.equal(detail({ ...base, [`input_number.heating_window_reminder_${C}`]: { state: '0' } }).alert.text, ' · hlavice netopí, dokud se okno nezavře.');
  assert.equal(detail({ ...base, [`input_number.heating_window_reminder_${C}`]: { state: '10' } }).alert.text, ' · hlavice netopí, dokud se okno nezavře.');
  const dead = detail(offs([{ ...wins[0], state: 'unavailable', open: false }, { ...wins[1], state: 'unknown', open: false }]));
  assert.deepEqual(dead.windows.map((w) => w.state), ['Čidlo nedostupné', 'Čidlo nedostupné']);
  assert.equal(dead.alert, null);
  const none = detail({});
  assert.deepEqual(none.windows, []);
  assert.equal(none.alert, null);
  assert.doesNotMatch(detailHtml(none), /Okna \(/);
  // no device facts: dashes, never a crash
  const bare = valveDetail(world(), CFG, K, NOW);
  assert.deepEqual([bare.battery, bare.signal, bare.position, bare.calibration], [null, null, null, null]);
  assert.match(detailHtml(bare), /Baterie/);
});

test('chartModel: lines, window bands, hour labels', () => {
  const end = Date.parse('2026-11-08T12:00:00');
  const h = (n) => (end - n * 3600000) / 1000;
  const m = chartModel([{ lu: h(24), a: { current_temperature: 19, temperature: 18 } }, { lu: h(12), a: { current_temperature: 21 } }, { lu: h(0), a: { temperature: 21 } }],
    [{ rows: [{ lu: h(6), s: 'on' }, { lu: h(3), s: 'off' }] }, { rows: [{ lu: h(4), s: 'on' }, { lu: h(2), s: 'off' }] }], end);
  assert.match(m.current, /^M0 .* L440 \d+(\.\d)?$/);
  assert.match(m.target, / H440$/);
  assert.equal(m.bands.length, 1); // 6 h..3 h and 4 h..2 h overlap -> one band 6 h..2 h
  assert.equal(m.bands[0].x, 330);
  assert.equal(m.bands[0].w, Math.round((4 / 24) * 4400) / 10);
  assert.deepEqual(m.labels.map((l) => l.text), ['12:00', '18:00', '0:00', '6:00', '12:00']);
  assert.equal(chartModel([], [], end), null);
  // an open window starts at its `since`, not at the chart start: history says "on" from the start state, since = 12 min ago
  const rows = [{ lu: h(24), a: { current_temperature: 19 } }];
  const open12 = chartModel(rows, [{ rows: [{ lu: h(24), s: 'on' }], since: end - 12 * 60000 }], end);
  assert.deepEqual(open12.bands, [{ x: 436.3, w: 3.7 }]);
  // no history rows at all: from `since`; since before the chart start is clamped to it
  assert.deepEqual(chartModel(rows, [{ rows: [], since: end - 12 * 60000 }], end).bands, [{ x: 436.3, w: 3.7 }]);
  assert.deepEqual(chartModel(rows, [{ rows: [], since: end - 48 * 3600000 }], end).bands, [{ x: 0, w: 440 }]);
  // an opening in the history wins when it is later than nothing else says
  assert.equal(chartModel(rows, [{ rows: [{ lu: h(24), s: 'off' }, { lu: h(12), s: 'on' }], since: end - 12 * 3600000 }], end).bands[0].x, 220);
});

test('valveDetail: unparsable since, battery names, unknown circuit state', () => {
  const bad = [{ ...wins[0], state: 'on', open: true, since: 'garbage' }];
  const base = { [`sensor.heating_off_schedule_${C}`]: { attributes: { windows: { [K]: bad }, window_open_climates: [K] } }, [`input_number.heating_window_reminder_${C}`]: { state: '30' } };
  const d = detail(base);
  assert.equal(d.alert.title, 'Okno balkon otevřené');
  assert.equal(d.alert.text, ' · hlavice netopí, dokud se okno nezavře.');
  assert.equal(d.windows[0].state, 'Otevřené');
  assert.equal(batteryText({ source: 'window', state: 8 }), 'okno 8 %');
  assert.equal(batteryText({ source: 'window', entity_id: 'binary_sensor.balkon', state: 8 }), 'okno balkon 8 %');
  assert.equal(batteryText({ source: 'window', name: 'Okno kuchyň', state: 8 }), 'okno kuchyň 8 %');
  assert.equal(batteryText({ source: 'valve', name: 'Šatna', state: 14 }), 'hlavice 14 %');
  const unknown = detail({ [`binary_sensor.heating_active_${C}`]: { state: 'unavailable' } });
  assert.equal(unknown.view.word, 'Stav neznámý');
  assert.match(detailHtml(unknown), /Teplota teď · stav neznámý/);
  assert.equal((detailHtml(unknown).match(/data-act="step"[^>]* disabled/g) || []).length, 2);
});

test('programView: names, current, icons, detail line', () => {
  const v = programView(world(), CFG);
  assert.deepEqual(v.programs.map((p) => [p.id, p.name, p.current]), [['auto', 'Výchozí', true], ['vacation', 'Dovolená', false]]);
  assert.equal(v.programs[0].detail, 'rozvrh hlavic · lichý týden');
  assert.equal(v.programs[1].detail, '');
  assert.equal(programView(world({ [`input_boolean.heating_week_alternation_${C}`]: { state: 'off' } }), CFG).programs[0].detail, 'rozvrh hlavic');
  // a name that program_names lacks falls back to the id; unknown ids get the generic icon
  const x = programView(world({ [`select.heating_program_${C}`]: { attributes: { options: ['auto', 'sick_day', 'home_office'] } } }), CFG);
  assert.deepEqual(x.programs.map((p) => p.name), ['Výchozí', 'sick_day', 'home_office']);
  assert.notEqual(x.programs[1].icon, x.programs[2].icon);
  // the sensor is unavailable: the select's state is the current program
  const w = world({ [`sensor.heating_program_${C}`]: { state: 'unavailable' }, [`select.heating_program_${C}`]: { state: 'vacation' } });
  assert.equal(programId(w, CFG), 'vacation');
  assert.equal(programView(w, CFG).current, 'vacation');
  assert.equal(programId(world({ [`sensor.heating_program_${C}`]: { state: 'unavailable' }, [`select.heating_program_${C}`]: { state: 'unavailable' } }), CFG), null);
  // no select at all: only the default program
  const bare = world(); delete bare.states[`select.heating_program_${C}`];
  assert.deepEqual(programView(bare, CFG).programs.map((p) => p.id), ['auto']);
});

test('programView: applying progress', () => {
  const ap = (trigger, left) => ({ [`sensor.heating_applying_${C}`]: { state: 'applying', attributes: { trigger, left } } });
  assert.deepEqual(programView(world(ap('program', 3)), CFG).applying, { trigger: 'program', name: 'Výchozí', progress: '0 ze 3' });
  const seven = normalizeConfig({ circuit: C, valves: [K, B, O, 'climate.a', 'climate.b', 'climate.c', 'climate.d'] });
  const v = programView(world(ap('program', 3)), seven);
  assert.equal(v.applying.progress, '4 ze 7');
  assert.equal(v.tiles.schedule.caption, 'zbytek se nastavuje');
  assert.equal(programView(world(ap('sync', 3)), seven).syncing, true);
  assert.equal(programView(world(), CFG).applying, null);
  assert.equal(programView(world(ap('other', 3)), CFG).applying, null);
  assert.match(programHtml(v), /Nastavuji hlavice podle programu <b>Výchozí<\/b> · 4 ze 7/);
  assert.match(programHtml(programView(world(ap('sync', 3)), seven)), /Srovnávám hlavice · 4 ze 7/);
});

test('programView: week, holidays, calendar, tiles', () => {
  const v = programView(world(), CFG);
  assert.equal(v.title, 'Přízemí');
  assert.equal(v.alternation, true);
  assert.equal(v.weekLabel, 'Teď lichý (45.)');
  assert.equal(v.holidays, 'calendar');
  assert.equal(v.calendar, 'calendar.holidays_cz');
  assert.deepEqual(v.calendars, [{ id: 'calendar.holidays_cz', name: 'Svátky ČR' }]);
  assert.equal(v.nextHoliday, '17. 11. Den boje za svobodu');
  assert.equal(v.tiles.schedule.value, '3 ze 3');
  assert.equal(v.tiles.schedule.caption, 'všechny');
  const off = programView(world({ [`sensor.heating_off_schedule_${C}`]: { state: '2' } }), CFG).tiles.schedule;
  assert.deepEqual(off, { value: '1 ze 3', caption: '2 mimo rozvrh' });
  const even = programView(world({ [`sensor.heating_schedule_${C}`]: { attributes: { week: 'even', week_number: 46, holidays_next: [] } } }), CFG);
  assert.equal(even.weekLabel, 'Teď sudý (46.)');
  assert.equal(even.nextHoliday, '');
  // missing helpers: rows hidden, no exception
  const bare = world();
  for (const id of Object.keys(bare.states)) if (/heating_(week|holiday|schedule)|^calendar\./.test(id)) delete bare.states[id];
  const b = programView(bare, CFG);
  assert.deepEqual([b.alternation, b.holidays, b.weekLabel, b.nextHoliday, b.calendars.length], [null, null, '', '', 0]);
  assert.doesNotMatch(programHtml(b), /data-act="alternation"|data-act="holidays"|data-act="calendar"/);
  // a calendar that is set but no longer exists stays selectable
  assert.equal(programView(world({ [`input_text.heating_holiday_calendar_${C}`]: { state: 'calendar.gone' } }), CFG).calendars.at(-1).id, 'calendar.gone');
});

test('whenText: today, yesterday, older', () => {
  const now = new Date(2026, 10, 8, 20, 0).getTime();
  const at = (d, h, m) => new Date(2026, 10, d, h, m).toISOString();
  assert.equal(whenText(at(8, 18, 2), now), 'dnes 18:02');
  assert.equal(whenText(at(7, 7, 5), now), 'včera 7:05');
  assert.equal(whenText(at(1, 9, 30), now), '1. 11. 9:30');
  assert.equal(whenText(undefined, now), '—');
  assert.equal(whenText('garbage', now), '—');
  assert.equal(programView(world(), CFG, now).tiles.changed.value, '—'); // the fixture has no last_changed
  const w = world(); w.states[`sensor.heating_program_${C}`].last_changed = at(8, 18, 2);
  assert.equal(programView(w, CFG, now).tiles.changed.value, 'dnes 18:02');
});

test('programHtml: one checked radio, calendar select only with holidays = calendar', () => {
  const html = programHtml(programView(world(), CFG));
  assert.equal((html.match(/role="radio"[^>]*aria-checked="true"/g) || []).length, 1);
  assert.equal((html.match(/role="radio"/g) || []).length, 2);
  assert.match(html, /<option value="calendar.holidays_cz" selected>/);
  const none = programHtml(programView(world({ [`input_select.heating_holidays_${C}`]: { state: 'none' } }), CFG));
  assert.doesNotMatch(none, /data-act="calendar"/);
  assert.match(none, /data-val="none"[^>]*aria-pressed="true"/);
  assert.match(none, /data-act="programs"/);
  assert.match(programParts(programView(world(), CFG)).head, /class="vd-title">Program</);
});

test('programView: missing select is read-only, unknown holidays press nothing, no calendar helper = no row', () => {
  const noSel = world(); delete noSel.states[`select.heating_program_${C}`];
  const v = programView(noSel, CFG);
  assert.equal(v.selectable, false);
  const html = programHtml(v);
  assert.match(html, /role="radio"[^>]* disabled/);
  assert.match(html, /Program nejde přepnout/);
  assert.doesNotMatch(programHtml(programView(world(), CFG)), /role="radio"[^>]* disabled/);
  for (const state of ['unavailable', 'unknown', '']) {
    const u = programView(world({ [`input_select.heating_holidays_${C}`]: { state } }), CFG);
    assert.equal(u.holidays, '');
    const h = programHtml(u);
    assert.doesNotMatch(h, /aria-pressed="true"/);
    assert.doesNotMatch(h, /data-act="calendar"/);
    assert.match(h, /data-act="holidays"/);
  }
  const noCal = world(); delete noCal.states[`input_text.heating_holiday_calendar_${C}`];
  assert.doesNotMatch(programHtml(programView(noCal, CFG)), /data-act="calendar"/);
  // a pending program is shown as current
  assert.equal(programView(world(), CFG, Date.now(), undefined, 'vacation').programs.find((p) => p.current).id, 'vacation');
});
