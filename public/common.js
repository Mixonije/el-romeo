// Shared helpers for every page: dictionary, language switch, formatting, DOM and API.
(() => {
  'use strict';

  const dict = {
    de: {
      priceList: 'Preisliste', bookHeading: 'Termin buchen', pickServiceHint: 'Leistung antippen, um einen Termin zu wählen.', bookCta: 'Buchen', ourWork: 'Unsere Arbeit', instagramLink: (h) => `@${h} auf Instagram`, hours: 'Öffnungszeiten', closed: 'Geschlossen', min: 'Min.',
      days: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
      cancelLink: 'Buchung stornieren',
      show: (c) => `In ${c} anzeigen`,
      back: 'Zurück', booking: 'Termin buchen', services: 'Leistungen', schedule: 'Termin',
      today: 'Heute', tomorrow: 'Morgen', yesterday: 'Gestern', full: 'Ausgebucht', later: 'Mehr', closedShort: 'Zu', fullShort: 'Voll',
      morning: 'Vormittag', afternoon: 'Nachmittag', evening: 'Abend',
      noSlots: 'An diesem Tag sind keine Termine frei.', noDays: 'Zurzeit sind keine Termine frei. Bitte rufen Sie uns an.',
      pickTime: 'Uhrzeit wählen', book: 'Buchen', totalPrice: 'Gesamtpreis',
      bookTitle: 'Terminbuchung',
      nameLabel: 'Vor- und Nachname', namePh: 'z. B. Luca Meier',
      emailLabel: 'E-Mail-Adresse', emailPh: 'z. B. luca@beispiel.ch', enterEmail: 'Ihre E-Mail-Adresse',
      phoneLabel: 'Telefonnummer', phonePh: 'z. B. 079 123 45 67',
      confirm: 'Buchung bestätigen', confirming: 'Wird gebucht…',
      doneTitle: 'Ihr Termin ist gebucht!',
      doneNotEmailed: 'Bis bald!',
      yourCode: 'Ihr Buchungscode', saveHint: 'Bitte notieren Sie den Code oder machen Sie einen Screenshot. Zusammen mit Ihrer Telefonnummer brauchen Sie ihn zum Stornieren.',
      copy: 'Kopieren', copied: 'Kopiert!', close: 'Schliessen', addCal: 'Zum Kalender hinzufügen',
      lService: 'Leistung', lDate: 'Datum', lTime: 'Uhrzeit', lDuration: 'Dauer', lPrice: 'Preis', lName: 'Name', lCode: 'Code', lStatus: 'Status',
      cancelHeader: 'Stornieren', cancelTitle: 'Termin stornieren',
      cancelSub: 'Geben Sie Ihre Telefonnummer und den Code ein, den Sie bei der Buchung erhalten haben.',
      codeLabel: 'Buchungscode', codePh: 'z. B. KTM-482',
      cancelBtn: 'Buchung stornieren', finding: 'Wird gesucht…',
      sure: 'Sind Sie sicher? Dies kann nicht rückgängig gemacht werden.', yesCancel: 'Ja, stornieren', noBack: 'Nein, zurück',
      cancelled: 'Ihre Buchung wurde storniert. Der Termin ist wieder frei.',
      statusConfirmed: 'Bestätigt', statusCancelled: 'Storniert', statusPast: 'Vergangener Termin', byShop: 'Vom Salon storniert',
      callShop: (p) => (p ? `Bitte rufen Sie uns an: ${p}.` : 'Bitte kontaktieren Sie den Salon.'),
      // admin
      adminPanel: 'Admin-Bereich', password: 'Passwort', signIn: 'Anmelden', signingIn: 'Anmelden…', signOut: 'Abmelden',
      tabBookings: 'Buchungen', tabServices: 'Leistungen', tabDaysOff: 'Ruhetage',
      upcoming: 'Anstehend', past: 'Vergangen', showCancelled: 'Stornierte anzeigen', updated: 'Aktualisiert',
      stillToday: 'Heute noch', next7: 'Nächste 7 Tage',
      bookingsN: (n) => `${n} ${n === 1 ? 'Buchung' : 'Buchungen'}`,
      cancel: 'Stornieren', keep: 'Nein', confirmShopCancel: (n, t) => `${n}, ${t} stornieren? Bitte informieren Sie die Person, die App verschickt keine Nachricht.`,
      customerCancelled: 'Vom Kunden storniert', youCancelled: 'Storniert', done: 'Erledigt',
      noUpcoming: 'Keine anstehenden Buchungen. Neue erscheinen hier automatisch.', noPast: 'Keine vergangenen Buchungen.',
      daysOffHint: 'Geschlossene Tage verschwinden von der Buchungsseite. Bestehende Buchungen bleiben, bis Sie sie stornieren.',
      date: 'Datum', noteOpt: 'Notiz (optional)', notePh: 'Ferien, Weiterbildung…', closeDay: 'Tag schliessen', reopen: 'Wieder öffnen', saving: 'Wird gespeichert…',
      closedWithBookings: (n) => `Tag geschlossen. An diesem Tag ${n === 1 ? 'gibt es noch 1 Buchung' : `gibt es noch ${n} Buchungen`}, bitte in der Liste stornieren.`,
      noClosures: 'Keine geschlossenen Tage.',
      breaks: 'Pausen', breakLabel: 'Pause', tabDaysOffBreaks: 'Pausen & Ruhetage', breaksHint: 'Zum Beispiel Mittagspause. In dieser Zeit kann niemand buchen. Bestehende Buchungen bleiben.',
      from: 'Von', to: 'Bis', addBreak: 'Pause eintragen', noBreaks: 'Keine Pausen eingetragen.', remove: 'Entfernen',
      breakWithBookings: (n) => `Pause eingetragen. In diesem Zeitraum ${n === 1 ? 'gibt es 1 Buchung' : `gibt es ${n} Buchungen`}, bitte prüfen.`,
      breakNotePh: 'Mittagspause', bad_time_msg: 'Bitte gültige Zeiten wählen (Von vor Bis).',
      category: 'Kategorie', descDe: 'Beschreibung (DE, optional)', descEn: 'Beschreibung (EN, optional)', priceFromLabel: 'Ab-Preis (je nach Haarlänge)',
      priceFrom: 'ab', impressum: 'Impressum & Datenschutz',
      servicesHint: 'Änderungen erscheinen sofort in der Preisliste. Bestehende Buchungen behalten ihren alten Preis.',
      nameDe: 'Name (DE)', nameEn: 'Name (EN)', durationMin: 'Dauer (Min.)', price: 'Preis',
      edit: 'Bearbeiten', save: 'Speichern', discard: 'Abbrechen', hide: 'Ausblenden', showSvc: 'Einblenden', hidden: 'Ausgeblendet', addService: 'Leistung hinzufügen', up: 'Hoch', down: 'Runter',
      pickDate: 'Bitte ein Datum wählen.',
      errors: {
        slot_taken: 'Dieser Termin wurde gerade vergeben. Bitte wählen Sie eine andere Uhrzeit.',
        bad_name: 'Bitte Vor- und Nachnamen eingeben.', bad_email: 'Bitte eine gültige E-Mail-Adresse eingeben.', bad_phone: 'Bitte eine Telefonnummer eingeben.',
        too_many: 'Mit dieser Telefonnummer haben Sie bereits 2 anstehende Termine. Bitte stornieren Sie einen oder rufen Sie uns an.',
        not_found: 'Keine Buchung mit dieser Telefonnummer und diesem Code gefunden.',
        already_cancelled: 'Diese Buchung wurde bereits storniert.',
        too_late: 'Online-Stornierungen sind bis 24 Stunden vor dem Termin möglich.',
        bad_time: 'Bitte gültige Zeiten wählen (Von vor Bis).',
        rate_limited: 'Zu viele Versuche. Bitte warten Sie einige Minuten.',
        unknown_service: 'Diese Leistung ist nicht mehr verfügbar.', out_of_range: 'Dieser Tag ist nicht buchbar.',
        wrong_login: 'E-Mail oder Passwort ist falsch.', not_configured: 'Auf dem Server ist kein Admin-Passwort gesetzt.',
        bad_service_name: 'Bitte einen Namen für die Leistung eingeben.', bad_duration: 'Die Dauer muss ein Vielfaches von 15 Minuten sein.', bad_price: 'Bitte den Preis als ganze Zahl eingeben.',
        bad_date: 'Bitte ein gültiges Datum wählen.', unauthorized: 'Bitte melden Sie sich erneut an.',
        network: 'Keine Verbindung zum Server. Bitte nochmals versuchen.', server_error: 'Serverfehler. Bitte nochmals versuchen.',
      },
    },
    en: {
      priceList: 'Price list', bookHeading: 'Book an appointment', pickServiceHint: 'Tap a service to pick a time.', bookCta: 'Book', ourWork: 'Our work', instagramLink: (h) => `@${h} on Instagram`, hours: 'Working hours', closed: 'Closed', min: 'min',
      days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      cancelLink: 'Cancel booking',
      show: (c) => `Show ${c}`,
      back: 'Back', booking: 'Booking', services: 'Services', schedule: 'Schedule',
      today: 'Today', tomorrow: 'Tomorrow', yesterday: 'Yesterday', full: 'Full', later: 'More', closedShort: 'Closed', fullShort: 'Full',
      morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening',
      noSlots: 'No free times on this day.', noDays: 'No free times right now. Please call the shop.',
      pickTime: 'Pick a time', book: 'Book', totalPrice: 'Total price',
      bookTitle: 'Appointment booking',
      nameLabel: 'Full name', namePh: 'e.g. John Smith',
      emailLabel: 'Email address', emailPh: 'e.g. john@example.com', enterEmail: 'Enter your email',
      phoneLabel: 'Phone number', phonePh: 'e.g. +41 79 123 45 67',
      confirm: 'Confirm booking', confirming: 'Booking…',
      doneTitle: 'You\'re booked!',
      doneNotEmailed: 'See you then!',
      yourCode: 'Your booking code', saveHint: 'Write the code down or take a screenshot. Together with your phone number, you need it to cancel.',
      copy: 'Copy', copied: 'Copied!', close: 'Close', addCal: 'Add to calendar',
      lService: 'Service', lDate: 'Date', lTime: 'Time', lDuration: 'Duration', lPrice: 'Price', lName: 'Name', lCode: 'Code', lStatus: 'Status',
      cancelHeader: 'Cancel', cancelTitle: 'Cancel appointment',
      cancelSub: 'Enter your phone number and the code you got when you booked.',
      codeLabel: 'Booking code', codePh: 'e.g. KTM-482',
      cancelBtn: 'Cancel booking', finding: 'Looking…',
      sure: 'Are you sure? This can\'t be undone.', yesCancel: 'Yes, cancel', noBack: 'No, go back',
      cancelled: 'Booking cancelled. The time is free again.',
      statusConfirmed: 'Confirmed', statusCancelled: 'Cancelled', statusPast: 'Past appointment', byShop: 'Cancelled by the shop',
      callShop: (p) => (p ? `Call the shop: ${p}.` : 'Please contact the shop.'),
      adminPanel: 'Admin panel', password: 'Password', signIn: 'Sign in', signingIn: 'Signing in…', signOut: 'Sign out',
      tabBookings: 'Bookings', tabServices: 'Services', tabDaysOff: 'Days off',
      upcoming: 'Upcoming', past: 'Past', showCancelled: 'Show cancelled', updated: 'Updated',
      stillToday: 'Still today', next7: 'Next 7 days',
      bookingsN: (n) => `${n} ${n === 1 ? 'booking' : 'bookings'}`,
      cancel: 'Cancel', keep: 'Keep', confirmShopCancel: (n, t) => `Cancel ${n}, ${t}? Let them know, the app does not message them.`,
      customerCancelled: 'Customer cancelled', youCancelled: 'Cancelled', done: 'Done',
      noUpcoming: 'No upcoming bookings. New ones show up here on their own.', noPast: 'No past bookings.',
      daysOffHint: 'Closed days disappear from the booking page. Existing bookings stay until you cancel them.',
      date: 'Date', noteOpt: 'Note (optional)', notePh: 'Holiday, training…', closeDay: 'Close this day', reopen: 'Reopen', saving: 'Saving…',
      closedWithBookings: (n) => `Day closed. ${n === 1 ? '1 booking is' : `${n} bookings are`} still on that day, cancel them in the list.`,
      noClosures: 'No closed days.',
      breaks: 'Breaks', breakLabel: 'Break', tabDaysOffBreaks: 'Breaks & days off', breaksHint: 'For example a lunch break. Nobody can book during it. Existing bookings stay.',
      from: 'From', to: 'To', addBreak: 'Add break', noBreaks: 'No breaks added.', remove: 'Remove',
      breakWithBookings: (n) => `Break added. ${n === 1 ? '1 booking is' : `${n} bookings are`} in that time, please check.`,
      breakNotePh: 'Lunch break', bad_time_msg: 'Pick valid times (From before To).',
      category: 'Category', descDe: 'Description (DE, optional)', descEn: 'Description (EN, optional)', priceFromLabel: '"From" price (depends on hair length)',
      priceFrom: 'from', impressum: 'Legal notice & privacy',
      servicesHint: 'Changes show on the price list right away. Existing bookings keep their old price.',
      nameDe: 'Name (DE)', nameEn: 'Name (EN)', durationMin: 'Duration (min)', price: 'Price',
      edit: 'Edit', save: 'Save', discard: 'Cancel', hide: 'Hide', showSvc: 'Show', hidden: 'Hidden', addService: 'Add service', up: 'Up', down: 'Down',
      pickDate: 'Pick a date.',
      errors: {
        slot_taken: 'Someone just took that time. Pick another one.',
        bad_name: 'Add your full name.', bad_email: 'Add a valid email address.', bad_phone: 'Add a phone number.',
        too_many: 'You already have 2 upcoming bookings with this phone number. Cancel one or call the shop.',
        not_found: 'No booking found with that phone number and code.',
        already_cancelled: 'This booking is already cancelled.',
        too_late: 'Online cancelling closes 24 hours before the appointment.',
        bad_time: 'Pick valid times (From before To).',
        rate_limited: 'Too many tries. Wait a few minutes.',
        unknown_service: 'This service is no longer available.', out_of_range: 'That day is not open for booking.',
        wrong_login: 'Wrong email or password.', not_configured: 'The admin password is not set on the server.',
        bad_service_name: 'Add a service name.', bad_duration: 'Duration must be a multiple of 15 minutes.', bad_price: 'Enter the price as a whole number.',
        bad_date: 'Pick a valid date.', unauthorized: 'Please sign in again.',
        network: 'Can\'t reach the server. Try again.', server_error: 'Server error. Please try again.',
      },
    },
  };

  const LANG_KEY = 'drb-lang';
  const CUR_KEY = 'drb-alt-currency';
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
  };

  const listeners = [];
  const state = { lang: 'de', alt: false, cfg: null };

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v; // only ever used with static strings
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat(Infinity)) {
      if (c === null || c === undefined || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  // Page URLs. The static demo (docs/) overrides these with plain .html files.
  const routes = Object.assign(
    { home: '/', book: '/book', cancel: '/my-booking', impressum: '/impressum', adminLogin: '/admin/login', admin: '/admin' },
    window.DRB_ROUTES || {},
  );
  const route = (name, query) => routes[name] + (query ? `?${new URLSearchParams(query)}` : '');

  async function api(path, opts = {}) {
    // The static demo answers API calls in the browser instead of a server.
    if (window.DRB_MOCK) {
      try { return await window.DRB_MOCK(path, opts); }
      catch (err) {
        const code = err.code || 'server_error';
        const e = new Error(t().errors[code] || t().errors.server_error);
        e.code = code; e.status = err.status || 400;
        throw e;
      }
    }
    let res;
    try {
      res = await fetch(path, {
        method: opts.method || 'GET',
        headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        credentials: 'same-origin',
      });
    } catch {
      const e = new Error(t().errors.network); e.code = 'network'; throw e;
    }
    let data = null;
    try { data = await res.json(); } catch { /* empty body */ }
    if (!res.ok) {
      const code = (data && data.error) || 'server_error';
      const e = new Error(t().errors[code] || t().errors.server_error);
      e.code = code; e.status = res.status;
      throw e;
    }
    return data;
  }

  const t = () => dict[state.lang];
  const locale = () => (state.lang === 'en' ? 'en-CH' : 'de-CH');

  function utcDate(date) { const [y, m, d] = date.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); }
  const fmt = {
    date: (date, opts) => utcDate(date).toLocaleDateString(locale(), { ...opts, timeZone: 'UTC' }),
    long: (date) => fmt.date(date, { weekday: 'long', day: 'numeric', month: 'long' }),
    short: (date) => fmt.date(date, { weekday: 'short', day: 'numeric', month: 'short' }),
    // Prices are stored in the main currency; the toggle converts for display only.
    price(n, forceMain, from) {
      const c = state.cfg;
      const useAlt = !forceMain && state.alt && c.altCurrency;
      const value = useAlt ? Math.round((n * c.altCurrency.rate) / (c.altCurrency.roundTo || 1)) * (c.altCurrency.roundTo || 1) : n;
      const code = useAlt ? c.altCurrency.code : c.currency;
      const out = new Intl.NumberFormat(locale(), { style: 'currency', currency: code, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
      return from ? `${t().priceFrom} ${out}` : out;
    },
  };
  const dayDiff = (date) => Math.round((utcDate(date) - utcDate(state.cfg.today)) / 86400000);
  function relDay(date) {
    const n = dayDiff(date);
    if (n === 0) return t().today;
    if (n === 1) return t().tomorrow;
    if (n === -1) return t().yesterday;
    return null;
  }
  const svcName = (s) => (state.lang === 'en' ? s.name_en : s.name_de) || s.name_de;
  const svcDesc = (s) => (state.lang === 'en' ? (s.desc_en || s.desc_de) : s.desc_de) || null;
  const catName = (cat) => (cat ? cat.name[state.lang] || cat.name.de : null);

  // Services grouped by category in the configured order; unknown categories go last, empty groups are dropped.
  function groupServices(services) {
    const cats = state.cfg.categories || [];
    const out = cats.map((cat) => ({ cat, list: services.filter((s) => s.category === cat.id) }));
    const rest = services.filter((s) => !cats.some((cat) => cat.id === s.category));
    if (rest.length) out.push({ cat: null, list: rest });
    return out.filter((g) => g.list.length);
  }

  function setLang(lang) {
    state.lang = lang === 'en' ? 'en' : 'de';
    store.set(LANG_KEY, state.lang);
    document.documentElement.lang = state.lang === 'en' ? 'en' : 'de-CH';
    listeners.forEach((fn) => fn());
  }
  function setAlt(on) {
    state.alt = Boolean(on);
    store.set(CUR_KEY, state.alt ? '1' : '0');
    listeners.forEach((fn) => fn());
  }

  function langSwitch() {
    const btn = (code, label) => h('button', {
      type: 'button', class: state.lang === code ? 'is-on' : '', 'aria-pressed': String(state.lang === code),
      onclick: () => setLang(code),
    }, label);
    return h('div', { class: 'lang', role: 'group', 'aria-label': 'Language' }, btn('de', 'DE'), h('span', { 'aria-hidden': 'true' }, '/'), btn('en', 'EN'));
  }

  function setBusy(btn, busy, label) {
    if (busy) { btn.dataset.label = btn.textContent; btn.dataset.state = 'loading'; btn.disabled = true; btn.textContent = label; }
    else { btn.removeAttribute('data-state'); btn.disabled = false; if (btn.dataset.label) btn.textContent = btn.dataset.label; }
  }
  const errorBox = (msg) => h('p', { class: 'msg msg-error', role: 'alert' }, msg);

  async function boot(render) {
    state.cfg = await api('/api/config');
    const saved = store.get(LANG_KEY);
    state.lang = dict[saved] ? saved : (dict[state.cfg.defaultLang] ? state.cfg.defaultLang : 'de');
    state.alt = store.get(CUR_KEY) === '1';
    // The online cancel deadline comes from the shop settings.
    const hours = state.cfg.cancelCutoffMinutes / 60;
    dict.de.errors.too_late = `Online-Stornierungen sind bis ${hours} Stunden vor dem Termin möglich.`;
    dict.en.errors.too_late = `Online cancelling closes ${hours} hours before the appointment.`;
    document.documentElement.lang = state.lang === 'en' ? 'en' : 'de-CH';
    listeners.push(render);
    render();
  }

  window.DRB = { h, api, route, t, fmt, state, relDay, dayDiff, svcName, svcDesc, catName, groupServices, setLang, setAlt, langSwitch, setBusy, errorBox, boot };
})();
