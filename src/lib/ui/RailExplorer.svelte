<script lang="ts">
  import { locale, nameOf } from "../i18n.svelte";
  import type { AppState } from "../state.svelte";
  import TrainPositions from "./TrainPositions.svelte";
  import RailDepartures from "./RailDepartures.svelte";
  import SuburbanDepartures from "./SuburbanDepartures.svelte";
  import { searchStations, stationName } from "../station-search";
  let { app }: { app: AppState } = $props();

  const en = $derived(locale.language === "en");
  let stationQuery = $state("");
  function chooseStation(name: string) { app.railChoices.station = name; stationQuery = ""; }
  const stations = $derived((app.metro?.stations ?? []).filter(s => s.lines.includes(app.railChoices.mode)).sort((a, b) => nameOf(a).localeCompare(nameOf(b), locale.language)));
  const matches = $derived(searchStations(stations, stationQuery));
  $effect(() => { app.loadMetro(); });
  function changeMode(value: string) { stationQuery = ""; app.railChoices.mode = value; app.railChoices.station = ""; app.railChoices.train = null; }
</script>

<section class="explorer" aria-label={en ? "Rail departures" : "Αναχωρήσεις σιδηροδρόμων"}>
  <h3>{en ? "ISAP, metro, tram & suburban rail" : "ΗΣΑΠ, μετρό, τραμ & προαστιακός"}</h3>
  <p>{en ? "Buses and trolleybuses have live vehicle positions in the line search. Choose a rail service below for its available departures." : "Λεωφορεία και τρόλεϊ έχουν ζωντανές θέσεις οχημάτων στην αναζήτηση γραμμών. Διάλεξε μέσο παρακάτω για τις διαθέσιμες αναχωρήσεις."}</p>
  <label>{en ? "Transport service" : "Μέσο μεταφοράς"}
    <select value={app.railChoices.mode} onchange={e => changeMode(e.currentTarget.value)}>
      <option value="M1">{en ? "ISAP · Line 1" : "ΗΣΑΠ · Γραμμή 1"}</option>
      <option value="M2">{en ? "Metro · Line 2" : "Μετρό · Γραμμή 2"}</option>
      <option value="M3">{en ? "Metro · Line 3" : "Μετρό · Γραμμή 3"}</option>
      <option value="T6">{en ? "Tram · T6" : "Τραμ · Τ6"}</option>
      <option value="T7">{en ? "Tram · T7" : "Τραμ · Τ7"}</option>
      <option value="suburban">{en ? "Suburban rail (Proastiakos)" : "Προαστιακός"}</option>
    </select>
  </label>
  {#if app.railChoices.mode === "suburban"}<SuburbanDepartures {app} />
  {:else if !app.metro}
    <p>{en ? "Loading stations…" : "Φόρτωση σταθμών…"}</p>
    <button type="button" onclick={() => app.loadMetro()}>{en ? "Retry" : "Ξανά"}</button>
  {:else}
    <label>{en ? "Search stations" : "Αναζήτηση σταθμών"}
      <input type="search" bind:value={stationQuery} placeholder={en ? "English, Greek or Greeklish" : "Ελληνικά, αγγλικά ή Greeklish"}
        onkeydown={e => { if (e.key === "Enter" && stationQuery.trim() && matches.length) { e.preventDefault(); chooseStation(matches[0].name); } }} />
    </label>
    {#if stationQuery.trim()}
      <ul class="station-results" aria-label={en ? "Matching stations" : "Σταθμοί που βρέθηκαν"}>
        {#each matches as s}<li><button type="button" onclick={() => chooseStation(s.name)}>{stationName(s, locale.language)}</button></li>{/each}
      </ul>
      {#if !matches.length}<p role="status">{en ? "No matching stations on this line." : "Δεν βρέθηκαν σταθμοί σε αυτή τη γραμμή."}</p>{/if}
    {/if}
    <label>{en ? "Station" : "Σταθμός"}
      <select bind:value={app.railChoices.station}><option value="">{en ? "Choose a station" : "Διάλεξε σταθμό"}</option>{#each stations as s}<option value={s.name}>{nameOf(s)}</option>{/each}</select>
    </label>
    <button type="button" aria-pressed={app.metroLines.includes(app.railChoices.mode)} onclick={() => {
      const shown = app.metroLines.includes(app.railChoices.mode);
      app.toggleMetroLine(app.railChoices.mode);
      if (!shown) { app.panelHidden = true; app.setStationsOn(true); app.fitMetro([app.railChoices.mode]); }
    }}>{en ? (app.metroLines.includes(app.railChoices.mode) ? "Hide route from map" : "Show route and stations on map") : (app.metroLines.includes(app.railChoices.mode) ? "Απόκρυψη γραμμής από τον χάρτη" : "Εμφάνιση γραμμής και σταθμών στον χάρτη")}</button>
    {#if app.railChoices.station}<RailDepartures stop={app.railChoices.station} line={app.railChoices.mode} />{/if}
  {/if}
  <details><summary>{en ? "Trains on the map" : "Συρμοί στον χάρτη"}</summary><TrainPositions {app} mode={app.railChoices.mode} /></details>
</section>
<style>
  .explorer { padding: 12px; max-height: 60vh; overflow: auto; background: var(--panel); border: 1px solid var(--border); border-radius: 12px; }
  h3 { font-size: 15px; margin: 0 0 8px; }
  p { color: var(--muted); font-size: 12px; }
  label { display: block; margin: 10px 0; font-size: 13px; }
  select, input { box-sizing: border-box; display: block; width: 100%; margin-top: 5px; padding: 10px; color: var(--fg); background: var(--panel); border: 1px solid var(--border); border-radius: 6px; font-size: 16px; }
  .station-results { list-style: none; padding: 0; max-height: 220px; overflow: auto; }
  .station-results button { width: 100%; min-height: 44px; text-align: left; margin: 2px 0; }
  summary { cursor: pointer; margin-top: 12px; }
  button { min-height: 36px; }
</style>
