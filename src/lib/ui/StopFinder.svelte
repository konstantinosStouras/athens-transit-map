<script lang="ts">
  import { tick, untrack } from "svelte";
  import { locale, nameOf, t } from "../i18n.svelte";
  import { distM, loadTripIndex, type Pt } from "../trip";
  import { fold } from "../search";
  import { approachingStop, findStops, indexStops, type StopPoint, type StopService } from "../stops";
  import { ago, gtfsEnded } from "../format";
  import type { AppState } from "../state.svelte";
  let { app, seed = null, onclose }: { app: AppState; seed?: { name: string; lat: number; lon: number } | null; onclose: () => void } = $props();
  const en = $derived(locale.language === "en");
  let points = $state.raw<StopPoint[]>([]);
  let version = $state("");
  let loading = $state(true), failed = $state(false), locating = $state(false);
  let locationError = $state<"denied" | "unavailable" | null>(null);
  let origin = $state.raw<Pt | null>(null);
  let accuracy = $state(0), query = $state(untrack(() => seed?.name ?? "")), radius = $state(500), limit = $state(8);
  let selected = $state<StopPoint | null>(null);
  let gone = false;
  let locationRequest = 0;
  $effect(() => () => { gone = true; locationRequest++; });
  async function load() {
    loading = true; failed = false;
    try {
      const ix = await loadTripIndex();
      if (!gone) {
        points = indexStops(ix); version = ix.v;
        if (seed) selected = points.find(s => [s.name, s.name_en ?? ""].some(n => fold(n) === fold(seed!.name)) && distM([s.lat,s.lon],[seed!.lat,seed!.lon]) <= 12) ?? null;
      }
    } catch { if (!gone) failed = true; }
    finally { if (!gone) loading = false; }
  }
  void load();
  const results = $derived(findStops(points, query, origin, radius, limit));
  const expired = $derived(gtfsEnded(app.status?.gtfs_expires));
  const mismatch = $derived(!!app.status && version !== app.status.gtfs_version);
  const groups = $derived.by(() => {
    const result = new Map<string, StopService[]>();
    for (const service of selected?.services ?? []) {
      const key = `${service.line}/${service.destination}/${service.boarding}`;
      result.set(key, [...(result.get(key) ?? []), service]);
    }
    return [...result.entries()].map(([key, services]) => ({ key, services, first: services[0] }));
  });
  async function chooseStop(stop: StopPoint) {
    selected = stop;
    await tick();
    document.getElementById("selected-stop-title")?.focus();
  }
  function locate() {
    if (locating) return;
    locationError = null;
    if (!navigator.geolocation) { locationError = "unavailable"; return; }
    locating = true;
    const request = ++locationRequest;
    navigator.geolocation.getCurrentPosition(p => {
      if (gone || request !== locationRequest) return;
      origin = [p.coords.latitude, p.coords.longitude]; accuracy = p.coords.accuracy;
      selected = null; limit = 8; locating = false;
    }, error => {
      if (gone || request !== locationRequest) return;
      locationError = error.code === 1 ? "denied" : "unavailable"; locating = false;
    }, { timeout: 15000, maximumAge: 30000, enableHighAccuracy: false });
  }
  function follow(services: StopService[]) {
    const service = services[0];
    if (!app.selected.includes(service.line)) app.toggleLine(service.line);
    if (app.selected.includes(service.line)) { app.setFocus(service.line, services.map(s => s.variant)); app.selectRoute(service.line, service.variant); }
  }
</script>

<section class="finder" aria-labelledby="stop-finder-title">
  <header><h2 id="stop-finder-title">{en ? "Stops near you" : "Στάσεις κοντά σου"}</h2><button type="button" aria-label={en ? "Close stop finder" : "Κλείσιμο αναζήτησης στάσεων"} onclick={onclose}>×</button></header>
  <p class="note">{en ? "Use your location or search a stop name. Location is used on this device to find stops; this tool does not send it to a search service." : "Χρησιμοποίησε την τοποθεσία σου ή αναζήτησε όνομα στάσης. Η τοποθεσία χρησιμοποιείται στη συσκευή για εύρεση στάσεων· δεν αποστέλλεται σε υπηρεσία αναζήτησης."}</p>
  <div class="actions"><button type="button" disabled={locating || loading} onclick={locate}>{locating ? (en ? "Finding location…" : "Εύρεση τοποθεσίας…") : (en ? "Use my location" : "Χρήση τοποθεσίας μου")}</button>
  {#if origin}<button type="button" onclick={() => { origin = null; selected = null; limit = 8; }}>{en ? "Search anywhere" : "Αναζήτηση παντού"}</button>{/if}</div>
  {#if locationError}<p role="status">{locationError === "denied" ? (en ? "Location permission was denied. Search by stop name instead." : "Δεν δόθηκε άδεια τοποθεσίας. Αναζήτησε με όνομα στάσης.") : (en ? "Location is unavailable. Search by stop name or try again." : "Η τοποθεσία δεν είναι διαθέσιμη. Αναζήτησε με όνομα ή δοκίμασε ξανά.")}</p>{/if}
  {#if origin}<p class="note">{en ? "Location accuracy:" : "Ακρίβεια τοποθεσίας:"} ±{Math.round(accuracy)} m. {en ? "Distances are straight-line distances, not walking routes." : "Οι αποστάσεις είναι σε ευθεία, όχι διαδρομές πεζών."}</p>
    {#if accuracy > 100}<p role="status">{en ? "Location is approximate. Nearby results may be incomplete; increase the radius or search by name." : "Η τοποθεσία είναι κατά προσέγγιση. Αύξησε την ακτίνα ή αναζήτησε με όνομα."}</p>{/if}
    <label>{en ? "Search radius" : "Ακτίνα αναζήτησης"}<select bind:value={radius} onchange={() => { limit = 8; selected = null; }}>{#each [300,500,800,1500] as r}<option value={r}>{r} m</option>{/each}</select></label>
  {/if}
  <label>{en ? "Stop name" : "Όνομα στάσης"}<input type="search" bind:value={query} oninput={() => { selected = null; limit = 8; }} placeholder={en ? "e.g. Syntagma / Σύνταγμα" : "π.χ. Σύνταγμα"} /></label>
  <p class="note">{en ? "Stop names come from the data source. If an English name is unavailable, search in Greek." : "Τα ονόματα στάσεων προέρχονται από την πηγή δεδομένων. Αν λείπει αγγλική ονομασία, αναζήτησε στα ελληνικά."}</p>
  {#if loading}<p role="status">{en ? "Loading stops…" : "Φόρτωση στάσεων…"}</p>
  {:else if failed}<p role="status">{en ? "Stops could not load." : "Οι στάσεις δεν φόρτωσαν."}</p><button type="button" onclick={load}>{en ? "Try again" : "Δοκίμασε ξανά"}</button>
  {:else}
    <p class="note">{en ? "Stop index version:" : "Έκδοση αρχείου στάσεων:"} {version}.</p>
    {#if expired || mismatch}<p class="warning" role="status">{en ? "The stop index is old or differs from the current feed. Listed routes may have changed; live stop counts are hidden when versions differ." : "Το αρχείο στάσεων είναι παλιό ή διαφέρει από την τρέχουσα πηγή. Οι γραμμές μπορεί να έχουν αλλάξει· τα ζωντανά πλήθη στάσεων κρύβονται αν διαφέρουν οι εκδόσεις."}</p>{/if}
    {#if selected}<button type="button" onclick={() => selected = null}>{en ? "← Back to stops" : "← Πίσω στις στάσεις"}</button>
    {:else if !origin && query.trim().length < 2}<p>{en ? "Enter at least two letters, or use your location." : "Γράψε τουλάχιστον δύο γράμματα ή χρησιμοποίησε την τοποθεσία σου."}</p>
    {:else if !results.length}<p role="status">{en ? "No matching stops. Try another name, a larger radius, or Search anywhere." : "Δεν βρέθηκαν στάσεις. Δοκίμασε άλλο όνομα, μεγαλύτερη ακτίνα ή Αναζήτηση παντού."}</p>
    {:else}
      <ul class="results">{#each results as result (result.stop.id)}<li><button type="button" onclick={() => void chooseStop(result.stop)}>
        <strong>{nameOf(result.stop)}</strong><span>{result.distance == null ? `${result.stop.lat.toFixed(5)}, ${result.stop.lon.toFixed(5)}` : `${Math.round(result.distance)} m`}</span>
        <small>{[...new Set(result.stop.services.map(s => s.line))].join(" · ")}</small>
      </button></li>{/each}</ul>
      {#if results.length === limit && limit < 40}<button type="button" onclick={() => limit += 8}>{en ? "Show more stops" : "Περισσότερες στάσεις"}</button>{/if}
    {/if}
    {#if selected}
      <section class="selected" aria-labelledby="selected-stop-title">
        <h3 id="selected-stop-title" tabindex="-1">{nameOf(selected)}</h3>
        <p class="note">{en ? "Same-name stops can be on opposite sides of the road. Check the direction below." : "Στάσεις με ίδιο όνομα μπορεί να είναι απέναντι. Έλεγξε την κατεύθυνση παρακάτω."}</p>
        <p class="note">{en ? "Follow a direction to load its vehicles. Counts use fresh GPS and the reported next stop; they are not arrival times. No countdown does not mean no service." : "Ακολούθησε μια κατεύθυνση για να φορτωθούν τα οχήματά της. Τα πλήθη βασίζονται σε πρόσφατο GPS και τη δηλωμένη επόμενη στάση, όχι σε χρόνο άφιξης. Η απουσία ένδειξης δεν σημαίνει ότι δεν υπάρχει δρομολόγιο."}</p>
        {#if app.statusFailed}<p class="warning">{en ? "Connection problem. Live stop counts are unavailable." : "Πρόβλημα σύνδεσης. Τα ζωντανά πλήθη στάσεων δεν είναι διαθέσιμα."}</p>{/if}
        {#each groups as group (group.key)}
          {@const service = group.first}
          {@const known = app.lineInfo.has(service.line)}
          {@const followed = app.selected.includes(service.line)}
          {@const blocked = !known || (!followed && app.selected.length >= 5)}
          {@const vehicles = mismatch || !app.status || app.statusFailed ? [] : group.services.flatMap(s => approachingStop(selected!, s, app.live[s.line], app.statics[s.line], app.serverNow / 1000)).sort((a,b) => a.stopsAway - b.stopsAway).slice(0,3)}
          <article><h4>{service.line} → {nameOf({ name: service.destination, name_en: service.destination_en })}</h4>
            {#if !service.boarding}<p class="note">{en ? "Terminates here; no boarding in this direction." : "Τερματίζει εδώ· δεν υπάρχει επιβίβαση σε αυτή την κατεύθυνση."}</p>{/if}
            <button type="button" disabled={blocked} onclick={() => follow(group.services)}>{followed ? (en ? "Show direction" : "Εμφάνιση κατεύθυνσης") : !service.boarding ? (en ? "Show arriving direction" : "Εμφάνιση κατεύθυνσης άφιξης") : (en ? "Follow this direction" : "Ακολούθησε την κατεύθυνση")}</button>
            {#if blocked}<p class="note">{!known ? (en ? "Not available in the current line index." : "Δεν υπάρχει στο τρέχον αρχείο γραμμών.") : (en ? "You can follow up to five lines. Remove one to add this line." : "Μπορείς να ακολουθείς έως πέντε γραμμές. Αφαίρεσε μία για να προσθέσεις αυτή.")}</p>{/if}
            {#if vehicles.length}<ul class="vehicles">{#each vehicles as vehicle (vehicle.id)}<li><b>{vehicle.stopsAway === 1 ? (en ? "Reported next stop" : "Δηλωμένη επόμενη στάση") : `${vehicle.stopsAway} ${en ? "stops away" : "στάσεις μακριά"}`}</b><small>{en ? "Vehicle" : "Όχημα"} {vehicle.id} · GPS {t(ago(vehicle.positionAt, app.serverNow))}</small></li>{/each}</ul>
            {:else if followed}<p class="note">{en ? "No fresh approaching vehicle can be confirmed for this direction." : "Δεν επιβεβαιώνεται πρόσφατο όχημα που πλησιάζει σε αυτή την κατεύθυνση."}</p>{/if}
          </article>
        {/each}
      </section>
    {/if}
  {/if}
</section>

<style>
  .finder { margin: 10px 0; padding: 12px; border: 1px solid var(--border); border-radius: 12px; font-size: 13px; }
  header { display: flex; align-items: center; gap: 8px; } h2 { flex: 1; font-size: 16px; margin: 0; } h3 { font-size: 15px; } h4 { font-size: 13px; margin: 0 0 8px; }
  .note, small { font-size: 12px; color: var(--muted); } p { margin: 8px 0; }
  button, input, select { min-height: 44px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--control); color: var(--fg); font: inherit; }
  button { cursor: pointer; } button:disabled { opacity: .55; cursor: default; } button:focus-visible,input:focus-visible,select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  label { display: grid; gap: 5px; margin: 10px 0; } input { width: 100%; min-width: 0; } .actions { display: flex; flex-wrap: wrap; gap: 6px; }
  .results,.vehicles { padding: 0; list-style: none; } .results li + li { margin-top: 6px; }
  .results button { display: grid; width: 100%; text-align: left; gap: 4px; overflow-wrap: anywhere; }
  .results span { color: var(--muted); font-size: 12px; } .warning { padding: 8px; background: var(--warn-bg); border-radius: 8px; }
  .selected,article { padding-top: 12px; margin-top: 12px; border-top: 1px solid var(--border); } .vehicles li { padding: 6px 0; display: grid; gap: 3px; }
</style>
