// Scaffold smoke test: run after npm run build. Fails (never skips) if the build output is missing or wrong.
import { readFileSync, existsSync } from 'node:fs';

const errors = [];
if (!existsSync('dist/index.html')) errors.push('dist/index.html missing (run npm run build first)');
else {
  const html = readFileSync('dist/index.html', 'utf8');
  if (!/<title>[^<]*Lindol/.test(html)) errors.push('index.html: missing Lindol title');
  if (!/USGS/.test(html)) errors.push('index.html: missing USGS attribution');
  if (!/phivolcs\.dost\.gov\.ph/.test(html)) errors.push('index.html: missing PHIVOLCS link');
  if (!/<script type="module"[^>]*src="\/assets\/[^"]+\.js"/.test(html)) errors.push('index.html: built JS bundle not referenced');
}
if (errors.length) {
  console.error('SMOKE FAIL (' + errors.length + '):\n- ' + errors.join('\n- '));
  process.exit(1);
}
console.log('SMOKE OK');
