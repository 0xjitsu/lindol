// Headless-browser smoke at mobile and desktop sizes. USGS is mocked from committed fixtures.
// A browser that cannot launch is a FAILURE, not a skip.
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { serve } from './lib/static-server.mjs';

const sample = readFileSync('tests/fixtures/usgs-sample.json', 'utf8');
const emptyFx = readFileSync('tests/fixtures/usgs-empty.json', 'utf8');
const FIXED_NOW = new Date('2026-11-18T05:00:00Z');
const errors = [];
let current = '';
const check = (ok, msg) => { if (!ok) errors.push(`[${current}] ${msg}`); };

async function launch() {
  const tryLaunch = () => chromium.launch();
  try {
    if (!existsSync(chromium.executablePath())) throw new Error('browser executable missing');
    return await tryLaunch();
  } catch (e) {
    console.log(`Chromium not available (${String(e.message).split('\n')[0]}); installing...`);
    const inst = spawnSync('npx', ['playwright', 'install', '--with-deps', 'chromium'], { stdio: 'inherit' });
    if (inst.status !== 0) spawnSync('npx', ['playwright', 'install', 'chromium'], { stdio: 'inherit' });
    return await tryLaunch(); // throws => smoke fails
  }
}

const { server, url } = await serve(resolve('dist'));
const browser = await launch();

async function scenario(name, viewport, fn) {
  current = `${name} ${viewport.width}x${viewport.height}`;
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  await context.clock.setFixedTime(FIXED_NOW);
  const state = { usgs: [], mode: 'sample', bad: [] };
  await context.addInitScript(() => {
    window.__geoCalls = 0;
    if (navigator.geolocation) {
      const orig = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
      navigator.geolocation.getCurrentPosition = (...a) => { window.__geoCalls++; return orig(...a); };
    }
  });
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.origin === url) return route.continue();
    if (u.hostname === 'earthquake.usgs.gov' && u.pathname === '/fdsnws/event/1/query') {
      state.usgs.push(u);
      if (state.mode === 'abort') return route.abort('internetdisconnected');
      if (state.mode === 'error') return route.fulfill({ status: 503, body: 'down' });
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: state.mode === 'empty' ? emptyFx : sample });
    }
    state.bad.push(u.href);
    return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => check(false, `page error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(m.text())) check(false, `console error: ${m.text()}`); });
  page.on('response', (r) => { if (r.url().startsWith(url) && r.status() >= 400) check(false, `same-origin ${r.status()}: ${r.url()}`); });
  try {
    await fn(page, context, state);
  } catch (e) {
    check(false, `threw: ${String(e.message).split('\n').slice(0, 3).join(' ')}`);
  }
  check(state.bad.length === 0, `unexpected third-party requests: ${state.bad.join(', ')}`);
  await context.close();
}

const noOverflow = async (page, what) => {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  check(o.sw <= o.cw, `${what}: horizontal overflow (scrollWidth ${o.sw} > clientWidth ${o.cw})`);
};

for (const viewport of [{ width: 375, height: 812 }, { width: 1280, height: 800 }]) {
  await scenario('sample', viewport, async (page, _c, st) => {
    await page.goto(url);
    await page.waitForSelector('.quake');
    check(await page.locator('html').getAttribute('lang') === 'en', 'html lang should be en');
    check(await page.locator('.quake').count() === 4, `expected 4 quakes (fixture filtered), got ${await page.locator('.quake').count()}`);
    const first = await page.locator('.quake').first().innerText();
    check(/M5\.2/.test(first) && /mb/.test(first), `first quake lacks magnitude+type: ${first}`);
    check(/\d+ km [NSEW]{1,3}/.test(first), 'first quake lacks distance + direction');
    check(/35 km/.test(first), 'first quake lacks depth');
    check(/18 Nov 2026, 10:00 PHT/.test(first), `first quake lacks PHT time: ${first}`);
    check(/3 hr ago/.test(first), 'first quake lacks relative time');
    check(await page.locator('.quake a[href^="https://earthquake.usgs.gov/"]').count() === 4, 'USGS event links missing');
    const hl = await page.locator('.quake.hl').allInnerTexts();
    check(hl.length === 2, `expected 2 highlighted quakes, got ${hl.length}`);
    check(hl.some((x) => /Strongest/.test(x) && /M5\.2/.test(x)), 'strongest highlight wrong');
    check(hl.some((x) => /Closest/.test(x) && /Tagaytay/.test(x)), 'closest highlight wrong');
    const head = await page.locator('#status').innerText();
    check(/4 earthquake\(s\) of M≥2\.5 within 200 km of Manila in the last 7 days/.test(head), `summary wrong: ${head}`);
    check(/Strongest: M5\.2/.test(head) && /Closest: \d+ km [NSEW]+ \(M3\.1\)/.test(head), `headline disagrees with list: ${head}`);
    check(await page.locator('#status[aria-live="polite"]').count() === 1, 'status region lacks aria-live');
    check(/Data fetched: 18 Nov 2026, 13:00 PHT/.test(await page.locator('#fetched').innerText()), 'Data fetched time missing');
    check(await page.locator('text=U.S. Geological Survey (USGS) Earthquake Hazards Program, public domain').isVisible(), 'USGS attribution not visible');
    check(await page.locator('.official a[href="https://www.phivolcs.dost.gov.ph/"]').isVisible(), 'PHIVOLCS banner link not visible');
    check(/Not an official source/.test(await page.locator('.official').innerText()), 'official-source banner text missing');
    check(await page.locator('.official button, .official [aria-label*="ismiss"]').count() === 0, 'banner must not be dismissible');
    check(await page.locator('.plot svg[role="img"]').count() === 1, 'plot missing');
    check(await page.locator('.safety').isVisible() && /911/.test(await page.locator('.safety').innerText()), 'safety card / 911 missing');
    check(await page.locator('.safety a[href^="https://"]').count() >= 5, 'safety sources missing');
    for (const l of ['label[for="radius"]', 'label[for="period"]', 'label[for="minmag"]', 'label[for="city-input"]']) check(await page.locator(l).count() === 1, `missing ${l}`);
    check(await page.evaluate(() => window.__geoCalls) === 0, 'geolocation was requested without a tap');
    const u0 = st.usgs.at(-1);
    check(u0.searchParams.get('maxradiuskm') === '200' && u0.searchParams.get('minmagnitude') === '2.5' && u0.searchParams.get('latitude') === '14.5995', `default request params wrong: ${u0.search}`);
    check(u0.searchParams.get('starttime') === '2026-11-11T05:00:00.000Z', `starttime wrong: ${u0.searchParams.get('starttime')}`);
    await noOverflow(page, 'sample');

    // city picker
    await page.fill('#city-input', 'cebu');
    await page.waitForSelector('#city-list button');
    check(/Cebu City/.test(await page.locator('#city-list button').first().innerText()), 'city search did not find Cebu City');
    await noOverflow(page, 'city list open');
    await page.locator('#city-list button').first().click();
    await page.waitForFunction(() => document.querySelector('#city-input').value === 'Cebu City');
    await page.waitForFunction(() => /Cebu City/.test(document.querySelector('#status').innerText));
    check(Math.abs(Number(st.usgs.at(-1).searchParams.get('latitude')) - 10.3) < 0.5, 'request did not use Cebu coordinates');
    // controls persist
    await page.selectOption('#radius', '500');
    await page.selectOption('#period', '720');
    await page.selectOption('#minmag', '4');
    await page.waitForFunction(() => /M≥4\.0 within 500 km/.test(document.querySelector('#status').innerText));
    const u1 = st.usgs.at(-1);
    check(u1.searchParams.get('maxradiuskm') === '500' && u1.searchParams.get('minmagnitude') === '4', 'control changes not sent');
    await page.reload();
    await page.waitForSelector('.quake, .calm');
    check(await page.inputValue('#city-input') === 'Cebu City', 'last city not remembered');
    check(await page.inputValue('#radius') === '500' && await page.inputValue('#period') === '720' && await page.inputValue('#minmag') === '4', 'controls not remembered');
    // language toggle
    await page.click('[data-lang="tl"]');
    check(await page.locator('html').getAttribute('lang') === 'tl', 'html lang did not follow toggle');
    check(/Mga lindol/.test(await page.locator('#list-h').innerText()), 'Tagalog heading missing');
    await page.click('[data-lang="en"]');
    await noOverflow(page, 'after controls');
    // geolocation only on tap
    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation({ latitude: 7.19, longitude: 125.45 });
    await page.click('#locate');
    await page.waitForFunction(() => document.querySelector('#city-input').value === 'My location');
    check(await page.evaluate(() => window.__geoCalls) === 1, 'geolocation not called exactly once after tap');
    check(Math.abs(Number(st.usgs.at(-1).searchParams.get('latitude')) - 7.19) < 0.01, 'geolocation coords not used');
    check(await page.evaluate(() => !Object.values(localStorage).join(' ').includes('7.19')), 'location coordinates must not be stored');
  });

  await scenario('empty', viewport, async (page, _c, st) => {
    st.mode = 'empty';
    await page.goto(url);
    await page.waitForSelector('.calm');
    check((await page.locator('.calm').innerText()) === 'No earthquakes of M≥2.5 within 200 km of Manila in the last 7 days.', `empty text wrong: ${await page.locator('.calm').innerText()}`);
    check(await page.locator('.quake').count() === 0, 'empty state should list nothing');
    await noOverflow(page, 'empty');
  });

  await scenario('error-offline', viewport, async (page, context, st) => {
    st.mode = 'error';
    await page.goto(url);
    await page.waitForSelector('#retry');
    check(/Could not load earthquake data/.test(await page.locator('#status').innerText()), 'error message missing');
    await noOverflow(page, 'error');
    st.mode = 'sample';
    await page.click('#retry');
    await page.waitForSelector('.quake');
    // offline: last successful result is shown, labelled with its fetch time
    st.mode = 'abort';
    await context.setOffline(true);
    await page.click('#refresh');
    await page.waitForSelector('#retry');
    const t = await page.locator('#status').innerText();
    check(/offline/i.test(t) && /Showing the last saved result, fetched 18 Nov 2026, 13:00 PHT/.test(t), `offline state wrong: ${t}`);
    check(await page.locator('.quake').count() === 4, 'offline should still list the saved result');
    await noOverflow(page, 'offline');
    // offline without a saved result for these settings
    await page.selectOption('#radius', '100');
    await page.waitForSelector('#retry');
    check(/no saved result/.test(await page.locator('#status').innerText()), 'offline-without-cache message missing');
  });
}

await browser.close();
server.close();
if (errors.length) {
  console.error('BROWSER SMOKE FAIL (' + errors.length + '):\n- ' + errors.join('\n- '));
  process.exit(1);
}
console.log('BROWSER SMOKE OK');
