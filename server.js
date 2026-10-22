const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Minimal .env loader so `node server.js` works without extra packages.
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

const express = require('express');
const config = require('./src/config');
const bookings = require('./src/bookings');

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const SESSION_SECRET = crypto.createHash('sha256').update(`drb-session:${process.env.SESSION_SECRET || ''}:${ADMIN_EMAIL}:${ADMIN_PASSWORD}`).digest();
const SESSION_DAYS = 30;
const COOKIE = 'drb_admin';

if (!ADMIN_PASSWORD) console.warn('[drb] ADMIN_PASSWORD is not set. The admin page will refuse every login until it is.');
if (!ADMIN_EMAIL) console.warn('[drb] ADMIN_EMAIL is not set. Any email is accepted at admin login; only the password is checked.');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === '0' ? false : 1);
app.use(express.json({ limit: '10kb' }));

app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
  });
  next();
});

// ---------- tiny fixed-window rate limiter ----------
const hits = new Map();
function limit(bucket, max, windowMs) {
  return (req, res, next) => {
    const key = `${bucket}:${req.ip}`;
    const t = Date.now();
    let h = hits.get(key);
    if (!h || t > h.reset) { h = { count: 0, reset: t + windowMs }; hits.set(key, h); }
    if (++h.count > max) {
      res.set('Retry-After', String(Math.ceil((h.reset - t) / 1000)));
      return res.status(429).json({ error: 'rate_limited' });
    }
    next();
  };
}
setInterval(() => { const t = Date.now(); for (const [k, h] of hits) if (t > h.reset) hits.delete(k); }, 60_000).unref();

// ---------- admin session ----------
const sign = (payload) => crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
function issueSession(res) {
  const expires = Date.now() + SESSION_DAYS * 86400_000;
  res.cookie(COOKIE, `${expires}.${sign(String(expires))}`, {
    httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_DAYS * 86400_000, path: '/',
  });
}
function readCookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}
function isAdmin(req) {
  if (!ADMIN_PASSWORD) return false;
  const value = readCookie(req, COOKIE);
  if (!value) return false;
  const [expires, sig] = value.split('.');
  if (!expires || !sig || Number(expires) < Date.now()) return false;
  const expected = Buffer.from(sign(expires));
  const given = Buffer.from(sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}
function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'unauthorized' });
  next();
}
const digest = (s) => crypto.createHash('sha256').update(String(s || '')).digest();
function credentialsMatch(email, password) {
  if (!ADMIN_PASSWORD) return false;
  const emailOk = !ADMIN_EMAIL || crypto.timingSafeEqual(digest(String(email || '').trim().toLowerCase()), digest(ADMIN_EMAIL));
  const passOk = crypto.timingSafeEqual(digest(password), digest(ADMIN_PASSWORD));
  return emailOk && passOk;
}

const wrap = (fn) => async (req, res) => {
  try {
    res.json(await fn(req, res));
  } catch (err) {
    if (err instanceof bookings.BookingError) return res.status(err.status).json({ error: err.code });
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
};

// ---------- public API ----------
app.get('/api/config', wrap(() => ({
  shopName: config.shopName,
  tagline: config.tagline,
  logo: config.logo,
  instagram: config.instagram,
  gallery: config.gallery,
  categories: config.categories,
  legal: config.legal,
  address: config.address,
  phone: config.phone,
  note: config.note,
  defaultLang: config.defaultLang,
  currency: config.currency,
  altCurrency: config.altCurrency,
  services: bookings.listServices(),
  hours: config.hours,
  cancelCutoffMinutes: config.cancelCutoffMinutes,
  today: bookings.now().date,
})));

app.get('/api/availability', limit('avail', 120, 60_000), wrap((req) => bookings.availability(req.query.service)));

app.post('/api/bookings', limit('book', 10, 60 * 60_000), wrap((req) => {
  const b = req.body || {};
  // Honeypot: real people never see or fill this field.
  if (b.website) throw new bookings.BookingError(400, 'rejected');
  const booking = bookings.create({
    serviceId: b.serviceId, date: b.date, start: b.start, name: b.name, phone: b.phone, lang: b.lang,
  });
  return { booking };
}));

app.post('/api/bookings/find', limit('lookup', 30, 10 * 60_000), wrap((req) => {
  const b = req.body || {};
  return { booking: bookings.present(bookings.find(b.phone, b.code)) };
}));

app.post('/api/bookings/cancel', limit('lookup', 30, 10 * 60_000), wrap((req) => {
  const b = req.body || {};
  return { booking: bookings.cancelByCustomer(b.phone, b.code) };
}));

// ---------- admin API ----------
app.post('/api/admin/login', limit('login', 10, 15 * 60_000), (req, res) => {
  if (!ADMIN_PASSWORD) return res.status(503).json({ error: 'not_configured' });
  const b = req.body || {};
  if (!credentialsMatch(b.email, b.password)) return res.status(401).json({ error: 'wrong_login' });
  issueSession(res);
  res.json({ ok: true });
});
app.post('/api/admin/logout', (req, res) => { res.clearCookie(COOKIE, { path: '/' }); res.json({ ok: true }); });

app.get('/api/admin/bookings', requireAdmin, wrap((req) => ({
  bookings: bookings.listForAdmin({ scope: req.query.scope === 'past' ? 'past' : 'upcoming', includeCancelled: req.query.cancelled === '1' }),
  today: bookings.now().date,
})));
app.post('/api/admin/bookings/:id/cancel', requireAdmin, wrap((req) => ({ booking: bookings.cancelById(Number(req.params.id)) })));

app.get('/api/admin/closures', requireAdmin, wrap(() => ({ closures: bookings.listClosures() })));
app.post('/api/admin/closures', requireAdmin, wrap((req) => bookings.addClosure(req.body && req.body.date, req.body && req.body.reason)));
app.delete('/api/admin/closures/:date', requireAdmin, wrap((req) => { bookings.removeClosure(req.params.date); return { ok: true }; }));

app.get('/api/admin/blocks', requireAdmin, wrap(() => ({ blocks: bookings.listBlocks() })));
app.post('/api/admin/blocks', requireAdmin, wrap((req) => {
  const b = req.body || {};
  return bookings.addBlock(b.date, b.start, b.end, b.reason);
}));
app.delete('/api/admin/blocks/:id', requireAdmin, wrap((req) => { bookings.removeBlock(Number(req.params.id)); return { ok: true }; }));

app.get('/api/admin/services', requireAdmin, wrap(() => ({ services: bookings.listAllServices() })));
app.post('/api/admin/services', requireAdmin, wrap((req) => ({ service: bookings.createService(req.body || {}) })));
app.put('/api/admin/services/:id', requireAdmin, wrap((req) => ({ service: bookings.updateService(Number(req.params.id), req.body || {}) })));
app.post('/api/admin/services/:id/move', requireAdmin, wrap((req) => ({ services: bookings.moveService(Number(req.params.id), req.body && req.body.dir) })));

app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));

// ---------- pages ----------
const pub = path.join(__dirname, 'public');
const page = (name) => (req, res) => res.sendFile(path.join(pub, `${name}.html`));
app.get('/', page('index'));
app.get('/book', page('book'));
app.get('/my-booking', page('my-booking'));
app.get('/impressum', page('impressum'));
app.get('/admin/login', (req, res) => (isAdmin(req) ? res.redirect('/admin') : page('admin-login')(req, res)));
app.get('/admin', (req, res) => (isAdmin(req) ? page('admin')(req, res) : res.redirect('/admin/login')));
app.use((req, res, next) => (req.path.endsWith('.html') ? res.redirect('/') : next()));
app.use(express.static(pub, { index: false, maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));
app.use((req, res) => res.redirect('/'));

app.listen(PORT, () => console.log(`[drb] ${config.shopName} booking on http://localhost:${PORT}  (admin: /admin)`));
