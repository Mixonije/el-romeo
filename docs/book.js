(() => {
  'use strict';
  const { h, api, route, t, fmt, state, relDay, dayDiff, svcName, catName, groupServices, langSwitch, setBusy, errorBox, boot } = window.DRB;
  const app = document.getElementById('app');
  const FIRST_DAYS = 14;

  const st = {
    serviceId: Number(new URLSearchParams(location.search).get('service')),
    days: null, date: null, time: null, showAll: false, loadError: null, pageError: null,
    form: { name: '', phone: '' },
    done: null, // { booking } after a successful booking
  };
  let dialog = null;

  const service = () => state.cfg.services.find((s) => s.id === st.serviceId);

  async function load(keepDate) {
    st.days = null; st.loadError = null;
    render();
    try {
      const data = await api(`/api/availability?service=${st.serviceId}`);
      st.days = data.days;
      const keep = keepDate && st.days.find((d) => d.date === keepDate && d.slots.length);
      const first = st.days.find((d) => d.slots.length);
      st.date = keep ? keep.date : first ? first.date : null;
      if (st.days.findIndex((d) => d.date === st.date) >= FIRST_DAYS) st.showAll = true;
    } catch (e) {
      st.loadError = e.message;
    }
    render();
  }

  function pickService(id) {
    if (id === st.serviceId) return;
    st.serviceId = id; st.time = null;
    history.replaceState(null, '', route('book', { service: id }));
    load(st.date);
  }

  // ---------- page ----------
  function render() {
    const L = t();
    const s = service();
    if (!s) { location.replace(route('home')); return; }

    app.replaceChildren(
      h('header', { class: 'sub-top' },
        h('a', { class: 'back', href: route('home') }, '← ', L.back),
        h('h1', { class: 'sub-title' }, L.booking),
        langSwitch(),
      ),
      h('main', { class: 'col' },
        h('section', { class: 'block' },
          h('h2', { class: 'section-label' }, L.services),
          groupServices(state.cfg.services).map(({ cat, list }) => h('div', { class: 'svc-pick-group' },
            cat ? h('h3', { class: 'svc-group-title' }, catName(cat)) : null,
            h('div', { class: 'svc-pick', role: 'group', 'aria-label': catName(cat) || L.services }, list.map((x) => h('button', {
              type: 'button', 'aria-pressed': String(x.id === st.serviceId), onclick: () => pickService(x.id),
            }, h('div', { class: 'svc' },
              h('span', { class: 'svc-name' }, svcName(x)),
              h('span', { class: 'svc-right' },
                h('span', { class: 'svc-dur' }, `${x.duration_min} ${L.min}`),
                h('span', { class: 'svc-price' }, fmt.price(x.price, true, x.price_from)),
              ),
            )))),
          )),
        ),
        h('section', { class: 'block' },
          h('h2', { class: 'section-label' }, L.schedule),
          scheduleEl(),
        ),
        st.pageError ? errorBox(st.pageError) : null,
        h('div', { class: 'total' }, h('span', null, L.totalPrice), h('span', null, fmt.price(s.price, true, s.price_from))),
        h('div', { class: 'book-bar' },
          h('button', { class: 'btn btn-white', type: 'button', disabled: !st.time, onclick: openForm },
            st.time ? `${L.book} · ${relDay(st.date) || fmt.short(st.date)}, ${st.time}` : L.pickTime),
        ),
      ),
    );
  }

  function scheduleEl() {
    const L = t();
    if (st.loadError) return errorBox(st.loadError);
    if (!st.days) {
      return h('div', null,
        h('div', { class: 'days' }, Array.from({ length: 6 }, () => h('div', { class: 'day day-skel' }))),
        h('div', { class: 'slots' }, Array.from({ length: 8 }, () => h('div', { class: 'slot-skel' }))),
      );
    }
    if (!st.date) return h('p', { class: 'empty' }, L.noDays);

    const visible = st.showAll ? st.days : st.days.slice(0, FIRST_DAYS);
    const strip = h('div', { class: 'days', role: 'group', 'aria-label': L.lDate },
      visible.map((d) => {
        const full = !d.slots.length;
        const rel = dayDiff(d.date) === 0 ? L.today : fmt.date(d.date, { weekday: 'short' });
        return h('button', {
          type: 'button', class: 'day', disabled: full, 'aria-pressed': String(d.date === st.date),
          'aria-label': `${fmt.long(d.date)}${d.closed ? `, ${L.closed}` : full ? `, ${L.full}` : ''}`,
          onclick: () => { st.date = d.date; st.time = null; render(); },
        },
          h('span', { class: 'day-wd' }, rel.replace('.', '')),
          h('span', { class: 'day-n' }, fmt.date(d.date, { day: 'numeric' }).replace('.', '')),
          h('span', { class: 'day-m' }, d.closed ? L.closedShort : full ? L.fullShort : fmt.date(d.date, { month: 'short' }).replace('.', '')),
        );
      }),
      !st.showAll && st.days.length > FIRST_DAYS
        ? h('button', { type: 'button', class: 'day', onclick: () => { st.showAll = true; render(); } },
          h('span', { class: 'day-wd' }, L.later), h('span', { class: 'day-n' }, '→'), h('span', { class: 'day-m' }, ''))
        : null,
    );
    // Keep the chosen day in view after every re-render.
    requestAnimationFrame(() => {
      const sel = strip.querySelector('[aria-pressed="true"]');
      if (sel) strip.scrollLeft = Math.max(0, sel.offsetLeft - strip.offsetLeft - 48);
    });

    const day = st.days.find((d) => d.date === st.date);
    const groups = [
      [L.morning, day.slots.filter((x) => x < '12:00')],
      [L.afternoon, day.slots.filter((x) => x >= '12:00' && x < '17:00')],
      [L.evening, day.slots.filter((x) => x >= '17:00')],
    ].filter(([, list]) => list.length);

    return h('div', null,
      strip,
      h('p', { class: 'day-date' }, fmt.long(st.date)),
      groups.length ? groups.map(([title, list]) => h('div', { class: 'slot-group' },
        h('h3', null, title),
        h('div', { class: 'slots', role: 'group', 'aria-label': title }, list.map((x) => h('button', {
          type: 'button', class: 'slot', 'aria-pressed': String(x === st.time),
          onclick: () => { st.time = x; st.pageError = null; render(); },
        }, x))),
      )) : h('p', { class: 'empty' }, L.noSlots),
    );
  }

  // ---------- dialog ----------
  function ensureDialog() {
    if (!dialog) {
      dialog = h('dialog', { class: 'sheet', 'aria-labelledby': 'sheet-title' });
      dialog.addEventListener('close', () => { if (st.done) location.href = route('home'); });
      document.body.append(dialog);
    }
    return dialog;
  }

  function facts(rows) {
    return h('dl', { class: 'facts' }, rows.filter(Boolean).map(([k, v]) => h('div', null, h('dt', null, k), h('dd', null, v))));
  }

  function openForm() {
    st.pageError = null;
    renderSheet();
    const d = ensureDialog();
    if (!d.open) d.showModal();
    const first = d.querySelector('input');
    if (first) first.focus();
  }

  function renderSheet() {
    const d = ensureDialog();
    if (st.done) return renderDone();
    const L = t();
    const s = service();
    const err = h('div');
    const input = (key, type, auto, ph, label) => {
      const el = h('input', { class: 'input', id: `f-${key}`, name: key, type, autocomplete: auto, placeholder: ph, required: true, maxlength: '60' });
      el.value = st.form[key];
      el.addEventListener('input', () => { st.form[key] = el.value; el.removeAttribute('aria-invalid'); });
      return h('div', { class: 'field' }, h('label', { for: `f-${key}` }, label), el);
    };
    const trap = h('input', { name: 'website', tabindex: '-1', autocomplete: 'off' });
    const submit = h('button', { class: 'btn btn-white', type: 'submit' }, L.confirm);

    d.replaceChildren(
      h('button', { class: 'sheet-close', type: 'button', 'aria-label': L.close, onclick: () => d.close() }, '×'),
      h('h2', { class: 'serif-title', id: 'sheet-title' }, L.bookTitle),
      facts([
        [L.lService, svcName(s)],
        [L.lDate, fmt.long(st.date)],
        [L.lTime, st.time],
        [L.lDuration, `${s.duration_min} ${L.min}`],
      ]),
      h('form', {
        novalidate: true,
        onsubmit: async (e) => {
          e.preventDefault();
          const f = st.form;
          const checks = [
            ['name', f.name.trim().length >= 2, 'bad_name'],
            ['phone', f.phone.replace(/\D/g, '').length >= 6, 'bad_phone'],
          ];
          const bad = checks.find(([, ok]) => !ok);
          checks.forEach(([k, ok]) => d.querySelector(`#f-${k}`).toggleAttribute('aria-invalid', !ok));
          d.querySelectorAll('[aria-invalid]').forEach((el) => el.setAttribute('aria-invalid', 'true'));
          if (bad) { d.querySelector(`#f-${bad[0]}`).focus(); err.replaceChildren(errorBox(L.errors[bad[2]])); return; }
          err.replaceChildren();
          setBusy(submit, true, L.confirming);
          try {
            const r = await api('/api/bookings', {
              method: 'POST',
              body: { serviceId: st.serviceId, date: st.date, start: st.time, name: f.name, phone: f.phone, lang: state.lang, website: trap.value },
            });
            st.done = r;
            renderDone();
          } catch (ex) {
            setBusy(submit, false);
            if (ex.code === 'slot_taken') {
              d.close();
              st.time = null;
              await load(st.date);
              st.pageError = ex.message;
              render();
            } else {
              err.replaceChildren(errorBox(ex.message));
            }
          }
        },
      },
        input('name', 'text', 'name', L.namePh, L.nameLabel),
        input('phone', 'tel', 'tel', L.phonePh, L.phoneLabel),
        h('div', { class: 'honeypot', 'aria-hidden': 'true' }, h('label', null, 'Website', trap)),
        h('div', { class: 'total' }, h('span', null, L.totalPrice), h('span', null, fmt.price(s.price, true, s.price_from))),
        err,
        submit,
      ),
    );
  }

  function renderDone() {
    const d = ensureDialog();
    const L = t();
    const b = st.done.booking;
    const copyBtn = h('button', {
      class: 'btn btn-ghost btn-sm', type: 'button',
      onclick: async () => {
        try { await navigator.clipboard.writeText(b.code); copyBtn.textContent = L.copied; } catch { /* clipboard blocked */ }
        setTimeout(() => { copyBtn.textContent = L.copy; }, 2000);
      },
    }, L.copy);

    d.replaceChildren(
      h('button', { class: 'sheet-close', type: 'button', 'aria-label': L.close, onclick: () => d.close() }, '×'),
      h('div', { class: 'check-mark', html: '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 9.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>' }),
      h('h2', { class: 'serif-title', id: 'sheet-title', tabindex: '-1' }, L.doneTitle),
      h('p', { class: 'lead' }, L.doneNotEmailed),
      h('div', { class: 'code-box' },
        h('p', { class: 'section-label' }, L.yourCode),
        h('div', { class: 'code-row' }, h('span', { class: 'code' }, b.code), copyBtn),
        h('p', { class: 'code-hint' }, L.saveHint),
      ),
      facts([
        [L.lService, svcName(b.service)],
        [L.lDate, fmt.long(b.date)],
        [L.lTime, `${b.start} – ${b.end}`],
        [L.lPrice, fmt.price(b.service.price, true, b.service.price_from)],
        [L.lName, b.name],
      ]),
      h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => downloadIcs(b) }, L.addCal),
      h('button', { class: 'btn btn-white', type: 'button', onclick: () => d.close() }, L.close),
    );
    d.querySelector('#sheet-title').focus();
  }

  function downloadIcs(b) {
    const stamp = (date, hhmm) => `${date.replace(/-/g, '')}T${hhmm.replace(':', '')}00`;
    const esc = (s) => String(s).replace(/([,;\\])/g, '\\$1');
    const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const c = state.cfg;
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${c.shopName}//Booking//EN`, 'BEGIN:VEVENT',
      `UID:${b.code}@el-romeo`, `DTSTAMP:${now}`,
      `DTSTART:${stamp(b.date, b.start)}`, `DTEND:${stamp(b.date, b.end)}`,
      `SUMMARY:${esc(`${svcName(b.service)} · ${c.shopName}`)}`,
      c.address ? `LOCATION:${esc(c.address)}` : null,
      `DESCRIPTION:${esc(`${t().codeLabel}: ${b.code}`)}`,
      'END:VEVENT', 'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const a = h('a', { href: url, download: `el-romeo-${b.date}.ics` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  boot(() => {
    render();
    if (dialog && dialog.open) renderSheet();
  }).then(() => {
    if (service()) load();
  }).catch(() => location.replace(route('home')));
})();
