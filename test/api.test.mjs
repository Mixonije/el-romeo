// End-to-end API checks against the Cloudflare Worker: starts `wrangler dev` on a throwaway local D1, runs every check, stops it.
//   npm test
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = mkdtempSync(path.join(tmpdir(), 'elromeo-test-'));
const PORT = 8799;
const B = `http://localhost:${PORT}`;
const ADMIN = { email: 'owner@test.ch', password: 'test-only-password' };
const wrangler = path.join(root, 'node_modules', '.bin', 'wrangler');
const quiet = { cwd: root, env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' } };

// Fresh local D1 in a temp folder, with the real migrations applied.
await new Promise((resolve, reject) => {
  const p = spawn(wrangler, ['d1', 'migrations', 'apply', 'el-romeo', '--local', '--persist-to', dir], { ...quiet, stdio: 'ignore' });
  p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`migrations failed (${code})`))));
});
const server = spawn(wrangler, ['dev', '--local', '--port', String(PORT), '--persist-to', dir,
  '--var', `ADMIN_EMAIL:${ADMIN.email}`, '--var', `ADMIN_PASSWORD:${ADMIN.password}`, '--var', 'DISABLE_LIMITS:1'], { ...quiet, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('wrangler dev did not start')), 60000);
  const onData = (d) => { if (/Ready on/i.test(String(d))) { clearTimeout(t); resolve(); } };
  server.stdout.on('data', onData); server.stderr.on('data', onData);
  server.on('exit', (code) => reject(new Error(`wrangler dev exited ${code}`)));
});

let cookie = '';
let fails = 0;
const j = async (p, opts = {}) => {
  const r = await fetch(B + p, {
    method: opts.method || 'GET', redirect: 'manual',
    headers: { 'content-type': 'application/json', ...(opts.auth ? { cookie } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const sc = r.headers.get('set-cookie'); if (sc && opts.keep) cookie = sc.split(';')[0];
  return { status: r.status, body: await r.json().catch(() => null) };
};
const expect = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(38)} ${JSON.stringify(got)}${ok ? '' : `  (want ${JSON.stringify(want)})`}`);
};

try {
  // ---------- shop data ----------
  const cfg = (await j('/api/config')).body;
  expect('shop name / phone / owner', [cfg.shopName, cfg.phone, cfg.legal.owner], ['El Romeo', '078 228 99 97', 'Bojan Stojanović']);
  expect('10 services, 3 groups', [cfg.services.length, [...new Set(cfg.services.map((s) => s.category))]], [10, ['men', 'women', 'other']]);
  expect('"ab" prices', cfg.services.filter((s) => s.price_from).map((s) => [s.name_de, s.price]), [['Föhnen', 40], ['Haare waschen & Schnitt', 60]]);
  expect('hours Mon / Sat / Sun', [cfg.hours[1], cfg.hours[6], cfg.hours[0]], [['10:15', '18:30'], ['10:00', '16:30'], null]);
  expect('cancel cutoff 24h, no email feature', [cfg.cancelCutoffMinutes, 'emailEnabled' in cfg], [1440, false]);

  const men = cfg.services.find((s) => s.name_de === 'Herrenhaarschnitt');
  const wash = cfg.services.find((s) => s.name_de === 'Haare waschen & Schnitt');
  const av = (await j(`/api/availability?service=${men.id}`)).body;
  // a weekday at least 2 days out, so the 24h cancel rule allows cancelling
  const day = av.days.slice(2).find((d) => d.slots.length > 20 && new Date(d.date).getUTCDay() !== 6);
  expect('weekday first / last start', [day.slots[0], day.slots.at(-1)], ['10:15', '17:45']);

  // ---------- booking with name + phone only ----------
  const bk = await j('/api/bookings', { method: 'POST', body: { serviceId: wash.id, date: day.date, start: '10:15', name: 'Lea Test', phone: '076 123 45 67', lang: 'de' } });
  expect('book name + phone, "ab" kept', [bk.status, bk.body.booking.service.price, bk.body.booking.service.price_from, 'email' in bk.body.booking], [200, 60, true, false]);
  expect('code format AAA-999', /^[A-HJ-NP-Z]{3}-[2-9]{3}$/.test(bk.body.booking.code), true);
  expect('same slot again refused', (await j('/api/bookings', { method: 'POST', body: { serviceId: men.id, date: day.date, start: '10:30', name: 'X Y', phone: '0790000000' } })).body.error, 'slot_taken');
  expect('missing phone refused', (await j('/api/bookings', { method: 'POST', body: { serviceId: men.id, date: day.date, start: '15:00', name: 'X Y' } })).body.error, 'bad_phone');

  // ---------- find / cancel with phone + code ----------
  const code = bk.body.booking.code;
  expect('find: +41 format', (await j('/api/bookings/find', { method: 'POST', body: { phone: '+41 76 123 45 67', code } })).status, 200);
  expect('find: 0041 format, lowercase code', (await j('/api/bookings/find', { method: 'POST', body: { phone: '0041761234567', code: code.toLowerCase() } })).status, 200);
  expect('find: wrong number refused', (await j('/api/bookings/find', { method: 'POST', body: { phone: '076 123 45 68', code } })).body.error, 'not_found');
  expect('find: no number refused', (await j('/api/bookings/find', { method: 'POST', body: { code } })).body.error, 'not_found');
  expect('cancel 2+ days out', (await j('/api/bookings/cancel', { method: 'POST', body: { phone: '0761234567', code } })).body.booking.status, 'cancelled');
  expect('cancel again', (await j('/api/bookings/cancel', { method: 'POST', body: { phone: '0761234567', code } })).body.error, 'already_cancelled');

  const b2 = await j('/api/bookings', { method: 'POST', body: { serviceId: men.id, date: day.date, start: '16:00', name: 'Max Test', phone: '+41795556677' } });
  const b3 = await j('/api/bookings', { method: 'POST', body: { serviceId: men.id, date: day.date, start: '17:00', name: 'Max Test', phone: '079 555 66 77' } });
  const b4 = await j('/api/bookings', { method: 'POST', body: { serviceId: men.id, date: day.date, start: '17:45', name: 'Max Test', phone: '0041795556677' } });
  expect('max 2 per number, any format', [b2.status, b3.status, b4.body.error], [200, 200, 'too_many']);

  // ---------- admin ----------
  expect('admin api needs login', (await j('/api/admin/bookings')).status, 401);
  expect('wrong admin password', (await j('/api/admin/login', { method: 'POST', body: { email: ADMIN.email, password: 'nope' } })).status, 401);
  expect('admin login', (await j('/api/admin/login', { method: 'POST', body: ADMIN, keep: true })).status, 200);
  const rows = (await j('/api/admin/bookings', { auth: true })).body.bookings;
  expect('admin rows: phone, no email', rows.every((b) => !('email' in b) && b.phone.startsWith('+41')), true);

  // ---------- breaks ----------
  const blk = await j('/api/admin/blocks', { method: 'POST', auth: true, body: { date: day.date, start: '12:30', end: '13:15', reason: 'Mittag' } });
  expect('add break', [blk.status, blk.body.start, blk.body.end], [200, '12:30', '13:15']);
  const av2 = (await j(`/api/availability?service=${men.id}`)).body.days.find((d) => d.date === day.date);
  expect('break hides overlapping starts', ['11:45', '12:00', '12:30', '13:00', '13:15'].map((t) => av2.slots.includes(t)), [true, false, false, false, true]);
  expect('booking inside break refused', (await j('/api/bookings', { method: 'POST', body: { serviceId: men.id, date: day.date, start: '12:30', name: 'A B', phone: '0791234567' } })).body.error, 'slot_taken');
  expect('bad break times', (await j('/api/admin/blocks', { method: 'POST', auth: true, body: { date: day.date, start: '14:00', end: '13:00' } })).body.error, 'bad_time');
  expect('break over a booking warns', (await j('/api/admin/blocks', { method: 'POST', auth: true, body: { date: day.date, start: '15:45', end: '16:30' } })).body.affected, 1);

  // ---------- services ----------
  const ns = await j('/api/admin/services', { method: 'POST', auth: true, body: { category: 'women', name_de: 'Strähnen', name_en: 'Highlights', desc_de: 'Je nach Haarlänge', duration_min: 90, price: 120, price_from: true } });
  expect('add service with all fields', [ns.status, ns.body.service.category, ns.body.service.price_from], [200, 'women', true]);
  expect('duration must fit 15-min grid', (await j('/api/admin/services', { method: 'POST', auth: true, body: { name_de: 'X Y', duration_min: 20, price: 5 } })).body.error, 'bad_duration');

  // ---------- simultaneous bookings: exactly one may win ----------
  const raceDay = av.days.slice(3).find((d) => d.slots.includes('11:00'));
  const race = await Promise.all([1, 2, 3, 4, 5].map((i) => j('/api/bookings', { method: 'POST', body: { serviceId: men.id, date: raceDay.date, start: '11:00', name: `Race ${i}`, phone: `07900000${10 + i}` } })));
  expect('5 at once for one slot: 1 wins', [race.filter((r) => r.status === 200).length, race.filter((r) => r.body.error === 'slot_taken').length], [1, 4]);

  // ---------- pages ----------
  const page = async (p, opts) => fetch(B + p, { redirect: 'manual', ...opts });
  for (const p of ['/', '/book', '/my-booking', '/impressum', '/admin/login']) {
    const r = await page(p);
    expect(`page ${p}`, [r.status, (r.headers.get('content-security-policy') || '').includes("frame-ancestors 'none'")], [200, true]);
  }
  const adminPage = await page('/admin', { headers: { cookie } });
  expect('/admin page with session', [adminPage.status, (await adminPage.text()).includes('admin.js')], [200, true]);
  expect('/admin/login redirects when signed in', (await page('/admin/login', { headers: { cookie } })).headers.get('location'), '/admin');
  expect('tampered session refused', (await j('/api/admin/bookings', { auth: false, method: 'GET' }).then(() => fetch(`${B}/api/admin/bookings`, { headers: { cookie: 'drb_admin=9999999999999.abc' } }))).status, 401);

  expect('/impressum served', (await j('/impressum')).status, 200);
  expect('/admin redirects when signed out', (await fetch(`${B}/admin`, { redirect: 'manual' })).status, 302);
} finally {
  server.kill();
  rmSync(dir, { recursive: true, force: true });
}
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
