(() => {
  'use strict';
  const { h, route, t, state, langSwitch, boot } = window.DRB;
  const app = document.getElementById('app');

  // Basic Impressum + privacy notice built from the shop settings. Not legal advice: have it reviewed before going live.
  const text = {
    de: {
      title: 'Impressum',
      company: 'Firma', owner: 'Inhaber', address: 'Adresse', phone: 'Telefon', uid: 'UID',
      country: 'Schweiz',
      privacy: 'Datenschutz',
      p: [
        'Wenn Sie online einen Termin buchen, speichern wir Ihren Namen und Ihre Telefonnummer sowie die gewählte Leistung, das Datum und die Uhrzeit.',
        'Wir verwenden diese Angaben nur, um Ihren Termin zu verwalten und Sie bei Bedarf zu kontaktieren. Wir verkaufen sie nicht und geben sie nicht weiter, ausser an technische Dienstleister, die für den Betrieb dieser Website nötig sind (Hosting).',
        'Diese Website setzt keine Tracking- oder Werbe-Cookies. In Ihrem Browser werden nur Ihre Sprach- und Währungseinstellung gespeichert.',
        'Sie können jederzeit Auskunft über Ihre gespeicherten Daten verlangen oder deren Löschung beantragen. Kontaktieren Sie uns dazu telefonisch oder direkt im Salon.',
      ],
    },
    en: {
      title: 'Legal notice',
      company: 'Business', owner: 'Owner', address: 'Address', phone: 'Phone', uid: 'UID',
      country: 'Switzerland',
      privacy: 'Privacy',
      p: [
        'When you book online, we store your name and phone number, plus the service, date and time you chose.',
        'We only use this to manage your appointment and to contact you if needed. We do not sell it or pass it on, except to technical providers needed to run this website (hosting).',
        'This website sets no tracking or advertising cookies. Your browser only stores your language and currency choice.',
        'You can ask at any time what data we hold about you, or ask us to delete it. Call us or ask in the shop.',
      ],
    },
  };

  function render() {
    const L = t();
    const c = state.cfg;
    const x = text[state.lang] || text.de;
    const legal = c.legal || {};
    const rows = [
      [x.company, legal.company || c.shopName],
      [x.owner, legal.owner],
      [x.address, c.address ? `${c.address}, ${x.country}` : null],
      [x.phone, c.phone ? h('a', { href: `tel:+41${c.phone.replace(/\s/g, '').replace(/^0/, '')}` }, c.phone) : null],
      [x.uid, legal.uid],
    ].filter(([, v]) => v);

    app.replaceChildren(
      h('header', { class: 'sub-top' },
        h('a', { class: 'back', href: route('home') }, '← ', L.back),
        h('h1', { class: 'sub-title' }, x.title),
        langSwitch(),
      ),
      h('main', { class: 'col legal' },
        h('section', { class: 'block' },
          h('h2', { class: 'section-label' }, x.title),
          h('dl', { class: 'facts' }, rows.map(([k, v]) => h('div', null, h('dt', null, k), h('dd', null, v)))),
        ),
        h('section', { class: 'block' },
          h('h2', { class: 'section-label' }, x.privacy),
          x.p.map((para) => h('p', { class: 'legal-p' }, para)),
        ),
      ),
    );
  }

  boot(render).catch(() => { app.replaceChildren(h('p', { class: 'msg msg-error' }, 'Die Seite ist zurzeit nicht verfügbar.')); });
})();
