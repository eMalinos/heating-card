import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clockText, settingsView, settingsHtml, numField, stepNum, outdoorSources, programView, programParts, programHtml, whenText, programId, normalizeConfig, valveView, circuitView, valvesSummary, gestureMap, zoneHandlers, nextTarget, cardHtml, valveDetail, chartModel, detailHtml, batteryText, fmt, plural, signalWord, controlValue, controlHtml, targetControl, snapTarget, RULER_PX, tempColor, stepOf, fmtTarget, currentTarget, valveGroups, valvePart, detailParts } from '../dist/heating-card.js';

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
  assert.equal(idle.state, 'Nečinný · 15,6 °C');
  assert.equal(idle.target, 21);
  assert.equal(idle.name, 'kitchen_valve');
  assert.equal(idle.off, false);
  assert.equal(view(valves({ demand: [K] })).phase, 'heat');
  assert.equal(view(valves({ demand: [K] })).state, 'Topí · 15,6 °C');
  assert.equal(view(valves({ phases: { [K]: ['fast'] }, demand: [K] })).phase, 'fast');
  assert.equal(view(valves({ phases: { [K]: ['fast'] } })).state, 'Rychlý start · 15,6 °C');
  assert.equal(view(valves({ phases: { [K]: ['run'] } })).phase, 'run');
  assert.equal(view(valves({ phases: { [K]: ['overrun'] } })).phase, 'run');
  assert.equal(view(valves({ phases: { [K]: ['overrun'] } })).state, 'Doběh · 15,6 °C');
  assert.equal(view(valves({ phases: { [K]: ['closed'] }, demand: [K] })).phase, 'closed');
  // the first item of a phase row is the phase; a missing valve is `normal`
  assert.equal(view(valves({ phases: { [K]: ['normal', 'since', 21, false] }, demand: [K] })).phase, 'heat');
  assert.equal(view(valves({ phases: {}, demand: [] })).phase, 'idle');
});

test('valveView: window and circuit off are disabled', () => {
  const w = view({ [`sensor.heating_off_schedule_${C}`]: { attributes: { window_open_climates: [K] } }, ...valves({ demand: [K], phases: { [K]: ['fast'] } }) });
  assert.equal(w.phase, 'window');
  assert.equal(w.off, true);
  assert.equal(w.state, 'Okno otevřené · 15,6 °C');
  const off = view({ [`binary_sensor.heating_active_${C}`]: { state: 'off' }, ...valves({ demand: [K] }) });
  assert.equal(off.phase, 'off');
  assert.equal(off.off, true);
  assert.equal(off.state, 'Vypnuto · 15,6 °C');
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
  assert.deepEqual([c(bw).rule, c(time).rule], ['weather', 'time']);
  assert.match(cardHtml(world(time), CFG), />Čas</);
  assert.match(cardHtml(world(bw), CFG), />Počasí</);

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
  assert.equal(nextTarget({ ...v, step: 0.1 }, {}, 1, now), 21.1);
  // step: the circuit's helper, else 0.5 (the valve's target_temp_step 0.1 is ignored)
  const kw = (p) => valveView(world(p), CFG, K).step;
  assert.equal(kw({}), 0.5);
  assert.equal(kw({ [`input_number.heating_target_step_${C}`]: { state: '0.2' } }), 0.2);
  assert.equal(kw({ [`input_number.heating_target_step_${C}`]: { state: 'unavailable' } }), 0.5);
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
    assert.equal(v.state, 'Stav neznámý · 15,6 °C');
    assert.equal(circuitView(world(unk(s)), CFG).subtitle, 'Stav neznámý');
  }
  assert.equal(view(unk('on')).off, false);
  // a missing sensor too; mode off keeps its own text
  const gone = world();
  delete gone.states[`binary_sensor.heating_active_${C}`];
  assert.equal(valveView(gone, CFG, K).state, 'Stav neznámý · 15,6 °C');
  const modeOff = { ...unk('unavailable'), [`input_select.heating_mode_${C}`]: { state: 'off' } };
  assert.equal(view(modeOff).state, 'Vypnuto · 15,6 °C');
  assert.equal(circuitView(world(modeOff), CFG).subtitle, 'Vypnuto · hlavice na 5 °C');
  assert.equal(view(unk('off')).state, 'Vypnuto · 15,6 °C');
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
  assert.equal(detail({ ...base, [`input_number.heating_window_reminder_${C}`]: { state: 'unknown' } }).alert.text, ' · hlavice netopí, dokud se okno nezavře.'); // no reminder set
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
  assert.deepEqual(m.labels.map((l) => l.text), ['12:00', '18:00', '8. 11.', '6:00', '12:00']);
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

test('chartModel: the recorder drops min / max, so the limits come from the state; phases span the chart', () => {
  const end = Date.parse('2026-11-08T12:00:00');
  const h = (n) => (end - n * 3600000) / 1000;
  // like the real history: no min_temp / max_temp; 21 °C, fast start 6 h ago at 30, a window 4 h ago at 5, back to 21 at 2 h
  const rows = [21, 30, 5, 21].map((t, i) => ({ lu: h([24, 6, 4, 2][i]), a: { current_temperature: 19, temperature: t } }));
  const ph = (p) => ({ phases: { [K]: [p], 'climate.other': ['fast'] } });
  const phaseRows = [{ lu: h(30), a: ph('normal') }, { lu: h(6), a: ph('fast') }, { lu: h(5), a: ph('run') }, { lu: h(4.5), a: ph('overrun') }, { lu: h(3), a: ph('closed') }, { lu: h(2), a: ph('normal') }];
  const m = chartModel(rows, [], end, 24, end, { lim: { min_temp: 4, max_temp: 30 }, phaseRows, climate: K });
  assert.deepEqual(m.ticks.map((t) => t.text), ['18,5°', '19°', '19,5°', '20°', '20,5°', '21°', '21,5°']); // neither 30 nor 5 stretches it
  assert.equal(m.minor.length, 6); // helper lines at the quarters
  const wide = chartModel([{ lu: h(24), a: { current_temperature: 19.2, temperature: 21 } }, { lu: h(2), a: { current_temperature: 23.9 } }], [], end);
  assert.deepEqual(wide.ticks.map((t) => t.text), ['19°', '20°', '21°', '22°', '23°', '24°']); // over 4 °C: whole degrees
  // a narrow span: labels every half degree, helpers at the quarters
  const narrow = chartModel([{ lu: h(24), a: { current_temperature: 20.1, temperature: 20.5 } }, { lu: h(2), a: { current_temperature: 21 } }], [], end);
  assert.deepEqual(narrow.ticks.map((t) => t.text), ['19,5°', '20°', '20,5°', '21°', '21,5°']);
  assert.equal(narrow.minor.length, 4);
  assert.deepEqual(m.phases, [{ k: 'fast', x: 330, w: 18.3 }, { k: 'run', x: 348.3, w: 36.7 }, { k: 'closed', x: 385, w: 18.3 }]); // run + overrun merge
  const html = detailHtml(detail({}), m);
  assert.match(html, /viewBox="0 0 440 170"/); assert.match(html, /<rect class="ph-band ln-fast" x="330" y="10" width="18.3" height="134">/);
  assert.match(html, /lg ln-fast"><\/i>rychlý start/); assert.match(html, /lg ln-run"><\/i>doběh/);
  const plain = chartModel(rows.slice(0, 1), [], end);
  assert.deepEqual(plain.phases, []); assert.doesNotMatch(detailHtml(detail({}), plain), /ph-band/);
});

test('signalWord', () => {
  assert.deepEqual([-55, -70, -71, -85, -86].map(signalWord), ['Silný', 'Silný', 'OK', 'OK', 'Slabý']);
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

// ---- Settings dialog (#446) ----
const sv = (tab, patch = {}, cfg = CFG, ctx = { sources: ['sensor.outdoor_temperature'] }, now = new Date(2026, 10, 8, 18, 40).getTime()) => settingsView(world(patch), cfg, tab, ctx, now);
const flat = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

test('normalizeConfig: condensing_boiler', () => {
  assert.equal(normalizeConfig({ circuit: C, valves: [K] }).condensing_boiler, true);
  assert.equal(normalizeConfig({ circuit: C, valves: [K], condensing_boiler: false }).condensing_boiler, false);
  assert.equal(normalizeConfig({ circuit: C, valves: [K], condensing_boiler: 'no' }).condensing_boiler, true);
});

test('numField reads value, unit, min, max, step; a missing helper is absent', () => {
  const f = numField(world(), `input_number.heating_weather_threshold_${C}`, { label: 'x', icon: 'p' });
  assert.deepEqual([f.value, f.text, f.unit, f.min, f.max, f.step, f.help], [15, '15,0', '°C', 5, 25, 0.5, 'Krok 0,5 °C']);
  assert.equal(numField(world(), 'input_number.nope'), null);
  assert.equal(numField(world({ 'input_number.x': { state: 'unavailable' } }), 'input_number.x'), null);
  // a pending value is shown while it is fresh, dropped after PENDING_MS
  const id = `input_number.heating_weather_threshold_${C}`;
  assert.equal(numField(world(), id, {}, { [id]: { v: 16, at: 1000 } }, 2000).value, 16);
  assert.equal(numField(world(), id, {}, { [id]: { v: 16, at: 1000 } }, 7000).value, 15);
});

test('numField: off(value) shows Vypnuto without a unit; fast start is off below 0, 0 stays a value', () => {
  const id = 'input_number.f';
  const at = (v) => world({ [id]: { state: String(v), attributes: { min: -0.1, max: 3, step: 0.1, unit_of_measurement: '°C' } } });
  const def = { off: (v) => v < 0 };
  const off = numField(at(-0.1), id, def);
  assert.deepEqual([off.off, off.text, off.unit], [true, 'Vypnuto', '']);
  const zero = numField(at(0), id, def);
  assert.deepEqual([zero.off, zero.text, zero.unit], [false, '0,0', '°C']);
  // one − step from 0,0 reaches off, one + step from off is 0,0 again
  assert.equal(stepNum(zero, -1), -0.1);
  assert.equal(stepNum(off, 1), 0);
  assert.equal(numField(at(-0.1), id).off, false); // no off rule: a plain number
});

test('settings Kotel / Okna: the shipped off rules (fast below 0, overrun 0, reminder 0); the hint only where min reaches off', () => {
  const set = (n, v, min = 0) => ({ [`input_number.${n}_${C}`]: { state: String(v), attributes: { min, max: 30, step: n.includes('delta') ? 0.1 : 1, unit_of_measurement: n.includes('delta') ? '°C' : 'min' } } });
  const kotel = sv('boiler', { ...set('heating_fast_start_delta', -0.1, -0.1), ...set('heating_bypass_overrun', 0) });
  const by = (label) => kotel.fields.find((f) => f.label === label);
  assert.deepEqual([by('Rychlý start pod rozvrhem').text, by('Doběh čerpadla').text], ['Vypnuto', 'Vypnuto']);
  assert.match(by('Rychlý start pod rozvrhem').help, /Pod 0 = vypnuto/);
  assert.match(settingsHtml(kotel), /class="soft field is-off"/);
  assert.match(settingsHtml(kotel), /class="p-fast is-off"/); // the phase strip dims fast start too
  assert.doesNotMatch(settingsHtml(sv('boiler')), /p-fast is-off/);
  const old = sv('boiler', set('heating_fast_start_delta', 0));
  assert.equal(old.fields[0].text, '0,0');
  assert.doesNotMatch(old.fields[0].help, /Pod 0/); // helper min 0: off is out of reach
  assert.equal(sv('windows', set('heating_window_reminder', 0)).fields.find((f) => f.label.startsWith('Připomenout')).text, 'Vypnuto');
});

test('stepNum: step, clamp, no float noise', () => {
  assert.equal(stepNum({ value: 15, step: 0.5, min: 5, max: 25 }, 1), 15.5);
  assert.equal(stepNum({ value: 25, step: 0.5, min: 5, max: 25 }, 1), 25);
  assert.equal(stepNum({ value: 5, step: 0.5, min: 5, max: 25 }, -1), 5);
  assert.equal(stepNum({ value: 0.3, step: 0.1, min: 0, max: 2 }, 1), 0.4);
  assert.equal(stepNum({ value: 10, step: 1, min: 1, max: 30 }, 1), 11);
});

test('settingsView: tabs, Kotel only with condensing_boiler, unknown tab = rule', () => {
  assert.deepEqual(sv('rule').tabs.map((t) => t.id), ['rule', 'boiler', 'windows', 'other']);
  const noBoiler = normalizeConfig({ circuit: C, valves: [K], condensing_boiler: false });
  assert.deepEqual(sv('rule', {}, noBoiler).tabs.map((t) => t.id), ['rule', 'windows', 'other']);
  assert.equal(sv('boiler', {}, noBoiler).tab, 'rule');
  assert.equal(sv('nope').tab, 'rule');
  assert.match(settingsHtml(sv('rule', {}, noBoiler)), /class="seg tabs "/);
  assert.match(settingsHtml(sv('rule')), /class="seg tabs four"/);
  assert.equal(sv('rule').title, 'Přízemí');
});

test('settings Pravidlo: weather rule, alert texts, source picker', () => {
  const v = sv('rule');
  assert.equal(v.rule, 'weather');
  assert.deepEqual(v.fields.map((f) => [f.label, f.value]), [['Topit pod venkovní teplotou', 15]]);
  assert.equal(v.alert.level, 'success');
  assert.equal(v.alert.text, 'Venku -24,4 °C, pod 15 °C – kotel smí v režimu Počasí topit.');
  assert.equal(v.source.value, 'sensor.outdoor_temperature');
  assert.deepEqual(v.source.options, [{ id: 'sensor.outdoor_temperature', label: 'Venkovní teploměr · 6,2 °C' }]);
  assert.equal(v.source.help, 'sensor.outdoor_temperature · společné pro všechny okruhy');
  const off = sv('rule', { [`sensor.heating_weather_ok_${C}`]: { state: 'off' }, [`sensor.heating_outdoor_temperature_${C}`]: { state: '20' } });
  assert.deepEqual(off.alert, { level: 'info', text: 'Venku 20,0 °C, nad 15 °C – v režimu Počasí kotel teď netopí.' });
  assert.equal(sv('rule', { [`sensor.heating_weather_ok_${C}`]: { state: 'unavailable' } }).alert, null);
  const html = settingsHtml(v);
  assert.match(html, /<b>Počasí<\/b> topit/);
  assert.match(html, /data-act="rule" data-val="weather"[^>]*aria-pressed="true"/);
  assert.match(html, /<select class="pick fval t" data-act="pick" data-id="input_text.heating_outdoor_temperature_source"/);
  assert.match(html, /data-act="num" data-id="input_number.heating_weather_threshold_circuit_demo" data-d="-1"/);
  // a source that is not in the candidates is kept as the selected option; no helper = no picker
  const odd = sv('rule', { 'input_text.heating_outdoor_temperature_source': { state: 'weather.home' }, 'weather.home': { state: 'sunny', attributes: { temperature: 3.5, friendly_name: 'Doma' } } });
  assert.deepEqual(odd.source.options.map((o) => o.id), ['sensor.outdoor_temperature', 'weather.home']);
  assert.equal(odd.source.options[1].label, 'Doma · 3,5 °C');
  const none = world(); delete none.states['input_text.heating_outdoor_temperature_source'];
  assert.equal(settingsView(none, CFG, 'rule', {}).source, null);
});

test('settings Pravidlo: time rule', () => {
  const v = sv('rule', { [`input_select.heating_auto_rule_${C}`]: { state: 'time' }, [`input_datetime.heating_time_from_${C}`]: { state: '06:00:00' }, [`input_datetime.heating_time_to_${C}`]: { state: '22:00:00' } });
  assert.equal(v.rule, 'time');
  assert.deepEqual(v.times.map((t) => [t.label, t.value]), [['Topit od', '06:00'], ['Topit do', '22:00']]);
  assert.equal(v.alert.text, 'Je 18:40, mezi 06:00 a 22:00 – kotel smí v režimu Počasí topit.');
  const html = settingsHtml(v);
  assert.match(html, /<input class="pick fval t" type="time" value="06:00" data-act="pick" data-id="input_datetime.heating_time_from_circuit_demo"/);
  assert.doesNotMatch(html, /data-act="num"/);
  const noTimes = world(); delete noTimes.states[`input_datetime.heating_time_to_${C}`];
  assert.equal(settingsView(noTimes, CFG, 'rule', {}).times.length, 1);
});

test('settings Pravidlo: time rule off alert and the clock in the HA time zone', () => {
  const t = { [`input_select.heating_auto_rule_${C}`]: { state: 'time' }, [`input_datetime.heating_time_from_${C}`]: { state: '06:00:00' }, [`input_datetime.heating_time_to_${C}`]: { state: '22:00:00' }, [`sensor.heating_weather_ok_${C}`]: { state: 'off' } };
  const night = Date.UTC(2026, 10, 8, 22, 10); // 23:10 in Prague (CET)
  const w = world(t); w.config = { time_zone: 'Europe/Prague' };
  assert.equal(settingsView(w, CFG, 'rule', {}, night).alert.text, 'Je 23:10, mimo 06:00–22:00 – v režimu Počasí kotel teď netopí.');
  assert.equal(clockText({ config: { time_zone: 'Asia/Tokyo' } }, Date.UTC(2026, 10, 8, 12, 0)), '21:00');
  assert.equal(clockText({ config: { time_zone: 'Nope/Zone' } }, 0), clockText({}, 0)); // unknown zone: the browser's
  assert.equal(clockText({ config: { time_zone: 'UTC' } }, Date.UTC(2026, 10, 8, 0, 5)), '00:05'); // h23, no 24:05
});

test('settings Kotel: fields in order, phase counts', () => {
  const v = sv('boiler');
  assert.deepEqual(v.fields.map((f) => f.label), ['Rychlý start pod rozvrhem', 'Kotel topí pro hlavici otevřenou od', 'Zavřít doběh nad rozvrhem', 'Doběh čerpadla', 'Kontrola po uvolnění hlavice']);
  assert.deepEqual(v.fields.map((f) => [f.text, f.unit]), [['0,3', '°C'], ['30', '%'], ['0,5', '°C'], ['10', 'min'], ['10', 'min']]);
  assert.equal(v.now, 'Hlavice teď: žádná netopí.');
  const busy = sv('boiler', valves({ phases: { [K]: ['fast'], [B]: ['overrun'], [O]: ['normal'] }, demand: [K, O] }));
  assert.equal(busy.now, 'Hlavice teď: 1 rychlý start, 1 topí, 1 doběh.');
  // matches the tiles: a valve with an open window or a circuit that is off is in no phase
  const win = sv('boiler', { ...valves({ phases: { [K]: ['fast'], [B]: ['normal'], [O]: ['normal'] }, demand: [K, B] }), [`sensor.heating_off_schedule_${C}`]: { attributes: { window_open_climates: [K] } } });
  assert.equal(win.now, 'Hlavice teď: 1 topí.');
  assert.equal(sv('boiler', { ...valves({ phases: { [K]: ['fast'] }, demand: [K] }), [`binary_sensor.heating_active_${C}`]: { state: 'off' } }).now, 'Hlavice teď: žádná netopí.');
  const two = sv('boiler', valves({ phases: { [K]: ['normal'], [B]: ['normal'], [O]: ['run'] }, demand: [K, B] }));
  assert.equal(two.now, 'Hlavice teď: 2 topí, 1 doběh.');
  const html = settingsHtml(busy);
  assert.match(html, /class="phase"/);
  assert.equal((html.match(/data-act="num"/g) ?? []).length, 10);
  // a missing helper hides its field
  const poor = world(); delete poor.states[`input_number.heating_bypass_overrun_${C}`];
  assert.equal(settingsView(poor, CFG, 'boiler', {}).fields.length, 4);
});

test('settings Okna: reminder and one row per valve', () => {
  const win = (name, open) => ({ entity_id: `binary_sensor.${name}`, name: `Okno ${name}`, state: open ? 'on' : 'off', open });
  const v = sv('windows', { [`sensor.heating_off_schedule_${C}`]: { attributes: { windows: { [K]: [win('terasa', false), win('jih', false)], [B]: [win('balkon', true)] } } } });
  assert.equal(v.fields[0].label, 'Připomenout otevřené okno po');
  assert.equal(v.fields[0].text, '15');
  assert.deepEqual(v.rows.map((r) => [r.count, r.windows.map((w) => [w.text, w.open])]), [
    [2, [['Okno terasa', false], ['Okno jih', false]]], [1, [['Okno balkon', true]]], [0, []]]);
  const html = settingsHtml(v);
  assert.match(html, /<span class="open">Okno balkon · otevřené<\/span>/);
  assert.match(flat(html), /Okno terasa · Okno jih/);
  assert.match(html, /bez okenního čidla/);
  assert.match(html, /Okna k hlavicím přiřadíš v aplikaci Homecraft/);
  assert.doesNotMatch(html, /data-act="pick"/); // read only apart from the reminder
});

test('settings Ostatní: shared fields, channel, tiles', () => {
  const win = (n, open) => ({ entity_id: `binary_sensor.${n}`, name: `Okno ${n}`, state: open ? 'on' : 'off', open });
  const now = new Date(2026, 10, 8, 18, 40).getTime();
  const w = world({
    [`sensor.heating_off_schedule_${C}`]: { attributes: { windows: { [K]: [win('a', true), win('b', false)], [B]: [win('c', false)] } } },
    [`sensor.heating_low_batteries_${C}`]: { attributes: { low_battery: [{ climate: K, source: 'valve', state: 9 }, { climate: K, source: 'window', state: 8 }, { climate: O, source: 'valve', state: 5 }] } },
    [`switch.boiler_${C}`]: { state: 'off', attributes: { friendly_name: 'Kotel přízemí' } },
  });
  w.states[`switch.boiler_${C}`].last_changed = new Date(now - 12 * 60000).toISOString();
  const v = settingsView(w, CFG, 'other', {}, now);
  assert.deepEqual(v.fields.map((f) => [f.label, f.text, f.unit]), [['Slabá baterie pod', '30', '%'], ['Stavová zpráva svítí', '30', 's']]);
  assert.deepEqual(v.circuitFields, []); // no helper: no field
  const ws = world({ [`input_number.heating_target_step_${C}`]: { state: '0.1', attributes: { min: 0.1, max: 1, step: 0.1, unit_of_measurement: '°C' } } });
  const sv = settingsView(ws, CFG, 'other', {}, now);
  assert.deepEqual(sv.circuitFields.map((f) => [f.label, f.text]), [['Krok cíle hlavice', '0,1']]);
  assert.match(settingsHtml(sv), /Krok cíle hlavice/);
  assert.equal(v.channel, C);
  assert.deepEqual(v.tiles.map((t) => [t.label, t.value, t.caption]), [
    ['Hlavice', '3', '2 se slabou baterií'], ['Okenní čidla', '3', '1 otevřené'], ['Kotel', 'Kotel přízemí', 'vypnuto · 12 min'], ['Venku', '-24,4 °C', 'čidlo okruhu']]);
  const html = settingsHtml(v);
  assert.match(html, /Kanál notifikací/);
  assert.doesNotMatch(html.slice(html.indexOf('Kanál notifikací'), html.indexOf('Okruh')), /data-act/); // not clickable
  assert.equal(v.tiles.length, 4);
  // a sensor listed under two valves counts once
  const dup = world({ [`sensor.heating_off_schedule_${C}`]: { attributes: { windows: { [K]: [win('a', true)], [B]: [win('a', true), win('b', false)] } } } });
  const dv = settingsView(dup, CFG, 'other', {}, now);
  assert.deepEqual([dv.tiles[1].value, dv.tiles[1].caption], ['2', '1 otevřené']);
  assert.doesNotMatch(flat(html), /Verze/);
});

test('outdoorSources: temperature sensors and weather entities', () => {
  const w = world({ 'weather.home': { state: 'sunny' }, 'sensor.humidity': { attributes: { device_class: 'humidity' } } });
  assert.deepEqual(outdoorSources(w).sort(), ['sensor.heating_outdoor_temperature_circuit_demo', 'sensor.outdoor_temperature', 'weather.home']);
});

test('target control: kind, value under the pointer, markup', () => {
  assert.equal(targetControl(world({}), CFG), 'buttons');
  assert.equal(targetControl(world({ [`input_select.heating_target_control_${C}`]: { state: 'ruler' } }), CFG), 'ruler');
  assert.equal(targetControl(world({ [`input_select.heating_target_control_${C}`]: { state: 'bogus' } }), CFG), 'buttons');
  const v = { min: 5, max: 30, step: 0.5, now: 18.4 };
  assert.equal(snapTarget({ ...v, step: 0.1 }, 20.04), 20);
  assert.equal(snapTarget(v, 40), 30);
  // track: the box fraction
  assert.deepEqual([0, 0.5, 1, 1.4, 0.61].map((fx) => controlValue('track', v, { fx })), [5, 17.5, 30, 30, 20.5]);
  // ruler: dragging left raises the value, one °C per RULER_PX
  assert.equal(controlValue('ruler', v, { dx: -RULER_PX * 2, t0: 20 }), 22);
  assert.equal(controlValue('ruler', v, { dx: RULER_PX / 2, t0: 20 }), 19.5);
  assert.equal(controlValue('ruler', v, { dx: 1, t0: 21.3 }), 21.3); // a jitter keeps an off-step target
  assert.equal(controlValue('ruler', v, { dx: -RULER_PX / 2, t0: 21.3 }), 21.8);
  // arc: 135° (bottom left) = min, top = middle, 45° (bottom right) = max; the bottom gap goes to the nearer end
  const at = (deg, r = 96) => ({ fx: (140 + r * Math.cos((deg * Math.PI) / 180)) / 280, fy: (112 + r * Math.sin((deg * Math.PI) / 180)) / 214 });
  assert.equal(controlValue('arc', v, at(135)), 5);
  assert.equal(controlValue('arc', v, at(270)), 17.5);
  assert.equal(controlValue('arc', v, at(45)), 30);
  assert.equal(controlValue('arc', v, at(100)), 5);
  assert.equal(controlValue('arc', v, at(80)), 30);
  for (const k of ['arc', 'ruler', 'track']) assert.ok(controlHtml(k, v, 20.5).length > 100, k);
  // design v8: the target and its − / + live in the box
  assert.match(controlHtml('arc', v, 20.5), /Cíl<\/div><b>20,5<\/b><div class="lbl">°C · teď 18,4/);
  for (const k of ['arc', 'ruler', 'track']) assert.equal((controlHtml(k, v, 20.5).match(/data-act="step"/g) ?? []).length, 2, k);
  assert.match(controlHtml('ruler', v, 20.5), /class="tv-big" style="color: rgb[^"]+">20,5/);
  assert.match(controlHtml('track', v, 20.5), /class="tv-mid">20,5/);
  assert.match(controlHtml('ruler', v, 20.5), /translateX\(-744px\)/); // (20.5 - 5) * 48
  assert.match(controlHtml('track', v, 20.5), /tr-knob" style="left: 62%/);
  assert.equal(controlHtml('track', v, null), '');
});

test('settings Ostatní: the target control picker only with its helper', () => {
  assert.equal(settingsView(world({}), CFG, 'other').control, null);
  const w = world({ [`input_select.heating_target_control_${C}`]: { state: 'arc' } });
  const v = settingsView(w, CFG, 'other');
  assert.equal(v.control, 'arc');
  const html = settingsHtml(v);
  assert.match(html, /data-act="control" data-val="arc" data-k="control:arc" aria-pressed="true" class="cbtn on"><svg class="cpic"[^]*?<span>Oblouk<\/span>/);
  assert.match(html, /data-val="buttons"[^>]*aria-pressed="false" class="cbtn"><svg class="cpic"[^]*?<span>Tlačítka<\/span>/);
});

test('settings Ostatní: the tile layout picker only with its helper', () => {
  assert.equal(settingsView(world({}), CFG, 'other').layout, null);
  const v = settingsView(world({ [`input_select.heating_tile_layout_${C}`]: { state: 'stack' } }), CFG, 'other');
  assert.equal(v.layout, 'stack');
  assert.match(settingsHtml(v), /data-act="tiles" data-val="stack" data-k="tiles:stack" aria-pressed="true" class="cbtn on"><svg class="cpic"[^]*?<span>Pod ikonou<\/span>/);
  assert.equal(settingsView(world({ [`input_select.heating_tile_layout_${C}`]: { state: 'weird' } }), CFG, 'other').layout, 'side');
});

test('tempColor: fixed to the temperature, a fill never stretches it', () => {
  assert.equal(tempColor(5), 'rgb(16,38,102)');
  assert.equal(tempColor(7.5), 'rgb(29,76,161)'); // 5 → 9 °C: a visibly lighter blue
  assert.equal(tempColor(2), tempColor(5));
  assert.equal(tempColor(21), 'rgb(232,89,44)');
  assert.equal(tempColor(30), 'rgb(96,6,16)');
  assert.equal(tempColor(40), 'rgb(96,6,16)');
  const v = { min: 5, max: 30, step: 0.5, now: 18.4 };
  // 12 °C: every arc piece is blue (no amber / orange / red), the same colours as the first pieces at 25 °C
  const strokes = (t) => [...controlHtml('arc', v, t).matchAll(/stroke="(rgb[^"]+)"/g)].map((m) => m[1]);
  assert.ok(strokes(12).every((c) => { const [r, , b] = c.slice(4, -1).split(',').map(Number); return b > r + 60; }));
  assert.deepEqual(strokes(25).slice(0, strokes(12).length), strokes(12));
  // track: the same gradient whatever the value, only its clip moves
  const bg = (t) => /tr-fill" style="background: ([^;]+);/.exec(controlHtml('track', v, t))[1];
  assert.equal(bg(12), bg(25));
});

test('stepOf, fmtTarget, currentTarget', () => {
  assert.deepEqual([stepOf(0.2), stepOf(0), stepOf(-1), stepOf(null), stepOf(NaN)], [0.2, 0.5, 0.5, 0.5, 0.5]);
  assert.equal(valveView(world({ [`input_number.heating_target_step_${C}`]: { state: '0' } }), CFG, K).step, 0.5);
  assert.deepEqual([fmtTarget(21.25, 0.25), fmtTarget(21, 0.5), fmtTarget(21, 1), fmtTarget(null)], ['21,25', '21,0', '21,0', '–']);
  const v = { climate: K, target: 21 };
  assert.equal(currentTarget(v, {}, 1000), 21);
  assert.equal(currentTarget(v, { [K]: { t: 22, at: 1000 } }, 1100), 22);
  assert.equal(currentTarget(v, { [K]: { t: 21, at: 1000 } }, 1100), 21); // hass reported it
  assert.equal(currentTarget(v, { [K]: { t: 22, at: 1000 } }, 1000 + 5001), 21); // expired
});

test('chartModel: forced targets (max / min) leave the line and the y scale; 72 h is 3× wide; nothing past now', () => {
  const end = Date.parse('2026-11-08T12:00:00');
  const h = (n) => (end - n * 3600000) / 1000;
  const a = (cur, t) => ({ current_temperature: cur, temperature: t, min_temp: 5, max_temp: 30 });
  const rows = [{ lu: h(24), a: a(19, 20) }, { lu: h(12), a: a(19.5, 30) }, { lu: h(10), a: a(20.5, 21) }, { lu: h(6), a: a(20, 5) }, { lu: h(4), a: a(19.8, 21) }];
  const m = chartModel(rows, [], end);
  assert.deepEqual(m.ticks.map((t) => t.text), ['18,5°', '19°', '19,5°', '20°', '20,5°', '21°', '21,5°']); // no 5° … 30°
  assert.equal((m.target.match(/M/g) ?? []).length, 3); // three pieces around the two forced spans
  assert.match(m.target, /^M0 \S+ H220 M256\.7 /); // stops where 30 starts, resumes at 21
  const wide = chartModel(rows, [], end + 24 * 3600000, 72, end);
  assert.equal(wide.w, 1320);
  assert.match(wide.current, / L880 [\d.]+$/); // the last value holds until now (2/3 of 72 h), not to the end
});

// HFB heating use_parts: sensor.heating_parts_<c> with attribute parts = {id: name}.
const parts = (p) => ({ [`sensor.heating_parts_${C}`]: { state: String(Object.keys(p).length), attributes: { parts: p } } });
const PV = ['climate.flat1_bathroom_valve', 'climate.flat2_kitchen_valve', 'climate.hall_valve', 'climate.flat1_bedroom_valve'];
const PCFG = normalizeConfig({ circuit: C, valves: PV });

test('valveGroups: no sensor, empty or bad parts -> one unnamed group', () => {
  for (const w of [world(), world(parts({})), world({ [`sensor.heating_parts_${C}`]: { state: '1', attributes: { parts: 'x' } } })]) {
    assert.deepEqual(valveGroups(w, PCFG), [{ name: '', valves: PV }]);
  }
});

test('valveGroups: one group per part in key order, part-less valves last under Ostatní', () => {
  assert.deepEqual(valveGroups(world(parts({ flat1: 'Babi', flat2: 'Máma' })), PCFG), [
    { name: 'Babi', valves: ['climate.flat1_bathroom_valve', 'climate.flat1_bedroom_valve'] },
    { name: 'Máma', valves: ['climate.flat2_kitchen_valve'] },
    { name: 'Ostatní', valves: ['climate.hall_valve'] },
  ]);
});

test('valveGroups: the longest matching id wins; empty groups are skipped', () => {
  const cfg = normalizeConfig({ circuit: C, valves: ['climate.flat_a_valve', 'climate.flat_b_valve'] });
  assert.deepEqual(valveGroups(world(parts({ flat: 'Byt', flat_a: 'A', none: 'Nic' })), cfg), [
    { name: 'Byt', valves: ['climate.flat_b_valve'] },
    { name: 'A', valves: ['climate.flat_a_valve'] },
  ]);
});

test('valveGroups: an empty part name falls back to its id; no valve in any part -> one unnamed group', () => {
  assert.deepEqual(valveGroups(world(parts({ flat1: '', flat2: 'Máma' })), PCFG).map((g) => g.name), ['flat1', 'Máma', 'Ostatní']);
  assert.deepEqual(valveGroups(world(parts({ flat3: 'Teta' })), PCFG), [{ name: '', valves: PV }]);
});

test('valvePart: the part name after the valve name in its dialog; none outside a part', () => {
  const w = world(parts({ flat: 'Byt', flat1: 'Babi' }));
  assert.equal(valvePart(w, PCFG, 'climate.flat1_bathroom_valve'), 'Babi');
  assert.equal(valvePart(w, PCFG, 'climate.hall_valve'), '');
  assert.equal(valvePart(world(), PCFG, 'climate.flat1_bathroom_valve'), '');
  assert.match(detail(parts({ kitchen: 'Máma' })).part, /^Máma$/);
  assert.match(detailParts(detail(parts({ kitchen: 'Máma' }))).head, /<h2 class="vd-title">[^<]* \(Máma\)<\/h2>/);
  assert.doesNotMatch(detailParts(detail({})).head, /\(/);
});

test('cardHtml: part headings only for a circuit with parts', () => {
  const html = cardHtml(world(parts({ flat1: 'Babi', flat2: 'Máma' })), PCFG);
  assert.deepEqual([...html.matchAll(/<div class="gh">([^<]*)<\/div>/g)].map((m) => m[1]), ['Babi', 'Máma', 'Ostatní']);
  assert.equal((html.match(/class="grid"/g) ?? []).length, 3);
  assert.equal((html.match(/class="tile/g) ?? []).length, 4);
  const plain = cardHtml(world(), PCFG);
  assert.ok(!plain.includes('class="gh"'));
  assert.equal((plain.match(/class="grid"/g) ?? []).length, 1);
});
