// Smoke test: run after `npm run build`. Every check passes or fails; nothing is skipped.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const BASE = 'https://lindol-one.vercel.app';
const DIST = resolve('dist');
const errors = [];
const fail = (m) => errors.push(m);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

// ---------- built HTML ----------
if (!existsSync('dist/index.html')) {
  fail('dist/index.html missing (run npm run build first)');
} else {
  const html = readFileSync('dist/index.html', 'utf8');
  if (!/<title>[^<]*Lindol/.test(html)) fail('index.html: missing Lindol title');
  const meta = {};
  for (const m of html.matchAll(/<meta\s+([^>]*?)\/?>/gs)) {
    const a = Object.fromEntries([...m[1].matchAll(/([\w:-]+)="([^"]*)"/g)].map((x) => [x[1], x[2]]));
    const k = a.property ?? a.name;
    if (k) meta[k] = a.content;
  }
  const absUrl = ['og:image', 'og:video', 'og:video:secure_url', 'twitter:player'];
  for (const k of absUrl) {
    if (!meta[k]) fail(`index.html: missing meta ${k}`);
    else if (!meta[k].startsWith(`${BASE}/`)) fail(`index.html: ${k} must be an absolute https URL under ${BASE}, got ${meta[k]}`);
  }
  const exact = { 'og:video:type': 'video/mp4', 'og:video:width': '1200', 'og:video:height': '630', 'twitter:card': 'player', 'twitter:player:width': '1200', 'twitter:player:height': '630', 'og:image:width': '1200', 'og:image:height': '630' };
  for (const [k, v] of Object.entries(exact)) if (meta[k] !== v) fail(`index.html: meta ${k} should be "${v}", got "${meta[k]}"`);
  for (const k of ['og:title', 'og:description']) if (!meta[k]) fail(`index.html: missing meta ${k}`);
  if (!/<script type="module"[^>]*src="\/assets\/[^"]+\.js"/.test(html)) fail('index.html: built JS bundle not referenced');
  if (/<script[^>]*src="https?:\/\/(?!lindol)/.test(html)) fail('index.html: third-party script');

  // ---------- every referenced asset exists ----------
  const refs = new Set();
  const addRef = (r, from) => {
    let p = r.startsWith(BASE) ? r.slice(BASE.length) : r;
    if (!p.startsWith('/') || p.startsWith('//')) return;
    p = p.split(/[?#]/)[0];
    if (p === '/' || p === '') return;
    refs.add(p);
    void from;
  };
  for (const m of html.matchAll(/(?:href|src|content)="([^"]+)"/g)) addRef(m[1], 'index.html');
  const assetsDir = join(DIST, 'assets');
  const assetFiles = existsSync(assetsDir) ? readdirSync(assetsDir) : [];
  if (!assetFiles.some((f) => f.endsWith('.js'))) fail('dist/assets has no JS');
  if (!assetFiles.some((f) => f.endsWith('.css'))) fail('dist/assets has no CSS');
  const scan = (text) => {
    for (const m of text.matchAll(/["'(`](\/[\w./-]+\.(?:js|css|json|png|svg|mp4|html|woff2?|ico|webp|webmanifest))["')`]/g)) addRef(m[1], 'asset');
  };
  const seen = new Set();
  const queue = [...assetFiles.filter((f) => /\.(js|css)$/.test(f)).map((f) => `/assets/${f}`)];
  for (const p of refs) if (/\.(js|css)$/.test(p)) queue.push(p);
  while (queue.length) {
    const p = queue.pop();
    if (seen.has(p)) continue;
    seen.add(p);
    const f = join(DIST, p);
    if (!existsSync(f)) continue;
    const before = new Set(refs);
    scan(readFileSync(f, 'utf8'));
    for (const r of refs) if (!before.has(r) && /\.(js|css)$/.test(r)) queue.push(r);
  }
  for (const p of refs) {
    const f = join(DIST, p);
    if (!f.startsWith(DIST) || !existsSync(f) || !statSync(f).isFile()) fail(`referenced asset missing from dist: ${p}`);
  }

  // ---------- no third-party hosts in shipped JS (no trackers, no tiles, no keys) ----------
  const allowed = new Set(['earthquake.usgs.gov', 'www.usgs.gov', 'www.phivolcs.dost.gov.ph', 'earthquake.phivolcs.dost.gov.ph', 'tsunami.phivolcs.dost.gov.ph', 'www.ready.gov', 'www.officialgazette.gov.ph', 'github.com', 'lindol-one.vercel.app', 'www.w3.org']);
  for (const f of assetFiles.filter((x) => /\.(js|css)$/.test(x))) {
    const text = readFileSync(join(assetsDir, f), 'utf8');
    for (const m of text.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) if (!allowed.has(m[1].toLowerCase())) fail(`assets/${f}: unexpected host ${m[1]}`);
    if (/api[_-]?key|googletagmanager|google-analytics|mapbox|tile\.openstreetmap/i.test(text)) fail(`assets/${f}: tracker/key/tile reference`);
  }

  const allJs = assetFiles.filter((x) => x.endsWith('.js')).map((x) => readFileSync(join(assetsDir, x), 'utf8')).join('\n');
  for (const needle of ['earthquake.usgs.gov/fdsnws/event/1/query', 'www.phivolcs.dost.gov.ph', 'Geological Survey']) if (!allJs.includes(needle)) fail(`built JS missing: ${needle}`);

  // ---------- OG image / video ----------
  const png = join(DIST, 'og/image.png');
  if (existsSync(png)) {
    const b = readFileSync(png);
    if (b.readUInt32BE(16) !== 1200 || b.readUInt32BE(20) !== 630 || b.toString('latin1', 1, 4) !== 'PNG') fail('og/image.png must be a 1200x630 PNG');
  } else fail('dist/og/image.png missing');
  const mp4 = join(DIST, 'og/preview.mp4');
  if (!existsSync(mp4)) fail('dist/og/preview.mp4 missing');
  else {
    const size = statSync(mp4).size;
    if (size >= 5 * 1024 * 1024) fail(`og/preview.mp4 is ${size} bytes, must be under 5 MB`);
    if (readFileSync(mp4).subarray(4, 8).toString('latin1') !== 'ftyp') fail('og/preview.mp4 is not an MP4 (no ftyp box)');
    const pr = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height,pix_fmt:format=duration', '-of', 'json', mp4], { encoding: 'utf8' });
    if (pr.status !== 0) fail(`ffprobe failed on og/preview.mp4: ${pr.stderr || pr.error}`);
    else {
      const j = JSON.parse(pr.stdout);
      const s = j.streams?.[0] ?? {};
      const dur = Number(j.format?.duration);
      if (s.codec_name !== 'h264') fail(`og/preview.mp4 codec is ${s.codec_name}, expected h264`);
      if (!((s.width === 1200 && s.height === 630) || (s.width * 9 === s.height * 16))) fail(`og/preview.mp4 is ${s.width}x${s.height}, expected 1200x630 or 16:9`);
      if (!(dur >= 5 && dur <= 8)) fail(`og/preview.mp4 duration ${dur}s, expected 5 to 8 s`);
    }
  }
  if (!existsSync(join(DIST, 'og/player.html'))) fail('dist/og/player.html missing');
  else if (!/\/og\/preview\.mp4/.test(readFileSync(join(DIST, 'og/player.html'), 'utf8'))) fail('og/player.html does not play /og/preview.mp4');
}

// ---------- data files ----------
const isUrl = (u) => typeof u === 'string' && /^https:\/\/[^\s/]+\.[^\s]+$/.test(u);
const explainers = readJson('src/data/explainers.json');
if (!Array.isArray(explainers) || !explainers.length) fail('explainers.json is empty');
for (const e of explainers) {
  if (!e.title || !e.body) fail(`explainers.json: entry ${e.id} missing title/body`);
  if (!Array.isArray(e.sources) || !e.sources.length || !e.sources.every((s) => s.label && isUrl(s.url))) fail(`explainers.json: entry ${e.id} lacks a source URL`);
}
const safety = readJson('src/data/safety.json');
if (!safety.emergency?.text || !safety.emergency.sources?.every?.((s) => isUrl(s.url)) || !safety.emergency.sources?.length) fail('safety.json: emergency entry lacks a source URL');
for (const sec of safety.sections ?? []) {
  if (!sec.steps?.length) fail(`safety.json: section ${sec.id} has no steps`);
  for (const st of sec.steps ?? []) if (!st.text || !st.source || !isUrl(st.source.url)) fail(`safety.json: step without source URL in ${sec.id}: ${st.text}`);
}
if (!(safety.sections ?? []).length) fail('safety.json: no sections');
const cities = readJson('src/data/cities.json');
if (!cities.length) fail('cities.json is empty');
const names = new Set();
for (const c of cities) {
  if (!c.name || !c.region) fail(`cities.json: entry missing name/region: ${JSON.stringify(c)}`);
  if (!(typeof c.lat === 'number' && c.lat >= 4.5 && c.lat <= 21.5 && typeof c.lon === 'number' && c.lon >= 116 && c.lon <= 127)) fail(`cities.json: ${c.name} has lat/lon outside the Philippines: ${c.lat}, ${c.lon}`);
  if (names.has(c.name)) fail(`cities.json: duplicate ${c.name}`);
  names.add(c.name);
}

if (errors.length) {
  console.error('SMOKE FAIL (' + errors.length + '):\n- ' + errors.join('\n- '));
  process.exit(1);
}
console.log('STATIC SMOKE OK');

// ---------- headless browser (fails, never skips) ----------
const r = spawnSync('node', ['scripts/browser-smoke.mjs'], { stdio: 'inherit' });
if (r.status !== 0) {
  console.error('SMOKE FAIL: browser smoke failed');
  process.exit(1);
}
console.log('SMOKE OK');
