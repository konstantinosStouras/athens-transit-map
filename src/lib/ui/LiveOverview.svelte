<script lang="ts">
  import { locale } from "../i18n.svelte";
  import { overview } from "../overview";
  import type { AppState } from "../state.svelte";
  let { app }: { app: AppState } = $props();
  const en = $derived(locale.language === "en");
  const selected = $derived(app.selected.length > 0 || !app.cityOn);
  const data = $derived(selected ? app.vehicles.map(p => p.v) : app.city?.vehicles ?? []);
  const summary = $derived(overview(data, app.serverNow / 1000));
  const pct = $derived(summary.measured ? Math.round(summary.onTime / summary.measured * 100) : null);
</script>

<section aria-labelledby="live-overview-title">
  <h3 id="live-overview-title">{en ? "Live service overview" : "Ζωντανή εικόνα υπηρεσίας"}</h3>
  <p class="note">{selected
    ? (en ? "Selected lines and directions only." : "Μόνο οι επιλεγμένες γραμμές και κατευθύνσεις.")
    : (en ? "Vehicles loaded in the current map area; not the whole network." : "Οχήματα που φορτώθηκαν στην περιοχή του χάρτη· όχι ολόκληρο το δίκτυο.")}</p>
  {#if app.statusFailed || app.cityState === "backoff" || app.selected.some(id => app.pollState[id] === "backoff")}
    <p class="warning" role="status">{en ? "Connection problem. These are the last received measurements, not a confirmed live service status." : "Πρόβλημα σύνδεσης. Εμφανίζονται οι τελευταίες μετρήσεις, όχι επιβεβαιωμένη ζωντανή κατάσταση."}</p>
  {/if}
  {#if !summary.total}
    <p>{en ? "No vehicle measurements are loaded yet. Select a line or enable city vehicles on the map." : "Δεν έχουν φορτωθεί μετρήσεις οχημάτων. Επίλεξε γραμμή ή ενεργοποίησε τα οχήματα πόλης στον χάρτη."}</p>
  {:else}
    <dl>
      <div><dt>{en ? "Vehicles loaded" : "Φορτωμένα οχήματα"}</dt><dd>{summary.total}</dd></div>
      <div><dt>{en ? "GPS within 2 minutes" : "GPS εντός 2 λεπτών"}</dt><dd>{summary.fresh}</dd></div>
      <div><dt>{en ? "Old or invalid GPS" : "Παλιό ή μη έγκυρο GPS"}</dt><dd>{summary.stale}</dd></div>
      <div><dt>{en ? "On time or early" : "Στην ώρα τους ή νωρίτερα"}</dt><dd>{pct == null ? "—" : `${pct}%`} <small>({summary.onTime}/{summary.measured})</small></dd></div>
      <div><dt>{en ? "Over 2 minutes late" : "Πάνω από 2 λεπτά καθυστέρηση"}</dt><dd>{summary.late}</dd></div>
      <div><dt>{en ? "Fresh GPS, no schedule comparison" : "Πρόσφατο GPS, χωρίς σύγκριση ωραρίου"}</dt><dd>{summary.unknown}</dd></div>
      <div><dt>{en ? "Fastest current speed estimate" : "Υψηλότερη τρέχουσα εκτίμηση ταχύτητας"}</dt><dd>{summary.maxKmh == null ? "—" : `${Math.round(summary.maxKmh)} km/h`} <small>({summary.speedSamples} {en ? "samples" : "δείγματα"})</small></dd></div>
    </dl>
    <p class="note">{en ? "On time includes early vehicles and delays up to 2 minutes. Percentages exclude missing schedule comparisons and GPS older than 2 minutes. Speed is the feed's smoothed estimate from fresh positions, not a recorded all-time maximum. Missing measurements are not zero." : "Στην ώρα τους: και νωρίτερα ή έως 2 λεπτά καθυστέρηση. Τα ποσοστά εξαιρούν άγνωστο ωράριο και GPS παλαιότερο των 2 λεπτών. Η ταχύτητα είναι εξομαλυμένη εκτίμηση από πρόσφατες θέσεις, όχι ιστορικό ρεκόρ. Οι μετρήσεις που λείπουν δεν είναι μηδενικές."}</p>
  {/if}
  <p class="note">{en ? "Schedule comparisons can be approximate when the official timetable has expired. Data sources explain the limitations; independent accuracy has not been verified." : "Η σύγκριση με το ωράριο μπορεί να είναι προσεγγιστική όταν το επίσημο πρόγραμμα έχει λήξει. Οι πηγές δεδομένων εξηγούν τους περιορισμούς· η ακρίβεια δεν έχει επαληθευτεί ανεξάρτητα."}</p>
</section>

<style>
  section { margin-bottom: 20px; padding-bottom: 18px; border-bottom: 1px solid var(--border); }
  h3 { font-size: 15px; margin: 0; }
  .note { color: var(--muted); font-size: 12px; margin: 8px 0; }
  .warning { background: var(--warn-bg); padding: 10px; border-radius: 8px; font-size: 13px; }
  dl { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; }
  dl div { background: var(--control); border-radius: 10px; padding: 12px; }
  dt { font-size: 12px; color: var(--muted); }
  dd { margin: 3px 0 0; font-size: 22px; font-weight: 650; font-variant-numeric: tabular-nums; }
  small { font-size: 12px; font-weight: 400; }
  @media(max-width:400px) { dl { grid-template-columns: 1fr; } }
</style>
