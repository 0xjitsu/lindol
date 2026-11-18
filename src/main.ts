import './style.css';
import cities from './data/cities.json';
import explainers from './data/explainers.json';
import safety from './data/safety.json';
import { translate, type Lang } from './lib/i18n';
import { formatPHT, relative } from './lib/time';
import { buildUrl, filterQuakes, parseGeoJson, summarize, type Params, type Quake, type QuakeView } from './lib/quakes';
import {
  MAGS, PERIODS, RADII, cacheKey, loadCache, loadCity, loadControls, loadLang, saveCache, saveCity, saveControls, saveLang,
  type Controls,
} from './lib/storage';

/** TODO: placeholder until Berna picks an account. Set to '' to hide the donation link. */
const DONATE_URL = 'https://github.com/sponsors/0xjitsu';
const POLL_MS = 5 * 60 * 1000; // never poll faster than every 5 minutes

interface City { name: string; region: string; lat: number; lon: number }
interface Data { quakes: Quake[]; fetchedAt: number; stale: boolean }
type Status = 'loading' | 'ok' | 'error' | 'offline';

const CITIES = cities as City[];
let lang: Lang = loadLang();
const controls: Controls = loadControls();
let city: City = CITIES.find((c) => c.name === loadCity()) ?? CITIES.find((c) => c.name === 'Manila') ?? CITIES[0];
let status: Status = 'loading';
let data: Data | null = null;
let reqId = 0;
let controller: AbortController | null = null;

const t = (key: string, vars: Record<string, string | number> = {}) => translate(lang, key, vars);
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel);
const magText = (m: number | null) => (m === null ? t('noMag') : m.toFixed(1));
const periodKey = (h: number) => (h === 24 ? '24' : h === 168 ? '168' : '720');
const isCustom = () => 'custom' in city;
const params = (): Params => ({ lat: city.lat, lon: city.lon, radiusKm: controls.radiusKm, periodHours: controls.periodHours, minMag: controls.minMag });

function ago(ms: number): string {
  const r = relative(ms, Date.now());
  return r.unit === 'now' ? t('agoNow') : t(r.unit === 'minute' ? 'agoMinute' : r.unit === 'hour' ? 'agoHour' : 'agoDay', { n: r.n });
}
const band = (m: number | null) => (m === null ? 'na' : m >= 5 ? 'hi' : m >= 4 ? 'mid' : 'lo');

function shell(): void {
  document.documentElement.lang = lang;
  const opt = (vals: number[], cur: number, label: (v: number) => string) =>
    vals.map((v) => `<option value="${v}"${v === cur ? ' selected' : ''}>${esc(label(v))}</option>`).join('');
  const links = (s: { label: string; url: string }[]) => s.map((x) => `<a href="${x.url}" rel="noopener">${esc(x.label)}</a>`).join('; ');
  $('#skip')!.textContent = t('skip');
  $('#app')!.innerHTML = `
  <header class="top">
    <div class="wrap bar">
      <h1>Lindol</h1>
      <div class="lang" role="group" aria-label="${t('language')}">
        <button type="button" data-lang="en" aria-pressed="${lang === 'en'}">English</button>
        <button type="button" data-lang="tl" aria-pressed="${lang === 'tl'}">Tagalog</button>
      </div>
    </div>
    <p class="wrap tag">${esc(t('tagline'))}</p>
  </header>
  <div class="official" role="note"><div class="wrap">
    <strong>${esc(t('official'))}</strong>
    <a href="https://www.phivolcs.dost.gov.ph/" rel="noopener">${t('officialLinks')}</a>
    (<a href="https://earthquake.phivolcs.dost.gov.ph/" rel="noopener">${esc(t('officialEq'))}</a>,
    <a href="https://tsunami.phivolcs.dost.gov.ph/" rel="noopener">${esc(t('officialTsu'))}</a>).
  </div></div>
  <main class="wrap" id="main">
    <section class="panel" aria-label="${t('city')}">
      <div class="field">
        <label for="city-input">${t('city')}</label>
        <input id="city-input" type="text" role="combobox" aria-expanded="false" aria-controls="city-list" aria-autocomplete="list" aria-describedby="city-help" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(city.name)}" />
        <ul id="city-list" role="listbox" aria-label="${t('city')}" hidden></ul>
        <p id="city-help" class="hint">${t('cityHelp')}</p>
      </div>
      <p><button type="button" id="locate" class="btn">${t('useLocation')}</button> <span class="hint" id="locate-note">${t('locationNote')}</span></p>
      <div class="controls">
        <div class="field"><label for="radius">${t('radius')}</label>
          <select id="radius">${opt(RADII, controls.radiusKm, (v) => `${v} km`)}</select></div>
        <div class="field"><label for="period">${t('period')}</label>
          <select id="period">${opt(PERIODS, controls.periodHours, (v) => t('p' + periodKey(v)))}</select></div>
        <div class="field"><label for="minmag">${t('minMag')}</label>
          <select id="minmag">${opt(MAGS, controls.minMag, (v) => `M ≥ ${v.toFixed(1)}`)}</select></div>
      </div>
      <p class="refreshrow"><button type="button" id="refresh" class="btn primary">${t('refresh')}</button>
        <span id="fetched" class="hint"></span></p>
    </section>
    <section id="results" aria-labelledby="list-h" aria-busy="true">
      <h2 id="list-h">${t('listTitle')}</h2>
      <div id="status" role="status" aria-live="polite"></div>
      <div id="plot"></div>
      <ol id="list" class="quake-list"></ol>
    </section>
    <section class="panel safety" aria-labelledby="safe-h">
      <h2 id="safe-h">${t('safetyTitle')}</h2>
      <p class="hint">${t('safetyNote')}</p>
      ${safety.sections.map((s) => `<h3>${esc(s.title)}</h3><ul>${s.steps.map((st) => `<li>${esc(st.text)} <span class="src">(<a href="${st.source.url}" rel="noopener">${esc(st.source.label)}</a>)</span></li>`).join('')}</ul>`).join('')}
      <p class="emerg"><strong>${esc(safety.emergency.text)}</strong> <span class="src">(<a href="${safety.emergency.sources[0].url}" rel="noopener">${esc(safety.emergency.sources[0].label)}</a>)</span></p>
    </section>
    <section class="panel" aria-labelledby="num-h">
      <h2 id="num-h">${t('numbersTitle')}</h2>
      ${explainers.map((e) => `<h3>${esc(e.title)}</h3><p>${esc(e.body)}</p><p class="src">${t('sources')}: ${links(e.sources)}</p>`).join('')}
    </section>
  </main>
  <footer class="foot"><div class="wrap">
    <p>${esc(t('attribution'))}: <a href="https://earthquake.usgs.gov/" rel="noopener">earthquake.usgs.gov</a>.</p>
    <p>${esc(t('notWarning'))}</p>
    <p>${esc(t('license'))}. <a href="https://github.com/0xjitsu/lindol" rel="noopener">Source</a>${DONATE_URL ? ` · <a href="${DONATE_URL}" rel="noopener">${esc(t('donate'))}</a>` : ''}</p>
  </div></footer>`;
  bind();
  renderResults();
}

function matches(q: string): City[] {
  const n = norm(q.trim());
  if (!n) return CITIES.slice(0, 8);
  const starts = CITIES.filter((c) => norm(c.name).startsWith(n));
  const rest = CITIES.filter((c) => !starts.includes(c) && (norm(c.name).includes(n) || norm(c.region).includes(n)));
  return [...starts, ...rest].slice(0, 8);
}

function bind(): void {
  const input = $<HTMLInputElement>('#city-input')!;
  const list = $<HTMLUListElement>('#city-list')!;
  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); };
  const choose = (c: City) => {
    city = c; if (!isCustom()) saveCity(c.name);
    input.value = c.name; close(); void load();
  };
  const open = () => {
    const m = matches(input.value);
    list.innerHTML = m.length
      ? m.map((c, i) => `<li role="option" aria-selected="false"><button type="button" data-i="${i}">${esc(c.name)}<span class="reg">${esc(c.region)}</span></button></li>`).join('')
      : `<li class="none">${t('noCity')}</li>`;
    list.hidden = false; input.setAttribute('aria-expanded', 'true');
    list.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('click', () => choose(m[Number(b.dataset.i)])));
  };
  input.addEventListener('input', open);
  input.addEventListener('focus', () => input.select());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); const m = matches(input.value); if (m[0]) choose(m[0]); }
    else if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown') { if (list.hidden) open(); list.querySelector<HTMLButtonElement>('button')?.focus(); e.preventDefault(); }
  });
  list.addEventListener('keydown', (e) => {
    const bs = [...list.querySelectorAll<HTMLButtonElement>('button')];
    const i = bs.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') { bs[Math.min(i + 1, bs.length - 1)]?.focus(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { (i <= 0 ? input : bs[i - 1]).focus(); e.preventDefault(); }
    else if (e.key === 'Escape') { close(); input.focus(); }
  });
  document.addEventListener('click', (e) => { if (!(e.target as HTMLElement).closest('#city-input, #city-list')) close(); });

  const sel = (id: string, set: (v: number) => void) =>
    $<HTMLSelectElement>(id)!.addEventListener('change', (e) => { set(Number((e.target as HTMLSelectElement).value)); saveControls(controls); void load(); });
  sel('#radius', (v) => (controls.radiusKm = v));
  sel('#period', (v) => (controls.periodHours = v));
  sel('#minmag', (v) => (controls.minMag = v));
  $('#refresh')!.addEventListener('click', () => void load());
  document.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) =>
    b.addEventListener('click', () => { lang = b.dataset.lang === 'tl' ? 'tl' : 'en'; saveLang(lang); shell(); }));
  $('#locate')!.addEventListener('click', () => {
    if (!navigator.geolocation) { $('#locate-note')!.textContent = t('locationDenied'); return; }
    $('#locate-note')!.textContent = t('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { name: t('myLocation'), region: '', lat: pos.coords.latitude, lon: pos.coords.longitude, custom: true };
        city = c; input.value = c.name; $('#locate-note')!.textContent = t('locationNote'); void load();
      },
      () => { $('#locate-note')!.textContent = t('locationDenied'); },
      { timeout: 15000, maximumAge: 600000 },
    );
  });
}

async function load(): Promise<void> {
  const id = ++reqId;
  controller?.abort();
  controller = new AbortController();
  status = 'loading';
  renderResults();
  const p = params();
  const now = Date.now();
  try {
    const res = await fetch(buildUrl(p, now), { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const quakes = parseGeoJson(await res.json());
    if (id !== reqId) return;
    data = { quakes, fetchedAt: now, stale: false };
    if (!isCustom()) saveCache({ key: cacheKey(p), fetchedAt: now, quakes }); // never persist a user's coordinates
    status = 'ok';
  } catch (err) {
    if (id !== reqId || (err instanceof DOMException && err.name === 'AbortError')) return;
    const cached = isCustom() ? null : loadCache(cacheKey(p));
    data = cached ? { quakes: cached.quakes, fetchedAt: cached.fetchedAt, stale: true } : null;
    status = navigator.onLine ? 'error' : 'offline';
  }
  renderResults();
}

function plot(view: QuakeView[], p: Params, ref: number, s: ReturnType<typeof summarize>): string {
  const W = 320, H = 150, L = 38, R = 8, T = 10, B = 24;
  const start = ref - p.periodHours * 3600 * 1000;
  const x = (ms: number) => L + ((ms - start) / (ref - start)) * (W - L - R);
  const y = (km: number) => T + (km / p.radiusKm) * (H - T - B);
  const dots = view.map((q) => `<circle cx="${x(q.time).toFixed(1)}" cy="${y(q.distanceKm).toFixed(1)}" r="${(2 + (q.mag ?? 0)).toFixed(1)}" class="dot ${band(q.mag)}"/>`).join('');
  const label = (q: QuakeView | null, txt: string) =>
    q ? `<text x="${(x(q.time) > W / 2 ? x(q.time) + 4 : x(q.time) - 4).toFixed(1)}" y="${(y(q.distanceKm) - 8).toFixed(1)}" text-anchor="${x(q.time) > W / 2 ? 'end' : 'start'}" class="lbl">${esc(txt)}</text>` : '';
  const title = t('plotTitle', { city: city.name });
  return `<figure class="plot"><svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="plot-t plot-d">
    <title id="plot-t">${esc(title)}</title><desc id="plot-d">${esc(t('plotDesc'))}</desc>
    <rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" class="frame"/>
    <text x="${L - 4}" y="${T + 4}" text-anchor="end" class="ax">0 km</text>
    <text x="${L - 4}" y="${H - B}" text-anchor="end" class="ax">${p.radiusKm}</text>
    <text x="${L}" y="${H - 6}" class="ax">${esc(formatPHT(start).split(',')[0])}</text>
    <text x="${W - R}" y="${H - 6}" text-anchor="end" class="ax">${esc(formatPHT(ref).split(',')[0])}</text>
    ${dots}${label(s.strongest, `${t('strongestLbl')} M${magText(s.strongest?.mag ?? null)}`)}${label(s.closest === s.strongest ? null : s.closest, t('closestLbl'))}
  </svg><figcaption class="hint">${esc(title)}. ${esc(t('plotDesc'))}</figcaption></figure>`;
}

function card(q: QuakeView, tags: string[]): string {
  const when = formatPHT(q.time);
  return `<li class="quake${tags.length ? ' hl' : ''}" data-id="${esc(q.id)}">
    ${tags.length ? `<p class="tags">${tags.map((x) => `<span class="tag-pill">${esc(x)}</span>`).join(' ')}</p>` : ''}
    <div class="row1"><span class="mag mag-${band(q.mag)}"><span class="sr">${t('magnitude')} </span>M${magText(q.mag)}${q.magType ? ` <span class="mtype">${esc(q.magType)}</span>` : ''}</span>
      <span class="place">${esc(q.place || '—')}</span></div>
    <dl class="facts">
      <div><dt>${t('distance')}</dt><dd class="dist">${Math.round(q.distanceKm)} km ${q.direction} <span class="hint">${esc(t('fromCity', { city: city.name }))}</span></dd></div>
      <div><dt>${t('depth')}</dt><dd class="depth">${q.depthKm === null ? t('noDepth') : `${q.depthKm.toFixed(q.depthKm < 10 ? 1 : 0)} km`}</dd></div>
      <div><dt>PHT</dt><dd><time datetime="${new Date(q.time).toISOString()}">${esc(when)}</time> <span class="hint">(${esc(ago(q.time))})</span></dd></div>
    </dl>
    ${q.url ? `<p><a href="${q.url}" rel="noopener">${t('usgsPage')}</a></p>` : ''}</li>`;
}

function renderResults(): void {
  const st = $('#status'), list = $('#list'), plotEl = $('#plot'), fetched = $('#fetched'), res = $('#results');
  if (!st || !list || !plotEl || !fetched || !res) return;
  res.setAttribute('aria-busy', String(status === 'loading'));
  $<HTMLButtonElement>('#refresh')!.disabled = status === 'loading';
  list.innerHTML = ''; plotEl.innerHTML = '';
  fetched.textContent = data ? `${t('fetched')}: ${formatPHT(data.fetchedAt)}` : '';
  if (status === 'loading') { st.innerHTML = `<p class="msg">${t('loading')}</p>`; return; }

  let banner = '';
  if (status !== 'ok') {
    const msg = status === 'offline' ? t('offline') : t('error');
    banner = `<div class="msg warn" role="alert"><p>${msg}</p>${data ? `<p>${t('staleNote')} ${esc(formatPHT(data.fetchedAt))}.</p>` : status === 'offline' ? `<p>${t('offlineNone')}</p>` : ''}
      <p><button type="button" class="btn" id="retry">${t('retry')}</button></p></div>`;
  }
  if (!data) { st.innerHTML = banner; $('#retry')?.addEventListener('click', () => void load()); return; }

  const p = params();
  const view = filterQuakes(data.quakes, p, data.fetchedAt);
  const s = summarize(view);
  const vars = { mag: p.minMag.toFixed(1), km: p.radiusKm, city: city.name, period: t('periodLabel' + periodKey(p.periodHours)), n: s.count };
  if (!s.count) {
    st.innerHTML = `${banner}<p class="msg calm">${esc(t('empty', vars))}</p><p class="hint">${t('emptyCalm')}</p>`;
  } else {
    const sv = (q: QuakeView) => ({ mag: magText(q.mag), dist: Math.round(q.distanceKm), dir: q.direction });
    st.innerHTML = `${banner}<p class="msg summary">${esc(t('summary', vars))}</p>
      <ul class="highlights"><li class="h-strong">${esc(t('summaryStrongest', sv(s.strongest!)))}</li><li class="h-close">${esc(t('summaryClosest', sv(s.closest!)))}</li></ul>`;
    plotEl.innerHTML = plot(view, p, data.fetchedAt, s);
    list.innerHTML = view.map((q) => card(q, [q === s.strongest ? t('strongestLbl') : '', q === s.closest ? t('closestLbl') : ''].filter(Boolean))).join('');
  }
  $('#retry')?.addEventListener('click', () => void load());
}

shell();
void load();
setInterval(() => { if (document.visibilityState === 'visible' && status !== 'loading' && (!data || Date.now() - data.fetchedAt >= POLL_MS)) void load(); }, POLL_MS);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && data && Date.now() - data.fetchedAt >= POLL_MS) void load();
});
