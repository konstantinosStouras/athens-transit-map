<script lang="ts">
  import { t as tr, locale, setLanguage } from "../i18n.svelte";
  import { tick } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import { directionGroups, focusGroup, otherDirection } from "../directions";
  import { ago, clock, duration, fmtMinutes } from "../format";
  import { STALE_S, type AppState } from "../state.svelte";
  import Bell from "./Bell.svelte";
  import HelpPop from "./HelpPop.svelte";
  import LinePicker from "./LinePicker.svelte";
  import MetroToggles from "./MetroToggles.svelte";
  import StatusBanner from "./StatusBanner.svelte";

  let { app }: { app: AppState } = $props();

  // Phones start compact: the map matters more than the stats at a bus stop.
  let collapsed = $state(matchMedia("(max-width: 719px)").matches);
  // One popover at a time, opened from the buttons on the right: the map menu, what the symbols mean, or the
  // trip planner (loaded on first open), or help.
  let pop = $state<"layers" | "help" | "trip" | null>(null);
  // On a phone a popover covers the panel: what it covers cannot be reached by the keyboard either.
  const narrow = new MediaQuery("(max-width: 719px)");
  let tripButton: HTMLButtonElement | undefined = $state();
  let layersButton: HTMLButtonElement | undefined = $state();
  let helpButton: HTMLButtonElement | undefined = $state();
  let foldButton: HTMLButtonElement | undefined = $state();
  let focusOpen = $state(false);   // the direction rows of several lines, under their one summary row
  // Folded, the search field is hidden; the magnifier shows it (and the list under it) until a line is picked.
  let searching = $state(false);
  // The bar shrinks to its chips and buttons when nothing is open under it.
  const compact = $derived(collapsed && !searching);

  // Focus returns to the button that opened a popover.
  async function refocus(p: "layers" | "help" | "trip") {
    await tick();
    ({ layers: layersButton, help: helpButton, trip: tripButton })[p]?.focus();
  }
  const closeTrip = () => { pop = null; void refocus("trip"); };   // its A and B stay on the map until its own ×
  const toggle = (p: "layers" | "help" | "trip") => {
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
    if (pop === "trip" || (e.target as Element | null)?.closest?.(".panel, .rail, .popwrap")) return;
    searching = false;
    collapsed = true;
    pop = null;
  }
  // Escape: a popover first, then the dropdown (when focus is in it; the search closes its own list).
  function onEscape(e: KeyboardEvent) {
    if (e.key !== "Escape") return;
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

<section class="panel" class:compact inert={!!pop && narrow.current} aria-label={tr("Πίνακας ελέγχου")}>
  <div class="language" role="group" aria-label={locale.language === "el" ? "Γλώσσα" : "Language"}>
    <button type="button" lang="el" aria-label="Ελληνικά" aria-pressed={locale.language === "el"} onclick={() => setLanguage("el")}>ΕΛ</button>
    <button type="button" lang="en" aria-label="English" aria-pressed={locale.language === "en"} onclick={() => setLanguage("en")}>EN</button>
  </div>
  <div class="brand"><span>{tr("ΟΑΣΑ · Live")}</span><a href={`${import.meta.env.BASE_URL}updates.html?lang=${locale.language}`}>{tr("Τι νέο υπάρχει ↗")}</a></div>
  <h1 class="sr">{tr("Λεωφορεία ΟΑΣΑ")}</h1>
  <nav class="primary" aria-label={tr("Βασικές ενέργειες")}>
    <button type="button" aria-pressed={pop !== "trip"} onclick={() => { pop = null; collapsed = false; searching = true; void tick().then(() => document.querySelector<HTMLInputElement>(".picker input")?.focus()); }}>{tr("⌕ Βρες γραμμή")}</button>
    <button type="button" aria-pressed={pop === "trip"} aria-expanded={pop === "trip"} bind:this={tripButton} onclick={() => toggle("trip")}>{tr("↗ Σχεδίασε διαδρομή")}</button>
  </nav>

  <!-- Always shown: the picked lines, the search, and the chevron. The map buttons are on the right (.rail). -->
  <div class="bar">
    <LinePicker {app} expanded={!collapsed} searchOpen={searching} onsearch={() => (searching = true)} onclose={() => (searching = false)} {tail} />
  </div>

  <div class="freshness" class:stale={badge?.cls === "stale" || app.statusFailed}>
    <span class="live-dot"></span>
    {#if app.statusFailed}{tr("Πρόβλημα σύνδεσης · νέα προσπάθεια σε λίγο\r\n    ")}{:else if badge}{tr(badge.text)}
    {:else if oldest != null}{tr("Ενημέρωση ")}{tr(ago(oldest, app.serverNow))}
    {:else if app.city}{tr("Ενημέρωση ")}{tr(ago(app.city.updated_at, app.serverNow))}
    {:else}{tr("Σύνδεση με τα ζωντανά δεδομένα…")}{/if}
  </div>
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
        <strong>{tr(id)} · {tr(app.lineInfo.get(id)?.name ?? "Φόρτωση γραμμής…")}</strong>
        {#if app.statics[id]}
          <div class="direction-actions" aria-label={tr((`Κατευθύνσεις γραμμής ${id}`))}>
            <button type="button" aria-pressed={!app.focus[id]} onclick={() => app.setFocus(id, null)}>{tr("Και οι δύο κατευθύνσεις")}</button>
            {#each directionGroups(app.statics[id]) as g}
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

  {#each app.hits as h (h.id)}
    <div class="hit" role="alert">
      <span>🚌 {tr(h.text)}</span>
      <button type="button" aria-label={tr("Κλείσιμο")} onclick={() => app.dismissHit(h.id)}>×</button>
    </div>
  {/each}
  <StatusBanner {app} />

  {#snippet tail()}
    {#if collapsed && app.selected.length}
      <button type="button" class="tool" class:on={searching} aria-expanded={searching}
        aria-label={tr("Αναζήτηση γραμμής")} title={tr("Αναζήτηση γραμμής")} onclick={() => (searching = !searching)}>
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
          <circle cx="8.5" cy="8.5" r="5.5" /><path d="M12.6 12.6L17 17" />
        </svg>
      </button>
    {/if}
    <button type="button" class="fold" aria-expanded={!collapsed} aria-controls="panel-body" bind:this={foldButton}
      aria-label={tr((collapsed ? "Εμφάνιση λεπτομερειών" : "Απόκρυψη λεπτομερειών"))} onclick={fold}>
      <svg viewBox="0 0 12 8" width="14" height="10" aria-hidden="true" class={{ up: !collapsed }}>
        <path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
  {/snippet}
</section>


<!-- The popover of a map button opens on the right, beside the buttons (on a phone over the panel). -->
{#if pop}
  <div class="popwrap raised">
    {#if pop === "trip"}
      {#await import("./TripPlanner.svelte")}
        <div class="pop"><p class="hint">{tr("Φόρτωση…")}</p></div>
      {:then m}
        <m.default {app} onclose={closeTrip} />
      {:catch}
        <div class="pop"><p class="hint">{tr("Δεν φόρτωσε. Έλεγξε τη σύνδεση και πάτα ξανά την πυξίδα.")}</p></div>
      {/await}
    {:else if pop === "help"}
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
        <section>
          <h4>{tr("Μετρό, ΗΣΑΠ και τραμ")}</h4>
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
  .language { display: flex; gap: 3px; margin-bottom: 8px; }
  .language button { min-width: 44px; min-height: 36px; border: 1px solid var(--border); border-radius: 8px; background: var(--control); color: var(--fg); font-weight: 650; cursor: pointer; }
  .language button[aria-pressed="true"] { background: var(--accent); color: white; border-color: var(--accent); }

  .brand { display: flex; justify-content: space-between; gap: 10px; align-items: center; margin-bottom: 12px; font-weight: 750; }
  .brand a { font-size: 12px; color: var(--accent); font-weight: 500; padding: 6px 0; }
  .primary { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 12px; }
  .primary button { min-height: 46px; border-radius: 10px; border: 1px solid var(--border); background: var(--control); cursor: pointer; font-size: 13px; font-weight: 600; }
  .primary button[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: white; }
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
    border-radius: 14px; box-shadow: var(--shadow); backdrop-filter: blur(8px); max-height: calc(100dvh - 40px); overflow-y: auto; overflow-x: hidden; }
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
  .popwrap { position: absolute; z-index: 5; top: calc(116px + env(safe-area-inset-top)); right: 66px; width: 380px; max-width: calc(100% - 64px);
    max-height: calc(100dvh - 128px - env(safe-area-inset-top)); display: flex; flex-direction: column; }
  .popwrap.raised { z-index: 8; }   /* the map menu over the info card */
  .pop { min-height: 0; padding: 12px 14px; font-size: 13px; background: var(--bg); border: 1px solid var(--border);
    border-radius: 14px; box-shadow: var(--shadow); box-sizing: border-box; overflow-y: auto; overscroll-behavior: contain; }
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
    .panel { max-height: 65dvh; left: 8px; right: 60px; width: auto; max-width: none; padding: 10px 12px; }
    .panel.compact { right: 60px; width: auto; max-width: none; }
    .rail { top: calc(50px + env(safe-area-inset-top)); }   /* no zoom buttons above it */
    .popwrap { top: calc(12px + env(safe-area-inset-top)); left: 8px; right: 60px; width: auto; max-width: none;
      max-height: calc(100dvh - 24px - env(safe-area-inset-top)); }
    .stats b { font-size: 16px; }
  }
</style>
