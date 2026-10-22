// Booking rules on Cloudflare D1. Every function takes the D1 binding (env.DB) first.
import config from '../src/config.js';
import { nowInZone, addDays, weekday, toMinutes, toHHMM, isDate, minutesUntil } from '../src/time.js';

// Codes look like KTM-482. No I/L/O or 0/1: they get read out over the phone.
// The phone number is the second factor, so 23^3 * 8^3 combinations is plenty behind a rate limit.
const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const DIGITS = '23456789';

export class BookingError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

const randomIndex = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
function newCode() {
  let s = '';
  for (let i = 0; i < 3; i++) s += LETTERS[randomIndex(LETTERS.length)];
  for (let i = 0; i < 3; i++) s += DIGITS[randomIndex(DIGITS.length)];
  return s;
}

// Accepts 'ktm 482', 'KTM-482', etc. Returns 'KTM482' or null.
function normalizeCode(input) {
  const s = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s.length === 6 ? s : null;
}
const formatCode = (code) => `${code.slice(0, 3)}-${code.slice(3)}`;
export const now = () => nowInZone(config.timezone);

const cleanName = (s) => String(s || '').replace(/\s+/g, ' ').trim();

// One canonical form per number, so "079 123 45 67", "+41 79 123 45 67" and "0041791234567" all match.
function cleanPhone(s) {
  let p = String(s || '').replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  if (p.startsWith('00')) p = `+${p.slice(2)}`;
  else if (p.startsWith('0')) p = `+41${p.slice(1)}`; // Swiss local format
  return p;
}

const all = async (db, sql, ...args) => (await db.prepare(sql).bind(...args).all()).results;
const first = (db, sql, ...args) => db.prepare(sql).bind(...args).first();
const run = (db, sql, ...args) => db.prepare(sql).bind(...args).run();

// ---------- services ----------
const publicService = (s) => ({
  id: s.id, category: s.category, name_de: s.name_de, name_en: s.name_en, desc_de: s.desc_de || null, desc_en: s.desc_en || null,
  duration_min: s.duration_min, price: s.price, price_from: Boolean(s.price_from),
});
export const listServices = async (db) => (await all(db, 'SELECT * FROM services WHERE active = 1 ORDER BY sort, id')).map(publicService);
export const listAllServices = async (db) => (await all(db, 'SELECT * FROM services ORDER BY sort, id'))
  .map((s) => ({ ...publicService(s), sort: s.sort, active: Boolean(s.active) }));

function cleanService(input) {
  const name_de = cleanName(input.name_de);
  const name_en = cleanName(input.name_en) || name_de;
  const desc_de = cleanName(input.desc_de).slice(0, 140) || null;
  const desc_en = cleanName(input.desc_en).slice(0, 140) || desc_de;
  const category = config.categories.some((c) => c.id === input.category) ? input.category : config.categories[config.categories.length - 1].id;
  const duration_min = Number(input.duration_min);
  const price = Number(input.price);
  const price_from = input.price_from ? 1 : 0;
  if (name_de.length < 2 || name_de.length > 60 || name_en.length > 60) throw new BookingError(400, 'bad_service_name');
  if (!Number.isInteger(duration_min) || duration_min < 5 || duration_min > 480 || duration_min % config.slotStepMinutes !== 0) throw new BookingError(400, 'bad_duration');
  if (!Number.isInteger(price) || price < 0 || price > 100000) throw new BookingError(400, 'bad_price');
  return { name_de, name_en, desc_de, desc_en, category, duration_min, price, price_from };
}

export async function createService(db, input) {
  const s = cleanService(input);
  const sort = ((await first(db, 'SELECT MAX(sort) AS m FROM services'))?.m ?? -1) + 1;
  const res = await run(db, `INSERT INTO services (name_de, name_en, desc_de, desc_en, category, duration_min, price, price_from, sort)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  s.name_de, s.name_en, s.desc_de, s.desc_en, s.category, s.duration_min, s.price, s.price_from, sort);
  return (await listAllServices(db)).find((x) => x.id === Number(res.meta.last_row_id));
}

export async function updateService(db, id, input) {
  const existing = await first(db, 'SELECT * FROM services WHERE id = ?', id);
  if (!existing) throw new BookingError(404, 'not_found');
  const s = cleanService({ ...existing, ...input });
  const active = input.active === undefined ? existing.active : (input.active ? 1 : 0);
  await run(db, `UPDATE services SET name_de = ?, name_en = ?, desc_de = ?, desc_en = ?, category = ?, duration_min = ?, price = ?, price_from = ?, active = ?
                 WHERE id = ?`, s.name_de, s.name_en, s.desc_de, s.desc_en, s.category, s.duration_min, s.price, s.price_from, active, id);
  return (await listAllServices(db)).find((x) => x.id === id);
}

export async function moveService(db, id, dir) {
  const list = await all(db, 'SELECT id FROM services ORDER BY sort, id');
  const i = list.findIndex((s) => s.id === id);
  const j = i + (dir === 'up' ? -1 : 1);
  if (i >= 0 && j >= 0 && j < list.length) {
    [list[i], list[j]] = [list[j], list[i]];
    await db.batch(list.map((s, k) => db.prepare('UPDATE services SET sort = ? WHERE id = ?').bind(k, s.id)));
  }
  return listAllServices(db);
}

async function activeService(db, id) {
  const s = await first(db, 'SELECT * FROM services WHERE id = ?', Number(id));
  if (!s || !s.active) throw new BookingError(400, 'unknown_service');
  return s;
}

// ---------- availability ----------
function opening(date, closed) {
  const h = config.hours[weekday(date)];
  if (!h || closed.has(date)) return null;
  return [toMinutes(h[0]), toMinutes(h[1])];
}

function freeStarts(date, minutes, taken, closed, n) {
  const open = opening(date, closed);
  if (!open) return [];
  const slots = [];
  for (let t = open[0]; t + minutes <= open[1]; t += config.slotStepMinutes) {
    if (minutesUntil(n, date, t) < config.minLeadMinutes) continue;
    if (taken.some((b) => t < b.end_min && t + minutes > b.start_min)) continue;
    slots.push(t);
  }
  return slots;
}

// Everything that blocks time between two dates: confirmed bookings, breaks and closed days.
async function busy(db, from, to) {
  const [bookings, blocks, closures] = await Promise.all([
    all(db, `SELECT date, start_min, end_min FROM bookings WHERE date >= ? AND date <= ? AND status = 'confirmed'`, from, to),
    all(db, 'SELECT date, start_min, end_min FROM blocks WHERE date >= ? AND date <= ?', from, to),
    all(db, 'SELECT date FROM closures WHERE date >= ? AND date <= ?', from, to),
  ]);
  const taken = {};
  for (const b of bookings.concat(blocks)) (taken[b.date] ||= []).push(b);
  return { taken, closed: new Set(closures.map((c) => c.date)) };
}

export async function availability(db, serviceId) {
  const service = await activeService(db, serviceId);
  const n = now();
  const last = addDays(n.date, config.bookingHorizonDays - 1);
  const { taken, closed } = await busy(db, n.date, last);
  const days = [];
  for (let i = 0; i < config.bookingHorizonDays; i++) {
    const date = addDays(n.date, i);
    const open = opening(date, closed);
    // Today counts as closed once no start time could ever fit, booked or not.
    const over = open && i === 0 && minutesUntil(n, date, open[1] - service.duration_min) < config.minLeadMinutes;
    days.push({ date, closed: !open || over, slots: freeStarts(date, service.duration_min, taken[date] || [], closed, n).map(toHHMM) });
  }
  return { service: publicService(service), days };
}

// ---------- bookings ----------
export function present(row) {
  const until = minutesUntil(now(), row.date, row.start_min);
  return {
    code: formatCode(row.code),
    service: { id: row.service_id, name_de: row.service_name_de, name_en: row.service_name_en, price: row.price, price_from: Boolean(row.price_from), duration_min: row.end_min - row.start_min },
    date: row.date,
    start: toHHMM(row.start_min),
    end: toHHMM(row.end_min),
    name: row.name,
    lang: row.lang,
    status: row.status,
    cancelledBy: row.cancelled_by,
    isPast: until < 0,
    canCancel: row.status === 'confirmed' && until >= config.cancelCutoffMinutes,
  };
}
const presentAdmin = (row) => ({ ...present(row), id: row.id, phone: row.phone, createdAt: row.created_at, cancelledAt: row.cancelled_at });

export async function create(db, input) {
  const service = await activeService(db, input.serviceId);
  if (!isDate(input.date)) throw new BookingError(400, 'bad_date');
  if (typeof input.start !== 'string' || !/^\d{2}:\d{2}$/.test(input.start)) throw new BookingError(400, 'bad_time');

  const name = cleanName(input.name);
  const phone = cleanPhone(input.phone);
  if (name.length < 2 || name.length > 60) throw new BookingError(400, 'bad_name');
  if (phone.replace('+', '').length < 6 || phone.length > 20) throw new BookingError(400, 'bad_phone');

  const n = now();
  const start = toMinutes(input.start);
  const end = start + service.duration_min;
  const last = addDays(n.date, config.bookingHorizonDays - 1);
  if (input.date < n.date || input.date > last) throw new BookingError(400, 'out_of_range');

  const { taken, closed } = await busy(db, input.date, input.date);
  if (!freeStarts(input.date, service.duration_min, taken[input.date] || [], closed, n).includes(start)) throw new BookingError(409, 'slot_taken');

  const upcoming = (await all(db, `SELECT date, start_min FROM bookings WHERE phone = ? AND status = 'confirmed' AND date >= ?`, phone, n.date))
    .filter((b) => minutesUntil(n, b.date, b.start_min) >= 0);
  if (upcoming.length >= config.maxActivePerContact) throw new BookingError(409, 'too_many');

  // One statement that only inserts if the time is still free, so two people can never take the same slot,
  // even if they press "book" at the same moment. D1 runs each statement on its own.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    try {
      const res = await run(db, `
        INSERT INTO bookings (code, service_id, service_name_de, service_name_en, price, price_from, date, start_min, end_min, name, phone, lang)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM bookings WHERE date = ? AND status = 'confirmed' AND start_min < ? AND end_min > ?)
          AND NOT EXISTS (SELECT 1 FROM blocks WHERE date = ? AND start_min < ? AND end_min > ?)
          AND NOT EXISTS (SELECT 1 FROM closures WHERE date = ?)`,
      code, service.id, service.name_de, service.name_en, service.price, service.price_from ? 1 : 0, input.date, start, end, name, phone,
      input.lang === 'en' ? 'en' : 'de',
      input.date, end, start, input.date, end, start, input.date);
      if (!res.meta.changes) throw new BookingError(409, 'slot_taken');
      return present(await first(db, 'SELECT * FROM bookings WHERE code = ?', code));
    } catch (err) {
      if (err instanceof BookingError) throw err;
      if (!/UNIQUE/i.test(String(err && err.message))) throw err; // only retry a code collision
    }
  }
  throw new BookingError(500, 'server_error');
}

// Both the code and the phone number must match; a wrong pair gives the same answer as no booking.
export async function find(db, phone, codeInput) {
  const code = normalizeCode(codeInput);
  const row = code && await first(db, 'SELECT * FROM bookings WHERE code = ?', code);
  const p = cleanPhone(phone);
  if (!row || !p || cleanPhone(row.phone) !== p) throw new BookingError(404, 'not_found');
  return row;
}

const CANCEL = `UPDATE bookings SET status = 'cancelled', cancelled_by = ?, cancelled_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ? AND status = 'confirmed'`;

export async function cancelByCustomer(db, phone, code) {
  const row = await find(db, phone, code);
  if (row.status !== 'confirmed') throw new BookingError(409, 'already_cancelled');
  if (!present(row).canCancel) throw new BookingError(409, 'too_late');
  await run(db, CANCEL, 'customer', row.id);
  return present(await first(db, 'SELECT * FROM bookings WHERE id = ?', row.id));
}

export async function cancelById(db, id) {
  const row = await first(db, 'SELECT * FROM bookings WHERE id = ?', id);
  if (!row) throw new BookingError(404, 'not_found');
  await run(db, CANCEL, 'shop', row.id);
  return presentAdmin(await first(db, 'SELECT * FROM bookings WHERE id = ?', row.id));
}

export async function listForAdmin(db, { scope, includeCancelled }) {
  const n = now();
  const status = includeCancelled ? '' : `AND status = 'confirmed'`;
  const rows = scope === 'past'
    ? await all(db, `SELECT * FROM bookings WHERE date <= ? ${status} ORDER BY date DESC, start_min DESC LIMIT 300`, n.date)
    : await all(db, `SELECT * FROM bookings WHERE date >= ? ${status} ORDER BY date, start_min LIMIT 500`, n.date);
  // Today belongs to both views: finished appointments are past, the rest upcoming.
  return rows.map(presentAdmin).filter((b) => (scope === 'past' ? b.isPast : !b.isPast));
}

// ---------- closed days ----------
export const listClosures = (db) => all(db, 'SELECT date, reason FROM closures WHERE date >= ? ORDER BY date', now().date);

export async function addClosure(db, date, reason) {
  if (!isDate(date)) throw new BookingError(400, 'bad_date');
  await run(db, 'INSERT INTO closures (date, reason) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET reason = excluded.reason',
    date, cleanName(reason).slice(0, 80) || null);
  const affected = (await first(db, `SELECT COUNT(*) AS n FROM bookings WHERE date = ? AND status = 'confirmed'`, date)).n;
  return { date, affected };
}

export const removeClosure = (db, date) => run(db, 'DELETE FROM closures WHERE date = ?', date);

// ---------- breaks (time blocks inside a day) ----------
export async function listBlocks(db) {
  const rows = await all(db, 'SELECT id, date, start_min, end_min, reason FROM blocks WHERE date >= ? ORDER BY date, start_min', now().date);
  return rows.map((b) => ({ ...b, start: toHHMM(b.start_min), end: toHHMM(b.end_min) }));
}

export async function addBlock(db, date, start, end, reason) {
  if (!isDate(date)) throw new BookingError(400, 'bad_date');
  if (!/^\d{2}:\d{2}$/.test(String(start)) || !/^\d{2}:\d{2}$/.test(String(end))) throw new BookingError(400, 'bad_time');
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s >= e || e > 24 * 60) throw new BookingError(400, 'bad_time');
  const res = await run(db, 'INSERT INTO blocks (date, start_min, end_min, reason) VALUES (?, ?, ?, ?)', date, s, e, cleanName(reason).slice(0, 80) || null);
  // Bookings already in that window stay; the owner decides whether to cancel them.
  const affected = (await first(db, `SELECT COUNT(*) AS n FROM bookings WHERE date = ? AND status = 'confirmed' AND start_min < ? AND end_min > ?`, date, e, s)).n;
  return { id: Number(res.meta.last_row_id), date, start: toHHMM(s), end: toHHMM(e), affected };
}

export const removeBlock = (db, id) => run(db, 'DELETE FROM blocks WHERE id = ?', id);
