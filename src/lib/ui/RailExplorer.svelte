<script lang="ts">
  import { locale, nameOf } from "../i18n.svelte";
  import type { AppState } from "../state.svelte";
  import TrainPositions from "./TrainPositions.svelte";
  import RailDepartures from "./RailDepartures.svelte";
  import SuburbanDepartures from "./SuburbanDepartures.svelte";
  let { app }: { app: AppState } = $props();
  let mode = $state("M1"), selected = $state("");
  const en = $derived(locale.language === "en");
  const stations = $derived((app.metro?.stations ?? []).filter(s => s.lines.includes(mode)).sort((a, b) => nameOf(a).localeCompare(nameOf(b), locale.language)));
  $effect(() => { app.loadMetro(); });
  function changeMode(value: string) { mode = value; selected = ""; }
</script>

<section class="explorer" aria-label={en ? "Rail departures" : "Αναχωρήσεις σιδηροδρόμων"}>
  <h3>{en ? "ISAP, metro, tram & suburban rail" : "ΗΣΑΠ, μετρό, τραμ & προαστιακός"}</h3>
  <p>{en ? "Buses and trolleybuses have live vehicle positions in the line search. Choose a rail service below for its available departures." : "Λεωφορεία και τρόλεϊ έχουν ζωντανές θέσεις οχημάτων στην αναζήτηση γραμμών. Διάλεξε μέσο παρακάτω για τις διαθέσιμες αναχωρήσεις."}</p>
  <label>{en ? "Transport service" : "Μέσο μεταφοράς"}
    <select value={mode} onchange={e => changeMode(e.currentTarget.value)}>
      <option value="M1">{en ? "ISAP · Line 1" : "ΗΣΑΠ · Γραμμή 1"}</option>
      <option value="M2">{en ? "Metro · Line 2" : "Μετρό · Γραμμή 2"}</option>
      <option value="M3">{en ? "Metro · Line 3" : "Μετρό · Γραμμή 3"}</option>
      <option value="T6">{en ? "Tram · T6" : "Τραμ · Τ6"}</option>
      <option value="T7">{en ? "Tram · T7" : "Τραμ · Τ7"}</option>
      <option value="suburban">{en ? "Suburban rail (Proastiakos)" : "Προαστιακός"}</option>
    </select>
  </label>
  <TrainPositions {app} {mode} />
  {#if mode === "suburban"}<SuburbanDepartures />
  {:else if !app.metro}
    <p>{en ? "Loading stations…" : "Φόρτωση σταθμών…"}</p>
    <button type="button" onclick={() => app.loadMetro()}>{en ? "Retry" : "Ξανά"}</button>
  {:else}
    <label>{en ? "Station" : "Σταθμός"}
      <select bind:value={selected}><option value="">{en ? "Choose a station" : "Διάλεξε σταθμό"}</option>{#each stations as s}<option value={s.name}>{nameOf(s)}</option>{/each}</select>
    </label>
    <button type="button" aria-pressed={app.metroLines.includes(mode)} onclick={() => {
      const shown = app.metroLines.includes(mode);
      app.toggleMetroLine(mode);
      if (!shown) { app.panelHidden = true; app.setStationsOn(true); app.fitMetro([mode]); }
    }}>{en ? (app.metroLines.includes(mode) ? "Hide route from map" : "Show route and stations on map") : (app.metroLines.includes(mode) ? "Απόκρυψη γραμμής από τον χάρτη" : "Εμφάνιση γραμμής και σταθμών στον χάρτη")}</button>
    {#if selected}<RailDepartures stop={selected} line={mode} />{/if}
  {/if}
</section>
<style>
  .explorer { padding: 12px; max-height: 60vh; overflow: auto; background: var(--panel); border: 1px solid var(--border); border-radius: 12px; }
  h3 { font-size: 15px; margin: 0 0 8px; }
  p { color: var(--muted); font-size: 12px; }
  label { display: block; margin: 10px 0; font-size: 13px; }
  select { display: block; width: 100%; margin-top: 5px; padding: 10px; color: var(--fg); background: var(--panel); border: 1px solid var(--border); border-radius: 6px; }
  button { min-height: 36px; }
</style>
