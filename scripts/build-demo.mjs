// Builds a static, server-free demo of the site into docs/ (for GitHub Pages or any static host).
// The real frontend files are copied as they are; demo/demo-api.js answers the API calls in the browser.
//   npm run build:demo
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../src/config.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'public');
const out = path.join(root, 'docs');

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true });
fs.rmSync(path.join(out, '_headers'), { force: true }); // Cloudflare-only file, not for GitHub Pages

for (const file of fs.readdirSync(out).filter((f) => f.endsWith('.html'))) {
  const p = path.join(out, file);
  let html = fs.readFileSync(p, 'utf8');
  html = html.replace(/(href|src)="\/(?!\/)/g, '$1="'); // site-absolute -> relative, so it works under /<repo>/
  html = html.replace('<link rel="stylesheet" href="styles.css">', '<link rel="stylesheet" href="styles.css">\n  <link rel="stylesheet" href="demo.css">');
  html = html.replace('<script src="common.js" defer></script>', '<script src="demo-api.js" defer></script>\n  <script src="common.js" defer></script>');
  fs.writeFileSync(p, html);
}

const rewrite = (file, from, to) => {
  const p = path.join(out, file);
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').split(from).join(to));
};
rewrite('styles.css', '@import url("/tokens.css");', '@import url("tokens.css");');
rewrite('tokens.css', 'url("/fonts/', 'url("fonts/');

const demoApi = fs.readFileSync(path.join(root, 'demo', 'demo-api.js'), 'utf8').replace('__CONFIG__', JSON.stringify(config));
fs.writeFileSync(path.join(out, 'demo-api.js'), demoApi);
fs.copyFileSync(path.join(root, 'demo', 'demo.css'), path.join(out, 'demo.css'));
fs.writeFileSync(path.join(out, '.nojekyll'), '');

console.log(`demo built in ${path.relative(root, out)}/ (${fs.readdirSync(out).length} entries)`);
