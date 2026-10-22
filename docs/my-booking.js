(() => {
  'use strict';
  const { h, api, route, t, fmt, state, svcName, langSwitch, setBusy, errorBox, boot } = window.DRB;
  const app = document.getElementById('app');

  // step: 'form' -> 'confirm' (booking found, asking "are you sure?") -> 'result'
  const st = { phone: '', code: '', step: 'form', booking: null, error: null, ok: null };

  function statusEl(b) {
    const L = t();
    if (b.status === 'cancelled') return h('span', { class: 'status status-off' }, b.cancelledBy === 'shop' ? L.byShop : L.statusCancelled);
    if (b.isPast) return h('span', { class: 'status status-past' }, L.statusPast);
    return h('span', { class: 'status status-ok' }, L.statusConfirmed);
  }

  function bookingCard(b) {
    const L = t();
    return h('div', { class: 'card' },
      h('div', { class: 'card-head' }, h('span', { class: 'mono' }, b.code), statusEl(b)),
      h('dl', { class: 'facts' }, [
        [L.lService, svcName(b.service)],
        [L.lDate, fmt.long(b.date)],
        [L.lTime, `${b.start} – ${b.end}`],
        [L.lPrice, fmt.price(b.service.price, true, b.service.price_from)],
        [L.lName, b.name],
      ].map(([k, v]) => h('div', null, h('dt', null, k), h('dd', null, v)))),
    );
  }

  function render() {
    const L = t();
    const field = (key, type, label, ph, extra) => {
      const el = h('input', { class: `input${key === 'code' ? ' input-code' : ''}`, id: key, name: key, type, placeholder: ph, required: true, ...extra });
      el.value = st[key];
      el.addEventListener('input', () => { st[key] = el.value; el.removeAttribute('aria-invalid'); });
      return h('div', { class: 'field' }, h('label', { for: key }, label), el);
    };
    const findBtn = h('button', { class: 'btn btn-danger', type: 'submit' }, L.cancelBtn);

    let body;
    if (st.step === 'form') {
      body = h('form', {
        class: 'block', novalidate: true,
        onsubmit: async (e) => {
          e.preventDefault();
          const phoneOk = st.phone.replace(/\D/g, '').length >= 6;
          const codeOk = st.code.replace(/[^a-z0-9]/gi, '').length === 6;
          if (!phoneOk || !codeOk) {
            const el = document.getElementById(phoneOk ? 'code' : 'phone');
            el.setAttribute('aria-invalid', 'true'); el.focus();
            st.error = phoneOk ? L.errors.not_found : L.errors.bad_phone;
            return render();
          }
          st.error = null;
          setBusy(findBtn, true, L.finding);
          try {
            const { booking } = await api('/api/bookings/find', { method: 'POST', body: { phone: st.phone, code: st.code } });
            st.booking = booking;
            st.step = 'confirm';
          } catch (ex) {
            st.error = ex.message;
          }
          render();
        },
      },
        field('phone', 'tel', L.phoneLabel, L.phonePh, { autocomplete: 'tel', inputmode: 'tel' }),
        field('code', 'text', L.codeLabel, L.codePh, { autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', maxlength: '8' }),
        st.error ? errorBox(st.error) : null,
        h('div', { class: 'block' }, findBtn),
      );
    } else {
      const b = st.booking;
      const parts = [bookingCard(b)];
      if (st.ok) parts.push(h('p', { class: 'msg msg-ok', role: 'status' }, st.ok));
      if (st.error) parts.push(errorBox(st.error));

      if (st.step === 'confirm') {
        if (b.status === 'cancelled') parts.push(h('p', { class: 'msg msg-note' }, L.errors.already_cancelled));
        else if (b.isPast) parts.push(h('p', { class: 'msg msg-note' }, L.statusPast));
        else if (!b.canCancel) parts.push(h('p', { class: 'msg msg-note' }, `${L.errors.too_late} ${L.callShop(state.cfg.phone)}`));
        else {
          const yes = h('button', { class: 'btn btn-danger-solid', type: 'button', onclick: async () => {
            setBusy(yes, true, L.finding);
            try {
              const { booking } = await api('/api/bookings/cancel', { method: 'POST', body: { phone: st.phone, code: st.code } });
              st.booking = booking; st.step = 'result'; st.ok = L.cancelled; st.error = null;
            } catch (ex) {
              st.error = ex.message;
            }
            render();
          } }, L.yesCancel);
          parts.push(
            h('p', { class: 'lead' }, L.sure),
            h('div', { class: 'btn-row block' },
              h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { st.step = 'form'; st.error = null; render(); } }, L.noBack),
              yes,
            ),
          );
        }
      }
      parts.push(h('div', { class: 'block' }, h('a', { class: 'btn btn-white', href: route('home') }, L.back)));
      body = h('div', { class: 'block' }, parts);
    }

    app.replaceChildren(
      h('header', { class: 'sub-top' },
        h('a', { class: 'back', href: route('home') }, '← ', L.back),
        h('h1', { class: 'sub-title' }, L.cancelHeader),
        langSwitch(),
      ),
      h('main', { class: 'col' },
        h('div', { class: 'block' },
          h('h2', { class: 'serif-title' }, L.cancelTitle),
          h('p', { class: 'lead' }, L.cancelSub),
        ),
        body,
      ),
    );
  }

  boot(render).catch(() => {
    app.replaceChildren(h('p', { class: 'msg msg-error' }, 'Die Seite ist zurzeit nicht verfügbar.'));
  });
})();
