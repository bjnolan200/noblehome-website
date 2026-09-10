/* Noble Home — live availability
   ------------------------------
   Reads the current status of each unit from the Google service and updates
   every place the website mentions availability.

   If the service is unreachable, the page keeps whatever is written into the
   HTML, so a visitor never sees a blank or a broken badge.

   Hooks it looks for:
     data-nh-badge="184"   the pill at the top of a property page
     data-nh-tag="184"     the pill on the home page card photo
     data-nh-prefix="..."  optional label kept in front of that pill's text
     data-nh-status="184"  the bold status line in a home page card
     data-nh-pill="184"    the small chip in the property switcher bar
     data-nh-line="184"    a sentence in the waitlist section
     data-nh-field="184"   hidden field carried into the waitlist email
     data-nh-apply="184"   Apply button — shown only when genuinely open
     data-nh-wait="184"    Join the Waitlist button — shown otherwise
   Every hook also gets data-nh-state="available|date|leased" so the CSS can
   colour it. The colours live in each page's stylesheet, not here.          */

var NH_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxNO4BaVuGIyCqfR1NCIdrQH0L-7OZQ9zErXgcsYj1N-kNfnfCsbTlFeu27DLGEtOMU_g/exec';

(function () {
  if (!NH_ENDPOINT) return;

  var root = document.documentElement;
  var settled = false;

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

  function parseDate(s) {
    if (!s) return null;
    var p = String(s).slice(0, 10).split('-');
    if (p.length !== 3) return null;
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return isNaN(d) ? null : d;
  }

  function longDate(d) {
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  }

  function shortDate(d) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // A date that has already passed is treated as "leased" — a stale date is
  // worse than no date, so the site heals itself instead of lying.
  function resolve(u) {
    var status = (u.status || 'leased').toLowerCase();
    if (status === 'date') {
      var d = parseDate(u.date);
      var today = new Date(); today.setHours(0, 0, 0, 0);
      if (!d || d < today) return { state: 'leased' };
      return { state: 'date', date: d };
    }
    if (status === 'available') return { state: 'available' };
    return { state: 'leased' };
  }

  function copy(r) {
    if (r.state === 'available') {
      return {
        badge:  'Available Now',
        tag:    'Available Now',
        status: 'Available now',
        pill:   'Open Now',
        line:   '',
        field:  'Available now'
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

  function apply(units) {
    units.forEach(function (u) {
      var r = resolve(u);
      var t = copy(r);
      var id = u.id;
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

      each('[data-nh-line="' + id + '"]', function (el) {
        el.textContent = t.line;
        el.hidden = !t.line;
      });

      each('[data-nh-field="' + id + '"]', function (el) {
        el.value = t.field;
      });

      // If a unit is genuinely open, show Apply instead of Join the Waitlist.
      each('[data-nh-apply="' + id + '"]', function (el) { el.hidden = !open; });
      each('[data-nh-wait="' + id + '"]',  function (el) { el.hidden = open;  });
    });
  }

  veil();

  var ctrl = new AbortController();
  setTimeout(function () { ctrl.abort(); }, 6000);

  var url = NH_ENDPOINT + (NH_ENDPOINT.indexOf('?') > -1 ? '&' : '?') + 't=' + Date.now();
  fetch(url, { signal: ctrl.signal, cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (d) { if (d && d.units) apply(d.units); })
    .catch(function () { /* leave the static text exactly as it is */ })
    .then(settle, settle);
})();
