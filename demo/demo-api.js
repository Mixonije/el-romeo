// Static demo: answers every /api/* call inside the browser, so the site runs on
// GitHub Pages (or any static host) with no server. Data lives in localStorage,
// per visitor. Mirrors the rules in src/bookings.js closely, but nothing here is
// shared between people and nothing is secure: it is a clickable prototype.
(() => {
  'use strict';

  const CONFIG = __CONFIG__; // injected by scripts/build-demo.js from src/config.js
  const DEMO_LOGIN = { email: 'demo@donromeo.ch', password: 'demo1234' };
  const KEY = 'drb-demo-db-v4-phone'; // bumped when seed data changes, so old demo data is not reused
  const ADMIN_KEY = 'drb-demo-admin';

  window.DRB_ROUTES = { home: 'index.html', book: 'book.html', cancel: 'my-booking.html', impressum: 'impressum.html', adminLogin: 'admin-login.html', admin: 'admin.html' };

  // ---------- time (shop time zone, like src/time.js) ----------
  function nowInZone() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: CONFIG.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t).value;
    return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
  }
  const dayNumber = (d) => { const [y, m, dd] = d.split('-').map(Number); return Date.UTC(y, m - 1, dd) / 86400000; };
  const addDays = (d, n) => new Date((dayNumber(d) + n) * 86400000).toISOString().slice(0, 10);
  const weekday = (d) => new Date(dayNumber(d) * 86400000).getUTCDay();
  const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const toHHMM = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const until = (n, date, min) => (dayNumber(date) - dayNumber(n.date)) * 1440 + min - n.minutes;

  // ---------- storage ----------
  const fail = (code, status = 400) => { const e = new Error(code); e.code = code; e.status = status; throw e; };
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch { /* fall through to seed */ }
    return seed();
  }
  function save(db) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* private mode: demo still works for this page */ } }

  function openingFor(db, date) {
    const h = CONFIG.hours[weekday(date)];
    if (!h || db.closures.some((c) => c.date === date)) return null;
    return [toMin(h[0]), toMin(h[1])];
  }
  function freeStarts(db, date, minutes, n, ignoreLead) {
    const open = openingFor(db, date);
    if (!open) return [];
    const taken = db.bookings.filter((b) => b.date === date && b.status === 'confirmed')
      .concat((db.blocks || []).filter((k) => k.date === date)); // breaks count as taken
    const out = [];
    for (let t = open[0]; t + minutes <= open[1]; t += CONFIG.slotStepMinutes) {
      if (!ignoreLead && until(n, date, t) < CONFIG.minLeadMinutes) continue;
      if (taken.some((b) => t < b.end_min && t + minutes > b.start_min)) continue;
      out.push(t);
    }
    return out;
  }

  const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const DIGITS = '23456789';
  const pick = (s) => s[Math.floor(Math.random() * s.length)];
  const newCode = () => pick(LETTERS) + pick(LETTERS) + pick(LETTERS) + pick(DIGITS) + pick(DIGITS) + pick(DIGITS);

  // A few sample bookings so the admin page has something to show.
  function seed() {
    const db = {
      services: CONFIG.seedServices.map((s, i) => ({ id: i + 1, desc_de: null, desc_en: null, ...s, price_from: Boolean(s.price_from), sort: i, active: true })),
      bookings: [], closures: [], blocks: [], nextId: 1,
    };
    const n = nowInZone();
    const people = [
      ['Luca Meier', 'luca@example.ch', '+41791112233'],
      ['Noah Müller', 'noah@example.ch', '+41785557788'],
      ['Lea Schmid', 'lea@example.ch', '+41761234567'],
      ['Jonas Keller', 'jonas@example.ch', '+41794321234'],
    ];
    let p = 0;
    for (let i = -1, added = 0; i < 10 && added < 6; i++) {
      const date = addDays(n.date, i);
      const open = openingFor(db, date);
      if (!open) continue;
      for (const offset of [60, 300]) {
        const s = db.services[p % db.services.length];
        const start = open[0] + offset;
        if (start + s.duration_min > open[1]) continue;
        const [name, , phone] = people[p % people.length];
        db.bookings.push({
          id: db.nextId++, code: newCode(), service_id: s.id, service_name_de: s.name_de, service_name_en: s.name_en, price: s.price, price_from: s.price_from,
          date, start_min: start, end_min: start + s.duration_min, name, phone, lang: 'de',
          status: p === 3 ? 'cancelled' : 'confirmed', cancelled_by: p === 3 ? 'customer' : null, created_at: new Date().toISOString(),
        });
        p++; added++;
      }
    }
    // and one lunch break tomorrow-or-next-open-day, to show how breaks look
    for (let i = 1; i < 8; i++) {
      const date = addDays(n.date, i);
      if (openingFor(db, date)) { db.blocks.push({ id: db.nextId++, date, start_min: toMin('12:30'), end_min: toMin('13:15'), reason: null }); break; }
    }
    save(db);
    return db;
  }

  // ---------- presenters (same shape as the server) ----------
  const formatCode = (c) => `${c.slice(0, 3)}-${c.slice(3)}`;
  const publicService = (s) => ({
    id: s.id, category: s.category, name_de: s.name_de, name_en: s.name_en, desc_de: s.desc_de || null, desc_en: s.desc_en || null,
    duration_min: s.duration_min, price: s.price, price_from: Boolean(s.price_from),
  });
  function present(b) {
    const u = until(nowInZone(), b.date, b.start_min);
    return {
      code: formatCode(b.code),
      service: { id: b.service_id, name_de: b.service_name_de, name_en: b.service_name_en, price: b.price, price_from: Boolean(b.price_from), duration_min: b.end_min - b.start_min },
      date: b.date, start: toHHMM(b.start_min), end: toHHMM(b.end_min), name: b.name, lang: b.lang,
      status: b.status, cancelledBy: b.cancelled_by, isPast: u < 0, canCancel: b.status === 'confirmed' && u >= CONFIG.cancelCutoffMinutes,
    };
  }
  const presentAdmin = (b) => ({ ...present(b), id: b.id, phone: b.phone, createdAt: b.created_at });
  const sorted = (db) => db.services.slice().sort((a, b) => a.sort - b.sort || a.id - b.id);
  const activeService = (db, id) => { const s = db.services.find((x) => x.id === Number(id)); if (!s || !s.active) fail('unknown_service'); return s; };
  const isAdmin = () => { try { return localStorage.getItem(ADMIN_KEY) === '1'; } catch { return false; } };
  const needAdmin = () => { if (!isAdmin()) fail('unauthorized', 401); };
  // Same normalising as the server: "079 123 45 67" and "+41791234567" are one number.
  const cleanPhone = (v) => {
    let x = String(v || '').replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
    if (x.startsWith('00')) x = `+${x.slice(2)}`;
    else if (x.startsWith('0')) x = `+41${x.slice(1)}`;
    return x;
  };
  const findRow = (db, phone, code) => {
    const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const b = db.bookings.find((x) => x.code === c);
    const p = cleanPhone(phone);
    if (!b || !p || cleanPhone(b.phone) !== p) fail('not_found', 404);
    return b;
  };
  function cleanService(input) {
    const name_de = String(input.name_de || '').trim();
    const name_en = String(input.name_en || '').trim() || name_de;
    const desc_de = String(input.desc_de || '').trim() || null;
    const desc_en = String(input.desc_en || '').trim() || desc_de;
    const category = CONFIG.categories.some((c) => c.id === input.category) ? input.category : CONFIG.categories[CONFIG.categories.length - 1].id;
    const duration_min = Number(input.duration_min);
    const price = Number(input.price);
    if (name_de.length < 2) fail('bad_service_name');
    if (!Number.isInteger(duration_min) || duration_min < 5 || duration_min % CONFIG.slotStepMinutes) fail('bad_duration');
    if (!Number.isInteger(price) || price < 0) fail('bad_price');
    return { name_de, name_en, desc_de, desc_en, category, duration_min, price, price_from: Boolean(input.price_from) };
  }

  // ---------- the fake API ----------
  window.DRB_MOCK = async (path, opts = {}) => {
    await new Promise((r) => setTimeout(r, 150)); // feel like a network
    const url = new URL(path, location.href);
    const method = opts.method || 'GET';
    const body = opts.body || {};
    const p = url.pathname.replace(/^.*\/api\//, '/api/');
    const db = load();
    const n = nowInZone();
    let m;

    if (p === '/api/config') {
      return {
        shopName: CONFIG.shopName, tagline: CONFIG.tagline, logo: CONFIG.logo.replace(/^\//, ''),
        instagram: CONFIG.instagram, categories: CONFIG.categories, legal: CONFIG.legal, gallery: (CONFIG.gallery || []).map((g) => ({ ...g, src: g.src.replace(/^\//, '') })), address: CONFIG.address, phone: CONFIG.phone,
        note: CONFIG.note, defaultLang: CONFIG.defaultLang, currency: CONFIG.currency, altCurrency: CONFIG.altCurrency,
        services: sorted(db).filter((s) => s.active).map(publicService), hours: CONFIG.hours,
        cancelCutoffMinutes: CONFIG.cancelCutoffMinutes, today: n.date,
      };
    }
    if (p === '/api/availability') {
      const s = activeService(db, url.searchParams.get('service'));
      const days = [];
      for (let i = 0; i < CONFIG.bookingHorizonDays; i++) {
        const date = addDays(n.date, i);
        const open = openingFor(db, date);
        const over = open && i === 0 && until(n, date, open[1] - s.duration_min) < CONFIG.minLeadMinutes;
        days.push({ date, closed: !open || over, slots: freeStarts(db, date, s.duration_min, n).map(toHHMM) });
      }
      return { service: publicService(s), days };
    }
    if (p === '/api/bookings' && method === 'POST') {
      if (body.website) fail('rejected');
      const s = activeService(db, body.serviceId);
      const name = String(body.name || '').trim();
      const phone = cleanPhone(body.phone);
      if (name.length < 2) fail('bad_name');
      if (phone.replace('+', '').length < 6) fail('bad_phone');
      const start = toMin(body.start);
      if (!freeStarts(db, body.date, s.duration_min, n).includes(start)) fail('slot_taken', 409);
      const upcoming = db.bookings.filter((b) => b.phone === phone && b.status === 'confirmed' && until(n, b.date, b.start_min) >= 0);
      if (upcoming.length >= CONFIG.maxActivePerContact) fail('too_many', 409);
      let code; do { code = newCode(); } while (db.bookings.some((b) => b.code === code));
      const row = {
        id: db.nextId++, code, service_id: s.id, service_name_de: s.name_de, service_name_en: s.name_en, price: s.price, price_from: s.price_from,
        date: body.date, start_min: start, end_min: start + s.duration_min, name, phone, lang: body.lang === 'en' ? 'en' : 'de',
        status: 'confirmed', cancelled_by: null, created_at: new Date().toISOString(),
      };
      db.bookings.push(row); save(db);
      return { booking: present(row) };
    }
    if (p === '/api/bookings/find') return { booking: present(findRow(db, body.phone, body.code)) };
    if (p === '/api/bookings/cancel') {
      const b = findRow(db, body.phone, body.code);
      if (b.status !== 'confirmed') fail('already_cancelled', 409);
      if (!present(b).canCancel) fail('too_late', 409);
      b.status = 'cancelled'; b.cancelled_by = 'customer'; save(db);
      return { booking: present(b) };
    }

    // admin
    if (p === '/api/admin/login') {
      if (String(body.email || '').trim().toLowerCase() !== DEMO_LOGIN.email || body.password !== DEMO_LOGIN.password) fail('wrong_login', 401);
      try { localStorage.setItem(ADMIN_KEY, '1'); } catch { /* ignore */ }
      return { ok: true };
    }
    if (p === '/api/admin/logout') { try { localStorage.removeItem(ADMIN_KEY); } catch { /* ignore */ } return { ok: true }; }
    needAdmin();
    if (p === '/api/admin/bookings') {
      const past = url.searchParams.get('scope') === 'past';
      const withCancelled = url.searchParams.get('cancelled') === '1';
      const list = db.bookings
        .filter((b) => withCancelled || b.status === 'confirmed')
        .map(presentAdmin)
        .filter((b) => (past ? b.isPast : !b.isPast))
        .sort((a, b) => (past ? -1 : 1) * (a.date + a.start).localeCompare(b.date + b.start));
      return { bookings: list, today: n.date };
    }
    if ((m = p.match(/^\/api\/admin\/bookings\/(\d+)\/cancel$/))) {
      const b = db.bookings.find((x) => x.id === Number(m[1]));
      if (!b) fail('not_found', 404);
      if (b.status === 'confirmed') { b.status = 'cancelled'; b.cancelled_by = 'shop'; save(db); }
      return { booking: presentAdmin(b) };
    }
    if (p === '/api/admin/closures' && method === 'GET') return { closures: db.closures.filter((c) => c.date >= n.date).sort((a, b) => a.date.localeCompare(b.date)) };
    if (p === '/api/admin/closures' && method === 'POST') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date || '')) fail('bad_date');
      db.closures = db.closures.filter((c) => c.date !== body.date).concat({ date: body.date, reason: String(body.reason || '').trim() || null });
      save(db);
      return { date: body.date, affected: db.bookings.filter((b) => b.date === body.date && b.status === 'confirmed').length };
    }
    if ((m = p.match(/^\/api\/admin\/closures\/(.+)$/)) && method === 'DELETE') { db.closures = db.closures.filter((c) => c.date !== m[1]); save(db); return { ok: true }; }
    if (p === '/api/admin/blocks' && method === 'GET') {
      const list = (db.blocks || []).filter((k) => k.date >= n.date).sort((a, b) => (a.date + toHHMM(a.start_min)).localeCompare(b.date + toHHMM(b.start_min)));
      return { blocks: list.map((k) => ({ ...k, start: toHHMM(k.start_min), end: toHHMM(k.end_min) })) };
    }
    if (p === '/api/admin/blocks' && method === 'POST') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date || '')) fail('bad_date');
      if (!/^\d{2}:\d{2}$/.test(body.start || '') || !/^\d{2}:\d{2}$/.test(body.end || '') || body.start >= body.end) fail('bad_time');
      const k = { id: db.nextId++, date: body.date, start_min: toMin(body.start), end_min: toMin(body.end), reason: String(body.reason || '').trim() || null };
      (db.blocks ||= []).push(k); save(db);
      const affected = db.bookings.filter((b) => b.date === k.date && b.status === 'confirmed' && b.start_min < k.end_min && b.end_min > k.start_min).length;
      return { id: k.id, date: k.date, start: body.start, end: body.end, affected };
    }
    if ((m = p.match(/^\/api\/admin\/blocks\/(\d+)$/)) && method === 'DELETE') { db.blocks = (db.blocks || []).filter((k) => k.id !== Number(m[1])); save(db); return { ok: true }; }
    if (p === '/api/admin/services' && method === 'GET') return { services: sorted(db).map((s) => ({ ...publicService(s), sort: s.sort, active: s.active })) };
    if (p === '/api/admin/services' && method === 'POST') {
      const s = { id: Math.max(0, ...db.services.map((x) => x.id)) + 1, ...cleanService(body), sort: Math.max(-1, ...db.services.map((x) => x.sort)) + 1, active: true };
      db.services.push(s); save(db);
      return { service: s };
    }
    if ((m = p.match(/^\/api\/admin\/services\/(\d+)\/move$/))) {
      const list = sorted(db);
      const i = list.findIndex((s) => s.id === Number(m[1]));
      const j = i + (body.dir === 'up' ? -1 : 1);
      if (i >= 0 && j >= 0 && j < list.length) { [list[i], list[j]] = [list[j], list[i]]; list.forEach((s, k) => { s.sort = k; }); save(db); }
      return { services: sorted(db) };
    }
    if ((m = p.match(/^\/api\/admin\/services\/(\d+)$/)) && method === 'PUT') {
      const s = db.services.find((x) => x.id === Number(m[1]));
      if (!s) fail('not_found', 404);
      Object.assign(s, cleanService({ ...s, ...body }));
      if (body.active !== undefined) s.active = Boolean(body.active);
      save(db);
      return { service: s };
    }
    fail('not_found', 404);
  };

  // ---------- demo banner ----------
  document.addEventListener('DOMContentLoaded', () => {
    const bar = document.createElement('div');
    bar.className = 'demo-bar';
    const note = document.createElement('span');
    const links = document.createElement('span');
    const admin = document.createElement('a');
    admin.href = 'admin-login.html'; admin.textContent = 'Admin';
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.addEventListener('click', () => {
      try { localStorage.removeItem(KEY); localStorage.removeItem(ADMIN_KEY); } catch { /* storage blocked */ }
      location.href = 'index.html';
    });
    links.append(admin, reset);
    bar.append(note, links);
    document.body.append(bar);

    // Follow the page's DE / EN switch, which sets <html lang>.
    const paint = () => {
      const en = document.documentElement.lang === 'en';
      note.innerHTML = en
        ? '<b>DEMO</b> · bookings are saved in this browser only'
        : '<b>DEMO</b> · Buchungen werden nur in diesem Browser gespeichert';
      reset.textContent = en ? 'Reset demo' : 'Demo zurücksetzen';
    };
    paint();
    new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

    if (/admin-login\.html$/.test(location.pathname)) {
      const hint = document.createElement('p');
      hint.className = 'demo-hint';
      hint.innerHTML = `Demo: <code>${DEMO_LOGIN.email}</code> / <code>${DEMO_LOGIN.password}</code>`;
      const target = document.getElementById('app');
      new MutationObserver((_, obs) => { const f = target.querySelector('form'); if (f && !f.querySelector('.demo-hint')) { f.append(hint); } }).observe(target, { childList: true, subtree: true });
    }
  });
})();
