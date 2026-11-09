[English](README.md) · **Čeština**

# Heating Card

Karta pro Home Assistant, která zobrazuje jeden topný okruh v stylu Homecraft: box okruhu (kruh s plamenem, venkovní teplota, stavová zpráva, režim, program a hlavice mimo rozvrh) a box hlavic (dlaždice s fází, stavem a − cílová teplota +). Je to rozhraní tématu `homecraft` pro topení v [ha-features-builder](https://github.com/eMalinos/ha-features-builder) a čte jen entity, které feature `heating` zveřejňuje.

![Karta](docs/card.png)

## Instalace

**HACS (vlastní repozitář):** HACS → ⋮ → Vlastní repozitáře → `https://github.com/eMalinos/heating-card`, typ **Dashboard** → stáhnout **Heating Card** → obnovit prohlížeč.

**Ručně:** zkopíruj [`dist/heating-card.js`](dist/heating-card.js) do `config/www/` a přidej ho jako zdroj dashboardu (Nastavení → Dashboardy → ⋮ → Zdroje → URL `/local/heating-card.js?v=0.1.7`, typ **JavaScript module**). Po zkopírování nové verze změň `?v=`.

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

Prostřední segment režimu se jmenuje *Čas* (ikona hodin) místo *Počasí*, když je pravidlo (`input_select.heating_auto_rule_<okruh>`) `time`.

Akce: segmenty režimu volají `input_select.select_option`, křížek u stavové zprávy ji smaže, **Srovnat** stiskne `input_button.heating_sync_<okruh>`, − / + mění cílovou teplotu hlavice o krok z `input_number.heating_target_step_<okruh>` (Nastavení › Ostatní › Krok cíle hlavice; bez něj 0,5 °C; ne u hlavice s otevřeným oknem ani při vypnutém okruhu). Dialog statistik přijde později; `schedule_gesture` otevře `heating-schedule-card` v jednoduchém dialogu.

### Části okruhu

Když je okruh rozdělený na části (HFB heating 1.16 s `use_parts`, např. jeden kotel pro dva byty), dlaždice hlavic jsou seskupené podle části pod jejím názvem ze `sensor.heating_parts_<okruh>`; hlavice bez části jsou na konci pod *Ostatní*. Bez toho senzoru vypadá box jako dřív. Žádné nastavení karty není potřeba.

## Dialog hlavice

`info_gesture` otevře dialog hlavice (pod 600 px jako spodní list): ikona hlavice (blikající odznak baterie při slabé baterii), pod hlavičkou jediné upozornění (otevřené okno s minutami a připomínkou, jinak všechny slabé baterie hlavice), aktuální teplota, krokování cíle (zakázané při otevřeném okně nebo vypnutém okruhu) a pod ním posuvník, když je `input_select.heating_target_control_<okruh>` (Nastavení › Ostatní › Ovladač cíle) `arc`, `ruler` nebo `track` (tažení; šipky po kroku; jedno `set_temperature` po puštění; barvy patří teplotě: 5 °C tmavě modrá, 9 modrá, 12 světle modrá, 17 jantarová, 21 oranžová, 25 červená, 30 tmavě rudá), graf teploty a cíle za 24 h (osa °C vlevo) v okně 24 h, které jde posunout až 7 dní zpět (tažením do stran po celých hodinách, ‹ › po 6 h, *Teď* zpět na teď; půlnoc má popisek s datem), s úseky otevřeného okna jako tónovanými pásy a rychlými starty / doběhy hlavice (`phases` ze `sensor.heating_valves_<okruh>`) jako proužky dole, s legendou, dlaždice *Hlavice* (baterie, signál slovy — Silný ≥ −70 dBm, OK ≥ −85, Slabý pod tím — s hodnotou v dBm, ventil, kalibrace; slabá baterie je červená a bliká), řádek pro každé okno (*Okna*) se stavem a vlastní baterií a patička: **Kalibrovat** (po potvrzení spustí `script.heating_calibrate_<okruh>` s `climate`) a **Rozvrh**. Tlačítko historie v hlavičce otevře more-info hlavice. Čidlo okna `unavailable` / `unknown` ukáže *Čidlo nedostupné*, nikdy *Zavřené*.

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

## Dialog statistik

Tmavé tlačítko **Statistiky** v prvním boxu otevře dialog statistik (pod 600 px jako spodní list) se dvěma metrikami:

- **Kotel**: jak dlouho kotel běžel proti stejnému úseku srovnávaného období. Velké číslo v hodinách, chipy změny (`▲ +15 % (+0,8 h)`), dvojice sloupců (minuty za hodinu u dne, hodiny za den / měsíc u týdne / měsíce / roku) a venkovní teplota jako čára na pravé ose, dlaždice *Ø venku*, *Denostupně*, *Na denostupeň* a *Okna ušetřila*. Přepínač **Přepočítat na venkovní teplotu** (výchozí zapnuto, drží se po dobu života karty) přidá druhý chip a větu, která srovnává čas kotle na denostupeň.
- **Okna**: hodiny kotle ušetřené otevřenými okny (velké číslo), hlavice-hodiny, které okna držela zavřené (sloupce, dlaždice), a podíl na běhu kotle.

Období **Den / Týden / Měsíc / Rok** se šipkami ◀ ▶ (▶ je na aktuálním období vypnutá; týden začíná v pondělí), vždy jeden chip srovnání: den = *včera* / stejný den minulého měsíce / stejné datum loni, týden = *minulý týden* / stejný ISO týden loni, měsíc = minulý měsíc / stejný měsíc loni, rok = loni. Srovnání je stejný úsek: srovnávané období se ořízne tam, kam sahají aktuální data (celé uplynulé období se srovnává celé).

Čte jen dlouhodobé statistiky přes `recorder/statistics_during_period` (smí ho volat každý uživatel), jedno volání pro aktuální rozsah a jedno pro srovnání, dokud je dialog otevřený, se drží v paměti (aktuální období se obnovuje po 5 minutách):

| Statistika | K čemu |
|---|---|
| `sensor.heating_stats_boiler_total_<okruh>` (`change`, hodiny) | doba běhu kotle |
| `sensor.heating_stats_window_boiler_total_<okruh>` (`change`, hodiny) | hodiny kotle ušetřené okny |
| `sensor.heating_stats_window_valves_total_<okruh>` (`change`, hodiny) | hlavice-hodiny držené okny zavřené |
| `sensor.heating_outdoor_temperature_<okruh>` (`mean`, °C) | venkovní průměr a denostupně |

Řádky statistik jsou hodinové pro den a týden, denní pro měsíc, měsíční pro rok. **Denostupně** = Σ max(0, 18 °C − průměrná venkovní teplota) × délka řádku ve dnech (řádek teplejší než 18 °C = 0), čas kotle na denostupeň je tedy `h / denostupně`. Selhané volání ukáže *Statistiky nejsou k dispozici.*, nová instalace bez statistik řádek o prázdných datech.

![Dialog statistik: Kotel, Okna](docs/stats-dialog.png)

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
