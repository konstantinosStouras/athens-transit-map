<script lang="ts">
  import { t as tr, locale, setLanguage, nameOf } from "../i18n.svelte";
  import { languageQuery } from "../../../public/language-url.js";
  import { tick } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import { directionGroups, focusGroup, otherDirection } from "../directions";
  import { ago, clock, duration, fmtMinutes } from "../format";
  import { STALE_S, type AppState } from "../state.svelte";
  import type { InstallState } from "../install.svelte";
  import Bell from "./Bell.svelte";
  import HelpPop from "./HelpPop.svelte";
  import LinePicker from "./LinePicker.svelte";
  import MetroToggles from "./MetroToggles.svelte";
  import RailExplorer from "./RailExplorer.svelte";
  import StatusBanner from "./StatusBanner.svelte";
  import VehicleType from "./VehicleType.svelte";
  import { trafficTileTemplate } from "../traffic";

  let { app, install, onaccount, signedIn }: { app: AppState; install: InstallState; onaccount: () => void; signedIn: boolean } = $props();

  // Phones start compact: the map matters more than the stats at a bus stop.
  let collapsed = $state(matchMedia("(max-width: 719px)").matches);
  // One popover at a time, opened from the buttons on the right: the map menu, what the symbols mean, or the
  // trip planner (loaded on first open), or help.
  let pop = $state<"layers" | "help" | "trip" | null>(null);
  // On a phone a popover covers the panel: what it covers cannot be reached by the keyboard either.
  const narrow = new MediaQuery("(max-width: 719px)");
  function toggleMobilePanel() { app.panelHidden = !app.panelHidden; }
  let tripButton: HTMLButtonElement | undefined = $state();
  let layersButton: HTMLButtonElement | undefined = $state();
  let helpButton: HTMLButtonElement | undefined = $state();
  let foldButton: HTMLButtonElement | undefined = $state();
  let focusOpen = $state(false);   // the direction rows of several lines, under their one summary row
  // Folded, the search field is hidden; the magnifier shows it (and the list under it) until a line is picked.
  let searching = $state(false);
  // The bar shrinks to its chips and buttons when nothing is open under it.
  const compact = $derived(collapsed && !searching);
  let alertHelp = $state(false);
  let installHelp = $state(false);
  let menuOpen = $state(false);
  let menuButton: HTMLButtonElement | undefined = $state();
  $effect(() => { if (menuOpen) void tick().then(() => document.querySelector<HTMLButtonElement>(".menu-heading button")?.focus()); });
  let stopsOpen = $state(false);
  let suburbanOpen = $state(false);
  const trafficTiles = import.meta.env.VITE_TRAFFIC_CREDIT?.trim() ? trafficTileTemplate(import.meta.env.VITE_TRAFFIC_TILES) : null;
  function railShown(mode: "tram" | "metro") {
    const ids = app.metro?.lines.filter(line => mode === "tram" ? /^T\d+$/.test(line.id) : /^M\d+$/.test(line.id)).map(line => line.id) ?? [];
    return ids.length > 0 && ids.every(id => app.metroLines.includes(id));
  }
  function showRail(mode: "tram" | "metro") {
    const ids = app.metro?.lines.filter(line => mode === "tram" ? /^T\d+$/.test(line.id) : /^M\d+$/.test(line.id)).map(line => line.id) ?? [];
    if (!ids.length) return;
    if (railShown(mode)) {
      app.setMetroLines(app.metroLines.filter(id => !ids.includes(id)));
      return;
    }
    app.setMetroLines([...new Set([...app.metroLines, ...ids])]);
    app.setStationsOn(true);
    app.selectStation(null);
    app.panelHidden = true;
    app.fitMetro(ids);
  }
  $effect(() => {
    if (app.stopRequest) { stopsOpen = true; app.panelHidden = false; pop = null; alertHelp = false; }
  });

  // Focus returns to the button that opened a popover.
  async function refocus(p: "layers" | "help" | "trip") {
    await tick();
    ({ layers: layersButton, help: helpButton, trip: tripButton })[p]?.focus();
  }
  const closeTrip = () => { pop = null; void tick().then(() => document.querySelector<HTMLButtonElement>(".directions-button")?.focus()); };   // its A and B stay on the map until its own ×
  const toggle = (p: "layers" | "help" | "trip") => {
    app.panelHidden = false;
    pop = pop === p ? null : p;
    if (pop === "help") void tick().then(() => document.getElementById("pop-help")?.focus());
    if (pop !== "layers") return;
    app.loadMetro();   // again, if the first load failed
    app.selectStation(null);   // its card would cover the menu's metro lines on a phone
  };
  // The chevron: opens and closes the dropdown.
  function fold() {
    searching = false;
    collapsed = !collapsed;
  }
  // A press anywhere outside the panel folds it: the map matters more. The trip planner stays open while the map is used.
  function dismiss(e: PointerEvent) {
    const target = e.target as Element | null;
    if (target?.closest?.(".menu-drawer, .menu-toggle")) return;
    if (menuOpen) menuOpen = false;
    if ((e.target as Element | null)?.closest?.(".panel, .rail, .popwrap, .maplibregl-popup")) return;
    if (app.selected.length || app.metroLines.length || pop === "trip" || suburbanOpen) app.panelHidden = true;
    if (pop === "trip") return;
    searching = false;
    collapsed = true;
    pop = null;
  }
  // Escape: a popover first, then the dropdown (when focus is in it; the search closes its own list).
  function onEscape(e: KeyboardEvent) {
    if (e.key !== "Escape") return;
    if (menuOpen) { menuOpen = false; e.stopPropagation(); void tick().then(() => menuButton?.focus()); return; }
    if (pop && pop !== "trip") {
      const p = pop;
      pop = null;
      e.stopPropagation();
      void refocus(p);
    } else if (!collapsed && (e.target as Element | null)?.closest?.("#panel-body")) {
      collapsed = true;
      e.stopPropagation();
      void tick().then(() => foldButton?.focus());
    }
  }

  const cityAge = $derived(app.city ? Math.max(0, app.serverNow / 1000 - app.city.updated_at) : null);
  const cityMissing = $derived(app.cityState === "unknown");

  // "040: μόνο → ΣΥΝΤΑΓΜΑ" for every line shown in one direction.
  const focused = $derived(Object.entries(app.focus).map(([line, variants]) => {
    const groups = app.statics[line] ? directionGroups(app.statics[line]) : [];
    const g = focusGroup(groups, variants);
    return { line, to: g?.to ?? "μία κατεύθυνση", other: otherDirection(groups, variants) };
  }));

  // Shown only while something is wrong: no data yet, or none for a while.
  const badge = $derived.by(() => {
    const city = !app.selected.length && app.cityOn && !cityMissing;
    if (!app.selected.length && !city) return null;
    const age = city ? cityAge : app.oldestAge;
    if (age == null) return { cls: "", text: "Σύνδεση…" };
    if (age > STALE_S) return { cls: "stale", text: "Χωρίς ενημέρωση" };
    return null;
  });

  // With motion off, ages are always shown: they are all that says how old a position is.
  $effect(() => { if (focused.length < 2) focusOpen = false; });

  const ages = $derived(app.showAges || !app.motion);

  const oldest = $derived.by(() => {
    const ts = app.selected.flatMap(l => (app.live[l] ? [app.live[l].updated_at] : []));
    return ts.length ? Math.min(...ts) : null;
  });
</script>

<!-- Escape is handled in capture, before the info card's handler. The trip planner stays open while the map is
     used; it closes itself (×, Escape). -->
<svelte:document onpointerdown={dismiss} />
<svelte:window onclick={e => { if (pop && pop !== "trip" && !(e.target as Element).closest?.(".pop, .tool")) pop = null; }}
  onkeydowncapture={onEscape} />

    <button type="button" class="account-control" class:signed-in={signedIn} onclick={onaccount} aria-label={locale.language === "en" ? (signedIn ? "My account" : "Sign in or register") : (signedIn ? "Ο λογαριασμός μου" : "Σύνδεση ή εγγραφή")} title={locale.language === "en" ? (signedIn ? "My account" : "Sign in or register") : (signedIn ? "Ο λογαριασμός μου" : "Σύνδεση ή εγγραφή")}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 21v-2a7.5 7.5 0 0 1 15 0v2"/></svg>
      <span>{locale.language === "en" ? (signedIn ? "Account" : "Sign in") : (signedIn ? "Λογαριασμός" : "Σύνδεση")}</span>
    </button>

{#if menuOpen}
<aside class="menu-drawer" aria-label={locale.language === "en" ? "Main menu" : "Κεντρικό μενού"}>
  <div class="menu-heading"><strong>OASA · Live</strong><button type="button" onclick={() => { menuOpen = false; void tick().then(() => menuButton?.focus()); }} aria-label={locale.language === "en" ? "Close menu" : "Κλείσιμο μενού"}>×</button></div>
  <p class="menu-label">{locale.language === "en" ? "Language" : "Γλώσσα"}</p>
    <div class="language" role="group" aria-label={locale.language === "el" ? "Γλώσσα" : "Language"}>
      <button type="button" lang="el" aria-label="Ελληνικά" aria-pressed={locale.language === "el"} onclick={() => setLanguage("el")}><img src={`${import.meta.env.BASE_URL}flags/el.svg`} alt="" width="27" height="18" /></button>
      <button type="button" lang="en" aria-label="English" aria-pressed={locale.language === "en"} onclick={() => setLanguage("en")}><img src={`${import.meta.env.BASE_URL}flags/en.svg`} alt="" width="27" height="18" /></button>
    </div>

  <p class="menu-label">{locale.language === "en" ? "Explore" : "Εξερεύνηση"}</p>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div role="presentation" onclick={(e) => { if ((e.target as Element).closest("button")) { menuOpen = false; if (!(e.target as Element).closest("[data-map-choice]")) app.panelHidden = false; } }}>
  <div class="service-actions" role="group" aria-label={locale.language === "en" ? "Data and alerts" : "Δεδομένα και ειδοποιήσεις"}>
    <button type="button" aria-expanded={stopsOpen} aria-controls="stop-finder" onclick={() => { app.stopRequest = null; stopsOpen = !stopsOpen; pop = null; alertHelp = false; }}>{locale.language === "en" ? "Stops near you" : "Στάσεις κοντά σου"}</button>
    <button type="button" aria-expanded={suburbanOpen} aria-controls="suburban-board" onclick={() => { suburbanOpen = !suburbanOpen; app.loadMetro(); pop = null; }}>{locale.language === "en" ? "ISAP, metro, tram & suburban departures" : "Αναχωρήσεις ΗΣΑΠ, μετρό, τραμ & προαστιακού"}</button>
    {#if app.metro}
      <button type="button" aria-pressed={railShown("metro")} data-map-choice onclick={() => showRail("metro")}>{locale.language === "en" ? (railShown("metro") ? "Hide metro routes from map" : "Show metro routes on map") : (railShown("metro") ? "Απόκρυψη γραμμών μετρό" : "Δείξε τις γραμμές μετρό στον χάρτη")}</button>
      <button type="button" aria-pressed={railShown("tram")} data-map-choice onclick={() => showRail("tram")}>{locale.language === "en" ? (railShown("tram") ? "Hide tram routes from map" : "Show tram routes on map") : (railShown("tram") ? "Απόκρυψη γραμμών τραμ" : "Δείξε τις γραμμές τραμ στον χάρτη")}</button>
    {:else}
      <button type="button" onclick={() => app.loadMetro()}>{locale.language === "en" ? "Load metro and tram map" : "Φόρτωση χάρτη μετρό και τραμ"}</button>
    {/if}
    <button type="button" onclick={() => { app.infoTab = "stats"; app.infoOpen = true; }}>{locale.language === "en" ? "Network statistics" : "Στατιστικά δικτύου"}</button>
    <button type="button" onclick={() => { app.infoTab = "sources"; app.infoOpen = true; }}>{locale.language === "en" ? "Data and limitations" : "Δεδομένα και περιορισμοί"}</button>
    <button type="button" aria-expanded={alertHelp} aria-controls="alert-guide" onclick={() => alertHelp = !alertHelp}><Bell />{locale.language === "en" ? " Set up an alert" : " Ρύθμιση ειδοποίησης"}</button>
    <button type="button" aria-expanded={installHelp} aria-controls="install-guide" onclick={() => installHelp = !installHelp}>{locale.language === "en" ? "Install app" : "Εγκατάσταση εφαρμογής"}</button>
  </div>
  </div>
  <p class="menu-label">{locale.language === "en" ? "News and feedback" : "Νέα και σχόλια"}</p>
  <nav class="shortcuts" aria-label={locale.language === "en" ? "About and feedback" : "Νέα και σχόλια"}>
    <a href={`${import.meta.env.BASE_URL}updates.html${languageQuery(locale.language)}`} title={tr("Τι νέο υπάρχει ↗")}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/></svg><span>{locale.language === "en" ? "What’s new" : "Νέα"}</span></a>
    <a href={`${import.meta.env.BASE_URL}submit-feedback.html${languageQuery(locale.language)}`} title={tr("Στείλε σχόλιο με εικόνα ↗")}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5a9.5 9.5 0 1 1 19 0Z"/><path d="M7 9h9M7 13h6"/></svg><span>{locale.language === "en" ? "Feedback" : "Σχόλιο"}</span></a>
    <a href={`${import.meta.env.BASE_URL}feedback.html${languageQuery(locale.language)}`} title={tr("Σχόλια μέχρι σήμερα ↗")}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="9" cy="7" r="3"/><path d="M2 21v-3a7 7 0 0 1 14 0v3M16 4a3 3 0 0 1 0 6M19 21v-3a7 7 0 0 0-2-5"/></svg><span>{locale.language === "en" ? "Community" : "Κοινότητα"}</span></a>
    <a href={`${import.meta.env.BASE_URL}contact.html${languageQuery(locale.language)}`}>{locale.language === "en" ? "Contact and developers" : "Επικοινωνία και προγραμματιστές"}</a>
  </nav>
</aside>
{/if}
<section class="panel" class:mobile-collapsed={app.panelHidden} class:compact inert={!!pop && pop !== "trip" && narrow.current} aria-label={tr("Πίνακας ελέγχου")}>
  <header class="panel-header">
    <button type="button" class="menu-toggle" bind:this={menuButton} aria-expanded={menuOpen} aria-label={locale.language === "en" ? "Open menu" : "Άνοιγμα μενού"} onclick={() => menuOpen = !menuOpen}><span aria-hidden="true">☰</span></button>
      <button type="button" class="panel-toggle brand" onclick={toggleMobilePanel} aria-expanded={!app.panelHidden} aria-controls="mobile-panel-content"
        aria-label={locale.language === "en" ? (app.panelHidden ? "Show my choices" : "Show map, keep my choices") : (app.panelHidden ? "Άνοιγμα πίνακα ελέγχου" : "Σύμπτυξη πίνακα ελέγχου")}
        title={locale.language === "en" ? (app.panelHidden ? "Show my choices" : "Show map, keep my choices") : (app.panelHidden ? "Άνοιγμα πίνακα ελέγχου" : "Σύμπτυξη πίνακα ελέγχου")}>
        <span>{locale.language === "en" ? (app.panelHidden ? "Show my choices" : "Show map") : (app.panelHidden ? "Οι επιλογές μου" : "Εμφάνιση χάρτη")}</span>
        <svg viewBox="0 0 12 8" width="12" height="8" aria-hidden="true" class:expanded={!app.panelHidden}><path d="m1 1 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
  </header>
  <div id="mobile-panel-content" hidden={app.panelHidden}>

  <h1 class="sr">{tr("Λεωφορεία ΟΑΣΑ")}</h1>



  {#if installHelp}
    <section id="install-guide" class="alert-guide" aria-label={locale.language === "en" ? "Install the app" : "Εγκατάσταση εφαρμογής"}>
      {#if install.standalone}
        <p role="status">{locale.language === "en" ? "You are using the home-screen app." : "Χρησιμοποιείς την εφαρμογή από την αρχική οθόνη."}</p>
      {:else if install.installed}
        <p role="status">{locale.language === "en" ? "Installation completed. Open the app from your home screen." : "Η εγκατάσταση ολοκληρώθηκε. Άνοιξε την εφαρμογή από την αρχική οθόνη."}</p>
      {/if}
      {#if install.promptEvent && !install.standalone}
        <button type="button" disabled={install.busy} onclick={() => install.prompt()}>{locale.language === "en" ? "Install on this device" : "Εγκατάσταση σε αυτή τη συσκευή"}</button>
      {/if}
      <p><strong>{locale.language === "en" ? "iPhone / iPad" : "iPhone / iPad"}</strong><br>{locale.language === "en" ? "In Safari, tap Share, then Add to Home Screen. Turn on Open as Web App if offered, and tap Add." : "Στο Safari πάτησε Κοινοποίηση και μετά Προσθήκη στην οθόνη Αφετηρίας. Αν εμφανιστεί, ενεργοποίησε το Άνοιγμα ως εφαρμογή Ιστού και πάτησε Προσθήκη."}</p>
      <p><strong>Android</strong><br>{locale.language === "en" ? "In Chrome, open the menu (⋮), choose Install app or Add to Home screen, and follow the prompts." : "Στο Chrome άνοιξε το μενού (⋮), επίλεξε Εγκατάσταση εφαρμογής ή Προσθήκη στην αρχική οθόνη και ακολούθησε τις οδηγίες."}</p>
      <details><summary>{locale.language === "en" ? "Original project’s Android preview" : "Δοκιμαστική εφαρμογή Android του αρχικού έργου"}</summary>
        <p>{locale.language === "en" ? "The original project publishes an Android APK preview on GitHub (v0.1.7, checked 28 October). This is a separate edition and may differ from this website. We have not tested the APK on a device or verified a Google Play listing." : "Το αρχικό έργο δημοσιεύει δοκιμαστικό APK Android στο GitHub (v0.1.7, έλεγχος 28 Οκτωβρίου). Είναι ξεχωριστή έκδοση και μπορεί να διαφέρει από αυτόν τον ιστότοπο. Δεν δοκιμάσαμε το APK σε συσκευή ούτε επαληθεύσαμε καταχώριση στο Google Play."}</p>
        <a href="https://github.com/angelospk/athens-transit-app/releases/tag/v0.1.7" target="_blank" rel="noopener noreferrer">{locale.language === "en" ? "View the original Android preview release ↗" : "Δες τη δοκιμαστική έκδοση Android ↗"}</a>
      </details>
      <p>{locale.language === "en" ? "Sign in to sync your language and favorite lines. Browser alerts depend on device support and permission; on iPhone, open the installed app before setting up alerts. An internet connection is needed for live data." : "Συνδέσου για συγχρονισμό γλώσσας και αγαπημένων γραμμών. Οι ειδοποιήσεις browser εξαρτώνται από τη συσκευή και την άδεια· στο iPhone άνοιξε πρώτα την εγκατεστημένη εφαρμογή. Τα ζωντανά δεδομένα χρειάζονται σύνδεση στο διαδίκτυο."}</p>
      <button type="button" onclick={() => { installHelp = false; alertHelp = true; }}>{locale.language === "en" ? "Set up an alert" : "Ρύθμιση ειδοποίησης"}</button>
    </section>
  {/if}
  {#if stopsOpen}
    <div id="stop-finder">
      {#key app.stopRequest}
        {#await import("./StopFinder.svelte")}
          <p role="status">{locale.language === "en" ? "Loading stops…" : "Φόρτωση στάσεων…"}</p>
        {:then module}
          <module.default {app} seed={app.stopRequest} onclose={() => { stopsOpen = false; app.stopRequest = null; }} />
        {:catch}
          <p role="status">{locale.language === "en" ? "Stop finder could not load. Close it and try again." : "Η αναζήτηση στάσεων δεν φόρτωσε. Κλείσε την και δοκίμασε ξανά."}</p>
        {/await}
      {/key}
    </div>
  {/if}
  {#if suburbanOpen}<div id="suburban-board"><button type="button" onclick={() => suburbanOpen = false}>{locale.language === "en" ? "Close rail departures" : "Κλείσιμο αναχωρήσεων"}</button><RailExplorer {app} /></div>{/if}
  {#if alertHelp}
    <section id="alert-guide" class="alert-guide" aria-label={locale.language === "en" ? "Notification setup" : "Οδηγίες ειδοποιήσεων"}>
      <ol>
        <li>{locale.language === "en" ? "Open Plan a journey. Choose a starting point (or My location) and a destination from the suggestions." : "Άνοιξε το Σχεδίασε διαδρομή. Διάλεξε αφετηρία (ή Η θέση μου) και προορισμό από τις προτάσεις."}</li>
        <li>{locale.language === "en" ? "Once suitable bus routes appear, open Notification and choose how many stops before boarding to be notified." : "Όταν εμφανιστούν κατάλληλες γραμμές λεωφορείου, άνοιξε την Ειδοποίηση και διάλεξε πόσες στάσεις πριν την επιβίβαση θέλεις ενημέρωση."}</li>
        <li>{locale.language === "en" ? "Choose Here for browser alerts, or In Telegram and press Start in the bot. Recurring alerts use Telegram." : "Διάλεξε Εδώ για ειδοποιήσεις browser ή Στο Telegram και πάτησε Start στο bot. Οι επαναλαμβανόμενες ειδοποιήσεις χρησιμοποιούν Telegram."}</li>
      </ol>
      <p>{locale.language === "en" ? "Browser alerts depend on permission and web-push support; otherwise keep this page open. The planner explains the available mode. Alerts require current route and stop data and are not exact arrival-time predictions." : "Οι ειδοποιήσεις browser εξαρτώνται από την άδεια και την υποστήριξη web push· διαφορετικά κράτησε τη σελίδα ανοιχτή. Ο σχεδιαστής εξηγεί τη διαθέσιμη λειτουργία. Απαιτούνται τρέχοντα δεδομένα γραμμών και στάσεων· δεν είναι ακριβείς προβλέψεις χρόνου άφιξης."}</p>
      <button type="button" onclick={() => { if (pop !== "trip") toggle("trip"); alertHelp = false; }}>{locale.language === "en" ? "Open journey planner" : "Άνοιγμα σχεδιαστή διαδρομής"}</button>
    </section>
  {/if}

  {#if pop === "trip"}
      {#await import("./TripPlanner.svelte")}
        <div class="pop"><p class="hint">{tr("Φόρτωση…")}</p></div>
      {:then m}
        <m.default {app} onclose={closeTrip} />
      {:catch}
        <div class="pop"><p class="hint">{tr("Δεν φόρτωσε. Έλεγξε τη σύνδεση και πάτα ξανά την πυξίδα.")}</p></div>
      {/await}
  {/if}
  <div hidden={pop === "trip"}>
  <!-- Always shown: the picked lines, the search, and the chevron. The map buttons are on the right (.rail). -->
  <div class="bar">
    <LinePicker {app} expanded={!collapsed} searchOpen={searching} onsearch={() => (searching = true)} onclose={() => (searching = false)} ondirections={() => toggle("trip")} {tail} />
  </div>

  {#if app.selected.length || app.cityOn}
  <div class="freshness" class:stale={badge?.cls === "stale" || app.statusFailed}>
    <span class="live-dot"></span>
    {#if app.statusFailed}{tr("Πρόβλημα σύνδεσης · νέα προσπάθεια σε λίγο\r\n    ")}{:else if badge}{tr(badge.text)}
    {:else if oldest != null}{tr("Ενημέρωση ")}{tr(ago(oldest, app.serverNow))}
    {:else if app.city}{tr("Ενημέρωση ")}{tr(ago(app.city.updated_at, app.serverNow))}
    {:else}{tr("Σύνδεση με τα ζωντανά δεδομένα…")}{/if}
  </div>
  {/if}
  <!-- The dropdown: the tools, then what the picked lines are doing. -->
  <div id="panel-body" hidden={collapsed}>
    <div class="tools">
      {#if badge}
        <span class="badge {badge.cls}" title={tr("Ανανέωση μόλις ο διακομιστής έχει νέα δεδομένα (περίπου κάθε 30 δευτερόλεπτα)")}>
          <i></i><span>{tr(badge.text)}</span>
        </span>
      {/if}
    </div>

    {#if !app.selected.length && !(app.cityOn && !cityMissing)}
      <div class="muted">{tr("Διάλεξε έως 5 γραμμές για να δεις τα οχήματα ζωντανά.")}</div>
    {/if}

    {#each app.selected as id (id)}
      <div class="line-summary">
        <strong>{tr(id)} · {tr(nameOf(app.lineInfo.get(id)) || "Φόρτωση γραμμής…")}</strong>
        <VehicleType kind={app.lineInfo.get(id)?.kind} />
        {#if app.statics[id]}
          <div class="direction-actions" aria-label={tr((`Κατευθύνσεις γραμμής ${id}`))}>
            <button type="button" aria-pressed={!app.focus[id]} onclick={() => app.setFocus(id, null)}>{tr("Και οι δύο κατευθύνσεις")}</button>
            {#each directionGroups(app.statics[id], locale.language) as g}
              <button type="button" aria-pressed={app.focus[id]?.join() === g.variants.join()} onclick={() => { app.setFocus(id, g.variants); app.selectRoute(id, g.variants[0]); }}>→ {tr(g.to)}</button>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
    <details class="network-details"><summary>{tr("Στατιστικά & υπόμνημα χάρτη")}</summary>
    {#if app.selected.length || (app.cityOn && app.city)}
      <div class="stats">
        <div><b>{tr(app.stats.vehicles)}</b><span>{tr("οχήματα")}</span></div>
        <div><b>{tr(app.stats.matched)}</b><span>{tr("με δρομολόγιο")}</span></div>
        <div>
          <b>{#if app.stats.median == null}–{:else}{tr(fmtMinutes(app.stats.median))} <small>{tr("λεπτά")}</small>{/if}</b>
          <span>{tr("διάμεση καθυστ.")}</span>
        </div>
      </div>
    {/if}

    <div class="legend">
      <span class="lead">{tr("Καθυστέρηση:")}</span>
      <span><i class="ontime"></i>{tr("έως 2′ ή νωρίτερα")}</span><span><i class="late1"></i>2–5′</span>
      <span><i class="late2"></i>5–10′</span><span><i class="late3"></i>{tr("πάνω από 10′")}</span>
      <span><i class="none"></i>{tr("χωρίς δρομολόγιο")}</span>
      {#if ages}<span><b class="age">24″</b>{tr("πριν από τόσο ήρθε η θέση")}</span>{/if}
    </div>

    </details>
    {#if focused.length}
      {#if focused.length > 1}
        <!-- Several lines in one direction: one row, the rows of each line behind the chevron. -->
        <div class="focus">
          <span>{tr(focused.map(f => f.line).join(", "))}{tr(": μία κατεύθυνση")}</span>
          <button type="button" title={tr("Όλες οι κατευθύνσεις")} aria-label={tr("Δείξε όλες τις κατευθύνσεις όλων των γραμμών")}
            onclick={() => { for (const f of focused) app.setFocus(f.line, null); }}>×</button>
          <button type="button" aria-expanded={focusOpen} aria-controls="focus-rows" aria-label={tr("Κατευθύνσεις ανά γραμμή")}
            onclick={() => (focusOpen = !focusOpen)}>
            <svg viewBox="0 0 12 8" width="12" height="8" aria-hidden="true" class={{ up: focusOpen }}><path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
        </div>
      {/if}
      <div id="focus-rows" hidden={focused.length > 1 && !focusOpen}>
      {#each focused as f (f.line)}
        <div class="focus">
          <span>{tr(f.line)}{tr(": μόνο → ")}{tr(f.to)}</span>
          {#if f.other}
            {@const other = f.other}
            <button type="button" title={tr("Άλλη κατεύθυνση: → " + (other.to))} aria-label={tr("Δείξε την άλλη κατεύθυνση της " + (f.line) + ", προς " + (other.to))}
              onclick={() => app.setFocus(f.line, other.variants)}>⇄</button>
          {/if}
          <button type="button" title={tr("Όλες οι κατευθύνσεις")} aria-label={tr("Δείξε όλες τις κατευθύνσεις της " + (f.line))}
            onclick={() => app.setFocus(f.line, null)}>×</button>
        </div>
      {/each}
      </div>
    {/if}
    {#if app.alert}
      {@const a = app.alert}
      <div class="focus">
        <span><Bell /> {tr(a.lines.map(l => l.line).join(", "))} · {tr(a.n === 1 ? "στην προηγούμενη στάση" : `${a.n} στάσεις πριν`)}{tr(" · έως ")}{tr(clock(a.until).slice(0, 5))}</span>
        <button type="button" title={tr("Τέλος ειδοποίησης")} aria-label={tr("Σταμάτα την ειδοποίηση")} onclick={() => app.setAlert(null)}>×</button>
      </div>
    {/if}
  </div>

  {#snippet tail()}
    <button type="button" class="fold" aria-expanded={!collapsed} aria-controls="panel-body" bind:this={foldButton}
      aria-label={tr((collapsed ? "Εμφάνιση λεπτομερειών" : "Απόκρυψη λεπτομερειών"))} onclick={fold}>
      <svg viewBox="0 0 12 8" width="14" height="10" aria-hidden="true" class={{ up: !collapsed }}>
        <path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
  {/snippet}
  </div>
  {#each app.hits as h (h.id)}
    <div class="hit" role="alert">
      <span>🚌 {tr(h.text)}</span>
      <button type="button" aria-label={tr("Κλείσιμο")} onclick={() => app.dismissHit(h.id)}>×</button>
    </div>
  {/each}
  <StatusBanner {app} />

  </div>
</section>


<!-- The popover of a map button opens on the right, beside the buttons (on a phone over the panel). -->
{#if pop && pop !== "trip"}
  <div class="popwrap raised">
    {#if pop === "help"}
      <div class="pop" id="pop-help" role="dialog" tabindex="-1" aria-label={tr("Τι σημαίνει κάθε σύμβολο")}>
        <HelpPop />
      </div>
    {:else if pop === "layers"}
      <div class="pop" id="pop-layers" role="dialog" aria-label={tr("Τι δείχνει ο χάρτης")}>
        <h3>{tr("Τι δείχνει ο χάρτης")}</h3>
        <section>
          <h4>{tr("Θέμα χάρτη")}</h4>
          <div class="seg" role="radiogroup" aria-label={tr("Θέμα")}>
            {#each [["system", "Συσκευής"], ["light", "Φωτεινό"], ["dark", "Σκοτεινό"]] as const as [v, label] (v)}
              <button type="button" role="radio" aria-checked={app.theme === v} onclick={() => app.setTheme(v)}>{tr(label)}</button>
            {/each}
          </div>
        </section>
        <section>
          <h4>{tr("Λεωφορεία")}</h4>
          <label class="switch">
            <input type="checkbox" checked={app.cityOn} disabled={cityMissing} onchange={e => app.setCityOn(e.currentTarget.checked)} />
            <span>{tr("Και των άλλων γραμμών ")}<small>{#if cityMissing}{tr("(όχι ακόμα διαθέσιμο)")}{:else if app.city}· {tr(app.city.vehicles.length)}{tr(" τώρα")}{/if}</small><br />
              <small>{tr("Όλα τα λεωφορεία της πόλης, όχι μόνο οι γραμμές που διάλεξες. Κλειστό: λιγότερα δεδομένα.")}</small></span>
          </label>
          <div class="field" role="radiogroup" aria-label={tr("Τα άλλα λεωφορεία όταν πατάς ένα")}>
            <span>{tr("Όταν πατάς ένα, τα άλλα:")}</span>
            <div class="seg">
              {#each [["normal", "Κανονικά"], ["dim", "Αχνά"], ["hide", "Κρυφά"]] as const as [v, label] (v)}
                <button type="button" role="radio" aria-checked={app.others === v} onclick={() => app.setOthers(v)}>{tr(label)}</button>
              {/each}
            </div>
          </div>
        </section>
        <section>
          <h4>{tr("Φίλτρα λεωφορείων ")}<small>{tr("· κρύβουν όσα δεν ταιριάζουν")}</small></h4>
          <label class="switch">
            <input type="checkbox" checked={app.only.fresh} onchange={e => app.setOnly({ fresh: e.currentTarget.checked })} />
            <span>{tr("Μόνο με πρόσφατη θέση")}<br /><small>{tr("Έστειλαν θέση τα τελευταία 1½ λεπτά.")}</small></span>
          </label>
          <label class="switch">
            <input type="checkbox" checked={app.only.onTime} onchange={e => app.setOnly({ onTime: e.currentTarget.checked })} />
            <span>{tr("Μόνο στην ώρα τους")}<br /><small>{tr("Έως 5 λεπτά καθυστέρηση.")}</small></span>
          </label>
        </section>
        <section>
          <h4>{tr("Κίνηση λεωφορείων")}</h4>
          <label class="switch">
            <input type="checkbox" checked={app.motion} onchange={e => app.setMotion(e.currentTarget.checked)} />
            <span>{tr("Κίνηση ανάμεσα στις θέσεις")}<br /><small>{tr("Κλειστό: το όχημα μένει εκεί που έστειλε θέση.")}</small></span>
          </label>
          <label class="switch">
            <input type="checkbox" checked={ages} disabled={!app.motion} onchange={e => app.setShowAges(e.currentTarget.checked)} />
            <span>{tr("Ηλικία θέσης ")}<b class="age">24″</b><br /><small>{#if app.motion}{tr("Πριν πόσο έστειλε θέση.")}{:else}{tr("Πάντα ανοιχτό όταν η κίνηση είναι κλειστή.")}{/if}</small></span>
          </label>
          <details class="hint">
            <summary>{tr("Πώς κινούνται")}</summary>{tr("\r\n            Ο ΟΑΣΑ στέλνει θέσεις κάθε 20–60″. Όταν η νέα θέση είναι πολύ μπροστά, το όχημα πηγαίνει γρήγορα ως εκεί, πάνω\r\n            στον δρόμο, και αφήνει για λίγο μπλε ίχνος. Όταν είναι πίσω, γυρίζει αχνό πάνω στον δρόμο με γκρι διακεκομμένο\r\n            ίχνος: διόρθωση θέσης, όχι όπισθεν. Αχνό όχημα με πορτοκαλί ηλικία: δεν έστειλε θέση για πάνω από 1½ λεπτό, άρα μπορεί να είναι αλλού.\r\n            ")}{#if oldest != null}<br /><span title={tr("Ώρα δεδομένων " + (clock(oldest)))}>{tr("Ενημέρωση γραμμών πριν ")}{tr(duration(Math.max(0, app.serverNow / 1000 - oldest)))}.</span>{/if}
            {#if cityAge != null && app.cityOn}<br /><span title={tr("Ώρα δεδομένων " + (clock(app.city!.updated_at)))}>{tr("Ενημέρωση πόλης πριν ")}{tr(duration(cityAge))}.</span>{/if}
          </details>
        </section>
        <section>
          <h4>{tr("Ταχύτητα λεωφορείων")}</h4>
          <label class="switch">
            <input type="checkbox" checked={app.speedOn} onchange={e => app.setSpeedOn(e.currentTarget.checked)} />
            <span>{tr("Τυπική ταχύτητα ανά δρόμο")}<br /><small>{tr("Από στάση σε στάση, από τις θέσεις GPS. Πάτα ένα κομμάτι για km/h.")}</small></span>
          </label>
        </section>
        {#if trafficTiles}
          <section>
            <h4>{locale.language === "en" ? "Road traffic" : "Κίνηση δρόμων"}</h4>
            <label class="switch"><input type="checkbox" checked={app.trafficOn} onchange={e => app.trafficOn = e.currentTarget.checked} />
              <span>{locale.language === "en" ? "Show traffic overlay" : "Εμφάνιση κίνησης"}<br /><small>{locale.language === "en" ? "Traffic data from the configured provider; availability and freshness depend on that source." : "Δεδομένα κίνησης από τη ρυθμισμένη πηγή· η διαθεσιμότητα και η ανανέωση εξαρτώνται από αυτή."}{#if import.meta.env.VITE_TRAFFIC_CREDIT} · {import.meta.env.VITE_TRAFFIC_CREDIT}{/if}</small></span>
            </label>
          </section>
        {/if}
        <section>
          <h4>{tr("Μετρό, ΗΣΑΠ και τραμ")}</h4>
          <p class="hint">{locale.language === "en" ? "Tap a station for STASY timetable departures. Suburban departure boards are in the Explore menu." : "Πάτησε σταθμό για αναχωρήσεις από το πρόγραμμα ΣΤΑΣΥ. Οι πίνακες προαστιακού είναι στο μενού Εξερεύνηση."}</p>
          {#if import.meta.env.VITE_RAIL_REALTIME_URL?.trim()}
            <p class="hint">{locale.language === "en" ? "Blue numbered circles are recent live rail positions when the configured feed is available. Tracks and stations are static." : "Οι μπλε αριθμημένοι κύκλοι δείχνουν πρόσφατες ζωντανές θέσεις συρμών όταν η συνδεδεμένη πηγή είναι διαθέσιμη. Οι γραμμές και οι σταθμοί είναι στατικοί."}</p>
          {/if}
          <label class="switch">
            <input type="checkbox" checked={app.stationsOn} onchange={e => app.setStationsOn(e.currentTarget.checked)} />
            <span>{tr("Σταθμοί στον χάρτη")}<br /><small>{tr("Κλειστό: κρύβονται οι σταθμοί (οι γραμμές που άνοιξες μένουν).")}</small></span>
          </label>
          <p class="hint">{tr("Άνοιξε μια γραμμή για να φαίνεται η διαδρομή της.")}</p>
          {#if app.metro}
            <MetroToggles {app} ids={app.metro.lines.map(l => l.id)} />
          {:else}
            <p class="hint">{tr("Φόρτωση…")}</p>
          {/if}
        </section>
      </div>
    {/if}
  </div>
{/if}

<div class="rail" role="toolbar" aria-label={tr("Εργαλεία χάρτη")}>
  <button type="button" class="tool" class:on={pop === "layers"} class:filtering={app.only.fresh || app.only.onTime} aria-expanded={pop === "layers"} aria-controls="pop-layers"
    bind:this={layersButton} aria-label={tr("Τι δείχνει ο χάρτης")} data-tip={tr("Τι δείχνει ο χάρτης: θέμα, λεωφορεία, φίλτρα, ταχύτητα, μετρό")} onclick={() => toggle("layers")}>
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">
      <path d="M2 10S5 4.8 10 4.8 18 10 18 10 15 15.2 10 15.2 2 10 2 10z" /><circle cx="10" cy="10" r="2.5" />
    </svg>
  </button>

  <button type="button" class="tool" class:on={pop === "help"} aria-expanded={pop === "help"} aria-controls="pop-help"
    aria-label={tr("Τι σημαίνει κάθε σύμβολο")} data-tip={tr("Τι σημαίνει κάθε σύμβολο και χρώμα στον χάρτη")} onclick={() => toggle("help")} bind:this={helpButton}>
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="10" cy="10" r="8" /><path d="M7.8 7.9a2.3 2.3 0 1 1 3.3 2.1c-.7.4-1.1.8-1.1 1.6" /><circle cx="10" cy="14.2" r=".5" fill="currentColor" />
    </svg>
  </button>

</div>

<style>
  .service-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
  .service-actions button, .alert-guide button { min-height: 44px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 9px; background: var(--control); color: var(--fg); cursor: pointer; font-size: 12px; }
  .service-actions button[aria-pressed="true"], .service-actions button[aria-expanded="true"] { border-color: var(--accent); color: var(--accent); }
  .service-actions button:hover, .alert-guide button:hover { background: var(--control-hover); }
  .service-actions button:focus-visible, .alert-guide button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .alert-guide { padding: 12px; margin-bottom: 12px; background: var(--control); border-radius: 10px; font-size: 13px; }
  .alert-guide ol { padding-left: 20px; margin: 0; }
  .alert-guide li + li { margin-top: 8px; }
  .alert-guide p { color: var(--muted); font-size: 12px; }
  .panel-header { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 8px; margin-bottom: 12px; }
  .menu-toggle, .menu-heading button { width: 44px; height: 44px; border: 0; border-radius: 10px; background: var(--control); color: var(--fg); cursor: pointer; font-size: 23px; }
  .menu-drawer { position: fixed; z-index: 12; top: 0; bottom: 0; left: 0; width: min(340px, 90vw); padding: max(16px, env(safe-area-inset-top)) 16px 20px; overflow-y: auto; background: var(--bg); border-right: 1px solid var(--border); box-shadow: var(--shadow); }
  .menu-heading { display: flex; align-items: center; justify-content: space-between; font-size: 17px; }
  .menu-label { margin: 24px 0 8px; font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase; }
  .menu-drawer .service-actions, .menu-drawer .shortcuts { display: flex; flex-direction: column; }
  .menu-drawer .service-actions button, .menu-drawer .shortcuts a { width: 100%; justify-content: flex-start; text-align: left; font-size: 14px; padding: 10px 12px; }
  .menu-drawer .shortcuts a { flex-direction: row; }
  .account-control { position: fixed; z-index: 9; top: calc(12px + env(safe-area-inset-top)); right: 64px; }
  .account-control span { display: none; }
  .panel-toggle { display: flex; align-items: center; justify-content: space-between; gap: 5px; min-height: 44px; min-width: 44px; padding: 0; border: 0; background: none; color: var(--fg); cursor: pointer; text-align: left; }
  .panel-toggle svg { flex: none; color: var(--muted); }
  .panel-toggle svg.expanded { transform: rotate(180deg); }
  .panel-toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 6px; }

  .panel.mobile-collapsed { width: max-content; max-width: calc(100% - 76px); }
  .panel.mobile-collapsed .panel-header { margin-bottom: 0; }
  #mobile-panel-content[hidden] { display: none; }

  .brand { font-weight: 800; font-size: 15px; white-space: nowrap; letter-spacing: -.02em; }
  .language { display: flex; gap: 4px; }
  .language img { display: block; margin: auto; border-radius: 2px; }
  .language button { width: 44px; height: 44px; border: 1px solid var(--border); border-radius: 10px; background: var(--control); cursor: pointer; padding: 0; }
  .language button[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); }
  .account-control { display: flex; align-items: center; justify-content: center; gap: 7px; min-width: 44px; min-height: 44px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--control); color: var(--fg); cursor: pointer; font-size: 12px; font-weight: 650; }
  .account-control.signed-in { color: var(--accent); border-color: var(--accent); }
  .shortcuts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin-bottom: 14px; }
  .shortcuts a { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; padding: 7px 5px; border: 1px solid var(--border); border-radius: 10px; background: var(--control); color: var(--muted); text-decoration: none; font-size: 11px; font-weight: 600; text-align: center; line-height: 1.25; }
  .shortcuts svg, .account-control svg { flex: none; }
  .shortcuts a:hover, .account-control:hover, .language button:not([aria-pressed="true"]):hover { background: var(--control-hover); color: var(--fg); }
  .shortcuts a:focus-visible, .account-control:focus-visible, .language button:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
  @media (max-width: 719px) { .account-control { padding: 0; } .account-control span { display: none; } .brand { font-size: 14px; } .shortcuts a { flex-direction: column; gap: 4px; min-height: 54px; } }
  .freshness { display: flex; align-items: center; gap: 7px; margin-top: 10px; font-size: 12px; color: var(--muted); }
  .live-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--ontime); flex: none; }
  .freshness.stale .live-dot { background: var(--late3); }
  .line-summary { padding: 10px 0; border-bottom: 1px solid var(--border); }
  .line-summary strong { display: block; font-size: 14px; }
  .direction-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .direction-actions button { min-height: 40px; padding: 6px 10px; border: 1px solid var(--border); border-radius: 9px; background: var(--control); cursor: pointer; font-size: 12px; }
  .direction-actions button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent); }
  .network-details { margin-top: 12px; font-size: 13px; }
  .network-details summary { cursor: pointer; padding: 6px 0; color: var(--muted); }

  .panel { position: absolute; z-index: 5; top: calc(12px + env(safe-area-inset-top)); left: 12px; width: 380px;
    max-width: calc(100% - 64px); padding: 12px 14px; background: var(--panel); border: 1px solid var(--border);
    border-radius: 14px; box-shadow: var(--shadow); max-height: calc(100dvh - 40px); overflow-y: auto; overflow-x: hidden; }
  .panel.compact { width: 380px; }
  .sr { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  #panel-body { margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--border); }
  .tools { display: flex; align-items: center; gap: 2px; }
  .badge { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--muted);
    white-space: nowrap; }
  .badge i { width: 8px; height: 8px; border-radius: 50%; background: var(--none); }
  .badge.stale i { background: var(--late3); }
  .tool { display: grid; place-items: center; flex: none; width: 40px; height: 40px; margin: 0; border: 0; border-radius: 8px;
    background: none; color: var(--muted); cursor: pointer; }
  .tool:hover, .tool.on { background: var(--control); color: var(--fg); }
  /* A map filter is on: some vehicles are hidden. */
  .tool { position: relative; }
  .tool.filtering::after, .tool.pinned::after { content: ""; position: absolute; top: 6px; right: 6px; width: 7px; height: 7px;
    border-radius: 50%; background: var(--accent); }
  /* The map buttons (right, under the zoom and locate buttons) and the popover that opens beside them. */
  /* The same look and size as MapLibre's zoom and locate buttons above it (white in dark too). */
  .rail { position: absolute; z-index: 5; top: calc(116px + env(safe-area-inset-top)); right: 10px; width: 44px; display: flex;
    flex-direction: column; background: #fff; border-radius: 4px; box-shadow: 0 0 0 2px rgba(0, 0, 0, .1); }
  .rail .tool { width: 44px; height: 44px; border-radius: 0; color: #333; }
  .rail .tool + .tool { border-top: 1px solid #ddd; }
  .rail .tool:first-child { border-radius: 4px 4px 0 0; }
  .rail .tool:last-child { border-radius: 0 0 4px 4px; }
  .rail .tool:hover, .rail .tool.on { background: rgba(0, 0, 0, .08); color: #333; }
  .rail .tool.on { color: var(--accent); }
  .rail .tool.filtering::after { top: 3px; right: 3px; }
  /* What a button does: beside it, on hover or keyboard focus (no tooltip on a touch screen; the popover itself opens). */
  .rail .tool::before { content: attr(data-tip); position: absolute; right: calc(100% + 10px); top: 50%; translate: 0 -50%; width: max-content;
    max-width: 220px; padding: 6px 9px; border-radius: 8px; background: var(--panel); color: var(--fg); border: 1px solid var(--border);
    box-shadow: var(--shadow); font-size: 12px; line-height: 1.35; white-space: normal; text-align: left; pointer-events: none;
    opacity: 0; transition: opacity .12s; }
  @media (hover: hover) { .rail .tool:not(.on):hover::before { opacity: 1; transition-delay: .35s; } }
  .rail .tool:not(.on):focus-visible::before { opacity: 1; }
  .popwrap { position: absolute; z-index: 5; overflow: hidden; border-radius: 14px; top: calc(116px + env(safe-area-inset-top)); right: 66px; width: 380px; max-width: calc(100% - 64px);
    max-height: calc(100dvh - 128px - env(safe-area-inset-top)); display: flex; flex-direction: column; }
  .popwrap.raised { z-index: 8; }   /* the map menu over the info card */
  .pop { min-height: 0; padding: 12px 14px; font-size: 13px; background: var(--bg); border: 1px solid var(--border);
    border-radius: 14px; box-sizing: border-box; overflow-y: auto; overscroll-behavior: contain; }
  .pop p { margin: 0 0 8px; }
  .pop h3 { margin: 0 0 10px; font-size: 15px; }
  .pop h4 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
  .pop section + section { margin-top: 4px; padding-top: 10px; border-top: 1px solid var(--border); }
  .pop .age { margin-right: 4px; padding: 0 4px; border-radius: 6px; background: var(--control); font-size: 11px;
    font-variant-numeric: tabular-nums; }
  .hint { color: var(--muted); font-size: 12px; }
  .field > span { display: block; color: var(--muted); font-size: 12px; margin-bottom: 4px; }
  .seg { display: flex; padding: 2px; border-radius: 9px; background: var(--control); margin-bottom: 10px; }
  .seg button { flex: 1; min-height: 30px; border: 0; border-radius: 7px; background: none; cursor: pointer; font-size: 12px; }
  .seg button[aria-checked="true"] { background: var(--panel); box-shadow: 0 1px 3px rgba(0, 0, 0, .2); font-weight: 600; }
  .fold { flex: none; width: 40px; height: 40px; margin: 0; border: 0; background: none; color: var(--muted);
    cursor: pointer; border-radius: 8px; }
  .fold:hover { background: var(--control); }
  .fold svg { transition: transform .15s; }
  .fold svg.up { transform: rotate(180deg); }
  .muted { color: var(--muted); font-size: 12px; margin-top: 2px; }
  .stats { display: grid; grid-template-columns: repeat(3, auto); justify-content: space-between; gap: 6px; margin: 10px 0 4px; }
  .stats b { display: block; font-size: 18px; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .stats small { font-size: 13px; }
  .stats span { color: var(--muted); font-size: 11px; }
  .legend .age { margin-right: 4px; font-size: 10px; font-variant-numeric: tabular-nums; }
  .focus { display: flex; align-items: center; gap: 2px; min-height: 32px; margin: 6px 0 0; padding: 0 2px 0 10px;
    border: 1px solid var(--accent); border-radius: 16px; color: var(--accent); font-size: 12px; }
  .focus span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .focus button { flex: none; width: 30px; height: 28px; border: 0; border-radius: 14px; background: none; color: inherit;
    font-size: 14px; cursor: pointer; }
  .focus button:hover { background: var(--control); }
  .focus svg { transition: transform .15s; }
  .focus svg.up { transform: rotate(180deg); }
  .hit { display: flex; align-items: flex-start; gap: 6px; margin-top: 8px; padding: 8px 4px 8px 10px; border-radius: 10px;
    background: var(--accent); color: #fff; font-size: 14px; font-weight: 600; }
  .hit span { flex: 1; }
  .hit button { width: 30px; height: 28px; border: 0; border-radius: 8px; background: none; color: inherit; font-size: 18px; cursor: pointer; }
  .pop h4 small { text-transform: none; letter-spacing: 0; font-weight: 400; }
  .pop details summary { cursor: pointer; margin-bottom: 4px; }
  .legend { display: flex; flex-wrap: wrap; gap: 4px 10px; margin: 8px 0 0; font-size: 12px; }
  .legend .lead { color: var(--muted); }
  .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; vertical-align: -1px; }
  [hidden] { display: none !important; }
  @media (max-width: 719px) {
    .account-control { right: 10px; }
    .panel { max-height: 65dvh; left: 8px; right: 60px; width: auto; max-width: none; padding: 10px 12px; }
    .panel.mobile-collapsed, .panel.mobile-collapsed.compact { right: auto; width: max-content; max-width: calc(100% - 76px); }
    .panel.compact { right: 60px; width: auto; max-width: none; }
    .rail { top: calc(100px + env(safe-area-inset-top)); }   /* account and locate above it */
    .popwrap { top: calc(12px + env(safe-area-inset-top)); left: 8px; right: 60px; width: auto; max-width: none;
      max-height: calc(100dvh - 24px - env(safe-area-inset-top)); }
    .stats b { font-size: 16px; }
  }
</style>
