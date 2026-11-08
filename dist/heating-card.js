/**
 * heating-card — one heating circuit for Home Assistant, in the Homecraft look.
 * Box 1: the circuit (flame circle + outdoor temperature, status message, mode, program / off-schedule panel).
 * Box 2: the valves (tiles with an icon circle by phase, state line, − target +).
 * It reads only the entities the ha-features-builder `heating` feature publishes.
 * https://github.com/eMalinos/heating-card
 */

const VERSION = '0.1.0';

const GESTURES = ['tap', 'double_tap', 'hold', 'icon_tap', 'icon_double_tap', 'icon_hold', 'none'];
const HOLD_MS = 500;
const DOUBLE_MS = 250;
const STEP = 0.5;

// MDI paths (@mdi/js 7.4.47), copied so the card has no dependency.
const ICON = {
  fire: 'M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 14.97 5.12 15.47 5.29 15.97C5.43 16.57 5.7 17.17 6 17.7C7.08 19.43 8.95 20.67 10.96 20.92C13.1 21.19 15.39 20.8 17.03 19.32C18.86 17.66 19.5 15 18.56 12.72L18.43 12.46C18.22 12 17.66 11.2 17.66 11.2M14.5 17.5C14.22 17.74 13.76 18 13.4 18.1C12.28 18.5 11.16 17.94 10.5 17.28C11.69 17 12.4 16.12 12.61 15.23C12.78 14.43 12.46 13.77 12.33 13C12.21 12.26 12.23 11.63 12.5 10.94C12.69 11.32 12.89 11.7 13.13 12C13.9 13 15.11 13.44 15.37 14.8C15.41 14.94 15.43 15.08 15.43 15.23C15.46 16.05 15.1 16.95 14.5 17.5H14.5Z',
  pipe: 'M22 13V21H20V19H16.58C15.81 20.76 14.05 22 12 22S8.19 20.76 7.42 19H4V21H2V13H4V15H7.43C7.93 13.85 8.85 12.93 10 12.42V11H8V9H16V11H14V12.42C15.15 12.93 16.07 13.85 16.57 15H20V13H22M17 2H7C6.45 2 6 2.45 6 3S6.45 4 7 4H10V5H11V8H13V5H14V4H17C17.55 4 18 3.55 18 3S17.55 2 17 2Z',
  closed: 'M22 2V22H20V13H14.82A3 3 0 0 1 9.18 13H4V22H2V2H4V11H9.18A3 3 0 0 1 14.82 11H20V2Z',
  window: 'M21 20V2H3V20H1V23H23V20M19 4V11H17V4M5 4H7V11H5M5 20V13H7V20M9 20V4H15V20M17 20V13H19V20Z',
  battery: 'M14 20H6V6H14M14.67 4H13V2H7V4H5.33C4.6 4 4 4.6 4 5.33V20.67C4 21.4 4.6 22 5.33 22H14.67C15.4 22 16 21.4 16 20.67V5.33C16 4.6 15.4 4 14.67 4M21 7H19V13H21V8M21 15H19V17H21V15Z',
};

// Texts as in library/heating/src/heating_texts.jinja (ui.valve_*, ui.hero_*).
const T = {
  phase: { heat: 'Topí', fast: 'Rychlý start', run: 'Doběh', closed: 'Zavřeno', idle: 'Nečinný', window: 'Okno otevřené', off: 'Vypnuto' },
  source: { valve: 'hlavice', window: 'okno', other: 'čidlo' },
};

export const fmt = (n, d = 0) => Number(n).toLocaleString('cs-CZ', { minimumFractionDigits: d, maximumFractionDigits: d });

// Czech plural: 1 / 2-4 / 5+ and 0.
export const plural = (n, one, few, many) => `${n} ${n === 1 ? one : n >= 2 && n <= 4 ? few : many}`;

const num = (v) => { const x = Number.parseFloat(v); return Number.isFinite(x) ? x : null; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function normalizeConfig(config) {
  if (!config?.circuit || typeof config.circuit !== 'string') throw new Error('heating-card: circuit is required');
  const valves = config.valves;
  if (!Array.isArray(valves) || !valves.length) throw new Error('heating-card: valves must be a non-empty list of climate entities');
  const bad = valves.find((v) => typeof v !== 'string' || !v.startsWith('climate.'));
  if (bad !== undefined) throw new Error(`heating-card: valves must be climate.* entities (got ${bad})`);
  const schedule = config.schedule_gesture ?? 'tap';
  const info = config.info_gesture ?? 'icon_tap';
  for (const [k, g] of [['schedule_gesture', schedule], ['info_gesture', info]]) {
    if (!GESTURES.includes(g)) throw new Error(`heating-card: ${k} must be one of ${GESTURES.join(', ')}`);
  }
  if (schedule === info && schedule !== 'none') throw new Error('heating-card: schedule_gesture and info_gesture must differ');
  return { circuit: config.circuit, valves: [...valves], heading: config.heading || '', schedule_gesture: schedule, info_gesture: info };
}

const st = (hass, id) => hass.states?.[id]?.state;
const at = (hass, id, k) => hass.states?.[id]?.attributes?.[k];

// The `<domain>.<name>_<circuit>` entity id.
const eid = (cfg, domain, name) => `${domain}.${name}_${cfg.circuit}`;

// One valve tile: phase (window > off > fast > run > closed > heat > idle), state line, battery rows.
export function valveView(hass, cfg, climate) {
  const attrs = hass.states?.[climate]?.attributes ?? {};
  const windowOpen = (at(hass, eid(cfg, 'sensor', 'heating_off_schedule'), 'window_open_climates') ?? []).includes(climate);
  const active = st(hass, eid(cfg, 'binary_sensor', 'heating_active')) !== 'off';
  const raw = at(hass, eid(cfg, 'sensor', 'heating_valves'), 'phases')?.[climate]?.[0] ?? 'normal';
  const inDemand = (at(hass, eid(cfg, 'sensor', 'heating_valves'), 'demand') ?? []).includes(climate);
  const phase = windowOpen ? 'window' : !active ? 'off'
    : raw === 'fast' ? 'fast' : raw === 'run' || raw === 'overrun' ? 'run' : raw === 'closed' ? 'closed' : inDemand ? 'heat' : 'idle';
  const now = num(attrs.current_temperature);
  const lowBattery = (at(hass, eid(cfg, 'sensor', 'heating_low_batteries'), 'low_battery') ?? [])
    .filter((r) => r.climate === climate).map((r) => ({ source: r.source, state: r.state }));
  let state = T.phase[phase] + (now == null ? '' : ` · ${fmt(now, 1)} °C`);
  if (lowBattery.length === 1) state = `Baterie ${lowBattery[0].state} %`;
  else if (lowBattery.length > 1) {
    const rows = lowBattery.map((b) => `${T.source[b.source] ?? T.source.other} ${b.state} %`).join(' · ');
    state = rows.charAt(0).toUpperCase() + rows.slice(1);
  }
  return {
    climate, name: attrs.friendly_name || climate.split('.')[1], phase, state, now, target: num(attrs.temperature),
    min: num(attrs.min_temp) ?? 5, max: num(attrs.max_temp) ?? 30,
    off: phase === 'window' || phase === 'off', lowBattery,
  };
}

// Box 1: header subtitle, mode + hint, status, program, off-schedule count, applying, outdoor value.
export function circuitView(hass, cfg) {
  const e = (d, n) => eid(cfg, d, n);
  const mode = st(hass, e('input_select', 'heating_mode'));
  const boilerOn = st(hass, e('switch', 'boiler')) === 'on';
  const demandList = at(hass, e('sensor', 'heating_valves'), 'demand') ?? [];
  const demand = cfg.valves.filter((v) => demandList.includes(v)).length;
  const left = num(at(hass, e('sensor', 'heating_valves'), 'left')) ?? 0;
  const demandText = demand === 0 ? 'žádná hlavice netopí'
    : demand === 1 ? '1 hlavice chce teplo' : `${demand} ${demand < 5 ? 'hlavice chtějí' : 'hlavic chce'} teplo`;
  const subtitle = mode === 'off' ? 'Vypnuto · hlavice na 5 °C'
    : boilerOn ? `Kotel topí · ${demandText}`
      : left > 0 ? `Kotel netopí · doběh čerpadla, ještě ${left} min` : 'Kotel netopí';

  let hint = '';
  if (mode === 'on') hint = 'podle rozvrhu';
  else if (mode === 'off') hint = 'hlavice na 5 °C';
  else if (mode === 'by_weather') {
    if (st(hass, e('input_select', 'heating_auto_rule')) === 'time') {
      const f = String(st(hass, e('input_datetime', 'heating_time_from')) ?? '').slice(0, 5);
      const t = String(st(hass, e('input_datetime', 'heating_time_to')) ?? '').slice(0, 5);
      hint = /^\d\d:\d\d$/.test(f) && /^\d\d:\d\d$/.test(t) ? `${f}–${t} každý den` : 'nastav čas od–do';
    } else {
      const x = num(st(hass, e('input_number', 'heating_weather_threshold'))) ?? 0;
      hint = `pod ${fmt(x, Number.isInteger(x) ? 0 : 1)} °C venku`;
    }
  }

  // input_text.heating_status: "level|text", level success / warning / error, anything else is info
  const rawStatus = st(hass, e('input_text', 'heating_status')) ?? '';
  const m = /^(success|warning|error|info)\|([\s\S]*)$/.exec(rawStatus);
  const text = (m ? m[2] : rawStatus).trim();
  const status = text && !['unknown', 'unavailable'].includes(text) ? { level: m ? m[1] : 'info', text } : null;

  const programId = st(hass, e('sensor', 'heating_program')) ?? st(hass, e('select', 'heating_program'));
  const programName = at(hass, e('sensor', 'heating_program'), 'program_names')?.[programId] ?? programId ?? '';
  const ap = e('sensor', 'heating_applying');
  return {
    title: cfg.heading || at(hass, e('binary_sensor', 'heating_state'), 'title') || cfg.circuit,
    boilerOn, subtitle, demand, mode, hint, status, programName,
    offSchedule: num(st(hass, e('sensor', 'heating_off_schedule'))) ?? 0,
    applying: { on: st(hass, ap) === 'applying', trigger: at(hass, ap, 'trigger'), left: num(at(hass, ap, 'left')) ?? 0 },
    outdoor: num(st(hass, e('sensor', 'heating_outdoor_temperature'))),
  };
}

// Box 2 header: `N topí · N okno · N baterie` (zero okno / baterie are left out).
export function valvesSummary(views) {
  const heat = views.filter((v) => v.phase === 'heat' || v.phase === 'fast').length;
  const win = views.filter((v) => v.phase === 'window').length;
  const bat = views.filter((v) => v.lowBattery.length).length;
  return [`${heat} topí`, win && plural(win, 'okno', 'okna', 'oken'), bat && plural(bat, 'baterie', 'baterie', 'baterií')].filter(Boolean).join(' · ');
}

// Gesture zones of a tile from the config: {body: {tap, double_tap, hold}, icon: {...}} -> 'schedule' | 'info'.
// An icon without its own gesture falls back to the body's.
export function gestureMap(cfg) {
  const zones = { body: {}, icon: {} };
  for (const [action, g] of [['schedule', cfg.schedule_gesture], ['info', cfg.info_gesture]]) {
    if (g === 'none') continue;
    zones[g.startsWith('icon_') ? 'icon' : 'body'][g.replace('icon_', '')] = action;
  }
  return zones;
}

const svg = (path, size, extra = '') => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" ${extra}><path d="${path}"></path></svg>`;
const stroke = (path, size, w = 2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" aria-hidden="true"><path d="${path}"></path></svg>`;
const spinner = '<svg class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9" stroke-linecap="round"></path></svg>';
const LEVEL_ICON = {
  success: stroke('M5 12l5 5L20 7', 16, 2.2),
  info: stroke('M12 11v6M12 7.5v.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 16),
  warning: stroke('M12 9v5M12 17.5v.01M12 3 2 20h20z', 16),
  error: stroke('M12 8v5M12 16.5v.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 16),
};
const MODES = [
  ['on', 'Zapnuto', svg(ICON.fire, 15, 'style="color:#E8592C"')],
  ['by_weather', 'Počasí', stroke('M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 2A3 3 0 0 0 7 18z', 15)],
  ['off', 'Vypnuto', stroke('M12 3v8M6.3 7.3a8 8 0 1 0 11.4 0', 15)],
];

const PHASE_DOT = { heat: 'heat', fast: 'hot', run: 'run', closed: 'idle', idle: 'idle', window: 'dis', off: 'dis' };
const PHASE_ICON = { heat: ICON.fire, fast: ICON.fire, run: ICON.pipe, closed: ICON.closed, idle: ICON.fire, window: ICON.window, off: ICON.fire };

function tileHtml(v) {
  const flame = v.phase === 'heat' || v.phase === 'fast';
  const cls = ['tile', flame && 'hot', v.off && 'off'].filter(Boolean).join(' ');
  const bat = v.lowBattery.length > 0;
  const fmtT = (t) => (t == null ? '–' : fmt(t, 1));
  return `<div class="${cls}" data-phase="${v.phase}">
  <div class="main dim" role="button" tabindex="0" data-valve="${esc(v.climate)}" data-k="m:${esc(v.climate)}">
    <span class="dot ${PHASE_DOT[v.phase]}" data-zone="icon">${svg(PHASE_ICON[v.phase], 20, flame ? 'class="flame"' : '')}${bat ? `<span class="badge blink">${svg(ICON.battery, 12)}</span>` : ''}</span>
    <div class="txt"><div class="name">${esc(v.name)}</div><div class="state${bat ? ' blink low' : ''}">${esc(v.state)}</div></div>
  </div>
  <div class="ctl">
    <button class="pm" data-act="step" data-valve="${esc(v.climate)}" data-d="-1" data-k="-:${esc(v.climate)}" aria-label="Snížit cíl"${v.off ? ' disabled' : ''}>${stroke('M6 12h12', 14, 2.4)}</button>
    <span class="dim val">${fmtT(v.target)} °C</span>
    <button class="pm" data-act="step" data-valve="${esc(v.climate)}" data-d="1" data-k="+:${esc(v.climate)}" aria-label="Zvýšit cíl"${v.off ? ' disabled' : ''}>${stroke('M6 12h12M12 6v12', 14, 2.4)}</button>
  </div>
</div>`;
}

export function cardHtml(hass, cfg) {
  const c = circuitView(hass, cfg);
  const views = cfg.valves.map((v) => valveView(hass, cfg, v));
  const syncing = c.applying.on && c.applying.trigger === 'sync';
  const programApplying = c.applying.on && c.applying.trigger === 'program';
  return `<div class="card">
  <div class="head">
    <div class="dot ${c.boilerOn ? 'heat' : 'idle'}">${svg(ICON.fire, 20, c.boilerOn ? 'class="flame"' : '')}</div>
    <div class="txt"><h2>${esc(c.title)}</h2><div class="sub">${esc(c.subtitle)}</div></div>
    ${c.outdoor == null ? '' : `<div class="live"><b>${fmt(c.outdoor, 1)}</b> <span class="unit">°C</span><small>venku teď</small></div>`}
  </div>
  ${c.status ? `<div class="alert ${c.status.level}" role="status">${LEVEL_ICON[c.status.level]}<span>${esc(c.status.text)}</span>
    <button class="x" data-act="clear" data-k="clear" aria-label="Zavřít zprávu">${stroke('M6 6l12 12M18 6 6 18', 14)}</button></div>` : ''}
  <div class="seg" role="group" aria-label="Režim topení">
    ${MODES.map(([val, label, icon]) => `<button data-act="mode" data-val="${val}" data-k="mode:${val}" aria-pressed="${c.mode === val}"${c.mode === val && c.hint ? ` title="${esc(c.hint)}"` : ''}${c.mode === val ? ' class="on"' : ''}>${icon}${label}</button>`).join('')}
  </div>
  <div class="soft panel">
    <div class="facts">
      <div><div class="lbl">Program</div><div class="v">${programApplying ? `<span class="applying">${spinner}Nastavuji… ${c.applying.left}</span>` : esc(c.programName || '–')}</div></div>
      <div><div class="lbl">Mimo rozvrh</div><div class="v">${c.offSchedule} <small>${c.offSchedule === 1 ? 'hlavice' : c.offSchedule >= 2 && c.offSchedule <= 4 ? 'hlavice' : 'hlavic'}</small></div></div>
    </div>
    <button class="sb" data-act="sync" data-k="sync"${syncing ? ' disabled' : ''}>${syncing ? spinner : ''}Srovnat</button>
  </div>
</div>
<div class="card">
  <div class="head2"><div class="h">Hlavice</div><div class="sub">${esc(valvesSummary(views))}</div></div>
  <div class="grid">${views.map(tileHtml).join('')}</div>
</div>`;
}

const STYLE = `
:host { display: flex; flex-direction: column; gap: 12px; --c-card: var(--hfb-card, var(--card-background-color, #fff)); --c-border: var(--hfb-border, var(--divider-color, #e0e0e0)); --c-fill: var(--hfb-fill, var(--secondary-background-color, #f0f2f5)); --c-text: var(--hfb-text, var(--primary-text-color, #1c2128)); --c-text2: var(--hfb-text-2, var(--secondary-text-color, #6e7682)); --c-accent: var(--hfb-accent, var(--primary-color, #4f6b8c)); --c-raised: var(--hfb-btn-raised-bg, var(--card-background-color, #fff)); --c-raised-sh: var(--hfb-btn-raised-shadow, none); --c-err: var(--error-color, #e5484d); color: var(--c-text); }
* { box-sizing: border-box; }
button { font: inherit; color: inherit; cursor: pointer; }
.card { background: var(--ha-card-background, var(--c-card)); border: 1px solid var(--c-border); border-radius: var(--ha-card-border-radius, var(--hfb-card-radius, 12px)); box-shadow: var(--ha-card-box-shadow, var(--hfb-card-shadow, none)); padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; }
.head { display: flex; align-items: center; gap: 10px; }
.txt { flex: 1; min-width: 0; }
h2 { margin: 0; font-size: 16px; font-weight: 500; }
.sub { font-size: 12px; color: var(--c-text2); }
.live { text-align: right; } .live b { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
.unit { font-size: 13px; font-weight: 500; color: var(--c-text2); } .live small { display: block; font-size: 11px; color: var(--c-text2); }
.dot { width: 36px; height: 36px; flex: none; border-radius: 50%; display: flex; align-items: center; justify-content: center; position: relative; }
.dot.heat { background: var(--hfb-heat-dot, linear-gradient(145deg, #FFA66E, #E8592C)); box-shadow: var(--hfb-heat-glow, 0 0 0 3px rgba(232,89,44,.14), 0 2px 6px rgba(232,89,44,.32)); color: var(--hfb-dot-on-icon, #fff); }
.dot.hot { background: var(--hfb-hot-dot, linear-gradient(145deg, #FF7A38, #CF3416)); box-shadow: var(--hfb-hot-glow, 0 0 0 4px rgba(214,58,28,.18), 0 0 14px rgba(214,58,28,.5)); color: var(--hfb-dot-on-icon, #fff); }
.dot.run { background: var(--hfb-run-dot, linear-gradient(145deg, color-mix(in srgb, var(--primary-color, #4f6b8c) 65%, #fff), var(--primary-color, #4f6b8c))); box-shadow: var(--hfb-run-glow, 0 2px 6px color-mix(in srgb, var(--primary-color, #4f6b8c) 40%, transparent)); color: var(--hfb-dot-on-icon, #fff); }
.dot.idle { background: var(--hfb-dot-idle, var(--card-background-color, #fff)); color: #607D8B; }
.dot.dis { background: var(--hfb-dot-idle, var(--card-background-color, #fff)); color: var(--disabled-text-color, #a9afb7); }
.alert { display: flex; align-items: center; gap: 10px; border-radius: 12px; padding: 6px 4px 6px 12px; font-size: 13px; --lv: var(--info-color, #039be5); background: color-mix(in srgb, var(--lv) var(--hfb-alert-tint, 12%), transparent); color: var(--lv); }
.alert.success { --lv: var(--success-color, #1e7a46); } .alert.warning { --lv: var(--warning-color, #b45309); } .alert.error { --lv: var(--error-color, #b42318); }
.alert svg { flex: none; } .alert span { flex: 1; }
.x { border: 0; background: transparent; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; color: inherit; }
.seg { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; padding: 4px; background: var(--hfb-seg-track, var(--secondary-background-color, #f0f2f5)); border-radius: 12px; }
.seg button { height: 34px; border: 0; border-radius: 9px; background: transparent; font-size: 13px; font-weight: 500; color: var(--c-text2); display: flex; align-items: center; justify-content: center; gap: 6px; }
.seg button.on { background: var(--hfb-seg-on, var(--card-background-color, #fff)); color: var(--hfb-seg-on-color, var(--primary-text-color, #1c2128)); font-weight: 600; box-shadow: var(--hfb-seg-on-shadow, none); }
.soft { background: var(--c-fill); border-radius: 14px; }
.panel { display: flex; align-items: center; gap: 12px; padding: 8px 8px 8px 14px; }
.facts { flex: 1; min-width: 0; display: flex; gap: 20px; }
.lbl { font-size: 11px; color: var(--c-text2); }
.v { font-size: 16px; font-weight: 700; } .v small { font-size: 12px; font-weight: 500; color: var(--c-text2); }
.applying { display: inline-flex; align-items: center; gap: 6px; }
.sb { height: 32px; border: 0; border-radius: 10px; background: var(--c-raised); box-shadow: var(--c-raised-sh); padding: 0 12px; font-size: 13px; font-weight: 500; display: inline-flex; align-items: center; gap: 6px; flex: none; }
.sb:disabled { opacity: .6; cursor: default; }
.head2 { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; } .head2 .h { font-size: 15px; font-weight: 600; }
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.tile { padding: 10px 8px 8px 10px; display: flex; flex-direction: column; gap: 8px; border-radius: 14px; background: var(--c-fill); }
.tile.hot { background: var(--hfb-hot-tile, color-mix(in srgb, #E8592C 8%, var(--secondary-background-color, #f0f2f5))); }
.main { display: flex; align-items: center; gap: 8px; cursor: pointer; outline-offset: 2px; touch-action: manipulation; user-select: none; -webkit-user-select: none; }
.name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.state { font-size: 12px; color: var(--c-text2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.state.low { color: var(--c-err); font-weight: 600; }
.ctl { display: flex; align-items: center; gap: 4px; background: var(--c-card); border-radius: 12px; padding: 2px; }
.val { flex: 1; text-align: center; font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
.pm { width: 36px; height: 36px; border: 0; border-radius: 10px; background: transparent; display: flex; align-items: center; justify-content: center; }
.pm:disabled { opacity: .4; cursor: default; }
.tile.off .dim { opacity: .5; filter: grayscale(1); }
.badge { position: absolute; right: -4px; bottom: -4px; width: 18px; height: 18px; border-radius: 50%; background: var(--c-err); color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 2px var(--c-fill); }
.flame { transform-origin: 50% 90%; animation: flame 1.4s ease-in-out infinite; }
@keyframes flame { 0%, 100% { transform: scale(1, 1) skewX(0); filter: brightness(1); } 25% { transform: scale(.94, 1.08) skewX(-3deg); filter: brightness(1.15); } 50% { transform: scale(1.04, .95) skewX(2deg); } 75% { transform: scale(.97, 1.05) skewX(-1deg); filter: brightness(1.1); } }
.blink { animation: blink 1.6s ease-in-out infinite; }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: .25; } }
.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .flame, .blink, .spin { animation: none; } }
dialog { border: 0; border-radius: 24px; padding: 0; width: min(560px, 94vw); max-height: 90vh; background: var(--c-card); color: var(--c-text); }
dialog::backdrop { background: rgba(0, 0, 0, .4); }
.dlg-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 12px 0 20px; font-size: 18px; font-weight: 500; }
.dlg-body { padding: 8px 12px 16px; }
.dlg-head .x { width: 40px; height: 40px; }
`;

class HeatingCard extends (globalThis.HTMLElement ?? class {}) {
  constructor() {
    super();
    this._g = null; // gesture in progress {valve, zone, timer, held}
    this._tap = null; // a tap waiting for a possible double tap {key, timer}
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `<style>${STYLE}</style><div class="wrap" style="display:contents"></div><dialog aria-label="Rozvrh"></dialog>`;
    this._wrap = this.shadowRoot.querySelector('.wrap');
    this._dlg = this.shadowRoot.querySelector('dialog');
    const root = this.shadowRoot;
    root.addEventListener('click', (e) => this._onClick(e));
    root.addEventListener('pointerdown', (e) => this._down(e));
    root.addEventListener('pointerup', () => this._up());
    root.addEventListener('pointercancel', () => this._cancel());
    root.addEventListener('keydown', (e) => this._key(e));
    this._dlg.addEventListener('click', (e) => { if (e.target === this._dlg) this._dlg.close(); });
    this._dlg.addEventListener('close', () => { this._dlg.replaceChildren(); this._sched = null; });
  }

  static getStubConfig() {
    return { circuit: 'heating_circuit_1', valves: ['climate.living_room_valve'] };
  }

  setConfig(config) {
    this._cfg = normalizeConfig(config);
    this._zones = gestureMap(this._cfg);
    this._html = null;
    if (this._hass) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._sched) this._sched.hass = hass;
    if (this._cfg) this._render();
  }

  getCardSize() {
    return 8;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  // Re-render only when the markup changed (keeps the flame animation and a gesture in progress),
  // and give the focus back to the same control.
  _render() {
    const html = cardHtml(this._hass, this._cfg);
    if (html === this._html) return;
    this._html = html;
    const k = this.shadowRoot.activeElement?.dataset?.k;
    this._wrap.innerHTML = html;
    if (k) this.shadowRoot.querySelector(`[data-k="${CSS.escape(k)}"]`)?.focus();
  }

  _call(domain, service, data) {
    return this._hass.callService(domain, service, data);
  }

  _onClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const c = this._cfg;
    const act = b.dataset.act;
    if (act === 'mode') this._call('input_select', 'select_option', { entity_id: eid(c, 'input_select', 'heating_mode'), option: b.dataset.val });
    else if (act === 'clear') this._call('input_text', 'set_value', { entity_id: eid(c, 'input_text', 'heating_status'), value: '' });
    else if (act === 'sync') this._call('input_button', 'press', { entity_id: `input_button.heating_sync_${c.circuit}` });
    else if (act === 'step') {
      const v = valveView(this._hass, c, b.dataset.valve);
      if (v.off || v.target == null) return;
      const t = Math.round(Math.min(v.max, Math.max(v.min, v.target + STEP * Number(b.dataset.d))) * 10) / 10;
      this._call('climate', 'set_temperature', { entity_id: v.climate, temperature: t });
    }
  }

  // Gestures on a tile: tap / double tap / hold on the body or the icon circle.
  _handlers(zone) {
    const z = this._zones;
    return Object.keys(z[zone]).length ? z[zone] : z.body;
  }

  _down(e) {
    const main = e.target.closest('.main');
    if (!main || e.button > 0) return;
    const zone = e.target.closest('[data-zone="icon"]') ? 'icon' : 'body';
    const g = { valve: main.dataset.valve, zone, held: false };
    const h = this._handlers(zone);
    if (h.hold) g.timer = setTimeout(() => { g.held = true; this._run(h.hold, g.valve); }, HOLD_MS);
    this._g = g;
  }

  _cancel() {
    if (this._g) clearTimeout(this._g.timer);
    this._g = null;
  }

  _up() {
    const g = this._g;
    this._cancel();
    if (!g || g.held) return;
    const h = this._handlers(g.zone);
    const key = `${g.valve}|${g.zone}`;
    if (this._tap && this._tap.key === key && h.double_tap) { // second tap in time
      clearTimeout(this._tap.timer);
      this._tap = null;
      this._run(h.double_tap, g.valve);
    } else if (h.double_tap) { // wait to see whether a second tap follows
      clearTimeout(this._tap?.timer);
      this._tap = { key, timer: setTimeout(() => { this._tap = null; if (h.tap) this._run(h.tap, g.valve); }, DOUBLE_MS) };
    } else if (h.tap) this._run(h.tap, g.valve);
  }

  _key(e) {
    const main = e.target.closest?.('.main');
    if (!main || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    const h = this._handlers(e.target.closest('[data-zone="icon"]') ? 'icon' : 'body');
    const a = h.tap || this._zones.body.tap || this._zones.icon.tap;
    if (a) this._run(a, main.dataset.valve);
  }

  _run(action, climate) {
    if (action === 'info') this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: climate }, bubbles: true, composed: true }));
    else this._openSchedule(climate);
  }

  // Until the valve dialog exists: the schedule card in a simple dialog.
  _openSchedule(climate) {
    const c = this._cfg;
    const body = document.createElement('div');
    body.className = 'dlg-body';
    if (customElements.get('heating-schedule-card')) {
      const el = document.createElement('heating-schedule-card');
      el.setConfig({ valve: climate, circuits: [{ id: c.circuit, valves: c.valves }], time_step: 15 });
      el.hass = this._hass;
      this._sched = el;
      body.append(el);
    } else body.textContent = 'Karta heating-schedule-card není nainstalovaná.';
    const head = document.createElement('div');
    head.className = 'dlg-head';
    head.innerHTML = `<span>Rozvrh</span><button class="x" aria-label="Zavřít">${stroke('M6 6l12 12M18 6 6 18', 20)}</button>`;
    head.querySelector('button').addEventListener('click', () => this._dlg.close());
    this._dlg.replaceChildren(head, body);
    this._dlg.showModal();
  }
}

if (globalThis.customElements && !customElements.get('heating-card')) {
  customElements.define('heating-card', HeatingCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: 'heating-card', name: 'Heating Card', description: 'One heating circuit: mode, program and valves (Homecraft look).' });
  console.info(`%c HEATING-CARD %c ${VERSION} `, 'color:#fff;background:#E8592C', '');
}

export { HeatingCard, VERSION };
