# El Romeo · booking

A booking site for a one-chair barbershop. Its look and flow follow poisoned-rat.vercel.app (a black page, Tailwind zinc greys, a narrow centred column, small spaced-out uppercase labels), filled with El Romeo's own content (Bojan Stojanović, Überlandstrasse 327, 8051 Zürich).

It's for a barbershop in Zürich. The site is in German by default (Swiss spelling, formal "Sie"), with a DE / EN switch on every page. Prices are in Swiss francs (CHF), with a button to show them in euros (EUR).

| Page | What it does |
| --- | --- |
| `/` | Price list ("Preisliste") grouped Herren / Damen / Weitere Leistungen, "ab" prices, logo, CHF / EUR toggle, photos, opening hours, link to cancel |
| `/book?service=<id>` | Pick service, day and time, then a dialog asks for name and phone (no email). Booked straight away, with a code like `KTM-482` shown on screen |
| `/my-booking` | Customer enters phone number + code, sees the booking, confirms cancelling |
| `/admin/login` | Owner signs in with email + password |
| `/admin` | Bookings by day with breaks shown (cancel any), Services (category, names, description, length, price, "ab" price; hide, reorder, add), Breaks & days off (block e.g. a lunch break on any day, or close whole days) |
| `/impressum` | Impressum (company, owner, address, phone, UID) and a short privacy notice, built from `src/config.js`. A basic template, not legal advice |

Built with Node.js, Express and SQLite (one file, no database server), with no build step. It's set in Inter (self-hosted), plus the system serif for the shop name and system mono for times and codes.

## Demo (no server needed)

`docs/` is a static copy of the site that runs entirely in the browser. Every page and button works, with the same booking rules, but bookings are saved only in the visitor's own browser (localStorage), so nothing is shared or secure. It comes with a few sample bookings, and a bar at the bottom has "Reset demo".

- Open it: GitHub Pages (Settings → Pages → Deploy from branch → `main` / `docs`), or any static host, or `python3 -m http.server` then visit `/docs/`.
- Demo admin login: `demo@donromeo.ch` / `demo1234`.
- Rebuild after changing anything in `public/`, `src/config.js` or `demo/`: `npm run build:demo`.

## Run it locally

```bash
npm install
cp .env.example .env     # then set ADMIN_EMAIL and ADMIN_PASSWORD
npm start                # http://localhost:3000, admin at /admin
```

Requires Node 20 or newer. Run the end-to-end API checks with `npm test` (starts its own server on a throwaway database).

## Change shop details

**Services and prices:** in the admin panel, under Leistungen / Services. Changes show on the price list right away. Existing bookings keep the name and price they were booked at.

**Everything else:** in `src/config.js`:

| Setting | What it does |
| --- | --- |
| `logo` | `public/logo.svg`, a drawn round badge (BARBERSHOP · El ROMEO · HERREN & DAMEN · ZÜRICH). Edit the SVG text to change it |
| `legal` | Company, owner and UID for the Impressum page |
| `categories` | Price list groups and their order (Herren, Damen, Weitere Leistungen) |
| `gallery` | The "Unsere Arbeit" photos (`public/images/work-*.jpg`), taken from instagram.com/brioni_barbershop and cropped square |
| `instagram` | Handle for the Instagram link under the gallery |
| `tagline` | Small spaced-out line under the shop name |
| `address`, `phone` | Shown under the shop name; the phone also appears when online cancelling has closed |
| `note` | One line under the price list, per language |
| `altCurrency` | Second currency for the price toggle (`{ code, rate, roundTo }`), or `null` to hide the toggle |
| `defaultLang` | `sr` or `en` |
| `timezone` | The shop's time zone; every time on the site is in this zone |
| `hours` | Opening hours per weekday (0 = Sunday), `null` = closed |
| `slotStepMinutes`, `bookingHorizonDays`, `minLeadMinutes`, `cancelCutoffMinutes`, `maxActivePerContact` | Booking rules |

**Real data from the shop (2026-10):** name, owner, address, phone 078 228 99 97, hours (Mon to Fri 10:15 to 18:30, Sat 10:00 to 16:30, Sun closed), 10 services at 45 min each with their CHF prices, payment (cash, card, TWINT), cancel online until 24h before. The starting services in `src/config.js` only fill an empty database the first time it runs; after that, edit them in the admin.

**Still open:** admin login email, UID number (none yet), domain (wish: elromeo), the CHF to EUR rate (1.06, approximate).

## Environment variables

| Name | Required | Notes |
| --- | --- | --- |
| `ADMIN_PASSWORD` | yes | Admin login password. Changing it signs everyone out |
| `ADMIN_EMAIL` | recommended | Admin login email. If unset, any email is accepted and only the password is checked |
| `PORT` | no | Default `3000` |
| `SHOP_TZ` | no | Overrides `timezone` |
| `DB_PATH` | no | SQLite file location. On a host, point it at a persistent disk |
| `NODE_ENV` | no | `production` on a host, so the admin cookie is HTTPS-only |
| `TRUST_PROXY` | no | `0` only if NOT behind a proxy |

## Deploy

Any Node host with a **persistent disk**, run as a **single instance**:

- **Railway:** add a Volume at `/data`, then set `DB_PATH=/data/bookings.db`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `NODE_ENV=production`.
- **Render:** a paid Web Service with a Disk at `/data`, and the same variables.
- **Fly.io / a VPS:** use the `Dockerfile` and mount a volume at `/data`.

**Backups:** copy `bookings.db`.

## How it works

- Free times are inside opening hours, not on a closed day, at least 1 hour ahead, and not overlapping a confirmed booking. The server re-checks inside a transaction, so two people can't take the same time.
- Codes are 3 letters + 3 digits with no look-alike characters. Looking up or cancelling needs **both** the phone number and the code, and is rate-limited per IP. Phone numbers are normalised (079…, +41 79…, 0041 79… all match).
- The `/admin` page redirects to `/admin/login` unless the session cookie is valid. Every admin API also checks the cookie.

## Files

```
server.js              routes, admin session, page guard
src/config.js          shop settings
src/bookings.js        services, availability, booking, cancelling, closures
src/db.js              SQLite schema (+ seeds services on first run)
src/time.js            date/time helpers in the shop's time zone
public/common.js       DE/EN dictionary, formatting, currency toggle, helpers
public/home.js         price list page
public/book.js         booking page + dialog
public/my-booking.js   cancel page
public/admin-login.js  admin sign-in
public/admin.js        admin dashboard
demo/demo-api.js       in-browser stand-in for the server, used only by the demo
scripts/build-demo.js  builds docs/ from public/ + demo/
docs/                  the built static demo
```
