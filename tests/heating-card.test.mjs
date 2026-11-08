import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeConfig, valveView, circuitView, valvesSummary, gestureMap, zoneHandlers, nextTarget, cardHtml, fmt, plural } from '../dist/heating-card.js';

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
