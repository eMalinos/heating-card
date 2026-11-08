**English** · [Čeština](README.cs.md)

# Heating Card

A Home Assistant card for one heating circuit, in the Homecraft look: a circuit box (flame circle, outdoor temperature, status message, mode, program and valves off schedule) and a valves box (a tile per valve with its phase, state and − target +). It is the UI of the `homecraft` heating theme of [ha-features-builder](https://github.com/eMalinos/ha-features-builder) and reads only the entities that its `heating` feature publishes. Written in Czech.

![Card](docs/card.png)

## Installation

**HACS (custom repository):** HACS → ⋮ → Custom repositories → `https://github.com/eMalinos/heating-card`, type **Dashboard** → download **Heating Card** → reload the browser.

**Manual:** copy [`dist/heating-card.js`](dist/heating-card.js) to your Home Assistant `config/www/` folder and add it as a dashboard resource (Settings → Dashboards → ⋮ → Resources → URL `/local/heating-card.js?v=0.1.0`, type **JavaScript module**). Change `?v=` after copying a new version.

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
info_gesture: icon_tap             # opens the valve's more-info
```

Gestures are `tap`, `double_tap`, `hold`, `icon_tap`, `icon_double_tap`, `icon_hold` or `none` (the same values as the heating parameters); the two must differ unless both are `none`.

Entities read (`<c>` is the circuit): `switch.boiler_<c>`, `input_select.heating_mode_<c>`, `input_select.heating_auto_rule_<c>`, `input_datetime.heating_time_from_<c>` / `_to_<c>`, `input_number.heating_weather_threshold_<c>`, `input_text.heating_status_<c>`, `sensor.heating_program_<c>`, `sensor.heating_applying_<c>`, `sensor.heating_off_schedule_<c>`, `sensor.heating_valves_<c>`, `sensor.heating_low_batteries_<c>`, `binary_sensor.heating_active_<c>`, `binary_sensor.heating_state_<c>`, `sensor.heating_outdoor_temperature_<c>` and each valve's `climate` entity.

Actions: the mode segments call `input_select.select_option`, the cross on the status message clears `input_text.heating_status_<c>`, **Srovnat** presses `input_button.heating_sync_<c>`, − / + change a valve's target by 0.5 °C (not on a valve with an open window or while the circuit is off). The valve dialog, program, settings and statistics dialogs come later; until then `schedule_gesture` opens `heating-schedule-card` in a simple dialog.

## Look

Colours, radii and shadows come from the `--hfb-*` tokens of the [Homecraft style](https://github.com/eMalinos/ha-features-builder/blob/main/docs/style-homecraft.md), each with a Home Assistant theme fallback, so the card follows any theme. The card surface honours `--ha-card-background`, `--ha-card-box-shadow` and `--ha-card-border-radius`. Flame flicker and the low-battery blink stop with the system's reduce-motion setting.

## Tests

```sh
node --test tests/*.test.mjs                      # pure logic: config, valveView, circuitView
python3 -m http.server 8766 &
"Google Chrome" --headless=new --virtual-time-budget=30000 --dump-dom http://localhost:8766/tests/dom.html | grep RESULT   # prints RESULT OK
```

`tests/dom.html` renders the card with a fake `hass` built from `tests/fixtures/states.json` (real entity shapes from the dev HA, `circuit_demo`). Looks: `?theme=homecraft`, `?theme=dark`, none (HA fallbacks); add `&shot=1` for a screenshot.

## License

MIT
