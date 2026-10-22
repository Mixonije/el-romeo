-- El Romeo booking schema (Cloudflare D1 / SQLite).
CREATE TABLE IF NOT EXISTS services (
  id            INTEGER PRIMARY KEY,
  category      TEXT    NOT NULL DEFAULT 'other',
  name_de       TEXT    NOT NULL,
  name_en       TEXT    NOT NULL,
  desc_de       TEXT,
  desc_en       TEXT,
  duration_min  INTEGER NOT NULL,
  price         INTEGER NOT NULL,
  price_from    INTEGER NOT NULL DEFAULT 0,
  sort          INTEGER NOT NULL DEFAULT 0,
  active        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS bookings (
  id               INTEGER PRIMARY KEY,
  code             TEXT    NOT NULL UNIQUE,
  service_id       INTEGER NOT NULL,
  service_name_de  TEXT    NOT NULL,
  service_name_en  TEXT    NOT NULL,
  price            INTEGER NOT NULL,
  price_from       INTEGER NOT NULL DEFAULT 0,
  date             TEXT    NOT NULL,
  start_min        INTEGER NOT NULL,
  end_min          INTEGER NOT NULL,
  name             TEXT    NOT NULL,
  phone            TEXT    NOT NULL,
  lang             TEXT    NOT NULL DEFAULT 'de',
  status           TEXT    NOT NULL DEFAULT 'confirmed',
  cancelled_by     TEXT,
  created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  cancelled_at     TEXT
);
CREATE INDEX IF NOT EXISTS bookings_date ON bookings (date, status);
CREATE INDEX IF NOT EXISTS bookings_phone ON bookings (phone, status);

CREATE TABLE IF NOT EXISTS closures (
  date    TEXT PRIMARY KEY,
  reason  TEXT
);

-- Breaks inside a working day (lunch, an errand): those minutes cannot be booked.
CREATE TABLE IF NOT EXISTS blocks (
  id         INTEGER PRIMARY KEY,
  date       TEXT    NOT NULL,
  start_min  INTEGER NOT NULL,
  end_min    INTEGER NOT NULL,
  reason     TEXT
);
CREATE INDEX IF NOT EXISTS blocks_date ON blocks (date);
