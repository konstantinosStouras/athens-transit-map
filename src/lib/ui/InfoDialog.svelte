<script lang="ts">
  import { t as tr, locale } from "../i18n.svelte";
  import { dayMonth } from "../format";
  import { GTFS_PAGE } from "../sources";
  import SourcesView from "./SourcesView.svelte";
  import LongTermView from "./LongTermView.svelte";
  import StatsView from "./StatsView.svelte";
  import LiveOverview from "./LiveOverview.svelte";
  import type { AppState } from "../state.svelte";

  // ended: the day the OASA timetable ended, when it is past (explained at the top).
  let { open = $bindable(false), tab = $bindable<"sources" | "stats">("sources"), app, motion, ended = null }: { open: boolean; tab?: "sources" | "stats"; app: AppState; motion: boolean; ended?: string | null } = $props();

  const TABS = [
    { id: "sources", label: "Πηγές δεδομένων" },
    { id: "stats", label: "Στατιστικά δικτύου" },
  ] as const;
  type Tab = (typeof TABS)[number]["id"];
  // Inside the stats tab: the newest day first, then the stored days together.
  const SUBS = [
    { id: "day", label: "Τελευταία μέρα" },
    { id: "long", label: "Μακροχρόνια" },
  ] as const;
  type Sub = (typeof SUBS)[number]["id"];
  let sub = $state<Sub>("day");

  let dlg: HTMLDialogElement;
  // The stats tab loads its data once, the first time it is shown; it then keeps it while hidden.
  let statsSeen = $state(false);
  $effect(() => { if (tab === "stats") statsSeen = true; });

  $effect(() => {
    if (open && dlg.isConnected && !dlg.open) dlg.showModal();
    else if (!open && dlg.open) dlg.close();
  });

  // Arrow keys, Home and End move through a tab list; the new tab gets the focus.
  function tabKey<T extends string>(e: KeyboardEvent, ids: readonly T[], now: T, set: (id: T) => void, prefix: string) {
    const to = { ArrowLeft: -1, ArrowRight: 1, Home: -ids.length, End: ids.length }[e.key];
    if (to == null) return;
    e.preventDefault();
    const i = ids.indexOf(now);
    const next = ids[Math.abs(to) === ids.length ? (to < 0 ? 0 : ids.length - 1) : (i + to + ids.length) % ids.length];
    set(next);
    document.getElementById(`${prefix}${next}`)?.focus();
  }
  const onTabKey = (e: KeyboardEvent) => tabKey(e, TABS.map(t => t.id), tab, id => (tab = id), "info-tab-");
  const onSubKey = (e: KeyboardEvent) => tabKey(e, SUBS.map(t => t.id), sub, id => (sub = id), "stats-tab-");
</script>

<dialog bind:this={dlg} class="sheet" aria-labelledby="info-title" onclose={() => (open = false)}
  onclick={e => { if (e.target === dlg) open = false; }}
  onkeydown={e => { if (e.key === "Escape") e.stopPropagation(); }}>
  <div class="body">
    <header>
      <h2 id="info-title">{tr("Πληροφορίες")}</h2>
      <button type="button" class="close" aria-label={tr("Κλείσιμο")} onclick={() => (open = false)}>
        <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
      </button>
    </header>

    {#if ended}
      <div class="old">
        <b>{tr("Το πρόγραμμα του ΟΑΣΑ έληξε στις ")}{tr(dayMonth(ended))}.</b>{tr(" Ο ΟΑΣΑ δεν έχει δημοσιεύσει ακόμα νέο πρόγραμμα\r\n        δρομολογίων (GTFS), οπότε ο χάρτης χρησιμοποιεί το τελευταίο. Οι θέσεις των οχημάτων είναι ζωντανές· οι\r\n        καθυστερήσεις και τα δρομολόγια βγαίνουν από το παλιό πρόγραμμα, άρα είναι κατά προσέγγιση. Μόλις βγει νέο,\r\n        ο χάρτης το παίρνει αυτόματα. ")}<a href={GTFS_PAGE} target="_blank" rel="noopener">{tr("Το αρχείο στο data.gov.gr")}</a>
      </div>
    {/if}

    <div class="tabs" role="tablist" aria-label={tr("Πληροφορίες")}>
      {#each TABS as t (t.id)}
        <button type="button" role="tab" id="info-tab-{t.id}" aria-controls="info-panel-{t.id}" aria-selected={tab === t.id}
          tabindex={tab === t.id ? 0 : -1} onclick={() => (tab = t.id)} onkeydown={onTabKey}>{tr(t.label)}</button>
      {/each}
    </div>

    <div role="tabpanel" id="info-panel-sources" aria-labelledby="info-tab-sources" hidden={tab !== "sources"}>
      <section class="data-quality">
        <h3>{locale.language === "en" ? "What these data can tell you" : "Τι δείχνουν αυτά τα δεδομένα"}</h3>
        <p>{locale.language === "en" ? "GPS positions, schedule comparisons and speed estimates come from the existing public feed. Missing GPS is not proof a bus did not run. Schedule differences are not predicted arrival times, and independent accuracy is not verified." : "Οι θέσεις GPS, οι συγκρίσεις ωραρίου και οι εκτιμήσεις ταχύτητας προέρχονται από την υπάρχουσα δημόσια πηγή. Η απουσία GPS δεν αποδεικνύει ότι δεν έγινε δρομολόγιο. Οι αποκλίσεις ωραρίου δεν είναι προβλέψεις αφίξεων και η ακρίβεια δεν έχει επαληθευτεί ανεξάρτητα."}</p>
        {#if app.status}
          <p>{locale.language === "en" ? "Timetable version:" : "Έκδοση προγράμματος:"} <b>{app.status.gtfs_version}</b> · {locale.language === "en" ? "Valid until:" : "Ισχύει έως:"} <b>{app.status.gtfs_expires}</b></p>
          {#if app.statusFailed}<p>{locale.language === "en" ? "Last known timetable metadata; the current connection check failed." : "Τελευταία γνωστά στοιχεία προγράμματος· ο τρέχων έλεγχος σύνδεσης απέτυχε."}</p>{/if}
        {:else}<p>{locale.language === "en" ? "Timetable metadata has not loaded yet." : "Δεν έχουν φορτωθεί ακόμα τα στοιχεία προγράμματος."}</p>{/if}
      </section>
      <SourcesView {motion} />
    </div>
    <div role="tabpanel" id="info-panel-stats" aria-labelledby="info-tab-stats" hidden={tab !== "stats"}>
      {#if open && tab === "stats"}<LiveOverview {app} />{/if}
      <div class="tabs sub" role="tablist" aria-label={tr("Στατιστικά")}>
        {#each SUBS as t (t.id)}
          <button type="button" role="tab" id="stats-tab-{t.id}" aria-controls="stats-panel-{t.id}" aria-selected={sub === t.id}
            tabindex={sub === t.id ? 0 : -1} onclick={() => (sub = t.id)} onkeydown={onSubKey}>{tr(t.label)}</button>
        {/each}
      </div>
      <div role="tabpanel" id="stats-panel-day" aria-labelledby="stats-tab-day" hidden={sub !== "day"}>
        {#if statsSeen}<StatsView />{/if}
      </div>
      <!-- Mounted only while shown, so each visit asks for the days again (cached for an hour). -->
      <div role="tabpanel" id="stats-panel-long" aria-labelledby="stats-tab-long" hidden={sub !== "long"}>
        {#if open && tab === "stats" && sub === "long"}<LongTermView />{/if}
      </div>
    </div>
  </div>
</dialog>

<style>
  .data-quality { margin-bottom: 16px; padding: 12px; background: var(--control); border-radius: 10px; font-size: 13px; }
  .data-quality h3 { margin: 0; font-size: 14px; }
  .data-quality p { margin: 8px 0 0; overflow-wrap: anywhere; }
  .sheet { width: min(720px, calc(100% - 32px)); max-height: calc(100% - 48px); padding: 0; border: 1px solid var(--border);
    border-radius: 16px; background: var(--bg); color: var(--fg); box-shadow: var(--shadow); overscroll-behavior: contain; }
  .sheet::backdrop { background: rgba(0, 0, 0, .4); }
  .body { padding: 16px 20px 20px; }
  header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
  h2 { flex: 1; margin: 0; font-size: 17px; }
  .close { display: grid; place-items: center; width: 36px; height: 36px; margin: -6px -8px -6px 0; border: 0;
    border-radius: 8px; background: none; color: var(--muted); cursor: pointer; }
  .close:hover { background: var(--control); color: var(--fg); }
  .old { margin: 0 0 12px; padding: 8px 10px; border-radius: 8px; background: var(--warn-bg); font-size: 13px; }
  .old a { color: inherit; }
  .tabs { display: flex; padding: 2px; margin-bottom: 14px; border-radius: 9px; background: var(--control); }
  .tabs button { flex: 1; min-height: 34px; border: 0; border-radius: 7px; background: none; cursor: pointer; font-size: 13px; }
  .tabs button[aria-selected="true"] { background: var(--bg); box-shadow: 0 1px 3px rgba(0, 0, 0, .2); font-weight: 600; }
  .tabs.sub { width: fit-content; margin-bottom: 10px; }
  .tabs.sub button { min-height: 32px; padding: 0 14px; font-size: 12px; white-space: nowrap; }
  [hidden] { display: none !important; }
  @media (max-width: 719px) {
    .sheet { width: 100%; max-width: none; height: 100%; max-height: none; margin: 0; border: 0; border-radius: 0; }
    .body { padding: calc(12px + env(safe-area-inset-top)) 16px calc(20px + env(safe-area-inset-bottom)); }
  }
</style>
