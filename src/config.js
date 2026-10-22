// Shop settings. Everything the owner might want to change lives here.
// Services and prices are edited in the admin panel; the list below only seeds an empty database.

export default {
  shopName: 'El Romeo',
  tagline: 'BARBERSHOP · ZÜRICH',   // small spaced line under the name in the footer
  logo: '/logo.svg',                 // drawn badge (public/logo.svg)
  address: 'Überlandstrasse 327, 8051 Zürich',
  phone: '078 228 99 97',            // shown on the site and when online cancelling has closed
  instagram: 'brioni_barbershop',    // handle only; null hides the link
  defaultLang: 'de',

  // For the Impressum page.
  legal: {
    company: 'El Romeo',
    owner: 'Bojan Stojanović',
    uid: null, // UID number once the business has one, e.g. 'CHE-123.456.789'
  },

  // "Unsere Arbeit" photos on the home page, taken from the shop's Instagram and cropped square.
  gallery: [
    { src: '/images/work-1.jpg', alt: { de: 'Haarschnitt und Bart im Profil', en: 'Haircut and beard, side view' } },
    { src: '/images/work-2.jpg', alt: { de: 'Taper Fade, Seitenansicht', en: 'Taper fade, side view' } },
    { src: '/images/work-3.jpg', alt: { de: 'Bowl Cut mit Fade', en: 'Bowl cut with fade' } },
    { src: '/images/work-4.jpg', alt: { de: 'Slick Back mit Taper', en: 'Slick back with taper' } },
    { src: '/images/work-5.jpg', alt: { de: 'Strukturierter Schnitt mit Fade', en: 'Textured cut with fade' } },
    { src: '/images/work-6.jpg', alt: { de: 'Kunden und Freunde im Salon', en: 'Customers and friends in the shop' } },
  ],

  // One-line note under the price list, per language.
  note: {
    de: '* Bezahlung im Salon: bar, Karte oder TWINT',
    en: '* Pay at the shop: cash, card or TWINT',
  },

  currency: 'CHF',
  // Second currency for the price toggle (display only). Set to null to hide the toggle.
  altCurrency: { code: 'EUR', rate: 1.06, roundTo: 1 }, // approximate rate: 1 CHF = 1.06 EUR

  // All times are wall-clock times in this zone, whatever zone the server runs in.
  timezone: 'Europe/Zurich',

  // Price list groups, in display order.
  categories: [
    { id: 'men',   name: { de: 'Herren', en: 'Men' } },
    { id: 'women', name: { de: 'Damen', en: 'Women' } },
    { id: 'other', name: { de: 'Weitere Leistungen', en: 'More services' } },
  ],

  // Starting price list from the shop (2026-10). price_from = "ab" price, depends on hair length.
  seedServices: [
    { category: 'men',   name_de: 'Herrenhaarschnitt',       name_en: "Men's haircut",        duration_min: 45, price: 40 },
    { category: 'men',   name_de: 'Bart',                    name_en: 'Beard trim',           duration_min: 45, price: 15 },
    { category: 'women', name_de: 'Damenhaarschnitt',        name_en: "Women's haircut",      duration_min: 45, price: 50 },
    { category: 'women', name_de: 'Föhnen',                  name_en: 'Blow-dry',             duration_min: 45, price: 40, price_from: true,
      desc_de: 'Je nach Haarlänge', desc_en: 'Depending on hair length' },
    { category: 'other', name_de: 'Rasur',                   name_en: 'Shave',                duration_min: 45, price: 50 },
    { category: 'other', name_de: 'Haare waschen & Föhnen',  name_en: 'Wash & blow-dry',      duration_min: 45, price: 40 },
    { category: 'other', name_de: 'Haare waschen & Schnitt', name_en: 'Wash & haircut',       duration_min: 45, price: 60, price_from: true,
      desc_de: 'Je nach Haarlänge', desc_en: 'Depending on hair length' },
    { category: 'other', name_de: 'Augenbrauen',             name_en: 'Eyebrows',             duration_min: 45, price: 10 },
    { category: 'other', name_de: 'Baba Paket',              name_en: 'Baba package',         duration_min: 45, price: 100,
      desc_de: 'Rasur, Haarschnitt, Augenbrauen, Gesichtsmaske, Kopfmassage & Parfum',
      desc_en: 'Shave, haircut, eyebrows, face mask, head massage & perfume' },
    { category: 'other', name_de: 'Home Cut',                name_en: 'Home cut',             duration_min: 45, price: 100,
      desc_de: 'Wir kommen zu Ihnen, in der Umgebung', desc_en: 'We come to you, in the area' },
  ],

  // Opening hours per weekday (0 = Sunday). null = closed.
  hours: {
    0: null,
    1: ['10:15', '18:30'],
    2: ['10:15', '18:30'],
    3: ['10:15', '18:30'],
    4: ['10:15', '18:30'],
    5: ['10:15', '18:30'],
    6: ['10:00', '16:30'],
  },

  slotStepMinutes: 15,        // a new start time every 15 minutes
  bookingHorizonDays: 30,     // how far ahead customers can book
  minLeadMinutes: 60,         // earliest bookable slot is 1h from now
  cancelCutoffMinutes: 1440,  // customers can cancel online until 1 day (24h) before
  maxActivePerContact: 2,     // upcoming bookings one email or phone number may hold
};
