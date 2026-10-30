<script lang="ts">
  import { locale } from "../i18n.svelte";
  import { parseStations, railJSON, railStationsUrl, type RailStation } from "../rail-departures";
  import type { AppState } from "../state.svelte";
  let { app }: { app: AppState } = $props();
  import RailDepartures from "./RailDepartures.svelte";
  let stations = $state<RailStation[]>([]), failed = $state(false), attempt = $state(0);
  const en = $derived(locale.language === "en");
  $effect(() => {
    void attempt;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    failed = false;
    railJSON(railStationsUrl, controller.signal).then(value => {
      if (!controller.signal.aborted) stations = parseStations(value).sort((a, b) => a.name.localeCompare(b.name, "el"));
    }).catch(() => { if (!controller.signal.aborted) failed = true; else if (!disposed) failed = true; }).finally(() => clearTimeout(timeout));
    let disposed = false;
    return () => { disposed = true; clearTimeout(timeout); controller.abort(); };
  });
</script>

<section class="suburban">
  <h3>{en ? "Suburban rail" : "Προαστιακός"}</h3>
  {#if failed}<p>{en ? "Stations unavailable" : "Οι σταθμοί δεν είναι διαθέσιμοι"} <button onclick={() => attempt++}>{en ? "Retry" : "Ξανά"}</button></p>
  {:else if !stations.length}<p>{en ? "Loading stations…" : "Φόρτωση σταθμών…"}</p>
  {:else}
    <label>{en ? "Station" : "Σταθμός"}
      <select bind:value={app.railChoices.suburbanStation}><option value="">{en ? "Choose a station" : "Διάλεξε σταθμό"}</option>{#each stations as s}<option value={s.id}>{s.name}</option>{/each}</select>
    </label>
    {#if app.railChoices.suburbanStation}<RailDepartures stop={app.railChoices.suburbanStation} suburban />{/if}
  {/if}
</section>
<style>
  .suburban { padding: 12px; background: var(--panel); border: 1px solid var(--border); border-radius: 12px; max-height: 55vh; overflow-y: auto; }
  h3 { margin: 0 0 10px; font-size: 15px; }
  select { display: block; width: 100%; margin-top: 6px; padding: 10px; color: var(--fg); background: var(--panel); border: 1px solid var(--border); border-radius: 6px; }
</style>
