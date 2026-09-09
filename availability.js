/* Noble Home — live availability
   ------------------------------
   Reads the current status of each unit and updates the page.
   If the service is unreachable, the page keeps whatever is written in the
   HTML, so a visitor never sees a blank or a broken badge.

   NH_ENDPOINT is filled in once the Apps Script web app is deployed. */

var NH_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxNO4BaVuGIyCqfR1NCIdrQH0L-7OZQ9zErXgcsYj1N-kNfnfCsbTlFeu27DLGEtOMU_g/exec'; // <-- paste the Apps Script /exec URL here

(function () {
  if (!NH_ENDPOINT) return;

  function parseDate(s) {
    if (!s) return null;
    var p = String(s).slice(0, 10).split('-');
    if (p.length !== 3) return null;
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return isNaN(d) ? null : d;
  }

  function pretty(d) {
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
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
      return { badge: 'Now Leasing · Available Now', tag: 'Available Now',
               line: 'A room is open right now.', field: 'Available now' };
    }
    if (r.state === 'date') {
      var when = pretty(r.date);
      return { badge: 'Leased · Next available ' + when, tag: 'Next available ' + when,
               line: 'The next room opens ' + when + '.',
               field: 'Next available ' + when };
    }
    return { badge: 'Currently Leased · Join the Waitlist', tag: 'Currently Leased',
             line: '', field: 'Leased — no date yet' };
  }

  function apply(units) {
    units.forEach(function (u) {
      var r = copy(resolve(u));
      var id = u.id;

      document.querySelectorAll('[data-nh-badge="' + id + '"]').forEach(function (el) {
        var dot = el.querySelector('.dot');
        el.textContent = ' ' + r.badge;
        if (dot) el.insertBefore(dot, el.firstChild);
      });

      document.querySelectorAll('[data-nh-tag="' + id + '"]').forEach(function (el) {
        el.textContent = r.tag;
      });

      document.querySelectorAll('[data-nh-line="' + id + '"]').forEach(function (el) {
        el.textContent = r.line;
        el.hidden = !r.line;
      });

      document.querySelectorAll('[data-nh-field="' + id + '"]').forEach(function (el) {
        el.value = r.field;
      });

      // If a unit is genuinely open, show Apply instead of Join the Waitlist.
      var open = resolve(u).state === 'available';
      document.querySelectorAll('[data-nh-apply="' + id + '"]').forEach(function (el) {
        el.hidden = !open;
      });
      document.querySelectorAll('[data-nh-wait="' + id + '"]').forEach(function (el) {
        el.hidden = open;
      });
    });
  }

  var ctrl = new AbortController();
  setTimeout(function () { ctrl.abort(); }, 6000);

  fetch(NH_ENDPOINT, { signal: ctrl.signal })
    .then(function (r) { return r.json(); })
    .then(function (d) { if (d && d.units) apply(d.units); })
    .catch(function () { /* leave the static text exactly as it is */ });
})();
