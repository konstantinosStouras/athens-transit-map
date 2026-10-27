<script lang="ts">
  import { t as tr, locale } from "../i18n.svelte";
  import { untrack } from "svelte";
  import { byDayType, DATA_URL, hourBand, lineTrends, LONG_DAYS, MIN_LINE_HOURS, storedDays, type Stored } from "../stats";
  import HourChart from "./HourChart.svelte";

  let data = $state<{ kind: "loading" } | { kind: "ok"; s: Stored } | { kind: "none" } | { kind: "error" }>({ kind: "loading" });

  async function load() {
    if (data.kind !== "ok") data = { kind: "loading" };
    try {
      const s = await storedDays();
      if (!gone) data = s ? { kind: "ok", s } : { kind: "none" };
    } catch {
      if (!gone) data = { kind: "error" };
    }
  }

  // Loaded each time the tab is shown (the module keeps the days an hour); a late answer is dropped.
  let gone = false;
  $effect(() => {
    untrack(load);
    return () => (gone = true);
  });

  const nf = (n: number) => Math.round(n).toLocaleString(locale.language === "en" ? "en-GB" : "el-GR");
  const dec = (n: number) => n.toLocaleString(locale.language === "en" ? "en-GB" : "el-GR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const pct = (c: number) => `${c > 0 ? "+" : "−"}${Math.abs(Math.round(c * 100))}%`;
  const hh = (h: number) => `${String(h % 24).padStart(2, "0")}:00`;
  const dm = (date: string, weekday = false) => new Date(`${date}T12:00:00Z`).toLocaleDateString(locale.language === "en" ? "en-GB" : "el-GR",
    { ...(weekday ? { weekday: "long" } : {}), day: "numeric", month: "long", timeZone: "UTC" });
  const kmhText = (v: number | null) => (v == null ? "χωρίς δεδομένα" : `${dec(v)} km/h`);

  const MIN_DAYS = 2;
  const stored = $derived(data.kind === "ok" ? data.s : null);
  const days = $derived(stored?.days ?? []);
  const band = $derived(hourBand(days));
  const types = $derived(byDayType(days));
  const trends = $derived(lineTrends(days, 8));
  const weekend = $derived(types.weekend.days), weekday = $derived(types.weekday.days);
  // The slowest daytime hour, where the charts start for the keyboard.
  const slowest = $derived(band.reduce<number | null>((a, b) => b.h >= 6 && b.kmh != null && (a == null || b.kmh < band[a].kmh!) ? b.h : a, null) ?? 12);
  const peak = $derived(types.weekday.hours.reduce((a, b) => ((b.vehicles ?? 0) > (types.weekday.hours[a].vehicles ?? 0) ? b.h : a), 0));
  const maxPct = $derived(Math.max(0.01, ...[...(trends?.slower ?? []), ...(trends?.faster ?? [])].map(t => Math.abs(t.change))));

  let measured = $state(0);
  const w = $derived(Math.max(240, measured));
  let selBand = $state<number | null>(null), selVeh = $state<number | null>(null), selSpd = $state<number | null>(null);

  const bandText = (i: number) => band[i].kmh == null ? `${hh(i)}: χωρίς δεδομένα`
    : `${hh(i)}: ${dec(band[i].kmh!)} km/h, από ${dec(band[i].min!)} έως ${dec(band[i].max!)} (${band[i].n} μέρες)`;
  const pair = (i: number, f: (t: "weekday" | "weekend") => string) =>
    `${hh(i)}: καθημερινές ${f("weekday")}${weekend ? ` · Σαββατοκύριακα ${f("weekend")}` : ""}`;
  const vehText = (i: number) => pair(i, t => { const v = types[t].hours[i].vehicles; return v == null ? "–" : nf(v); });
  const spdText = (i: number) => pair(i, t => kmhText(types[t].hours[i].kmh));
  const series = (key: "vehicles" | "kmh") => [
    ...(weekday ? [{ values: types.weekday.hours.map(h => h[key]), cls: "" }] : []),
    ...(weekend ? [{ values: types.weekend.hours.map(h => h[key]), cls: "alt" }] : []),
  ];
</script>

{#if data.kind === "loading"}
  <p class="muted">{tr("Φόρτωση…")}</p>
{:else if data.kind === "error"}
  <p class="muted">{tr("Οι προηγούμενες μέρες δεν φόρτωσαν.")}</p>
  <button type="button" class="retry" onclick={load}>{tr("Δοκίμασε ξανά")}</button>
{:else if !stored || days.length < MIN_DAYS}
  <p class="muted">{tr("Λίγες μέρες ακόμα: ")}{tr(days.length)}{tr(" πλήρεις. Τα μακροχρόνια γραφήματα χρειάζονται τουλάχιστον ")}{tr(MIN_DAYS)}.</p>
{:else}
  <p class="lede">{tr(days.length)}{tr(" πλήρεις μέρες, ")}{tr(dm(days[0].date))} – {tr(dm(days.at(-1)!.date))}: {tr(weekday)}{tr(" καθημερινές και ")}{tr(weekend)} {tr(weekend === 1 ? "μέρα" : "μέρες")}{tr(" Σαββατοκύριακου.\r\n    ")}{#if stored.partial || stored.bad}<br /><span class="warn">{tr("Εκτός:\r\n      ")}{#if stored.partial}{tr(stored.partial)} {tr(stored.partial === 1 ? "μερική μέρα" : "μερικές μέρες")}{/if}{#if stored.partial && stored.bad}, {/if}{#if stored.bad}{tr(stored.bad)} {tr(stored.bad === 1 ? "αρχείο" : "αρχεία")}{tr(" που δεν διαβάστηκαν")}{/if}.</span>{/if}</p>

  <section bind:clientWidth={measured}>
    <h3>{tr("Ταχύτητα ανά ώρα, όλες οι μέρες")}</h3>
    <p class="read" aria-live="polite">{tr(bandText(selBand ?? slowest))}</p>
    <HourChart {w} label={tr("Μέση ταχύτητα ανά ώρα με εύρος ημερών")} step={10} start={slowest} bind:sel={selBand}
      series={[{ values: band.map(b => b.kmh), cls: "" }]} band={{ min: band.map(b => b.min), max: band.map(b => b.max) }} valuetext={bandText} />
    <p class="note">{tr("Η γραμμή: km/h όλων των ημερών μαζί (απόσταση προς χρόνο). Η σκιά: από την πιο αργή έως την πιο γρήγορη μέρα σε κάθε ώρα.")}</p>
  </section>

  <section>
    <h3>{tr("Καθημερινές και Σαββατοκύριακα")}</h3>
    <p class="legend"><span><i class="key"></i>{tr("Δευτέρα–Παρασκευή (")}{tr(weekday)} {tr(weekday === 1 ? "μέρα" : "μέρες")})</span>
      {#if weekend}<span><i class="key alt"></i>{tr("Σάββατο–Κυριακή (")}{tr(weekend)} {tr(weekend === 1 ? "μέρα" : "μέρες")})</span>{/if}</p>
    <h4>{tr("Οχήματα στον δρόμο")}</h4>
    <p class="read" aria-live="polite">{tr(vehText(selVeh ?? peak))}</p>
    <HourChart {w} label={tr("Οχήματα ανά ώρα, καθημερινές και Σαββατοκύριακα")} step={250} start={peak} bind:sel={selVeh}
      series={series("vehicles")} valuetext={vehText} />
    <h4>{tr("Μέση ταχύτητα")}</h4>
    <p class="read" aria-live="polite">{tr(spdText(selSpd ?? slowest))}</p>
    <HourChart {w} label={tr("Μέση ταχύτητα ανά ώρα, καθημερινές και Σαββατοκύριακα")} step={10} start={slowest} bind:sel={selSpd}
      series={series("kmh")} valuetext={spdText} />
    <p class="note">{tr("Οχήματα: μέσος όρος των ημερών. Ταχύτητα: όλες οι μέρες κάθε ομάδας μαζί. Οι αργίες μετράνε στην ημέρα της εβδομάδας τους.")}</p>
  </section>

  <section>
    <h3>{tr("Γραμμές που άλλαξαν")}</h3>
    {#if trends && trends.eligible}
      <p class="read">{tr(dm(trends.date, true))}{tr(" σε σχέση με ")}{tr(trends.baseDays)}{tr(" προηγούμενες ")}{tr(trends.weekend ? "μέρες Σαββατοκύριακου" : "καθημερινές")}</p>
      <div class="rank">
        {#each [["Πιο αργά", trends.slower], ["Πιο γρήγορα", trends.faster]] as const as [title, rows] (title)}
          <div>
            <h4>{tr(title)}</h4>
            {#if rows.length}
              <ol>
                {#each rows as t (t.line)}
                  <li title={tr((t.line) + ": " + (dec(t.base)) + " → " + (dec(t.kmh)) + " km/h (" + (pct(t.change)) + ")")}>
                    <b>{tr(t.line)}</b><span class="v">{tr(dec(t.base))} → {tr(dec(t.kmh))}</span>
                    <span class="track"><span class:up={t.change > 0} style:width="{tr((Math.abs(t.change) / maxPct) * 100)}%"></span></span>
                    <span class="p">{tr(pct(t.change))}</span>
                  </li>
                {/each}
              </ol>
            {:else}<p class="muted small">{tr("Καμία.")}</p>{/if}
          </div>
        {/each}
      </div>
      <p class="note">{tr("km/h της τελευταίας μέρας και των προηγούμενων ίδιου τύπου μαζί. Μόνο γραμμές με τουλάχιστον ")}{tr(MIN_LINE_HOURS)}{tr(" ώρες κίνησης οχημάτων και στις δύο (")}{tr(trends.eligible)}{tr(" γραμμές).")}</p>
    {:else}
      <p class="muted">{tr("Χρειάζονται τουλάχιστον 2 προηγούμενες πλήρεις μέρες ίδιου τύπου με την τελευταία (")}{tr(days.at(-1) && dm(days.at(-1)!.date, true))}).</p>
    {/if}
  </section>

  <p class="foot"><a href={DATA_URL} target="_blank" rel="noopener">{tr("Δες τα δεδομένα")}</a>{tr(" · έως ")}{tr(LONG_DAYS)}{tr(" τελευταίες μέρες, μόνο πλήρεις")}</p>
{/if}

<style>
  h3 { margin: 0; font-size: 14px; }
  h4 { margin: 10px 0 0; font-size: 12px; color: var(--muted); font-weight: 600; }
  .rank h4 { margin: 0 0 4px; }
  .lede { margin: 0 0 8px; color: var(--muted); }
  .warn { color: var(--late2); }
  .muted { color: var(--muted); }
  .small { margin: 0; font-size: 13px; }
  .retry { min-height: 36px; padding: 0 14px; border: 1px solid var(--border); border-radius: 18px; background: var(--control); cursor: pointer; }
  section { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--border); }
  .read { margin: 2px 0 6px; min-height: 20px; color: var(--muted); font-size: 13px; font-variant-numeric: tabular-nums; }
  .note { margin: 6px 0 0; color: var(--muted); font-size: 12px; }
  .legend { display: flex; flex-wrap: wrap; gap: 4px 16px; margin: 6px 0 0; color: var(--muted); font-size: 12px; }
  .legend span { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
  .key { width: 18px; height: 0; border-top: 2px solid var(--accent); }
  .key.alt { border-top: 2px dashed var(--late2); }
  .rank { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; margin-top: 4px; }
  ol { margin: 0; padding: 0; list-style: none; }
  li { display: grid; grid-template-columns: 40px 86px 1fr 40px; align-items: center; gap: 8px; height: 22px; font-size: 13px; }
  li b { text-align: right; }
  .track { height: 10px; border-radius: 2px; background: var(--control); }
  .track span { display: block; height: 100%; border-radius: 2px; background: var(--late2); }
  .track span.up { background: var(--ontime); }
  .v, .p { color: var(--muted); font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
  .foot { margin: 18px 0 0; font-size: 12px; color: var(--muted); }
  .foot a { color: var(--accent); }
  @media (max-width: 719px) {
    .rank { grid-template-columns: 1fr; }
  }
</style>
