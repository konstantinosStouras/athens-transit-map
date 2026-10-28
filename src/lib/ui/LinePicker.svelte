<script lang="ts">
  import { t as tr, nameOf, locale } from "../i18n.svelte";
  import { tick, type Snippet } from "svelte";
  import { searchLines } from "../search";
  import { MAX_LINES } from "../selection";
  import type { AppState } from "../state.svelte";
  import VehicleType from "./VehicleType.svelte";

  // expanded: the panel's dropdown is open, which is where the quick picks (favourites, popular) show.
  // Folded, the search field is hidden until searchOpen (the panel's magnifier, or the field below, was pressed);
  // onsearch asks the panel to open it, onclose says the search is over (a line was picked, or Escape).
  // tail: buttons of the panel, at the right of the first row (the chips, or the search with no chips).
  let { app, expanded = true, searchOpen = false, onsearch, onclose, ondirections, tail }:
    { app: AppState; expanded?: boolean; searchOpen?: boolean; onsearch?: () => void; onclose?: () => void; ondirections: () => void; tail?: Snippet } = $props();

  const QUICK = ["040", "550", "Α1", "Χ95", "2"];

  let query = $state("");
  let open = $state(false);
  let active = $state(0);
  let input: HTMLInputElement | undefined = $state();
  let list: HTMLUListElement | undefined = $state();

  const results = $derived(searchLines(app.lines, query));
  const showInput = true;

  // The field is gone (the panel folded, the search ended): so is its list.
  $effect(() => { if (!showInput) open = false; });

  // Opened by the magnifier: the field takes focus, which drops the list.
  $effect(() => {
    if (searchOpen && !expanded) void tick().then(() => input?.focus());
  });

  const full = $derived(app.selected.length >= MAX_LINES);
  const quick = $derived(QUICK.filter(id => app.lineInfo.has(id) && !app.selected.includes(id)));
  const favs = $derived(app.favorites.filter(id => app.lineInfo.has(id)));
  const favsOff = $derived(favs.filter(id => !app.selected.includes(id)).length);

  function pick(id: string) {
    if (!app.selected.includes(id) && full) {
      app.toggleLine(id);   // shows the 5-line notice
      return;
    }
    app.toggleLine(id);
    query = "";
    open = false;
    input?.blur();   // show the map on phones
    onclose?.();
  }

  function move(to: number) {
    active = Math.max(0, Math.min(results.length - 1, to));
    list?.children[active]?.scrollIntoView({ block: "nearest" });
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) { open = true; return; }
      move(active + (e.key === "ArrowDown" ? 1 : -1));
    } else if (e.key === "PageDown" || e.key === "PageUp") {
      e.preventDefault();
      move(active + (e.key === "PageDown" ? 8 : -8));
    } else if (e.key === "Enter" && open && results[active]) {
      e.preventDefault();
      pick(results[active].id);
    } else if (e.key === "*" && open && results[active]) {
      e.preventDefault();   // star the active line
      app.toggleFavorite(results[active].id);
    } else if (e.key === "Escape") {
      open = false;
      onclose?.();
    } else if (e.key === "Tab") {
      open = false;
    }
  }

  function chipState(id: string) {
    const s = app.pollState[id];
    const age = app.live[id] ? app.serverNow / 1000 - app.live[id].updated_at : 0;
    if (s === "backoff") return { icon: "!", title: "Σφάλμα σύνδεσης, νέα προσπάθεια σε λίγο" };
    if (s === "warming" || s === "loading") return { icon: "…", title: "Φόρτωση" };
    if (age > 120) return { icon: "!", title: "Η γραμμή δεν ανανεώνεται" };
    return null;
  }
</script>

<svelte:document onpointerdown={e => { if (open && !(e.target as Element).closest?.(".picker")) open = false; }} />

<div class="picker" class:chipped={app.selected.length > 0} class:folded={!showInput}>
  <div class="search-row">
  <input
    bind:this={input}
    bind:value={query}
    type="search"
    enterkeyhint="search"
    autocomplete="off"
    spellcheck="false"
    placeholder={full ? tr("Έως 5 γραμμές ταυτόχρονα") : (locale.language === "en" ? "Search lines" : "Αναζήτηση γραμμής")}
    role="combobox"
    aria-label={tr("Αναζήτηση γραμμής")}
    aria-expanded={open}
    aria-controls="line-list"
    aria-autocomplete="list"
    aria-activedescendant={open && results[active] ? `line-opt-${active}` : undefined}
    onfocus={() => { open = true; active = 0; }}
    oninput={() => { open = true; active = 0; }}
    {onkeydown}
  />
    <button type="button" class="search-icon" aria-label={tr("Αναζήτηση γραμμής")} onclick={() => input?.focus()}><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg></button>
    <button type="button" class="directions-button" aria-label={locale.language === "en" ? "Plan a journey" : "Σχεδίασε διαδρομή"} title={locale.language === "en" ? "Plan a journey" : "Σχεδίασε διαδρομή"} onclick={ondirections}><svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M12 2 22 12 12 22 2 12Z"/><path d="M8 16v-3a2 2 0 0 1 2-2h6m-3-3 3 3-3 3"/></svg></button>
    {#if tail}<div class="tail">{@render tail()}</div>{/if}
  </div>
  {#if app.selected.length}
    <ul class="chips" aria-label={tr("Επιλεγμένες γραμμές")}>
      {#each app.selected as id (id)}
        {@const info = app.lineInfo.get(id)}
        {@const st = chipState(id)}
        <li>
          <button
            type="button"
            class="chip"
            style:--c={tr(app.lineColor(id).bg)}
            style:--t={tr(app.lineColor(id).fg)}
            title={tr((st?.title ?? nameOf(info)))}
            aria-label={tr("Αφαίρεση γραμμής " + (id))}
            onclick={() => app.toggleLine(id)}
          >
            {tr(id)}{#if st}<span class="st">{tr(st.icon)}</span>{/if}<span class="x" aria-hidden="true">×</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}


  {#if expanded && favs.length && !open}
    <!-- Starred lines: each chip shows or hides its line, so several are a tap each. -->
    <div class="quick" role="group" aria-label={tr("Αγαπημένες γραμμές")}>
      <span aria-hidden="true">★</span>
      {#each favs as id (id)}
        {@const on = app.selected.includes(id)}
        <button type="button" class="fav" style:--c={tr(app.lineColor(id).bg)} style:--t={tr(app.lineColor(id).fg)} aria-pressed={on}
          aria-label={tr((on ? 'Απόκρυψη' : 'Εμφάνιση') + " γραμμής " + (id))} onclick={() => app.toggleLine(id)}>{tr(id)}</button>
      {/each}
      {#if favs.length > 1 && favsOff}
        <button type="button" class="all" onclick={() => app.showFavorites()}>{tr("Όλες")}</button>
      {/if}
    </div>
  {:else if expanded && !app.selected.length && quick.length && !open}
    <div class="quick">
      <span>{tr("Δημοφιλείς:")}</span>
      {#each quick as id (id)}
        <button type="button" class="q" style:--c={tr(app.lineInfo.get(id)?.color)} onclick={() => pick(id)}>{tr(id)}</button>
      {/each}
    </div>
    <div class="tip">{tr("Πάτα ☆ σε μια γραμμή της λίστας για να μπει στις αγαπημένες.")}</div>
  {/if}

  {#if open && showInput}
    <ul id="line-list" class="list" role="listbox" aria-label={tr("Γραμμές")} aria-multiselectable="true" bind:this={list}>
      {#if app.linesFailed}
        <li class="empty">{tr("Δεν φορτώθηκε η λίστα γραμμών. Δοκίμασε ξανά σε λίγο.")}</li>
      {:else if !app.lines.length}
        <li class="empty">{tr("Φόρτωση γραμμών…")}</li>
      {:else if !results.length && query.trim() !== "320"}
        <li class="empty">{locale.language === "en" ? "No matching line in the current data." : "Δεν υπάρχει αντίστοιχη γραμμή στα τρέχοντα δεδομένα."}</li>
      {/if}
      {#if query.trim() === "320" && app.lines.length && !app.lineInfo.has("320")}
        <li class="empty">{locale.language === "en" ? "Line 320 is missing from the current source." : "Η γραμμή 320 λείπει από την τρέχουσα πηγή."}{#if results.length} {locale.language === "en" ? "Similar results below are different lines." : "Τα παρόμοια αποτελέσματα παρακάτω είναι άλλες γραμμές."}{/if}</li>
      {/if}
      {#each results as l, i (l.id)}
        {@const sel = app.selected.includes(l.id)}
        {@const star = app.favorites.includes(l.id)}
        <!-- svelte-ignore a11y_click_events_have_key_events (keyboard goes through the combobox input) -->
        <li
          id="line-opt-{i}"
          role="option"
          aria-selected={sel}
          aria-disabled={!sel && full}
          class={{ active: i === active, disabled: !sel && full }}
          onpointerenter={() => (active = i)}
          onpointerdown={e => e.preventDefault()}
          onclick={() => pick(l.id)}
        >
          <span class="id" style:--c={tr(app.lineColor(l.id).bg)} style:--t={tr(app.lineColor(l.id).fg)}>{tr(l.id)}</span>
          <span class="name">{nameOf(l)}</span>
          <VehicleType kind={l.kind} />
          {#if sel}<span class="check" aria-hidden="true">✓</span>{/if}
          <button type="button" class="star" class:on={star} tabindex="-1" aria-pressed={star}
            aria-label={tr((star ? 'Αφαίρεση από' : 'Προσθήκη στις') + " αγαπημένες: " + (l.id))} title={tr("Αγαπημένη (πλήκτρο *)")}
            onclick={e => { e.stopPropagation(); app.toggleFavorite(l.id); }}>{tr(star ? "★" : "☆")}</button>
        </li>
      {/each}
    </ul>
    {#if app.linesFailed}
      <button type="button" class="retry-lines" disabled={app.linesLoading} onclick={() => void app.retryLines()}>
        {app.linesLoading ? (locale.language === "en" ? "Retrying…" : "Νέα προσπάθεια…") : (locale.language === "en" ? "Retry loading lines" : "Επανάληψη φόρτωσης γραμμών")}
      </button>
    {/if}
  {/if}
</div>

<style>
  .picker { position: relative; display: flex; flex-direction: column; }
  .search-row { display: flex; align-items: center; min-width: 0; background: var(--control); border: 1px solid var(--border); border-radius: 12px; }
  .search-row input { flex: 1; min-width: 0; width: 0; height: 48px; padding: 8px 12px; border: 0; border-radius: 12px; background: transparent; color: var(--fg); font-size: 16px; }
  .search-row input:focus { outline: 2px solid var(--accent); outline-offset: -2px; }
  .search-icon, .directions-button { display: grid; place-items: center; flex: none; width: 44px; height: 44px; padding: 0; border: 0; background: transparent; color: var(--muted); cursor: pointer; border-radius: 8px; }
  .directions-button { color: var(--accent); border-left: 1px solid var(--border); border-radius: 0; }
  .search-icon:hover, .directions-button:hover { background: var(--control-hover); }
  .search-icon:focus-visible, .directions-button:focus-visible { outline: 2px solid var(--accent); outline-offset: -3px; }
  .tail { display: flex; align-items: center; flex: none; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 0; padding: 0; list-style: none; }
  .quick, .tip { grid-column: 1 / -1; }
  .chip { display: inline-flex; align-items: center; gap: 4px; min-height: 40px; padding: 0 10px; border: 0;
    border-radius: 16px; background: var(--c); color: var(--t); font-weight: 700; cursor: pointer; }
  .chip .x { opacity: .8; font-weight: 400; margin-left: 2px; }
  .chip .st { display: inline-grid; place-items: center; width: 16px; height: 16px; border-radius: 50%;
    background: rgba(0, 0, 0, .3); font-size: 12px; }
  .quick { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; color: var(--muted); font-size: 12px; }
  .q { min-height: 40px; padding: 0 10px; border: 0; border-radius: 16px; background: var(--c, #3b5bdb); color: #fff;
    font-weight: 700; cursor: pointer; }
  .list { position: relative; z-index: 1; margin: 4px 0 0; padding: 4px;
    list-style: none; max-height: min(360px, 55vh); overflow-y: auto; overscroll-behavior: contain;
    background: var(--bg); border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 8px 24px rgba(0, 0, 0, .25); }
  .list li { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 4px 8px; border-radius: 8px; cursor: pointer; }
  .list li.active { background: var(--control-hover); }
  .list li.disabled { opacity: .45; cursor: not-allowed; }
  .list li.empty { color: var(--muted); cursor: default; }
  .retry-lines { align-self: flex-start; min-height: 44px; margin-top: 6px; padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--control); color: var(--fg); cursor: pointer; }
  .id { flex: none; min-width: 44px; padding: 2px 6px; border-radius: 6px; background: var(--c); color: var(--t);
    font-weight: 700; text-align: center; font-size: 13px; }
  .name { flex: 1; min-width: 0; font-size: 13px; line-height: 1.3; overflow-wrap: anywhere; }
  .check { color: var(--accent); font-weight: 700; }
  .star { flex: none; width: 44px; height: 44px; margin: -4px -4px -4px 0; border: 0; border-radius: 8px; background: none;
    color: var(--muted); font-size: 18px; cursor: pointer; }
  .star:hover { background: var(--control); }
  .star.on { color: #f59f00; }
  .fav { min-height: 40px; padding: 0 10px; border: 2px solid var(--c, #3b5bdb); border-radius: 16px; background: none;
    color: var(--fg); font-weight: 700; cursor: pointer; }
  .fav[aria-pressed="true"] { background: var(--c, #3b5bdb); color: var(--t, #fff); }
  .all { min-height: 40px; padding: 0 10px; border: 1px solid var(--border); border-radius: 16px; background: var(--control);
    font-size: 12px; cursor: pointer; }
  .tip { margin-top: 6px; color: var(--muted); font-size: 12px; }
</style>
