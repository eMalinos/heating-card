**English** · [Čeština](README.cs.md)

# Heating Card

A Home Assistant card for one heating circuit, in the Homecraft look: a circuit box (flame circle, outdoor temperature, status message, mode, program and valves off schedule) and a valves box (a tile per valve with its phase, state and − target +). It is the UI of the `homecraft` heating theme of [ha-features-builder](https://github.com/eMalinos/ha-features-builder) and reads only the entities that its `heating` feature publishes. Written in Czech.

![Card](docs/card.png)

## Installation

**HACS (custom repository):** HACS → ⋮ → Custom repositories → `https://github.com/eMalinos/heating-card`, type **Dashboard** → download **Heating Card** → reload the browser.

**Manual:** copy [`dist/heating-card.js`](dist/heating-card.js) to your Home Assistant `config/www/` folder and add it as a dashboard resource (Settings → Dashboards → ⋮ → Resources → URL `/local/heating-card.js?v=0.1.0-beta.4`, type **JavaScript module**). Change `?v=` after copying a new version.

## Configuration

The ha-features-builder `heating` feature writes this config. By hand:

```yaml
type: custom:heating-card
circuit: heating_circuit_1        # the heating instance id
valves:                            # the circuit's valves
  - climate.living_room_valve
  - climate.bedroom_valve
heading: Topení přízemí            # optional; default: binary_sensor.heating_state_<circuit> attribute title, else the id
schedule_gesture: tap              # opens the schedule card for the valve
info_gesture: icon_tap             # opens the valve dialog
```

Gestures are `tap`, `double_tap`, `hold`, `icon_tap`, `icon_double_tap`, `icon_hold` or `none` (the same values as the heating parameters); the two must differ unless both are `none`.

Entities read (`<c>` is the circuit): `switch.boiler_<c>`, `input_select.heating_mode_<c>`, `input_select.heating_auto_rule_<c>`, `input_datetime.heating_time_from_<c>` / `_to_<c>`, `input_number.heating_weather_threshold_<c>`, `input_text.heating_status_<c>`, `sensor.heating_program_<c>`, `sensor.heating_applying_<c>`, `sensor.heating_schedule_<c>`, `input_boolean.heating_week_alternation_<c>`, `input_select.heating_holidays_<c>`, `input_text.heating_holiday_calendar_<c>`, every `calendar.*`, `select.heating_program_<c>`, `sensor.heating_off_schedule_<c>`, `sensor.heating_valves_<c>`, `sensor.heating_low_batteries_<c>`, `binary_sensor.heating_active_<c>`, `binary_sensor.heating_state_<c>`, `sensor.heating_outdoor_temperature_<c>` and each valve's `climate` entity.

Actions: the mode segments call `input_select.select_option`, the cross on the status message clears `input_text.heating_status_<c>`, **Srovnat** presses `input_button.heating_sync_<c>`, − / + change a valve's target by 0.5 °C (not on a valve with an open window or while the circuit is off). The settings and statistics dialogs come later; `schedule_gesture` opens `heating-schedule-card` in a simple dialog.

## Valve dialog

`info_gesture` opens the valve dialog (a bottom sheet under 600 px): the valve's icon circle (blinking battery badge when a battery is low), one alert under the header (the open window with minutes open and the reminder, else every low battery of the valve), the current temperature with the valve position, the target stepper (disabled with an open window or while the circuit is off), a 24 h chart of the room and target temperature with the open-window spans as tinted bands, the *Hlavice* tiles (battery, signal, valve position, calibration; the battery tile turns red and blinks when low), one row per window sensor (*Okna*) with its state and its own battery, and the footer: **Kalibrovat** (after a confirm, runs `script.heating_calibrate_<c>` with `climate`) and **Rozvrh** (the schedule dialog). The header's history button opens the valve's more-info. A window sensor that is `unavailable` / `unknown` shows *Čidlo nedostupné*, never *Zavřené*.

Device facts (battery, signal, valve position, calibration) are found on the valve's device by device class / entity id suffix, like the Mushroom detail does; windows come from the `windows` attribute of `sensor.heating_off_schedule_<c>`; the reminder from `input_number.heating_window_reminder_<c>`; the low-battery threshold from `input_number.heating_low_battery_threshold` (30 % by default). The chart reads the history over `history/history_during_period`; without history the dialog shows a note instead.

![Valve dialog, low batteries](docs/valve-battery.png) ![Valve dialog, open window](docs/valve-window.png)

## Program dialog

The **Program** button in box 1 opens the program dialog (a bottom sheet under 600 px): the circuit's programs as a radio list (tap = switch right away through `select.heating_program_<c>`; the current one is raised with a check), one alert while Node-RED applies the program or a sync (`Nastavuji hlavice podle programu … · 4 ze 7`), the *Týdny a svátky* section (week alternation switch = `input_boolean.heating_week_alternation_<c>`, *Svátky jako všední den / neděle* = `input_select.heating_holidays_<c>`, and with *neděle* a calendar select writing `input_text.heating_holiday_calendar_<c>` plus the next holiday), tiles *Hlavic podle rozvrhu* and *Program změněn*, and the footer: **Srovnat hlavice** and **Upravit programy** (opens the schedule dialog, where programs are edited). Names come from `program_names` of `sensor.heating_program_<c>`; the program options from `select.heating_program_<c>`; week and next holiday from `sensor.heating_schedule_<c>`. A missing helper hides its row.

![Program dialog](docs/program-dialog.png)

## Look

Colours, radii and shadows come from the `--hfb-*` tokens of the [Homecraft style](https://github.com/eMalinos/ha-features-builder/blob/main/docs/style-homecraft.md), each with a Home Assistant theme fallback, so the card follows any theme. The card surface honours `--ha-card-background`, `--ha-card-box-shadow` and `--ha-card-border-radius`. Flame flicker and the low-battery blink stop with the system's reduce-motion setting.

## Tests

```sh
node --test tests/*.test.mjs                      # pure logic: config, valveView, circuitView, valveDetail, chartModel
python3 -m http.server 8766 &
"Google Chrome" --headless=new --virtual-time-budget=30000 --dump-dom http://localhost:8766/tests/dom.html | grep RESULT   # prints RESULT OK
```

`tests/dom.html` renders the card with a fake `hass` built from `tests/fixtures/states.json` (real entity shapes from the dev HA, `circuit_demo`). Looks: `?theme=homecraft`, `?theme=dark`, none (HA fallbacks); add `&shot=1` for a screenshot and `&vd=dress` / `&vd=kids` to open the valve dialog (battery / open-window board).

## Changelog

- **0.1.0-beta.4** — program dialog (box 1 *Program* button): program list, applying progress, week alternation, holidays and calendar, *Srovnat hlavice* / *Upravit programy*; generic dialog frame for the settings and statistics dialogs.
- **0.1.0-beta.3** — tiles, soft panels and window rows read `--hfb-tile-bg` / `-border` / `-shadow` / `-radius`, so they follow Bento's inner tile style.
- **0.1.0-beta.2** — valve dialog (batteries, windows, 24 h chart, calibrate); `info_gesture` opens it instead of more-info.
- **0.1.0** — circuit and valves boxes.

## License

MIT
