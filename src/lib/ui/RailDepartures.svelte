<script lang="ts">
  import { locale } from "../i18n.svelte";
  import { stationName } from "../station-search";
  import { parseBoard, railBoardUrl, railJSON, type DepartureBoard } from "../rail-departures";
  let { stop, suburban = false, line }: { stop: string; suburban?: boolean; line?: string } = $props();
  let board = $state<DepartureBoard | null>(null);
  let failed = $state(false);
  let updated = $state(0);
  const en = $derived(locale.language === "en");
  const departures = $derived(board?.departures.filter(d => !line || d.line === line) ?? []);
  $effect(() => {
    const url = railBoardUrl(stop, suburban), mode = suburban;
    board = null; failed = false; updated = 0;
    let disposed = false, active: AbortController | null = null;
    async function refresh() {
      if (document.hidden || active) return;
      const controller = new AbortController(); active = controller;
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const result = parseBoard(await railJSON(url, controller.signal), mode);
        if (!disposed) { board = result; failed = false; updated = Date.now(); }
      } catch { if (!disposed) { failed = true; board = null; } }
      finally { clearTimeout(timeout); active = null; }
    }
    void refresh();
    const timer = setInterval(refresh, mode ? 60000 : 30000);
    document.addEventListener("visibilitychange", refresh);
    return () => { disposed = true; active?.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  });
  const status = (s: string | undefined) => ({ scheduled: en ? "Scheduled" : "Προγραμματισμένο", in_progress: en ? "Running" : "Σε εξέλιξη", delayed: en ? "Delayed" : "Καθυστέρηση", completed: en ? "Completed" : "Ολοκληρώθηκε" }[s ?? ""] ?? s ?? "");
</script>

<div class="departures" aria-live="polite">
  <h3>{en ? "Departures" : "Αναχωρήσεις"}</h3>
  <p>{suburban ? (en ? "Suburban rail · reported delays. Times are in Athens time; the provider may serve a cached board." : "Προαστιακός · αναφερόμενες καθυστερήσεις. Ώρες Ελλάδας· η πηγή μπορεί να επιστρέψει αποθηκευμένο πίνακα.") : (en ? "STASY timetable · ISAP, metro and tram · not live predictions" : "Πρόγραμμα ΣΤΑΣΥ · ΗΣΑΠ, μετρό και τραμ · όχι ζωντανές προβλέψεις")}</p>
  {#if failed}
    <p role="status">{en ? "Departures unavailable. Retrying automatically." : "Οι αναχωρήσεις δεν είναι διαθέσιμες. Αυτόματη επανάληψη."}</p>
  {:else if !board}
    <p>{en ? "Loading departures…" : "Φόρτωση αναχωρήσεων…"}</p>
  {:else}
    {#if board.indicative}<p class="warning">{en ? "Indicative times: the source timetable has expired." : "Ενδεικτικές ώρες: το πρόγραμμα της πηγής έχει λήξει."}</p>{/if}
    {#if !departures.length}<p>{en ? "No upcoming departures returned." : "Δεν επιστράφηκαν επόμενες αναχωρήσεις."}</p>{/if}
    <ul>
      {#each departures as d}
        <li><strong>{d.line ?? d.train}</strong> → {stationName({ name: d.headsign ?? d.to }, locale.language)} <b>{d.t}</b>
          {#if suburban}
            {#if d.from}<small>{en ? "From" : "Από"} {d.from}</small>{/if}
            <small>{status(d.status)} · {d.delay_min == null ? (en ? "Delay unknown" : "Άγνωστη καθυστέρηση") : `+${d.delay_min} ${en ? "min" : "λεπτά"}`}{#if d.platform} · {en ? "Platform" : "Αποβάθρα"} {d.platform}{/if}</small>
          {/if}
        </li>
      {/each}
    </ul>
    <p>{en ? "Fetched" : "Ανάκτηση"} {new Date(updated).toLocaleTimeString(en ? "en-GB" : "el-GR", { timeZone: "Europe/Athens", hour: "2-digit", minute: "2-digit" })} · {en ? "Athens time" : "ώρα Ελλάδας"}</p>
  {/if}
</div>

<style>
  h3 { font-size: 14px; margin: 10px 0 6px; }
  p, small { font-size: 12px; color: var(--muted); }
  ul { list-style: none; margin: 8px 0; padding: 0; max-height: 230px; overflow-y: auto; }
  li { padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
  li b { float: right; margin-left: 8px; }
  small { display: block; margin-top: 4px; }
  .warning { color: var(--accent); }
</style>
