// El Romeo on Cloudflare Workers: the API + admin guard. Static pages come from ./public (assets binding).
import config from '../src/config.js';
import * as bookings from './bookings.js';

const COOKIE = 'drb_admin';
const SESSION_DAYS = 30;
const enc = new TextEncoder();

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'Cache-Control': 'no-store',
};

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...SECURITY_HEADERS, ...headers },
});
const errorJson = (code, status) => json({ error: code }, status);
const redirect = (to) => new Response(null, { status: 302, headers: { Location: to } });

// ---------- attempt limits ----------
// Cloudflare's rate-limit bindings (wrangler.toml), counted per visitor IP. Missing binding = no limit (local tools).
async function limited(env, binding, request) {
  const limiter = env[binding];
  if (!limiter || env.DISABLE_LIMITS === '1') return false; // DISABLE_LIMITS is only passed by the test run
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const { success } = await limiter.limit({ key: `${binding}:${ip}` });
  return !success;
}

// ---------- admin session (HMAC-signed cookie) ----------
async function hmacKey(env) {
  const secret = `drb-session:${env.SESSION_SECRET || ''}:${(env.ADMIN_EMAIL || '').toLowerCase()}:${env.ADMIN_PASSWORD || ''}`;
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

function readCookie(request, name) {
  for (const part of (request.headers.get('Cookie') || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

async function isAdmin(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const value = readCookie(request, COOKIE);
  if (!value) return false;
  const [expires, sig] = value.split('.');
  if (!expires || !sig || Number(expires) < Date.now()) return false;
  try {
    return await crypto.subtle.verify('HMAC', await hmacKey(env), unb64url(sig), enc.encode(expires));
  } catch {
    return false;
  }
}

async function sessionCookie(env) {
  const expires = String(Date.now() + SESSION_DAYS * 86400_000);
  const sig = b64url(await crypto.subtle.sign('HMAC', await hmacKey(env), enc.encode(expires)));
  return `${COOKIE}=${expires}.${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}`;
}

// Compare SHA-256 digests in constant time, so the check takes as long for a near miss as for nonsense.
async function sameSecret(a, b) {
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(String(a || ''))), crypto.subtle.digest('SHA-256', enc.encode(String(b || '')))]);
  return crypto.subtle.timingSafeEqual(x, y);
}
async function credentialsMatch(env, email, password) {
  if (!env.ADMIN_PASSWORD) return false;
  const emailOk = !env.ADMIN_EMAIL || await sameSecret(String(email || '').trim().toLowerCase(), env.ADMIN_EMAIL.trim().toLowerCase());
  const passOk = await sameSecret(password, env.ADMIN_PASSWORD);
  return emailOk && passOk;
}

const readBody = async (request) => {
  try { return await request.json(); } catch { return {}; }
};

// ---------- API ----------
async function api(request, env, url) {
  const db = env.DB;
  const path = url.pathname;
  const method = request.method;
  let m;

  if (path === '/api/config' && method === 'GET') {
    return json({
      shopName: config.shopName, tagline: config.tagline, logo: config.logo, address: config.address, phone: config.phone,
      instagram: config.instagram, gallery: config.gallery, categories: config.categories, legal: config.legal,
      note: config.note, defaultLang: config.defaultLang, currency: config.currency, altCurrency: config.altCurrency,
      services: await bookings.listServices(db), hours: config.hours, cancelCutoffMinutes: config.cancelCutoffMinutes,
      today: bookings.now().date,
    });
  }
  if (path === '/api/availability' && method === 'GET') {
    if (await limited(env, 'LIMIT_READ', request)) return errorJson('rate_limited', 429);
    return json(await bookings.availability(db, url.searchParams.get('service')));
  }
  if (path === '/api/bookings' && method === 'POST') {
    if (await limited(env, 'LIMIT_BOOK', request)) return errorJson('rate_limited', 429);
    const b = await readBody(request);
    if (b.website) return errorJson('rejected', 400); // honeypot: real people never fill this field
    return json({ booking: await bookings.create(db, { serviceId: b.serviceId, date: b.date, start: b.start, name: b.name, phone: b.phone, lang: b.lang }) });
  }
  if ((path === '/api/bookings/find' || path === '/api/bookings/cancel') && method === 'POST') {
    if (await limited(env, 'LIMIT_LOOKUP', request)) return errorJson('rate_limited', 429);
    const b = await readBody(request);
    const booking = path.endsWith('/find')
      ? bookings.present(await bookings.find(db, b.phone, b.code))
      : await bookings.cancelByCustomer(db, b.phone, b.code);
    return json({ booking });
  }

  // admin
  if (path === '/api/admin/login' && method === 'POST') {
    if (await limited(env, 'LIMIT_LOGIN', request)) return errorJson('rate_limited', 429);
    if (!env.ADMIN_PASSWORD) return errorJson('not_configured', 503);
    const b = await readBody(request);
    if (!await credentialsMatch(env, b.email, b.password)) return errorJson('wrong_login', 401);
    return json({ ok: true }, 200, { 'Set-Cookie': await sessionCookie(env) });
  }
  if (path === '/api/admin/logout' && method === 'POST') {
    return json({ ok: true }, 200, { 'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });
  }
  if (path.startsWith('/api/admin/')) {
    if (!await isAdmin(request, env)) return errorJson('unauthorized', 401);
    const b = method === 'GET' || method === 'DELETE' ? {} : await readBody(request);

    if (path === '/api/admin/bookings' && method === 'GET') {
      return json({
        bookings: await bookings.listForAdmin(db, { scope: url.searchParams.get('scope') === 'past' ? 'past' : 'upcoming', includeCancelled: url.searchParams.get('cancelled') === '1' }),
        today: bookings.now().date,
      });
    }
    if ((m = path.match(/^\/api\/admin\/bookings\/(\d+)\/cancel$/)) && method === 'POST') return json({ booking: await bookings.cancelById(db, Number(m[1])) });

    if (path === '/api/admin/closures' && method === 'GET') return json({ closures: await bookings.listClosures(db) });
    if (path === '/api/admin/closures' && method === 'POST') return json(await bookings.addClosure(db, b.date, b.reason));
    if ((m = path.match(/^\/api\/admin\/closures\/(\d{4}-\d{2}-\d{2})$/)) && method === 'DELETE') { await bookings.removeClosure(db, m[1]); return json({ ok: true }); }

    if (path === '/api/admin/blocks' && method === 'GET') return json({ blocks: await bookings.listBlocks(db) });
    if (path === '/api/admin/blocks' && method === 'POST') return json(await bookings.addBlock(db, b.date, b.start, b.end, b.reason));
    if ((m = path.match(/^\/api\/admin\/blocks\/(\d+)$/)) && method === 'DELETE') { await bookings.removeBlock(db, Number(m[1])); return json({ ok: true }); }

    if (path === '/api/admin/services' && method === 'GET') return json({ services: await bookings.listAllServices(db) });
    if (path === '/api/admin/services' && method === 'POST') return json({ service: await bookings.createService(db, b) });
    if ((m = path.match(/^\/api\/admin\/services\/(\d+)$/)) && method === 'PUT') return json({ service: await bookings.updateService(db, Number(m[1]), b) });
    if ((m = path.match(/^\/api\/admin\/services\/(\d+)\/move$/)) && method === 'POST') return json({ services: await bookings.moveService(db, Number(m[1]), b.dir) });
  }
  return errorJson('not_found', 404);
}

// ---------- entry ----------
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/api/')) return await api(request, env, url);

      // The admin page is only served to a signed-in owner; everyone else goes to the login page.
      if (url.pathname === '/admin' || url.pathname === '/admin/') {
        if (!await isAdmin(request, env)) return redirect('/admin/login');
        return env.ASSETS.fetch(new Request(new URL('/admin', url), request));
      }
      if (url.pathname === '/admin/login' || url.pathname === '/admin/login/') {
        if (await isAdmin(request, env)) return redirect('/admin');
        return env.ASSETS.fetch(new Request(new URL('/admin-login', url), request));
      }
      return env.ASSETS.fetch(request);
    } catch (err) {
      if (err instanceof bookings.BookingError) return errorJson(err.code, err.status);
      console.error(err);
      return errorJson('server_error', 500);
    }
  },
};
