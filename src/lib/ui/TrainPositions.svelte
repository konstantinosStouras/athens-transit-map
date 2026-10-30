<script lang="ts">
  import { locale } from "../i18n.svelte";
  import { API_BASE } from "../config";
  import { railJSON } from "../rail-departures";
  import { trainPositions, type TrainPosition } from "../train-positions";
  import type { AppState } from "../state.svelte";
  let { app, mode }: { app: AppState; mode: string } = $props();
  let trains = $state<TrainPosition[]>([]), failed = $state(false), loading = $state(true);

  const en = $derived(locale.language === "en");
  $effect(() => {
    const currentMode = mode;
    trains = []; failed = false; loading = true;
    app.railPosition = null;
    let disposed = false, active: AbortController | null = null;
    async function refresh() {
      if (document.hidden || active) return;
      const controller = active = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const value = await railJSON(API_BASE + "/v1/rail/" + (currentMode === "suburban" ? "suburban" : "stasy") + "/vehicles", controller.signal);
        const positions = trainPositions(value, currentMode, Date.now() / 1000);
        if (!disposed) { trains = positions; failed = false; }
      } catch { if (!disposed) { trains = []; failed = true; } }
      finally { clearTimeout(timeout); active = null; if (!disposed) loading = false; }
    }
    void refresh();
    const timer = setInterval(refresh, 15000);
    document.addEventListener("visibilitychange", refresh);
    return () => { disposed = true; active?.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", refresh); app.railPosition = null; };
  });
  $effect(() => {
    const train = trains.find(t => t.id === app.railChoices.train && t.at >= app.now / 1000 - 120);
    app.railPosition = train ? { point: train.point, label: train.line + " " + train.id + " → " + train.destination + " · " +
      (train.estimated ? (en ? "Timetable estimate, not GPS" : "Εκτίμηση προγράμματος, όχι GPS") : "GPS") } : null;
  });
  function show(t: TrainPosition) { app.railChoices.train = t.id; app.panelHidden = true; app.fitPoints([t.point]); }
</script>
<section>
  <h3>{en ? "Trains on the map" : "Συρμοί στον χάρτη"}</h3>
  <p>{mode === "suburban"
    ? (en ? "Recent GPS positions for suburban trains in the Athens region. Old positions are hidden." : "Πρόσφατες θέσεις GPS προαστιακών συρμών στην περιοχή της Αθήνας. Παλιές θέσεις αποκρύπτονται.")
    : (en ? "Approximate positions between scheduled stops, not live GPS. Trains may not be running as estimated." : "Προσεγγιστικές θέσεις μεταξύ προγραμματισμένων στάσεων, όχι ζωντανό GPS. Η πραγματική κίνηση μπορεί να διαφέρει.")}</p>
  {#if failed}<p role="status">{en ? "Fresh train positions unavailable. Retrying automatically." : "Δεν υπάρχουν πρόσφατες θέσεις. Αυτόματη επανάληψη."}</p>
  {:else if loading}<p>{en ? "Loading trains…" : "Φόρτωση συρμών…"}</p>
  {:else if !trains.length}<p>{en ? "No current trains returned for this service." : "Δεν επιστράφηκαν τρέχοντες συρμοί για αυτό το μέσο."}</p>
  {:else}
    {#if trains.some(t => t.indicative)}<p>{en ? "Indicative only: the source timetable has expired." : "Μόνο ενδεικτικά: το πρόγραμμα της πηγής έχει λήξει."}</p>{/if}
    <ul>{#each trains as t (t.id)}<li>
      <button type="button" aria-pressed={app.railChoices.train === t.id} onclick={() => show(t)}>
        <strong>{t.line} {t.id} → {t.destination}</strong>
        <span>{en ? "Next" : "Επόμενη"}: {t.next || "—"}</span>
        {#if !t.estimated}<span>{t.delay == null ? (en ? "Delay unknown" : "Άγνωστη καθυστέρηση") : t.delay + (en ? " min delay" : " λεπτά καθυστέρηση")}</span>{/if}
        <span>{en ? "Show on map" : "Εμφάνιση στον χάρτη"} · {t.estimated ? (en ? "Estimate" : "Εκτίμηση") : "GPS"}</span>
      </button>
    </li>{/each}</ul>
  {/if}
</section>
<style>
  h3 { font-size: 14px; }
  p { font-size: 12px; color: var(--muted); }
  ul { list-style: none; padding: 0; max-height: 240px; overflow-y: auto; }
  button { display: grid; gap: 4px; width: 100%; text-align: left; min-height: 44px; padding: 8px; margin: 4px 0; border: 1px solid var(--border); border-radius: 8px; background: var(--control); color: var(--fg); cursor: pointer; }
  button[aria-pressed="true"] { border-color: var(--accent); }
  span { font-size: 12px; }
</style>
