/* Noble Home — live availability
   ------------------------------
   Reads the status of every individual bedroom from the Google service and
   works out what to say about each property. One room opening October 31 and
   another December 1 is told accurately: the website quotes the soonest.

   If the service is unreachable, the page keeps whatever is written into the
   HTML, so a visitor never sees a blank or a broken badge.

   Hooks it looks for (the number is the property, not the room):
     data-nh-badge="184"   the pill at the top of a property page
     data-nh-tag="184"     the pill on the home page card photo
     data-nh-prefix="..."  optional label kept in front of that pill's text
     data-nh-status="184"  the bold status line in a home page card
     data-nh-pill="184"    the small chip in the property switcher bar
     data-nh-line="184"    a sentence in the waitlist section
     data-nh-field="184"   hidden field carried into the waitlist email
     data-nh-apply="184"   Apply button — shown only when a room is open
     data-nh-wait="184"    Join the Waitlist button — shown otherwise
     data-nh-staff         opens the staff code box (footer link)
   Every hook also gets data-nh-state="available|date|leased" so the CSS can
   colour it. The colours live in each page's stylesheet, not here.          */

var NH_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxNO4BaVuGIyCqfR1NCIdrQH0L-7OZQ9zErXgcsYj1N-kNfnfCsbTlFeu27DLGEtOMU_g/exec';

(function () {
  if (!NH_ENDPOINT) return;

  var root = document.documentElement;
  var settled = false;

  // ---- keeping the page honest while we wait ----------------------------

  // Hide the availability wording until we know the real answer, so a visitor
  // never sees the old text flash and then change under them. If anything at
  // all goes wrong, settle() puts it back — the static text is the fallback.
  function veil() {
    try {
      var s = document.createElement('style');
      s.textContent =
        '[data-nh-badge],[data-nh-tag],[data-nh-status],[data-nh-pill]{transition:opacity .22s ease}' +
        '.nh-pending [data-nh-badge],.nh-pending [data-nh-tag],' +
        '.nh-pending [data-nh-status],.nh-pending [data-nh-pill]{opacity:0}';
      document.head.appendChild(s);
      root.classList.add('nh-pending');
      setTimeout(settle, 3000); // never leave it hidden, whatever happens
    } catch (e) { /* no veil is better than a broken page */ }
  }

  function settle() {
    if (settled) return;
    settled = true;
    root.classList.remove('nh-pending');
  }

  // ---- dates -------------------------------------------------------------

  function parseDate(s) {
    if (!s) return null;
    var p = String(s).slice(0, 10).split('-');
    if (p.length !== 3) return null;
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return isNaN(d) ? null : d;
  }

  function longDate(d)  { return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }); }
  function shortDate(d) { return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }

  // A date that has already passed is treated as "leased" — a stale date is
  // worse than no date, so the site heals itself instead of lying.
  function resolve(r) {
    var status = (r.status || 'leased').toLowerCase();
    if (status === 'date') {
      var d = parseDate(r.date);
      var today = new Date(); today.setHours(0, 0, 0, 0);
      if (!d || d < today) return { state: 'leased' };
      return { state: 'date', date: d };
    }
    if (status === 'available') return { state: 'available' };
    return { state: 'leased' };
  }

  // ---- rooms to a property-level answer ----------------------------------

  // Open rooms win. Otherwise the soonest posted date wins. Otherwise leased.
  function rollup(rooms) {
    var states = rooms.map(resolve);
    var open = states.filter(function (s) { return s.state === 'available'; });
    if (open.length) return { state: 'available', open: open.length, total: rooms.length };

    var dates = states.filter(function (s) { return s.state === 'date'; })
                      .map(function (s) { return s.date; })
                      .sort(function (a, b) { return a - b; });
    if (dates.length) return { state: 'date', date: dates[0], total: rooms.length };

    return { state: 'leased', total: rooms.length };
  }

  function copy(r) {
    if (r.state === 'available') {
      var many = r.open > 1;
      return {
        badge:  many ? r.open + ' Rooms Available Now' : 'Available Now',
        tag:    many ? r.open + ' Rooms Available'     : 'Available Now',
        status: many ? r.open + ' rooms available now' : 'Available now',
        pill:   'Open Now',
        line:   '',
        field:  many ? r.open + ' rooms available now' : 'Available now'
      };
    }
    if (r.state === 'date') {
      return {
        badge:  'Next Available ' + longDate(r.date),
        tag:    'Next available ' + longDate(r.date),
        status: 'Next available ' + longDate(r.date),
        pill:   shortDate(r.date),
        line:   'The next room opens ' + longDate(r.date) + '.',
        field:  'Next available ' + longDate(r.date)
      };
    }
    return {
      badge:  'Currently Leased · Join the Waitlist',
      tag:    'Currently Leased',
      status: 'Currently leased — join the waitlist',
      pill:   'Leased',
      line:   '',
      field:  'Leased — no date yet'
    };
  }

  function each(sel, fn) {
    var list = document.querySelectorAll(sel);
    for (var i = 0; i < list.length; i++) fn(list[i]);
  }

  function paint(id, r) {
    var t = copy(r);
    var open = r.state === 'available';

    // Pill at the top of a property page — keep the dot, replace the words.
    each('[data-nh-badge="' + id + '"]', function (el) {
      var dot = el.querySelector('.dot');
      el.textContent = ' ' + t.badge;
      if (dot) el.insertBefore(dot, el.firstChild);
      el.setAttribute('data-nh-state', r.state);
    });

    // Pill on the home page card photo — keeps its label in front.
    each('[data-nh-tag="' + id + '"]', function (el) {
      var prefix = el.getAttribute('data-nh-prefix');
      el.textContent = prefix ? prefix + ' · ' + t.tag : t.tag;
      el.setAttribute('data-nh-state', r.state);
    });

    // Bold status line inside a home page card.
    each('[data-nh-status="' + id + '"]', function (el) {
      var dot = el.querySelector('.sdot');
      el.textContent = t.status;
      if (dot) el.insertBefore(dot, el.firstChild);
      el.setAttribute('data-nh-state', r.state);
    });

    // Small chip in the property switcher bar.
    each('[data-nh-pill="' + id + '"]', function (el) {
      el.textContent = t.pill;
      el.setAttribute('data-nh-state', r.state);
    });

    each('[data-nh-line="' + id + '"]',  function (el) { el.textContent = t.line; el.hidden = !t.line; });
    each('[data-nh-field="' + id + '"]', function (el) { el.value = t.field; });
    each('[data-nh-apply="' + id + '"]', function (el) { el.hidden = !open; });
    each('[data-nh-wait="' + id + '"]',  function (el) { el.hidden = open; });
  }

  function apply(data) {
    // Room-level service (current).
    if (data.rooms && data.rooms.length) {
      var byProp = {};
      data.rooms.forEach(function (r) {
        (byProp[r.property] = byProp[r.property] || []).push(r);
      });
      Object.keys(byProp).forEach(function (id) { paint(id, rollup(byProp[id])); });
      return;
    }
    // Older property-level service — still understood, so a half-finished
    // deploy never leaves the site showing nothing.
    if (data.units && data.units.length) {
      data.units.forEach(function (u) { paint(u.id, resolve(u)); });
    }
  }

  // ---- the staff door ----------------------------------------------------

  function staffBox() {
    if (document.getElementById('nh-staff')) {
      document.getElementById('nh-staff').hidden = false;
      document.getElementById('nh-staff-code').focus();
      return;
    }

    var s = document.createElement('style');
    s.textContent =
      '#nh-staff{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;' +
        'background:rgba(12,18,24,.62);padding:20px;font-family:inherit}' +
      '#nh-staff .bx{background:#fff;border-radius:16px;padding:28px 26px;max-width:340px;width:100%;' +
        'box-shadow:0 24px 60px -18px rgba(0,0,0,.5)}' +
      '#nh-staff h3{margin:0 0 4px;font-size:1.45rem;font-family:inherit}' +
      '#nh-staff p{margin:0 0 16px;font-size:.88rem;color:#6b727a}' +
      '#nh-staff input{width:100%;padding:.8rem .9rem;font-size:1.35rem;letter-spacing:.4em;text-align:center;' +
        'border:1px solid #e2ded4;border-radius:10px;font-family:inherit;box-sizing:border-box}' +
      '#nh-staff input:focus{outline:2px solid #c9a25b;outline-offset:1px}' +
      '#nh-staff .row{display:flex;gap:.5rem;margin-top:14px}' +
      '#nh-staff button{flex:1;padding:.75rem 1rem;border-radius:50px;border:1.5px solid #b8893b;' +
        'background:#b8893b;color:#fff;font-weight:600;font-size:.92rem;cursor:pointer;font-family:inherit}' +
      '#nh-staff button.alt{background:#fff;color:#3a4149;border-color:#e2ded4}' +
      '#nh-staff button[disabled]{opacity:.55;cursor:not-allowed}' +
      '#nh-staff .err{color:#8c2019;font-size:.85rem;margin-top:10px;min-height:1.1em}';
    document.head.appendChild(s);

    var wrap = document.createElement('div');
    wrap.id = 'nh-staff';
    wrap.innerHTML =
      '<div class="bx" role="dialog" aria-modal="true" aria-label="Staff access">' +
        '<h3>Availability</h3>' +
        '<p>Staff only. Enter the code to update what the website says.</p>' +
        '<input id="nh-staff-code" type="password" inputmode="numeric" autocomplete="off" ' +
               'aria-label="Access code" placeholder="····" />' +
        '<div class="err" id="nh-staff-err"></div>' +
        '<div class="row">' +
          '<button class="alt" id="nh-staff-x" type="button">Cancel</button>' +
          '<button id="nh-staff-go" type="button">Continue</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);

    var input = document.getElementById('nh-staff-code');
    var err   = document.getElementById('nh-staff-err');
    var go    = document.getElementById('nh-staff-go');

    function close() { wrap.hidden = true; err.textContent = ''; input.value = ''; }

    document.getElementById('nh-staff-x').addEventListener('click', close);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !wrap.hidden) close();
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') go.click(); });

    go.addEventListener('click', function () {
      var code = input.value.trim();
      err.textContent = '';
      if (!code) { err.textContent = 'Enter the code.'; return; }
      go.disabled = true; go.textContent = 'Checking…';

      fetch(NH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ code: code, action: 'check' })
      })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) { err.textContent = d.error || 'That code is not right.'; return; }
        // Hand the code to the staff page for this tab only, then go there.
        try { sessionStorage.setItem('nh_code', code); } catch (e) {}
        location.href = 'manage.html';
      })
      .catch(function () { err.textContent = "Couldn't reach the service. Try again in a moment."; })
      .then(function () { go.disabled = false; go.textContent = 'Continue'; },
            function () { go.disabled = false; go.textContent = 'Continue'; });
    });

    input.focus();
  }

  function initStaff() {
    each('[data-nh-staff]', function (el) {
      el.addEventListener('click', function (e) { e.preventDefault(); staffBox(); });
    });
  }

  // ---- go ----------------------------------------------------------------

  initStaff();
  veil();

  var ctrl = new AbortController();
  setTimeout(function () { ctrl.abort(); }, 6000);

  var url = NH_ENDPOINT + (NH_ENDPOINT.indexOf('?') > -1 ? '&' : '?') + 't=' + Date.now();
  fetch(url, { signal: ctrl.signal, cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (d) { if (d) apply(d); })
    .catch(function () { /* leave the static text exactly as it is */ })
    .then(settle, settle);
})();
