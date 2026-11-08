[English](README.md) · **Čeština**

# Heating Card

Karta pro Home Assistant, která zobrazuje jeden topný okruh v stylu Homecraft: box okruhu (kruh s plamenem, venkovní teplota, stavová zpráva, režim, program a hlavice mimo rozvrh) a box hlavic (dlaždice s fází, stavem a − cílová teplota +). Je to rozhraní tématu `homecraft` pro topení v [ha-features-builder](https://github.com/eMalinos/ha-features-builder) a čte jen entity, které feature `heating` zveřejňuje.

![Karta](docs/card.png)

## Instalace

**HACS (vlastní repozitář):** HACS → ⋮ → Vlastní repozitáře → `https://github.com/eMalinos/heating-card`, typ **Dashboard** → stáhnout **Heating Card** → obnovit prohlížeč.

**Ručně:** zkopíruj [`dist/heating-card.js`](dist/heating-card.js) do `config/www/` a přidej ho jako zdroj dashboardu (Nastavení → Dashboardy → ⋮ → Zdroje → URL `/local/heating-card.js?v=0.1.0-beta.5`, typ **JavaScript module**). Po zkopírování nové verze změň `?v=`.

## Konfigurace

Konfiguraci zapisuje feature `heating` z ha-features-builder. Ručně:

```yaml
type: custom:heating-card
circuit: heating_circuit_1        # id instance topení
valves:                            # hlavice okruhu
  - climate.living_room_valve
  - climate.bedroom_valve
heading: Topení přízemí            # volitelné; výchozí: atribut title u binary_sensor.heating_state_<okruh>, jinak id
schedule_gesture: tap              # otevře kartu rozvrhu pro hlavici
info_gesture: icon_tap             # otevře dialog hlavice
condensing_boiler: true            # false skryje záložku Kotel v dialogu nastavení
```

`condensing_boiler` (boolean, výchozí `true`; cokoli kromě `false` platí jako `true`) říká, zda má okruh kondenzační kotel; bez něj dialog nastavení nemá záložku *Kotel*.

Gesta: `tap`, `double_tap`, `hold`, `icon_tap`, `icon_double_tap`, `icon_hold` nebo `none` (stejné hodnoty jako parametry topení); obě musí být různá, pokud nejsou obě `none`.

Akce: segmenty režimu volají `input_select.select_option`, křížek u stavové zprávy ji smaže, **Srovnat** stiskne `input_button.heating_sync_<okruh>`, − / + mění cílovou teplotu hlavice o 0,5 °C (ne u hlavice s otevřeným oknem ani při vypnutém okruhu). Dialog statistik přijde později; `schedule_gesture` otevře `heating-schedule-card` v jednoduchém dialogu.

## Dialog hlavice

`info_gesture` otevře dialog hlavice (pod 600 px jako spodní list): ikona hlavice (blikající odznak baterie při slabé baterii), pod hlavičkou jediné upozornění (otevřené okno s minutami a připomínkou, jinak všechny slabé baterie hlavice), aktuální teplota s polohou ventilu, krokování cíle (zakázané při otevřeném okně nebo vypnutém okruhu), graf teploty a cíle za 24 h s úseky otevřeného okna jako tónovanými pásy, dlaždice *Hlavice* (baterie, signál, ventil, kalibrace; slabá baterie je červená a bliká), řádek pro každé okno (*Okna*) se stavem a vlastní baterií a patička: **Kalibrovat** (po potvrzení spustí `script.heating_calibrate_<okruh>` s `climate`) a **Rozvrh**. Tlačítko historie v hlavičce otevře more-info hlavice. Čidlo okna `unavailable` / `unknown` ukáže *Čidlo nedostupné*, nikdy *Zavřené*.

## Dialog programu

Tlačítko **Program** v prvním boxu otevře dialog programu (pod 600 px jako spodní list): programy okruhu jako seznam (klepnutí = okamžité přepnutí přes `select.heating_program_<okruh>`; aktuální je zvýrazněný s fajfkou), jedno upozornění, dokud Node-RED nastavuje hlavice (`Nastavuji hlavice podle programu … · 4 ze 7`), sekce *Týdny a svátky* (přepínač střídání týdnů = `input_boolean.heating_week_alternation_<okruh>`, *Svátky jako všední den / neděle* = `input_select.heating_holidays_<okruh>`, u *neděle* výběr kalendáře zapisující `input_text.heating_holiday_calendar_<okruh>` a další svátek), dlaždice *Hlavic podle rozvrhu* a *Program změněn* a patička: **Srovnat hlavice** a **Upravit programy** (otevře dialog rozvrhu, kde se programy upravují). Názvy jsou z `program_names` senzoru `sensor.heating_program_<okruh>`, nabídka programů ze `select.heating_program_<okruh>`, týden a další svátek ze `sensor.heating_schedule_<okruh>`. Chybějící helper skryje svůj řádek.

## Dialog nastavení

Tlačítko **Nastavení** v prvním boxu otevře dialog nastavení (pod 600 px jako spodní list) se čtyřmi záložkami; každé nastavení je měkký panel s ikonou, popiskem, hodnotou a − / + (nebo nativním výběrem). Změny platí hned, nic se neukládá; rychlá klepnutí na − / + se sčítají, dokud Home Assistant nahlásí hodnotu.

- **Pravidlo**: co řídí režim *Počasí*. Jedno upozornění říká, co pravidlo teď rozhoduje (`sensor.heating_weather_ok_<okruh>`). *Venkovní teplota* = `input_number.heating_weather_threshold_<okruh>` a výběr zdroje venkovní teploty (`input_text.heating_outdoor_temperature_source`, společný pro všechny okruhy; každý `sensor.*` s device class teplota a každé `weather.*`); *Čas* = dva výběry času (`input_datetime.heating_time_from_<okruh>` / `_to_<okruh>`). Pravidlo je `input_select.heating_auto_rule_<okruh>`.
- **Kotel** (jen s `condensing_boiler`): pás fází (rychlý start, topí, doběh, kontrola) a `heating_fast_start_delta_<okruh>`, `heating_bypass_threshold_<okruh>`, `heating_close_margin_<okruh>`, `heating_bypass_overrun_<okruh>`, `heating_release_check_<okruh>`, plus kolik hlavic je teď v jaké fázi (`sensor.heating_valves_<okruh>`).
- **Okna**: `heating_window_reminder_<okruh>` a, jen pro čtení, okenní čidla každé hlavice (přiřazují se v aplikaci Homecraft).
- **Ostatní**: `input_number.heating_low_battery_threshold` a `input_number.heating_status_duration` (společné), kanál notifikací (id okruhu, nastavuje se v aplikaci) a dlaždice hlavic, okenních čidel, relé kotle a venkovní teploty.

Min, max, krok a jednotka každého čísla se berou z jeho `input_number`. Chybějící helper skryje své pole. Otevřený výběr ani výběr času aktualizace hass nepřestaví; změna se projeví po jeho zavření.

![Dialog nastavení: Pravidlo, Kotel, Okna, Ostatní](docs/settings-dialog.png)

## Vzhled

Barvy, zaoblení a stíny se berou z tokenů `--hfb-*` ze [stylu Homecraft](https://github.com/eMalinos/ha-features-builder/blob/main/docs/style-homecraft.md), každý s náhradou z motivu Home Assistantu, takže karta sleduje libovolný motiv. Plamen a blikání slabé baterie se zastaví podle systémového nastavení omezení pohybu.

## Testy

```sh
node --test tests/*.test.mjs
python3 -m http.server 8766 &
"Google Chrome" --headless=new --virtual-time-budget=30000 --dump-dom http://localhost:8766/tests/dom.html | grep RESULT
```

## Licence

MIT
