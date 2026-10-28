<script lang="ts">
  import { t as tr, locale, nameOf } from "../i18n.svelte";
  import { untrack } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import { directionGroups, groupOf } from "../directions";
  import { ago, clock, gtfsEnded } from "../format";
  import { clampDrag, settle, type SheetState } from "../sheet";
  import type { AppState } from "../state.svelte";
  import type { DirectionGroup } from "../directions";

  let { app }: { app: AppState } = $props();

  // A city vehicle whose line is still loading: what the city layer knows, until the line's data arrives.
  const vehicle = $derived.by(() => {
    const c = app.selectedCity;
    const sv = app.selectedVehicle ?? (c && {
      line: c.line, faded: false, loading: true,
      v: { ...c, route_code: "", trip_id: null, trip_label: null, trip_label_en: null, next_stop_id: null },
    });
    if (!sv) return null;
    const st = app.statics[sv.line];
    return {
      ...sv,
      info: app.lineInfo.get(sv.line),
      nextStop: sv.v.next_stop_id ? st?.stops[sv.v.next_stop_id] : undefined,
      groups: st ? directionGroups(st, locale.language) : [],
      focus: app.focus[sv.line],
    };
  });

  // On a phone the card is a bottom sheet: dragged down by its top it peeks (only the header shows),
  // dragged up it opens. The same by a tap, or Enter on the grab button.
  const narrow = new MediaQuery("(max-width: 719px)");
  let sheet = $state<SheetState>("open");
  let drag = $state(0);   // px the finger has moved it from its place
  let dragging = $state(false);
  let grab: { id: number; y: number; from: SheetState; range: number; moved: boolean } | null = null;
  let card: HTMLElement | undefined = $state();
  let cardH = $state(0), topH = $state(0);
  // How far it travels to peek: all but its padding (the bottom one holds the safe area) and its top.
  function measure() {
    if (!card) return 0;
    const cs = getComputedStyle(card);
    return Math.max(0, card.offsetHeight - topH - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom));
  }
  const range = $derived.by(() => { void cardH; void topH; return measure(); });
  const shift = $derived(narrow.current ? (sheet === "peek" ? range : 0) + drag : 0);

  // A new vehicle or route opens it again; the live updates of the same one do not.
  const selKey = $derived.by(() => {
    const s = app.selection;
    return s ? `${s.kind}/${s.line}/${s.kind === "vehicle" ? s.id : s.variant}` : "";
  });
  $effect(() => {
    void selKey;
    // A finger still down on the old sheet must not move, or settle, the new one.
    untrack(() => { sheet = "open"; drag = 0; dragging = false; grab = null; });
  });

  function down(e: PointerEvent) {
    if (!narrow.current || e.button !== 0 || grab || (e.target as Element).closest(".close, .pin, .star")) return;
    grab = { id: e.pointerId, y: e.clientY, from: sheet, range: measure(), moved: false };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (!grab || e.pointerId !== grab.id) return;
    const dy = e.clientY - grab.y;
    if (!grab.moved && Math.abs(dy) < 6) return;   // a tap is not a drag
    grab.moved = true;
    dragging = true;
    drag = clampDrag(grab.from, dy, grab.range);
  }
  // Also on pointercancel and a lost capture, so the sheet never stays between its places.
  function end(e: PointerEvent) {
    if (!grab || e.pointerId !== grab.id) return;
    const g = grab;
    grab = null;
    dragging = false;
    sheet = g.moved ? settle(g.from, e.type === "pointerup" ? e.clientY - g.y : drag, g.range) : e.type === "pointerup" ? flip(g.from) : g.from;
    drag = 0;
  }
  const flip = (s: SheetState): SheetState => (s === "open" ? "peek" : "open");

  const route = $derived.by(() => {
    const s = app.selection;
    if (s?.kind !== "route") return null;
    const st = app.statics[s.line];
    const variant = st?.variants[s.variant];
    if (!variant) return null;
    const name = (i: number) => nameOf(st.stops[variant.stops[i]]);
    return {
      line: s.line,
      id: s.variant,
      info: app.lineInfo.get(s.line),
      variant,
      from: name(0),
      to: name(variant.stops.length - 1),
      running: (app.live[s.line]?.vehicles ?? []).filter(v => v.variant === s.variant).length,
      groups: directionGroups(st, locale.language),
      focus: app.focus[s.line],
    };
  });
</script>

<!-- Direction chips: show one direction on the map. From a vehicle, the other direction opens
     that direction's route card (the vehicle is not on it). -->
{#snippet dirs(line: string, groups: DirectionGroup[], focus: string[] | undefined, mine: DirectionGroup | undefined)}
  <div class="dirs" role="group" aria-label={tr("Κατεύθυνση στον χάρτη")}>
    <button type="button" aria-pressed={!focus} onclick={() => app.setFocus(line, null)}>{tr("Και οι δύο κατευθύνσεις")}</button>
    {#each groups as g (g.variants.join())}
      <button type="button" class:mine={g === mine} aria-pressed={focus?.join() === g.variants.join()}
        title={tr((g === mine ? "Η κατεύθυνση αυτού του οχήματος" : undefined))}
        onclick={() => {
          // Read everything first: selectRoute tears this block down. It goes before setFocus,
          // which would drop a vehicle selection the new direction hides.
          const l = line, vs = g.variants, other = app.selection?.kind === "vehicle" && g !== mine;
          if (other) app.selectRoute(l, vs[0]);
          app.setFocus(l, vs);
        }}>→ {tr(g.to)}</button>
    {/each}
  </div>
{/snippet}

<svelte:window onkeydown={e => { if (e.key === "Escape" && app.selection) app.clearSelection(); }} />

{#if vehicle || route}
  {@const line = vehicle?.line ?? route!.line}
  {@const info = vehicle?.info ?? route?.info}
  {@const pinned = app.selected.includes(line)}
  {@const starred = app.favorites.includes(line)}
  <section class="card" class:dragging class:peek={narrow.current && sheet === "peek"} aria-live="polite" aria-label={tr("Λεπτομέρειες")} bind:this={card} bind:offsetHeight={cardH}
    style:transform={tr(shift ? `translateY(${shift}px)` : undefined)}>
    <!-- svelte-ignore a11y_no_static_element_interactions (the keyboard goes through the grab button) -->
    <div class="top" bind:offsetHeight={topH} onpointerdown={down} onpointermove={move} onpointerup={end} onpointercancel={end}
      onlostpointercapture={end}>
      <!-- Pointer taps and drags are handled above; a click with no pointer (Enter, Space) comes here. -->
      <button type="button" class="grab" aria-expanded={sheet === "open"} aria-controls="card-body"
        aria-label={tr((sheet === "open" ? "Σύμπτυξη λεπτομερειών" : "Ανάπτυξη λεπτομερειών"))} onclick={e => { if (e.detail === 0) sheet = flip(sheet); }}><span></span></button>
      <header>
        <span class="pill" style:--c={tr(app.lineColor(line).bg)} style:--t={tr(app.lineColor(line).fg)}>{tr(line)}</span>
        <h2>{tr(vehicle ? (groupOf(vehicle.groups, vehicle.v.variant)?.to ? `→ ${groupOf(vehicle.groups, vehicle.v.variant)?.to}` : nameOf(info)) : route ? `→ ${route.to}` : "")}</h2>
        <button type="button" class="star" class:on={starred} aria-pressed={starred} title={tr((starred ? "Αφαίρεση από τις αγαπημένες" : "Προσθήκη στις αγαπημένες"))}
          aria-label={tr((starred ? `Αφαίρεση της γραμμής ${line} από τις αγαπημένες` : `Προσθήκη της γραμμής ${line} στις αγαπημένες`))}
          onclick={() => app.toggleFavorite(line)}>{tr(starred ? "★" : "☆")}</button>
        <!-- Keeps the line on the bar of the panel; the card can then be closed without losing it. -->
        <button type="button" class="pin" class:on={pinned} aria-pressed={pinned} title={tr((pinned ? "Ξεκαρφίτσωμα: βγάλε τη γραμμή από τον χάρτη" : "Καρφίτσωμα: κράτα τη γραμμή στον χάρτη"))}
          aria-label={tr((pinned ? `Ξεκαρφίτσωμα της γραμμής ${line}` : `Καρφίτσωμα της γραμμής ${line}`))} onclick={() => app.toggleLine(line)}>
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill={pinned ? "currentColor" : "none"} stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">
            <path d="M7 2.5h6l-.8 5 2.3 2.7v1.3H5.5V10.2l2.3-2.7z" /><path d="M10 11.5v6" />
          </svg>
        </button>
        <button type="button" class="close" aria-label={tr("Κλείσιμο")} onclick={() => app.clearSelection()}>×</button>
      </header>
    </div>

    <div class="body" id="card-body" inert={narrow.current && sheet === "peek"}>

      {#if vehicle}
        {@const v = vehicle.v}
        <div class="next-stop"><span>{tr("Επόμενη στάση")}</span><strong>{tr(nameOf(vehicle.nextStop) || "Δεν είναι διαθέσιμη")}</strong></div>
        <p class="gps-freshness">{tr("Θέση GPS · ")}{tr(ago(v.position_at, app.serverNow))}</p>
        <div class="estimate">
          <span>{tr("Σε σχέση με το πρόγραμμα")}</span>
          <strong>{tr(v.delay_s == null ? "Χωρίς εκτίμηση" : Math.abs(v.delay_s) < 60 ? "Περίπου στην ώρα του" : `Περίπου ${Math.round(Math.abs(v.delay_s) / 60)} ${Math.round(Math.abs(v.delay_s) / 60) === 1 ? "λεπτό" : "λεπτά"} ${v.delay_s < 0 ? "νωρίτερα" : "καθυστέρηση"}`)}</strong>
          {#if gtfsEnded(app.status?.gtfs_expires)}
            <p class="schedule-warning">{tr("Το πρόγραμμα έχει λήξει. Η σύγκριση με το ωράριο είναι κατά προσέγγιση· η θέση GPS ενημερώνεται ξεχωριστά.")}</p>
          {:else}<p>{tr("Σύγκριση με το ωράριο, όχι πρόβλεψη άφιξης στη στάση σου.")}</p>{/if}
        </div>
        {#if v.trip_label}<p class="trip-label">{nameOf({ name: v.trip_label, name_en: v.trip_label_en })}</p>{/if}
        {#if "loading" in vehicle}<p class="muted">{tr("Φόρτωση δρομολογίου…")}</p>{/if}
        <details class="technical"><summary>{tr("Περισσότερες λεπτομέρειες")}</summary>
          <dl><dt>{tr("Όχημα")}</dt><dd>{tr(v.id)}</dd><dt>{tr("Κωδικός στάσης")}</dt><dd>{tr(v.next_stop_id ?? "—")}</dd><dt>{tr("Κωδικός δρομολογίου")}</dt><dd>{tr(v.trip_id ?? "—")}</dd><dt>{tr("Ώρα GPS")}</dt><dd>{tr(clock(v.position_at))}</dd></dl>
        </details>
        {#if vehicle.groups.length > 1}
          {@const mine = groupOf(vehicle.groups, v.variant)}
          {@render dirs(vehicle.line, vehicle.groups, vehicle.focus, mine)}
        {/if}
      {:else if route}
        <table>
          <tbody>
            <tr><th>{tr("Κατεύθυνση")}</th><td>{tr(route.from)} → {tr(route.to)}</td></tr>
            <tr><th>{tr("Στάσεις")}</th><td>{tr(route.variant.stops.length)}</td></tr>
            <tr><th>{tr("Οχήματα τώρα")}</th><td>{tr(route.running)}</td></tr>
          </tbody>
        </table>
        {#if route.groups.length > 1}
          {@render dirs(route.line, route.groups, route.focus, groupOf(route.groups, route.id))}
        {/if}
      {/if}
    </div>
  </section>
{/if}

<style>
  .next-stop { padding: 12px 0 6px; }
  .next-stop span, .estimate > span { display: block; color: var(--muted); font-size: 12px; margin-bottom: 4px; }
  .next-stop strong { display: block; font-size: 20px; line-height: 1.3; }
  .gps-freshness { color: var(--muted); font-size: 13px; margin: 4px 0 14px; }
  .estimate { background: var(--control); border-radius: 10px; padding: 12px; }
  .estimate strong { font-size: 15px; }
  .estimate p { font-size: 12px; margin: 6px 0 0; }
  .schedule-warning { background: var(--warn-bg); padding: 8px; border-radius: 6px; }
  .trip-label { font-size: 13px; }
  .technical { margin: 12px 0; font-size: 12px; color: var(--muted); }
  .technical summary { cursor: pointer; min-height: 30px; }
  dl { overflow-wrap: anywhere; } dt { margin-top: 8px; } dd { margin-left: 0; color: var(--fg); }

  .card { position: absolute; z-index: 6; right: 66px; bottom: 28px; width: 380px; padding: 12px 14px;
    background: var(--panel); border: 1px solid var(--border); border-radius: 14px; box-shadow: var(--shadow);
    }
  .top { touch-action: none; }
  .grab { display: none; width: 100%; height: 14px; margin: -8px 0 2px; padding: 0; border: 0; background: none; cursor: grab; }
  .grab span { display: block; width: 40px; height: 5px; margin: 0 auto; border-radius: 3px; background: var(--border); }
  .grab:focus-visible { outline: 2px solid var(--accent); border-radius: 6px; }
  .body { max-height: min(55dvh, 420px); overflow-y: auto; overscroll-behavior: contain; transition: opacity .15s; }
  .card.peek .body { opacity: 0; }   /* no sliver of it under the header */
  header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  h2 { flex: 1; margin: 0; font-size: 16px; font-weight: 700; color: var(--fg); overflow: hidden;
    text-overflow: ellipsis; white-space: nowrap; }
  .pill { padding: 2px 8px; border-radius: 10px; background: var(--c); color: var(--t); font-weight: 700; }
  .close { width: 36px; height: 36px; margin: -8px -10px -8px 0; border: 0; background: none; font-size: 22px;
    color: var(--muted); cursor: pointer; border-radius: 8px; }
  .close:hover { background: var(--control); }
  .pin { display: grid; place-items: center; width: 36px; height: 36px; margin: -8px -4px -8px 0; border: 0; background: none;
    color: var(--muted); cursor: pointer; border-radius: 8px; }
  .pin:hover { background: var(--control); }
  .pin.on { color: var(--accent); }
  .star { width: 36px; height: 36px; margin: -8px -4px -8px 0; border: 0; background: none; color: var(--muted); font-size: 20px;
    cursor: pointer; border-radius: 8px; }
  .star:hover { background: var(--control); }
  .star.on { color: #f59f00; }
  table { border-collapse: collapse; font-size: 13px; }
  th { padding: 2px 10px 2px 0; color: var(--muted); font-weight: 400; text-align: left; vertical-align: top; white-space: nowrap; }
  td { padding: 2px 0; font-variant-numeric: tabular-nums; }
  .muted { color: var(--muted); font-size: 12px; }
  .dirs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .dirs button { min-height: 44px; padding: 6px 12px; border: 1px solid var(--border); border-radius: 18px;
    background: var(--control); cursor: pointer; font-size: 13px; }
  .dirs button[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: #fff; }
  .dirs button.mine:not([aria-pressed="true"]) { border-color: var(--accent); }
  @media (prefers-reduced-motion: reduce) { .card { transition: none !important; } }
  @media (max-width: 719px) {
    .card { left: 0; right: 0; bottom: 0; width: auto; border-radius: 16px 16px 0 0; border-width: 1px 0 0;
      padding: 14px 16px calc(14px + env(safe-area-inset-bottom)); transition: transform .22s ease; }
    .card.dragging { transition: none; }
    .grab { display: block; }
  }
</style>
