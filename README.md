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

Runs on Cloudflare Workers (static pages + API) with a D1 database, on the free plan, with no build step. It's set in Inter (self-hosted), plus the system serif for the shop name and system mono for times and codes.

## Demo (no server needed)

`docs/` is a static copy of the site that runs entirely in the browser. Every page and button works, with the same booking rules, but bookings are saved only in the visitor's own browser (localStorage), so nothing is shared or secure. It comes with a few sample bookings, and a bar at the bottom has "Reset demo".

- Open it: GitHub Pages (Settings → Pages → Deploy from branch → `main` / `docs`), or any static host, or `python3 -m http.server` then visit `/docs/`.
- Demo admin login: `demo@donromeo.ch` / `demo1234`.
- Rebuild after changing anything in `public/`, `src/config.js` or `demo/`: `npm run build:demo`.

## Run it locally

```bash
npm install
npm run dev      # applies the D1 migrations locally, then http://localhost:8787 (admin at /admin)
npm test         # 39 end-to-end checks against `wrangler dev` on a throwaway local database
```

Local admin login uses `ADMIN_EMAIL` / `ADMIN_PASSWORD` from a `.dev.vars` (or `.env`) file, both gitignored. Wrangler 4.86 is pinned because newer versions need Node 22.

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

## Secrets

Set on Cloudflare with `npx wrangler secret put NAME` (never commit them):

| Name | Required | Notes |
| --- | --- | --- |
| `ADMIN_PASSWORD` | yes | Admin login password. Changing it signs everyone out |
| `ADMIN_EMAIL` | recommended | Admin login email. If unset, any email is accepted and only the password is checked |
| `SESSION_SECRET` | no | Extra random string mixed into the admin session signature |

## Deploy (Cloudflare Workers + D1, free plan)

One time:

```bash
npx wrangler login                       # opens the browser, approve access
npx wrangler d1 create el-romeo          # copy the database_id it prints into wrangler.toml
npm run db:migrate                       # creates the tables and the 10 starting services
npx wrangler secret put ADMIN_EMAIL
npx wrangler secret put ADMIN_PASSWORD
npm run deploy                           # live at https://el-romeo.<your-subdomain>.workers.dev
```

Then add the domain in the Cloudflare dashboard: Workers & Pages → el-romeo → Settings → Domains & Routes → Add custom domain (for example `elromeo.ch`). The domain's DNS has to be on Cloudflare for that.

After that, every change is just `npm run deploy`. Database changes go in a new file in `migrations/` and `npm run db:migrate`.

**Backups:** D1 keeps point-in-time history (Time Travel); you can also export with `npx wrangler d1 export el-romeo --remote --output backup.sql`.

## How it works

- Free times are inside opening hours, not on a closed day or in a break, at least 1 hour ahead, and not overlapping a confirmed booking. The booking itself is one `INSERT … WHERE NOT EXISTS (overlap)` statement, so two people pressing "book" at the same moment can't both get the slot (covered by a test).
- Codes are 3 letters + 3 digits with no look-alike characters. Looking up or cancelling needs **both** the phone number and the code, and is rate-limited per IP (Cloudflare rate-limit bindings in `wrangler.toml`). Phone numbers are normalised (079…, +41 79…, 0041 79… all match).
- The `/admin` page redirects to `/admin/login` unless the session cookie is valid. Every admin API also checks the cookie.

## Files

```
wrangler.toml          Worker config: static assets, D1 binding, rate limits
worker/index.js        API routes, admin session, admin page guard
worker/bookings.js     services, availability, booking, cancelling, closures, breaks (D1)
migrations/            D1 schema + starting services (generated by scripts/seed-sql.mjs)
src/config.js          shop settings
src/time.js            date/time helpers in the shop's time zone
public/                the website (HTML/CSS/JS, fonts, images, logo); public/_headers = security headers
public/common.js       DE/EN dictionary, formatting, currency toggle, helpers
test/api.test.mjs      end-to-end checks (npm test)
demo/demo-api.js       in-browser stand-in for the server, used only by the GitHub Pages demo
scripts/build-demo.mjs builds docs/ from public/ + demo/
docs/                  the built static demo
```
