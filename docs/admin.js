(() => {
  'use strict';
  const { h, api, route, t, fmt, state, relDay, dayDiff, svcName, catName, groupServices, langSwitch, setBusy, errorBox, boot } = window.DRB;
  const app = document.getElementById('app');

  const st = {
    tab: 'bookings', scope: 'upcoming', cancelled: false,
    bookings: [], closures: [], blocks: [], services: [], loaded: false, error: null, updatedAt: null,
    confirming: null, editing: null, adding: false, flash: null, breakFlash: null,
  };

  async function call(path, opts) {
    try { return await api(path, opts); }
    catch (e) { if (e.status === 401) location.replace(route('adminLogin')); throw e; }
  }

  async function refresh() {
    try {
      const [b, c, s, k] = await Promise.all([
        call(`/api/admin/bookings?scope=${st.scope}&cancelled=${st.cancelled ? 1 : 0}`),
        call('/api/admin/closures'),
        call('/api/admin/services'),
        call('/api/admin/blocks'),
      ]);
      st.bookings = b.bookings; state.cfg.today = b.today; st.closures = c.closures; st.services = s.services; st.blocks = k.blocks;
      st.loaded = true; st.error = null; st.updatedAt = new Date();
    } catch (e) {
      st.error = e.message;
    }
    render();
  }

  // ---------- layout ----------
  function render() {
    const L = t();
    const tab = (id, label) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(st.tab === id), onclick: () => { st.tab = id; st.flash = null; st.breakFlash = null; render(); } }, label);
    app.replaceChildren(...[
      h('header', { class: 'admin-top' },
        h('div', { class: 'admin-brand' }, h('h1', null, state.cfg.shopName), h('p', null, L.adminPanel)),
        h('div', { class: 'admin-top-end' },
          langSwitch(),
          h('button', { class: 'text-btn', type: 'button', onclick: async () => { await api('/api/admin/logout', { method: 'POST' }); location.replace(route('adminLogin')); } }, L.signOut),
        ),
      ),
      h('nav', { class: 'tabs', role: 'tablist' }, tab('bookings', L.tabBookings), tab('services', L.tabServices), tab('daysoff', L.tabDaysOffBreaks)),
      st.error ? errorBox(st.error) : null,
      st.tab === 'bookings' ? bookingsView() : st.tab === 'services' ? servicesView() : daysOffView(),
    ].filter(Boolean));
  }

  // ---------- bookings ----------
  function bookingsView() {
    const L = t();
    const seg = (scope, label) => h('button', { type: 'button', 'aria-pressed': String(st.scope === scope), onclick: () => { st.scope = scope; refresh(); } }, label);
    const live = st.bookings.filter((b) => b.status === 'confirmed');
    const sum = (arr) => arr.reduce((n, b) => n + b.service.price, 0);
    const today = live.filter((b) => b.date === state.cfg.today);
    const week = live.filter((b) => dayDiff(b.date) < 7);

    // Breaks show in the upcoming agenda next to the bookings, so the owner sees the whole day.
    const byDay = new Map();
    const add = (date, item) => { if (!byDay.has(date)) byDay.set(date, []); byDay.get(date).push(item); };
    for (const b of st.bookings) add(b.date, b);
    if (st.scope === 'upcoming') for (const k of st.blocks) add(k.date, { ...k, isBreak: true });
    const days = [...byDay].sort(([a], [b]) => (st.scope === 'past' ? b.localeCompare(a) : a.localeCompare(b)));
    for (const [, items] of days) items.sort((a, b) => (st.scope === 'past' ? -1 : 1) * a.start.localeCompare(b.start));

    return h('section', null,
      h('div', { class: 'toolbar' },
        h('div', { class: 'seg', role: 'group' }, seg('upcoming', L.upcoming), seg('past', L.past)),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.cancelled, onchange: (e) => { st.cancelled = e.currentTarget.checked; refresh(); } }), L.showCancelled),
        h('span', { class: 'spacer' }),
        st.updatedAt ? h('span', { class: 'muted' }, `${L.updated} ${st.updatedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`) : null,
      ),
      st.scope === 'upcoming' ? h('div', { class: 'stats' },
        h('span', null, `${L.stillToday}: `, h('strong', null, String(today.length)), today.length ? ` · ${fmt.price(sum(today), true)}` : ''),
        h('span', null, `${L.next7}: `, h('strong', null, String(week.length)), week.length ? ` · ${fmt.price(sum(week), true)}` : ''),
      ) : null,
      !st.loaded ? h('p', { class: 'empty' }, '…')
        : !days.length ? h('p', { class: 'empty' }, st.scope === 'upcoming' ? L.noUpcoming : L.noPast)
          : days.map(([date, items]) => {
            const n = items.filter((b) => !b.isBreak && b.status === 'confirmed').length;
            const rel = relDay(date);
            return h('section', { class: 'agenda-day' },
              h('h2', null, h('span', null, rel ? [h('em', null, rel), ' · '] : null, fmt.long(date)), h('small', null, L.bookingsN(n))),
              items.map((x) => (x.isBreak ? breakRow(x) : row(x))),
            );
          }),
    );
  }

  function breakRow(k) {
    const L = t();
    return h('div', { class: 'row is-break' },
      h('div', { class: 'row-time' }, `${k.start}–${k.end}`),
      h('div', { class: 'row-who' }, h('strong', null, L.breakLabel), k.reason ? h('span', { class: 'muted' }, k.reason) : null),
      h('div', { class: 'row-what' }),
      h('div', { class: 'row-act' }, h('button', { class: 'text-btn', type: 'button', onclick: async () => { await call(`/api/admin/blocks/${k.id}`, { method: 'DELETE' }); refresh(); } }, L.remove)),
    );
  }

  function row(b) {
    const L = t();
    const off = b.status === 'cancelled';
    let act;
    if (off) act = h('span', { class: 'status status-off' }, b.cancelledBy === 'shop' ? L.youCancelled : L.customerCancelled);
    else if (b.isPast) act = h('span', { class: 'status status-past' }, L.done);
    else act = h('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: () => { st.confirming = b.id; render(); } }, L.cancel);

    const el = h('div', { class: `row${off ? ' is-off' : ''}` },
      h('div', { class: 'row-time' }, `${b.start}–${b.end}`),
      h('div', { class: 'row-who' },
        h('strong', null, b.name),
        h('a', { href: `tel:${b.phone}` }, b.phone),
      ),
      h('div', { class: 'row-what' }, `${svcName(b.service)} · ${fmt.price(b.service.price, true, b.service.price_from)}`, h('span', null, b.code)),
      h('div', { class: 'row-act' }, act),
    );
    if (st.confirming === b.id && !off) {
      const yes = h('button', { class: 'btn btn-danger-solid btn-sm', type: 'button', onclick: async () => {
        setBusy(yes, true, '…');
        try { await call(`/api/admin/bookings/${b.id}/cancel`, { method: 'POST' }); st.confirming = null; await refresh(); }
        catch (e) { st.error = e.message; render(); }
      } }, L.yesCancel);
      el.append(h('div', { class: 'row-confirm' },
        h('p', null, L.confirmShopCancel(b.name, b.start)),
        yes,
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { st.confirming = null; render(); } }, L.keep),
      ));
      requestAnimationFrame(() => yes.focus());
    }
    return el;
  }

  // ---------- services ----------
  function serviceForm(s, onDone) {
    const L = t();
    const key = s ? s.id : 'new';
    const v = {
      name_de: s ? s.name_de : '', name_en: s ? s.name_en : '', desc_de: (s && s.desc_de) || '', desc_en: (s && s.desc_en) || '',
      duration_min: s ? s.duration_min : 45, price: s ? s.price : '', category: s ? s.category : (state.cfg.categories[0] || {}).id,
    };
    const err = h('div', { class: 'btn-row' });
    const id = (k) => `svc-${key}-${k}`;
    const inp = (k, label, type, extra) => {
      const el = h('input', { class: 'input', id: id(k), type, ...extra });
      el.value = v[k];
      return h('div', { class: 'field caps' }, h('label', { for: id(k) }, label), el);
    };
    const cat = h('select', { class: 'input', id: id('category') }, (state.cfg.categories || []).map((c) => h('option', { value: c.id, selected: c.id === v.category }, catName(c))));
    const from = h('input', { type: 'checkbox', id: id('price_from'), checked: Boolean(s && s.price_from) });
    const save = h('button', { class: 'btn btn-white', type: 'submit' }, s ? L.save : L.addService);
    const form = h('form', {
      class: 'svc-form', novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault();
        const val = (k) => form.querySelector(`#${id(k)}`).value;
        const body = {
          name_de: val('name_de'), name_en: val('name_en'), desc_de: val('desc_de'), desc_en: val('desc_en'), category: cat.value,
          duration_min: Number(val('duration_min')), price: Number(val('price')), price_from: from.checked,
        };
        setBusy(save, true, L.saving);
        try {
          if (s) await call(`/api/admin/services/${s.id}`, { method: 'PUT', body });
          else await call('/api/admin/services', { method: 'POST', body });
          onDone();
          await refresh();
        } catch (ex) {
          setBusy(save, false);
          err.replaceChildren(errorBox(ex.message));
        }
      },
    },
      h('div', { class: 'field caps' }, h('label', { for: id('category') }, L.category), cat),
      h('div', { class: 'field caps' }),
      inp('name_de', L.nameDe, 'text', { maxlength: '60', required: true }),
      inp('name_en', L.nameEn, 'text', { maxlength: '60' }),
      inp('desc_de', L.descDe, 'text', { maxlength: '140' }),
      inp('desc_en', L.descEn, 'text', { maxlength: '140' }),
      inp('duration_min', L.durationMin, 'number', { min: '15', step: '15', inputmode: 'numeric' }),
      inp('price', `${L.price} (${state.cfg.currency})`, 'number', { min: '0', step: '1', inputmode: 'numeric' }),
      h('label', { class: 'check svc-form-wide' }, from, L.priceFromLabel),
      err,
      h('div', { class: 'btn-row' },
        save,
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { onDone(); render(); } }, L.discard),
      ),
    );
    return form;
  }

  function serviceRow(s, i) {
    const L = t();
    const move = async (dir) => { await call(`/api/admin/services/${s.id}/move`, { method: 'POST', body: { dir } }); refresh(); };
    const toggle = async () => { await call(`/api/admin/services/${s.id}`, { method: 'PUT', body: { active: !s.active } }); refresh(); };
    return h('div', { class: `svc-admin${s.active ? '' : ' is-hidden'}` },
      h('div', { class: 'svc-admin-line' },
        h('span', { class: 'svc-name' }, s.name_de, h('small', null, [s.name_en, s.desc_de].filter(Boolean).join(' · '))),
        h('span', { class: 'svc-dur' }, `${s.duration_min} ${L.min}`),
        h('span', { class: 'svc-price' }, fmt.price(s.price, true, s.price_from)),
      ),
      st.editing === s.id
        ? serviceForm(s, () => { st.editing = null; })
        : h('div', { class: 'svc-admin-actions' },
          h('button', { class: 'text-btn', type: 'button', onclick: () => { st.editing = s.id; st.adding = false; render(); } }, L.edit),
          h('button', { class: 'text-btn', type: 'button', onclick: toggle }, s.active ? L.hide : L.showSvc),
          i > 0 ? h('button', { class: 'text-btn', type: 'button', onclick: () => move('up') }, `↑ ${L.up}`) : null,
          i < st.services.length - 1 ? h('button', { class: 'text-btn', type: 'button', onclick: () => move('down') }, `↓ ${L.down}`) : null,
          s.active ? null : h('span', { class: 'muted' }, L.hidden),
        ),
    );
  }

  function servicesView() {
    const L = t();
    return h('div', { class: 'admin-grid' },
      h('section', { class: 'panel' },
        h('h2', null, L.tabServices),
        h('p', null, L.servicesHint),
        groupServices(st.services).map(({ cat, list }) => h('div', { class: 'block' },
          cat ? h('h3', { class: 'svc-group-title' }, catName(cat)) : null,
          list.map((x) => serviceRow(x, st.services.indexOf(x))),
        )),
        h('div', { class: 'block' }, st.adding
          ? serviceForm(null, () => { st.adding = false; })
          : h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { st.adding = true; st.editing = null; render(); } }, `+ ${L.addService}`)),
      ),
    );
  }

  // ---------- breaks and days off ----------
  function breaksPanel() {
    const L = t();
    const date = h('input', { class: 'input', id: 'break-date', type: 'date', required: true, min: state.cfg.today });
    date.value = state.cfg.today;
    const from = h('input', { class: 'input', id: 'break-from', type: 'time', step: '900', required: true });
    const to = h('input', { class: 'input', id: 'break-to', type: 'time', step: '900', required: true });
    from.value = '12:30'; to.value = '13:15';
    const reason = h('input', { class: 'input', id: 'break-reason', maxlength: '80', placeholder: L.breakNotePh });
    const btn = h('button', { class: 'btn btn-white', type: 'submit' }, L.addBreak);
    const msg = h('div');
    if (st.breakFlash) msg.append(h('p', { class: 'msg msg-note', role: 'status' }, st.breakFlash));

    return h('section', { class: 'panel' },
      h('h2', null, L.breaks),
      h('p', null, L.breaksHint),
      h('form', {
        class: 'svc-form', novalidate: true,
        onsubmit: async (e) => {
          e.preventDefault();
          if (!date.value || !from.value || !to.value || from.value >= to.value) { msg.replaceChildren(errorBox(L.bad_time_msg)); return; }
          setBusy(btn, true, L.saving);
          try {
            const r = await call('/api/admin/blocks', { method: 'POST', body: { date: date.value, start: from.value, end: to.value, reason: reason.value } });
            st.breakFlash = r.affected ? L.breakWithBookings(r.affected) : null;
            await refresh();
          } catch (ex) { setBusy(btn, false); msg.replaceChildren(errorBox(ex.message)); }
        },
      },
        h('div', { class: 'field caps svc-form-wide' }, h('label', { for: 'break-date' }, L.date), date),
        h('div', { class: 'field caps' }, h('label', { for: 'break-from' }, L.from), from),
        h('div', { class: 'field caps' }, h('label', { for: 'break-to' }, L.to), to),
        h('div', { class: 'field caps svc-form-wide' }, h('label', { for: 'break-reason' }, L.noteOpt), reason),
        h('div', { class: 'btn-row' }, btn),
      ),
      msg,
      st.blocks.length
        ? h('ul', { class: 'list-rows block' }, st.blocks.map((b) => h('li', null,
          h('div', null, `${relDay(b.date) || fmt.short(b.date)}, ${b.start}–${b.end}`, b.reason ? h('span', null, ` · ${b.reason}`) : null),
          h('button', { class: 'text-btn', type: 'button', onclick: async () => { await call(`/api/admin/blocks/${b.id}`, { method: 'DELETE' }); refresh(); } }, L.remove),
        )))
        : h('p', { class: 'empty' }, L.noBreaks),
    );
  }

  function daysOffPanel() {
    const L = t();
    const date = h('input', { class: 'input', id: 'close-date', type: 'date', required: true, min: state.cfg.today });
    const reason = h('input', { class: 'input', id: 'close-reason', maxlength: '80', placeholder: L.notePh });
    const btn = h('button', { class: 'btn btn-white', type: 'submit' }, L.closeDay);
    const msg = h('div');
    if (st.flash) msg.append(h('p', { class: 'msg msg-note', role: 'status' }, st.flash));

    return h('section', { class: 'panel' },
      h('h2', null, L.tabDaysOff),
      h('p', null, L.daysOffHint),
      h('form', {
        novalidate: true,
        onsubmit: async (e) => {
          e.preventDefault();
          if (!date.value) { date.setAttribute('aria-invalid', 'true'); msg.replaceChildren(errorBox(L.pickDate)); return; }
          setBusy(btn, true, L.saving);
          try {
            const r = await call('/api/admin/closures', { method: 'POST', body: { date: date.value, reason: reason.value } });
            st.flash = r.affected ? L.closedWithBookings(r.affected) : null;
            await refresh();
          } catch (ex) { setBusy(btn, false); msg.replaceChildren(errorBox(ex.message)); }
        },
      },
        h('div', { class: 'field caps' }, h('label', { for: 'close-date' }, L.date), date),
        h('div', { class: 'field caps' }, h('label', { for: 'close-reason' }, L.noteOpt), reason),
        btn,
      ),
      msg,
      st.closures.length
        ? h('ul', { class: 'list-rows block' }, st.closures.map((c) => h('li', null,
          h('div', null, fmt.long(c.date), c.reason ? h('span', null, ` · ${c.reason}`) : null),
          h('button', { class: 'text-btn', type: 'button', onclick: async () => { await call(`/api/admin/closures/${c.date}`, { method: 'DELETE' }); refresh(); } }, L.reopen),
        )))
        : h('p', { class: 'empty' }, L.noClosures),
    );
  }

  function daysOffView() {
    return h('div', { class: 'admin-grid two-even' }, breaksPanel(), daysOffPanel());
  }

  boot(render).then(() => {
    refresh();
    setInterval(() => { if (!document.hidden && st.tab === 'bookings' && st.confirming === null) refresh(); }, 30_000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  }).catch(() => { app.replaceChildren(h('p', { class: 'msg msg-error' }, 'Server nicht erreichbar.')); });
})();
