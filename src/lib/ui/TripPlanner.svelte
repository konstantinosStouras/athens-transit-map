<script lang="ts" module>
  import { displayStop, displayText } from "../transit-names";
  import { t as tr, locale, nameOf } from "../i18n.svelte";
  import type { Place } from "../trip";


</script>

<script lang="ts">
  import { tick, untrack } from "svelte";
  import type { JourneyEnd as End } from "../choices";
  import { fetchLines } from "../api";
  import { MAX_LINES } from "../selection";
  import { canPush, startPush, stopPush } from "../push";
  import { encodeAlert, type Rep } from "../tglink";
  import type { AppState } from "../state.svelte";
  import Bell from "./Bell.svelte";
  import VehicleType from "./VehicleType.svelte";
  import { closestPoint, type WalkingLeg } from "../walking";
  import WalkingDetails from './WalkingDetails.svelte';
  import { walkUrl } from "../maps";
  import { alertTargets, anyMetro, boardings, centre, distM, findTransfers, findTrips, geocode, legTrip, loadTripIndex, metroDirect, metroPlaces, nearestStation, places, searchPlaces,
    suggest, termini, type Pt, type TripIndex, type TripLine, type TripTransfer } from "../trip";

  let { app, onclose }: { app: AppState; onclose: () => void } = $props();

  type Field = "from" | "to";
  const FIELDS = ["from", "to"] as const;
  const radius = 500; // Boarding and alighting stops within 500 m in a straight line.
  const ME = "Η θέση μου";
  const ALERT_S = 2 * 3600;
  const phone = () => matchMedia("(max-width: 719px)").matches;

  let ends = $state.raw<Record<Field, End>>(untrack(() => ({ from: app.journey.from, to: app.journey.to })));
  let applied = "";
  let restoring = untrack(() => !!app.journey.from.place && !!app.journey.to.place);
  let n = $state(untrack(() => app.journey.n));
  let data = $state.raw<{ ix: TripIndex; places: Place[]; known: Set<string>; stale: string | null } | null>(null);
  let failed = $state(false);
  let folded = $state(false);
  let openField = $state<Field | null>(null);
  let activeKey = $state<string | null>(null);
  // Geocoder answers for the open field's text, and the request in flight (one per field).
  let geo = $state.raw<{ text: string; places: Place[] } | null>(null);
  let geoBusy = $state(false);
  let locating = $state<Field | null>(null);
  let err = $state<string | null>(null);
  const inputs: Record<Field, HTMLInputElement | undefined> = { from: undefined, to: undefined };
  let ctl: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let gen = 0;   // geocoder answers to an older edit are dropped
  const locGen = { from: 0, to: 0 };   // the same for each field's location request
  let closed = false;

  $effect(() => { app.journey = { from: ends.from, to: ends.to, n, picked }; });
  $effect(() => () => { ctl?.abort(); clearTimeout(timer); gen++; locGen.from++; locGen.to++; closed = true; });

  async function load() {
    failed = false;
    app.loadMetro();   // stations to start or end at (once; again after a failure)
    try {
      const [ix, lines] = await Promise.all([loadTripIndex(), fetchLines()]);
      data = { ix, places: places(ix), known: new Set(lines.lines.map(l => l.id)), stale: ix.v === lines.gtfs_version ? null : ix.v };
    } catch {
      failed = true;
    }
  }
  load();

  // Suggestions: my location for an empty field (and, for the end, the nearest metro station); else one
  // short list (areas, stations and stops, streets, shops).
  type Opt = { key: string; me?: true; place?: Place };
  const keyOf = (p: Place) => `${p.kind}|${p.label}|${p.pts[0].join()}`;
  const stations = $derived(app.metro ? metroPlaces(app.metro) : []);
  const anyM = $derived(app.metro ? anyMetro(app.metro) : null);
  const opts = $derived.by((): Opt[] => {
    if (!openField) return [];
    const text = ends[openField].text.trim();
    if (!text || text === ME || text === anyM?.label)
      return [{ key: "me", me: true }, ...(openField === "to" && anyM ? [{ key: keyOf(anyM), place: anyM }] : [])];
    const own = data ? searchPlaces([...stations, ...data.places], text, 6) : [];
    return suggest(own, geo?.text === text ? geo.places : []).map(place => ({ key: keyOf(place), place }));
  });
  const active = $derived(Math.max(0, opts.findIndex(o => o.key === activeKey)));

  function stopSearch() {
    gen++;
    ctl?.abort();
    clearTimeout(timer);
    geoBusy = false;
  }

  // Typing forgets the chosen place and asks the geocoder after a pause.
  function edit(f: Field, text: string) {
    restoring = false;
    stopSearch();
    locGen[f]++;
    if (locating === f) locating = null;
    applied = "";
    ends = { ...ends, [f]: { text, place: null } };
    openField = f;
    activeKey = null;
    err = null;
    const q = text.trim();
    if (q.length < 3) return;
    const g = gen;
    const other = ends[f === "from" ? "to" : "from"].place;
    const near = other && other.kind !== "metro-any" ? centre(other.pts) : undefined;   // the nearest shop of a chain
    geoBusy = true;
    timer = setTimeout(() => {
      ctl = new AbortController();
      geocode(q, ctl.signal, near).then(
        r => { if (g === gen) geo = { text: q, places: r }; },
        () => {},   // offline or busy: the stops still answer
      ).finally(() => { if (g === gen) geoBusy = false; });
    }, 350);
  }

  function choose(f: Field, o: Opt) {
    restoring = false;
    stopSearch();
    openField = null;
    if (o.me) return locate(f);
    ends = { ...ends, [f]: { text: o.place!.label, place: o.place! } };
    next(f);
  }

  // After a choice: on to the other field while it is empty, else close the keyboard.
  function next(f: Field) {
    const other: Field = f === "from" ? "to" : "from";
    if (!ends[other].place && !ends[other].text.trim()) inputs[other]?.focus();
    else inputs[f]?.blur();
  }

  function locate(f: Field) {
    const g = ++locGen[f];
    ends = { ...ends, [f]: { text: ME, place: null } };
    locating = f;
    navigator.geolocation.getCurrentPosition(
      p => {
        if (g !== locGen[f]) return;
        locating = null;
        const place: Place = { label: ME, hint: `±${Math.round(p.coords.accuracy)} μ.`, pts: [[p.coords.latitude, p.coords.longitude]], lines: [], kind: "me" };
        ends = { ...ends, [f]: { text: ME, place } };
        next(f);
      },
      e => {
        if (g !== locGen[f]) return;
        locating = null;
        ends = { ...ends, [f]: { text: "", place: null } };
        err = e.code === 1 ? "Ο browser δεν επιτρέπει πρόσβαση στην τοποθεσία." : "Δεν βρέθηκε η τοποθεσία σου. Δοκίμασε ξανά ή γράψε μια περιοχή.";
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }

  function swap() {
    restoring = false;
    stopSearch();
    locGen.from++; locGen.to++;
    locating = null;
    ends = { from: ends.to, to: ends.from };
  }

  // Both ends set: the lines, applied to the map at once (a new trip replaces the picks).
  const from = $derived(ends.from.place), to = $derived(ends.to.place);
  const endDistance = $derived(from && to ? Math.min(...from.pts.flatMap(a => to.pts.map(b => distM(a, b)))) : null);
  const tooClose = $derived(endDistance != null && endDistance < radius);
  const trips = $derived(data && from && to && !tooClose ? findTrips(data.ix, from.pts, to.pts, radius, data.known) : null);
  // With one change: when no line goes without, or a change saves 10 minutes.
  const xfers = $derived.by((): TripTransfer[] => {
    if (!data || !from || !to || !trips) return [];
    const best = trips[0]?.min ?? Infinity;
    return findTransfers(data.ix, from.pts, to.pts, radius, data.known).filter(x => x.min + 10 < best);
  });

  // The metro station of a stop ("any metro station" as the end), and where it is.
  const ptOf = (k: number): Pt => [data!.ix.s[k][1], data!.ix.s[k][2]];
  const stationAt = (p: Pt) => {
    const st = app.metro && nearestStation(app.metro, p);
    const s = st && app.metro!.stations.find(x => x.name === st.name && x.lines.some(l => l.startsWith("M")));
    return s ? { name: s.name, name_en: s.name_en, d: st.d, pt: [s.lat, s.lon] as Pt } : null;
  };
  const anyEnd = $derived(to?.kind === "metro-any");
  // Google Maps, on foot to the first stop: from where the phone is, or from the chosen start.
  const mapsTo = (k: number) => walkUrl(ptOf(k), from && from.kind !== "me" ? closestPoint(from.pts, ptOf(k)) : undefined);
  const walkTo = $derived(anyEnd && from ? stationAt(centre(from.pts)) : null);
  // Both ends near one metro or tram line: said before the buses.
  const byMetro = $derived(app.metro && from && to && !anyEnd && !tooClose ? metroDirect(app.metro, from.pts, to.pts, radius) : null);

  // A and B on the map whenever both ends are set (again after a reopen); "any metro station" is the
  // station of the best trip.
  const toPt = $derived.by((): Pt | null => {
    if (!to) return null;
    if (!anyEnd) return centre(to.pts);
    const t = trips?.find(x => x.line === picked) ?? trips?.[0], x = xfers.find(y => xkey(y) === picked);
    const k = x ? x.legs[1].to : t?.variants[0].to ?? xfers[0]?.legs[1].to;
    return k == null || !data ? null : stationAt(ptOf(k))?.pt ?? null;
  });
  $effect(() => { app.tripEnds = from && toPt ? { from: app.walking.find(w => w.kind === "board")?.from ?? centre(from.pts), to: app.walking.find(w => w.kind === "finish")?.to ?? toPt } : null; });

  // The result shown alone (a line, or "l1>l2" for a change), with its stops on the map.
  let picked = $state<string | null>(untrack(() => app.journey.picked));
  const stopAt = (k: number) => ({ at: ptOf(k), name: stop(k) });
  const xkey = (x: TripTransfer) => `${x.legs[0].line}>${x.legs[1].line}`;
  function setWalking(board: number, off: number, transfer?: [number, number]) {
    if (!from || !toPt) return;
    const legs: WalkingLeg[] = [{ from: closestPoint(from.pts, ptOf(board)), to: ptOf(board), name: stop(board), kind: "board" }];
    if (transfer && distM(ptOf(transfer[0]), ptOf(transfer[1])) > 5)
      legs.push({ from: ptOf(transfer[0]), to: ptOf(transfer[1]), name: stop(transfer[1]), kind: "transfer" });
    legs.push({ from: ptOf(off), to: to && !anyEnd ? closestPoint(to.pts, ptOf(off)) : toPt, name: ends.to.text, kind: "finish" });
    app.walking = legs;
  }
  function focusWalk() {
    const leg = app.walking.find(w => w.kind === "board");
    if (!leg) return;
    app.panelHidden = true;
    void tick().then(() => app.fitPoints(leg.route ? leg.route.geometry.coordinates.map(p => [p[1], p[0]]) : [leg.from, leg.to]));
  }
  function solo(t: TripLine) {
    const v = t.variants[0];
    app.showTrip([{ id: t.line, variants: t.variants.map(x => x.id) }], true);
    app.tripStops = [stopAt(v.from), stopAt(v.to)];
    picked = t.line;
    setWalking(v.from, v.to);
    app.panelHidden = true;
  }
  function pickXfer(x: TripTransfer) {   // another trip than the alert's: the alert ends
    const [a, b] = x.legs;
    app.showTrip([{ id: a.line, variants: [a.id] }, { id: b.line, variants: [b.id] }]);
    app.tripStops = [stopAt(a.from), stopAt(a.to), ...(stop(b.from) === stop(a.to) ? [] : [stopAt(b.from)]), stopAt(b.to)];
    picked = xkey(x);
    setWalking(a.from, b.to, [a.to, b.from]);
    app.panelHidden = true;
  }
  // Editing either endpoint clears the old walking overlay immediately.
  $effect(() => { if (!from || !to) untrack(() => { app.walking = []; app.tripStops = []; picked = null; }); });
  // A picked result whose lines were closed meanwhile is no longer shown alone.
  $effect(() => {
    if (!picked) return;
    const lines = picked.split(">");
    if (lines.some(l => !app.selected.includes(l))) untrack(() => { picked = null; app.tripStops = []; app.walking = []; });
  });
  function showAll() {
    if (trips?.length) app.showTrip(trips.map(t => ({ id: t.line, variants: t.variants.map(v => v.id) })), true);
    app.tripStops = []; app.walking = [];
    picked = null;
  }

  // Once per trip: reopening the planner must not undo picks changed since. On a phone, each new trip
  // keeps the endpoints editable. With no direct line, the best change is shown.
  $effect(() => {
    if (!trips || !from || !to) return;
    const key = JSON.stringify([from.pts, to.pts, radius]);
    if (key === applied) return;
    applied = key;
    if (restoring) {
      restoring = false;
      untrack(() => {
        const savedTrip = trips.find(t => t.line === picked);
        const savedTransfer = xfers.find(x => xkey(x) === picked);
        if (savedTrip) {
          const v = savedTrip.variants[0];
          app.tripStops = [stopAt(v.from), stopAt(v.to)];
          setWalking(v.from, v.to);
        } else if (savedTransfer) {
          const [a, b] = savedTransfer.legs;
          app.tripStops = [stopAt(a.from), stopAt(a.to), ...(stop(b.from) === stop(a.to) ? [] : [stopAt(b.from)]), stopAt(b.to)];
          setWalking(a.from, b.to, [a.to, b.from]);
        } else picked = null;
      });
      return;
    }
    untrack(() => {
      picked = null;
      app.tripStops = []; app.walking = [];
      if (trips.length) app.showTrip(trips.map(t => ({ id: t.line, variants: t.variants.map(v => v.id) })));
      else if (xfers.length) pickXfer(xfers[0]);
    });
    if ((trips.length || xfers.length) && phone()) {
      folded = false;
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
  });

  function reset() {
    stopSearch();
    locGen.from++; locGen.to++;
    ends = { from: { text: "", place: null }, to: { text: "", place: null } };
    picked = null;
    applied = "";
    app.clearChoices();
    onclose();
  }

  function close() {
    stopSearch();
    app.tripEnds = null;
    app.tripStops = []; app.walking = [];
    onclose();
  }

  // The lines of the trip that are on the map, for the folded summary and the alert: which, and where each goes.
  const onMap = $derived((trips ?? []).filter(t => app.selected.includes(t.line)));
  const xferLines = $derived(app.selected.filter(l => !onMap.some(t => t.line === l) && xfers.some(x => x.legs.some(g => g.line === l))));

  // Alert settings, folded until asked for: the stop to wait at (each line's own, or one of the stops
  // nearest the start), how early, and which of the trip's lines on the map. A new trip resets them.
  // A picked change: the alert watches its first line, up to the change stop.
  let alertOpen = $state(false);
  let boardName = $state("");
  let off = $state<string[]>([]);
  const xPicked = $derived(xfers.find(x => xkey(x) === picked) ?? null);
  const aTrips = $derived(xPicked ? [legTrip(xPicked.legs[0])] : trips);
  const aOnMap = $derived((aTrips ?? []).filter(t => app.selected.includes(t.line)));
  $effect(() => { void trips; void xPicked; boardName = ""; off = []; });
  // Another stop to wait at: not for a change, whose first line is boarded where the change was planned.
  const near = $derived(data && from && to && !xPicked && aOnMap.length ? boardings(data.ix, from.pts, to.pts, radius, aOnMap.map(t => t.line)) : []);
  const board = $derived(near.find(b => b.name === boardName) ?? null);
  const tickable = $derived((board ? board.lines.map(l => l.line) : aOnMap.map(t => t.line)).filter(l => app.selected.includes(l)));
  const targets = $derived(aTrips ? alertTargets(aTrips, app.selected, board, off) : []);
  const setTicked = (line: string, on: boolean) => { off = on ? off.filter(l => l !== line) : [...off, line]; };

  // The chosen alert as a link payload (src/lib/tglink.ts): for Telegram and for web push. A recurring
  // one (days, from what time, for how long) is for Telegram only.
  const payload = $derived(data && !data.stale ? encodeAlert(data.ix, n, targets) : null);
  // Athens time, as the bot reads it.
  const nextFive = () => {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Athens", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(Date.now() + 5 * 60_000).map(x => [x.type, x.value]));
    return `${p.hour}:${String(Math.floor(+p.minute / 5) * 5).padStart(2, "0")}`;
  };
  let repDays = $state(0);
  // Hours and minutes as two lists: a time input shows AM/PM on phones set to 12 hours.
  const [h0, m0] = nextFive().split(":").map(Number);
  let repH = $state(h0), repM = $state(m0);
  let repLen = $state(60);
  const rep = $derived.by((): Rep | undefined => (repDays ? { days: repDays, start: repH * 60 + repM, len: repLen } : undefined));
  const tgPayload = $derived(repDays ? (rep && data && !data.stale ? encodeAlert(data.ix, n, targets, rep) : null) : payload);

  // Stop alert for the chosen lines, at the chosen stop: in the page, and as web push where the browser
  // has it (then it comes with the page closed). The permission prompt comes first, from the tap itself
  // (browsers ignore it later).
  const canNotify = typeof Notification !== "undefined";
  // iPhones give web push only to a web app opened from the Home Screen.
  const iosTab = typeof navigator !== "undefined" && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) &&
    !matchMedia("(display-mode: standalone)").matches && !(navigator as { standalone?: boolean }).standalone;
  // One alert at a time: a second tap while the first waits (permission, server) does nothing.
  let pushing = $state(false);
  async function alertMe() {
    if (pushing) return;
    pushing = true;
    try { await startAlert(); } finally { pushing = false; }
  }
  async function startAlert() {
    const t = aTrips, d = data, f = from, p = payload;
    if (!t || !d || !f) return;
    if (canNotify && Notification.permission === "default") await Notification.requestPermission().catch(() => {});
    // Registered before the alert starts: phones show notifications only through it.
    const reg = await navigator.serviceWorker?.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => null);
    if (closed || t !== aTrips) return;   // the trip changed while the browser asked
    const ix = d.ix;
    const lines = targets.map(l => ({ line: l.line, variants: l.variants.map(v => ({ id: v.id, i: v.i, name: ix.s[v.from][0] })) }));
    if (!lines.length) {
      err = aOnMap.length ? "Διάλεξε τουλάχιστον μία γραμμή." : "Καμία γραμμή της διαδρομής δεν είναι στον χάρτη: πάτα μία για να τη δείξεις.";
      return;
    }
    err = null;
    let push: { id: string; until: number } | null = null;
    if (reg && p && canPush() && Notification.permission === "granted") {
      const ready = await Promise.race([navigator.serviceWorker.ready, new Promise<null>(r => setTimeout(r, 5000, null))]);
      push = ready && (await startPush(ready, p));
      if (closed || t !== aTrips || p !== payload) { if (push) void stopPush(push.id); return; }
      if (!push) err = "Η ειδοποίηση δουλεύει μόνο με τη σελίδα ανοιχτή: ο server ειδοποιήσεων δεν απάντησε.";
    }
    app.setAlert({ n, until: push?.until ?? Math.floor(app.serverMs() / 1000) + ALERT_S, label: board?.name ?? f.label, lines, ...(push ? { push: push.id } : {}) });
    alertOpen = false;
  }

  // The same alert in Telegram (src/lib/tglink.ts).
  const BOT = "oasa_bus_bot";
  const tgLink = $derived(tgPayload && `https://t.me/${BOT}?start=${tgPayload}`);

  const stop = (k: number) => displayStop(data?.ix.s[k], locale.language);
  const metres = (m: number) => (m < 50 ? "δίπλα" : `≈ ${Math.round(m / 50) * 50} μ.`);
  const icon = (p: Place) => ({ area: "◎", stop: "🚏", me: "📍", street: "⌖", poi: "•", metro: "🚇", "metro-any": "🚇" })[p.kind ?? "street"];
  const mins = (m: number) => `≈ ${Math.max(1, Math.round(m))}′`;
  // Where a trip gets off: the stop, and for "any metro station" the station there.
  const offAt = (k: number) => { const st = anyEnd && data ? stationAt(ptOf(k)) : null; return st ? `${stop(k)} (🚇 ${nameOf(st)})` : stop(k); };
  const shown = $derived(aTrips ? Math.min(aTrips.length, MAX_LINES) : 0);
  // Where a result goes: the variants that make the trip. The summary follows the direction shown on the map.
  const going = (t: TripLine) => (data ? termini(data.ix, t.line, t.variants.map(v => v.id), locale.language).join(" · ") : "");
  const goingNow = (line: string, variants: string[] = []) => (data ? termini(data.ix, line, app.focus[line] ?? variants, locale.language).join(" · ") : "");

  function onkeydown(f: Field, e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openField = f;
      const k = Math.max(0, Math.min(opts.length - 1, active + (e.key === "ArrowDown" ? 1 : -1)));
      activeKey = opts[k]?.key ?? null;
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = openField === f ? opts[active] : undefined;
      if (o) choose(f, o);
    } else if (e.key === "Escape" && openField) {
      e.stopPropagation();
      openField = null;
    }
  }

</script>

<svelte:document onpointerdown={e => { if (openField && !(e.target as Element).closest?.(".ends")) openField = null; }} />

<div class="trip" role="dialog" tabindex="-1" aria-labelledby="trip-h"
  onkeydown={e => { if (e.key === "Escape" && !openField) { e.stopPropagation(); close(); } }}>
  <nav class="journey-actions" aria-label={locale.language === "en" ? "Journey controls" : "Έλεγχος διαδρομής"}>
    <button type="button" onclick={close}>{locale.language === "en" ? "← Back to main screen" : "← Επιστροφή στην αρχική"}</button>
    <button type="button" onclick={reset}>{locale.language === "en" ? "Start again" : "Νέα αναζήτηση"}</button>
    <button type="button" onclick={() => { folded = false; void tick().then(() => inputs.from?.focus()); }}>{locale.language === "en" ? "Edit from / to" : "Αλλαγή από / προς"}</button>
  </nav>
  {#if folded && from && to && trips}
    <span id="trip-h" class="sr">{tr("Διαδρομή")}</span>
    <div class="row">
      <button type="button" class="summary" aria-expanded="false" onclick={() => (folded = false)}>
        <b>{displayText(from.label, from.label_en, locale.language)} → {displayText(to.label, to.label_en, locale.language)}</b>
        <small>{#if trips.length}{tr(trips.length)} {tr(trips.length === 1 ? "γραμμή" : "γραμμές")}{#if trips.length > MAX_LINES} · {tr(MAX_LINES)}{tr(" στον χάρτη")}{/if}{:else if xfers.length}{tr("με μία αλλαγή")}{/if}{#if app.alert} · <Bell label={tr("ειδοποίηση")} />{/if}</small>
        {#if onMap.length || xferLines.length}
          <span class="lines">
            {#each onMap as t (t.line)}
              <span class="ln" style:--c={tr(app.lineColor(t.line).bg)}><b>{tr(t.line)}</b>{#if goingNow(t.line, t.variants.map(v => v.id))}<i>→ {tr(goingNow(t.line, t.variants.map(v => v.id)))}</i>{/if}</span>
            {/each}
            {#each xferLines as l (l)}
              <span class="ln" style:--c={tr(app.lineColor(l).bg)}><b>{tr(l)}</b>{#if goingNow(l)}<i>→ {tr(goingNow(l))}</i>{/if}</span>
            {/each}
          </span>
        {/if}
      </button>
      <button type="button" class="icon" aria-label={tr("Κλείσιμο διαδρομής")} title={tr("Κλείσιμο")} onclick={close}>×</button>
    </div>
  {:else}
    <div class="row">
      <h3 id="trip-h"><span class="transit-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="16" rx="3"/><path d="M5 13h14M8 19v2m8-2v2M8 7h8"/><circle cx="8.5" cy="16" r=".7"/><circle cx="15.5" cy="16" r=".7"/></svg></span> {locale.language === "en" ? "Transit directions" : "Διαδρομή με συγκοινωνία"}</h3>
      {#if trips?.length || xfers.length}
        <button type="button" class="icon" aria-label={tr("Σύμπτυξη")} title={tr("Σύμπτυξη")} onclick={() => (folded = true)}>
          <svg viewBox="0 0 12 8" width="14" height="10" aria-hidden="true"><path d="M1 6.5l5-5 5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
      {/if}
      <button type="button" class="icon" aria-label={tr("Κλείσιμο διαδρομής")} title={tr("Κλείσιμο")} onclick={close}>×</button>
    </div>

    <div class="ends">
      {#each FIELDS as f (f)}
        {@const e = ends[f]}
        <div class="field">
          <i class="dot {f}" aria-hidden="true">{tr(f === "from" ? "A" : "B")}</i>
          <input id="trip-{f}" bind:this={inputs[f]} type="search" autocomplete="off" spellcheck="false" enterkeyhint="search"
            aria-label={tr((f === "from" ? "Από" : "Προς"))} placeholder={locale.language === "en" ? (f === "from" ? "Choose starting point" : "Choose destination") : (f === "from" ? "Επιλογή αφετηρίας" : "Επιλογή προορισμού")}
            value={e.place?.kind === "me" ? tr(ME) : displayText(e.text, e.place?.label_en, locale.language)} class:set={!!e.place}
            role="combobox" aria-expanded={openField === f} aria-controls="trip-{f}-list" aria-autocomplete="list"
            aria-activedescendant={openField === f && opts[active] ? `trip-${f}-${active}` : undefined}
            onfocus={() => { openField = f; }} oninput={ev => edit(f, ev.currentTarget.value)} onkeydown={ev => onkeydown(f, ev)} />
          {#if e.text}<button type="button" class="icon" aria-label={locale.language === "en" ? (f === "from" ? "Clear starting point" : "Clear destination") : (f === "from" ? "Διαγραφή αφετηρίας" : "Διαγραφή προορισμού")} onclick={() => { edit(f, ""); inputs[f]?.focus(); }}>×</button>{/if}
        </div>
      {/each}
      <button type="button" class="swap" aria-label={tr("Αντιστροφή αφετηρίας και προορισμού")} title={tr("Αντιστροφή")} onclick={swap}>⇅</button>
        {#if openField}
            {@const f = openField}
            <ul id="trip-{f}-list" class="list" role="listbox" aria-label={tr((f === "from" ? "Αφετηρία" : "Προορισμός"))}>
              {#each opts as o, k (o.key)}
                <!-- svelte-ignore a11y_click_events_have_key_events (keyboard goes through the combobox input) -->
                <li id="trip-{f}-{k}" role="option" aria-selected={k === active} class:active={k === active}
                  onpointerdown={ev => ev.preventDefault()} onclick={() => choose(f, o)}>
                  {#if o.me}<span><i aria-hidden="true">📍</i> {tr(ME)}</span>
                  {:else if o.place}
                    <span><i aria-hidden="true">{tr(icon(o.place))}</i> {displayText(o.place.label, o.place.label_en, locale.language)}</span>
                    <small>{tr(o.place.kind === "metro-any" ? "η γραμμή που σε πάει πιο γρήγορα σε σταθμό" : o.place.lines.length ? o.place.lines.slice(0, 6).join(" · ") + (o.place.lines.length > 6 ? " …" : "") : o.place.hint ?? "")}</small>
                  {/if}
                </li>
              {:else}
                <li class="empty">{tr(geoBusy ? "Αναζήτηση…" : "Δεν βρέθηκε στάση ή περιοχή με αυτό το όνομα.")}</li>
              {/each}
              {#if geoBusy && opts.length}<li class="empty" aria-hidden="true">{tr("Αναζήτηση περιοχών…")}</li>{/if}
            </ul>
          {/if}

    </div>
    {#if locating}<p class="note">{tr("Εντοπισμός…")}</p>{/if}

    {#if err}<p class="warn" role="status">{tr(err)}</p>{/if}
    {#if byMetro}<p class="metro">{tr("🚇 Με ")}{tr(byMetro.line)}: {tr(byMetro.from)} → {tr(byMetro.to)} · 🚶 {tr(metres(byMetro.walk))} {locale.language === "en" ? "(straight line; walking route not calculated)" : "(σε ευθεία· χωρίς υπολογισμό πεζής πορείας)"}</p>{/if}
    {#if failed}
      <p class="warn">{tr("Δεν φόρτωσαν οι στάσεις. ")}<button type="button" class="link" onclick={load}>{tr("Ξανά")}</button></p>
    {:else if !data}
      <p class="note">{tr("Φόρτωση στάσεων…")}</p>
    {:else if tooClose}
      <p class="note">{#if anyEnd && walkTo}{tr("Ο σταθμός ")}{nameOf(walkTo)}{tr(" είναι ")}{tr(metres(walkTo.d))}{locale.language === "en" ? " away in a straight line." : " σε ευθεία."}{:else}{locale.language === "en" ? "Nearby endpoints: " : "Κοντινά σημεία: "}{tr(metres(endDistance ?? 0))}{locale.language === "en" ? " in a straight line." : " σε ευθεία."}{/if}</p>
    {:else if trips && !trips.length && !xfers.length}
      <p class="note">{locale.language === "en" ? "No route found with stops within 500 m of each end. Try a nearby starting point or destination." : "Δεν βρέθηκε διαδρομή με στάσεις έως 500 μ. σε ευθεία από κάθε σημείο. Δοκίμασε κοντινή αφετηρία ή προορισμό."}</p>
    {:else if trips}
      <p class="note">{locale.language === "en" ? "Choose a journey below to show its lines and stops. Calculate the walking route separately, or open Google Maps." : "Διάλεξε διαδρομή παρακάτω για γραμμές και στάσεις. Υπολόγισε χωριστά τη διαδρομή πεζή ή άνοιξε το Google Maps."}</p>
      {#if picked && app.walking[0]}<div class="walk-summary" role="status"><strong>{locale.language === "en" ? "Shown on map: " : "Στον χάρτη: "}{picked.replace(">", " → ")}</strong><WalkingDetails {app} /><button type="button" onclick={focusWalk}>{locale.language === "en" ? "Show boarding stop on map" : "Δείξε τη στάση επιβίβασης στον χάρτη"}</button><a href={walkUrl(app.walking[0].to, app.walking[0].from)} target="_blank" rel="noopener noreferrer">{locale.language === "en" ? "Walking directions in Google Maps ↗" : "Οδηγίες πεζή στο Google Maps ↗"}</a></div>{/if}
      {#if !trips.length}<p class="note">{tr("Καμία γραμμή λεωφορείου δεν πάει χωρίς αλλαγή.")}</p>{/if}
      <ol class="results">
        {#each trips as t, k (t.line)}
          {@const info = app.lineInfo.get(t.line)}
          {@const v = t.variants[0]}
          <li class:out={k >= MAX_LINES} class:picked={picked === t.line}>
            <button type="button" class="chip" style:--c={tr(app.lineColor(t.line).bg)} style:--t={tr(app.lineColor(t.line).fg)}
              aria-pressed={picked === t.line} title={tr((nameOf(info)))}
              onclick={() => solo(t)}>{tr(t.line)}</button>
            <button type="button" class="pick" aria-pressed={picked === t.line} title={tr("Μόνο αυτή στον χάρτη, με τις στάσεις της")} onclick={() => solo(t)}>
              <small class="selection-label">{picked === t.line ? (locale.language === "en" ? "✓ Shown on map" : "✓ Στον χάρτη") : (locale.language === "en" ? "Show this journey" : "Δείξε αυτή τη διαδρομή")}</small>
              <span><b>{tr(mins(t.min))}</b> {tr(stop(v.from))} → {tr(offAt(v.to))}</span>
              <VehicleType kind={info?.kind} />
              <small>{#if going(t)}{tr("προς ")}{tr(going(t))} · {/if}{tr(t.stops)} {tr(t.stops === 1 ? "στάση" : "στάσεις")}{#if k >= MAX_LINES}{tr(" · εκτός χάρτη (έως ")}{tr(MAX_LINES)}){/if}</small>
            </button>
            <a class="maps" href={mapsTo(v.from)} target="_blank" rel="noopener" title={tr("Με τα πόδια ως τη στάση " + (stop(v.from)) + ", στο Google Maps")}
              aria-label={tr("Με τα πόδια ως τη στάση " + (stop(v.from)) + ", στο Google Maps")}><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></svg></a>
          </li>
        {/each}
      </ol>
      {#if xfers.length}
        <h4 class="sub">{tr("Με μία αλλαγή")}</h4>
        <ol class="results">
          {#each xfers as x (xkey(x))}
            {@const [a, b] = x.legs}
            <li class:picked={picked === xkey(x)}>
              <button type="button" class="pair" aria-label={(locale.language === "en" ? "Show journey " : "Δείξε τη διαδρομή ") + a.line + " → " + b.line} aria-pressed={picked === xkey(x)} onclick={() => pickXfer(x)}>
                <b class="chip on" style:--c={tr(app.lineColor(a.line).bg)} style:--t={tr(app.lineColor(a.line).fg)}>{tr(a.line)}</b>
                <b class="chip on" style:--c={tr(app.lineColor(b.line).bg)} style:--t={tr(app.lineColor(b.line).fg)}>{tr(b.line)}</b>
              </button>
              <button type="button" class="pick" aria-pressed={picked === xkey(x)} title={tr("Αυτές οι δύο στον χάρτη, με τις στάσεις")} onclick={() => pickXfer(x)}>
                <small class="selection-label">{picked === xkey(x) ? (locale.language === "en" ? "✓ Shown on map" : "✓ Στον χάρτη") : (locale.language === "en" ? "Show this journey" : "Δείξε αυτή τη διαδρομή")}</small>
                <span><b>{tr(mins(x.min))}</b> {tr(stop(a.from))} → {tr(stop(a.to))}{tr(", αλλαγή: ")}{tr(stop(b.from))} → {tr(offAt(b.to))}</span>
                <span><VehicleType kind={app.lineInfo.get(a.line)?.kind} /> → <VehicleType kind={app.lineInfo.get(b.line)?.kind} /></span>
                <small>{tr(a.stops + b.stops)}{tr(" στάσεις · με ~5′ αναμονή")}</small>
              </button>
              <a class="maps" href={mapsTo(a.from)} target="_blank" rel="noopener" title={tr("Με τα πόδια ως τη στάση " + (stop(a.from)) + ", στο Google Maps")}
                aria-label={tr("Με τα πόδια ως τη στάση " + (stop(a.from)) + ", στο Google Maps")}><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></svg></a>
            </li>
          {/each}
        </ol>
      {/if}
      {#if picked && trips.length}<button type="button" class="link all" onclick={showAll}>{tr("Όλες οι γραμμές στον χάρτη")}</button>{/if}
      {#if shown}
        <div class="alert">
          {#if app.alert}
            {@const a = app.alert}
            <span><Bell /> {tr(a.lines.map(l => l.line).join(", "))}{tr(": έως ")}{tr(a.n)} {tr(a.n === 1 ? "στάση" : "στάσεις")}{tr(" πριν από ")}{tr(a.label)}{tr(a.push ? ", και με κλειστή σελίδα" : "")}.</span>
            <button type="button" class="link" onclick={() => app.setAlert(null)}>{tr("Ακύρωση")}</button>
            {#if tgLink}<a class="bell tg" href={tgLink} target="_blank" rel="noopener">{tr("Στο Telegram")}</a>{/if}
          {:else if data.stale}
            <small>{tr("Ειδοποίηση: όχι με παλιά δεδομένα στάσεων.")}</small>
          {:else}
            <button type="button" class="lead" aria-expanded={alertOpen} aria-controls="trip-alert" onclick={() => (alertOpen = !alertOpen)}>
              <Bell />{tr(" Ειδοποίηση\r\n              ")}<svg viewBox="0 0 12 8" width="12" height="8" aria-hidden="true" class:up={alertOpen}><path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </button>
          {/if}
        </div>
        {#if alertOpen && !app.alert && !data.stale}
          <div id="trip-alert" class="form">
            {#if xPicked}<p class="note">{tr("Για την πρώτη γραμμή, ")}{tr(xPicked.legs[0].line)}{tr(", ως την αλλαγή στη στάση ")}{tr(stop(xPicked.legs[0].to))}.</p>{/if}
            {#if near.length > 1}
              <label>{tr("Στάση\r\n                ")}<select bind:value={boardName}>
                  <option value="">{tr("η κοντινότερη κάθε γραμμής")}</option>
                  {#each near as b (b.name)}<option value={b.name}>{nameOf({ name: b.name, name_en: b.name_en })} · {tr(metres(b.walk))} · {tr(b.lines.map(l => l.line).join(", "))}</option>{/each}
                </select>
              </label>
            {/if}
            <label>{tr("Πότε\r\n              ")}<select bind:value={n}>
                {#each [1, 2, 3, 4, 5] as k (k)}<option value={k}>{tr(k === 1 ? "στην προηγούμενη στάση" : `${k} στάσεις πριν`)}</option>{/each}
              </select>
            </label>
            <label>{tr("Επανάληψη\r\n              ")}<select bind:value={repDays}>
                <option value={0}>{tr("όχι, μόνο τώρα")}</option>
                <option value={31}>{tr("τις καθημερινές")}</option>
                <option value={127}>{tr("κάθε μέρα")}</option>
                <option value={96}>{tr("τα Σαββατοκύριακα")}</option>
              </select>
            </label>
            {#if repDays}
              <label>{tr("Από\r\n                ")}<select class="hm" bind:value={repH} aria-label={tr("Ώρα")}>{#each { length: 24 }, h (h)}<option value={h}>{tr(String(h).padStart(2, "0"))}</option>{/each}</select>:<select
                  class="hm" bind:value={repM} aria-label={tr("Λεπτά")}>{#each { length: 12 }, k (k)}<option value={k * 5}>{tr(String(k * 5).padStart(2, "0"))}</option>{/each}</select>{tr("\r\n                για ")}<select bind:value={repLen}>{#each [[30, "½ ώρα"], [60, "1 ώρα"], [90, "1½ ώρα"], [120, "2 ώρες"]] as const as [m, t] (m)}<option value={m}>{tr(t)}</option>{/each}</select>
              </label>
            {/if}
            <fieldset>
              <legend>{tr("Γραμμές")}</legend>
              {#each tickable as l (l)}
                {@const info = app.lineInfo.get(l)}
                <label class="ln" style:--c={tr(app.lineColor(l).bg)}>
                  <input type="checkbox" checked={!off.includes(l)} onchange={e => setTicked(l, e.currentTarget.checked)} /><b>{tr(l)}</b>
                </label>
              {/each}
            </fieldset>
            <div class="go">
              {#if !repDays}<button type="button" class="bell" disabled={!targets.length || pushing} onclick={alertMe}>{tr(pushing ? "…" : "Εδώ")}</button>{/if}
              {#if tgLink}<a class="bell tg" href={tgLink} target="_blank" rel="noopener">{tr("Στο Telegram")}</a>
              {:else if repDays}<small class="warn">{tr("Διάλεξε ώρα έναρξης, ώστε να τελειώνει ως τα μεσάνυχτα.")}</small>{/if}
            </div>
            {#if repDays}
              <p class="note">{tr("Η επανάληψη γίνεται στο Telegram (@")}{tr(BOT)}{tr("): σου γράφει κάθε φορά που ένα λεωφορείο πλησιάζει, μόνο σε αυτές τις ώρες.\r\n                Εκεί, /list δείχνει τις ειδοποιήσεις σου και τις σταματάει.")}</p>
            {:else}
            <p class="note">{tr("Για 2 ώρες.\r\n              ")}{#if canPush()}{tr("Εδώ: και με κλειστή σελίδα ή κλειδωμένη οθόνη.\r\n              ")}{:else}{tr("Εδώ: όσο η σελίδα είναι ανοιχτή")}{tr(canNotify ? "" : ", μόνο μέσα στη σελίδα")}.{/if}{tr("\r\n              Telegram: και με κλειδωμένη οθόνη, από το @")}{tr(BOT)}.</p>
            {/if}
            {#if iosTab && !repDays}
              <p class="note">{tr("iPhone, για ειδοποίηση εδώ με κλειδωμένη οθόνη: Κοινοποίηση → «Προσθήκη στην οθόνη Αφετηρίας», και άνοιξε τον χάρτη από το εικονίδιο.")}</p>
            {/if}
          </div>
        {/if}
      {/if}
    {:else}
      <p class="note">{tr("Διάλεξε από πού και προς τα πού: οι γραμμές που τα συνδέουν φαίνονται στον χάρτη.")}</p>
    {/if}

    <div class="foot">
      {#if trips?.length || xfers.length}<small>{locale.language === 'en' ? 'Indicative journey times use approximate walking and exclude the initial wait. They are not live arrival predictions.' : 'Οι ενδεικτικοί χρόνοι χρησιμοποιούν προσεγγιστικό περπάτημα και δεν περιλαμβάνουν την αρχική αναμονή. Δεν είναι ζωντανές προβλέψεις άφιξης.'}</small>{/if}
      {#if data?.stale}<small>{tr("Στάσεις από ")}{tr(data.stale)}{tr("· μπορεί να έχουν αλλάξει.")}</small>{/if}
      {#if geo?.places.length}<small>{tr("Περιοχές: © OpenStreetMap")}</small>{/if}
    </div>
  {/if}
</div>

<style>
  .journey-actions { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; gap: 6px; padding: 6px 0; background: var(--panel); }
  .journey-actions button { min-height: 44px; padding: 6px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--control); color: var(--fg); cursor: pointer; }

  .trip { min-height: 0; padding: 4px 0 0; font-size: 13px;
    background: transparent; border: 0; border-radius: 0; box-shadow: none; box-sizing: border-box; overflow: visible; }
  .sr { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .row { display: flex; align-items: center; gap: 4px; }
  h3 { flex: 1; margin: 0; font-size: 15px; }
  .transit-icon { display: inline-grid; place-items: center; width: 38px; height: 38px; margin-right: 5px; color: var(--accent); background: var(--control); border-radius: 50%; }
  .icon { display: grid; place-items: center; flex: none; width: 34px; height: 34px; border: 0; border-radius: 8px; background: none;
    color: var(--muted); font-size: 20px; cursor: pointer; }
  .icon:hover { background: var(--control); color: var(--fg); }
  .summary { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; padding: 4px 8px; border: 0;
    border-radius: 8px; background: none; color: var(--fg); text-align: left; cursor: pointer; }
  .summary b { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
  .summary small { color: var(--muted); }
  .summary:hover { background: var(--control); }
  .lines { display: flex; flex-wrap: wrap; gap: 4px; max-width: 100%; margin-top: 4px; }
  .ln { display: inline-flex; align-items: center; gap: 4px; max-width: 100%; padding: 0 8px; border: 2px solid var(--c);
    border-radius: 12px; font-size: 12px; line-height: 20px; }
  .ln i { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-style: normal; color: var(--muted); }
  .ends { position: relative; display: flex; flex-direction: column; gap: 6px; margin-top: 6px; padding-right: 38px; }
  .field { display: flex; align-items: center; gap: 6px; }
  .dot { flex: none; display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; background: #222; color: #fff;
    font: normal 700 11px system-ui, sans-serif; }
  /* 16px: iOS zooms into smaller inputs on focus. */
  .field input { flex: 1; min-width: 0; height: 48px; padding: 0 10px; border: 1px solid var(--border); border-radius: 9px;
    background: var(--control); color: var(--fg); font-size: 16px; }
  .field input.set { border-color: var(--accent); }
  .swap { position: absolute; right: 0; top: 28px; width: 34px; height: 40px; border: 0; border-radius: 8px; background: none;
    color: var(--muted); font-size: 18px; cursor: pointer; }
  .swap:hover { background: var(--control); color: var(--fg); }
  .list { margin: 0 -38px 0 26px; max-height: min(320px, 45dvh); overflow-y: auto; padding: 4px; list-style: none;
    background: var(--control); border-radius: 10px; }
  .list li { display: flex; flex-direction: column; padding: 8px; border-radius: 7px; cursor: pointer; }
  .list li i { font-style: normal; display: inline-block; width: 1.3em; text-align: center; }
  .list li small { padding-left: 1.6em; color: var(--muted); font-size: 11px; }
  .list li.active, .list li:hover { background: var(--panel); }
  .list li.empty { cursor: default; color: var(--muted); font-size: 12px; background: none; }
  .results { margin: 8px 0 0; padding: 0; list-style: none; }
  .results li { display: flex; align-items: flex-start; gap: 8px; padding: 4px 0; }
  .results li.out { opacity: .6; }
  .results small { color: var(--muted); }
  .chip { flex: none; min-width: 46px; min-height: 28px; padding: 0 8px; border: 2px solid var(--c); border-radius: 14px;
    background: none; color: var(--fg); font-weight: 700; cursor: pointer; }
  .chip[aria-pressed="true"], .chip.on { background: var(--c); color: var(--t); }
  .chip.on { display: inline-grid; place-items: center; min-width: 0; cursor: default; }
  .pair { border: 0; padding: 0; background: none; color: inherit; cursor: pointer; flex: none; display: flex; flex-direction: column; gap: 2px; }
  .pick { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 1px; padding: 2px 6px; margin: -2px 0;
    border: 0; border-radius: 8px; background: none; color: var(--fg); font-size: 13px; text-align: left; cursor: pointer; }
  .pick:hover, .picked .pick { background: var(--control); }
  .picked .pick { box-shadow: inset 3px 0 var(--accent); padding-left: 10px; }
  .results .selection-label { color: var(--accent); font-weight: 700; }
  .walk-summary { display: grid; gap: 8px; padding: 10px; border: 1px solid var(--accent); border-radius: 10px; font-size: 12px; }
  .walk-summary button { min-height: 44px; background: var(--accent); color: #fff; border: 0; border-radius: 8px; cursor: pointer; }
  .walk-summary a { color: var(--accent); }
  .pick b { font-variant-numeric: tabular-nums; }
  .maps { flex: none; display: grid; place-items: center; width: 44px; height: 44px; margin: 0; border-radius: 8px; color: var(--muted); }
  .maps:hover { background: var(--control); color: var(--fg); }
  .maps svg { fill: none; stroke: currentColor; stroke-width: 2; stroke-linejoin: round; }
  .metro { margin: 8px 0 0; padding: 6px 8px; border-radius: 8px; background: var(--control); font-size: 13px; }
  .sub { margin: 10px 0 0; font-size: 12px; color: var(--muted); font-weight: 600; }
  .all { margin-top: 6px; font-size: 12px; padding: 0; }
  .form > label select.hm { flex: none; font-variant-numeric: tabular-nums; }
  .alert { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border); }
  .alert span { flex: 1; }
  .alert .lead { display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 0 8px; margin-left: -8px; border: 0;
    border-radius: 8px; background: none; color: var(--fg); font-weight: 600; font-size: 13px; cursor: pointer; }
  .alert .lead:hover { background: var(--control); }
  .alert .lead svg.up { transform: rotate(180deg); }
  .form { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
  .form > label { display: flex; align-items: center; gap: 8px; color: var(--muted); }
  .form > label select { flex: 1; min-width: 0; }
  .form fieldset { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 0; padding: 0; border: 0; }
  .form legend { float: left; margin-right: 2px; color: var(--muted); }
  .form .ln { min-height: 30px; cursor: pointer; }
  .form .ln input { margin: 0; accent-color: var(--c); }
  .go { display: flex; gap: 6px; }
  .bell:disabled { opacity: .5; cursor: default; }
  .bell.tg { display: inline-grid; place-items: center; background: #229ed9; text-decoration: none; }
  .bell { min-height: 34px; padding: 0 12px; border: 0; border-radius: 9px; background: var(--accent); color: #fff; font-weight: 600;
    font-size: 14px; cursor: pointer; }
  select { min-height: 34px; padding: 0 6px; border: 1px solid var(--border); border-radius: 8px; background: var(--control);
    color: var(--fg); font-size: 16px; }
  .foot { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; margin-top: 8px; color: var(--muted); font-size: 12px; }

  .note { display: block; margin: 8px 0 0; color: var(--muted); font-size: 12px; }
  .warn { margin: 8px 0 0; color: var(--late2); }
  .link { border: 0; background: none; color: var(--accent); text-decoration: underline; cursor: pointer; font-size: inherit; }
</style>
